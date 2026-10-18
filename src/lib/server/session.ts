import "server-only";
import { jwtVerify, SignJWT } from "jose";
import type { UserRole } from "@/lib/auth";

/**
 * Oturum: HS256 ile imzalanmış JWT, HttpOnly çerezde taşınır.
 * Proxy yalnızca imzayı ve süreyi doğrular (iyimser kontrol); /api/auth/me ayrıca kullanıcının
 * veritabanında hâlâ aktif olduğunu denetler.
 */
export const SESSION_COOKIE = "anx_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 saat

const ISSUER = "anatomix.ai";
const AUDIENCE = "anatomix.ai/web";

export type SessionPayload = { sub: string; role: UserRole; email: string };

function secretKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET tanımlı değil veya 32 karakterden kısa (.env.local).");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload) {
  return new SignJWT({ role: payload.role, email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Geçerliyse oturum bilgisini, değilse null döndürür (süresi dolmuş, imzası bozuk vb.). */
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { issuer: ISSUER, audience: AUDIENCE, algorithms: ["HS256"] });
    const role = payload.role;
    if (typeof payload.sub !== "string" || (role !== "patient" && role !== "clinician") || typeof payload.email !== "string") return null;
    return { sub: payload.sub, role, email: payload.email };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};
