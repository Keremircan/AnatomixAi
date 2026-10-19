/**
 * Semptom metni için kural tabanlı, 4 seviyeli triyaj simülasyonu (mock).
 * Gerçek sistemde bu adım LLM çıkarımı + sözlük eşleme + klinik onaylı kural tabanı ile yapılır (SRS §4).
 * Kurallar aciliyet sırasıyla değerlendirilir: kritik → öncelikli → evde bakım → rutin.
 * Böylece bir metin hem acil hem rutin kalıba uyuyorsa her zaman daha acil seviye kazanır.
 */

import { REGION_ORDER, REGIONS, regionHit, type RedFlagQuestion, type RegionBase, type RegionHit } from "./bodyRegions";

export type TriageLevel = "critical" | "urgent" | "routine" | "self_care";

export type Stretch = { name: string; dose: string; detail: string };

export type AnalysisResult = {
  triageLevel: TriageLevel;
  /** Örn: "Sağ Diz Eklemi" */
  primaryRegion: string;
  /** 3B modelde vurgulanacak mesh adı (manifest kimliği, ör. "JNT.medial_meniscus.R"); bölge belirsizse null */
  meshIdToHighlight: string | null;
  department: string;
  possibleConditions: string[];
  /** Evde bakım (self_care) seviyesinde gösterilen genel öneriler */
  supportiveAdvice: string[];
  /** Öncelikli seviyede: başvuruya kadar geçici ilk yardım */
  firstAid?: string[];
  /** Rutin seviyede: hekim randevusuna giderken dikkat edilecekler */
  visitPrep?: string[];
  /** Evde bakım seviyesinde: ergonomi/duruş ve güvenli esneme */
  ergonomics?: string[];
  stretches?: Stretch[];
  /** Şu belirtiler olursa beklemeden başvurun */
  warningSigns: string[];
  /** Yalnızca sağlık profesyoneli rolünde gösterilir */
  clinicalNotes?: string;
  isRedFlag: boolean;
  redFlagReason?: string;
  /** Tetikleyen kural kimliği (denetim kaydı için) */
  ruleId: string;
};

/**
 * Seviye başına sabit arayüz ve klinik eşdeğerlik bilgisi.
 * T1 Acil · T2 Öncelikli (bugün içinde) · T3 Poliklinik · T4 Evde izlem.
 */
export const TRIAGE_LEVELS: Record<
  TriageLevel,
  { rank: 1 | 2 | 3 | 4; code: string; label: string; badge: string; timeframe: string; action: string; esi: string; mts: string; mtsTarget: string }
> = {
  critical: {
    rank: 1, code: "T1", label: "Acil", badge: "Kırmızı bayrak", timeframe: "Hemen",
    action: "Hemen 112’yi arayın veya en yakın acil servise gidin.",
    esi: "ESI 1–2", mts: "Kırmızı", mtsTarget: "Anında (0 dk)",
  },
  urgent: {
    rank: 2, code: "T2", label: "Öncelikli", badge: "Bugün içinde", timeframe: "Bugün içinde (24 saat)",
    action: "Beklemeyin: bugün içinde acil servise ya da aile hekiminize başvurun.",
    esi: "ESI 3", mts: "Sarı", mtsTarget: "≤ 60 dk",
  },
  routine: {
    rank: 3, code: "T3", label: "Poliklinik", badge: "Randevu ile muayene", timeframe: "1–2 hafta içinde",
    action: "Önerilen poliklinikten randevu alarak muayene olun.",
    esi: "ESI 4", mts: "Yeşil", mtsTarget: "≤ 120 dk",
  },
  self_care: {
    rank: 4, code: "T4", label: "Evde izlem", badge: "Evde bakım", timeframe: "Şikayet 1 haftada geçmezse",
    action: "Evde izlem uygun görünüyor. Aşağıdaki belirtilerden biri olursa doktora başvurun.",
    esi: "ESI 5", mts: "Mavi", mtsTarget: "≤ 240 dk",
  },
};
export const LEVEL_BY_RANK: Record<1 | 2 | 3 | 4, TriageLevel> = { 1: "critical", 2: "urgent", 3: "routine", 4: "self_care" };

const norm = (s: string) => s.toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();

/** Eşleşmenin hemen ardından gelen olumsuzluk ("göğüs ağrım yok") — bu durumda kural tetiklenmez. */
const NEGATION = /^[^.,;!?]{0,24}?\b(yok|değil|olmadı|hissetmiyorum|geçti)\b/u;
function positiveMatch(text: string, re: RegExp) {
  const m = re.exec(text);
  if (!m || NEGATION.test(text.slice(m.index + m[0].length))) return null;
  return m;
}

type Side = "R" | "L" | null;
const SIDE_NAME = { R: "Sağ", L: "Sol" } as const;

/** Anahtar kelimenin hemen öncesindeki "sağ / sol" ifadesi. */
function sideBefore(text: string, idx: number): Side {
  const before = text.slice(Math.max(0, idx - 16), idx);
  // \b Türkçe karakterlerde (ğ) çalışmadığı için kelime başı boşlukla aranır.
  return /(^|\s)sol/u.test(before) ? "L" : /(^|\s)sağ/u.test(before) ? "R" : null;
}
const sidePrefix = (side: Side) => (side ? `${SIDE_NAME[side]} ` : "");

type Built = Omit<AnalysisResult, "isRedFlag" | "ruleId" | "triageLevel">;
type Rule = { id: string; level: TriageLevel; re: RegExp; unless?: RegExp; build: (side: Side, text: string) => Built };

