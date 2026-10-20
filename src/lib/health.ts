/**
 * Kişiselleştirilmiş sağlık profili: paylaşılan tipler, seçenekler ve doğrulama (tarayıcı + sunucu).
 * Sunucu aynı `normalizeHealthInput` fonksiyonuyla gelen veriyi yeniden doğrular; istemciye güvenilmez.
 */

export const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "0+", "0-"] as const;
export type BloodType = (typeof BLOOD_TYPES)[number];

export const BLOOD_PRESSURE = ["Normal", "Hipertansiyon", "Hipotansiyon", "Bilinmiyor"] as const;
export type BloodPressureStatus = (typeof BLOOD_PRESSURE)[number];

export const BLOOD_SUGAR = ["Normal", "Diyabet Tip-1", "Diyabet Tip-2", "İnsülin Direnci", "Bilinmiyor"] as const;
export type BloodSugarStatus = (typeof BLOOD_SUGAR)[number];

export const HABITS = ["none", "occasional", "regular"] as const;
export type Habit = (typeof HABITS)[number];
export const HABIT_LABEL: Record<Habit, string> = { none: "Kullanmıyorum", occasional: "Ara sıra", regular: "Düzenli" };

export type Lifestyle = { smoking: Habit | null; alcohol: Habit | null };

export type HealthData = {
  bloodType: BloodType | null;
  /** YYYY-AA-GG */
  birthDate: string | null;
  heightCm: number | null;
  weightKg: number | null;
  bloodPressureStatus: BloodPressureStatus | null;
  bloodSugarStatus: BloodSugarStatus | null;
  allergies: string[];
  chronicConditions: string[];
  regularMedications: string[];
  surgicalHistory: string[];
  medicalDevices: string[];
  disabilityStatus: string | null;
  lifestyle: Lifestyle;
  isCompleted: boolean;
  /** ISO tarih (yalnızca okunur) */
  updatedAt?: string;
};

export const EMPTY_HEALTH: HealthData = {
  bloodType: null,
  birthDate: null,
  heightCm: null,
  weightKg: null,
  bloodPressureStatus: null,
  bloodSugarStatus: null,
  allergies: [],
  chronicConditions: [],
  regularMedications: [],
  surgicalHistory: [],
  medicalDevices: [],
  disabilityStatus: null,
  lifestyle: { smoking: null, alcohol: null },
  isCompleted: false,
};

/** Etiket listeleri için sınırlar (veritabanı kısıtlarıyla aynı). */
export const LIST_MAX_ITEMS = 20;
export const ITEM_MAX_LENGTH = 80;
export const DISABILITY_MAX_LENGTH = 300;

export const SUGGESTIONS = {
  allergies: ["Penisilin", "Aspirin / NSAİİ", "Sülfonamid", "Lateks", "Fıstık", "Süt", "Yumurta", "Polen"],
  chronicConditions: ["Hipertansiyon", "Diyabet", "Astım", "KOAH", "Koroner arter hastalığı", "Kalp yetmezliği", "Hipotiroidi", "Böbrek yetmezliği", "Migren"],
  regularMedications: ["Kan sulandırıcı (antikoagülan)", "Tansiyon ilacı", "İnsülin", "Metformin", "Levotiroksin", "Statin", "İnhaler"],
  surgicalHistory: ["Apandisit ameliyatı", "Safra kesesi ameliyatı", "Sezaryen", "Bypass", "Diz protezi", "Kalça protezi", "Fıtık ameliyatı"],
  medicalDevices: ["Kalp pili", "Stent", "Platin / vida", "İşitme cihazı", "Diz protezi", "Kalça protezi", "İnsülin pompası"],
} as const;
export type HealthListKey = keyof typeof SUGGESTIONS;

const pick = <T extends string>(v: unknown, allowed: readonly T[]): T | null => (typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : null);

function list(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of v) {
    if (typeof item !== "string") continue;
    const t = item.replace(/\s+/g, " ").trim().slice(0, ITEM_MAX_LENGTH);
    const key = t.toLocaleLowerCase("tr-TR");
    if (!t || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= LIST_MAX_ITEMS) break;
  }
  return out;
}

