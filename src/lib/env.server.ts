/**
 * Carregamento de variáveis de ambiente no servidor.
 *
 * `process.loadEnvFile` lê o `.env` local quando o runtime não o faz sozinho
 * (Vite não injeta `.env` em `process.env`). Em Replit/Vercel as variáveis já
 * vêm do ambiente e a chamada é simplesmente ignorada.
 */

let loaded = false;

export function loadServerEnv(): void {
  if (loaded) return;
  loaded = true;
  try {
    process.loadEnvFile?.();
  } catch {
    // sem ficheiro .env — normal em produção
  }
}

export function readEnv(name: string): string | undefined {
  loadServerEnv();
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function readEnvOr(name: string, fallback: string): string {
  return readEnv(name) ?? fallback;
}
