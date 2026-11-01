import { getRequestHeaders, getRequestIP } from "@tanstack/react-start/server";

import type { CurrencyCode, Region } from "./types";

/**
 * Deteção de país para decidir a moeda e o método de pagamento.
 *
 * Ordem de prioridade:
 *   1. cabeçalhos do edge (Vercel / Cloudflare / proxies)
 *   2. lookup por IP (fallback, com cache)
 *   3. Brasil (padrão)
 */

const PRIVATE_IP = /^(10\.|127\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|f[cd])/i;
const CACHE_TTL_MS = 60 * 60 * 1000;

const cache = new Map<string, { country: string; expires: number }>();

function headerCountry(): string | null {
  const headers = getRequestHeaders();
  const candidates = [
    "x-vercel-ip-country",
    "cf-ipcountry",
    "x-country-code",
    "x-geo-country",
    "x-appengine-country",
  ];
  for (const name of candidates) {
    const value = headers.get(name)?.trim().toUpperCase();
    if (value && /^[A-Z]{2}$/.test(value) && value !== "XX" && value !== "T1") return value;
  }
  return null;
}

async function ipCountry(ip: string | undefined): Promise<string | null> {
  if (!ip || PRIVATE_IP.test(ip)) return null;

  const hit = cache.get(ip);
  if (hit && hit.expires > Date.now()) return hit.country;

  try {
    const response = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/country/`, {
      signal: AbortSignal.timeout(2500),
      headers: { "user-agent": "menteexperta/1.0" },
    });
    if (!response.ok) return null;
    const code = (await response.text()).trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return null;
    cache.set(ip, { country: code, expires: Date.now() + CACHE_TTL_MS });
    return code;
  } catch {
    return null;
  }
}

export function currencyFor(country: string): CurrencyCode {
  return country === "MZ" ? "MT" : "BRL";
}

export function regionFrom(country: string): Region {
  const currency = currencyFor(country);
  return {
    country,
    currency,
    symbol: currency === "MT" ? "MT" : "R$",
    isMozambique: currency === "MT",
  };
}

export async function detectRegion(): Promise<Region> {
  const fromHeaders = headerCountry();
  if (fromHeaders) return regionFrom(fromHeaders);

  let ip: string | undefined;
  try {
    ip = getRequestIP({ xForwardedFor: true });
  } catch {
    ip = undefined;
  }

  const fromIp = await ipCountry(ip);
  return regionFrom(fromIp ?? "BR");
}

export function requestFingerprint(): { ip: string | undefined; userAgent: string | undefined } {
  const headers = getRequestHeaders();
  let ip: string | undefined;
  try {
    ip = getRequestIP({ xForwardedFor: true });
  } catch {
    ip = undefined;
  }
  return { ip, userAgent: headers.get("user-agent") ?? undefined };
}

export function siteBaseUrl(): string {
  const headers = getRequestHeaders();
  const proto = headers.get("x-forwarded-proto") ?? "https";
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:8080";
  const configured = process.env["PUBLIC_BASE_URL"]?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  return `${proto}://${host}`;
}
