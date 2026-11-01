import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { readEnv } from "./env.server";

/**
 * Cliente Supabase do servidor (service_role).
 *
 * IMPORTANTE: este módulo só pode ser importado dinamicamente dentro de
 * handlers de server functions / rotas de API. A service_role key nunca pode
 * chegar ao browser.
 */

let cached: SupabaseClient | null = null;

export const MISSING_SUPABASE_MESSAGE =
  "Base de dados não configurada. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.";

export function getSupabase(): SupabaseClient | null {
  const url = readEnv("SUPABASE_URL");
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  cached ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { "x-application-name": "menteexperta" } },
  });
  return cached;
}

export const EBOOK_BUCKET = "ebooks";

/**
 * Papel da chave Supabase configurada, sem a expor.
 *
 * RLS está ligado nas tabelas e só a chave `service_role` o ignora. Com a
 * chave `anon`, as leituras voltam vazias e as escritas (mensagens do chat)
 * falham — por isso o painel precisa de saber qual está configurada.
 */
export function configuredKeyRole(): "service_role" | "anon" | "unknown" {
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) return "unknown";

  if (key.startsWith("sb_secret_")) return "service_role";
  if (key.startsWith("sb_publishable_")) return "anon";

  const parts = key.split(".");
  if (parts.length !== 3 || !parts[1]) return "unknown";
  try {
    const payload: unknown = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    const role = (payload as { role?: unknown }).role;
    if (role === "service_role") return "service_role";
    if (role === "anon") return "anon";
    return "unknown";
  } catch {
    return "unknown";
  }
}
