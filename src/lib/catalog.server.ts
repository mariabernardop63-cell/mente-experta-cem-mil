import { createHash, randomBytes } from "node:crypto";

import { EBOOK_BUCKET, getSupabase } from "./supabase.server";
import {
  FALLBACK_PRODUCTS,
  type AdminKpis,
  type OrderRow,
  type Product,
  type SupportAuthor,
  type SupportMessage,
  type SupportThread,
  type VisitRow,
} from "./types";

/**
 * Acesso à base de dados (Supabase). Só pode correr no servidor.
 * Todas as funções devolvem resultados explícitos para o chamador poder
 * reportar "não configurado" em vez de rebentar.
 */

type ProductRow = {
  id: string;
  name: string;
  tagline: string | null;
  price: number | string;
  features: unknown;
  premium: boolean;
  pdf_path: string | null;
  sort_order: number;
};

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline ?? "",
    price: Number(row.price),
    features: Array.isArray(row.features) ? row.features.map(String) : [],
    premium: Boolean(row.premium),
    hasPdf: Boolean(row.pdf_path),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export async function listProducts(): Promise<{ configured: boolean; products: Product[] }> {
  const db = getSupabase();
  if (!db) return { configured: false, products: FALLBACK_PRODUCTS };

  const { data, error } = await db
    .from("products")
    .select("id,name,tagline,price,features,premium,pdf_path,sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    console.error("[catalog] listProducts", error.message);
    return { configured: true, products: FALLBACK_PRODUCTS };
  }

  const rows = (data ?? []) as unknown as ProductRow[];
  if (rows.length === 0) return { configured: true, products: FALLBACK_PRODUCTS };
  return { configured: true, products: rows.map(toProduct) };
}

export async function findProduct(id: string): Promise<Product | null> {
  const db = getSupabase();
  if (!db) {
    return FALLBACK_PRODUCTS.find((p) => p.id === id) ?? null;
  }
  const { data, error } = await db
    .from("products")
    .select("id,name,tagline,price,features,premium,pdf_path,sort_order")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return toProduct(data as unknown as ProductRow);
}

export async function updateProductPrice(id: string, price: number): Promise<string | null> {
  const db = getSupabase();
  if (!db) return "Base de dados não configurada.";
  const { error } = await db.from("products").update({ price }).eq("id", id);
  return error ? error.message : null;
}

export async function setProductPdf(
  id: string,
  path: string,
  fileName: string,
): Promise<string | null> {
  const db = getSupabase();
  if (!db) return "Base de dados não configurada.";
  const { error } = await db
    .from("products")
    .update({ pdf_path: path, pdf_name: fileName })
    .eq("id", id);
  return error ? error.message : null;
}

export async function createProduct(payload: {
  id: string;
  name: string;
  tagline: string;
  price: number;
  premium: boolean;
  features: string[];
}): Promise<string | null> {
  const db = getSupabase();
  if (!db) return "Base de dados não configurada.";
  const { error } = await db.from("products").insert({
    id: payload.id,
    name: payload.name,
    tagline: payload.tagline,
    price: payload.price,
    premium: payload.premium,
    features: payload.features,
    sort_order: 99,
  });
  return error ? error.message : null;
}

/* ------------------------------------------------------------------ visitas */

export async function recordVisit(input: {
  path: string;
  country: string;
  referrer: string | null;
  userAgent: string | null;
  ip: string | null;
  sessionId: string | null;
}): Promise<void> {
  const db = getSupabase();
  if (!db) return;
  const { ip, ...rest } = input;
  const { error } = await db.from("site_visits").insert({
    ...rest,
    ip_hash: ip ? createHash("sha256").update(ip).digest("hex").slice(0, 32) : null,
  });
  if (error) console.error("[catalog] recordVisit", error.message);
}

/* ------------------------------------------------------------------ pedidos */

