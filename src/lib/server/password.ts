import "server-only";
import bcrypt from "bcryptjs";

const COST = 12;

/**
 * Kullanıcı bulunamadığında da aynı maliyette bir karşılaştırma yapılır; böylece yanıt süresinden
 * e-postanın kayıtlı olup olmadığı anlaşılamaz (zamanlama saldırısı koruması).
 * Rastgele bir parolanın, aynı maliyetle (12) üretilmiş özetidir; hiçbir parola bununla eşleşmez.
 */
const DUMMY_HASH = "$2b$12$0Jv.Ff3BTEy/lcMruzNjo.iT0UdcEVvhymh.j2IolozStyOhae8RC";

/** bcrypt yalnızca ilk 72 baytı dikkate alır; daha uzun parolalar kabul edilmez. */
export const PASSWORD_MAX_BYTES = 72;
export const PASSWORD_MIN_LENGTH = 8;

export function passwordProblem(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return `Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalı.`;
  if (new TextEncoder().encode(password).length > PASSWORD_MAX_BYTES) return "Şifre çok uzun (en fazla 72 bayt).";
  return null;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, COST);
}

/** hash null ise (kullanıcı yok) yine de karşılaştırma yapılır ve false döner. */
export async function verifyPassword(password: string, hash: string | null) {
  const ok = await bcrypt.compare(password, hash ?? DUMMY_HASH);
  return hash !== null && ok;
}
