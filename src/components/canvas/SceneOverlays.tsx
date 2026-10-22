"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Hand, Layers, Mouse, MouseRight, Move, Rotate3d, X, ZoomIn, type LucideIcon } from "lucide-react";
import { useAnatomyStore } from "@/store/useAnatomyStore";
import { cn } from "@/lib/utils";

/** Geniş ekranda sol katman paneli 3B alanın solunu kapladığı için kaplamalar panelin sağından başlar. */
const PANEL_OFFSET = "md:left-[calc(18rem+1.5rem)]";
/**
 * Sağ üstteki görünüm modu düğmeleriyle (Üst üste / Yan yana) çakışmasın diye: alan dar olduğunda rehber
 * düğmelerin altına iner. Geniş ekranda sol panel ofseti hesaba katılarak (md) daha geniş eşik kullanılır.
 */
const GUIDE_TOP = "top-16 @min-[30rem]:top-3 md:top-16 md:@min-[48rem]:top-3";

const subscribeCoarse = (cb: () => void) => {
  const mq = window.matchMedia("(pointer: coarse)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** Dokunmatik cihazda mı (sunucuda fare varsayılır). */
function useCoarsePointer() {
  return useSyncExternalStore(subscribeCoarse, () => window.matchMedia("(pointer: coarse)").matches, () => false);
}

/**
 * Hiçbir katman seçili değilken 3B alanın ortasında gösterilen yönlendirme kartı.
 * Sahne bu durumda boştur: zemin halkası çizilmez ve kamera kontrolleri kapalıdır.
 */
export function EmptySceneHint() {
  const showLayer = useAnatomyStore((s) => s.showLayer);
  const showAll = useAnatomyStore((s) => s.showAllLayers);

  return (
    <div className={cn("pointer-events-none absolute inset-0 grid place-items-center p-4 pb-24 md:pb-4", "md:pl-[calc(18rem+1.5rem)]")}>
      <div className="glass pointer-events-auto w-full max-w-sm rounded-card p-6 text-center shadow-elev animate-rise" role="status">
        <span className="mx-auto grid size-12 place-items-center rounded-2xl border border-accent/30 bg-accent/10 text-accent">
          <Layers className="size-6" aria-hidden />
        </span>
        <p className="mt-4 text-[15px] leading-relaxed font-medium text-balance">
          İncelemeye başlamak için lütfen sol panelden bir anatomik katman seçin.
        </p>
        <p className="mt-1.5 text-xs text-muted">Seçtiğiniz sistemler yalnızca açıldığında indirilir.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => {
              showLayer("skin");
              showLayer("skeletal");
            }}
            className="h-9 rounded-xl bg-accent px-3.5 text-[13px] font-semibold text-accent-foreground transition hover:bg-accent-strong"
          >
            Deri + İskelet ile başla
          </button>
          <button
            type="button"
            onClick={showAll}
            className="h-9 rounded-xl border border-line px-3.5 text-[13px] font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
          >
            Tümünü göster
          </button>
        </div>
      </div>
    </div>
  );
}

type Tip = { Icon: LucideIcon; action: string; result: string };

const MOUSE_TIPS: Tip[] = [
  { Icon: Mouse, action: "Sol tık + sürükle", result: "Modeli döndür" },
  { Icon: MouseRight, action: "Sağ tık + sürükle", result: "Sahneyi kaydır" },
  { Icon: ZoomIn, action: "Tekerlek", result: "Yakınlaştır / uzaklaştır" },
];
const TOUCH_TIPS: Tip[] = [
  { Icon: Rotate3d, action: "Tek parmakla sürükle", result: "Modeli döndür" },
  { Icon: Move, action: "İki parmakla sürükle", result: "Sahneyi kaydır" },
  { Icon: Hand, action: "İki parmakla sıkıştır", result: "Yakınlaştır / uzaklaştır" },
];

/**
 * Sol üstte kamera kontrol rehberi. Kullanıcı sahneyi ilk kez sürükledikten kısa süre sonra kendiliğinden
 * küçük bir düğmeye dönüşür (model alanını kapatmasın); düğmeyle yeniden açılır.
 */
export function ControlsGuide() {
  const [open, setOpen] = useState(true);
  const coarse = useCoarsePointer();
  const tips = coarse ? TOUCH_TIPS : MOUSE_TIPS;

  useEffect(() => {
    if (!open) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof HTMLCanvasElement) timer ??= setTimeout(() => setOpen(false), 2500);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      clearTimeout(timer);
    };
  }, [open]);

  return (
    <div className={cn("pointer-events-none absolute left-3", GUIDE_TOP, PANEL_OFFSET)}>
      {open ? (
        <section aria-label="3B kontrol rehberi" className="glass pointer-events-auto w-52 rounded-xl p-3 shadow-elev animate-rise">
          <div className="flex items-center justify-between">
            <h2 className="text-[10px] font-medium tracking-[0.12em] text-muted uppercase">{coarse ? "Dokunmatik kontroller" : "Fare kontrolleri"}</h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Kontrol rehberini kapat"
              title="Kapat"
              className="-my-1 -mr-1.5 grid size-8 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <ul className="mt-2 grid gap-1.5">
            {tips.map(({ Icon, action, result }) => (
              <li key={action} className="flex items-center gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-accent/10 text-accent">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block text-[12px] font-medium">{action}</span>
                  <span className="block text-[11px] text-muted">{result}</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Kontrol rehberini göster"
          title="Kontrol rehberi"
          className="glass pointer-events-auto grid size-10 place-items-center rounded-xl text-muted shadow-elev transition hover:text-foreground"
        >
          {coarse ? <Hand className="size-4" aria-hidden /> : <Mouse className="size-4" aria-hidden />}
        </button>
      )}
    </div>
  );
}
