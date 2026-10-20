-- ANATOMIX.AI · kişiselleştirilmiş sağlık profili (isteğe bağlı)
--
-- Kullanıcının kendi beyan ettiği sağlık bilgileri; app.users ile 1'e 1. Triyaj kurallarını besler ve profil
-- sayfasında gösterilir. Sağlık verisi KVKK'da özel nitelikli kişisel veridir: yalnızca sunucu tarafındaki
-- API (/api/user/health-data) üzerinden, oturumdaki kullanıcının kendi satırına erişilir.
-- Tüm alanlar isteğe bağlıdır; doğrulama hem API'de hem burada (check kısıtları) yapılır.

create table app.patient_health_data (
  user_id uuid primary key references app.users (id) on delete cascade,
  blood_type text check (blood_type in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '0+', '0-')),
  birth_date date check (birth_date <= current_date and birth_date >= date '1900-01-01'),
  height_cm smallint check (height_cm between 40 and 250),
  weight_kg numeric(5, 2) check (weight_kg between 2 and 400),
  blood_pressure_status text check (blood_pressure_status in ('Normal', 'Hipertansiyon', 'Hipotansiyon', 'Bilinmiyor')),
  blood_sugar_status text check (blood_sugar_status in ('Normal', 'Diyabet Tip-1', 'Diyabet Tip-2', 'İnsülin Direnci', 'Bilinmiyor')),
  allergies text[] not null default '{}' check (cardinality(allergies) <= 20),
  chronic_conditions text[] not null default '{}' check (cardinality(chronic_conditions) <= 20),
  regular_medications text[] not null default '{}' check (cardinality(regular_medications) <= 20),
  surgical_history text[] not null default '{}' check (cardinality(surgical_history) <= 20),
  medical_devices text[] not null default '{}' check (cardinality(medical_devices) <= 20),
  disability_status text check (char_length(disability_status) <= 300),
  lifestyle jsonb not null default '{}'::jsonb check (
    jsonb_typeof(lifestyle) = 'object'
    and coalesce(lifestyle ->> 'smoking', 'none') in ('none', 'occasional', 'regular')
    and coalesce(lifestyle ->> 'alcohol', 'none') in ('none', 'occasional', 'regular')
  ),
  is_completed boolean not null default false,
  -- "Şimdi değil" ile kapatılan hatırlatma bandı bir süre gösterilmez
  reminder_dismissed_at timestamptz,
  updated_at timestamptz not null default now()
);

comment on table app.patient_health_data is 'Kullanıcının beyan ettiği sağlık profili (özel nitelikli kişisel veri); yalnızca sahibi /api/user/health-data üzerinden erişir.';

alter table app.patient_health_data enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on app.patient_health_data from anon, authenticated';
  end if;
end
$$;
