/**
 * Kimlik doğrulama: paylaşılan tipler ve tarayıcı tarafı API istemcisi.
 * Doğrulama tamamen sunucudaki Route Handler'larda yapılır (/api/auth/*):
 * şifre bcrypt ile özetlenir, oturum imzalı JWT olarak HttpOnly çerezde taşınır.
 * Tarayıcı oturum jetonunu hiçbir zaman göremez; bu dosya yalnızca fetch istekleri atar.
 */

export type UserRole = "patient" | "clinician";
export type Profession = "physician" | "physiotherapist" | "nurse";
export type VerificationStatus = "not_required" | "pending" | "verified" | "rejected";

export interface UserProfile {
  id?: string;
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
  verificationStatus?: VerificationStatus;
}

export type ConsentKind = "medical_disclaimer" | "health_data_processing" | "adult_declaration";
export type ConsentRecord = { kind: ConsentKind; version: string; acceptedAt: string };

/** /api/user/profile yanıtı */
export interface ProfileDetails extends UserProfile {
  id: string;
  isActive: boolean;
  /** ISO tarih */
  createdAt: string;
  consents: ConsentRecord[];
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

/** Kabul edilen feragatname sürümü; değişirse kullanıcılardan yeniden onay alınır (SRS FR-1.3.5). */
export const DISCLAIMER_VERSION = "1.2";
/** KVKK aydınlatma / açık rıza metninin sürümü. */
export const KVKK_VERSION = "1.0";

/** Rozet için ünvanlı görünen ad: "Dr. Ayşe Yılmaz", "Fzt. Ali Kaya" */
export function displayName(user: UserProfile) {
  const name = user.fullName?.trim() || user.email.split("@")[0];
  if (user.role !== "clinician") return name;
  const title = PROFESSIONS.find((p) => p.id === user.profession)?.title;
  return title && title !== "Hemşire" ? `${title} ${name}` : name;
}

export class AuthError extends Error {
  /** HTTP durum kodu; destek ve hata ayıklama için arayüzde küçük olarak gösterilir. */
  constructor(message: string, readonly code?: string) {
    super(message);
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function post<T>(url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
      credentials: "same-origin",
    });
  } catch {
    throw new AuthError("Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.");
  }
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok) throw new AuthError(data?.error ?? "Bir sorun oluştu. Lütfen tekrar deneyin.", `HTTP ${res.status}`);
  return data as T;
}

/** Giriş. Seçilen portal hesabın rolüyle uyuşmazsa sunucu 403 döner. */
export async function signIn(input: { email: string; password: string; role: UserRole }): Promise<UserProfile> {
  if (!EMAIL_RE.test(input.email.trim())) throw new AuthError("Geçerli bir e-posta adresi girin.");
  if (input.password.length < 8) throw new AuthError("E-posta veya şifre hatalı. Lütfen bilgilerinizi kontrol edin.");
  const { user } = await post<{ user: UserProfile }>("/api/auth/login", { email: input.email, password: input.password, role: input.role });
  return user;
}

export type SignUpInput = Omit<UserProfile, "id" | "verified" | "verificationStatus"> & {
  password: string;
  consents: { medicalDisclaimer: boolean; healthData: boolean; adult: boolean };
};

/** Kayıt; başarılı olursa sunucu oturumu da açar. */
export async function signUp(input: SignUpInput): Promise<UserProfile> {
  if (!EMAIL_RE.test(input.email.trim())) throw new AuthError("Geçerli bir e-posta adresi girin.");
  if (input.password.length < 8) throw new AuthError("Şifre en az 8 karakter olmalı.");
  const { user } = await post<{ user: UserProfile }>("/api/auth/register", input);
  return user;
}

export async function signOut() {
  await post("/api/auth/logout");
}

/** Oturumdaki kullanıcı; oturum yoksa null. */
export async function fetchCurrentUser(): Promise<UserProfile | null> {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin", cache: "no-store" });
    if (!res.ok) return null;
    return ((await res.json()) as { user: UserProfile | null }).user;
  } catch {
    return null;
  }
}

/** Profil sayfası ayrıntıları; oturum yoksa null. */
export async function fetchProfileDetails(): Promise<ProfileDetails | null> {
  const res = await fetch("/api/user/profile", { credentials: "same-origin", cache: "no-store" });
  if (res.status === 401) return null;
  if (!res.ok) throw new AuthError("Profil bilgileri yüklenemedi. Lütfen tekrar deneyin.", `HTTP ${res.status}`);
  return ((await res.json()) as { profile: ProfileDetails }).profile;
}
