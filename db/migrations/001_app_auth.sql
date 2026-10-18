-- ANATOMIX.AI · uygulama içi kimlik doğrulama şeması
--
-- Kullanıcılar Supabase Auth yerine uygulamanın kendi Route Handler'larıyla (/api/auth/*) yönetilir.
-- Tablolar "app" şemasındadır: bu şema Supabase Data API'sine (PostgREST) açık değildir ve
-- anon / authenticated rollerine hiçbir yetki verilmez. Erişim yalnızca sunucudaki doğrudan
-- veritabanı bağlantısıyla (DB_USER) yapılır. RLS ayrıca açıktır (politika yok = API'den erişim yok).

create schema if not exists app;
revoke all on schema app from public;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on schema app from anon, authenticated';
  end if;
end
$$;

create type app.user_role as enum ('patient', 'clinician');
create type app.clinician_profession as enum ('physician', 'physiotherapist', 'nurse');
-- Hasta hesapları doğrulama gerektirmez; uzman hesapları 'pending' başlar, yönetici 'verified' yapar (SRS §2.2).
create type app.verification_status as enum ('not_required', 'pending', 'verified', 'rejected');
create type app.consent_kind as enum ('medical_disclaimer', 'health_data_processing', 'adult_declaration');

-- ───────────────────────── users ─────────────────────────

create table app.users (
  id uuid primary key default gen_random_uuid(),
  -- Uygulama e-postayı küçük harfe çevirerek yazar; benzersizlik bu biçim üzerinden sağlanır.
  email text not null check (email = lower(email) and char_length(email) between 3 and 254),
  password_hash text not null check (password_hash like '$2%'),
  full_name text not null check (char_length(full_name) between 2 and 120),
  role app.user_role not null,
  profession app.clinician_profession,
  specialty text check (char_length(specialty) <= 120),
  institution text check (char_length(institution) <= 200),
  verification_status app.verification_status not null default 'not_required',
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_clinician_fields check (role = 'clinician' or (profession is null and specialty is null and institution is null)),
  constraint users_verification_matches_role check (
    (role = 'patient' and verification_status = 'not_required')
    or (role = 'clinician' and verification_status <> 'not_required')
  )
);

create unique index users_email_key on app.users (email);
-- Yönetici: onay bekleyen uzmanlar
create index users_pending_clinicians_idx on app.users (created_at) where verification_status = 'pending';

create function app.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger users_touch_updated_at
  before update on app.users
  for each row execute function app.touch_updated_at();

-- ───────────────────────── consents ─────────────────────────
-- Feragatname, KVKK açık rıza ve 18+ beyanı; sürüm ve sunucu zamanıyla, yalnızca eklenir (SRS FR-1.3.1, FR-1.5.1).

create table app.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null references app.users (id) on delete cascade,
  kind app.consent_kind not null,
  version text not null check (char_length(version) between 1 and 20),
  accepted_at timestamptz not null default now(),
  unique (user_id, kind, version)
);

create index consents_user_id_idx on app.consents (user_id);

-- ───────────────────────── auth_attempts ─────────────────────────
-- Kaba kuvvet koruması için giriş/kayıt denemeleri. Sunucular arası ortak ve kalıcıdır.
-- Kişisel veri (IP, e-posta) içerdiği için uygulama 24 saatten eski kayıtları siler.

create table app.auth_attempts (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('login', 'register')),
  email text,
  ip inet,
  success boolean not null,
  created_at timestamptz not null default now()
);

create index auth_attempts_email_idx on app.auth_attempts (kind, email, created_at desc) where not success;
create index auth_attempts_ip_idx on app.auth_attempts (kind, ip, created_at desc);
create index auth_attempts_created_at_idx on app.auth_attempts (created_at);

-- ───────────────────────── Savunma katmanı ─────────────────────────

alter table app.users enable row level security;
alter table app.consents enable row level security;
alter table app.auth_attempts enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema app from anon, authenticated';
    execute 'revoke all on all sequences in schema app from anon, authenticated';
    execute 'revoke all on all functions in schema app from anon, authenticated';
  end if;
end
$$;
