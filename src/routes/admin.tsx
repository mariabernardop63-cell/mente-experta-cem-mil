import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Check,
  Coins,
  Eye,
  FileUp,
  Loader2,
  LogOut,
  Lock,
  Package,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  TrendingUp,
  Upload,
} from "lucide-react";

import {
  adminConfirmPdf,
  adminCreateUpload,
  adminLogin,
  adminLogout,
  adminOverview,
  adminSession,
  adminSetOrderStatus,
  adminUpdatePrice,
  type AdminOverview,
} from "@/lib/api";
import { formatPrice, type OrderRow, type Product } from "@/lib/types";

export const Route = createFileRoute("/admin")({
  loader: () => adminSession(),
  head: () => ({
    meta: [
      { title: "Painel — MenteExperta" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Painel de administração MenteExperta." },
    ],
  }),
  component: AdminPage,
});

type Session = Awaited<ReturnType<typeof adminSession>>;

const STATUS_LABEL: Record<string, string> = {
  pending: "PIX pendente",
  awaiting_review: "À espera de verificação",
  paid: "Pago",
  delivered: "Entregue",
  cancelled: "Cancelado",
  expired: "Expirado",
};

function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? status;
}

function AdminPage() {
  const initial = Route.useLoaderData();
  const [session, setSession] = useState<Session>(initial);

  if (!session.configured) {
    return (
      <Shell>
        <div className="admin-login">
          <span className="admin-login-icon">
            <Lock size={26} />
          </span>
          <h1>Painel não configurado</h1>
          <p>
            Defina as variáveis <code>ADMIN_EMAIL</code>, <code>ADMIN_PASSWORD</code> e{" "}
            <code>ADMIN_SESSION_SECRET</code> no ambiente para ativar o acesso.
          </p>
          <Link to="/" className="admin-btn">
            Voltar ao site
          </Link>
        </div>
      </Shell>
    );
  }

  if (!session.authenticated) {
    return (
      <Shell>
        <Login
          onSuccess={(email) => setSession({ authenticated: true, email, configured: true })}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <Dashboard
        email={session.email ?? ""}
        onLogout={() => setSession({ authenticated: false, email: null, configured: true })}
      />
    </Shell>
  );
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="admin-shell">
      <header className="admin-header">
        <Link to="/" className="brand admin-brand">
          <span className="brand-symbol" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            MenteExperta<span className="brand-dot">.</span>
          </span>
        </Link>
        <span className="admin-header-tag">
          <ShieldCheck size={14} /> Painel de administração
        </span>
      </header>
      {children}
    </main>
  );
}