const EMPTY = { possibleConditions: [], supportiveAdvice: [], warningSigns: [] } satisfies Partial<Built>;

/* ───────────────────────── T1 · Kritik ───────────────────────── */

type Critical = { id: string; re: RegExp; reason: string; region: string; meshId: string | null };

const CRITICAL: Critical[] = [
  { id: "RF-01", re: /göğ(üs|s)\S*\s*(\S+\s){0,2}?(ağr|sıkış|bask|yan)/u, reason: "Göğüs ağrısı veya sıkışma hissi kalp kaynaklı olabilir ve acil değerlendirme gerektirir.", region: "Göğüs / Kalp", meshId: "CRD.left_ventricle.C" },
  { id: "RF-02", re: /sol kol\S*\s*(\S+\s){0,2}?(yayıl|vur|uyuş|ağr|karınc)/u, reason: "Sol kola yayılan ağrı veya uyuşma kalp krizi belirtisi olabilir.", region: "Göğüs / Kalp", meshId: "CRD.left_ventricle.C" },
  { id: "RF-03", re: /nefes (darlığı|alamı|almakta zorlan)|soluk(suz| alamı)/u, reason: "Nefes darlığı acil müdahale gerektirebilir.", region: "Akciğerler / Solunum", meshId: "RES.inferior_lobe_of_left_lung.C" },
  { id: "RF-04", re: /bayıl|bilinç (kaybı|bulanık|kayb)|kendimden geç/u, reason: "Bayılma veya bilinç kaybı acil değerlendirme gerektirir.", region: "Beyin / Sinir Sistemi", meshId: null },
  { id: "RF-11", re: /kafa travma|(şiddetli|sert|ciddi)\s+(\S+\s)?(kafa|baş)\S*\s*(\S+\s)?(travma|darbe|çarp|vur)|(kafa|baş)\S* (\S+\s){0,2}?(sert|şiddetli)\S* (çarp|vur)/u, reason: "Şiddetli kafa travması beyin kanaması riski taşır; acil görüntüleme gerekebilir.", region: "Baş / Kafatası", meshId: "SKL.frontal_bone.C" },
  { id: "RF-05", re: /yüz\S* kay|konuşma\S* bozul|konuşamı|tek taraf\S* güçsüz|ağzım kay/u, reason: "Yüzde kayma, konuşma bozukluğu veya tek taraflı güçsüzlük inme belirtisi olabilir.", region: "Beyin / Sinir Sistemi", meshId: null },
  { id: "RF-06", re: /ani\S*\s.*(şiddetli|en kötü|dayanılmaz).*baş/u, reason: "Ani başlayan çok şiddetli baş ağrısı acil değerlendirme gerektirir.", region: "Baş", meshId: null },
  { id: "RF-07", re: /kan kus|siyah dışkı|katran (gibi|renkli)/u, reason: "Kan kusma veya siyah dışkı iç kanama belirtisi olabilir.", region: "Mide / Sindirim", meshId: "DIG.stomach.C" },
  { id: "RF-08", re: /ense\S* sert/u, reason: "Ateşle birlikte ense sertliği acil değerlendirme gerektirir.", region: "Boyun", meshId: "SKL.vertebra_c4.C" },
  { id: "RF-09", re: /(dil|dudak|boğaz)\S*\s*(\S+\s)?şiş/u, reason: "Dil, dudak veya boğazda şişme hava yolunu tıkayabilir.", region: "Boğaz / Hava yolu", meshId: "RES.trachea.C" },
  { id: "RF-10", re: /intihar|kendime zarar|yaşamak istemiyorum/u, reason: "Kendinize zarar verme düşünceleri için hemen destek alın.", region: "Ruh sağlığı", meshId: null },
];

/* ───────────────────────── T2 · Öncelikli ───────────────────────── */

/** Kırık/çıkık şüphesinde anahtar kelimeye göre kemik eşlemesi. */
const BONE_SITES: { re: RegExp; region: string; mesh: (s: "R" | "L") => string }[] = [
  { re: /ayak bile|topuk/u, region: "Ayak bileği", mesh: (s) => `SKL.talus.${s}` },
  { re: /el bile|bileğ/u, region: "El bileği", mesh: (s) => `SKL.radius.${s}` },
  { re: /diz/u, region: "Diz", mesh: (s) => `SKL.patella.${s}` },
  { re: /omuz/u, region: "Omuz", mesh: (s) => `SKL.humerus.${s}` },
  { re: /köprücük/u, region: "Köprücük kemiği", mesh: (s) => `SKL.clavicle.${s}` },
  { re: /kol/u, region: "Kol", mesh: (s) => `SKL.humerus.${s}` },
  { re: /uyluk|kalça/u, region: "Uyluk / Kalça", mesh: (s) => `SKL.femur.${s}` },
  { re: /bacak|kaval/u, region: "Bacak", mesh: (s) => `SKL.tibia.${s}` },
];

