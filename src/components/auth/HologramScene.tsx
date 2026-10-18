"use client";

import { Suspense, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { Canvas, useFrame, useThree, type RootState } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { AdditiveBlending, Color, FrontSide, Group, Mesh, MathUtils, ShaderMaterial, Vector3, type PerspectiveCamera } from "three";
import { BODY, DRACO_PATH, modelUrl } from "@/lib/layers";
import { FADE_SECONDS, HOLOGRAM_PHASES, PHASE_SECONDS } from "./hologramPhases";

/* ───────────────────────── Hologram malzemesi ─────────────────────────
 * Kenarlarda parlayan (fresnel) yarı saydam yüzey + ince yatay tarama çizgileri. Tarama ışığının dünya
 * yüksekliğine (uScanY) yakın pikseller parlar, ışığın geçtiği üst kısımda kısa süre iz kalır.
 * Toplamalı (additive) karıştırma: katmanlar birbirinin içinden görünür, derinlik yazılmaz. */

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vY;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vY = world.y;
    vec4 mv = viewMatrix * world;
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uScanY;
  uniform float uScan;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vY;
  void main() {
    float facing = abs(dot(normalize(vNormal), normalize(vView)));
    float rim = pow(1.0 - facing, 2.2);
    float body = 0.09 + rim * 1.05;
    float lines = 0.82 + 0.18 * sin(vY * 380.0 - uTime * 3.0);

    float d = vY - uScanY;
    float core = exp(-d * d / 0.0016) * uScan;
    float trail = (d > 0.0 ? exp(-d / 0.18) : exp(d / 0.03)) * 0.9 * uScan;

    vec3 color = uColor * (body * lines + trail * 1.6) + vec3(0.75, 1.0, 1.0) * core * 1.6 + uColor * core * 1.4;
    float alpha = clamp((body * lines * 0.85 + trail * 0.5 + core) * uOpacity, 0.0, 1.0);
    gl_FragColor = vec4(color, alpha);
  }
`;

type ScanUniforms = { uScanY: { value: number }; uScan: { value: number }; uTime: { value: number } };

function createHoloMaterial(color: string, shared: ScanUniforms) {
  return new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: { uColor: { value: new Color(color) }, uOpacity: { value: 0 }, ...shared },
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    side: FrontSide,
  });
}

/** Zemin halkası: figürün ayağının altında yumuşak ışıma. */
const floorShader = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uColor;
    uniform float uTime;
    varying vec2 vUv;
    void main() {
      float r = length(vUv - 0.5) * 2.0;
      float glow = pow(max(0.0, 1.0 - r), 2.4) * 0.35;
      float ring = smoothstep(0.012, 0.0, abs(r - 0.62)) * 0.55 + smoothstep(0.008, 0.0, abs(r - 0.86)) * 0.25;
      float pulse = smoothstep(0.03, 0.0, abs(r - fract(uTime * 0.25))) * (1.0 - r) * 0.5;
      float a = glow + ring + pulse;
      gl_FragColor = vec4(uColor * a, a);
    }
  `,
};

/* ───────────────────────── Sahne parçaları ───────────────────────── */

const MESH_LOD = "mobile" as const;
for (const phase of HOLOGRAM_PHASES) for (const f of phase.files) useGLTF.preload(modelUrl(MESH_LOD, f), DRACO_PATH);

/**
 * Bir katmanın dosyaları. Sahneler useGLTF önbelleğinden gelir ve ana uygulamayla paylaşılır; bu yüzden
 * kopyalanır (geometri ortak kalır) ve malzeme yalnızca kopyada değiştirilir. Zar/fasya (extras.hidden) gizlenir.
 */
function PhaseModel({ files, material, onReady }: { files: string[]; material: ShaderMaterial; onReady: () => void }) {
  const gltfs = useGLTF(files.map((f) => modelUrl(MESH_LOD, f as never)), DRACO_PATH);
  const roots = useMemo(
    () =>
      gltfs.map(({ scene }) => {
        const root = scene.clone(true);
        root.traverse((o) => {
          if (!(o as Mesh).isMesh) return;
          const mesh = o as Mesh;
          mesh.material = material;
          mesh.visible = !mesh.userData.hidden;
          mesh.raycast = () => {};
        });
        return root;
      }),
    [gltfs, material],
  );
  useEffect(onReady, [onReady]);
  return (
    <>
      {roots.map((r) => (
        <primitive key={r.uuid} object={r} />
      ))}
    </>
  );
}

/** Kamerayı figürün tamamı (zemin halkası dahil) sığacak uzaklığa yerleştirir. */
function FitCamera() {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const { width, height } = useThree((s) => s.size);
  useLayoutEffect(() => {
    const tan = Math.tan(MathUtils.degToRad(camera.fov / 2));
    const halfH = (BODY.topY - BODY.floorY) / 2 + 0.12;
    const halfW = 0.5;
    const dist = Math.max(halfH / tan, halfW / (tan * (width / height)));
    const cy = (BODY.topY + BODY.floorY) / 2 - 0.02;
    camera.position.set(0, cy, dist);
    camera.lookAt(0, cy, 0);
    camera.updateProjectionMatrix();
  }, [camera, width, height]);
  return null;
}

export type HologramSceneProps = {
  /** Tarama ışığının DOM öğesi; sahne ışığın ekrandaki yüksekliğini her karede okur. */
  beamRef: React.RefObject<HTMLElement | null>;
  /** İstenen katman (sırası); `nonce` her tıklamada değişir. */
  request: { index: number; nonce: number } | null;
  reducedMotion: boolean;
  onPhaseChange: (index: number) => void;
  onReady: () => void;
};

