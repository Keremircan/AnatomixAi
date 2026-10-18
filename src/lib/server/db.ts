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
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {},
  });
}

export function db() {
  globalThis.__anatomixSql ??= createSql();
  return globalThis.__anatomixSql;
}