const URGENT: Rule[] = [
  {
    id: "UR-FX",
    level: "urgent",
    re: /kırık|kırıl|kırdım|çıkık|çıktı|yerinden oyna|deformasyon|şekli bozul|yamuldu|ters döndü/u,
    build: (_side, text) => {
      const site = BONE_SITES.find((b) => b.re.test(text));
      const m = site ? site.re.exec(text) : null;
      const side = m ? sideBefore(text, m.index) : null;
      return {
        ...EMPTY,
        primaryRegion: site ? `${sidePrefix(side)}${site.region}${side ? "" : " (taraf belirtilmedi)"}` : "Kırık / çıkık şüphesi",
        meshIdToHighlight: site ? site.mesh(side ?? "R") : null,
        department: "Acil Servis · Ortopedi ve Travmatoloji",
        possibleConditions: ["Kırık", "Eklem çıkığı", "Ciddi bağ yaralanması"],
        firstAid: [
          "Yaralı bölgeyi hareket ettirmeyin; bulduğunuz düz bir malzemeyle sabitleyin.",
          "Kemiği veya eklemi yerine oturtmaya çalışmayın.",
          "Şişliği azaltmak için bez sarılı buz uygulayın, bölgeyi kalp seviyesinin üstünde tutun.",
          "Ameliyat gerekebileceği için başvuruya kadar bir şey yiyip içmeyin.",
        ],
        warningSigns: ["Kemiğin deriden dışarı çıkması (açık kırık)", "Uzuvda uyuşma, soğukluk veya morarma", "Kontrol edilemeyen kanama"],
        clinicalNotes: "ICD-10 ön değerlendirme: T14.2 (bölgesi belirtilmemiş kırık), T14.3 (çıkık). Nörovasküler muayene, Ottawa kuralları (diz/ayak bileği) ve iki yönlü direkt grafi önerilir.",
      };
    },
  },
  {
    id: "UR-ABD",
    level: "urgent",
    re: /(şiddetli|geçmeyen|dayanılmaz|çok kötü|çok şiddetli)\s+(\S+\s){0,2}?karın\S*\s*ağr|karın\S*\s*ağrı\S*\s+(\S+\s){0,2}?(geçmiyor|şiddetli|dayanılmaz|artıyor)|sağ alt karn/u,
    build: () => ({
      ...EMPTY,
      primaryRegion: "Karın · sağ alt kadran",
      meshIdToHighlight: "DIG.vermiform_appendix.C",
      department: "Acil Servis · Genel Cerrahi",
      possibleConditions: ["Akut apandisit", "Böbrek taşı (renal kolik)", "Bağırsak tıkanıklığı"],
      firstAid: [
        "Ağrı kesici, müshil veya lavman kullanmayın; muayene bulgularını maskeleyebilir.",
        "Başvuruya kadar bir şey yiyip içmeyin.",
        "Karnınıza sıcak uygulama yapmayın.",
      ],
      warningSigns: ["Ateşin 38 °C üzerine çıkması", "Karın sertliği veya dokunmakla artan şiddetli ağrı", "Kusmanın durmaması veya kanlı kusma"],
      clinicalNotes: "ICD-10 ön değerlendirme: R10.3 (alt karın ağrısı), K35 (akut apandisit) dışlanmalı. McBurney hassasiyeti, rebound, Alvarado skoru; tam kan sayımı, CRP ve batın USG önerilir.",
    }),
  },
  {
    id: "UR-FEV",
    level: "urgent",
    re: /(yüksek|39|40|41)\s*(derece\s*)?ateş|ateş\S*\s+(\S+\s)?(39|40|41|yüksek|düşmüyor)/u,
    build: (_side, text) => {
      const throat = /boğaz|yutkun|bademcik/u.test(text);
      return {
        ...EMPTY,
        primaryRegion: throat ? "Boğaz / Üst solunum yolu" : "Sistemik (yüksek ateş)",
        meshIdToHighlight: throat ? "LYM.palatine_tonsil.R" : null,
        department: throat ? "Acil Servis · Kulak Burun Boğaz" : "Acil Servis · Aile Hekimliği",
        possibleConditions: throat ? ["Akut tonsillit", "Peritonsiller apse", "Farenjit"] : ["Akut enfeksiyon", "İdrar yolu enfeksiyonu", "Pnömoni"],
        firstAid: ["Bol sıvı alın; ince giyinin.", "Ateş düşürücüyü kullanma talimatına uygun dozda alın.", "Ateşinizi ve saatini not edin."],
        warningSigns: ["Ense sertliği veya ciltte basmakla solmayan döküntü", "Bilinç bulanıklığı veya nefes darlığı", "Sıvı alamama, idrar çıkışının azalması"],
        clinicalNotes: "ICD-10 ön değerlendirme: R50.9 (ateş, tanımlanmamış). Vital bulgular, sepsis tarama (qSOFA), odak araştırması önerilir." + (throat ? " Centor skoru ve hızlı strep testi değerlendirilmelidir." : ""),
      };
    },
  },
];

/* ───────────────────────── T4 · Evde bakım ───────────────────────── */