function Login({ onSuccess }: { onSuccess: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await adminLogin({ data: { email, password } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSuccess(email.trim().toLowerCase());
    } catch {
      setError("Não foi possível iniciar sessão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="admin-login" onSubmit={submit}>
      <span className="admin-login-icon">
        <Lock size={24} />
      </span>
      <h1>Entrar no painel</h1>
      <p>Introduza o e-mail e a palavra-passe de administrador.</p>

      <label className="admin-field">
        <span>E-mail</span>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          placeholder="admin@menteexperta.com"
          required
        />
      </label>
      <label className="admin-field">
        <span>Palavra-passe</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          placeholder="••••••••"
          required
        />
      </label>

      {error ? <p className="admin-error">{error}</p> : null}

      <button type="submit" className="admin-btn admin-btn-primary" disabled={busy}>
        {busy ? (
          <>
            <Loader2 size={16} className="admin-spin" /> A entrar…
          </>
        ) : (
          "Entrar"
        )}
      </button>
    </form>
  );
}

type Tab = "overview" | "products" | "orders" | "visits";

function Dashboard({ email, onLogout }: { email: string; onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await adminOverview();
      if (!result.ok) {
        setError(result.error);
        if (result.error.includes("Sessão expirada")) onLogout();
        return;
      }
      setData(result.data);
    } catch {
      setError("Não foi possível carregar os dados.");
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => {
    void load();
  }, [load]);

  async function logout() {
    await adminLogout();
    onLogout();
  }

  const kpis = data?.kpis;

  return (
    <div className="admin-body">
      <div className="admin-topbar">
        <div>
          <p className="admin-eyebrow">Sessão ativa</p>
          <strong>{email}</strong>
        </div>
        <div className="admin-topbar-actions">
          <button
            type="button"
            className="admin-btn"
            onClick={() => void load()}
            disabled={loading}
          >
            {loading ? <Loader2 size={15} className="admin-spin" /> : <RefreshCw size={15} />}
            Atualizar
          </button>
          <button type="button" className="admin-btn" onClick={() => void logout()}>
            <LogOut size={15} /> Sair
          </button>
        </div>
      </div>

      <nav className="admin-tabs">
        {(
          [
            ["overview", "Visão geral", BarChart3],
            ["products", "Produtos e PDFs", BookOpen],
            ["orders", "Pedidos", ShoppingBag],
            ["visits", "Visitas", Eye],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            type="button"
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => setTab(key)}
          >
            <Icon size={15} /> {label}
            {key === "orders" && kpis && kpis.awaitingReview > 0 ? (
              <em className="admin-dot">{kpis.awaitingReview}</em>
            ) : null}
          </button>
        ))}
      </nav>

      {error ? <p className="admin-error">{error}</p> : null}

      {loading && !data ? (
        <div className="admin-loading">
          <Loader2 size={22} className="admin-spin" /> A carregar o painel…
        </div>
      ) : null}

      {data ? (
        <>
          {tab === "overview" ? <Overview data={data} /> : null}
          {tab === "products" ? <Products products={data.products} reload={load} /> : null}
          {tab === "orders" ? <Orders orders={data.orders} reload={load} /> : null}
          {tab === "visits" ? <Visits data={data} /> : null}
        </>
      ) : null}
    </div>
  );
}

function money(value: number, currency: string): string {
  const symbol = currency === "MT" ? "MT" : "R$";
  return `${symbol} ${formatPrice(value)}`;
}

function Overview({ data }: { data: AdminOverview }) {
  const { kpis } = data;
  return (
    <div className="admin-section">
      <div className="admin-kpis">
        <Kpi
          icon={<ShoppingBag size={18} />}
          label="Vendas confirmadas"
          value={String(kpis.confirmedSales)}
          hint="Pedidos pagos ou entregues"
        />
        <Kpi
          icon={<Coins size={18} />}
          label="Dinheiro faturado"
          value={money(kpis.revenueBrl + kpis.revenueMz, "BRL")}
          hint={`R$ ${formatPrice(kpis.revenueBrl)} via PIX · MT ${formatPrice(kpis.revenueMz)} via e-Mola`}
        />
        <Kpi
          icon={<Eye size={18} />}
          label="Visitas ao site"
          value={String(kpis.visitsTotal)}
          hint={`${kpis.visitsToday} hoje · ${kpis.visits7d} nos últimos 7 dias`}
        />
        <Kpi
          icon={<TrendingUp size={18} />}
          label="Pedidos a tratar"
          value={String(kpis.pendingOrders + kpis.awaitingReview)}
          hint={`${kpis.awaitingReview} e-Mola à espera · ${kpis.pendingOrders} PIX pendentes`}
        />
      </div>

      <div className="admin-card">
        <h2>
          <Package size={17} /> Vendas por produto
        </h2>
        <div className="admin-product-stats">
          {kpis.salesByProduct.map((item) => (
            <div key={item.id}>
              <span>{item.name}</span>
              <strong>{item.count}</strong>
              <em>vendas confirmadas</em>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-notes">
        <p className={data.databaseConfigured ? "ok" : "off"}>
          <Check size={13} /> Base de dados (Supabase):{" "}
          {data.databaseConfigured ? "ligada" : "não configurada"}
        </p>
        <p className={data.pixConfigured ? "ok" : "off"}>
          <Check size={13} /> Pagamentos PIX (InfiniGate):{" "}
          {data.pixConfigured ? "ligados" : "chave não configurada"}
        </p>
      </div>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="admin-kpi">
      <span className="admin-kpi-icon">{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
      <em>{hint}</em>
    </article>
  );
}

function Products({ products, reload }: { products: Product[]; reload: () => Promise<void> }) {
  return (
    <div className="admin-section">
      <p className="admin-help">
        Edite o preço de cada edição e carregue o PDF que é entregue ao comprador. O mesmo PDF serve
        os pagamentos PIX e e-Mola.
      </p>
      <div className="admin-products">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} reload={reload} />
        ))}
      </div>
    </div>
  );
}

function ProductCard({ product, reload }: { product: Product; reload: () => Promise<void> }) {
  const [price, setPrice] = useState(String(product.price).replace(".", ","));
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPrice(String(product.price).replace(".", ","));
  }, [product.price]);

  async function savePrice() {
    setMessage(null);
    setBusy(true);
    try {
      const result = await adminUpdatePrice({ data: { id: product.id, price } });
      if (!result.ok) {
        setMessage({ kind: "error", text: result.error });
        return;
      }
      setMessage({ kind: "ok", text: "Preço atualizado." });
      await reload();
    } catch {
      setMessage({ kind: "error", text: "Falha ao guardar o preço." });
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    setMessage(null);
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setMessage({ kind: "error", text: "Escolha um ficheiro PDF." });
      return;
    }
    setUploading(true);
    try {
      const signed = await adminCreateUpload({
        data: {
          productId: product.id,
          fileName: file.name,
          contentType: file.type || "application/pdf",
        },
      });
      if (!signed.ok) {
        setMessage({ kind: "error", text: signed.error });
        return;
      }

      const form = new FormData();
      form.append("cacheControl", "3600");
      form.append("", file);
      const put = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "x-upsert": "false" },
        body: form,
      });
      if (!put.ok) {
        setMessage({ kind: "error", text: `Falha no carregamento (HTTP ${put.status}).` });
        return;
      }

      const confirm = await adminConfirmPdf({
        data: { productId: product.id, path: signed.path, fileName: file.name },
      });
      if (!confirm.ok) {
        setMessage({ kind: "error", text: confirm.error });
        return;
      }

      setMessage({ kind: "ok", text: `PDF «${file.name}» associado à edição ${product.name}.` });
      await reload();
    } catch {
      setMessage({ kind: "error", text: "Falha ao carregar o PDF." });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <article className="admin-product">
      <div className="admin-product-head">
        <div>
          <h3>
            {product.name}
            {product.premium ? <span className="admin-tag">PREMIUM</span> : null}
          </h3>
          <p>{product.tagline}</p>
        </div>
        <span className={`admin-pdf-state ${product.hasPdf ? "ok" : ""}`}>
          {product.hasPdf ? "PDF carregado" : "Sem PDF"}
        </span>
      </div>

      <div className="admin-product-row">
        <label className="admin-field">
          <span>Preço</span>
          <div className="admin-price">
            <i>R$ / MT</i>
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              inputMode="decimal"
              aria-label={`Preço da edição ${product.name}`}
            />
          </div>
        </label>
        <button
          type="button"
          className="admin-btn admin-btn-primary"
          onClick={() => void savePrice()}
          disabled={busy}
        >
          {busy ? <Loader2 size={15} className="admin-spin" /> : <Check size={15} />} Guardar preço
        </button>
      </div>

      <div className="admin-product-row">
        <input
          ref={fileRef}
          id={`pdf-${product.id}`}
          type="file"
          accept="application/pdf"
          className="admin-file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <label className="admin-btn admin-file-label" htmlFor={`pdf-${product.id}`}>
          {uploading ? (
            <>
              <Loader2 size={15} className="admin-spin" /> A carregar…
            </>
          ) : (
            <>
              <FileUp size={15} /> Carregar PDF
            </>
          )}
        </label>
        <span className="admin-help-inline">
          <Upload size={13} /> Substitui o PDF entregue aos compradores.
        </span>
      </div>

      {message ? (
        <p className={message.kind === "ok" ? "admin-ok" : "admin-error"}>{message.text}</p>
      ) : null}
    </article>
  );
}

