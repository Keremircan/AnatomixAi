import "server-only";
import postgres from "postgres";

/**
 * Sunucu tarafı doğrudan PostgreSQL bağlantısı (Supabase Postgres, .env.local → DB_*).
 * Yalnızca Route Handler / Server Component içinde kullanılır; tarayıcıya hiçbir zaman gönderilmez.
 * Geliştirmede sıcak yenileme her seferinde yeni havuz açmasın diye bağlantı global'de saklanır.
 */
declare global {
  var __anatomixSql: postgres.Sql | undefined;
}

function createSql() {
  const env = (k: string) => {
    const v = process.env[k];
    if (!v) throw new Error(`Veritabanı yapılandırılmadı: .env.local içinde ${k} eksik.`);
    return v;
  };
  return postgres({
    host: env("DB_HOST"),
    port: Number(env("DB_PORT")),
    database: env("DB_NAME"),
    username: env("DB_USER"),
    password: env("DB_PASSWORD"),
    ssl: "require",
    // Supabase havuzlayıcısının transaction modunda hazırlanmış ifadeler desteklenmez.
    prepare: false,
    max: 5,
    // Veritabanı uzak bölgede; yeni şifreli bağlantı ~2 sn sürüyor. Boşta bağlantıyı 20 sn'de kapatmak her
    // duraksamadan sonraki isteği ~3 sn'ye çıkarıyordu. Bağlantılar 5 dk boşta kalabilir, 30 dk'da yenilenir.
    idle_timeout: 300,
    max_lifetime: 60 * 30,
    connect_timeout: 15,
    onnotice: () => {},
  });
}

export function db() {
  globalThis.__anatomixSql ??= createSql();
  return globalThis.__anatomixSql;
}

const TRANSIENT = new Set(["CONNECT_TIMEOUT", "CONNECTION_CLOSED", "CONNECTION_ENDED", "CONNECTION_DESTROYED", "ECONNRESET", "ETIMEDOUT"]);

/**
 * Yalnızca okuma yapan (tekrarı zararsız) sorgular için: bağlantı kurulurken ağ kaynaklı geçici bir hata olursa
 * bir kez daha dener. Uzak bölgedeki havuzlayıcıya yeni bağlantı açılırken ara sıra zaman aşımı yaşanabiliyor.
 */
export async function withReadRetry<T>(query: () => Promise<T>): Promise<T> {
  try {
    return await query();
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code && TRANSIENT.has(code)) return query();
    throw e;
  }
}

