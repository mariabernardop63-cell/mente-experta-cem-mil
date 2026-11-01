import { createServerFn } from "@tanstack/react-start";

import type {
  AdminKpis,
  OrderRow,
  PaymentMethod,
  Product,
  Region,
  SupportMessage,
  SupportThread,
  VisitRow,
} from "./types";

/**
 * Funções de servidor (RPC) usadas pelo site.
 *
 * Este módulo é seguro para o browser: não importa nada de `*.server.ts` no
 * topo. Todo o código que toca em segredos (Supabase, InfiniGate, credenciais
 * do painel) é importado dinamicamente dentro dos handlers, que só correm no
 * servidor.
 */

/* ------------------------------------------------------------------ helpers */

function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, max);
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function money(value: unknown): number | null {
  const n = typeof value === "number" ? value : Number(str(value, 20)?.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000) return null;
  return Math.round(n * 100) / 100;
}

function nonNegative(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.trunc(n);
}

/* ------------------------------------------------------------------- tipos */

export type Integrations = {
  database: boolean;
  pix: boolean;
  emola: boolean;
};

export type SiteContext = {
  region: Region;
  products: Product[];
  integrations: Integrations;
};

export type CheckoutContext = {
  region: Region;
  product: Product | null;
  /** Carteiras móveis ativas (e-Mola, M-Pesa) com número editável no painel. */
  methods: PaymentMethod[];
  instructions: string[];
  pixEnabled: boolean;
  databaseConfigured: boolean;
};

export type ActionResult = { ok: true } | { ok: false; error: string };

export type PixOrderResult =
  | {
      ok: true;
      orderId: string;
      accessToken: string;
      amount: number;
      currency: string;
      qrCode: string | null;
      qrCodeImage: string | null;
    }
  | { ok: false; error: string };

export type OrderStatusResult =
  | {
      ok: true;
      status: string;
      productName: string;
      amount: number;
      currency: string;
      downloadUrl: string | null;
    }
  | { ok: false; error: string };

export type AdminSupportHealth = {
  configured: boolean;
  keyRole: "service_role" | "anon" | "unknown";
  rows: number;
  error: string | null;
};

export type AdminOverview = {
  kpis: AdminKpis;
  products: Product[];
  orders: OrderRow[];
  visits: VisitRow[];
  supportThreads: SupportThread[];
  /** Motivo pelo qual o chat de apoio não pôde ser lido (null se estiver tudo bem). */
  supportError: string | null;
  supportHealth: AdminSupportHealth;
  paymentMethods: PaymentMethod[];
  databaseConfigured: boolean;
  pixConfigured: boolean;
};

/* ------------------------------------------------- contexto público do site */

export const getSiteContext = createServerFn({ method: "GET" }).handler(
  async (): Promise<SiteContext> => {
    const [catalog, region] = await Promise.all([
      import("./catalog.server"),
      import("./region.server"),
    ]);
    const supabase = await import("./supabase.server");
    const infinigate = await import("./infinigate.server");

    const [listing, detected] = await Promise.all([catalog.listProducts(), region.detectRegion()]);

    return {
      region: detected,
      products: listing.products,
      integrations: {
        database: supabase.getSupabase() !== null,
        pix: infinigate.infinigateConfigured(),
        emola: true,
      },
    };
  },
);

/* ---------------------------------------------------------------- contexto MZ */

export const getCheckoutContext = createServerFn({ method: "POST" })
  .validator((input: unknown) => ({ productId: str(record(input)["productId"], 60) ?? "beta" }))
  .handler(async ({ data }): Promise<CheckoutContext> => {
    const [catalog, region, emola, supabase, infinigate] = await Promise.all([
      import("./catalog.server"),
      import("./region.server"),
      import("./emola.server"),
      import("./supabase.server"),
      import("./infinigate.server"),
    ]);

    const [product, detected, wallets] = await Promise.all([
      catalog.findProduct(data.productId),
      region.detectRegion(),
      catalog.listPaymentMethods(),
    ]);

    return {
      region: detected,
      product,
      methods: wallets.methods,
      instructions: emola.walletInstructions(),
      pixEnabled: infinigate.infinigateConfigured(),
      databaseConfigured: supabase.getSupabase() !== null,
    };
  });

