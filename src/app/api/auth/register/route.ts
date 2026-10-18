import type { NextRequest } from "next/server";
import { DISCLAIMER_VERSION, KVKK_VERSION, PROFESSIONS, type Profession } from "@/lib/auth";
import { clientIp, EMAIL_RE, error, json, normalizeEmail, readJson, rejectCrossSite, str } from "@/lib/server/http";
import { hashPassword, passwordProblem } from "@/lib/server/password";
import { checkRateLimit, recordAttempt } from "@/lib/server/rateLimit";
import { createSessionToken, SESSION_COOKIE, sessionCookieOptions } from "@/lib/server/session";
import { createUser, findUserByEmail, toProfile } from "@/lib/server/users";

const DUPLICATE = "Bu e-posta adresiyle kayıtlı bir hesap var. Giriş yapmayı deneyin.";

export async function POST(request: NextRequest) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;

  const ip = clientIp(request);
  const limit = await checkRateLimit("register", null, ip);
  if (limit.limited) {
    return error(429, "Bu bağlantıdan çok fazla kayıt denemesi yapıldı. Daha sonra tekrar deneyin.", {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  const body = await readJson(request);
  if (!body) return error(400, "Geçersiz istek.");

  const email = normalizeEmail(body.email);
  const password = typeof body.password === "string" ? body.password : "";
  const fullName = str(body.fullName, 120);
  const role = body.role === "patient" || body.role === "clinician" ? body.role : null;
  const consents = (body.consents ?? {}) as Record<string, unknown>;

  if (!EMAIL_RE.test(email)) return error(400, "Geçerli bir e-posta adresi girin.");
  const pwProblem = passwordProblem(password);
  if (pwProblem) return error(400, pwProblem);
  if (fullName.length < 2) return error(400, "Ad soyad en az 2 karakter olmalı.");
  if (!role) return error(400, "Geçerli bir portal (Hasta / Sağlık Profesyoneli) seçin.");
  // Zorunlu onaylar sunucuda da denetlenir (SRS FR-1.3.1, FR-1.5.1).
  if (consents.medicalDisclaimer !== true || consents.healthData !== true || consents.adult !== true) {
    return error(400, "Devam etmek için sorumluluk reddini, KVKK açık rızasını ve 18 yaş beyanını onaylayın.");
  }

  let profession: Profession | undefined;
  if (role === "clinician") {
    profession = PROFESSIONS.find((p) => p.id === body.profession)?.id;
    if (!profession) return error(400, "Mesleğinizi seçin.");
  }

  await recordAttempt("register", email, ip, true);
  if (await findUserByEmail(email)) return error(409, DUPLICATE);

  const user = await createUser({
    email,
    passwordHash: await hashPassword(password),
    fullName,
    role,
    profession,
    specialty: role === "clinician" ? str(body.specialty, 120) || undefined : undefined,
    institution: role === "clinician" ? str(body.institution, 200) || undefined : undefined,
    consents: [
      { kind: "medical_disclaimer", version: DISCLAIMER_VERSION },
      { kind: "health_data_processing", version: KVKK_VERSION },
      { kind: "adult_declaration", version: "1" },
    ],
  });
  // Eşzamanlı iki kayıt isteğinde benzersizlik kısıtı ikinciyi engeller.
  if (!user) return error(409, DUPLICATE);

  // Kayıttan sonra doğrudan oturum açılır.
  const token = await createSessionToken({ sub: user.id, role: user.role, email: user.email });
  const res = json({ user: toProfile(user) }, { status: 201 });
  res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
  return res;
}
