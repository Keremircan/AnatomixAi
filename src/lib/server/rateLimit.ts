import "server-only";
import { db } from "./db";

/**
 * Veritabanı tabanlı deneme sınırı (app.auth_attempts). Bellek içi sayaçlardan farklı olarak
 * birden çok sunucu örneği ve yeniden başlatmalar arasında tutarlıdır.
 */
type Kind = "login" | "register";

const LIMITS = {
  // Aynı e-posta için 15 dakikada 5 başarısız giriş; aynı IP için 15 dakikada 20 başarısız giriş.
  login: { windowMinutes: 15, perEmail: 5, perIp: 20 },
  // Aynı IP'den saatte en fazla 10 kayıt denemesi.
  register: { windowMinutes: 60, perEmail: Infinity, perIp: 10 },
} as const;

export type RateLimitResult = { limited: false } | { limited: true; retryAfterSeconds: number };

export async function checkRateLimit(kind: Kind, email: string | null, ip: string | null): Promise<RateLimitResult> {
  const { windowMinutes, perEmail, perIp } = LIMITS[kind];
  const sql = db();
  const failuresOnly = kind === "login";
  const [row] = await sql<{ by_email: number; by_ip: number; oldest: Date | null }[]>`
    select
      count(*) filter (where ${email}::text is not null and email = ${email})::int as by_email,
      count(*) filter (where ${ip}::inet is not null and ip = ${ip}::inet)::int as by_ip,
      min(created_at) as oldest
    from app.auth_attempts
    where kind = ${kind}
      and created_at > now() - make_interval(mins => ${windowMinutes})
      and (${!failuresOnly} or not success)
      and (email = ${email} or ip = ${ip}::inet)
  `;
  if (row.by_email < perEmail && row.by_ip < perIp) return { limited: false };
  const elapsed = row.oldest ? (Date.now() - row.oldest.getTime()) / 1000 : 0;
  return { limited: true, retryAfterSeconds: Math.max(60, Math.ceil(windowMinutes * 60 - elapsed)) };
}

export async function recordAttempt(kind: Kind, email: string | null, ip: string | null, success: boolean) {
  const sql = db();
  await sql`insert into app.auth_attempts (kind, email, ip, success) values (${kind}, ${email}, ${ip}::inet, ${success})`;
  // Kişisel veri saklama süresini kısa tutmak için ara sıra eski kayıtları temizle.
  if (Math.random() < 0.05) await sql`delete from app.auth_attempts where created_at < now() - interval '24 hours'`;
}
