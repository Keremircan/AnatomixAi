import type { NextRequest } from "next/server";
import { error, json } from "@/lib/server/http";
import { SESSION_COOKIE, sessionCookieOptions, verifySessionToken } from "@/lib/server/session";
import { getProfileDetails } from "@/lib/server/users";

/**
 * Oturumdaki kullanıcının profil ayrıntıları ve yasal onay kayıtları.
 * Proxy bu yolu zaten korur; rota yine de oturumu kendisi doğrular (savunma katmanı).
 */
export async function GET(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return error(401, "Oturum gerekli.");

  const profile = await getProfileDetails(session.sub);
  if (!profile) {
    // Hesap silinmiş veya pasifleştirilmiş: oturum çerezi geçersiz kılınır.
    const res = error(401, "Oturum gerekli.");
    res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    return res;
  }
  return json({ profile });
}
