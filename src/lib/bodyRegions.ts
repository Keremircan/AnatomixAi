import { layerOfMesh, type AnatomyLayer } from "@/lib/layers";

/**
 * Şikayet bölgeleri kataloğu: metinden bölge çıkarımı, bölgedeki anatomik yapıların listesi (3B modeldeki
 * gerçek mesh kimlikleriyle), bölgeye özel kırmızı bayrak takip sorusu ve sonuç sayfasındaki 2B harita konumu.
 * Çift organlarda (diz, omuz …) mesh kimliğindeki "{s}" yerine taraf (R / L) yazılır.
 */

export type Side = "R" | "L";
export type RegionBase =
  | "head" | "neck" | "throat" | "chest" | "upper_back" | "upper_abdomen" | "lower_abdomen" | "lower_back"
  | "shoulder" | "wrist" | "hip" | "knee" | "ankle";

/** Takip sorusu "evet" yanıtlanırsa seviye en az bu düzeye çıkar. */
export type RedFlagQuestion = { q: string; flag: string; reason: string; escalate: "critical" | "urgent" };

type RegionDef = {
  name: string;
  /** Metinde bölgeyi işaret eden ifade (normalleştirilmiş, küçük harfli metin üzerinde) */
  re: RegExp;
  paired?: boolean;
  /** [mesh kimliği, Türkçe ad] */
  structures: [string, string][];
  redFlag: RedFlagQuestion;
  /** 2B vücut haritasında konum (önden / arkadan; çift organlarda sağ taraf, sol ayna görüntüsü) */
  map: { view: "front" | "back"; x: number; y: number };
};