/* ------------------------------------------------------------------- visitas */

export const trackVisit = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = record(input);
    return {
      path: str(raw["path"], 200) ?? "/",
      referrer: str(raw["referrer"], 400),
      sessionId: str(raw["sessionId"], 80),
    };
  })
  .handler(async ({ data }): Promise<ActionResult> => {
    const [catalog, region] = await Promise.all([
      import("./catalog.server"),
      import("./region.server"),
    ]);

    const detected = await region.detectRegion();
    const fingerprint = region.requestFingerprint();

    await catalog.recordVisit({
      path: data.path,
      country: detected.country,
      referrer: data.referrer,
      userAgent: fingerprint.userAgent ?? null,
      ip: fingerprint.ip ?? null,
      sessionId: data.sessionId,
    });

    return { ok: true };
  });

/* ---------------------------------------------------- pedido carteira móvel */

export const submitEmolaOrder = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = record(input);
    return {
      productId: str(raw["productId"], 60) ?? "",
      name: str(raw["name"], 120) ?? "",
      emolaNumber: str(raw["emolaNumber"], 30) ?? "",
      methodId: str(raw["methodId"], 40) ?? "",
      confirmationMessage: str(raw["confirmationMessage"], 1200) ?? "",
      contact: str(raw["contact"], 160) ?? "",
    };
  })
  .handler(
    async ({ data }): Promise<{ ok: true; orderId: string } | { ok: false; error: string }> => {
      if (
        !data.productId ||
        !data.name ||
        !data.emolaNumber ||
        !data.confirmationMessage ||
        !data.contact
      ) {
        return { ok: false, error: "Preencha todos os campos para enviar o pedido." };
      }

      const catalog = await import("./catalog.server");
      const product = await catalog.findProduct(data.productId);
      if (!product) return { ok: false, error: "Edição não encontrada." };

      const wallets = await catalog.listPaymentMethods();
      const chosen =
        wallets.methods.find((method) => method.id === data.methodId) ?? wallets.methods[0];
      if (!chosen) return { ok: false, error: "Nenhuma carteira móvel configurada." };

      const isEmail = data.contact.includes("@");

      const created = await catalog.createOrder({
        productId: product.id,
        amount: product.price,
        currency: "MT",
        method: "emola",
        country: "MZ",
        status: "awaiting_review",
        customerName: data.name,
        customerEmail: isEmail ? data.contact : null,
        customerContact: data.contact,
        document: null,
        emolaNumber: data.emolaNumber,
        emolaTarget: `${chosen.label} · ${chosen.number}`,
        confirmationMessage: data.confirmationMessage,
      });

      if (!created.ok) return { ok: false, error: created.error };
      return { ok: true, orderId: created.id };
    },
  );

/* ---------------------------------------------------------------- pedido PIX */

export const createPixOrder = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = record(input);
    return {
      productId: str(raw["productId"], 60) ?? "",
      name: str(raw["name"], 120) ?? "",
      email: str(raw["email"], 160) ?? "",
      document: str(raw["document"], 30) ?? "",
    };
  })
  .handler(async ({ data }): Promise<PixOrderResult> => {
    if (!data.productId || !data.name || !data.email || !data.document) {
      return { ok: false, error: "Preencha nome, e-mail e CPF para gerar o PIX." };
    }

    const [catalog, region, infinigate] = await Promise.all([
      import("./catalog.server"),
      import("./region.server"),
      import("./infinigate.server"),
    ]);

    if (!infinigate.infinigateConfigured()) {
      return { ok: false, error: infinigate.MISSING_INFINIGATE_MESSAGE };
    }

    const product = await catalog.findProduct(data.productId);
    if (!product) return { ok: false, error: "Edição não encontrada." };

    const detected = await region.detectRegion();

    const created = await catalog.createOrder({
      productId: product.id,
      amount: product.price,
      currency: "BRL",
      method: "pix",
      country: detected.country,
      status: "pending",
      customerName: data.name,
      customerEmail: data.email,
      customerContact: data.email,
      document: data.document,
      emolaNumber: null,
      emolaTarget: null,
      confirmationMessage: null,
    });

    if (!created.ok) return { ok: false, error: created.error };

    const charge = await infinigate.createPixCharge({
      amount: product.price,
      document: data.document,
      name: data.name,
      email: data.email,
      externalId: created.id,
      webhookUrl: `${region.siteBaseUrl()}/api/webhooks/infinigate`,
      metadata: { orderId: created.id, productId: product.id, edition: product.name },
    });

    if (!charge.ok) return { ok: false, error: charge.error };

    await catalog.attachPixCharge(created.id, charge.charge);

    return {
      ok: true,
      orderId: created.id,
      accessToken: created.accessToken,
      amount: product.price,
      currency: "BRL",
      qrCode: charge.charge.qrCode,
      qrCodeImage: charge.charge.qrCodeImage,
    };
  });

