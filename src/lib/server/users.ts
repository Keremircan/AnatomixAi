import "server-only";
import { db, withReadRetry } from "./db";
import { HEALTH_COLUMNS, toHealthData } from "./health";
import type { ConsentRecord, ProfileDetails, Profession, UserProfile, UserRole, VerificationStatus } from "@/lib/auth";

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  profession: Profession | null;
  specialty: string | null;
  institution: string | null;
  verification_status: VerificationStatus;
  is_active: boolean;
  avatar_url: string | null;
};

const COLUMNS = "id, email, password_hash, full_name, role, profession, specialty, institution, verification_status, is_active, avatar_url";

/** İstemciye gönderilen profil; parola özeti asla dahil edilmez. */
export function toProfile(u: Omit<UserRow, "password_hash">): UserProfile {
  return {
    id: u.id,
    email: u.email,
    role: u.role,
    fullName: u.full_name,
    profession: u.profession ?? undefined,
    specialty: u.specialty ?? undefined,
    institution: u.institution ?? undefined,
    verificationStatus: u.verification_status,
    verified: u.role === "patient" || u.verification_status === "verified",
    avatarUrl: u.avatar_url ?? undefined,
  };
}

export async function findUserByEmail(email: string) {
  const [u] = await db()<UserRow[]>`select ${db().unsafe(COLUMNS)} from app.users where email = ${email}`;
  return u ?? null;
}

export async function findActiveUserById(id: string) {
  const [u] = await withReadRetry(() => db()<UserRow[]>`select ${db().unsafe(COLUMNS)} from app.users where id = ${id} and is_active`);
  return u ?? null;
}

export async function touchLastLogin(id: string) {
  await db()`update app.users set last_login_at = now() where id = ${id}`;
}

export type NewUser = {
  email: string;
  passwordHash: string;
  fullName: string;
  role: UserRole;
  profession?: Profession;
  specialty?: string;
  institution?: string;
  consents: { kind: "medical_disclaimer" | "health_data_processing" | "adult_declaration"; version: string }[];
};

/** Kullanıcıyı ve onay kayıtlarını tek transaction içinde oluşturur. E-posta zaten varsa null döner. */
export async function createUser(input: NewUser) {
  const clinician = input.role === "clinician";
  return db().begin(async (tx) => {
    const [u] = await tx<UserRow[]>`
      insert into app.users (email, password_hash, full_name, role, profession, specialty, institution, verification_status)
      values (
        ${input.email}, ${input.passwordHash}, ${input.fullName}, ${input.role},
        ${clinician ? (input.profession ?? null) : null},
        ${clinician ? (input.specialty ?? null) : null},
        ${clinician ? (input.institution ?? null) : null},
        ${clinician ? "pending" : "not_required"}
      )
      on conflict (email) do nothing
      returning ${tx.unsafe(COLUMNS)}
    `;
    if (!u) return null;
    for (const c of input.consents) {
      await tx`insert into app.consents (user_id, kind, version) values (${u.id}, ${c.kind}, ${c.version})`;
    }
    return u;
  });
}

/**
 * Profil sayfası için kullanıcı ayrıntıları, her onay türünün en güncel kaydı ve sağlık profili — tek sorguda.
 * Veritabanı uzak bir bölgede olduğundan (her gidiş-dönüş yüzlerce ms) iki ayrı sorgu yerine
 * onaylar alt sorguyla JSON olarak aynı satırda döner. Her iki erişim de indeksli (users.id, consents.user_id).
 * Kullanıcı yoksa veya pasifse null.
 */
export async function getProfileDetails(id: string): Promise<ProfileDetails | null> {
  const [u] = await withReadRetry(() => db()<(Omit<UserRow, "password_hash"> & { created_at: Date; consents: ConsentRecord[]; health: Parameters<typeof toHealthData>[0] | null })[]>`
    select
      u.id, u.email, u.full_name, u.role, u.profession, u.specialty, u.institution,
      u.verification_status, u.is_active, u.avatar_url, u.created_at,
      coalesce((
        select json_agg(json_build_object('kind', c.kind, 'version', c.version, 'acceptedAt', c.accepted_at) order by c.kind)
        from (
          select distinct on (kind) kind, version, accepted_at
          from app.consents
          where user_id = u.id
          order by kind, accepted_at desc
        ) c
      ), '[]'::json) as consents,
      (select row_to_json(h) from (select ${db().unsafe(HEALTH_COLUMNS)} from app.patient_health_data where user_id = u.id) h) as health
    from app.users u
    where u.id = ${id} and u.is_active
  `);
  if (!u) return null;
  return {
    ...toProfile(u),
    id: u.id,
    isActive: u.is_active,
    createdAt: u.created_at.toISOString(),
    consents: u.consents.map((c) => ({ ...c, acceptedAt: new Date(c.acceptedAt).toISOString() })),
    health: u.health ? toHealthData(u.health) : null,
  };
}

/* ───────────────────────── Profil fotoğrafı ───────────────────────── */

export type AvatarMime = "image/jpeg" | "image/png" | "image/webp";

/** Görseli kaydeder ve users.avatar_url'i yeni sürümle günceller (tarayıcı önbelleği sürümle kırılır). */
export async function saveAvatar(userId: string, mime: AvatarMime, data: Uint8Array) {
  return db().begin(async (tx) => {
    const [row] = await tx<{ updated_at: Date }[]>`
      insert into app.user_avatars (user_id, mime, data, updated_at)
      values (${userId}, ${mime}, ${data}, now())
      on conflict (user_id) do update set mime = excluded.mime, data = excluded.data, updated_at = excluded.updated_at
      returning updated_at
    `;
    const url = `/api/user/avatar?v=${row.updated_at.getTime().toString(36)}`;
    await tx`update app.users set avatar_url = ${url} where id = ${userId}`;
    return url;
  });
}

export async function getAvatar(userId: string) {
  const [row] = await withReadRetry(() => db()<{ mime: AvatarMime; data: Buffer; updated_at: Date }[]>`
    select a.mime, a.data, a.updated_at
    from app.user_avatars a
    join app.users u on u.id = a.user_id and u.is_active
    where a.user_id = ${userId}
  `);
  return row ?? null;
}

export async function deleteAvatar(userId: string) {
  await db().begin(async (tx) => {
    await tx`delete from app.user_avatars where user_id = ${userId}`;
    await tx`update app.users set avatar_url = null where id = ${userId}`;
  });
}
