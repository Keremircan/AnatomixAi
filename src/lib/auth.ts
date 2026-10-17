/**
 * Kimlik doğrulama servisi (mock).
 * Arayüz Supabase Auth'a hazır tasarlandı: yalnızca bu dosyadaki iki fonksiyonun gövdesi
 * supabase.auth.signInWithPassword / signUp çağrılarıyla değiştirilecek. Şifre hiçbir yerde saklanmaz.
 */

export type UserRole = "patient" | "clinician";
export type Profession = "physician" | "physiotherapist" | "nurse";

export interface UserProfile {
  email: string;
  role: UserRole;
  fullName?: string;
  /** Sağlık profesyoneli alt tipi (SRS §2.1: ayrı rol değil, profil alanı) */
  profession?: Profession;
  /** Uzmanlık alanı / branş */
  specialty?: string;
  /** Kurum veya diploma numarası (opsiyonel) */
  institution?: string;
  /** Uzman hesabı yönetici tarafından doğrulanana kadar false (SRS §2.2) */
  verified?: boolean;
}

export const PROFESSIONS: { id: Profession; label: string; title: string }[] = [
  { id: "physician", label: "Hekim", title: "Dr." },
  { id: "physiotherapist", label: "Fizyoterapist", title: "Fzt." },
  { id: "nurse", label: "Hemşire", title: "Hemşire" },
];

export const SPECIALTIES: Record<Profession, string[]> = {
  physician: [
    "Ortopedi ve Travmatoloji", "Fiziksel Tıp ve Rehabilitasyon", "Acil Tıp", "Aile Hekimliği", "İç Hastalıkları",
    "Nöroloji", "Kardiyoloji", "Genel Cerrahi", "Spor Hekimliği", "Diğer",
  ],
  physiotherapist: ["Ortopedik rehabilitasyon", "Nörolojik rehabilitasyon", "Sporcu sağlığı", "Pediatrik rehabilitasyon", "Diğer"],
  nurse: ["Acil", "Yoğun bakım", "Ortopedi", "Dahiliye", "Diğer"],
};

/** Rozet için ünvanlı görünen ad: "Dr. Ayşe Yılmaz", "Fzt. Ali Kaya", "Hasta" */
export function displayName(user: UserProfile) {
  const name = user.fullName?.trim() || user.email.split("@")[0];
  if (user.role !== "clinician") return name;
  const title = PROFESSIONS.find((p) => p.id === user.profession)?.title;
  return title && title !== "Hemşire" ? `${title} ${name}` : name;
}

export function roleLabel(user: UserProfile) {
  if (user.role === "patient") return "Hasta";
  const p = PROFESSIONS.find((x) => x.id === user.profession)?.label ?? "Sağlık Profesyoneli";
  return user.specialty && user.specialty !== "Diğer" ? `${p} · ${user.specialty}` : p;
}

export class AuthError extends Error {}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Giriş (mock): biçim kontrolü yapar ve profil döndürür. */
export async function signIn(input: { email: string; password: string; role: UserRole }): Promise<UserProfile> {
  await delay(700);
  if (!EMAIL_RE.test(input.email)) throw new AuthError("Geçerli bir e-posta adresi girin.");
  if (input.password.length < 8) throw new AuthError("E-posta veya şifre hatalı.");
  // TODO(Supabase): const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  // Rol ve profil alanları profiles tablosundan okunacak; burada seçilen rol kullanılıyor.
  return { email: input.email.trim().toLowerCase(), role: input.role, verified: input.role === "patient" };
}

/** Kayıt (mock). */
export async function signUp(input: Omit<UserProfile, "verified"> & { password: string }): Promise<UserProfile> {
  await delay(900);
  if (!EMAIL_RE.test(input.email)) throw new AuthError("Geçerli bir e-posta adresi girin.");
  if (input.password.length < 8) throw new AuthError("Şifre en az 8 karakter olmalı.");
  // TODO(Supabase): supabase.auth.signUp({ email, password, options: { data: { role, full_name, ... } } })
  // Uzman hesapları belge doğrulamasına kadar verified=false kalır.
  const { password: _password, ...profile } = input;
  void _password;
  return { ...profile, email: profile.email.trim().toLowerCase(), verified: input.role === "patient" };
}
