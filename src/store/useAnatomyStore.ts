import { create } from "zustand";
import type { UserProfile, UserRole } from "@/lib/auth";
import { LAYER_IDS, layerOfMesh, type AnatomyLayer } from "@/lib/layers";
import type { RegionHit } from "@/lib/bodyRegions";
import type { HealthData } from "@/lib/health";
import {
  analyzeSymptoms, EMPTY_ANSWERS, extractComplaint, finalizeTriage, prefillAnswers,
  type AnalysisResult, type Extraction, type TriageAnswers, type TriageLevel, type TriageResult,
} from "@/lib/triage";

export type { AnatomyLayer, AnalysisResult, TriageLevel, TriageResult, UserProfile, UserRole };
export type ViewMode = "stacked" | "sideBySide";
/**
 * Triyaj akışı: describe (anlatın) → analyzing → review (çıkarım + ilgili yapılar) → questions (takip soruları)
 * → done (sonuç sayfası). Metinde kırmızı bayrak varsa analizden doğrudan "done"a geçilir.
 */
export type TriageStep = "describe" | "analyzing" | "review" | "questions" | "done";

export type MeshInfo = {
  /** Mesh adı, ör. "SKL.patella.R" */
  name: string;
  /** glTF extras'tan gelen okunur ad */
  label?: string;
  group?: string;
  layer?: AnatomyLayer;
  /** Kameranın kadraja alacağı en küçük yarıçap (m); bölge düzeyinde odak için büyütülür. */
  focusRadius?: number;
};

/** Analiz simülasyonunun süresi (ms); arayüzdeki adım göstergesi bu süreye göre ilerler. */
export const ANALYSIS_DURATION_MS = 1800;
export const SYMPTOM_MAX_LENGTH = 1000;

type AnatomyState = {
  /** Etkin portal rolü; yalnızca oturum açan hesabın veritabanı kaydından gelir (elle değiştirilemez). */
  role: UserRole;

  /* ── Oturum (kaynak: /api/auth/*; AuthListener ve giriş ekranı tarafından beslenir) ── */
  user: UserProfile | null;
  isAuthenticated: boolean;
  /** İlk oturum kontrolü tamamlandı mı (Navbar iskeleti için) */
  authReady: boolean;
  login: (profile: UserProfile) => void;
  /** Yerel oturum durumunu temizler; sağlık verisi içeren analiz durumu da silinir. Çerezi silen /api/auth/logout ayrıca çağrılır. */
  logout: () => void;

  /** Görünür katmanlar */
  activeLayers: AnatomyLayer[];
  /** En az bir kez açılmış (dosyası yüklenmiş) katmanlar; kapatılınca yalnızca gizlenir. */
  loadedLayers: AnatomyLayer[];
  toggleLayer: (layer: AnatomyLayer) => void;
  showLayer: (layer: AnatomyLayer) => void;
  /** Tüm sistemleri gösterir (henüz indirilmemiş dosyalar yüklenir). */
  showAllLayers: () => void;
  /** Tüm sistemleri gizler; seçim temizlenir. İndirilmiş dosyalar bellekte kalır. */
  hideAllLayers: () => void;

  /** Kullanıcının belirlediği katman şeffaflığı (0,1–1) */
  layerOpacity: Record<AnatomyLayer, number>;
  setLayerOpacity: (layer: AnatomyLayer, opacity: number) => void;

  /** Zar ve fasyalar (glTF extras.hidden) varsayılan olarak gizlidir. */
  showEnvelopes: boolean;
  setShowEnvelopes: (show: boolean) => void;

  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  /** Kamerayı yeniden kadraja almak için artan sayaç */
  viewResetKey: number;
  resetView: () => void;

  selectedMesh: MeshInfo | null;
  /** Her yeni seçimde artar; kamera seçilen yapıya yakınlaşır. */
  focusKey: number;
  setSelectedMesh: (mesh: MeshInfo | null) => void;

  hoveredMesh: MeshInfo | null;
  setHoveredMesh: (mesh: MeshInfo | null) => void;

  /* ── Kişiselleştirilmiş sağlık profili (yalnızca bellekte; çıkışta silinir) ── */
  /** undefined: henüz yüklenmedi · null: doldurulmamış */
  health: HealthData | null | undefined;
  /** Ana sayfadaki hatırlatma bandı gösterilsin mi (sunucu kararı + "Şimdi değil") */
  healthReminder: boolean;
  setHealth: (health: HealthData | null, remind?: boolean) => void;
  hideHealthReminder: () => void;
  /** Sihirbaz: null kapalı, sayı açık adım (0–2) */
  healthWizardStep: number | null;
  openHealthWizard: (step?: number) => void;
  closeHealthWizard: () => void;

  /* ── Semptom ve triyaj (yalnızca bellekte; sayfa yenilenince veya çıkışta silinir) ── */
  symptomText: string;
  setSymptomText: (text: string) => void;
  triageStep: TriageStep;
  extraction: Extraction | null;
  answers: TriageAnswers;
  analysisResult: TriageResult | null;
  /** Metni çözümler; ilgili yapıyı 3B modelde seçer. Kırmızı bayrakta doğrudan sonuca geçer. */
  runAnalysis: () => Promise<void>;
  /** Çıkarılan bölgelerden birini kaldırır (yanlış eşleşme). */
  removeRegion: (id: string) => void;
  /** Bölgedeki yapıyı 3B modelde gösterir. */
  focusStructure: (region: RegionHit, meshId: string) => void;
  startQuestions: () => void;
  backToReview: () => void;
  /** Sonucun yapısını 3B modelde yeniden seçer ve odaklar. */
  focusResult: () => void;
  setAnswer: <K extends keyof TriageAnswers>(key: K, value: TriageAnswers[K]) => void;
  /** Takip yanıtlarıyla triyajı tamamlar. */
  finishTriage: () => void;
  /** Metni düzenlemek için ilk adıma döner (metin korunur). */
  editComplaint: () => void;
  /** Yeni şikayet: metni, yanıtları, sonucu ve seçimi temizler. */
  resetAnalysis: () => void;
};