const SELF_CARE: Rule[] = [
  {
    id: "SC-NECK",
    level: "self_care",
    re: /boyn|boyun/u,
    // Bu ifadelerden biri varsa evde bakım uygun değildir; rutin kural değerlendirir.
    unless: /uyuş|karınc|güçsüz|ateş|travma|kaza|çarp|düş|şiddetli|kola yayıl|haftadır|aydır|geçmiyor/u,
    build: () => ({
      primaryRegion: "Boyun ve üst sırt kasları",
      meshIdToHighlight: "MUS.descending_part_of_trapezius_muscle.R",
      department: "Gerekirse: Fiziksel Tıp ve Rehabilitasyon",
      possibleConditions: ["Postüral kas gerginliği", "Akut boyun tutulması (torticollis)"],
      supportiveAdvice: [
        "İlk 48 saatte 15 dakikalık soğuk, sonrasında ılık kompres kas gerginliğini azaltabilir.",
        "Tam hareketsiz kalmayın; ağrısız aralıkta boynunuzu yavaşça hareket ettirin.",
        "Uyurken boynunuzu düz tutan, çok yüksek olmayan bir yastık kullanın.",
      ],
      ergonomics: [
        "Ekranın üst kenarı göz hizasında olsun",
        "Telefonu göz hizasına kaldırın; başınızı öne eğmeyin",
        "Omuzlar gevşek, dirsekler yaklaşık 90°",
        "45 dakikada bir kalkıp omuzlarınızı çevirin",
      ],
      stretches: [
        { name: "Yana eğme", dose: "Her yön 20 sn × 3", detail: "Kulağınızı omzunuza doğru yavaşça indirin; omzunuzu kaldırmayın." },
        { name: "Çene içe çekme", dose: "10 tekrar", detail: "Başınızı geriye kaydırarak çift çene yapın, 3 sn tutun." },
        { name: "Omuz çevirme", dose: "10 tekrar", detail: "Omuzları kulağa kaldırıp geriye ve aşağı doğru çevirin." },
      ],
      warningSigns: ["Kola yayılan ağrı, uyuşma veya güçsüzlük", "Ateş ve ense sertliği", "Bir haftada düzelmeyen veya artan ağrı"],
      clinicalNotes: "ICD-10 ön değerlendirme: M54.2 (servikalji), M62.83 (kas spazmı). Kırmızı bayrak yok; nörolojik defisit sorgusu negatif kabul edildi.",
    }),
  },
  {
    id: "SC-DOMS",
    level: "self_care",
    re: /kas hamlığı|hamlık|spor\S* sonra|antrenman\S* sonra|kaslarım ağrı/u,
    unless: /koyu (renkli )?idrar|şiş|morar|güçsüz|ateş/u,
    build: () => ({
      primaryRegion: "Egzersiz yapılan kas grupları",
      meshIdToHighlight: "MUS.rectus_femoris_muscle.R",
      department: "Gerekirse: Spor Hekimliği",
      possibleConditions: ["Gecikmiş başlangıçlı kas ağrısı (DOMS)"],
      supportiveAdvice: [
        "Hafif tempolu yürüyüş gibi aktif dinlenme toparlanmayı hızlandırır.",
        "Ilık duş veya ılık kompres kasları gevşetebilir.",
        "Yeterli su ve protein alın; 24–48 saat aynı kas grubunu zorlamayın.",
      ],
      ergonomics: ["Antrenmana 5–10 dakika ısınma ile başlayın", "Yükü haftada %10’dan fazla artırmayın"],
      stretches: [
        { name: "Ön uyluk esnemesi", dose: "Her bacak 30 sn × 2", detail: "Ayakta, topuğu kalçaya doğru çekin; dizler yan yana." },
        { name: "Arka uyluk esnemesi", dose: "Her bacak 30 sn × 2", detail: "Topuk önde, kalçadan öne eğilin; sırt düz." },
        { name: "Baldır esnemesi", dose: "Her bacak 30 sn × 2", detail: "Duvara yaslanıp arkadaki topuğu yere bastırın." },
      ],
      warningSigns: ["Koyu (çay renginde) idrar", "Belirgin şişlik veya morarma", "72 saatten uzun süren şiddetli ağrı"],
      clinicalNotes: "ICD-10 ön değerlendirme: M79.1 (miyalji). Rabdomiyoliz şüphesinde (koyu idrar, şiddetli ağrı) CK düzeyi bakılmalıdır.",
    }),
  },
];

/* ───────────────────────── T3 · Rutin poliklinik ───────────────────────── */

const ORTHO_PREP = [
  "Ağrının başlangıcını, süresini ve hangi hareketlerle arttığını not edin.",
  "Daha önce çekilmiş röntgen veya MR görüntülerinizi yanınızda getirin.",
  "Muayene için bölgeyi kolayca açabileceğiniz bir kıyafet giyin.",
  "Kullandığınız ilaçların ve ağrı kesicilerin listesini hazırlayın.",
];

