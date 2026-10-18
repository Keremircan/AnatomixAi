/**
 * Profil fotoğrafını tarayıcıda hazırlar: biçim/boyut kontrolü, ortadan kare kırpma ve 256×256'ya küçültme.
 * Böylece sunucuya birkaç MB'lık fotoğraf yerine ~20–60 KB'lık bir görsel gider.
 */
export const AVATAR_ACCEPT = "image/jpeg,image/png,image/webp";
export const AVATAR_MAX_INPUT_BYTES = 2 * 1024 * 1024;
const OUTPUT_SIZE = 256;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

export class AvatarImageError extends Error {}

export async function prepareAvatar(file: File): Promise<Blob> {
  if (!ALLOWED.has(file.type)) throw new AvatarImageError("Yalnızca JPG, PNG veya WebP biçiminde bir görsel seçin.");
  if (file.size > AVATAR_MAX_INPUT_BYTES) throw new AvatarImageError("Görsel en fazla 2 MB olabilir.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new AvatarImageError("Görsel okunamadı. Dosya bozuk olabilir; başka bir görsel deneyin.");
  }

  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = OUTPUT_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AvatarImageError("Tarayıcınız görsel işlemeyi desteklemiyor.");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  bitmap.close();

  const toBlob = (type: string) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.86));
  // WebP desteklemeyen tarayıcılar PNG döndürür; o durumda daha küçük olan JPEG'e geçilir.
  const webp = await toBlob("image/webp");
  const blob = webp?.type === "image/webp" ? webp : await toBlob("image/jpeg");
  if (!blob) throw new AvatarImageError("Görsel hazırlanamadı.");
  return blob;
}
