import { createHmac, timingSafeEqual } from "node:crypto";

import { readEnv, readEnvOr } from "./env.server";

/**
 * Integração com a InfiniGate (PIX + webhooks).
 * Docs: https://api.infini-gate.com — POST /deposit, webhook deposit_update.
 */

const DEFAULT_BASE_URL = "https://api.infini-gate.com";
const SIGNATURE_TOLERANCE_SECONDS = 300;

export const MISSING_INFINIGATE_MESSAGE =
  "Pagamento por PIX não configurado. Defina INFINIGATE_DEPOSIT_KEY no ambiente.";

export function infinigateConfigured(): boolean {
  return Boolean(readEnv("INFINIGATE_DEPOSIT_KEY"));
}

export type PixCharge = {
  id: string;
  status: string;
  amount: number;
  qrCode: string | null;
  qrCodeImage: string | null;
};

type ChargeInput = {
  amount: number;
  document: string;
  name: string;
  email: string;
  externalId: string;
  webhookUrl: string;
  metadata?: Record<string, unknown>;
};

export async function createPixCharge(
  input: ChargeInput,
): Promise<{ ok: true; charge: PixCharge } | { ok: false; error: string }> {
  const key = readEnv("INFINIGATE_DEPOSIT_KEY");
  if (!key) return { ok: false, error: MISSING_INFINIGATE_MESSAGE };

  const baseUrl = readEnvOr("INFINIGATE_BASE_URL", DEFAULT_BASE_URL).replace(/\/+$/, "");

  const body: Record<string, unknown> = {
    key,
    amount: input.amount,
    gateway: "pix",
    document: input.document.replace(/\D/g, ""),
    name: input.name,
    email: input.email,
    externalId: input.externalId,
    webhookUrl: input.webhookUrl,
  };
  if (input.metadata) body["metadata"] = input.metadata;

  try {
    const response = await fetch(`${baseUrl}/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    const payload: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      return {
        ok: false,
        error:
          extractError(payload) ?? `A InfiniGate recusou a cobrança (HTTP ${response.status}).`,
      };
    }

    const data = (payload ?? {}) as Record<string, unknown>;
    const id = typeof data["id"] === "string" ? data["id"] : null;
    if (!id) return { ok: false, error: "A InfiniGate não devolveu o identificador da cobrança." };

    return {
      ok: true,
      charge: {
        id,
        status: typeof data["status"] === "string" ? data["status"] : "pending",
        amount: typeof data["amount"] === "number" ? data["amount"] : input.amount,
        qrCode: typeof data["qrCode"] === "string" ? data["qrCode"] : null,
        qrCodeImage: typeof data["qrCodeImage"] === "string" ? data["qrCodeImage"] : null,
      },
    };
  } catch (error) {
    console.error("[infinigate] deposito falhou", error);
    return { ok: false, error: "Não foi possível contactar a InfiniGate. Tente novamente." };
  }
}

function extractError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  const message = (payload as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

/**
 * Verifica o header `X-InfiniGate-Signature: t=<unix>,v1=<hmac_hex>`.
 * v1 = HMAC_SHA256(webhook key, "<t>.<corpo_bruto>")
 */
export function verifyWebhookSignature(rawBody: string, header: string | null): boolean {
  const key = readEnv("INFINIGATE_WEBHOOK_KEY");
  if (!key || !header) return false;

  const parts = header.split(",").reduce<Record<string, string>>((acc, part) => {
    const [name, value] = part.split("=");
    if (name && value) acc[name.trim()] = value.trim();
    return acc;
  }, {});

  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return false;
  if (Math.abs(Date.now() / 1000 - seconds) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", key).update(`${timestamp}.${rawBody}`).digest("hex");
  const a = Buffer.from(signature, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
