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