export async function createOrder(input: {
  productId: string;
  amount: number;
  currency: string;
  method: "pix" | "emola";
  country: string;
  status: string;
  customerName: string;
  customerEmail: string | null;
  customerContact: string | null;
  document: string | null;
  emolaNumber: string | null;
  emolaTarget: string | null;
  confirmationMessage: string | null;
}): Promise<{ ok: true; id: string; accessToken: string } | { ok: false; error: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "Base de dados não configurada." };

  const accessToken = randomBytes(24).toString("base64url");
  const { data, error } = await db
    .from("orders")
    .insert({
      product_id: input.productId,
      amount: input.amount,
      currency: input.currency,
      method: input.method,
      country: input.country,
      status: input.status,
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_contact: input.customerContact,
      document: input.document,
      emola_number: input.emolaNumber,
      emola_target: input.emolaTarget,
      confirmation_message: input.confirmationMessage,
      metadata: { access_token: accessToken },
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  const id = (data as unknown as { id: string }).id;
  return { ok: true, id, accessToken };
}

export async function attachPixCharge(
  orderId: string,
  charge: { id: string; qrCode: string | null; qrCodeImage: string | null },
): Promise<string | null> {
  const db = getSupabase();
  if (!db) return "Base de dados não configurada.";
  const { error } = await db
    .from("orders")
    .update({
      payment_provider: "infinigate",
      payment_reference: charge.id,
      pix_qrcode: charge.qrCode,
      pix_qrcode_image: charge.qrCodeImage,
    })
    .eq("id", orderId);
  return error ? error.message : null;
}

type OrderFetchRow = {
  id: string;
  status: string;
  amount: number | string;
  currency: string;
  product_id: string;
  metadata: unknown;
  products: { name: string; pdf_path: string | null } | null;
};

export async function getOrderForBuyer(
  orderId: string,
  accessToken: string,
): Promise<
  | {
      ok: true;
      status: string;
      productName: string;
      amount: number;
      currency: string;
      pdfPath: string | null;
    }
  | { ok: false; error: string }
> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "Base de dados não configurada." };

  const { data, error } = await db
    .from("orders")
    .select("id,status,amount,currency,product_id,metadata,products(name,pdf_path)")
    .eq("id", orderId)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Pedido não encontrado." };

  const row = data as unknown as OrderFetchRow;
  const meta = (row.metadata ?? {}) as { access_token?: unknown };
  if (meta.access_token !== accessToken) return { ok: false, error: "Pedido não encontrado." };

  return {
    ok: true,
    status: row.status,
    productName: row.products?.name ?? row.product_id,
    amount: Number(row.amount),
    currency: row.currency,
    pdfPath: row.products?.pdf_path ?? null,
  };
}

export async function signedPdfUrl(path: string): Promise<string | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await db.storage.from(EBOOK_BUCKET).createSignedUrl(path, 60 * 60);
  if (error || !data) return null;
  return data.signedUrl;
}

/**
 * Marca um pedido como pago. Idempotente: só transita a partir de "pending",
 * por isso um webhook repetido da InfiniGate não duplica nada.
 */
export async function markOrderPaidByReference(reference: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { error } = await db
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("payment_reference", reference)
    .in("status", ["pending"]);
  if (error) {
    console.error("[catalog] markOrderPaidByReference", error.message);
    return false;
  }
  return true;
}

/** Idem, mas pelo nosso próprio id de pedido (externalId enviado à InfiniGate). */
export async function markOrderPaidById(orderId: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { error } = await db
    .from("orders")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("id", orderId)
    .in("status", ["pending"]);
  if (error) {
    console.error("[catalog] markOrderPaidById", error.message);
    return false;
  }
  return true;
}

export async function markOrderRefundedById(orderId: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { error } = await db
    .from("orders")
    .update({ status: "cancelled", admin_note: "Reembolso recebido da InfiniGate." })
    .eq("id", orderId)
    .in("status", ["pending", "paid", "delivered"]);
  if (error) {
    console.error("[catalog] markOrderRefundedById", error.message);
    return false;
  }
  return true;
}

