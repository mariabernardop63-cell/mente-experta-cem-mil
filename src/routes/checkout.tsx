import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ClipboardCopy,
  Clock,
  Download,
  Loader2,
  Lock,
  Mail,
  QrCode,
  ShieldCheck,
  Smartphone,
  User,
  Wallet,
} from "lucide-react";

import { createPixOrder, getCheckoutContext, getOrderStatus, submitEmolaOrder } from "@/lib/api";
import { formatPrice, type PaymentMethod } from "@/lib/types";

export const Route = createFileRoute("/checkout")({
  validateSearch: (search: Record<string, unknown>) => ({
    edition: typeof search["edition"] === "string" ? search["edition"] : "beta",
  }),
  loaderDeps: ({ search }) => ({ edition: search.edition }),
  loader: ({ deps }) => getCheckoutContext({ data: { productId: deps.edition } }),
  head: () => ({
    meta: [
      { title: "Pagamento — MenteExperta" },
      { name: "description", content: "Finalize a compra do seu ebook MenteExperta." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CheckoutPage,
});

function formatContact(value: string): string {
  return value.includes("@") ? value : value.replace(/\s+/g, " ").trim();
}

function CheckoutPage() {
  const context = Route.useLoaderData();
  const { region, product } = context;
  const symbol = region.symbol;

  return (
    <main className="pay-shell">
      <header className="pay-header">
        <Link to="/" className="brand pay-brand" aria-label="Voltar ao site">
          <span className="brand-symbol" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            MenteExperta<span className="brand-dot">.</span>
          </span>
        </Link>
        <Link to="/" className="pay-back">
          <ArrowLeft size={16} /> Voltar
        </Link>
      </header>

      <div className="pay-layout">
        <section className="pay-summary" aria-label="Resumo do pedido">
          <p className="pay-eyebrow">Finalizar compra</p>
          <h1>
            {product ? product.name : "Edição indisponível"}
            <span>.</span>
          </h1>
          {product ? (
            <>
              <p className="pay-tagline">{product.tagline}</p>
              <ul className="pay-features">
                {product.features.map((feature) => (
                  <li key={feature}>
                    <Check size={15} /> {feature}
                  </li>
                ))}
              </ul>
              <div className="pay-total">
                <span>Total</span>
                <strong>
                  <i>{symbol}</i> {formatPrice(product.price)}
                </strong>
              </div>
              <p className="pay-region">
                {region.isMozambique ? (
                  <>
                    <Smartphone size={14} /> Detetámos um acesso de Moçambique — pagamento por
                    carteira móvel (e-Mola ou M-Pesa).
                  </>
                ) : (
                  <>
                    <QrCode size={14} /> Pagamento por PIX (Brasil e restantes países).
                  </>
                )}
              </p>
              {!context.databaseConfigured ? (
                <p className="pay-warn">
                  Base de dados ainda não configurada neste ambiente. Os pedidos não ficam
                  registados até o Supabase ser ligado.
                </p>
              ) : null}
            </>
          ) : (
            <p className="pay-warn">
              Não encontrámos esta edição. Volte à página inicial e escolha um dos ebooks.
            </p>
          )}
        </section>

        <section className="pay-panel" aria-label="Pagamento">
          {product ? (
            region.isMozambique ? (
              <EmolaFlow
                productId={product.id}
                productName={product.name}
                price={product.price}
                symbol={symbol}
                methods={context.methods}
                instructions={context.instructions}
              />
            ) : (
              <PixFlow
                productId={product.id}
                price={product.price}
                symbol={symbol}
                pixEnabled={context.pixEnabled}
              />
            )
          ) : (
            <div className="pay-empty">
              <Link to="/" className="pay-primary">
                Ver as edições <ArrowLeft size={16} />
              </Link>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

/* --------------------------------------------------- carteira móvel (MZ) */

function EmolaFlow({
  productId,
  productName,
  price,
  symbol,
  methods,
  instructions,
}: {
  productId: string;
  productName: string;
  price: number;
  symbol: string;
  methods: PaymentMethod[];
  instructions: string[];
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [name, setName] = useState("");
  const [senderNumber, setSenderNumber] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const chosen = methods.find((method) => method.id === methodId) ?? methods[0] ?? null;

  async function submit() {
    setError(null);
    if (!chosen) {
      setError("Nenhuma carteira móvel está disponível para pagamento neste momento.");
      return;
    }
    if (!name.trim() || !senderNumber.trim() || !message.trim()) {
      setError("Preencha o nome, o número de onde transferiu e a mensagem de confirmação.");
      return;
    }
    if (contact.trim().length < 5) {
      setError("Indique um WhatsApp ou e-mail válido para receber o ebook.");
      return;
    }

    setBusy(true);
    try {
      const result = await submitEmolaOrder({
        data: {
          productId,
          name,
          emolaNumber: senderNumber,
          methodId: chosen.id,
          confirmationMessage: message,
          contact,
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setOrderId(result.orderId);
      setStep(3);
    } catch {
      setError("Não foi possível enviar o pedido. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  if (!chosen) {
    return (
      <div className="pay-state pay-blocked">
        <span className="pay-state-icon">
          <Lock size={28} />
        </span>
        <h2>Carteiras móveis indisponíveis</h2>
        <p>
          A equipa ainda não configurou os números de e-Mola e M-Pesa. Volte mais tarde ou fale com
          o apoio pelo chat do site.
        </p>
        <Link to="/" className="pay-secondary">
          Voltar ao site
        </Link>
      </div>
    );
  }

  if (step === 3) {
    return (
      <div className="pay-state pay-success">
        <span className="pay-state-icon">
          <BadgeCheck size={30} />
        </span>
        <h2>Pedido submetido</h2>
        <p>
          Recebemos o comprovativo da edição <strong>{productName}</strong> ({" "}
          <strong>
            {symbol} {formatPrice(price)}
          </strong>{" "}
          ).
        </p>
        <div className="pay-steps-done">
          <span>
            <Check size={14} /> Comprovativo registado
          </span>
          <span>
            <Check size={14} /> Contacto de entrega: {formatContact(contact)}
          </span>
        </div>
        <p className="pay-note">
          <Clock size={14} />
          Após a verificação da equipa, o ebook será entregue em{" "}
          <strong>{formatContact(contact)}</strong>. A verificação costuma demorar até algumas horas
          úteis.
        </p>
        {orderId ? <p className="pay-ref">Referência do pedido: {orderId.slice(0, 8)}</p> : null}
        <Link to="/" className="pay-primary">
          Voltar ao site
        </Link>
      </div>
    );
  }

  return (
    <div className="pay-state">
      <ol className="pay-progress">
        <li className={step >= 1 ? "active" : ""}>1. Transferência</li>
        <li className={step >= 2 ? "active" : ""}>2. Entrega</li>
        <li>3. Confirmação</li>
      </ol>

      {step === 1 ? (
        <>
          <h2>Pagamento por carteira móvel</h2>
          <p className="pay-hint">
            Transfira exatamente{" "}
            <strong>
              {symbol} {formatPrice(price)}
            </strong>{" "}
            para o número da carteira que escolher abaixo e guarde a mensagem de confirmação.
          </p>

          <div className="pay-targets" role="radiogroup" aria-label="Escolha a carteira de destino">
            {methods.map((method) => {
              const selected = chosen.id === method.id;
              return (
                <button
                  type="button"
                  key={method.id}
                  role="radio"
                  aria-checked={selected}
                  className={`pay-target ${selected ? "selected" : ""}`}
                  onClick={() => setMethodId(method.id)}
                >
                  <span className="pay-target-head">
                    {method.id === "mpesa" ? <Wallet size={16} /> : <Smartphone size={16} />}
                    {method.label}
                  </span>
                  <strong>{method.number}</strong>
                  {method.holder ? (
                    <span className="pay-target-holder">{method.holder}</span>
                  ) : null}
                  {method.note ? <span className="pay-target-note">{method.note}</span> : null}
                </button>
              );
            })}
          </div>

          <ol className="pay-instructions">
            {instructions.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>

          <div className="pay-fields">
            <label>
              <span>Nome do titular</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="O seu nome completo"
                autoComplete="name"
              />
            </label>
            <label>
              <span>Número de onde transferiu</span>
              <input
                value={senderNumber}
                onChange={(e) => setSenderNumber(e.target.value)}
                placeholder="Ex.: 84 000 0000"
                inputMode="tel"
              />
            </label>
            <label>
              <span>Mensagem de confirmação da transferência</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                placeholder="Cole aqui a mensagem/SMS de confirmação que recebeu"
              />
            </label>
          </div>

          {error ? <p className="pay-error">{error}</p> : null}

          <button type="button" className="pay-primary" onClick={() => setStep(2)}>
            Submeter comprovativo
          </button>
          <p className="pay-legal">
            <ShieldCheck size={13} /> O pedido fica pendente até a equipa confirmar a transferência.
          </p>
        </>
      ) : (
        <>
          <h2>Onde entregamos o ebook?</h2>
          <p className="pay-hint">
            Indique o seu WhatsApp ou e-mail. É por esse contacto que a equipa envia a edição{" "}
            <strong>{productName}</strong> depois de confirmar o pagamento.
          </p>

          <div className="pay-fields">
            <label>
              <span>WhatsApp ou e-mail</span>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Ex.: +258 84 000 0000 ou nome@email.com"
              />
            </label>
          </div>

          <div className="pay-recap">
            <div>
              <span>Edição</span>
              <strong>{productName}</strong>
            </div>
            <div>
              <span>Valor</span>
              <strong>
                {symbol} {formatPrice(price)}
              </strong>
            </div>
            <div>
              <span>Destino</span>
              <strong>
                {chosen.label} · {chosen.number}
              </strong>
            </div>
          </div>

          {error ? <p className="pay-error">{error}</p> : null}

          <div className="pay-actions">
            <button
              type="button"
              className="pay-secondary"
              onClick={() => setStep(1)}
              disabled={busy}
            >
              Voltar
            </button>
            <button type="button" className="pay-primary" onClick={submit} disabled={busy}>
              {busy ? (
                <>
                  <Loader2 size={16} className="pay-spin" /> A enviar…
                </>
              ) : (
                "Concluir pedido"
              )}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- PIX (BRL) */

type PixResult = Extract<Awaited<ReturnType<typeof createPixOrder>>, { ok: true }>;

function PixFlow({
  productId,
  price,
  symbol,
  pixEnabled,
}: {
  productId: string;
  price: number;
  symbol: string;
  pixEnabled: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [charge, setCharge] = useState<PixResult | null>(null);
  const [status, setStatus] = useState<string>("pending");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const pollRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const check = useCallback(
    async (current: PixResult) => {
      try {
        const result = await getOrderStatus({
          data: { orderId: current.orderId, accessToken: current.accessToken },
        });
        if (!result.ok) return;
        setStatus(result.status);
        if (result.downloadUrl) setDownloadUrl(result.downloadUrl);
        if (result.status === "paid" || result.status === "delivered") {
          setWaiting(false);
          stopPolling();
        }
      } catch {
        // rede instável — a próxima iteração tenta de novo
      }
    },
    [stopPolling],
  );

  useEffect(() => {
    if (!charge) return;
    const id = window.setInterval(() => {
      void check(charge);
    }, 5000);
    pollRef.current = id;
    return () => window.clearInterval(id);
  }, [charge, check]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  async function generate() {
    setError(null);
    if (!name.trim() || !email.trim() || !document.trim()) {
      setError("Preencha nome, e-mail e CPF/CNPJ do pagador.");
      return;
    }
    setBusy(true);
    try {
      const result = await createPixOrder({ data: { productId, name, email, document } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.qrCode) {
        setWaiting(true);
      }
      setCharge(result);
      void check(result);
    } catch {
      setError("Não foi possível gerar o PIX. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("Copie o código manualmente.");
    }
  }

  if (!pixEnabled) {
    return (
      <div className="pay-state pay-blocked">
        <span className="pay-state-icon">
          <Lock size={28} />
        </span>
        <h2>PIX ainda não está ligado</h2>
        <p>
          O pagamento automático por PIX precisa da chave <code>INFINIGATE_DEPOSIT_KEY</code>. Assim
          que estiver configurada, esta página gera o QR Code e entrega o ebook no momento da
          confirmação.
        </p>
        <Link to="/" className="pay-secondary">
          Voltar ao site
        </Link>
      </div>
    );
  }

  if (status === "paid" || status === "delivered") {
    return (
      <div className="pay-state pay-success">
        <span className="pay-state-icon">
          <BadgeCheck size={30} />
        </span>
        <h2>Pagamento confirmado</h2>
        <p>
          Recebemos o seu pagamento de{" "}
          <strong>
            {symbol} {formatPrice(price)}
          </strong>
          . O seu ebook já está disponível.
        </p>
        {downloadUrl ? (
          <a className="pay-primary" href={downloadUrl} target="_blank" rel="noreferrer">
            <Download size={16} /> Descarregar o ebook
          </a>
        ) : (
          <p className="pay-note">
            <Clock size={14} /> O ficheiro ainda está a ser carregado pela equipa. Assim que estiver
            disponível, poderá descarregá-lo aqui com o mesmo link.
          </p>
        )}
        <p className="pay-legal">
          <ShieldCheck size={13} /> Guarde este link — é o acesso ao seu ebook.
        </p>
      </div>
    );
  }

  if (charge) {
    return (
      <div className="pay-state">
        <h2>Pague com PIX</h2>
        <p className="pay-hint">
          Abra o app do seu banco, escolha PIX → Ler QR Code (ou PIX Copia e Cola) e confirme o
          valor de{" "}
          <strong>
            {symbol} {formatPrice(price)}
          </strong>
          .
        </p>

        {charge.qrCodeImage ? (
          <div className="pay-qr">
            <img src={charge.qrCodeImage} alt="QR Code do PIX" />
          </div>
        ) : null}

        {charge.qrCode ? (
          <>
            <label className="pay-copy">
              <span>PIX Copia e Cola</span>
              <textarea
                readOnly
                value={charge.qrCode}
                rows={3}
                onFocus={(e) => e.target.select()}
              />
            </label>
            <button
              type="button"
              className="pay-secondary"
              onClick={() => copy(charge.qrCode ?? "")}
            >
              {copied ? (
                <>
                  <Check size={16} /> Código copiado
                </>
              ) : (
                <>
                  <ClipboardCopy size={16} /> Copiar código PIX
                </>
              )}
            </button>
          </>
        ) : null}

        <div className={`pay-waiting ${waiting ? "live" : ""}`}>
          <Loader2 size={15} className="pay-spin" />A aguardar a confirmação do pagamento… a página
          atualiza sozinha.
        </div>
        <button type="button" className="pay-link" onClick={() => void check(charge)}>
          Já paguei — verificar agora
        </button>
        {error ? <p className="pay-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="pay-state">
      <h2>Dados para o PIX</h2>
      <p className="pay-hint">
        O pagamento é processado por PIX. Depois de confirmado, o ebook é entregue nesta mesma
        página.
      </p>

      <div className="pay-fields">
        <label>
          <span>
            <User size={13} /> Nome completo
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como aparece no banco"
            autoComplete="name"
          />
        </label>
        <label>
          <span>
            <Mail size={13} /> E-mail
          </span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="nome@email.com"
            type="email"
            autoComplete="email"
          />
        </label>
        <label>
          <span>CPF ou CNPJ</span>
          <input
            value={document}
            onChange={(e) => setDocument(e.target.value)}
            placeholder="000.000.000-00"
            inputMode="numeric"
          />
        </label>
      </div>

      {error ? <p className="pay-error">{error}</p> : null}

      <button type="button" className="pay-primary" onClick={generate} disabled={busy}>
        {busy ? (
          <>
            <Loader2 size={16} className="pay-spin" /> A gerar PIX…
          </>
        ) : (
          <>
            <QrCode size={16} /> Gerar QR Code PIX
          </>
        )}
      </button>
      <p className="pay-legal">
        <ShieldCheck size={13} /> Os dados são usados apenas para processar o pagamento.
      </p>
    </div>
  );
}
