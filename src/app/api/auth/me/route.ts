import type { NextRequest } from "next/server";
import { json } from "@/lib/server/http";
import { SESSION_COOKIE, sessionCookieOptions, verifySessionToken } from "@/lib/server/session";
import { findActiveUserById, toProfile } from "@/lib/server/users";

/**
 * Oturumdaki kullanıcının güncel profili. Oturum yoksa { user: null } döner (giriş ekranında
 * olağan bir durum olduğu için hata kodu kullanılmaz). JWT geçerli olsa bile hesap silinmiş
 * veya pasifleştirilmişse kullanıcı null döner ve çerez temizlenir.
 */
export async function GET(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const user = session ? await findActiveUserById(session.sub) : null;
  if (!user) {
    const res = json({ user: null });
    if (request.cookies.has(SESSION_COOKIE)) res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    return res;
  }
  return json({ user: toProfile(user) });
}
