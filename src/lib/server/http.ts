import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { isIP } from "node:net";

/** Önbelleğe alınmayan JSON yanıtı. */
export function json(body: unknown, init?: ResponseInit) {
  const res = NextResponse.json(body, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function error(status: number, message: string, extraHeaders?: Record<string, string>) {
  return json({ error: message }, { status, headers: extraHeaders });
}

/**
 * Durum değiştiren isteklerde (POST) CSRF savunması: istek aynı kökenden gelmeli ve JSON olmalı.
 * SameSite=Lax çerezle birlikte, başka sitelerden form/fetch ile oturum işlemi yapılmasını engeller.
 */
export function rejectCrossSite(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return error(403, "Bu istek kabul edilmedi.");
  if (!request.headers.get("content-type")?.includes("application/json")) return error(415, "İstek JSON olmalı.");
  return null;
}

/** İstemci IP'si (ters vekil başlıklarından ilki). Geçersizse null. */
export function clientIp(request: NextRequest) {
  const raw = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "";
  const ip = raw.replace(/^::ffff:/, "");
  return isIP(ip) ? ip : null;
}

/** Gövdeyi JSON olarak okur; bozuksa null. */
export async function readJson(request: NextRequest): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");
export const normalizeEmail = (v: unknown) => str(v, 254).toLowerCase();
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
