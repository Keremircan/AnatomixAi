import type { ProfileDetails } from "@/lib/auth";

/**
 * Profil sayfası için bellek içi önbellek (stale-while-revalidate): sayfaya tekrar girildiğinde son bilinen
 * profil anında gösterilir, arka planda sunucudan tazelenir. Kullanıcı kimliğine bağlıdır ve çıkışta silinir;
 * tarayıcı depolamasına yazılmaz.
 */
let cached: ProfileDetails | null = null;

export function getCachedProfile(userId: string | undefined) {
  return userId && cached?.id === userId ? cached : null;
}

export function setCachedProfile(profile: ProfileDetails) {
  cached = profile;
}

export function clearProfileCache() {
  cached = null;
}