/** Resolve o nosso id de pedido a partir do id interno da InfiniGate. */
export async function findOrderIdByReference(reference: string): Promise<string | null> {
  const db = getSupabase();
  if (!db) return null;
  const { data, error } = await db
    .from("orders")
    .select("id")
    .eq("payment_reference", reference)
    .maybeSingle();
  if (error || !data) return null;
  return (data as unknown as { id: string }).id;
}

export async function listOrders(limit = 60): Promise<OrderRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("orders")
    .select(
      "id,created_at,product_id,amount,currency,method,status,country,customer_name,customer_email,customer_contact,document,emola_number,emola_target,confirmation_message,payment_reference,products(name)",
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[catalog] listOrders", error.message);
    return [];
  }

  return (
    (data ?? []) as unknown as (Omit<OrderRow, "product_name"> & {
      products: { name: string } | null;
    })[]
  ).map((row) => ({
    ...row,
    product_name: row.products?.name ?? row.product_id,
    amount: Number(row.amount),
  }));
}

export async function setOrderStatus(orderId: string, status: string): Promise<string | null> {
  const db = getSupabase();
  if (!db) return "Base de dados não configurada.";
  const patch: Record<string, unknown> = { status };
  if (status === "paid") patch["paid_at"] = new Date().toISOString();
  if (status === "delivered") patch["delivered_at"] = new Date().toISOString();
  const { error } = await db.from("orders").update(patch).eq("id", orderId);
  return error ? error.message : null;
}

export async function listVisits(limit = 80): Promise<VisitRow[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("site_visits")
    .select("id,created_at,path,country,referrer")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[catalog] listVisits", error.message);
    return [];
  }
  return (data ?? []) as unknown as VisitRow[];
}

export async function adminKpis(): Promise<AdminKpis | null> {
  const db = getSupabase();
  if (!db) return null;

  const [paid, pending, review, visits, visitsToday, visits7d, products] = await Promise.all([
    db.from("orders").select("amount,currency,product_id").in("status", ["paid", "delivered"]),
    db.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("orders").select("id", { count: "exact", head: true }).eq("status", "awaiting_review"),
    db.from("site_visits").select("id", { count: "exact", head: true }),
    db
      .from("site_visits")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfToday()),
    db
      .from("site_visits")
      .select("id", { count: "exact", head: true })
      .gte("created_at", daysAgo(7)),
    db.from("products").select("id,name").order("sort_order", { ascending: true }),
  ]);

  const paidRows = (paid.data ?? []) as unknown as {
    amount: number | string;
    currency: string;
    product_id: string;
  }[];
  const perProduct = new Map<string, number>();
  let revenueBrl = 0;
  let revenueMz = 0;

  for (const row of paidRows) {
    const amount = Number(row.amount);
    if (row.currency === "MT") revenueMz += amount;
    else revenueBrl += amount;
    perProduct.set(row.product_id, (perProduct.get(row.product_id) ?? 0) + 1);
  }

  const productRows = (products.data ?? []) as unknown as { id: string; name: string }[];

  return {
    confirmedSales: paidRows.length,
    revenueBrl,
    revenueMz,
    pendingOrders: pending.count ?? 0,
    awaitingReview: review.count ?? 0,
    visitsTotal: visits.count ?? 0,
    visitsToday: visitsToday.count ?? 0,
    visits7d: visits7d.count ?? 0,
    salesByProduct: productRows.map((p) => ({
      id: p.id,
      name: p.name,
      count: perProduct.get(p.id) ?? 0,
    })),
  };
}

function startOfToday(): string {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  ).toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

export async function createSignedUpload(
  productId: string,
  fileName: string,
  contentType: string,
): Promise<{ ok: true; path: string; signedUrl: string } | { ok: false; error: string }> {
  const db = getSupabase();
  if (!db) return { ok: false, error: "Base de dados não configurada." };

  const safeName =
    fileName
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .slice(-60) || "ebook.pdf";
  const path = `${productId}/${Date.now()}-${safeName}`;

  const { data, error } = await db.storage
    .from(EBOOK_BUCKET)
    .createSignedUploadUrl(path, { upsert: true });
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Não foi possível criar o link de upload." };
  }
  void contentType;
  return { ok: true, path, signedUrl: data.signedUrl };
}

