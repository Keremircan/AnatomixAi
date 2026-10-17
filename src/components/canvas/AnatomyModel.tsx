"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Color, DoubleSide, FrontSide, type Group, MathUtils, Mesh, type Material, MeshStandardMaterial, type Object3D } from "three";
import { DRACO_PATH, figureOffsets, LAYERS, modelUrl, type AnatomyLayer, type Lod } from "@/lib/layers";
import { useAnatomyStore, type MeshInfo } from "@/store/useAnatomyStore";

const ACCENT = new Color("#22d3ee");

/** "Üst üste" modunda iç katmanlar açıkken derinin otomatik şeffaflığı (SRS FR-4.3.2). */
const SKIN_OVERLAY_OPACITY = 0.22;
/** Bu değerin altındaki katmanlar tıklamayı alttaki katmana bırakır. */
const PICKABLE_OPACITY = 0.5;
/** Deri dosyasındaki göz yapıları sinir katmanında da var; üst üste modda ikisi birlikte açıksa derideki kopya gizlenir. */
const SKIN_EYES = /^SKN\.(sclera|iris)\./;

/** Seçim/üzerine gelme için orijinali bozmadan türetilmiş malzeme (önbellekli). */
const variants = new WeakMap<Material, { hover: Material; select: Material }>();
function variantOf(base: Material, kind: "hover" | "select") {
  let v = variants.get(base);
  if (!v) {
    const make = (intensity: number) => {
      const m = base.clone() as MeshStandardMaterial;
      if ("emissive" in m) {
        m.emissive = ACCENT.clone();
        m.emissiveIntensity = intensity;
      }
      m.transparent = false;
      m.opacity = 1;
      m.depthWrite = true;
      return m;
    };
    const select = make(0.65);
    // Seçili yapı (ör. eklem içindeki menisküs) üstteki dokuların arkasından da görünsün.
    select.depthTest = false;
    select.transparent = true;
    select.opacity = 0.92;
    v = { hover: make(0.25), select };
    variants.set(base, v);
  }
  return v[kind];
}

type Originals = Map<Mesh, Material>;

/** GLTFLoader düğüm adındaki noktaları siler; orijinal ad ("SKL.patella.R") userData.name'de kalır. */
export const meshName = (o: Object3D) => (o.userData.name as string | undefined) ?? o.name;

/** Zar ve fasyalar dosyada extras.hidden ile işaretlidir (ör. MUS.*_fascia, RES.pleura). */
const isEnvelope = (o: Object3D) => !!o.userData.hidden;

function collectOriginals(scene: Object3D): Originals {
  const map: Originals = new Map();
  scene.traverse((o) => {
    if (o instanceof Mesh) map.set(o, o.material as Material);
  });
  return map;
}

/** Katman şeffaflığını dosyanın kendi malzemelerine uygular. */
function applyOpacity(originals: Originals, opacity: number, isSkin: boolean) {
  const translucent = opacity < 0.999;
  for (const mat of new Set(originals.values())) {
    mat.transparent = translucent;
    mat.opacity = opacity;
    mat.depthWrite = !translucent;
    // Opak deride arka yüz de çizilir: parça birleşimlerindeki mikro boşluklar zemin yerine deri rengiyle görünür.
    // Saydamken tek yüz (çift katman görüntüsü olmasın).
    if (isSkin) mat.side = translucent ? FrontSide : DoubleSide;
    mat.needsUpdate = true;
  }
}

/** Zar/fasya ve çakışan göz yapılarının görünürlüğü. */
function applyMeshVisibility(originals: Originals, showEnvelopes: boolean, hideSkinEyes: boolean) {
  for (const mesh of originals.keys()) {
    mesh.visible = (showEnvelopes || !isEnvelope(mesh)) && !(hideSkinEyes && SKIN_EYES.test(meshName(mesh)));
  }
}

/** Seçili ve üzerine gelinen mesh'lere türetilmiş malzeme uygular, diğerlerini geri yükler. */
function applyHighlight(originals: Originals, selected?: string, hovered?: string) {
  for (const [mesh, base] of originals) {
    const name = meshName(mesh);
    const isSelected = name === selected;
    mesh.material = isSelected ? variantOf(base, "select") : name === hovered ? variantOf(base, "hover") : base;
    mesh.renderOrder = isSelected ? 20 : base.transparent ? 10 : 0;
  }
}

function infoOf(obj: Object3D, layer: AnatomyLayer): MeshInfo {
  const extras = obj.userData as { label?: string; group?: string };
  return { name: meshName(obj), label: extras.label, group: extras.group, layer };
}

type FileProps = { url: string; layer: AnatomyLayer; opacity: number; pickable: boolean; hideSkinEyes: boolean };

