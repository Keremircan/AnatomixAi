"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import {
  type BufferGeometry, Color, DoubleSide, FrontSide, type Group, MathUtils, Mesh, type Material, MeshBasicMaterial, MeshStandardMaterial,
  NotEqualStencilFunc, type Object3D, ReplaceStencilOp,
} from "three";
import { DRACO_PATH, figureOffsets, LAYERS, modelUrl, type AnatomyLayer, type Lod } from "@/lib/layers";
import { useAnatomyStore, type MeshInfo } from "@/store/useAnatomyStore";

const ACCENT = new Color("#22d3ee");

/**
 * Anatomik derinlik sırası (dıştan içe; büyük = daha dışta). Üst üste modda iç içe geçen katmanların
 * birbirini ezmemesi için hem çizim sırası (renderOrder) hem de derinlik ofseti (polygonOffset) buna göre verilir.
 */
const LAYER_DEPTH: Record<AnatomyLayer, number> = {
  skin: 6,
  muscular: 5,
  joints: 4,
  skeletal: 3,
  digestive: 2, respiratory: 2, urinary: 2, genital: 2, endocrine: 2,
  circulatory: 1, lymphatic: 1, nervous: 1,
};
/** Saydam katmanlar tüm opak katmanlardan sonra, dıştaki en son çizilir. */
const TRANSLUCENT_ORDER_BASE = 10;
const SELECTED_ORDER = 30;
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
      m.alphaTest = 0;
      m.stencilWrite = false;
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
    if (o instanceof Mesh && !o.userData.isDepthPrepass) map.set(o, o.material as Material);
  });
  return map;
}

/** Normal verisi hiç yoksa ya da bozuksa (NaN / sıfır uzunluk) yeniden hesaplanır; sağlam normallere dokunulmaz. */
function repairNormals(geometry: BufferGeometry) {
  const n = geometry.getAttribute("normal");
  if (n) {
    let ok = true;
    for (let i = 0; i < n.count && ok; i++) {
      const len = Math.hypot(n.getX(i), n.getY(i), n.getZ(i));
      ok = Number.isFinite(len) && len > 1e-4;
    }
    if (ok) return;
  }
  geometry.computeVertexNormals();
}

/** Kıllar (saç, kaş, kirpik, pubik) yoğun ince geometridir; saydam deride tek katman geçişine katılmaz, silik çizilir. */
const isHair = (m: Material) => m.name === "AX_hair";

/**
 * Saydam deri için derinlik ön geçişi: her deri parçasının altına yalnızca derinlik yazan bir kopya eklenir.
 * Renk geçişi bu derinlikle eşleşen (en öndeki) yüzeyi stencil ile tek bir kez boyar; üst üste binen parçalar
 * iki kez karışıp koyu bant / yırtılma oluşturmaz, arkada kalan deri yüzeyleri öndekinin içinden görünmez.
 */
function ensureDepthPrepass(originals: Originals) {
  let material: MeshBasicMaterial | undefined;
  for (const [mesh, base] of originals) {
    if (mesh.userData.depthPrepass || isHair(base)) continue;
    material ??= new MeshBasicMaterial({ colorWrite: false, depthWrite: true, transparent: true, side: DoubleSide, polygonOffset: true });
    const pre = new Mesh(mesh.geometry, material);
    pre.userData.isDepthPrepass = true;
    pre.raycast = () => {};
    pre.visible = false;
    mesh.add(pre);
    mesh.userData.depthPrepass = pre;
  }
}

/**
 * Katman şeffaflığı ve iç içe katman hiyerarşisi.
 * - Opak katman: derinliğe yazar (depthWrite), normal sırada çizilir. Deri gibi dış katmanlar, neredeyse
 *   çakışan iç yüzeylerle (ör. deri altı kas) titreşmesin (z-fighting) diye polygonOffset ile kameraya doğru
 *   çok az öne alınır; dıştaki katman çakışmada her zaman önde kalır.
 * - Saydam katman: derinliğe yazmaz (arkasındaki katmanları silmez), opak katmanlardan sonra ve dıştan içe
 *   değil içten dışa sırayla çizilir; kendi arka yüzleri görünmesin diye yalnızca ön yüzler çizilir.
 */
function applyOpacity(originals: Originals, opacity: number, layer: AnatomyLayer) {
  const translucent = opacity < 0.999;
  const depth = LAYER_DEPTH[layer];
  const skin = layer === "skin";
  // Saydam deri: derinlik ön geçişi + stencil ile tek katman (bkz. ensureDepthPrepass)
  const prepass = skin && translucent;
  const factor = -depth * 0.5;
  const units = -depth * 2;
  for (const mat of new Set(originals.values())) {
    (mat.userData as { baseSide?: number }).baseSide ??= mat.side;
    const baseSide = (mat.userData as { baseSide: number }).baseSide;
    const single = prepass && !isHair(mat);
    mat.transparent = translucent;
    mat.opacity = opacity;
    mat.depthWrite = !translucent || single;
    mat.alphaTest = single ? 0.05 : 0;
    mat.polygonOffset = true;
    mat.polygonOffsetFactor = factor;
    mat.polygonOffsetUnits = units;
    // Deri her durumda çift yüzlü: ters sarılmış parçalar ve birleşimlerdeki mikro boşluklar delik gibi görünmez.
    // Diğer saydam katmanlarda kendi arka yüzleri görünmesin diye yalnızca ön yüz çizilir.
    mat.side = skin && !(translucent && isHair(mat)) ? DoubleSide : translucent ? FrontSide : (baseSide as typeof FrontSide);
    mat.forceSinglePass = skin;
    mat.stencilWrite = single;
    mat.stencilRef = 1;
    mat.stencilFunc = NotEqualStencilFunc;
    mat.stencilZPass = ReplaceStencilOp;
    mat.needsUpdate = true;
  }
  for (const [mesh, base] of originals) {
    // Saydam deride kıllar deri yüzeyinden sonra çizilir (derinlik yazmadıkları için deriyi örtmezler).
    mesh.userData.baseOrder = translucent ? TRANSLUCENT_ORDER_BASE + depth + (prepass && isHair(base) ? 0.25 : 0) : 0;
    mesh.renderOrder = mesh.userData.baseOrder;
    const pre = mesh.userData.depthPrepass as Mesh<BufferGeometry, MeshBasicMaterial> | undefined;
    if (pre) {
      pre.visible = prepass;
      // Kendi rengi boyanmadan hemen önce, iç katmanların saydam geçişlerinden sonra çizilir.
      pre.renderOrder = mesh.userData.baseOrder - 0.5;
      pre.material.polygonOffsetFactor = factor;
      pre.material.polygonOffsetUnits = units;
    }
  }
}

