import { useCallback, useEffect, useRef, useState } from "react";
import {
  Home,
  MessageCircle,
  X,
  Send,
  Smile,
  Paperclip,
  AudioLines,
  ChevronDown,
  Headset,
  UserRound,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { askSupport, type ChatMessage } from "@/lib/support-ai";
import { getSupportReplies, getSupportThread, requestHumanSupport } from "@/lib/api";

type UiRole = "user" | "assistant" | "system" | "admin";

type UiMessage = {
  id: string;
  role: UiRole;
  content: string;
};

const GREETING =
  "Olá! Sou o assistente da MenteExperta. Posso ajudar com dúvidas sobre os ebooks, as edições e a compra.";

const SESSION_KEY = "me_support_chat_session";
const POLL_INTERVAL_MS = 5000;

let messageSeq = 0;
function nextId() {
  messageSeq += 1;
  return `m${messageSeq}`;
}

function createSessionId(): string {
  const webCrypto = typeof crypto !== "undefined" ? crypto : undefined;
  if (webCrypto && typeof webCrypto.randomUUID === "function") return webCrypto.randomUUID();
  return `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

export function SupportChat({ country }: { country?: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [humanRequested, setHumanRequested] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);
  const file = useRef<HTMLInputElement>(null);
  const transcript = useRef<HTMLDivElement>(null);
  const lastReplyId = useRef(0);
  const openRef = useRef(open);
  const pollLock = useRef(false);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  // Identificador estável da conversa, para o painel poder responder.
  useEffect(() => {
    if (typeof window === "undefined") return;
    let id: string | null = null;
    try {
      id = window.sessionStorage.getItem(SESSION_KEY);
    } catch {
      // sessionStorage bloqueado (modo privado / iframe) — seguimos em memória
      id = null;
    }
    if (!id) {
      id = createSessionId();
      try {
        window.sessionStorage.setItem(SESSION_KEY, id);
      } catch {
        // sem persistência entre recargas, mas a conversa continua a ser enviada
      }
    }
    setSessionId(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    const el = transcript.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages, pending]);

  // Procura respostas da equipa (admin) no servidor.
  const pollReplies = useCallback(async () => {
    if (!sessionId || pollLock.current) return;
    pollLock.current = true;
    try {
      const result = await getSupportReplies({
        data: { sessionId, afterId: lastReplyId.current },
      });
      const fresh = result.replies.filter((item) => item.id > lastReplyId.current);
      if (fresh.length === 0) return;
      lastReplyId.current = fresh[fresh.length - 1]!.id;
      setMessages((prev) => [
        ...prev,
        ...fresh.map((item) => ({
          id: `a${item.id}`,
          role: "admin" as const,
          content: item.content,
        })),
      ]);
      if (!openRef.current) setUnread((count) => count + fresh.length);
    } catch (error) {
      console.error("[support-chat] poll failed", error);
    } finally {
      pollLock.current = false;
    }
  }, [sessionId]);

  // Restaura a conversa guardada (incluindo respostas anteriores da equipa).
  const hydrate = useCallback(async () => {
    if (!sessionId) return;
    try {
      const result = await getSupportThread({ data: { sessionId } });
      if (result.messages.length === 0) return;

      const restored: UiMessage[] = [];
      let human = false;

      for (const item of result.messages) {
        if (item.kind === "human_request") {
          if (item.author === "visitor") {
            human = true;
            restored.push({
              id: `h${item.id}`,
              role: "system",
              content:
                "Pedido de atendimento humano registado. A equipa TTC Corporation vê-o no painel.",
            });
          }
          continue;
        }
        restored.push({
          id: `h${item.id}`,
          role: item.author === "visitor" ? "user" : item.author,
          content: item.content,
        });
      }

      lastReplyId.current = result.messages[result.messages.length - 1]!.id;
      if (human) setHumanRequested(true);
      setMessages(restored);
    } catch (error) {
      console.error("[support-chat] hydrate failed", error);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    let timer: number | undefined;

    async function boot() {
      await hydrate();
      if (cancelled) return;
      await pollReplies();
      if (cancelled) return;
      timer = window.setInterval(() => void pollReplies(), POLL_INTERVAL_MS);
    }

    void boot();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [sessionId, hydrate, pollReplies]);

  async function sendMessage() {
    const text = message.trim();
    if (!text || pending) return;

    const history: ChatMessage[] = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
    history.push({ role: "user", content: text });

    setMessages((prev) => [...prev, { id: nextId(), role: "user", content: text }]);
    setMessage("");
    setAttachment("");
    setPending(true);

    try {
      const result = await askSupport({
        data: { messages: history, sessionId: sessionId ?? "", country: country ?? "" },
      });
      setConnected(result.connected && result.ok);
      setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content: result.reply }]);
      window.setTimeout(() => void pollReplies(), 400);
    } catch (error) {
      console.error("[support-chat] send failed", error);
      setConnected(false);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "system",
          content:
            "Não foi possível enviar a mensagem. Verifique a ligação e tente novamente ou use «Pedir humano».",
        },
      ]);
    } finally {
      setPending(false);
    }
  }

  async function requestHuman() {
    if (humanRequested) return;
    setHumanRequested(true);

    const note =
      message.trim() || [...messages].reverse().find((m) => m.role === "user")?.content || null;

    let delivered = false;
    try {
      const result = await requestHumanSupport({
        data: { sessionId: sessionId ?? "", note, country: country ?? null },
      });
      delivered = result.ok && result.delivered;
    } catch (error) {
      console.error("[support-chat] human request failed", error);
    }

    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: "system",
        content: delivered
          ? "Pedido enviado. A equipa TTC Corporation recebeu o seu pedido e vê-o no painel. Assim que responderem, a resposta aparece aqui neste chat."
          : "O canal de atendimento humano ainda não está ligado neste ambiente, por isso o pedido não chegou à equipa. Pode continuar a falar com o assistente automático.",
      },
    ]);
  }

  function goHome() {
    setOpen(false);
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      const home = document.getElementById("home");
      if (home) {
        home.scrollIntoView({ behavior: "smooth", block: "start" });
        window.history.replaceState(null, "", "#home");
      } else {
        window.location.assign("/#home");
      }
    });
  }

  const statusLabel =
    connected === false ? "Atendimento automático não conectado" : "Atendimento automático · IA";

  return (
    <div className="support-widget">
      {open && (
        <section className="support-panel" role="dialog" aria-label="Chat de apoio TTC Corporation">
          <div className="support-top">
            <div className="support-tabs">
              <Button size="icon" variant="ghost" aria-label="Ir para a home" onClick={goHome}>
                <Home size={15} />
              </Button>
              <button
                type="button"
                className="support-tab"
                onClick={() => void requestHuman()}
                disabled={humanRequested}
                aria-label={humanRequested ? "Pedido de humano enviado" : "Pedir humano"}
              >
                {humanRequested ? <Check size={14} /> : <UserRound size={14} />}
                {humanRequested ? "Pedido enviado" : "Pedir humano"}
              </button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Fechar chat"
                onClick={() => setOpen(false)}
              >
                <X size={17} />
              </Button>
            </div>
            <div className="support-avatars">
              <span className="support-avatar-initials" title="Equipa MenteExperta">
                TH
              </span>
              <span className="support-avatar-corp" title="Apoio ao cliente">
                <Headset size={20} strokeWidth={2.1} aria-hidden="true" />
              </span>
              <span className="support-avatar-brand" title="TTC Corporation">
                <img src="/ttc-logo.png" alt="TTC Corporation" width={43} height={43} />
              </span>
            </div>
            <h2>Dúvidas? Fale connosco.</h2>
            <p>{statusLabel}</p>
          </div>

          <div className="support-transcript" aria-live="polite" ref={transcript}>
            <div className="support-greeting">
              <span className="support-mini-logo" aria-hidden="true">
                <Headset size={15} strokeWidth={2.2} />
              </span>
              <p>{GREETING}</p>
            </div>
            {messages.map((m) => (
              <div key={m.id} className={`support-row support-row-${m.role}`}>
                {m.role !== "user" && (
                  <span className="support-mini-logo" aria-hidden="true">
                    {m.role === "assistant" ? (
                      <Headset size={15} strokeWidth={2.2} />
                    ) : (
                      <img src="/ttc-logo.png" alt="" />
                    )}
                  </span>
                )}
                {m.role === "admin" ? (
                  <div className="support-bubble-wrap">
                    <span className="support-admin-label">Equipa MenteExperta</span>
                    <p className="support-bubble support-bubble-admin">{m.content}</p>
                  </div>
                ) : (
                  <p className={`support-bubble support-bubble-${m.role}`}>{m.content}</p>
                )}
              </div>
            ))}
            {pending && (
              <div className="support-row support-row-assistant">
                <span className="support-mini-logo" aria-hidden="true">
                  <Headset size={15} strokeWidth={2.2} />
                </span>
                <p className="support-bubble support-bubble-assistant support-typing">
                  <i />
                  <i />
                  <i />
                </p>
              </div>
            )}
          </div>

          <form
            className="support-composer"
            onSubmit={(e) => {
              e.preventDefault();
              void sendMessage();
            }}
          >
            <textarea
              aria-label="Sua mensagem"
              placeholder="Escreva a sua mensagem..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              disabled={pending}
            />
            {attachment && (
              <p className="support-attachment">
                {attachment}
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Remover anexo"
                  onClick={() => setAttachment("")}
                >
                  <X />
                </Button>
              </p>
            )}
            <div className="support-tools">
              <Button
                size="icon"
                variant="ghost"
                title="Adicionar emoji"
                aria-label="Adicionar emoji"
                onClick={() => setMessage((m) => m + " 🙂")}
              >
                <Smile />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Anexar ficheiro"
                aria-label="Anexar ficheiro"
                onClick={() => file.current?.click()}
              >
                <Paperclip />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title="Áudio indisponível"
                aria-label="Áudio indisponível"
                disabled
              >
                <AudioLines />
              </Button>
              <input
                type="file"
                hidden
                ref={file}
                onChange={(e) => setAttachment(e.target.files?.[0]?.name ?? "")}
              />
              <Button
                type="submit"
                size="icon"
                variant="ghost"
                className="support-send"
                aria-label="Enviar mensagem"
                disabled={pending || (!message.trim() && !attachment)}
              >
                <Send fill="currentColor" />
              </Button>
            </div>
          </form>
          <div className="support-footer">TTC CORPORATION</div>
        </section>
      )}
      <Button
        className="support-launcher"
        aria-label={open ? "Minimizar chat" : "Abrir chat"}
        onClick={() => {
          setOpen(!open);
          if (!open) setUnread(0);
        }}
      >
        {open ? <ChevronDown /> : <MessageCircle fill="currentColor" />}
        {!open && unread > 0 ? (
          <span className="support-badge" aria-label={`${unread} novas mensagens`}>
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Button>
    </div>
  );
}
