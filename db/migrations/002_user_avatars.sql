-- ANATOMIX.AI · profil fotoğrafı
--
-- users.avatar_url: istemcinin göstereceği adres ("/api/user/avatar?v=<sürüm>"). Görselin kendisi ayrı tabloda
-- tutulur; böylece her oturum / profil sorgusunda görsel baytları taşınmaz, yalnızca kısa adres okunur.
-- Görsel tarayıcıda 256×256'ya küçültülüp yüklenir; sunucu biçimi (JPEG/PNG/WebP imzası) ve boyutu yeniden denetler.

alter table app.users
  add column avatar_url text check (char_length(avatar_url) <= 200);

create table app.user_avatars (
  user_id uuid primary key references app.users (id) on delete cascade,
  mime text not null check (mime in ('image/jpeg', 'image/png', 'image/webp')),
  data bytea not null check (octet_length(data) between 1 and 524288), -- en fazla 512 KB
  updated_at timestamptz not null default now()
);

comment on table app.user_avatars is 'Profil fotoğrafları; yalnızca sahibi /api/user/avatar üzerinden okuyabilir.';

alter table app.user_avatars enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.user_avatars from anon, authenticated';
  end if;
end
$$;