const ROUTINE: Rule[] = [
  {
    id: "OR-KNEE",
    level: "routine",
    re: /diz/u,
    build: (side) => ({
      primaryRegion: `${sidePrefix(side)}Diz Eklemi${side ? "" : " (taraf belirtilmedi)"}`,
      meshIdToHighlight: `JNT.medial_meniscus.${side ?? "R"}`,
      department: "Ortopedi ve Travmatoloji",
      possibleConditions: ["Menisküs lezyonu", "Patellofemoral ağrı sendromu", "Diz osteoartriti"],
      supportiveAdvice: [],
      visitPrep: ORTHO_PREP,
      warningSigns: ["Dizde ani ve belirgin şişlik, kızarıklık ve ateş", "Bacağa hiç yük verememe", "Dizin kilitlenip açılamaması"],
      clinicalNotes:
        "ICD-10 ön değerlendirme: M23.2 (eski yırtık veya yaralanmaya bağlı menisküs bozukluğu), M22.2 (patellofemoral bozukluklar). McMurray ve Thessaly testleri, eklem hareket açıklığı (ROM) ve efüzyon değerlendirmesi önerilir. Mekanik semptom varsa MR düşünülebilir.",
    }),
  },
  {
    id: "OR-SHOULDER",
    level: "routine",
    re: /omuz/u,
    build: (side) => ({
      primaryRegion: `${sidePrefix(side)}Omuz${side ? "" : " (taraf belirtilmedi)"}`,
      meshIdToHighlight: `MUS.supraspinatus_muscle.${side ?? "R"}`,
      department: "Ortopedi ve Travmatoloji",
      possibleConditions: ["Rotator manşet tendinopatisi", "Subakromiyal sıkışma sendromu", "Donuk omuz"],
      supportiveAdvice: [],
      visitPrep: ORTHO_PREP,
      warningSigns: ["Omuz ağrısına göğüs ağrısı veya nefes darlığı eşlik etmesi", "Düşme sonrası kolu hiç kaldıramama", "Kolda uyuşma veya güç kaybı"],
      clinicalNotes: "ICD-10 ön değerlendirme: M75.1 (rotator manşet sendromu), M75.4 (omuzda sıkışma sendromu). Neer, Hawkins-Kennedy ve boş kutu (Jobe) testleri; aktif/pasif ROM karşılaştırması önerilir.",
    }),
  },
  {
    id: "OR-JOINT",
    level: "routine",
    re: /eklem|sabah tutukluğu|bel(im|de|imde|imin|ime)?(\s|$)|bel fıtığı|boyn|boyun/u,
    build: (_side, text) => {
      const back = /bel(im|de|imde|imin|ime)?(\s|$)|bel fıtığı/u.test(text);
      const neck = /boyn|boyun/u.test(text);
      return {
        primaryRegion: back ? "Bel (Lomber Bölge)" : neck ? "Boyun (Servikal Bölge)" : "Eklemler (yaygın)",
        meshIdToHighlight: back ? "JNT.intervertebral_disc_l4_l5.C" : neck ? "SKL.vertebra_c5.C" : null,
        department: back || neck ? "Fiziksel Tıp ve Rehabilitasyon" : "Romatoloji (ilk başvuru: İç Hastalıkları)",
        possibleConditions: back
          ? ["Mekanik bel ağrısı", "Lomber disk hernisi", "Lomber kas zorlanması"]
          : neck
            ? ["Servikal disk hernisi", "Servikal spondiloz", "Miyofasiyal ağrı sendromu"]
            : ["İnflamatuvar artrit", "Osteoartrit", "Fibromiyalji"],
        supportiveAdvice: [],
        visitPrep: [
          "Tutukluğun sabah ne kadar sürdüğünü (dakika) not edin.",
          "Hangi eklemlerin etkilendiğini ve şişlik olup olmadığını yazın.",
          "Ailede romatizmal hastalık öyküsü varsa belirtin.",
          "Kullandığınız ilaçların listesini hazırlayın.",
        ],
        warningSigns: back || neck
          ? ["Kol veya bacaklarda güçsüzlük, uyuşma", "İdrar ya da dışkı kontrolünde değişiklik", "Ateş veya açıklanamayan kilo kaybı"]
          : ["Eklemde ani kızarıklık, sıcaklık ve ateş", "Birden fazla eklemde hızla artan şişlik", "Açıklanamayan kilo kaybı"],
        clinicalNotes: back
          ? "ICD-10 ön değerlendirme: M54.5 (bel ağrısı), M51.1 (radikülopatili lomber disk bozukluğu). SLR, nörolojik muayene ve kauda ekina sorgusu önerilir."
          : neck
            ? "ICD-10 ön değerlendirme: M50.1 (radikülopatili servikal disk bozukluğu), M47.8 (spondiloz). Spurling testi ve üst ekstremite nörolojik muayenesi önerilir."
            : "ICD-10 ön değerlendirme: M25.5 (eklem ağrısı), M06.9 (romatoid artrit, tanımlanmamış). 30 dakikadan uzun sabah tutukluğu inflamatuvar süreci düşündürür; ESR, CRP, RF, anti-CCP önerilir.",
      };
    },
  },
  {
    id: "GI-UPPER",
    level: "routine",
    re: /mide|karın|hazımsız|reflü|ekşime|şişkinlik/u,
    build: (_side, text) => {
      const radiating = /sırt\S*\s*(\S+\s){0,2}?(vur|yayıl)/u.test(text);
      return {
        primaryRegion: radiating ? "Üst Karın (Epigastrik) — sırta yayılım" : "Üst Karın (Epigastrik)",
        meshIdToHighlight: "DIG.stomach.C",
        department: "Gastroenteroloji (ilk başvuru: İç Hastalıkları)",
        possibleConditions: ["Gastroözofageal reflü hastalığı", "Gastrit", "Fonksiyonel dispepsi"],
        supportiveAdvice: [],
        visitPrep: [
          "Şikayetin hangi yiyeceklerden veya saatlerden sonra arttığını not edin.",
          "Düzenli kullandığınız ilaçları (özellikle ağrı kesicileri) listeleyin.",
          "Endoskopi gerekebileceği için randevu öncesi açlık talimatını sorun.",
        ],
        warningSigns: [
          "Kan kusma veya siyah dışkı",
          ...(radiating ? ["Sırta vuran ağrıya terleme, nefes darlığı veya kusma eşlik etmesi"] : []),
          "Yutma güçlüğü veya istemsiz kilo kaybı",
        ],
        clinicalNotes:
          "ICD-10 ön değerlendirme: K21.9 (özofajitsiz GÖRH), K29.7 (gastrit, tanımlanmamış), K30 (dispepsi)." +
          (radiating ? " Sırta yayılan epigastrik ağrıda pankreatit (lipaz) ve kardiyak köken (EKG, troponin) dışlanmalıdır." : "") +
          " Alarm semptomu varlığında endoskopi değerlendirilmelidir.",
      };
    },
  },
];

const FALLBACK: Built = {
  primaryRegion: "Belirli bir bölge saptanamadı",
  meshIdToHighlight: null,
  department: "Aile Hekimliği",
  possibleConditions: [],
  supportiveAdvice: [],
  visitPrep: ["Belirtilerinizi, başlangıç zamanını ve şiddetini (0–10) not alın.", "Kullandığınız ilaçların listesini hazırlayın."],
  warningSigns: ["Göğüs ağrısı veya nefes darlığı", "Bayılma veya bilinç bulanıklığı", "Yüksek ateşin 3 günden uzun sürmesi"],
  clinicalNotes: "Yapılandırılmış semptom çıkarımı bölge eşlemesi üretmedi. Anamnez ile değerlendirme önerilir.",
};