/* --------------------------------------------------------- estado do pedido */

export const getOrderStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = record(input);
    return {
      orderId: str(raw["orderId"], 60) ?? "",
      accessToken: str(raw["accessToken"], 200) ?? "",
    };
  })
  .handler(async ({ data }): Promise<OrderStatusResult> => {
    if (!data.orderId || !data.accessToken) {
      return { ok: false, error: "Pedido inválido." };
    }

    const catalog = await import("./catalog.server");
    const result = await catalog.getOrderForBuyer(data.orderId, data.accessToken);
    if (!result.ok) return result;

    let downloadUrl: string | null = null;
    const unlocked = result.status === "paid" || result.status === "delivered";

    if (unlocked && result.pdfPath) {
      downloadUrl = await catalog.signedPdfUrl(result.pdfPath);
      if (downloadUrl && result.status === "paid") {
        await catalog.setOrderStatus(data.orderId, "delivered");
      }
    }

    return {
      ok: true,
      status: result.status,
      productName: result.productName,
      amount: result.amount,
      currency: result.currency,
      downloadUrl,
    };
  });

/* -------------------------------------------------------------------- admin */

async function adminEmail(): Promise<string | null> {
  const { currentAdmin } = await import("./admin-auth.server");
  return currentAdmin()?.email ?? null;
}

export const adminLogin = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = record(input);
    return {
      email: str(raw["email"], 160) ?? "",
      password: typeof raw["password"] === "string" ? raw["password"].slice(0, 200) : "",
    };
  })
  .handler(async ({ data }): Promise<ActionResult> => {
    const auth = await import("./admin-auth.server");
    if (!auth.isAdminConfigured()) return { ok: false, error: auth.ADMIN_NOT_CONFIGURED_MESSAGE };
    if (!auth.checkCredentials(data.email, data.password)) {
      return { ok: false, error: "E-mail ou palavra-passe incorretos." };
    }
    if (!auth.startSession(data.email.trim().toLowerCase())) {
      return { ok: false, error: "Não foi possível iniciar a sessão." };
    }
    return { ok: true };
  });

export const adminLogout = createServerFn({ method: "POST" }).handler(
  async (): Promise<ActionResult> => {
    const { endSession } = await import("./admin-auth.server");
    endSession();
    return { ok: true };
  },
);

export const adminSession = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ authenticated: boolean; email: string | null; configured: boolean }> => {
    const auth = await import("./admin-auth.server");
    const email = auth.currentAdmin()?.email ?? null;
    return { authenticated: email !== null, email, configured: auth.isAdminConfigured() };
  },
);

export const adminOverview = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ ok: true; data: AdminOverview } | { ok: false; error: string }> => {
    if (!(await adminEmail())) return { ok: false, error: "Sessão expirada. Entre novamente." };

    const [catalog, supabase, infinigate] = await Promise.all([
      import("./catalog.server"),
      import("./supabase.server"),
      import("./infinigate.server"),
    ]);

    const [kpis, products, orders, visits, wallets, threads, health] = await Promise.all([
      catalog.adminKpis(),
      catalog.listProducts(),
      catalog.listOrders(80),
      catalog.listVisits(80),
      catalog.listPaymentMethods(true),
      catalog.listSupportThreads(),
      catalog.supportHealth(),
    ]);

    if (!kpis) return { ok: false, error: "Base de dados não configurada." };

    return {
      ok: true,
      data: {
        kpis,
        products: products.products,
        orders,
        visits,
        supportThreads: threads.threads,
        supportError: threads.error,
        supportHealth: health,
        paymentMethods: wallets.methods,
        databaseConfigured: supabase.getSupabase() !== null,
        pixConfigured: infinigate.infinigateConfigured(),
      },
    };
  },
);

