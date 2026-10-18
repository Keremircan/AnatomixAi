"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useProgress } from "@react-three/drei";
import { useTheme } from "next-themes";
import { Box3, CanvasTexture, type Group, MathUtils, type Object3D, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { AnatomyModel, meshName, preloadDefaultLayers } from "./AnatomyModel";
import { ControlsGuide, EmptySceneHint } from "./SceneOverlays";
import { useAnatomyStore } from "@/store/useAnatomyStore";
import { BODY, FIGURE_SPACING, figureOffsets, LAYER_IDS, layerDef, pickLod } from "@/lib/layers";

const ACCENT = "#22d3ee";

/**
 * Temaya göre sahne ışığı ve zemin ayarları. Koyu temada derin zemin + cyan kenar ışığı;
 * açık temada klinik açık gri zeminde modelin kontur kazanması için daha yumuşak dolgu ve
 * daha koyu bir cyan zemin halkası kullanılır.
 */
const SCENE_THEME = {
  dark: { sky: "#e6f4ff", ground: "#1a2533", hemi: 0.9, ambient: 0.35, key: 1.6, rim: 0.9, rimColor: ACCENT, back: 0.4, ring: ACCENT, ringOpacity: 0.35, shadow: 0.65 },
  light: { sky: "#ffffff", ground: "#b8c4d2", hemi: 1.0, ambient: 0.45, key: 1.5, rim: 0.55, rimColor: "#0e7490", back: 0.5, ring: "#0e7490", ringOpacity: 0.45, shadow: 0.32 },
} as const;
type SceneTheme = (typeof SCENE_THEME)[keyof typeof SCENE_THEME];
/** Kamera yumuşatma katsayısı (1/sn); 60 FPS'te kare başına ~%7 yaklaşma. */
const CAMERA_SMOOTHING = 4.5;
/** Odak payı: yapı kadrajın ~%65'ini kaplar. */
const FOCUS_MARGIN = 1.5;
const MIN_FOCUS_DISTANCE = 0.3;
/** Odaklanılacak yapının katmanı yüklenirken en fazla bu kadar beklenir. */
const FOCUS_WAIT_MS = 30_000;
/** Bu z değerinin gerisindeki yapılar (ör. trapez, bel omurları) arkadan görüntülenir. */
const BACK_Z = -0.04;
/** Sol sistem panelinin genişliği + kenar boşluğu (md ve üstü). */
const PANEL_INSET_PX = 300;

/** Görünür sistemler, dıştan içe sıralı. */
function useVisibleOrdered() {
  const active = useAnatomyStore((s) => s.activeLayers);
  return useMemo(() => LAYER_IDS.filter((id) => active.includes(id)), [active]);
}

/**
 * Kamera yönetimi: genel kadraj (görünüm modu, figür sayısı, sıfırlama) ve yapı odaklama.
 *
 * Odaklama (seçim, arama veya semptom analizi sonucu):
 *  - Hedef yapının sınır kutusu (Box3) her karede canlı ölçülür; böylece katman yeni yüklenmiş olsa ya da
 *    yan yana modunda figür hâlâ kayıyor olsa bile kamera boş bir noktaya değil, yapının güncel yerine gider.
 *  - OrbitControls hedefi kutunun merkezine kilitlenir; mesafe kutunun en büyük boyutu ve kameranın
 *    dikey/yatay görüş açısından hesaplanır.
 *  - Konum ve hedef, kare hızından bağımsız üstel yumuşatmayla (her karede ~%7) kayar; ani sıçrama olmaz.
 *  - Kullanıcı sahneyi sürüklemeye başlarsa devam eden kamera hareketi bırakılır.
 */
function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const size = useThree((s) => s.size);
  const scene = useThree((s) => s.scene);
  const mode = useAnatomyStore((s) => s.viewMode);
  const resetKey = useAnatomyStore((s) => s.viewResetKey);
  const focusKey = useAnatomyStore((s) => s.focusKey);
  const count = useVisibleOrdered().length;

  /** Sabit hedef (genel kadraj) */
  const goal = useRef<{ pos: Vector3; target: Vector3 } | null>(null);
  /** Takip edilen yapı; bulunana kadar (katman yükleniyorsa) beklenir, kamera yerine oturunca bırakılır. */
  const focus = useRef<{ name: string; minSize: number; since: number } | null>(null);

  // Geniş ekranda sol sistem paneli tuvalin bir kısmını kapatır; görüntü merkezi açık alana kaydırılır.
  const inset = size.width >= 768 ? PANEL_INSET_PX : 0;
  const aspect = (size.width - inset) / Math.max(size.height, 1);

  useEffect(() => {
    if (!("fov" in camera)) return;
    if (inset) camera.setViewOffset(size.width, size.height, -inset / 2, 0, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, inset]);

  // Kullanıcı sürüklemeye başlarsa otomatik kamera hareketini bırak.
  useEffect(() => {
    if (!controls) return;
    const stop = () => {
      goal.current = null;
      focus.current = null;
    };
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  // Genel kadraj: "üst üste" modunda katman açıp kapamak kamerayı oynatmaz; yan yana genişliği değişince,
  // mod değişince veya sıfırlamada tüm figürler kadraja alınır.
  const layoutKey = mode === "stacked" ? "stacked" : `side:${Math.max(count, 1)}`;
  useEffect(() => {
    if (!("fov" in camera)) return;
    const n = mode === "sideBySide" ? Math.max(count, 1) : 1;
    const width = (n - 1) * FIGURE_SPACING + BODY.width;
    const height = BODY.topY - BODY.floorY;
    const dist = fitDistance(width, height, camera.fov, aspect) * 1.12 + 0.25;
    const target = new Vector3(0, BODY.centerY, 0);
    goal.current = { pos: target.clone().add(new Vector3(0, 0.12, dist)), target };
    focus.current = null;
    // Pencere boyutu tek başına kullanıcının açısını sıfırlamasın diye bağımlılıklara alınmadı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, resetKey, camera]);

  // Yapı odaklama isteği (seçim, arama, analiz sonucu). Genel kadraj efektinden SONRA tanımlıdır: analiz yan yana
  // modunda yeni bir katman açtığında iki efekt aynı anda çalışır ve odak isteği kadrajı geçersiz kılmalıdır.
  useEffect(() => {
    const sel = useAnatomyStore.getState().selectedMesh;
    if (!focusKey || !sel) return;
    focus.current = { name: sel.name, minSize: (sel.focusRadius ?? 0.03) * 2, since: performance.now() };
    goal.current = null;
  }, [focusKey]);

  const box = useMemo(() => new Box3(), []);
  useFrame((_, delta) => {
    if (!controls || !("fov" in camera)) return;

    const f = focus.current;
    if (f) {
      const mesh = findMesh(scene, f.name);
      if (mesh) goal.current = focusGoal(mesh, box, f.minSize, camera.fov, aspect);
      else if (performance.now() - f.since > FOCUS_WAIT_MS) focus.current = null; // katman yüklenemedi
    }

    const g = goal.current;
    if (!g) return;
    // Kare hızından bağımsız üstel yumuşatma: 60 FPS'te her karede kalan yolun ~%7'si.
    const k = 1 - Math.exp(-CAMERA_SMOOTHING * Math.min(delta, 0.1));
    camera.position.lerp(g.pos, k);
    controls.target.lerp(g.target, k);
    controls.update();
    if (camera.position.distanceToSquared(g.pos) < 1e-6 && controls.target.distanceToSquared(g.target) < 1e-6) {
      goal.current = null;
      focus.current = null;
    }
  });

  return null;
}

/** Görünür (kendisi ve tüm ataları görünür) mesh'i adına göre bulur. */
function findMesh(scene: Object3D, name: string) {
  let hit: Object3D | null = null;
  scene.traverseVisible((o) => {
    if (!hit && (o as { isMesh?: boolean }).isMesh && meshName(o) === name) hit = o;
  });
  return hit as Object3D | null;
}

/** w × h boyutundaki bir alanın dikey ve yatay görüş açısına sığması için gereken kamera uzaklığı. */
function fitDistance(w: number, h: number, fovDeg: number, aspect: number) {
  const vHalf = MathUtils.degToRad(fovDeg) / 2;
  const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  return Math.max(h / (2 * Math.tan(vHalf)), w / (2 * Math.tan(hHalf)));
}

/**
 * Yapıyı kadraja alan kamera hedefi. Kutu merkezi OrbitControls hedefi olur; kamera yapıya önden
 * (vücudun arka yüzündeki yapılarda arkadan) karşıdan bakar. Mesafe = en büyük boyutun sığacağı uzaklık
 * × güvenlik payı + yapının derinliğinin yarısı (kamera yapının içine girmesin).
 */
function focusGoal(mesh: Object3D, box: Box3, minSize: number, fovDeg: number, aspect: number) {
  // Ataların (katman grubu, yan yana kayması) dünya matrisleri de güncellenmeden ölçülürse kutu eski konumda kalır.
  mesh.updateWorldMatrix(true, false);
  box.setFromObject(mesh);
  const center = box.getCenter(new Vector3());
  const dims = box.getSize(new Vector3());
  const maxDim = Math.max(dims.x, dims.y, dims.z, minSize);
  const distance = Math.max(fitDistance(maxDim, maxDim, fovDeg, aspect) * FOCUS_MARGIN + dims.z / 2, MIN_FOCUS_DISTANCE);
  const posterior = center.z < BACK_Z;
  return { target: center, pos: new Vector3(center.x, center.y, center.z + (posterior ? -distance : distance)) };
}

/** Yumuşak zemin gölgesi dokusu (ContactShadows yerine; figürlerle birlikte kayar, ek render geçişi gerektirmez). */
function useShadowTexture(strength: number) {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, `rgba(15,23,42,${strength})`);
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new CanvasTexture(c);
  }, [strength]);
}

/** Her figürün altındaki zemin halkası ve gölge. */
function FloorMarks({ theme }: { theme: SceneTheme }) {
  const visible = useVisibleOrdered();
  const mode = useAnatomyStore((s) => s.viewMode);
  const shadow = useShadowTexture(theme.shadow);
  const offsets = figureOffsets(visible, mode);
  // Katman yokken boş platform çizilmez.
  if (visible.length === 0) return null;
  if (mode === "stacked") return <FloorMark x={0} shadow={shadow} theme={theme} />;
  return (
    <>
      {visible.map((id) => (
        <FloorMark key={id} x={offsets.get(id)!} shadow={shadow} theme={theme} />
      ))}
    </>
  );
}

function FloorMark({ x, shadow, theme }: { x: number; shadow: CanvasTexture; theme: SceneTheme }) {
  const ref = useRef<Group>(null);
  useFrame((_, d) => {
    if (ref.current) ref.current.position.x = MathUtils.damp(ref.current.position.x, x, 7, d);
  });
  return (
    <group ref={ref} position={[x, BODY.floorY - 0.001, 0]} rotation-x={-Math.PI / 2}>
      <mesh>
        <planeGeometry args={[0.75, 0.45]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.33, 0.334, 96]} />
        <meshBasicMaterial color={theme.ring} transparent opacity={theme.ringOpacity} />
      </mesh>
    </group>
  );
}

/** "Yan yana" modunda figür başlıklarını Canvas üstündeki DOM katmanına yansıtır. */
function LabelProjector({ container }: { container: React.RefObject<HTMLDivElement | null> }) {
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const v = useMemo(() => new Vector3(), []);
  useFrame(() => {
    const root = container.current;
    if (!root) return;
    for (const el of Array.from(root.children) as HTMLElement[]) {
      const fig = scene.getObjectByName(`layer:${el.dataset.layer}`);
      if (!fig) continue;
      v.set(fig.position.x, BODY.topY + 0.07, 0).project(camera);
      el.style.transform = `translate(${(v.x * 0.5 + 0.5) * size.width}px, ${(-v.y * 0.5 + 0.5) * size.height}px) translate(-50%, -100%)`;
      el.style.opacity = v.z < 1 ? "1" : "0";
    }
  });
  return null;
}

/** Yükleme göstergesi; Canvas dışında DOM katmanı olarak çizilir (drei Html, Suspense fallback içinde React 19 ile güvenli kaldırılamıyor). */
function Loader() {
  const { active, progress, loaded, total } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="glass flex w-52 flex-col items-center gap-3 rounded-2xl px-5 py-4 text-center" role="status">
        <span className="size-9 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
        <span className="text-xs font-medium text-foreground">Anatomi modeli yükleniyor</span>
        <span className="h-1 w-full overflow-hidden rounded-full bg-line">
          <span className="block h-full rounded-full bg-accent transition-[width]" style={{ width: `${progress}%` }} />
        </span>
        <span className="font-mono text-[10px] text-muted tabular-nums">
          {Math.round(progress)}% · {loaded}/{total} dosya
        </span>
      </div>
    </div>
  );
}

