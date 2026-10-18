import { create } from "zustand";
import type { UserProfile, UserRole } from "@/lib/auth";
import { LAYER_IDS, layerOfMesh, type AnatomyLayer } from "@/lib/layers";
import { analyzeSymptoms, type AnalysisResult, type TriageLevel } from "@/lib/triage";

export type { AnatomyLayer, AnalysisResult, TriageLevel, UserProfile, UserRole };
export type ViewMode = "stacked" | "sideBySide";
export type AnalysisState = "idle" | "analyzing" | "completed";

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

  /* ── Semptom ve triyaj ── */
  symptomText: string;
  setSymptomText: (text: string) => void;
  analysisState: AnalysisState;
  analysisResult: AnalysisResult | null;
  /** Metni analiz eder; tamamlanınca ilgili yapıyı 3B modelde seçer ve odaklar. */
  runAnalysis: () => Promise<void>;
  /** Yeni şikayet: metni, sonucu ve seçimi temizler. */
  resetAnalysis: () => void;
};

const addUnique = <T,>(list: T[], item: T) => (list.includes(item) ? list : [...list, item]);

/** Sıfırlama sırasında süren bir analizin sonucunu yok saymak için. */
let analysisRun = 0;

export const useAnatomyStore = create<AnatomyState>()((set, get) => ({
  role: "patient",

  user: null,
  isAuthenticated: false,
  authReady: false,
  login: (user) => set({ user, isAuthenticated: true, authReady: true, role: user.role }),
  logout: () => {
    get().resetAnalysis();
    set({ user: null, isAuthenticated: false, authReady: true, role: "patient" });
  },

  activeLayers: ["skin", "skeletal"],
  loadedLayers: ["skin", "skeletal"],
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
  analysisState: "idle",
  analysisResult: null,

  runAnalysis: async () => {
    const text = get().symptomText.trim();
    if (!text || get().analysisState === "analyzing") return;
    const run = ++analysisRun;
    set({ analysisState: "analyzing", analysisResult: null });

    await new Promise((r) => setTimeout(r, ANALYSIS_DURATION_MS));
    if (run !== analysisRun) return;

    const result = analyzeSymptoms(text);
    set({ analysisState: "completed", analysisResult: result });

    // 3B senkronizasyon: ilgili sistemi aç, yapıyı seç (kamera odaklanır, mesh vurgulanır).
    const meshId = result.meshIdToHighlight;
    const layer = meshId ? layerOfMesh(meshId) : undefined;
    if (meshId && layer) {
      get().showLayer(layer);
      get().setSelectedMesh({ name: meshId, label: result.primaryRegion, layer, focusRadius: 0.16 });
    } else {
      get().setSelectedMesh(null);
    }
  },

  resetAnalysis: () => {
    analysisRun++;
    set({ symptomText: "", analysisState: "idle", analysisResult: null, selectedMesh: null });
    get().resetView();
  },
}));