export function analyzeSymptoms(input: string): AnalysisResult {
  const text = norm(input);

  for (const rf of CRITICAL) {
    if (positiveMatch(text, rf.re)) {
      return {
        ...EMPTY,
        triageLevel: "critical",
        primaryRegion: rf.region,
        meshIdToHighlight: rf.meshId,
        department: "Acil Servis (112)",
        isRedFlag: true,
        redFlagReason: rf.reason,
        ruleId: rf.id,
        clinicalNotes: `Kırmızı bayrak kuralı ${rf.id} ön kapıda (yapay zekadan önce) tetiklendi. Sonuç seviyesi düşürülemez.`,
      };
    }
  }

  for (const rule of [...URGENT, ...SELF_CARE, ...ROUTINE]) {
    const m = positiveMatch(text, rule.re);
    if (!m || rule.unless?.test(text)) continue;
    return { ...rule.build(sideBefore(text, m.index), text), triageLevel: rule.level, isRedFlag: false, ruleId: rule.id };
  }

  return { ...FALLBACK, triageLevel: "routine", isRedFlag: false, ruleId: "GEN-00" };
}

export const QUICK_TAGS: { label: string; text: string; level: TriageLevel; kind: string }[] = [
  { label: "Göğüs sıkışması", text: "Göğüs sıkışması ve nefes darlığı", level: "critical", kind: "Kritik test" },
  { label: "Şiddetli karın ağrısı", text: "Şiddetli karın ağrısı, sağ alt tarafta ve geçmiyor", level: "urgent", kind: "Öncelikli test" },
  { label: "Dizimde batma var", text: "Dizimde eğilince batma var", level: "routine", kind: "Rutin test" },
  { label: "Boynum hafif tutuldu", text: "Masa başında çalışırken boynum hafif tutuldu", level: "self_care", kind: "Evde bakım testi" },
];

/* ═════════════════════════ Çok adımlı akış: çıkarım → takip soruları → sonuç ═════════════════════════ */

export type DurationBucket = "hours" | "days1_3" | "days4_7" | "weeks" | "months";
export const DURATIONS: { id: DurationBucket; label: string }[] = [
  { id: "hours", label: "Bugün başladı" },
  { id: "days1_3", label: "1–3 gün" },
  { id: "days4_7", label: "4–7 gün" },
  { id: "weeks", label: "1–4 hafta" },
  { id: "months", label: "1 aydan uzun" },
];
const DURATION_RANK: Record<DurationBucket, number> = { hours: 0, days1_3: 1, days4_7: 2, weeks: 3, months: 4 };

export type Onset = "sudden" | "gradual";
export type Course = "worse" | "same" | "better";

export type SymptomHit = { name: string; code: string; expr: string };

/** Metinden yapılandırılmış şikayet çıkarımı (Adım 2'de kullanıcıya gösterilir ve düzeltilebilir). */
export type Extraction = {
  regions: RegionHit[];
  symptoms: SymptomHit[];
  /** Metinden okunan süre ("4 gün"), kova karşılığıyla */
  duration: { label: string; bucket: DurationBucket } | null;
  onset: Onset | null;
  course: Course | null;
  fever: boolean;
  /** Olumsuzluk, taraf belirsizliği gibi kullanıcıya gösterilen notlar */
  notes: string[];
};

export type TriageAnswers = {
  /** Ağrı / rahatsızlık şiddeti 0–10 */
  severity: number | null;
  duration: DurationBucket | null;
  onset: Onset | null;
  course: Course | null;
  fever: boolean | null;
  /** Birincil bölgenin kırmızı bayrak sorusu */
  redFlag: boolean | null;
};
export const EMPTY_ANSWERS: TriageAnswers = { severity: null, duration: null, onset: null, course: null, fever: null, redFlag: null };

/** Sonuç sayfasında gösterilen tam triyaj çıktısı. */
export type TriageResult = AnalysisResult & {
  regions: RegionHit[];
  symptoms: SymptomHit[];
  answers: TriageAnswers;
  /** Seviyeyi belirleyen gerekçeler (en belirleyici önce) */
  reasons: string[];
  /** "Sağ diz bölgesinde 4–7 gündür süren ağrı …" */
  summary: string;
  /** Kural tabanının ilk önerdiği seviye (takip yanıtlarından önce) */
  baseLevel: TriageLevel;
};

const SYMPTOMS: [string, RegExp, string][] = [
  ["Ağrı", /ağrı|ağrıyor|sızı|sızl|batma|batıyor|zonkl/u, "SYM.pain"],
  ["Şişlik", /şiş/u, "SYM.swelling"],
  ["Yanma", /yanıyor|yanma/u, "SYM.burning"],
  ["Ateş", /ateş/u, "SYM.fever"],
  ["Tutulma", /tutul|tutuk/u, "SYM.stiffness"],
  ["Baskı / sıkışma", /bask|sıkış/u, "SYM.pressure"],
  ["Yutkunma güçlüğü", /yutkun/u, "SYM.dysphagia"],
  ["Yayılan ağrı", /yayıl|vuruyor/u, "SYM.radiating"],
  ["Uyuşma / karıncalanma", /uyuş|karınc/u, "SYM.numbness"],
  ["Bulantı / kusma", /bulantı|bulan|kus/u, "SYM.nausea"],
  ["Baş dönmesi", /baş\S* dön/u, "SYM.dizziness"],
  ["Kilitlenme", /kilitlen/u, "SYM.locking"],
  ["Morarma", /morar|morluk/u, "SYM.bruising"],
  ["Öksürük", /öksür/u, "SYM.cough"],
];

