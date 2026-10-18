// Veritabanı migration'larını sırayla uygular: node --env-file=.env.local scripts/db-migrate.mjs
// Her dosya bir transaction içinde çalışır ve app.schema_migrations tablosuna kaydedilir;
// daha önce uygulanmış dosyalar atlanır.
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Eksik ortam değişkeni: ${missing.join(", ")} (.env.local)`);
  process.exit(1);
}

const sql = postgres({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: "require",
  prepare: false,
  max: 1,
  onnotice: () => {},
});

const dir = join(process.cwd(), "db", "migrations");

try {
  await sql`create schema if not exists app`;
  await sql`create table if not exists app.schema_migrations (name text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select name from app.schema_migrations`).map((r) => r.name));
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    if (done.has(file)) {
      console.log(`• ${file} (zaten uygulanmış)`);
      continue;
    }
    const body = await readFile(join(dir, file), "utf8");
    await sql.begin(async (tx) => {
      await tx.unsafe(body);
      await tx`insert into app.schema_migrations (name) values (${file})`;
    });
    console.log(`✓ ${file}`);
  }
} catch (e) {
  console.error("Migration başarısız:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