/** Sıra önemlidir: daha özel ifadeler (ayak bileği, üst karın) genel olanlardan (bilek, karın) önce denenir. */
export const REGIONS: Record<RegionBase, RegionDef> = {
  head: {
    name: "Baş",
    re: /(^|\s)baş(ım|ı|ta|ımda|ımın)?\s*(\S+\s)?(ağr|dön|zonk)|kafa|migren|şakak/u,
    structures: [["SKL.frontal_bone.C", "Alın kemiği"], ["SKL.parietal_bone.R", "Yan kafa kemiği"], ["SKL.occipital_bone.C", "Art kafa kemiği"], ["NRV.angular_gyrus.R", "Beyin kabuğu (korteks)"]],
    redFlag: { q: "Hayatınızın en şiddetli, aniden başlayan baş ağrısı mı?", flag: "Ani ve çok şiddetli baş ağrısı", reason: "Aniden başlayan, hayatın en şiddetli baş ağrısı beyin kanaması belirtisi olabilir.", escalate: "critical" },
    map: { view: "front", x: 110, y: 46 },
  },
  throat: {
    name: "Boğaz",
    re: /boğaz|yutkun|bademcik/u,
    structures: [["LYM.palatine_tonsil.R", "Bademcik"], ["DIG.oropharynx.C", "Yutak"], ["RES.trachea.C", "Soluk borusu"], ["END.thyroid_gland.C", "Tiroid bezi"]],
    redFlag: { q: "Nefes almakta güçlük, salya akması ya da ağzınızı açamama var mı?", flag: "Hava yolu daralması belirtisi", reason: "Nefes güçlüğü, salya akması veya ağız açamama hava yolunun daraldığını gösterebilir.", escalate: "critical" },
    map: { view: "front", x: 110, y: 88 },
  },
  neck: {
    name: "Boyun",
    re: /boyn|boyun|ense/u,
    structures: [["SKL.vertebra_c5.C", "Boyun omurları"], ["MUS.descending_part_of_trapezius_muscle.R", "Trapez kası"], ["MUS.sternocleidomastoid_muscle.R", "Göğüs-köprücük-meme kası"], ["CRD.right_common_carotid_artery.C", "Şah damarı"]],
    redFlag: { q: "Ateşle birlikte ense sertliği (çeneyi göğse değdirememe) var mı?", flag: "Ateşle birlikte ense sertliği", reason: "Ateşle birlikte ense sertliği beyin zarı iltihabı (menenjit) belirtisi olabilir.", escalate: "critical" },
    map: { view: "back", x: 110, y: 86 },
  },
  chest: {
    name: "Göğüs",
    re: /göğs|göğüs/u,
    structures: [["CRD.left_ventricle.C", "Kalp (sol karıncık)"], ["RES.superior_lobe_of_left_lung.C", "Akciğer"], ["SKL.body_of_sternum.C", "Göğüs kemiği"], ["MUS.sternocostal_head_of_pectoralis_major_muscle.R", "Büyük göğüs kası"]],
    redFlag: { q: "Ağrı kola, çeneye veya sırta yayılıyor ya da terleme eşlik ediyor mu?", flag: "Yayılan göğüs ağrısı", reason: "Kola, çeneye veya sırta yayılan göğüs ağrısı kalp krizi belirtisi olabilir.", escalate: "critical" },
    map: { view: "front", x: 110, y: 128 },
  },
  upper_back: {
    name: "Sırt",
    re: /sırt|kürek kemi/u,
    structures: [["SKL.vertebra_t5.C", "Sırt omurları"], ["MUS.rhomboid_major_muscle.R", "Rhomboid kas"], ["SKL.scapula.R", "Kürek kemiği"], ["MUS.longissimus_thoracis_muscle.R", "Sırt kasları"]],
    redFlag: { q: "Ağrıya nefes darlığı veya soğuk terleme eşlik ediyor mu?", flag: "Nefes darlığı veya terlemeyle sırt ağrısı", reason: "Nefes darlığı veya soğuk terlemeyle gelen sırt ağrısı kalp ya da büyük damar kaynaklı olabilir.", escalate: "critical" },
    map: { view: "back", x: 110, y: 132 },
  },
  upper_abdomen: {
    name: "Üst karın",
    re: /mide|üst karın|hazımsız|reflü|ekşime|midem/u,
    structures: [["DIG.stomach.C", "Mide"], ["DIG.liver.C", "Karaciğer"], ["DIG.pancreas.C", "Pankreas"], ["DIG.gallbladder.C", "Safra kesesi"]],
    redFlag: { q: "Kanlı ya da kahve telvesi gibi kusma veya siyah dışkı oldu mu?", flag: "Sindirim kanalı kanaması belirtisi", reason: "Kanlı kusma veya siyah dışkı iç kanama belirtisi olabilir.", escalate: "critical" },
    map: { view: "front", x: 110, y: 170 },
  },
  lower_abdomen: {
    name: "Alt karın",
    re: /alt karın|kasık|karın|karn|apandis|şişkinlik|kabız|ishal/u,
    structures: [["DIG.vermiform_appendix.C", "Apandis"], ["DIG.jejunum.C", "İnce bağırsak"], ["DIG.sigmoid_colon.C", "Kalın bağırsak"], ["URI.urinary_bladder.C", "Mesane"]],
    redFlag: { q: "Karnınız tahta gibi sert mi ya da ağrı dokunmakla çok artıyor mu?", flag: "Karın sertliği", reason: "Karın sertliği ve dokunmakla artan ağrı karın zarı iltihabını düşündürebilir.", escalate: "urgent" },
    map: { view: "front", x: 110, y: 214 },
  },
  lower_back: {
    name: "Bel",
    re: /(^|\s)bel(im|de|imde|imin|ime|imden)?(\s|$|[.,])|bel fıtığı|kuyruk sokumu/u,
    structures: [["SKL.vertebra_l4.C", "Bel omurları"], ["JNT.intervertebral_disc_l4_l5.C", "L4–L5 omurlar arası disk"], ["MUS.iliocostalis_lumborum_muscle.R", "Bel kasları"], ["URI.kidney.R", "Böbrek"], ["NRV.sciatic_nerve.R", "Siyatik sinir"]],
    redFlag: { q: "Bacaklarda güçsüzlük, kasıkta uyuşma ya da idrar/dışkı kontrolünde değişiklik var mı?", flag: "Sinir basısı bulguları", reason: "Bacak güçsüzlüğü ve idrar/dışkı kontrol kaybı omurilik siniri basısını (kauda ekina) düşündürebilir.", escalate: "critical" },
    map: { view: "back", x: 110, y: 206 },
  },
  shoulder: {
    name: "Omuz",
    re: /omuz/u,
    paired: true,
    structures: [["SKL.humerus.{s}", "Pazu kemiği başı"], ["SKL.clavicle.{s}", "Köprücük kemiği"], ["MUS.supraspinatus_muscle.{s}", "Rotator manşet (supraspinatus)"], ["MUS.acromial_part_of_deltoid_muscle.{s}", "Deltoid kas"]],
    redFlag: { q: "Omuz ağrısıyla birlikte göğüs ağrısı veya nefes darlığı var mı?", flag: "Göğüs ağrısıyla omuz ağrısı", reason: "Göğüs ağrısı veya nefes darlığıyla gelen omuz ağrısı kalp kaynaklı olabilir.", escalate: "critical" },
    map: { view: "front", x: 74, y: 104 },
  },
  wrist: {
    name: "El bileği",
    re: /el bile|bileğ|parmak|avuç/u,
    paired: true,
    structures: [["SKL.radius.{s}", "Önkol kemiği (radius)"], ["SKL.scaphoid_bone.{s}", "Kayık kemiği"], ["SKL.third_metacarpal_bone.{s}", "El tarağı kemikleri"]],
    redFlag: { q: "Bilekte belirgin şekil bozukluğu, morarma ya da parmaklarda uyuşma var mı?", flag: "Kırık / dolaşım bozukluğu şüphesi", reason: "Şekil bozukluğu veya parmaklarda uyuşma kırık ya da dolaşım bozukluğunu düşündürür.", escalate: "urgent" },
    map: { view: "front", x: 50, y: 244 },
  },
  hip: {
    name: "Kalça",
    re: /kalça/u,
    paired: true,
    structures: [["SKL.hip_bone.{s}", "Kalça kemiği"], ["SKL.femur.{s}", "Uyluk kemiği başı"], ["MUS.gluteus_maximus_muscle.{s}", "Büyük kalça kası"]],
    redFlag: { q: "Düşme sonrası bacağınıza hiç yük veremiyor musunuz?", flag: "Yük verememe", reason: "Düşme sonrası bacağa yük verememe kalça kırığını düşündürür.", escalate: "urgent" },
    map: { view: "front", x: 88, y: 252 },
  },
  knee: {
    name: "Diz",
    re: /diz/u,
    paired: true,
    structures: [["SKL.patella.{s}", "Diz kapağı"], ["JNT.medial_meniscus.{s}", "İç menisküs"], ["JNT.anterior_cruciate_ligament.{s}", "Ön çapraz bağ"], ["SKL.tibia.{s}", "Kaval kemiği üst ucu"], ["MUS.rectus_femoris_muscle.{s}", "Ön uyluk kası"]],
    redFlag: { q: "Dizde ani şişlik ve kızarıklıkla birlikte ateş var mı?", flag: "Ateşli eklem şişliği", reason: "Ateşle birlikte ani eklem şişliği eklem iltihabını (septik artrit) düşündürür.", escalate: "urgent" },
    map: { view: "front", x: 91, y: 345 },
  },
  ankle: {
    name: "Ayak bileği",
    re: /ayak bile|topuk|ayağım|ayak tab|ayakta ağrı/u,
    paired: true,
    structures: [["SKL.talus.{s}", "Aşık kemiği"], ["SKL.fibula.{s}", "Dış topuk kemiği (fibula)"], ["SKL.calcaneus.{s}", "Topuk kemiği"], ["MUS.calcaneal_tendon.{s}", "Aşil tendonu"]],
    redFlag: { q: "Ayağınıza hiç basamıyor musunuz ya da belirgin şekil bozukluğu var mı?", flag: "Yük verememe / şekil bozukluğu", reason: "Hiç basamama veya şekil bozukluğu kırık şüphesi taşır (Ottawa kuralları).", escalate: "urgent" },
    map: { view: "front", x: 89, y: 425 },
  },
};

