"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useProgress } from "@react-three/drei";
import { Box3, CanvasTexture, type Group, MathUtils, type Object3D, Sphere, Vector3 } from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { AnatomyModel, meshName, preloadDefaultLayers } from "./AnatomyModel";
import { useAnatomyStore } from "@/store/useAnatomyStore";
import { BODY, FIGURE_SPACING, figureOffsets, LAYER_IDS, layerDef, pickLod } from "@/lib/layers";

const ACCENT = "#22d3ee";
const TWEEN_MS = 700;
/** Sol sistem panelinin genişliği + kenar boşluğu (md ve üstü). */
const PANEL_INSET_PX = 300;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Görünür sistemler, dıştan içe sıralı. */
function useVisibleOrdered() {
  const active = useAnatomyStore((s) => s.activeLayers);
  return useMemo(() => LAYER_IDS.filter((id) => active.includes(id)), [active]);
}

/**
 * Görünüm modu veya figür sayısı değişince kamerayı ve OrbitControls hedefini
 * tüm figürleri kadraja alacak konuma yumuşakça taşır.
 */
function CameraRig() {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as OrbitControlsImpl | null;
  const size = useThree((s) => s.size);
  const mode = useAnatomyStore((s) => s.viewMode);
  const resetKey = useAnatomyStore((s) => s.viewResetKey);
  const count = useVisibleOrdered().length;
  const scene = useThree((s) => s.scene);
  const focusKey = useAnatomyStore((s) => s.focusKey);
  const tween = useRef<{ t0: number; fromP: Vector3; toP: Vector3; fromT: Vector3; toT: Vector3 } | null>(null);
  /** Yakınlaşılacak yapı; katmanı henüz yükleniyorsa bulunana kadar beklenir. */
  const pendingFocus = useRef<{ name: string; minRadius: number; frames: number } | null>(null);

  useEffect(() => {
    const sel = useAnatomyStore.getState().selectedMesh;
    if (focusKey && sel) pendingFocus.current = { name: sel.name, minRadius: sel.focusRadius ?? 0.025, frames: 0 };
  }, [focusKey]);

  // "Üst üste" modunda katman açıp kapamak kamerayı oynatmaz; yalnızca yan yana genişliği değişince kadraj güncellenir.
  const layoutKey = mode === "stacked" ? "stacked" : `side:${Math.max(count, 1)}`;
  // Geniş ekranda sol sistem paneli tuvalin bir kısmını kapatır; görüntü merkezi açık alana kaydırılır.
  const inset = size.width >= 768 ? PANEL_INSET_PX : 0;

  useEffect(() => {
    if (!("fov" in camera)) return;
    if (inset) camera.setViewOffset(size.width, size.height, -inset / 2, 0, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, inset]);

  useEffect(() => {
    if (!controls || !("fov" in camera)) return;
    const n = mode === "sideBySide" ? Math.max(count, 1) : 1;
    const width = (n - 1) * FIGURE_SPACING + BODY.width;
    const height = BODY.topY - BODY.floorY;
    const vfov = MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * ((size.width - inset) / size.height));
    const dist = Math.max(height / 2 / Math.tan(vfov / 2), width / 2 / Math.tan(hfov / 2)) * 1.12 + 0.25;
    const toT = new Vector3(0, BODY.centerY, 0);
    tween.current = {
      t0: performance.now(),
      fromP: camera.position.clone(),
      toP: toT.clone().add(new Vector3(0, 0.12, dist)),
      fromT: controls.target.clone(),
      toT,
    };
    // Pencere boyutu tek başına kullanıcının açısını sıfırlamasın diye bağımlılıklara alınmadı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey, resetKey, controls, camera]);

  useFrame(() => {
    const pf = pendingFocus.current;
    if (pf && controls && "fov" in camera) {
      const mesh = findMesh(scene, pf.name);
      if (mesh) {
        pendingFocus.current = null;
        tween.current = focusTween(mesh, pf.minRadius, camera.fov, camera.position, controls.target);
      } else if (++pf.frames > 600) pendingFocus.current = null;
    }

    const tw = tween.current;
    if (!tw || !controls) return;
    const t = Math.min(1, (performance.now() - tw.t0) / TWEEN_MS);
    const e = ease(t);
    camera.position.lerpVectors(tw.fromP, tw.toP, e);
    controls.target.lerpVectors(tw.fromT, tw.toT, e);
    controls.update();
    if (t >= 1) tween.current = null;
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

/** Yapının sınır küresini kadraja alan kamera hareketi; mevcut bakış yönü korunur. */
function focusTween(mesh: Object3D, minRadius: number, fov: number, camPos: Vector3, target: Vector3) {
  const sphere = new Box3().setFromObject(mesh).getBoundingSphere(new Sphere());
  const r = Math.max(sphere.radius, minRadius);
  const dist = (r / Math.sin(MathUtils.degToRad(fov) / 2)) * 1.35;
  const dir = camPos.clone().sub(target).normalize();
  if (dir.lengthSq() < 0.5) dir.set(0, 0, 1);
  // Vücudun arka yüzündeki yapıya (ör. trapez) önden bakılıyorsa kamerayı arkaya çevir; tersi için öne.
  // Figürler yan yana modda yalnızca X ekseninde kaydığı için Z karşılaştırması iki modda da geçerlidir.
  const BACK_Z = -0.04, FRONT_Z = 0.06;
  if (sphere.center.z < BACK_Z && dir.z > 0) dir.set(dir.x, dir.y, -Math.abs(dir.z)).normalize();
  else if (sphere.center.z > FRONT_Z && dir.z < 0) dir.set(dir.x, dir.y, Math.abs(dir.z)).normalize();
  return { t0: performance.now(), fromP: camPos.clone(), toP: sphere.center.clone().addScaledVector(dir, dist), fromT: target.clone(), toT: sphere.center.clone() };
}

/** Yumuşak zemin gölgesi dokusu (ContactShadows yerine; figürlerle birlikte kayar, ek render geçişi gerektirmez). */
function useShadowTexture() {
  return useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(0,0,0,0.65)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
    return new CanvasTexture(c);
  }, []);
}

/** Her figürün altındaki zemin halkası ve gölge. */
function FloorMarks() {
  const visible = useVisibleOrdered();
  const mode = useAnatomyStore((s) => s.viewMode);
  const shadow = useShadowTexture();
  const offsets = figureOffsets(visible, mode);
  if (mode === "stacked" || visible.length === 0) return <FloorMark x={0} shadow={shadow} />;
  return (
    <>
      {visible.map((id) => (
        <FloorMark key={id} x={offsets.get(id)!} shadow={shadow} />
      ))}
    </>
  );
}

function FloorMark({ x, shadow }: { x: number; shadow: CanvasTexture }) {
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
        <meshBasicMaterial color={ACCENT} transparent opacity={0.35} />
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

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 0.9, 4.1], fov: 32, near: 0.01, far: 80 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
        onPointerMissed={() => clearSelection(null)}
      >
        {/* Yumuşak stüdyo ışığı + cyan kenar ışığı */}
        <hemisphereLight args={["#e6f4ff", "#1a2533", 0.9]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[2.5, 4, 3]} intensity={1.6} />
        <directionalLight position={[-3, 2, -2.5]} intensity={0.9} color={ACCENT} />
        <directionalLight position={[0, 1, -4]} intensity={0.4} />

        <Suspense fallback={null}>
          <AnatomyModel lod={lod} />
        </Suspense>
        <FloorMarks />

        <OrbitControls
          makeDefault
          target={[0, BODY.centerY, 0]}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
          zoomSpeed={0.8}
          minDistance={0.5}
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
      <Loader />
    </>
  );
}