function num(v: unknown, min: number, max: number, decimals: number) {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v.replace(",", ".")) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Doğum tarihi: geçerli bir takvim günü, bugünden ileri değil, 120 yıldan eski değil. */
function birthDate(v: unknown, today = new Date()): string | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) return null;
  const min = new Date(Date.UTC(today.getUTCFullYear() - 120, today.getUTCMonth(), today.getUTCDate()));
  return d > today || d < min ? null : v;
}

/** Gelen veriyi beyaz liste ve sınırlarla temizler; geçersiz alanlar boş kabul edilir. */
export function normalizeHealthInput(raw: Record<string, unknown>): HealthData {
  const life = (raw.lifestyle && typeof raw.lifestyle === "object" ? raw.lifestyle : {}) as Record<string, unknown>;
  const disability = typeof raw.disabilityStatus === "string" ? raw.disabilityStatus.replace(/\s+/g, " ").trim().slice(0, DISABILITY_MAX_LENGTH) : "";
  return {
    bloodType: pick(raw.bloodType, BLOOD_TYPES),
    birthDate: birthDate(raw.birthDate),
    heightCm: num(raw.heightCm, 40, 250, 0),
    weightKg: num(raw.weightKg, 2, 400, 2),
    bloodPressureStatus: pick(raw.bloodPressureStatus, BLOOD_PRESSURE),
    bloodSugarStatus: pick(raw.bloodSugarStatus, BLOOD_SUGAR),
    allergies: list(raw.allergies),
    chronicConditions: list(raw.chronicConditions),
    regularMedications: list(raw.regularMedications),
    surgicalHistory: list(raw.surgicalHistory),
    medicalDevices: list(raw.medicalDevices),
    disabilityStatus: disability || null,
    lifestyle: { smoking: pick(life.smoking, HABITS), alcohol: pick(life.alcohol, HABITS) },
    isCompleted: raw.isCompleted === true,
  };
}

/** Tam yaş (doğum tarihi yoksa null). */
export function ageOf(birth: string | null, today = new Date()) {
  if (!birth) return null;
  const [y, m, d] = birth.split("-").map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
}

export function bmiOf(h: HealthData) {
  if (!h.heightCm || !h.weightKg) return null;
  const bmi = h.weightKg / (h.heightCm / 100) ** 2;
  const label = bmi < 18.5 ? "Zayıf" : bmi < 25 ? "Normal" : bmi < 30 ? "Fazla kilolu" : "Obez";
  return { value: Math.round(bmi * 10) / 10, label };
}

/** Herhangi bir alan dolu mu (profil kartlarının gösterilmesi için). */
export function hasAnyHealthData(h: HealthData | null | undefined) {
  if (!h) return false;
  return (
    !!(h.bloodType || h.birthDate || h.heightCm || h.weightKg || h.bloodPressureStatus || h.bloodSugarStatus || h.disabilityStatus || h.lifestyle.smoking || h.lifestyle.alcohol) ||
    h.allergies.length + h.chronicConditions.length + h.regularMedications.length + h.surgicalHistory.length + h.medicalDevices.length > 0
  );
}

/**
 * Triyajda kullanılan risk faktörleri. Yalnızca seviyeyi yükseltmek için kullanılır (asla düşürmez).
 * Gerekçeler kullanıcıya sonuç sayfasında açıkça gösterilir.
 */
export function healthRiskFactors(h: HealthData | null | undefined) {
  if (!h) return { elderly: false, diabetes: false, chronic: [] as string[], anticoagulant: false, devices: false, age: null as number | null };
  const age = ageOf(h.birthDate);
  const diabetes = h.bloodSugarStatus === "Diyabet Tip-1" || h.bloodSugarStatus === "Diyabet Tip-2" || h.chronicConditions.some((c) => /diyabet|şeker/iu.test(c));
  const chronic = [
    ...(h.bloodPressureStatus === "Hipertansiyon" ? ["Hipertansiyon"] : []),
    ...h.chronicConditions.filter((c) => !(h.bloodPressureStatus === "Hipertansiyon" && /hipertansiyon|tansiyon/iu.test(c))),
  ];
  return {
    age,
    elderly: age !== null && age >= 65,
    diabetes,
    chronic,
    anticoagulant: h.regularMedications.some((m) => /kan sulandır|antikoagül|warfarin|coumadin|eliquis|xarelto|lixiana|pradaxa/iu.test(m)),
    devices: h.medicalDevices.length > 0,
  };
}
