/**
 * Arayüzdeki anatomik sistemler; her biri public/models altındaki tek bir .glb dosyasıdır (SRS §3.3).
 * Sayılar ve boyutlar public/models/manifest.json'dan alınmıştır. Sıra hem paneldeki listeyi
 * hem de "Yan yana" modunda figürlerin soldan sağa dizilişini belirler.
 */
export const LAYER_IDS = [
  "skin", "skeletal", "joints", "muscular", "circulatory", "lymphatic",
  "nervous", "digestive", "respiratory", "urinary", "genital", "endocrine",
] as const;
export type AnatomyLayer = (typeof LAYER_IDS)[number];

export type Lod = "desktop" | "mobile";

export type LayerDef = {
  id: AnatomyLayer;
  label: string;
  /** Kısa ad (dar ekran ve figür başlıkları) */
  short: string;
  /** Aktif rozet rengi; modeldeki malzeme rengine yakın */
  color: string;
  /** Dosyadaki yapı (mesh) sayısı */
  count: number;
  /** Sıkıştırılmış dosya boyutu (bayt) */
  bytes: Record<Lod, number>;
};

export const LAYERS: LayerDef[] = [
  { id: "skin", label: "Deri / Yüzey", short: "Deri", color: "#dba88c", count: 260, bytes: { desktop: 748520, mobile: 460748 } },
  { id: "skeletal", label: "İskelet", short: "İskelet", color: "#e8decb", count: 277, bytes: { desktop: 1262720, mobile: 584964 } },
  { id: "joints", label: "Eklem ve Bağlar", short: "Eklem", color: "#a8ccdb", count: 409, bytes: { desktop: 881408, mobile: 576960 } },
  { id: "muscular", label: "Kas", short: "Kas", color: "#b8332e", count: 669, bytes: { desktop: 2208228, mobile: 1138996 } },
  { id: "circulatory", label: "Dolaşım (Damar)", short: "Dolaşım", color: "#c81a1a", count: 676, bytes: { desktop: 1691132, mobile: 999912 } },
  { id: "lymphatic", label: "Lenfatik", short: "Lenf", color: "#73b359", count: 158, bytes: { desktop: 394800, mobile: 254424 } },
  { id: "nervous", label: "Sinir ve Duyu", short: "Sinir", color: "#f2cc40", count: 580, bytes: { desktop: 1695228, mobile: 993872 } },
  { id: "digestive", label: "Sindirim", short: "Sindirim", color: "#d98580", count: 49, bytes: { desktop: 433752, mobile: 174600 } },
  { id: "respiratory", label: "Solunum", short: "Solunum", color: "#eb9ea6", count: 37, bytes: { desktop: 294900, mobile: 122692 } },
  { id: "urinary", label: "Üriner", short: "Üriner", color: "#8c3833", count: 8, bytes: { desktop: 54296, mobile: 43932 } },
  { id: "genital", label: "Üreme", short: "Üreme", color: "#d18c99", count: 14, bytes: { desktop: 56352, mobile: 46416 } },
  { id: "endocrine", label: "Endokrin", short: "Endokrin", color: "#cc8c4d", count: 10, bytes: { desktop: 52272, mobile: 39316 } },
];

export const layerDef = (id: AnatomyLayer) => LAYERS.find((l) => l.id === id)!;

const PREFIX_LAYER: Record<string, AnatomyLayer> = {
  SKN: "skin", SKL: "skeletal", JNT: "joints", MUS: "muscular", CRD: "circulatory", LYM: "lymphatic",
  NRV: "nervous", DIG: "digestive", RES: "respiratory", URI: "urinary", GEN: "genital", END: "endocrine",
};
/** "JNT.medial_meniscus.R" → "joints" */
export const layerOfMesh = (meshId: string): AnatomyLayer | undefined => PREFIX_LAYER[meshId.split(".")[0]];

export const modelUrl = (lod: Lod, layer: AnatomyLayer) => `/models/${lod}/${layer}.glb`;
export const MANIFEST_URL = "/models/manifest.json";
export const DRACO_PATH = "/draco/";

export function pickLod(): Lod {
  return window.matchMedia("(max-width: 767px), (pointer: coarse)").matches ? "mobile" : "desktop";
}

/** "0,7 MB" */
export const formatMB = (bytes: number) => `${(bytes / 1e6).toLocaleString("tr-TR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} MB`;

/** Model koordinatları metre, Y yukarı; vücut yaklaşık y = -0,14 … 1,71, kollar dahil genişlik ≈ 0,68 m. */
export const BODY = { floorY: -0.14, topY: 1.72, centerY: 0.78, width: 0.68 };

/** "Yan yana" modunda figürler arası mesafe (metre). */
export const FIGURE_SPACING = BODY.width * 1.3;

/** Görünür katmanların X konumları (yan yana modunda ortalanmış). */
export function figureOffsets(visible: AnatomyLayer[], mode: "stacked" | "sideBySide") {
  const ordered = LAYER_IDS.filter((id) => visible.includes(id));
  return new Map(ordered.map((id, i) => [id, mode === "sideBySide" ? (i - (ordered.length - 1) / 2) * FIGURE_SPACING : 0]));
}

export const SIDE_TR: Record<string, string> = { L: "Sol", R: "Sağ", C: "Orta hat" };

/** "MUS.quadriceps_femoris.R" → { label: "Quadriceps femoris", side: "Sağ", code } */
export function describeMesh(name: string, label?: string) {
  const [, raw = name, side] = name.split(".");
  const fallback = raw.replace(/_/g, " ");
  return {
    code: name,
    label: label ?? fallback.charAt(0).toUpperCase() + fallback.slice(1),
    side: side ? SIDE_TR[side] : undefined,
  };
}