const addUnique = <T,>(list: T[], item: T) => (list.includes(item) ? list : [...list, item]);

/** Sıfırlama sırasında süren bir analizin sonucunu yok saymak için. */
let analysisRun = 0;

/** 3B senkronizasyon: sonucun yapısını seç (kamera odaklanır, mesh vurgulanır). */
function selectResultMesh(result: AnalysisResult) {
  const { showLayer, setSelectedMesh } = useAnatomyStore.getState();
  const meshId = result.meshIdToHighlight;
  const layer = meshId ? layerOfMesh(meshId) : undefined;
  if (meshId && layer) {
    showLayer(layer);
    setSelectedMesh({ name: meshId, label: result.primaryRegion, layer, focusRadius: 0.16 });
  } else setSelectedMesh(null);
}

export const useAnatomyStore = create<AnatomyState>()((set, get) => ({
  role: "patient",

  user: null,
  isAuthenticated: false,
  authReady: false,
  login: (user) => set({ user, isAuthenticated: true, authReady: true, role: user.role }),
  logout: () => {
    get().resetAnalysis();
    set({ user: null, isAuthenticated: false, authReady: true, role: "patient", health: undefined, healthReminder: false, healthWizardStep: null });
  },

  health: undefined,
  healthReminder: false,
  setHealth: (health, remind) => set((s) => ({ health, healthReminder: remind ?? s.healthReminder })),
  hideHealthReminder: () => set({ healthReminder: false }),
  healthWizardStep: null,
  openHealthWizard: (step = 0) => set({ healthWizardStep: step }),
  closeHealthWizard: () => set({ healthWizardStep: null }),

  // Sahne boş açılır; kullanıcı sol panelden katman seçene kadar hiçbir model indirilmez.
  activeLayers: [],
  loadedLayers: [],
  toggleLayer: (layer) =>
    set((s) => {
      const on = s.activeLayers.includes(layer);
      return {
        activeLayers: on ? s.activeLayers.filter((l) => l !== layer) : [...s.activeLayers, layer],
        loadedLayers: addUnique(s.loadedLayers, layer),
        // Gizlenen katmandaki seçim anlamını yitirir.
        selectedMesh: on && s.selectedMesh?.layer === layer ? null : s.selectedMesh,
      };
    }),
  showLayer: (layer) =>
    set((s) => ({ activeLayers: addUnique(s.activeLayers, layer), loadedLayers: addUnique(s.loadedLayers, layer) })),
  showAllLayers: () => set({ activeLayers: [...LAYER_IDS], loadedLayers: [...LAYER_IDS] }),
  // Tüm katmanlar kapanınca kamera da tam vücut başlangıç açısına döner.
  hideAllLayers: () => set((s) => ({ activeLayers: [], selectedMesh: null, hoveredMesh: null, viewResetKey: s.viewResetKey + 1 })),

  layerOpacity: Object.fromEntries(LAYER_IDS.map((id) => [id, 1])) as Record<AnatomyLayer, number>,
  setLayerOpacity: (layer, opacity) => set((s) => ({ layerOpacity: { ...s.layerOpacity, [layer]: opacity } })),

  showEnvelopes: false,
  setShowEnvelopes: (showEnvelopes) => set({ showEnvelopes }),

  viewMode: "stacked",
  setViewMode: (viewMode) => set({ viewMode }),

  viewResetKey: 0,
  resetView: () => set((s) => ({ viewResetKey: s.viewResetKey + 1 })),

  selectedMesh: null,
  focusKey: 0,
  setSelectedMesh: (selectedMesh) => set((s) => ({ selectedMesh, focusKey: selectedMesh ? s.focusKey + 1 : s.focusKey })),

  hoveredMesh: null,
  setHoveredMesh: (hoveredMesh) => set({ hoveredMesh }),

  symptomText: "",
  setSymptomText: (symptomText) => set({ symptomText: symptomText.slice(0, SYMPTOM_MAX_LENGTH) }),
  triageStep: "describe",
  extraction: null,
  answers: EMPTY_ANSWERS,
  analysisResult: null,

  runAnalysis: async () => {
    const text = get().symptomText.trim();
    if (!text || get().triageStep === "analyzing") return;
    const run = ++analysisRun;
    set({ triageStep: "analyzing", extraction: null, analysisResult: null, answers: EMPTY_ANSWERS });

    await new Promise((r) => setTimeout(r, ANALYSIS_DURATION_MS));
    if (run !== analysisRun) return;

    const extraction = extractComplaint(text);
    const answers = prefillAnswers(extraction);
    // Ön kapı: metinde kırmızı bayrak varsa takip soruları sorulmaz, sonuç doğrudan T1'dir.
    if (analyzeSymptoms(text).isRedFlag) {
      const result = finalizeTriage(text, extraction, answers, get().health);
      set({ extraction, answers, analysisResult: result, triageStep: "done" });
      selectResultMesh(result);
      return;
    }
    set({ extraction, answers, triageStep: "review" });
    const first = extraction.regions[0];
    if (first?.structures[0]) get().focusStructure(first, first.structures[0].meshId);
    else get().setSelectedMesh(null);
  },

  removeRegion: (id) =>
    set((s) => (s.extraction ? { extraction: { ...s.extraction, regions: s.extraction.regions.filter((r) => r.id !== id) } } : {})),

  focusStructure: (region, meshId) => {
    const st = region.structures.find((x) => x.meshId === meshId);
    if (!st) return;
    get().showLayer(st.layer);
    get().setSelectedMesh({ name: meshId, label: `${region.name} · ${st.label}`, layer: st.layer, focusRadius: 0.16 });
  },

  startQuestions: () => set({ triageStep: "questions" }),
  backToReview: () => set({ triageStep: "review" }),
  focusResult: () => {
    const result = get().analysisResult;
    if (result) selectResultMesh(result);
  },
  setAnswer: (key, value) => set((s) => ({ answers: { ...s.answers, [key]: value } })),

  finishTriage: () => {
    const { extraction, answers, symptomText } = get();
    if (!extraction) return;
    const result = finalizeTriage(symptomText.trim(), extraction, answers, get().health);
    set({ analysisResult: result, triageStep: "done" });
    selectResultMesh(result);
  },

  editComplaint: () => {
    analysisRun++;
    set({ triageStep: "describe", extraction: null, analysisResult: null, answers: EMPTY_ANSWERS });
  },

  resetAnalysis: () => {
    analysisRun++;
    set({ symptomText: "", triageStep: "describe", extraction: null, answers: EMPTY_ANSWERS, analysisResult: null, selectedMesh: null });
    get().resetView();
  },
}));