/**
 * Zar/fasya ve çakışan göz yapılarının görünürlüğü.
 * `occluded`: üst üste modda deri tamamen opakken içerideki katmanlar zaten görünmez; yine de çizilirlerse deri
 * parçaları arasındaki piksel altı çatlaklardan (dosyadaki T-birleşimler) kemik vb. beyaz nokta/çizgi olarak sızar.
 * Bu durumda yalnızca seçili yapı (derinin içinden vurgulu çizilir) görünür kalır.
 */
function applyMeshVisibility(originals: Originals, showEnvelopes: boolean, hideSkinEyes: boolean, occluded: boolean, selected?: string) {
  for (const mesh of originals.keys()) {
    const name = meshName(mesh);
    mesh.visible = occluded ? name === selected : (showEnvelopes || !isEnvelope(mesh)) && !(hideSkinEyes && SKIN_EYES.test(name));
  }
}

/** Seçili ve üzerine gelinen mesh'lere türetilmiş malzeme uygular, diğerlerini geri yükler. */
function applyHighlight(originals: Originals, selected?: string, hovered?: string) {
  for (const [mesh, base] of originals) {
    const name = meshName(mesh);
    const isSelected = name === selected;
    mesh.material = isSelected ? variantOf(base, "select") : name === hovered ? variantOf(base, "hover") : base;
    // Seçili yapı her şeyin üstünde (depthTest kapalı) çizilir; diğerleri katman sırasına döner.
    mesh.renderOrder = isSelected ? SELECTED_ORDER : ((mesh.userData.baseOrder as number | undefined) ?? 0);
  }
}

function infoOf(obj: Object3D, layer: AnatomyLayer): MeshInfo {
  const extras = obj.userData as { label?: string; group?: string };
  return { name: meshName(obj), label: extras.label, group: extras.group, layer };
}

type FileProps = { url: string; layer: AnatomyLayer; opacity: number; pickable: boolean; hideSkinEyes: boolean; occluded: boolean };

/** Bir sistem dosyası (ör. skeletal.glb). Yüklenen sahne useGLTF önbelleğinden gelir; kopyalanmaz. */
function SystemFile({ url, layer, opacity, pickable, hideSkinEyes, occluded }: FileProps) {
  const { scene } = useGLTF(url, DRACO_PATH);
  const setSelected = useAnatomyStore((s) => s.setSelectedMesh);
  const setHovered = useAnatomyStore((s) => s.setHoveredMesh);
  const selected = useAnatomyStore((s) => s.selectedMesh?.name);
  const hovered = useAnatomyStore((s) => s.hoveredMesh?.name);
  const showEnvelopes = useAnatomyStore((s) => s.showEnvelopes);

  // Orijinal malzemeler bir kez kaydedilir; dosyaların kendisi değiştirilmez.
  const originals = useMemo(() => {
    const map = collectOriginals(scene);
    if (layer === "skin") {
      for (const mesh of map.keys()) repairNormals(mesh.geometry as BufferGeometry);
      ensureDepthPrepass(map);
    }
    return map;
  }, [scene, layer]);
  useEffect(() => applyOpacity(originals, opacity, layer), [originals, opacity, layer]);
  useEffect(
    () => applyMeshVisibility(originals, showEnvelopes, hideSkinEyes, occluded, selected),
    [originals, showEnvelopes, hideSkinEyes, occluded, selected],
  );
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
function LayerFigure({ id, lod, visible, x, opacity, pickable, hideSkinEyes, occluded }: {
  id: AnatomyLayer; lod: Lod; visible: boolean; x: number; opacity: number; pickable: boolean; hideSkinEyes: boolean; occluded: boolean;
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
        <SystemFile url={modelUrl(lod, id)} layer={id} opacity={opacity} pickable={visible && pickable} hideSkinEyes={hideSkinEyes} occluded={occluded} />
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
  const eyesClash = mode === "stacked" && active.includes("nervous");
  // Üst üste modda tam opak deri, içindeki tüm katmanları örter.
  const skinCovers = mode === "stacked" && active.includes("skin") && userOpacity.skin >= 0.999;

  useEffect(() => () => void (document.body.style.cursor = ""), []);

  return (
    <group>
      {LAYERS.filter((l) => loaded.includes(l.id)).map((layer) => {
        // Şeffaflık yalnızca kullanıcının kaydırıcıda seçtiği değerdir; deri dahil hiçbir katman kendiliğinden silikleşmez.
        const opacity = userOpacity[layer.id];
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
            occluded={skinCovers && layer.id !== "skin"}
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
