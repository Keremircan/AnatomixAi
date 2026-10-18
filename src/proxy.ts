import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionCookieOptions, verifySessionToken } from "@/lib/server/session";

/** Oturum gerektirmeyen yollar. */
const PUBLIC_PAGES = ["/login"];
const PUBLIC_API = ["/api/auth/login", "/api/auth/register", "/api/auth/logout", "/api/auth/me"];

/**
 * Rota koruması (Next.js 16'da middleware.ts'in yeni adı proxy.ts; Node.js çalışma ortamında çalışır).
 * - Oturum çerezi (imzalı JWT) yoksa veya geçersizse: sayfalar /login'e yönlendirilir, API'ler 401 alır.
 * - Oturumu açık kullanıcı /login'e girerse ana sayfaya yönlendirilir.
 * Proxy iyimser bir kontroldür; API rotaları kendi yetki kontrolünü ayrıca yapar.
 */
export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);

  if (pathname.startsWith("/api/")) {
    if (session || PUBLIC_API.includes(pathname)) return NextResponse.next();
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  if (!session && !PUBLIC_PAGES.includes(pathname)) {
    const to = request.nextUrl.clone();
    to.pathname = "/login";
    to.search = "";
    if (pathname !== "/") to.searchParams.set("next", pathname + search);
    const res = NextResponse.redirect(to);
    // Süresi dolmuş / bozuk çerez varsa temizle.
    if (token) res.cookies.set(SESSION_COOKIE, "", { ...sessionCookieOptions, maxAge: 0 });
    return res;
  }

  if (session && pathname === "/login") {
    const to = request.nextUrl.clone();
    to.pathname = "/";
    to.search = "";
    return NextResponse.redirect(to);
  }

  return NextResponse.next();
}

export const config = {
  // Statik dosyalar (3B modeller, Draco çözücü, görseller) proxy'den geçmez.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|models/|draco/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|glb|gltf|wasm|json|txt)$).*)"],
};
