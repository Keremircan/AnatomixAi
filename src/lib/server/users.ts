import "server-only";
import { db } from "./db";
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
};

const COLUMNS = "id, email, password_hash, full_name, role, profession, specialty, institution, verification_status, is_active";

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
  };
}

export async function findUserByEmail(email: string) {
  const [u] = await db()<UserRow[]>`select ${db().unsafe(COLUMNS)} from app.users where email = ${email}`;
  return u ?? null;
}

export async function findActiveUserById(id: string) {
  const [u] = await db()<UserRow[]>`select ${db().unsafe(COLUMNS)} from app.users where id = ${id} and is_active`;
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

/** Profil sayfası için kullanıcı ayrıntıları ve her onay türünün en güncel kaydı. Kullanıcı yoksa/pasifse null. */
export async function getProfileDetails(id: string): Promise<ProfileDetails | null> {
  const sql = db();
  const [u] = await sql<(Omit<UserRow, "password_hash"> & { created_at: Date })[]>`
    select id, email, full_name, role, profession, specialty, institution, verification_status, is_active, created_at
    from app.users
    where id = ${id} and is_active
  `;
  if (!u) return null;
  const consents = await sql<{ kind: ConsentRecord["kind"]; version: string; accepted_at: Date }[]>`
    select distinct on (kind) kind, version, accepted_at
    from app.consents
    where user_id = ${id}
    order by kind, accepted_at desc
  `;
  return {
    ...toProfile(u),
    id: u.id,
    isActive: u.is_active,
    createdAt: u.created_at.toISOString(),
    consents: consents.map<ConsentRecord>((c) => ({ kind: c.kind, version: c.version, acceptedAt: c.accepted_at.toISOString() })),
  };
}
