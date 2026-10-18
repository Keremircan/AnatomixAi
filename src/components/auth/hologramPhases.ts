import type { AnatomyLayer } from "@/lib/layers";

/**
 * Giriş ekranı hologramında sırayla belirip kaybolan katmanlar. Deri bilinçli olarak yoktur:
 * hologram iç yapıları gösterir. Dosyalar ana uygulamadakilerle aynıdır (mobil LOD, ~2 MB toplam).
 */
export const HOLOGRAM_PHASES: { id: string; label: string; files: AnatomyLayer[]; color: string }[] = [
  { id: "skeleton", label: "İskelet", files: ["skeletal"], color: "#67e8f9" },
  { id: "vessels", label: "Dolaşım", files: ["circulatory"], color: "#fb7185" },
  { id: "organs", label: "İç Organlar", files: ["respiratory", "digestive", "urinary", "endocrine"], color: "#5eead4" },
];

/** Bir katmanın ekranda kaldığı süre ve geçiş (çapraz solma) süresi, saniye. */
export const PHASE_SECONDS = 5.5;
export const FADE_SECONDS = 1.6;
