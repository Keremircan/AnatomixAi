import type { NextRequest } from "next/server";
import { error, json } from "@/lib/server/http";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/server/session";
import { deleteAvatar, getAvatar, saveAvatar, type AvatarMime } from "@/lib/server/users";

/** Sunucuya gelen görsel en fazla 512 KB olabilir (tarayıcı 256×256'ya küçültüp ~20–60 KB gönderir). */
const MAX_UPLOAD_BYTES = 512 * 1024;

async function sessionUserId(request: NextRequest) {
  return (await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value))?.sub ?? null;
}

/** İstemcinin bildirdiği türe değil, dosyanın ilk baytlarındaki imzaya göre biçim belirlenir. */
function sniffImage(b: Uint8Array): AvatarMime | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length > 12 && String.fromCharCode(...b.subarray(0, 4)) === "RIFF" && String.fromCharCode(...b.subarray(8, 12)) === "WEBP") return "image/webp";
  return null;
}

/** Durum değiştiren isteklerde aynı köken zorunlu (CSRF); görsel gövdesi image/* türünde gelmeli. */
function rejectCrossSite(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (origin && origin !== request.nextUrl.origin) return error(403, "Bu istek kabul edilmedi.");
  return null;
}

/** Oturumdaki kullanıcının profil fotoğrafı. Adres sürüm içerdiği için tarayıcı uzun süre önbellekte tutar. */
export async function GET(request: NextRequest) {
  const userId = await sessionUserId(request);
  if (!userId) return error(401, "Oturum gerekli.");
  const avatar = await getAvatar(userId);
  if (!avatar) return error(404, "Profil fotoğrafı yok.");
  return new Response(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": avatar.mime,
      "Content-Length": String(avatar.data.length),
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'",
      "Last-Modified": avatar.updated_at.toUTCString(),
    },
  });
}

/** Yeni profil fotoğrafı (gövde: görselin kendisi, Content-Type: image/jpeg | image/png | image/webp). */
export async function POST(request: NextRequest) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  const userId = await sessionUserId(request);
  if (!userId) return error(401, "Oturum gerekli.");

  if (!request.headers.get("content-type")?.startsWith("image/")) return error(415, "Yalnızca JPG, PNG veya WebP görsel yüklenebilir.");
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_UPLOAD_BYTES) return error(413, "Görsel çok büyük.");

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (bytes.length === 0) return error(400, "Görsel boş.");
  if (bytes.length > MAX_UPLOAD_BYTES) return error(413, "Görsel çok büyük.");
  const mime = sniffImage(bytes);
  if (!mime) return error(415, "Yalnızca JPG, PNG veya WebP görsel yüklenebilir.");

  const avatarUrl = await saveAvatar(userId, mime, bytes);
  return json({ avatarUrl });
}

export async function DELETE(request: NextRequest) {
  const rejected = rejectCrossSite(request);
  if (rejected) return rejected;
  const userId = await sessionUserId(request);
  if (!userId) return error(401, "Oturum gerekli.");
  await deleteAvatar(userId);
  return json({ avatarUrl: null });
}