export const adminUpdatePrice = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = record(input);
    return { id: str(raw["id"], 60) ?? "", price: money(raw["price"]) };
  })
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!(await adminEmail())) return { ok: false, error: "Sessão expirada. Entre novamente." };
    if (!data.id || data.price === null) return { ok: false, error: "Preço inválido." };

    const catalog = await import("./catalog.server");
    const error = await catalog.updateProductPrice(data.id, data.price);
    return error ? { ok: false, error } : { ok: true };
  });

export const adminUpdatePaymentMethod = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = record(input);
    return {
      id: str(raw["id"], 40) ?? "",
      label: str(raw["label"], 40) ?? "",
      number: str(raw["number"], 30) ?? "",
      holder: str(raw["holder"], 80) ?? "",
      note: str(raw["note"], 200) ?? "",
      active: raw["active"] !== false,
    };
  })
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!(await adminEmail())) return { ok: false, error: "Sessão expirada. Entre novamente." };
    if (!data.id) return { ok: false, error: "Carteira inválida." };
    if (!data.label) return { ok: false, error: "Indique o nome da carteira." };
    if (!data.number) return { ok: false, error: "Indique o número da carteira." };

    const catalog = await import("./catalog.server");
    const error = await catalog.updatePaymentMethod(data.id, {
      label: data.label,
      number: data.number,
      holder: data.holder,
      note: data.note,
      active: data.active,
    });
    return error ? { ok: false, error } : { ok: true };
  });

export const adminCreateUpload = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = record(input);
    return {
      productId: str(raw["productId"], 60) ?? "",
      fileName: str(raw["fileName"], 200) ?? "ebook.pdf",
      contentType: str(raw["contentType"], 100) ?? "application/pdf",
    };
  })
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; path: string; signedUrl: string } | { ok: false; error: string }> => {
      if (!(await adminEmail())) return { ok: false, error: "Sessão expirada. Entre novamente." };
      if (!data.productId) return { ok: false, error: "Produto inválido." };
      if (!data.fileName.toLowerCase().endsWith(".pdf")) {
        return { ok: false, error: "Só é possível carregar ficheiros PDF." };
      }

      const catalog = await import("./catalog.server");
      return catalog.createSignedUpload(data.productId, data.fileName, data.contentType);
    },
  );

export const adminConfirmPdf = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = record(input);
    return {
      productId: str(raw["productId"], 60) ?? "",
      path: str(raw["path"], 300) ?? "",
      fileName: str(raw["fileName"], 200) ?? "ebook.pdf",
    };
  })
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!(await adminEmail())) return { ok: false, error: "Sessão expirada. Entre novamente." };
    if (!data.productId || !data.path)
      return { ok: false, error: "Dados do ficheiro incompletos." };

    const catalog = await import("./catalog.server");
    const error = await catalog.setProductPdf(data.productId, data.path, data.fileName);
    return error ? { ok: false, error } : { ok: true };
  });

const ORDER_STATUSES = ["pending", "awaiting_review", "paid", "delivered", "cancelled"] as const;

export const adminSetOrderStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = record(input);
    const status = str(raw["status"], 30) ?? "";
    return {
      orderId: str(raw["orderId"], 60) ?? "",
      status: (ORDER_STATUSES as readonly string[]).includes(status) ? status : "",
    };
  })
  .handler(async ({ data }): Promise<ActionResult> => {
    if (!(await adminEmail())) return { ok: false, error: "Sessão expirada. Entre novamente." };
    if (!data.orderId || !data.status) return { ok: false, error: "Pedido inválido." };

    const catalog = await import("./catalog.server");
    const error = await catalog.setOrderStatus(data.orderId, data.status);
    return error ? { ok: false, error } : { ok: true };
  });

/* ------------------------------------------------------- chat de apoio (público) */

export type HumanRequestResult = { ok: true; delivered: boolean } | { ok: false; error: string };

