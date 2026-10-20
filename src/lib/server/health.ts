import "server-only";
import { db, withReadRetry } from "./db";
import type { BloodPressureStatus, BloodSugarStatus, BloodType, HealthData, Lifestyle } from "@/lib/health";

/** Kişiselleştirilmiş sağlık profili (app.patient_health_data). Her sorgu yalnızca oturumdaki kullanıcının satırına dokunur. */

type HealthRow = {
  blood_type: BloodType | null;
  birth_date: string | null;
  height_cm: number | null;
  weight_kg: string | null;
  blood_pressure_status: BloodPressureStatus | null;
  blood_sugar_status: BloodSugarStatus | null;
  allergies: string[];
  chronic_conditions: string[];
  regular_medications: string[];
  surgical_history: string[];
  medical_devices: string[];
  disability_status: string | null;
  lifestyle: Partial<Lifestyle>;
  is_completed: boolean;
  reminder_dismissed_at: Date | string | null;
  updated_at: Date | string;
};

/** Bandın "Şimdi değil" sonrası yeniden gösterilmeden önce beklenen süre. */
const REMINDER_SNOOZE_MS = 1000 * 60 * 60 * 24 * 14;

/** Satır → API biçimi. Hem doğrudan sorgudan hem de profil sorgusundaki JSON'dan (tarihler metin) gelebilir. */
export function toHealthData(r: HealthRow): HealthData {
  return {
    bloodType: r.blood_type,
    birthDate: r.birth_date ? String(r.birth_date).slice(0, 10) : null,
    heightCm: r.height_cm,
    weightKg: r.weight_kg === null ? null : Number(r.weight_kg),
    bloodPressureStatus: r.blood_pressure_status,
    bloodSugarStatus: r.blood_sugar_status,
    allergies: r.allergies ?? [],
    chronicConditions: r.chronic_conditions ?? [],
    regularMedications: r.regular_medications ?? [],
    surgicalHistory: r.surgical_history ?? [],
    medicalDevices: r.medical_devices ?? [],
    disabilityStatus: r.disability_status,
    lifestyle: { smoking: r.lifestyle?.smoking ?? null, alcohol: r.lifestyle?.alcohol ?? null },
    isCompleted: r.is_completed,
    updatedAt: new Date(r.updated_at).toISOString(),
  };
}

export const HEALTH_COLUMNS =
  "blood_type, birth_date::text as birth_date, height_cm, weight_kg::text as weight_kg, blood_pressure_status, blood_sugar_status, allergies, chronic_conditions, regular_medications, surgical_history, medical_devices, disability_status, lifestyle, is_completed, reminder_dismissed_at, updated_at";

export async function getHealthData(userId: string) {
  const [row] = await withReadRetry(() => db()<HealthRow[]>`
    select ${db().unsafe(HEALTH_COLUMNS)} from app.patient_health_data where user_id = ${userId}
  `);
  if (!row) return { health: null, remind: true };
  const dismissed = row.reminder_dismissed_at ? new Date(row.reminder_dismissed_at).getTime() : 0;
  return { health: toHealthData(row), remind: !row.is_completed && Date.now() - dismissed > REMINDER_SNOOZE_MS };
}

/** Tüm profili yazar (UPSERT). Yalnızca etkin kullanıcılar için çalışır. */
export async function saveHealthData(userId: string, h: HealthData) {
  const lifestyle = Object.fromEntries(Object.entries(h.lifestyle).filter(([, v]) => v !== null));
  const [row] = await db()<HealthRow[]>`
    insert into app.patient_health_data (
      user_id, blood_type, birth_date, height_cm, weight_kg, blood_pressure_status, blood_sugar_status,
      allergies, chronic_conditions, regular_medications, surgical_history, medical_devices,
      disability_status, lifestyle, is_completed, updated_at
    )
    select
      u.id, ${h.bloodType}, ${h.birthDate}::date, ${h.heightCm}, ${h.weightKg}, ${h.bloodPressureStatus}, ${h.bloodSugarStatus},
      ${h.allergies}::text[], ${h.chronicConditions}::text[], ${h.regularMedications}::text[], ${h.surgicalHistory}::text[], ${h.medicalDevices}::text[],
      ${h.disabilityStatus}, ${db().json(lifestyle)}, ${h.isCompleted}, now()
    from app.users u where u.id = ${userId} and u.is_active
    on conflict (user_id) do update set
      blood_type = excluded.blood_type, birth_date = excluded.birth_date, height_cm = excluded.height_cm, weight_kg = excluded.weight_kg,
      blood_pressure_status = excluded.blood_pressure_status, blood_sugar_status = excluded.blood_sugar_status,
      allergies = excluded.allergies, chronic_conditions = excluded.chronic_conditions, regular_medications = excluded.regular_medications,
      surgical_history = excluded.surgical_history, medical_devices = excluded.medical_devices,
      disability_status = excluded.disability_status, lifestyle = excluded.lifestyle,
      -- Tamamlanmış profil düzenlenince tamamlanmış kalır.
      is_completed = app.patient_health_data.is_completed or excluded.is_completed,
      updated_at = now()
    returning ${db().unsafe(HEALTH_COLUMNS)}
  `;
  return row ? toHealthData(row) : null;
}

/** "Şimdi değil": hatırlatma bandını bir süre gizler (satır yoksa boş bir satır açılır). */
export async function dismissHealthReminder(userId: string) {
  await db()`
    insert into app.patient_health_data (user_id, reminder_dismissed_at)
    select u.id, now() from app.users u where u.id = ${userId} and u.is_active
    on conflict (user_id) do update set reminder_dismissed_at = now()
  `;
}

/** Kullanıcının sağlık profilini tamamen siler (KVKK: silme hakkı). */
export async function deleteHealthData(userId: string) {
  await db()`delete from app.patient_health_data where user_id = ${userId}`;
}
