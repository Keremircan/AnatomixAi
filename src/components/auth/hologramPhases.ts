import type { AnatomyLayer } from "@/lib/layers";

/**
 * Giriş ekranı hologramında sırayla belirip kaybolan katmanlar. Deri bilinçli olarak yoktur:
 * hologram iç yapıları gösterir. Dosyalar ana uygulamadakilerle aynıdır (mobil LOD, ~2 MB toplam).
 */
export const HOLOGRAM_PHASES: { id: string; label: string; files: AnatomyLayer[]; color: string; colorLight: string }[] = [
  { id: "skeleton", label: "İskelet", files: ["skeletal"], color: "#67e8f9", colorLight: "#0e7490" },
  { id: "vessels", label: "Dolaşım", files: ["circulatory"], color: "#fb7185", colorLight: "#be123c" },
  { id: "organs", label: "İç Organlar", files: ["respiratory", "digestive", "urinary", "endocrine"], color: "#5eead4", colorLight: "#0f766e" },
];

/** Bir katmanın ekranda kaldığı süre ve geçiş (çapraz solma) süresi, saniye. */
export const PHASE_SECONDS = 5.5;
export const FADE_SECONDS = 1.6;