function Orders({ orders, reload }: { orders: OrderRow[]; reload: () => Promise<void> }) {
  const [filter, setFilter] = useState<"all" | "emola" | "pix">("emola");
  const [busy, setBusy] = useState<string | null>(null);

  const visible = orders.filter((order) =>
    filter === "all"
      ? true
      : filter === "emola"
        ? order.method === "emola"
        : order.method === "pix",
  );

  async function setStatus(orderId: string, status: string) {
    setBusy(orderId);
    try {
      await adminSetOrderStatus({ data: { orderId, status } });
      await reload();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="admin-section">
      <div className="admin-filters">
        {(
          [
            ["emola", "Pedidos e-Mola (MZ)"],
            ["pix", "Pedidos PIX"],
            ["all", "Todos"],
          ] as const
        ).map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={filter === key ? "active" : ""}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="admin-empty">Ainda não há pedidos nesta lista.</p>
      ) : (
        <div className="admin-orders">
          {visible.map((order) => (
            <article className="admin-order" key={order.id}>
              <div className="admin-order-head">
                <div>
                  <h3>{order.product_name}</h3>
                  <p>
                    {new Date(order.created_at).toLocaleString("pt-PT")} ·{" "}
                    {money(Number(order.amount), order.currency)}
                    {order.country ? ` · ${order.country}` : ""}
                  </p>
                </div>
                <span className={`admin-status ${order.status}`}>{statusLabel(order.status)}</span>
              </div>

              <dl className="admin-order-data">
                <div>
                  <dt>Nome</dt>
                  <dd>{order.customer_name ?? "—"}</dd>
                </div>
                <div>
                  <dt>{order.method === "emola" ? "Contacto de entrega" : "E-mail"}</dt>
                  <dd>{order.customer_contact ?? order.customer_email ?? "—"}</dd>
                </div>
                {order.method === "emola" ? (
                  <>
                    <div>
                      <dt>Número de origem</dt>
                      <dd>{order.emola_number ?? "—"}</dd>
                    </div>
                    <div>
                      <dt>Destino</dt>
                      <dd>{order.emola_target ?? "—"}</dd>
                    </div>
                  </>
                ) : (
                  <div>
                    <dt>Referência PIX</dt>
                    <dd>{order.payment_reference ?? "—"}</dd>
                  </div>
                )}
              </dl>

              {order.confirmation_message ? (
                <blockquote className="admin-proof">
                  <span>Mensagem de confirmação</span>
                  {order.confirmation_message}
                </blockquote>
              ) : null}

              <div className="admin-order-actions">
                {order.status !== "paid" && order.status !== "delivered" ? (
                  <button
                    type="button"
                    className="admin-btn"
                    onClick={() => void setStatus(order.id, "paid")}
                    disabled={busy === order.id}
                  >
                    <Check size={14} /> Confirmar pagamento
                  </button>
                ) : null}
                {order.status !== "delivered" ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn-primary"
                    onClick={() => void setStatus(order.id, "delivered")}
                    disabled={busy === order.id}
                  >
                    <Package size={14} /> Marcar entregue
                  </button>
                ) : null}
                {order.status !== "cancelled" ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn-ghost"
                    onClick={() => void setStatus(order.id, "cancelled")}
                    disabled={busy === order.id}
                  >
                    Cancelar
                  </button>
                ) : null}
                {busy === order.id ? <Loader2 size={15} className="admin-spin" /> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Visits({ data }: { data: AdminOverview }) {
  const { kpis, visits } = data;
  const byCountry = new Map<string, number>();
  for (const visit of visits) {
    const key = visit.country ?? "??";
    byCountry.set(key, (byCountry.get(key) ?? 0) + 1);
  }
  const top = [...byCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <div className="admin-section">
      <div className="admin-kpis admin-kpis-3">
        <Kpi
          icon={<Eye size={18} />}
          label="Visitas totais"
          value={String(kpis.visitsTotal)}
          hint="Todas as sessões registadas"
        />
        <Kpi
          icon={<TrendingUp size={18} />}
          label="Últimos 7 dias"
          value={String(kpis.visits7d)}
          hint="Sessões na última semana"
        />
        <Kpi
          icon={<BarChart3 size={18} />}
          label="Hoje"
          value={String(kpis.visitsToday)}
          hint="Sessões desde as 00:00 UTC"
        />
      </div>

      <div className="admin-card">
        <h2>
          <BarChart3 size={17} /> Países das últimas visitas
        </h2>
        {top.length === 0 ? (
          <p className="admin-empty">Sem visitas registadas ainda.</p>
        ) : (
          <ul className="admin-countries">
            {top.map(([country, count]) => (
              <li key={country}>
                <span>{country}</span>
                <em>{count}</em>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="admin-card">
        <h2>
          <Eye size={17} /> Visitas recentes
        </h2>
        {visits.length === 0 ? (
          <p className="admin-empty">Ainda sem registos.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Página</th>
                  <th>País</th>
                  <th>Origem</th>
                </tr>
              </thead>
              <tbody>
                {visits.map((visit) => (
                  <tr key={visit.id}>
                    <td>{new Date(visit.created_at).toLocaleString("pt-PT")}</td>
                    <td>{visit.path ?? "/"}</td>
                    <td>{visit.country ?? "—"}</td>
                    <td className="admin-referrer">{visit.referrer ?? "direto"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