/** Metinde aranma sırası (özelden genele). */
export const REGION_ORDER: RegionBase[] = [
  "ankle", "wrist", "knee", "hip", "shoulder", "head", "throat", "neck", "chest", "upper_abdomen", "lower_abdomen", "lower_back", "upper_back",
];

export type RegionStructure = { meshId: string; label: string; layer: AnatomyLayer };

export type RegionHit = {
  /** "knee.R", "chest" … */
  id: string;
  base: RegionBase;
  side: Side | null;
  /** "Sağ diz" */
  name: string;
  /** Çift organda taraf metinde belirtilmedi; 3B modelde sağ taraf varsayıldı. */
  sideAssumed: boolean;
  structures: RegionStructure[];
};

const SIDE_NAME: Record<Side, string> = { R: "Sağ", L: "Sol" };

export function regionHit(base: RegionBase, side: Side | null): RegionHit {
  const def = REGIONS[base];
  const s = def.paired ? (side ?? "R") : null;
  const structures = def.structures.flatMap(([id, label]) => {
    const meshId = s ? id.replace("{s}", s) : id;
    const layer = layerOfMesh(meshId);
    return layer ? [{ meshId, label, layer }] : [];
  });
  return {
    id: s ? `${base}.${s}` : base,
    base,
    side: s,
    name: s && side ? `${SIDE_NAME[s]} ${def.name.toLocaleLowerCase("tr-TR")}` : def.name,
    sideAssumed: !!def.paired && !side,
    structures,
  };
}

/** 2B harita konumu; sol taraf, sağ tarafın ayna görüntüsüdür. */
export function regionMapPoint(hit: RegionHit) {
  const { view, x, y } = REGIONS[hit.base].map;
  return { view, x: hit.side === "L" ? 220 - x : x, y };
}