export const requestHumanSupport = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = record(input);
    return {
      sessionId: str(raw["sessionId"], 120) ?? "",
      note: str(raw["note"], 1500),
      country: str(raw["country"], 8),
    };
  })
  .handler(async ({ data }): Promise<HumanRequestResult> => {
    if (!data.sessionId) return { ok: false, error: "Conversa não identificada." };

    const catalog = await import("./catalog.server");
    const delivered = await catalog.recordSupportMessage({
      sessionId: data.sessionId,
      author: "visitor",
      kind: "human_request",
      content: data.note ?? "Pedido de atendimento humano pelo chat de apoio.",
      country: data.country,
    });
    return { ok: true, delivered };
  });

export const getSupportReplies = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = record(input);
    return {
      sessionId: str(raw["sessionId"], 120) ?? "",
      afterId: nonNegative(raw["afterId"]),
    };
  })
  .handler(async ({ data }): Promise<{ replies: SupportMessage[] }> => {
    if (!data.sessionId) return { replies: [] };
    const catalog = await import("./catalog.server");
    const replies = await catalog.listSupportReplies(data.sessionId, data.afterId);
    return { replies };
  });

/** Conversa completa do próprio visitante, para restaurar o chat ao reabrir. */
export const getSupportThread = createServerFn({ method: "POST" })
  .validator((input: unknown) => ({
    sessionId: str(record(input)["sessionId"], 120) ?? "",
  }))
  .handler(async ({ data }): Promise<{ messages: SupportMessage[] }> => {
    if (!data.sessionId) return { messages: [] };
    const catalog = await import("./catalog.server");
    const result = await catalog.listSupportMessages(data.sessionId, 120);
    return { messages: result.messages };
  });

/* ---------------------------------------------------- chat de apoio (painel) */

export type AdminThreadsResult =
  { ok: true; threads: SupportThread[]; error: string | null } | { ok: false; error: string };

/** Lista de conversas para o painel — usada pelo auto-refresh em tempo real. */
export const adminSupportThreads = createServerFn({ method: "POST" }).handler(
  async (): Promise<AdminThreadsResult> => {
    if (!(await adminEmail())) return { ok: false, error: "Sessão expirada. Entre novamente." };

    const catalog = await import("./catalog.server");
    const result = await catalog.listSupportThreads();
    return { ok: true, threads: result.threads, error: result.error };
  },
);

/** Grava uma mensagem de teste para confirmar que o chat guarda dados. */
export const adminSupportSelfTest = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ ok: boolean; error: string | null }> => {
    if (!(await adminEmail())) return { ok: false, error: "Sessão expirada. Entre novamente." };

    const catalog = await import("./catalog.server");
    return catalog.probeSupportInsert();
  },
);

export const adminSupportMessages = createServerFn({ method: "POST" })
  .validator((input: unknown) => ({
    sessionId: str(record(input)["sessionId"], 120) ?? "",
  }))
  .handler(
    async ({
      data,
    }): Promise<{ ok: true; messages: SupportMessage[] } | { ok: false; error: string }> => {
      if (!(await adminEmail())) return { ok: false, error: "Sessão expirada. Entre novamente." };
      if (!data.sessionId) return { ok: false, error: "Conversa inválida." };

      const catalog = await import("./catalog.server");
      const result = await catalog.listSupportMessages(data.sessionId);
      if (result.error) return { ok: false, error: result.error };
      return { ok: true, messages: result.messages };
    },
  );

export const adminSupportReply = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = record(input);
    return {
      sessionId: str(raw["sessionId"], 120) ?? "",
      content: str(raw["content"], 2000) ?? "",
    };
  })
  .handler(async ({ data }): Promise<ActionResult> => {
    const email = await adminEmail();
    if (!email) return { ok: false, error: "Sessão expirada. Entre novamente." };
    if (!data.sessionId) return { ok: false, error: "Conversa inválida." };
    if (!data.content) return { ok: false, error: "Escreva uma resposta." };

    const catalog = await import("./catalog.server");
    const stored = await catalog.recordSupportMessage({
      sessionId: data.sessionId,
      author: "admin",
      content: data.content,
      adminName: email,
    });
    if (!stored) {
      return {
        ok: false,
        error: "Não foi possível guardar a resposta. Verifique a base de dados.",
      };
    }
    return { ok: true };
  });
