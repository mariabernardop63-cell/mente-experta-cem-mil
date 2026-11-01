import { createServerFn } from "@tanstack/react-start";

/**
 * Server-side bridge to the TokenHarbor API.
 *
 * The API key never reaches the browser: it is read from the environment on the
 * server (`.env` locally / project env vars on Vercel and Replit) and the request
 * is made from this handler only.
 */

const DEFAULT_BASE_URL = "https://tokenharbor.ai/v1";
const DEFAULT_MODEL = "deepseek-v4.1-flash:free";
const MAX_MESSAGES = 12;
const MAX_CHARS = 2000;
const REQUEST_TIMEOUT_MS = 45_000;

export type ChatRole = "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export type SupportReply = {
  /** true when the model answered. */
  ok: boolean;
  /** true when credentials were available and the API was reachable. */
  connected: boolean;
  reply: string;
};

export const NOT_CONNECTED_REPLY =
  "O atendimento automático ainda não está conectado. A equipa TTC Corporation ainda não configurou a chave da API do TokenHarbor neste ambiente.";

const SYSTEM_PROMPT = [
  "És o assistente de apoio da MenteExperta, marca do grupo TTC Corporation.",
  "Falas português de Portugal, de forma breve, clara e cordial.",
  "Ajudas com dúvidas sobre os ebooks MenteExperta:",
  '- "Como Fazer 100K Antes de 2027", edição Beta a 19,90 R$ e edição Premium a 399,89 R$.',
  "Explicas que os resultados dependem da execução e do contexto de cada pessoa e que não há garantia de rendimento.",
  "Nunca inventas preços, prazos, depoimentos ou dados que não estejam nesta descrição.",
  "Se não souberes responder, dizes que vais encaminhar para um humano através da opção «Pedir humano».",
  "Mantém as respostas em no máximo 4 frases.",
].join(" ");

function sanitize(input: unknown): ChatMessage[] {
  if (!input || typeof input !== "object") return [];
  const raw = (input as { messages?: unknown }).messages;
  if (!Array.isArray(raw)) return [];

  const messages: ChatMessage[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.trim().slice(0, MAX_CHARS);
    if (!trimmed) continue;
    messages.push({ role, content: trimmed });
  }
  return messages.slice(-MAX_MESSAGES);
}

/** Load `.env` in Node runtimes that do not populate `process.env` themselves. */
function loadEnvFile() {
  if (process.env["TOKENHARBOR_API_KEY"]) return;
  try {
    process.loadEnvFile?.();
  } catch {
    // No .env file (e.g. variables already provided by the host) — ignore.
  }
}

function extractReply(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return "";
  const first = choices[0];
  if (!first || typeof first !== "object") return "";
  const message = (first as { message?: unknown }).message;
  if (!message || typeof message !== "object") return "";
  const content = (message as { content?: unknown }).content;
  return typeof content === "string" ? content.trim() : "";
}

function extractError(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const error = (payload as { error?: unknown }).error;
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return "";
}

export const askSupport = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
    const sessionId =
      typeof raw["sessionId"] === "string" ? raw["sessionId"].trim().slice(0, 120) : "";
    const country = typeof raw["country"] === "string" ? raw["country"].trim().slice(0, 8) : "";
    return { messages: sanitize(input), sessionId, country };
  })
  .handler(async ({ data }): Promise<SupportReply> => {
    const result = await answer(data.messages);

    const last = data.messages.at(-1);
    if (data.sessionId && last && last.role === "user") {
      await persistExchange(data.sessionId, data.country, last.content, result);
    }

    return result;
  });

/** Guarda a conversa para o painel poder responder. Falha em silêncio sem DB. */
async function persistExchange(
  sessionId: string,
  country: string,
  question: string,
  result: SupportReply,
): Promise<void> {
  try {
    const catalog = await import("./catalog.server");
    await catalog.recordSupportMessage({
      sessionId,
      author: "visitor",
      content: question,
      country: country || null,
    });
    if (result.ok) {
      await catalog.recordSupportMessage({
        sessionId,
        author: "assistant",
        content: result.reply,
      });
    }
  } catch (error) {
    console.error("[support-ai] persist failed", error);
  }
}

async function answer(messages: ChatMessage[]): Promise<SupportReply> {
  loadEnvFile();

  const apiKey = process.env["TOKENHARBOR_API_KEY"]?.trim();
  if (!apiKey) {
    return { ok: false, connected: false, reply: NOT_CONNECTED_REPLY };
  }

  const last = messages.at(-1);
  if (!last || last.role !== "user") {
    return {
      ok: false,
      connected: true,
      reply: "Escreva a sua mensagem para que eu possa ajudar.",
    };
  }

  const baseUrl = (process.env["TOKENHARBOR_BASE_URL"] ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const model = process.env["TOKENHARBOR_MODEL"] ?? DEFAULT_MODEL;

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        max_tokens: 600,
        temperature: 0.6,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      console.error(
        "[support-ai] TokenHarbor error",
        response.status,
        extractError(payload) || response.statusText,
      );
      return {
        ok: false,
        connected: true,
        reply:
          "Não consegui obter resposta do atendimento automático agora. Tente novamente dentro de instantes ou use «Pedir humano».",
      };
    }

    const reply = extractReply(payload);
    if (!reply) {
      return {
        ok: false,
        connected: true,
        reply: "O atendimento automático devolveu uma resposta vazia. Tente reformular a pergunta.",
      };
    }

    return { ok: true, connected: true, reply };
  } catch (error) {
    console.error("[support-ai] request failed", error);
    return {
      ok: false,
      connected: true,
      reply:
        "Não foi possível contactar o atendimento automático. Verifique a ligação e tente novamente.",
    };
  }
}
