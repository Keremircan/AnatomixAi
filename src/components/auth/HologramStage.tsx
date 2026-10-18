"use client";

import { Component, useCallback, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { HOLOGRAM_PHASES, PHASE_SECONDS } from "./hologramPhases";

const HologramScene = dynamic(() => import("./HologramScene"), { ssr: false });

/** WebGL yoksa ya da model yüklenemezse sahne sessizce kaybolur; tarama ışığı ve çerçeve kalır. */
class SceneBoundary extends Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/**
 * Sayfa (Activity) görünürken true. Gizlenince efektler temizlenir; abonelik bu temizliği bildirir.
 * Sunucuda ve ilk hidrasyonda false döner, böylece sahne yalnızca istemcide kurulur.
 */
function usePageVisible() {
  const [store] = useState(() => {
    let visible = false;
    const listeners = new Set<() => void>();
    return {
      subscribe(cb: () => void) {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      get: () => visible,
      set(v: boolean) {
        visible = v;
        listeners.forEach((l) => l());
      },
    };
  });
  useLayoutEffect(() => {
    store.set(true);
    return () => store.set(false);
  }, [store]);
  return useSyncExternalStore(store.subscribe, store.get, () => false);
}

const CORNERS = [
  "top-0 left-0 border-t border-l rounded-tl-2xl",
  "top-0 right-0 border-t border-r rounded-tr-2xl",
  "bottom-0 left-0 border-b border-l rounded-bl-2xl",
  "bottom-0 right-0 border-b border-r rounded-br-2xl",
];

/**
 * Giriş ekranının sol kolonu: medikal hologram. İskelet, dolaşım ve iç organlar sırayla yumuşakça birbirine
 * dönüşür; üzerinden kenarları dağılmış bir tarama ışığı geçer. Yalnızca geniş ekranda ve sayfa görünürken
 * 3B sahne kurulur (dar ekranda ~2 MB model indirilmez; sayfa gizlenince WebGL bağlamı serbest kalır).
 */
export function HologramStage({ className }: { className?: string }) {
  const wide = useMedia("(min-width: 64rem)");
  const reducedMotion = useMedia("(prefers-reduced-motion: reduce)");
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState(0);
  const [request, setRequest] = useState<{ index: number; nonce: number } | null>(null);
  const beamRef = useRef<HTMLDivElement>(null);

  // Next.js gizlenen sayfayı (Activity) DOM'da tutar; gizliyken sahne kapatılır (WebGL bağlamı serbest kalır).
  const active = usePageVisible();

  const onReady = useCallback(() => setReady(true), []);

  return (
    <div className={cn("relative isolate overflow-hidden", className)} aria-hidden>
      {/* Zemin: merkezde soğuk ışıma ve solan nokta ızgarası */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(50%_45%_at_50%_48%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent_75%)]" />
      <div
        className="absolute inset-0 -z-10 opacity-50"
        style={{
          backgroundImage: "radial-gradient(color-mix(in oklab, var(--accent) 35%, transparent) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
          maskImage: "radial-gradient(ellipse 45% 50% at 50% 50%, #000 20%, transparent 80%)",
        }}
      />

      {wide && active && (
        <SceneBoundary>
          <HologramScene beamRef={beamRef} request={request} reducedMotion={reducedMotion} onPhaseChange={setPhase} onReady={onReady} />
        </SceneBoundary>
      )}

      {/* Biyometrik çerçeve */}
      <div className="pointer-events-none absolute inset-x-[16%] inset-y-[5%]">
        {CORNERS.map((c) => (
          <span key={c} className={cn("absolute size-7 border-accent/50", c)} />
        ))}
      </div>

      {/* Tarama ışığı: yumuşak, kenarları dağılmış ışık huzmesi (sahne bu öğenin yüksekliğini okur) */}
      <div className="pointer-events-none absolute inset-x-0 top-[3%] bottom-[3%] [mask-image:linear-gradient(90deg,transparent,#000_22%,#000_78%,transparent)]">
        <div ref={beamRef} className="absolute inset-x-0 top-0 h-full animate-beam">
          <div className="absolute inset-x-[8%] -top-36 h-36 bg-[radial-gradient(ellipse_50%_100%_at_50%_100%,color-mix(in_oklab,var(--accent)_16%,transparent),transparent_80%)]" />
          <div className="absolute inset-x-[18%] -top-10 h-20 rounded-[50%] bg-[color-mix(in_oklab,var(--accent)_30%,transparent)] blur-2xl" />
          <div className="absolute inset-x-[10%] -top-px h-0.5 bg-gradient-to-r from-transparent via-[color-mix(in_oklab,var(--accent-strong)_85%,white)] to-transparent blur-[1.5px]" />
        </div>
      </div>

      {/* Durum satırı */}
      <div className="absolute top-3 left-4 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-accent/80">
        <span className={cn("size-1.5 rounded-full bg-accent", ready ? "shadow-[0_0_8px_var(--accent)]" : "animate-pulse")} />
        {ready ? "BİYOMETRİK TARAMA" : "MODEL YÜKLENİYOR"}
      </div>
      <div className="absolute top-3 right-4 font-mono text-[10px] tracking-[0.2em] text-muted">
        {String(phase + 1).padStart(2, "0")} / {String(HOLOGRAM_PHASES.length).padStart(2, "0")}
      </div>

      {/* Katman şeridi: hangi katmanın gösterildiği; tıklanınca o katmana geçer */}
      <div className="pointer-events-auto absolute inset-x-0 bottom-2 flex justify-center">
        <div className="flex gap-1 rounded-full border border-line/70 bg-background/50 p-1 backdrop-blur-md">
          {HOLOGRAM_PHASES.map((p, i) => {
            const on = ready && i === phase;
            return (
              <button
                key={p.id}
                type="button"
                tabIndex={-1}
                onClick={() => setRequest({ index: i, nonce: Date.now() })}
                className={cn(
                  "relative overflow-hidden rounded-full px-3 py-1 text-[11px] font-medium transition",
                  on ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground",
                )}
              >
                <span className="relative flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full" style={{ background: p.color, boxShadow: on ? `0 0 8px ${p.color}` : undefined }} />
                  {p.label}
                </span>
                {on && !reducedMotion && (
                  <span
                    key={`${phase}-${request?.nonce ?? 0}`}
                    className="absolute inset-x-2 bottom-0 h-px origin-left animate-phase-progress"
                    style={{ background: p.color, animationDuration: `${PHASE_SECONDS}s` }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