const NUM: Record<string, number> = { bir: 1, iki: 2, üç: 3, dört: 4, beş: 5, altı: 6, yedi: 7, sekiz: 8, dokuz: 9, on: 10 };

function durationOf(text: string): Extraction["duration"] {
  if (/yarım saat|bir saat|birkaç saat|bu sabah|bugün/u.test(text)) return { label: "bugün", bucket: "hours" };
  if (/dünden beri|dün/u.test(text)) return { label: "1 gün", bucket: "days1_3" };
  const m = /(\d+|bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|birkaç)\s*(saat|gün|hafta|ay|yıl)/u.exec(text);
  if (!m) return null;
  const n = m[1] === "birkaç" ? 3 : (NUM[m[1]] ?? parseInt(m[1], 10));
  const days = m[2] === "saat" ? 0 : m[2] === "gün" ? n : m[2] === "hafta" ? n * 7 : m[2] === "ay" ? n * 30 : n * 365;
  const bucket: DurationBucket = days === 0 ? "hours" : days <= 3 ? "days1_3" : days <= 7 ? "days4_7" : days <= 28 ? "weeks" : "months";
  return { label: `${m[1] === "birkaç" ? "birkaç" : n} ${m[2]}`, bucket };
}

/** Adım 2: metni çözümler. Kırmızı bayrak kontrolü ayrıca analyzeSymptoms ile (ön kapı) yapılır. */
export function extractComplaint(input: string): Extraction {
  const text = norm(input);
  const notes: string[] = [];
  const regions: RegionHit[] = [];
  const seen = new Set<RegionBase>();

  for (const base of REGION_ORDER) {
    const def = REGIONS[base];
    const m = def.re.exec(text);
    if (!m) continue;
    // "ayak bileği" eşleştiyse "bilek" (el) ayrıca sayılmaz; üst karın eşleştiyse genel "karın" sayılmaz.
    if (base === "wrist" && seen.has("ankle") && !/el bile|parmak|avuç/u.test(text)) continue;
    if (base === "lower_abdomen" && seen.has("upper_abdomen") && !/alt karın|kasık|apandis/u.test(text)) continue;
    if (NEGATION.test(text.slice(m.index + m[0].length))) {
      notes.push(`“${m[0].trim()} … yok” olumsuz ifade olarak değerlendirildi; şikayet bölgesi sayılmadı.`);
      continue;
    }
    const side = def.paired ? sideBefore(text, m.index) : null;
    const hit = regionHit(base, side);
    if (hit.sideAssumed) notes.push(`${def.name} için taraf belirtilmedi; sağ taraf varsayıldı. Gerekirse 3B modelde doğrulayın.`);
    regions.push(hit);
    seen.add(base);
  }

  const symptoms: SymptomHit[] = [];
  for (const [name, re, code] of SYMPTOMS) {
    const m = positiveMatch(text, re);
    if (m) symptoms.push({ name, code, expr: m[0] });
    else if (re.test(text)) notes.push(`“${name.toLocaleLowerCase("tr-TR")}” olumsuz bağlamda geçtiği için belirti sayılmadı.`);
  }

  return {
    regions,
    symptoms,
    duration: durationOf(text),
    onset: /aniden|birden|ani /u.test(text) ? "sudden" : /yavaş yavaş|giderek|zamanla/u.test(text) ? "gradual" : null,
    course: /azal|hafifl|geçmeye başla|iyileş/u.test(text) ? "better" : /artan|artıyor|kötüleş|şiddetlen|giderek/u.test(text) ? "worse" : null,
    fever: !!positiveMatch(text, /ateş/u),
    notes,
  };
}

/** Çıkarımdan takip sorularının ön doldurulmuş yanıtları (kullanıcı değiştirebilir). */
export function prefillAnswers(x: Extraction): TriageAnswers {
  return { ...EMPTY_ANSWERS, duration: x.duration?.bucket ?? null, onset: x.onset, course: x.course, fever: x.fever ? true : null };
}

/** Birincil bölgenin kırmızı bayrak sorusu (bölge yoksa genel bilinç sorusu). */
export function redFlagQuestion(x: Extraction): RedFlagQuestion {
  const base = x.regions[0]?.base;
  return base
    ? REGIONS[base].redFlag
    : { q: "Bayılma, bilinç bulanıklığı ya da ani nefes darlığı oldu mu?", flag: "Bilinç değişikliği / nefes darlığı", reason: "Bayılma, bilinç bulanıklığı veya ani nefes darlığı acil değerlendirme gerektirir.", escalate: "critical" };
}

/** Takip sorularının tamamı yanıtlandı mı. */
export const answersComplete = (a: TriageAnswers) =>
  a.severity !== null && a.duration !== null && a.onset !== null && a.course !== null && a.fever !== null && a.redFlag !== null;

const COURSE_LABEL: Record<Course, string> = { worse: "giderek artıyor", same: "değişmiyor", better: "azalıyor" };