export default function Scene3D() {
  const [lod] = useState(() => {
    const l = pickLod();
    preloadDefaultLayers(l, useAnatomyStore.getState().activeLayers);
    return l;
  });
  const clearSelection = useAnatomyStore((s) => s.setSelectedMesh);
  const mode = useAnatomyStore((s) => s.viewMode);
  const visible = useVisibleOrdered();
  const labels = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();
  const theme = SCENE_THEME[resolvedTheme === "light" ? "light" : "dark"];

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.9, 4.1], fov: 32, near: 0.01, far: 80 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onPointerMissed={() => clearSelection(null)}
      >
        {/* Yumuşak stüdyo ışığı + cyan kenar ışığı */}
        <hemisphereLight args={[theme.sky, theme.ground, theme.hemi]} />
        <ambientLight intensity={theme.ambient} />
        <directionalLight position={[2.5, 4, 3]} intensity={theme.key} />
        <directionalLight position={[-3, 2, -2.5]} intensity={theme.rim} color={theme.rimColor} />
        <directionalLight position={[0, 1, -4]} intensity={theme.back} />

        <Suspense fallback={null}>
          <AnatomyModel lod={lod} />
        </Suspense>
        <FloorMarks theme={theme} />

        <OrbitControls
          makeDefault
          // Boş sahnede döndürülecek bir şey yok; kontroller ilk katman açılınca etkinleşir.
          enabled={visible.length > 0}
          target={[0, BODY.centerY, 0]}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
          zoomSpeed={0.8}
          minDistance={0.25}
          maxDistance={mode === "sideBySide" ? 16 : 6}
          minPolarAngle={0.25}
          maxPolarAngle={Math.PI - 0.35}
          screenSpacePanning
        />
        <CameraRig />
        <LabelProjector container={labels} />
      </Canvas>

      <div ref={labels} className="pointer-events-none absolute inset-0" aria-hidden>
        {mode === "sideBySide" &&
          visible.map((id) => {
            const def = layerDef(id);
            return (
              <div
                key={id}
                data-layer={id}
                className="glass absolute top-0 left-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap"
              >
                <span className="size-1.5 rounded-full" style={{ background: def.color }} />
                {def.short}
              </div>
            );
          })}
      </div>
      {visible.length === 0 ? <EmptySceneHint /> : <ControlsGuide />}
      <Loader />
    </>
  );
}
