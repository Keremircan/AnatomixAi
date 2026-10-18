import { CanvasContainer } from "@/components/canvas/CanvasContainer";
import { LayerControls, ViewModeToggle } from "@/components/LayerControls";
import { SelectionBadge } from "@/components/SelectionBadge";
import { SymptomPanel } from "@/components/SymptomPanel";
import { AnalysisResultCard } from "@/components/AnalysisResultCard";

/**
 * Bölünmüş düzen: geniş ekranda solda 3B çalışma alanı, sağda kendi içinde kayan semptom/triyaj paneli;
 * dar ekranda 3B alan üstte sabit yükseklikte, panel altında.
 */
export default function Home() {
  return (
    <main className="grid flex-1 grid-cols-[minmax(0,1fr)] gap-3 p-3 sm:gap-4 sm:p-4 lg:h-[calc(100dvh-4rem-1px)] lg:flex-none lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)] lg:grid-rows-[minmax(0,1fr)] lg:overflow-hidden">
      <section
        aria-label="3B anatomi çalışma alanı"
        className="relative h-[68svh] min-h-[460px] overflow-hidden rounded-card border border-line bg-[radial-gradient(60%_55%_at_50%_45%,var(--scene-glow),transparent_70%)] lg:h-auto lg:min-h-0"
      >
        <CanvasContainer />

        {/* Sistem paneli: geniş ekranda sol kenarda dikey, dar ekranda altta yatay */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center md:inset-x-auto md:top-3 md:bottom-3 md:left-3 md:block">
          <LayerControls className="pointer-events-auto max-w-full overflow-x-auto md:max-h-full md:w-72 md:overflow-y-auto" />
        </div>

        <div className="pointer-events-none absolute top-3 right-3">
          <ViewModeToggle className="pointer-events-auto" />
        </div>

        <div className="pointer-events-none absolute right-3 bottom-20 md:bottom-3">
          <div className="pointer-events-auto">
            <SelectionBadge />
          </div>
        </div>
      </section>

      <aside aria-label="Semptom ve triyaj" className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3 lg:overflow-y-auto lg:pr-1 lg:pb-2">
        <SymptomPanel />
        <AnalysisResultCard />
      </aside>
    </main>
  );
}
