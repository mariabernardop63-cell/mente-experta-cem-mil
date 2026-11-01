import { createHmac, timingSafeEqual } from "node:crypto";

import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";

import { readEnv } from "./env.server";

/**
 * Autenticação do painel /admin.
 *
 * Credenciais vindas do ambiente (ADMIN_EMAIL + ADMIN_PASSWORD) e sessão num
 * cookie HttpOnly assinado com HMAC. Nada disto sai do servidor.
 */

const COOKIE_NAME = "me_admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 horas

export const ADMIN_NOT_CONFIGURED_MESSAGE =
  "Painel não configurado. Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente.";

function sessionSecret(): string | null {
  return readEnv("ADMIN_SESSION_SECRET") ?? readEnv("ADMIN_PASSWORD") ?? null;
}

export function isAdminConfigured(): boolean {
  return Boolean(readEnv("ADMIN_EMAIL") && readEnv("ADMIN_PASSWORD") && sessionSecret());
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function sign(payload: string): string | null {
  const secret = sessionSecret();
  if (!secret) return null;
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function checkCredentials(email: string, password: string): boolean {
  const expectedEmail = readEnv("ADMIN_EMAIL");
  const expectedPassword = readEnv("ADMIN_PASSWORD");
  if (!expectedEmail || !expectedPassword) return false;
  const emailOk = safeEqual(email.trim().toLowerCase(), expectedEmail.toLowerCase());
  const passwordOk = safeEqual(password, expectedPassword);
  return emailOk && passwordOk;
}

export function startSession(email: string): boolean {
  const payload = Buffer.from(
    JSON.stringify({ email, exp: Date.now() + SESSION_TTL_SECONDS * 1000 }),
  ).toString("base64url");
  const signature = sign(payload);
  if (!signature) return false;

  setCookie(COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
    secure: process.env["NODE_ENV"] === "production",
  });
  return true;
}

export function endSession(): void {
  deleteCookie(COOKIE_NAME, { path: "/" });
}

export function currentAdmin(): { email: string } | null {
  const raw = getCookie(COOKIE_NAME);
  if (!raw) return null;
  const index = raw.lastIndexOf(".");
  if (index <= 0) return null;

  const payload = raw.slice(0, index);
  const signature = raw.slice(index + 1);
  const expected = sign(payload);
  if (!expected || !safeEqual(signature, expected)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      email?: unknown;
      exp?: unknown;
    };
    if (typeof parsed.email !== "string" || typeof parsed.exp !== "number") return null;
    if (parsed.exp < Date.now()) return null;
    return { email: parsed.email };
  } catch {
    return null;
  }
}
