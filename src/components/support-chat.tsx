import { useEffect, useRef, useState } from "react";
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
import { askSupport } from "@/lib/support-ai";

type UiRole = "user" | "assistant" | "system";

type UiMessage = {
  id: string;
  role: UiRole;
  content: string;
};

const GREETING =
  "Olá! Sou o assistente da MenteExperta. Posso ajudar com dúvidas sobre os ebooks, as edições e a compra.";

let messageSeq = 0;
function nextId() {
  messageSeq += 1;
  return `m${messageSeq}`;
}

export function SupportChat() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState("");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [humanRequested, setHumanRequested] = useState(false);
  const [connected, setConnected] = useState<boolean | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const transcript = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const el = transcript.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages, pending]);

  async function sendMessage() {
    const text = message.trim();
    if (!text || pending) return;

    const history = [
      ...messages.filter((m) => m.role !== "system"),
      { role: "user" as const, content: text },
    ];

    setMessages((prev) => [...prev, { id: nextId(), role: "user", content: text }]);
    setMessage("");
    setAttachment("");
    setPending(true);

    try {
      const result = await askSupport({
        data: {
          messages: history.map((m) => ({ role: m.role, content: m.content })),
        },
      });
      setConnected(result.connected && result.ok);
      setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content: result.reply }]);
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

  function requestHuman() {
    if (humanRequested) return;
    setHumanRequested(true);
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: "system",
        content:
          "Pedido enviado. O seu pedido de atendimento humano ficou registado. A entrega para um atendente ainda não está configurada neste ambiente — a equipa TTC Corporation verá o pedido assim que o canal estiver ligado.",
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
                onClick={requestHuman}
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
                    {m.role === "system" ? (
                      <img src="/ttc-logo.png" alt="" />
                    ) : (
                      <Headset size={15} strokeWidth={2.2} />
                    )}
                  </span>
                )}
                <p className={`support-bubble support-bubble-${m.role}`}>{m.content}</p>
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
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown /> : <MessageCircle fill="currentColor" />}
      </Button>
    </div>
  );
}
