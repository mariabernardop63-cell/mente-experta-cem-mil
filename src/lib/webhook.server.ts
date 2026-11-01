import { verifyWebhookSignature } from "./infinigate.server";
import { markOrderPaidById, markOrderRefundedById, findOrderIdByReference } from "./catalog.server";

/**
 * Endpoint de webhook da InfiniGate.
 *
 * É chamado diretamente a partir de `src/server.ts` (o nosso entry de servidor),
 * antes do handler do TanStack Start, porque esta versão do Start não tem rotas
 * de API por ficheiro.
 *
 * URL pública: POST {PUBLIC_BASE_URL}/api/webhooks/infinigate
 *
 * Contrato:
 *   header  X-InfiniGate-Signature: t=<unix>,v1=<hmac_hex>
 *   v1 = HMAC_SHA256(INFINIGATE_WEBHOOK_KEY, "<t>.<corpo_bruto>")
 *   body    { id, event: "deposit_update", status: "paid" | "refunded", externalId, ... }
 *
 * Regras: responder 2xx rápido; ser idempotente (chave: id).
 */

export const WEBHOOK_PATH = "/api/webhooks/infinigate";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function handleInfinigateWebhook(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== WEBHOOK_PATH) return null;

  if (request.method !== "POST") {
    return json({ ok: false, error: "Método não permitido." }, 405);
  }

  const raw = await request.text();
  const signature = request.headers.get("x-infinigate-signature");

  if (!verifyWebhookSignature(raw, signature)) {
    // Assinatura ausente/errada ou webhook key não configurada.
    return json({ ok: false, error: "Assinatura inválida." }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return json({ ok: false, error: "JSON inválido." }, 400);
  }

  const event = typeof payload["event"] === "string" ? payload["event"] : "";
  const status = typeof payload["status"] === "string" ? payload["status"] : "";
  const externalId = typeof payload["externalId"] === "string" ? payload["externalId"] : null;
  const reference = typeof payload["id"] === "string" ? payload["id"] : null;

  if (event !== "deposit_update") {
    // Eventos que não tratamos continuam a ser confirmados (2xx) para não
    // provocar reenvios do mesmo evento.
    return json({ ok: true, ignored: true }, 200);
  }

  let orderId = externalId;
  if (!orderId && reference) orderId = await findOrderIdByReference(reference);
  if (!orderId) return json({ ok: true, unknown: true }, 200);

  if (status === "paid") {
    await markOrderPaidById(orderId);
  } else if (status === "refunded") {
    await markOrderRefundedById(orderId);
  }

  return json({ ok: true }, 200);
}
