import type { NextRequest } from "next/server";
import { clientIp, EMAIL_RE, error, json, normalizeEmail, readJson, rejectCrossSite } from "@/lib/server/http";
import { verifyPassword } from "@/lib/server/password";
import { checkRateLimit, recordAttempt } from "@/lib/server/rateLimit";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session";
import { findUserByEmail, toProfile, touchLastLogin } from "@/lib/server/users";

/** Hesap keşfini önlemek için kullanıcı yok / parola yanlış / pasif hesap aynı yanıtı alır. */
const INVALID = "E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.";
const PORTAL_NAME = { patient: "Hasta Portalı", clinician: "Sağlık Profesyoneli Portalı" } as const;

export async function POST(request: NextRequest) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;

  const body = await readJson(request);
  const email = normalizeEmail(body?.email);
  const password = typeof body?.password === "string" ? body.password : "";
  const portal = body?.role === "patient" || body?.role === "clinician" ? body.role : null;
  if (!EMAIL_RE.test(email) || !password || password.length > 200) return error(400, INVALID);

  const ip = clientIp(request);
  const limit = await checkRateLimit("login", email, ip);
  if (limit.limited) {
    return error(429, `Çok fazla başarısız deneme yapıldı. ${Math.ceil(limit.retryAfterSeconds / 60)} dakika sonra tekrar deneyin.`, {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const user = await findUserByEmail(email);
  // Kullanıcı yoksa sahte özetle karşılaştırılır; yanıt süresi kayıtlı hesapla aynı kalır.
  const ok = (await verifyPassword(password, user?.password_hash ?? null)) && !!user?.is_active;
  await recordAttempt("login", email, ip, ok);
  if (!ok || !user) return error(401, INVALID);

  // Parola doğrulandıktan sonra: seçilen portal hesabın rolüyle uyuşmuyorsa oturum açılmaz.
  if (portal && portal !== user.role) {
    return error(403, `Bu hesap ${PORTAL_NAME[user.role]} için kayıtlı. Lütfen üstten doğru portalı seçin.`);
  }

  await touchLastLogin(user.id);
  const token = await createSessionToken({ sub: user.id, role: user.role, email: user.email });
  const res = json({ user: toProfile(user) });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
