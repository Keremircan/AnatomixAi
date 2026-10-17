/**
 * Semptom metni için kural tabanlı, 4 seviyeli triyaj simülasyonu (mock).
 * Gerçek sistemde bu adım LLM çıkarımı + sözlük eşleme + klinik onaylı kural tabanı ile yapılır (SRS §4).
 * Kurallar aciliyet sırasıyla değerlendirilir: kritik → öncelikli → evde bakım → rutin.
 * Böylece bir metin hem acil hem rutin kalıba uyuyorsa her zaman daha acil seviye kazanır.
 */

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

/** Seviye başına sabit arayüz ve klinik eşdeğerlik bilgisi. */
export const TRIAGE_LEVELS: Record<
  TriageLevel,
  { rank: 1 | 2 | 3 | 4; code: string; label: string; badge: string; action: string; esi: string; mts: string; mtsTarget: string }
> = {
  critical: {
    rank: 1, code: "T1", label: "Kritik / Acil", badge: "Kırmızı bayrak · Acil",
    action: "Hemen 112’yi arayın veya en yakın acil servise gidin.",
    esi: "ESI 1–2", mts: "Kırmızı", mtsTarget: "Anında (0 dk)",
  },
  urgent: {
    rank: 2, code: "T2", label: "Öncelikli / Yüksek risk", badge: "Öncelikli başvuru",
    action: "En geç 24 saat içinde bir sağlık kuruluşuna veya acil servise başvurun.",
    esi: "ESI 3", mts: "Sarı", mtsTarget: "≤ 60 dk",
  },
  routine: {
    rank: 3, code: "T3", label: "Rutin poliklinik", badge: "Randevu alınması önerilir",
    action: "Önerilen poliklinikten randevu alarak muayene olun.",
    esi: "ESI 4", mts: "Yeşil", mtsTarget: "≤ 120 dk",
  },
  self_care: {
    rank: 4, code: "T4", label: "Hafif / Evde bakım", badge: "Evde izlem",
    action: "Evde izlem uygun görünüyor. Aşağıdaki belirtilerden biri olursa doktora başvurun.",
    esi: "ESI 5", mts: "Mavi", mtsTarget: "≤ 240 dk",
  },
};

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