/** Bir sistem dosyası (ör. skeletal.glb). Yüklenen sahne useGLTF önbelleğinden gelir; kopyalanmaz. */
function SystemFile({ url, layer, opacity, pickable, hideSkinEyes }: FileProps) {
  const { scene } = useGLTF(url, DRACO_PATH);
  const setSelected = useAnatomyStore((s) => s.setSelectedMesh);
  const setHovered = useAnatomyStore((s) => s.setHoveredMesh);
  const selected = useAnatomyStore((s) => s.selectedMesh?.name);
  const hovered = useAnatomyStore((s) => s.hoveredMesh?.name);
  const showEnvelopes = useAnatomyStore((s) => s.showEnvelopes);

  // Orijinal malzemeler bir kez kaydedilir; dosyaların kendisi değiştirilmez.
  const originals = useMemo(() => collectOriginals(scene), [scene]);
  useEffect(() => applyOpacity(originals, opacity, layer === "skin"), [originals, opacity, layer]);
  useEffect(() => applyMeshVisibility(originals, showEnvelopes, hideSkinEyes), [originals, showEnvelopes, hideSkinEyes]);
  useEffect(() => applyHighlight(originals, selected, hovered), [originals, selected, hovered, opacity]);

  // Olay arkadaki katmana geçsin diye uygun olmayan durumda stopPropagation çağrılmaz.
  const eligible = (e: ThreeEvent<PointerEvent | MouseEvent>) => pickable && e.object instanceof Mesh && e.object.visible;

  return (
    <primitive
      object={scene}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        if (!eligible(e)) return;
        e.stopPropagation();
        setHovered(infoOf(e.object, layer));
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        if (!eligible(e)) return;
        if (useAnatomyStore.getState().hoveredMesh?.name === meshName(e.object)) setHovered(null);
        document.body.style.cursor = "";
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!eligible(e)) return;
        e.stopPropagation();
        setSelected(infoOf(e.object, layer));
      }}
    />
  );
}

/** Bir anatomik sistem figürü; X konumu hedefe doğru yumuşakça kayar. */
function LayerFigure({ id, lod, visible, x, opacity, pickable, hideSkinEyes }: {
  id: AnatomyLayer; lod: Lod; visible: boolean; x: number; opacity: number; pickable: boolean; hideSkinEyes: boolean;
}) {
  const ref = useRef<Group>(null);
  const placed = useRef(false);

  useFrame((_, delta) => {
    const g = ref.current;
    if (!g) return;
    // İlk kez görünen figür yerine "ışınlanır"; sonrasında kayarak geçer.
    if (!placed.current || !visible) {
      g.position.x = x;
      placed.current = visible;
      return;
    }
    g.position.x = MathUtils.damp(g.position.x, x, 7, delta);
  });

  return (
    <group ref={ref} visible={visible} name={`layer:${id}`}>
      {/* Her katman kendi Suspense sınırında: yeni bir sistem yüklenirken diğerleri ekranda kalır. */}
      <Suspense fallback={null}>
        <SystemFile url={modelUrl(lod, id)} layer={id} opacity={opacity} pickable={visible && pickable} hideSkinEyes={hideSkinEyes} />
      </Suspense>
    </group>
  );
}

export function AnatomyModel({ lod }: { lod: Lod }) {
  const active = useAnatomyStore((s) => s.activeLayers);
  const loaded = useAnatomyStore((s) => s.loadedLayers);
  const mode = useAnatomyStore((s) => s.viewMode);
  const userOpacity = useAnatomyStore((s) => s.layerOpacity);

  const offsets = useMemo(() => figureOffsets(active, mode), [active, mode]);
  const innerOn = active.some((l) => l !== "skin");
  const eyesClash = mode === "stacked" && active.includes("nervous");

  useEffect(() => () => void (document.body.style.cursor = ""), []);

  return (
    <group>
      {LAYERS.filter((l) => loaded.includes(l.id)).map((layer) => {
        const autoSkin = mode === "stacked" && layer.id === "skin" && innerOn ? SKIN_OVERLAY_OPACITY : 1;
        const opacity = userOpacity[layer.id] * autoSkin;
        return (
          <LayerFigure
            key={`${lod}/${layer.id}`}
            id={layer.id}
            lod={lod}
            visible={active.includes(layer.id)}
            x={offsets.get(layer.id) ?? 0}
            opacity={opacity}
            pickable={opacity >= PICKABLE_OPACITY}
            hideSkinEyes={layer.id === "skin" && eyesClash}
          />
        );
      })}
    </group>
  );
}

/** Varsayılan katmanları sahne açılmadan önce indirmeye başla. */
export function preloadDefaultLayers(lod: Lod, layers: AnatomyLayer[]) {
  for (const id of layers) useGLTF.preload(modelUrl(lod, id), DRACO_PATH);
}