function summaryOf(x: Extraction, a: TriageAnswers) {
  const where = x.regions.length ? `${x.regions.map((r) => r.name).join(", ")} bölgesinde` : "Belirli bir bölge belirtilmeden";
  const dur = DURATIONS.find((d) => d.id === a.duration)?.label.toLocaleLowerCase("tr-TR");
  const since = a.duration === "hours" ? "bugün başlayan" : dur ? `${dur}dür süren` : "";
  const sym = x.symptoms.length ? x.symptoms.map((s) => s.name.toLocaleLowerCase("tr-TR")).join(", ") : "şikayet";
  return (
    [
      `${where} ${since} ${sym}`.replace(/\s+/g, " ").trim(),
      `şiddet ${a.severity ?? "?"}/10`,
      a.onset === "sudden" ? "ani başlangıç" : "kademeli başlangıç",
      a.course ? `seyir: ${COURSE_LABEL[a.course]}` : null,
      a.fever ? "ateş var" : "ateş yok",
    ]
      .filter(Boolean)
      .join("; ") + "."
  );
}

const GENERIC_FIRST_AID = [
  "Ağrıyı artıran hareketlerden ve ağır yük kaldırmaktan kaçının.",
  "Başvuruya kadar yeni bir ilaç denemeyin; kullandığınız ilaçların listesini hazırlayın.",
  "Belirtilerinizin başlangıç saatini ve nasıl değiştiğini not edin.",
];
const GENERIC_PREP = [
  "Şikayetin başlangıcını, süresini ve neyle arttığını not edin.",
  "Kullandığınız ilaçların listesini ve varsa önceki tetkik sonuçlarınızı yanınıza alın.",
  "Doktorunuza soracağınız soruları önceden yazın.",
];

/** Adım 4: kural tabanı + takip yanıtları → nihai triyaj. Seviye yalnızca yükselebilir, kural tabanının altına düşmez. */
export function finalizeTriage(input: string, x: Extraction, a: TriageAnswers): TriageResult {
  const base = analyzeSymptoms(input);
  const primary = x.regions[0];
  const extra = { regions: x.regions, symptoms: x.symptoms, answers: a, summary: summaryOf(x, a), baseLevel: base.triageLevel };
  const mesh = base.meshIdToHighlight ?? primary?.structures[0]?.meshId ?? null;
  const region = primary?.name ?? base.primaryRegion;

  // Ön kapı: metinde kırmızı bayrak varsa seviye düşürülemez.
  if (base.isRedFlag) return { ...base, ...extra, reasons: [`${base.ruleId} · ${base.redFlagReason}`] };

  const rf = redFlagQuestion(x);
  if (a.redFlag && rf.escalate === "critical") {
    return {
      ...base,
      ...extra,
      triageLevel: "critical",
      primaryRegion: region,
      meshIdToHighlight: mesh,
      department: "Acil Servis (112)",
      isRedFlag: true,
      redFlagReason: rf.reason,
      ruleId: `RF-Q-${primary?.base ?? "GEN"}`,
      reasons: [`Takip sorusu: ${rf.flag}`],
      clinicalNotes: `Takip sorusunda kırmızı bayrak yanıtı (${rf.flag}). Sonuç seviyesi düşürülemez.`,
    };
  }

  let rank: number = TRIAGE_LEVELS[base.triageLevel].rank;
  const reasons: string[] = [];
  const raise = (to: number, why: string) => {
    if (to < rank) {
      rank = to;
      reasons.unshift(why);
    }
  };
  const sev = a.severity ?? 0;
  const dur = a.duration ? DURATION_RANK[a.duration] : 0;

  if (a.redFlag) raise(2, `Takip sorusu: ${rf.flag}`);
  if (sev >= 8) raise(2, `Şiddetli ağrı (${sev}/10)`);
  if (a.onset === "sudden" && sev >= 7) raise(2, "Ani başlayan şiddetli ağrı");
  if (a.fever && (dur >= 2 || sev >= 7)) raise(2, "3 günü aşan ya da şiddetli ağrıyla birlikte ateş");
  if (rank === 4) {
    const why = sev >= 6 ? `ağrı şiddeti ${sev}/10` : dur >= 3 ? "şikayetin 1 haftadan uzun sürmesi" : a.course === "worse" ? "giderek artan seyir" : a.fever ? "ateş eşlik etmesi" : null;
    if (why) raise(3, `Evde izlem için uygun değil: ${why}`);
  }
  reasons.push(`Kural tabanı: ${base.ruleId} (${TRIAGE_LEVELS[base.triageLevel].code} · ${TRIAGE_LEVELS[base.triageLevel].label})`);

  const level = LEVEL_BY_RANK[rank as 1 | 2 | 3 | 4];
  const dept = base.department.replace(/^Gerekirse:\s*/u, "");
  return {
    ...base,
    ...extra,
    triageLevel: level,
    primaryRegion: region,
    meshIdToHighlight: mesh,
    department: level === "urgent" && !/acil/iu.test(dept) ? `Acil Servis veya Aile Hekimi · ardından ${dept}` : dept,
    firstAid: level === "urgent" ? (base.firstAid ?? GENERIC_FIRST_AID) : base.firstAid,
    visitPrep: level === "routine" ? (base.visitPrep ?? GENERIC_PREP) : base.visitPrep,
    reasons,
  };
}

/** Sonuç sayfasında "Doktorunuza sorabilecekleriniz" listesi. */
export function doctorQuestions(level: TriageLevel) {
  return level === "self_care"
    ? ["Şikayetim hangi durumda muayene gerektirir?", "Evde uygulayabileceğim başka öneriler var mı?", "İşime ya da sporuma ne zaman dönebilirim?"]
    : [
        "Şikayetimin olası nedenleri neler; hangi tetkikler gerekli?",
        "Şimdilik hangi hareketlerden veya yiyeceklerden kaçınmalıyım?",
        "Ağrı kesici kullanabilir miyim, ne sıklıkla?",
        "Hangi belirtilerde tekrar başvurmalıyım?",
      ];
}