/** Sahnenin değişken (her karede güncellenen) nesneleri; React render'ının dışında yaşar. */
function createHologram() {
  const shared: ScanUniforms = { uScanY: { value: -10 }, uScan: { value: 0 }, uTime: { value: 0 } };
  return {
    shared,
    materials: HOLOGRAM_PHASES.map((p) => createHoloMaterial(p.color, shared)),
    floor: new ShaderMaterial({
      ...floorShader,
      uniforms: { uColor: { value: new Color("#22d3ee") }, uTime: shared.uTime },
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
    }),
    figure: null as Group | null,
    groups: [] as (Group | null)[],
    ready: new Set<number>(),
    cycle: { current: -1, previous: -1, start: 0, nonce: null as number | null },
    tmp: new Vector3(),
  };
}
type HologramState = ReturnType<typeof createHologram>;

/** Grup referanslarını kare döngüsünün okuyacağı yere bağlar ("figure" = dönen kök grup). */
function attachGroup(h: HologramState, slot: "figure" | number, g: Group | null) {
  if (slot === "figure") h.figure = g;
  else h.groups[slot] = g;
}

function disposeHologram(h: HologramState) {
  for (const m of [...h.materials, h.floor]) m.dispose();
}

/** Tek kare: katman döngüsü ve çapraz solma, dönüş, tarama ışığının modele izdüşümü. */
function stepHologram(h: HologramState, { clock, camera, gl }: RootState, props: HologramSceneProps) {
  const { request, reducedMotion, onPhaseChange } = props;
  const t = clock.elapsedTime;
  const c = h.cycle;

  // Katman seçimi (alt şeritteki düğmeler): seçilen katman hemen başlar.
  if (request && request.nonce !== c.nonce && h.ready.has(request.index)) {
    c.nonce = request.nonce;
    if (request.index !== c.current) {
      c.previous = c.current;
      c.current = request.index;
      c.start = t;
      onPhaseChange(c.current);
    }
  }
  if (c.current < 0 && h.ready.has(0)) {
    c.current = 0;
    c.start = t;
    onPhaseChange(0);
  } else if (c.current >= 0 && !reducedMotion && t - c.start > PHASE_SECONDS) {
    // Sıradaki yüklenmiş katmana geç
    for (let k = 1; k < HOLOGRAM_PHASES.length; k++) {
      const i = (c.current + k) % HOLOGRAM_PHASES.length;
      if (h.ready.has(i)) {
        c.previous = c.current;
        c.current = i;
        onPhaseChange(i);
        break;
      }
    }
    c.start = t;
  }

  // Çapraz solma
  const k = reducedMotion ? 1 : MathUtils.smoothstep(t - c.start, 0, FADE_SECONDS);
  h.materials.forEach((m, i) => {
    const o = i === c.current ? k : i === c.previous ? 1 - k : 0;
    m.uniforms.uOpacity.value = o;
    const g = h.groups[i];
    if (g) g.visible = o > 0.003;
  });

  h.shared.uTime.value = t;
  // Önden görünüm etrafında yavaş salınım (yan profil, figürü çizgi gibi inceltiyor).
  if (h.figure && !reducedMotion) h.figure.rotation.y = Math.sin(t * 0.32) * 0.62;

  // DOM'daki tarama ışığının ekran yüksekliğini figürün bulunduğu z = 0 düzlemine izdüşür.
  const beam = props.beamRef.current;
  if (beam) {
    const b = beam.getBoundingClientRect();
    const r = gl.domElement.getBoundingClientRect();
    // Işık çizgisi, kayan kutunun üst kenarındadır.
    const ndcY = 1 - (2 * (b.top - r.top)) / r.height;
    const dir = h.tmp.set(0, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
    h.shared.uScanY.value = camera.position.y + (dir.y * -camera.position.z) / dir.z;
    h.shared.uScan.value = reducedMotion ? 0 : Number(getComputedStyle(beam).opacity) || 0;
  }
}

function Hologram(props: HologramSceneProps) {
  const { onReady } = props;
  const [h] = useState(createHologram);
  useEffect(() => () => disposeHologram(h), [h]);

  const readyHandlers = useMemo(
    () =>
      HOLOGRAM_PHASES.map((_, i) => () => {
        h.ready.add(i);
        if (i === 0) onReady();
      }),
    [h, onReady],
  );

  useFrame((state) => stepHologram(h, state, props));

  return (
    <>
      <FitCamera />
      <group ref={(g) => attachGroup(h, "figure", g)}>
        {HOLOGRAM_PHASES.map((p, i) => (
          <group key={p.id} ref={(g) => attachGroup(h, i, g)}>
            <Suspense fallback={null}>
              <PhaseModel files={p.files} material={h.materials[i]} onReady={readyHandlers[i]} />
            </Suspense>
          </group>
        ))}
      </group>
      <mesh position={[0, BODY.floorY - 0.005, 0]} rotation-x={-Math.PI / 2} material={h.floor} raycast={() => {}}>
        <planeGeometry args={[1.3, 1.3]} />
      </mesh>
    </>
  );
}

export default function HologramScene(props: HologramSceneProps) {
  return (
    <Canvas
      dpr={[1, 1.75]}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      camera={{ fov: 24, near: 0.1, far: 30, position: [0, BODY.centerY, 6] }}
      style={{ position: "absolute", inset: 0 }}
      aria-hidden
    >
      <Hologram {...props} />
    </Canvas>
  );
}