/* ---------------------------------------------------- chat de apoio (TTC) */

type SupportRow = {
  id: number;
  created_at: string;
  session_id: string;
  author: string;
  kind: string;
  content: string;
  admin_name: string | null;
  country: string | null;
};

const SUPPORT_SELECT = "id,created_at,session_id,author,kind,content,admin_name,country";

function toSupportAuthor(value: string): SupportAuthor {
  return value === "visitor" || value === "assistant" || value === "admin" ? value : "system";
}

function toSupportMessage(row: SupportRow): SupportMessage {
  return {
    id: Number(row.id),
    created_at: row.created_at,
    session_id: row.session_id,
    author: toSupportAuthor(row.author),
    kind: row.kind === "human_request" ? "human_request" : "message",
    content: row.content,
    admin_name: row.admin_name,
  };
}

/** Guarda uma mensagem do chat de apoio. Devolve `false` se não houver DB. */
export async function recordSupportMessage(input: {
  sessionId: string;
  author: SupportAuthor;
  content: string;
  kind?: "message" | "human_request";
  adminName?: string | null;
  country?: string | null;
}): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  const { error } = await db.from("support_messages").insert({
    session_id: input.sessionId,
    author: input.author,
    kind: input.kind ?? "message",
    content: input.content,
    admin_name: input.adminName ?? null,
    country: input.country ?? null,
  });
  if (error) {
    console.error("[catalog] recordSupportMessage", error.message);
    return false;
  }
  return true;
}

/** Respostas da equipa e avisos de sistema, para o chat do visitante. */
export async function listSupportReplies(
  sessionId: string,
  afterId: number,
): Promise<SupportMessage[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("support_messages")
    .select(SUPPORT_SELECT)
    .eq("session_id", sessionId)
    .in("author", ["admin", "system"])
    .gt("id", afterId)
    .order("id", { ascending: true })
    .limit(60);
  if (error) {
    console.error("[catalog] listSupportReplies", error.message);
    return [];
  }
  return ((data ?? []) as unknown as SupportRow[]).map(toSupportMessage);
}

/** Conversa completa de um visitante (para o painel). */
export async function listSupportMessages(
  sessionId: string,
  limit = 300,
): Promise<SupportMessage[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("support_messages")
    .select(SUPPORT_SELECT)
    .eq("session_id", sessionId)
    .order("id", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("[catalog] listSupportMessages", error.message);
    return [];
  }
  return ((data ?? []) as unknown as SupportRow[]).map(toSupportMessage);
}

/** Agrupa as mensagens recentes por visitante, da mais recente para a mais antiga. */
export async function listSupportThreads(limit = 400): Promise<SupportThread[]> {
  const db = getSupabase();
  if (!db) return [];
  const { data, error } = await db
    .from("support_messages")
    .select(SUPPORT_SELECT)
    .order("id", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("[catalog] listSupportThreads", error.message);
    return [];
  }

  const rows = (data ?? []) as unknown as SupportRow[];
  const threads = new Map<string, SupportThread>();

  for (const row of rows) {
    const author = toSupportAuthor(row.author);
    const existing = threads.get(row.session_id);
    if (!existing) {
      threads.set(row.session_id, {
        session_id: row.session_id,
        last_at: row.created_at,
        total: 1,
        human_requested: row.kind === "human_request",
        last_content: row.content,
        last_author: author,
        country: row.country,
        admin_replies: author === "admin" ? 1 : 0,
      });
      continue;
    }
    existing.total += 1;
    if (row.kind === "human_request") existing.human_requested = true;
    if (author === "admin") existing.admin_replies += 1;
  }

  return [...threads.values()];
}
