"use client";

import { Crosshair, MousePointerClick, X } from "lucide-react";
import { describeMesh, layerDef } from "@/lib/layers";
import { useAnatomyStore } from "@/store/useAnatomyStore";

/** Seçili (yoksa üzerine gelinen) yapının adını gösteren köşe rozeti. */
export function SelectionBadge() {
  const selected = useAnatomyStore((s) => s.selectedMesh);
  const hovered = useAnatomyStore((s) => s.hoveredMesh);
  const clear = useAnatomyStore((s) => s.setSelectedMesh);
  const mesh = selected ?? hovered;

  if (!mesh) {
    return (
      <div className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted">
        <MousePointerClick className="size-4" aria-hidden />
        Bir yapıyı seçmek için üzerine tıklayın
      </div>
    );
  }

  const d = describeMesh(mesh.name, mesh.label);
  return (
    <div className="glass flex max-w-[min(22rem,calc(100vw-2rem))] items-start gap-3 rounded-xl px-3.5 py-3 animate-rise" aria-live="polite">
      <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg ${selected ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted"}`}>
        <Crosshair className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-medium tracking-[0.12em] text-muted uppercase">{selected ? "Seçili yapı" : "Üzerinde"}</div>
        <div className="mt-0.5 truncate text-sm font-semibold">{d.label}</div>
        <div className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] text-muted">
          {mesh.layer && (
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full" style={{ background: layerDef(mesh.layer).color }} />
              {layerDef(mesh.layer).short}
            </span>
          )}
          {d.side && <span>{d.side}</span>}
          {mesh.group && <span className="truncate">{mesh.group}</span>}
        </div>
        <div className="mt-1 truncate font-mono text-[10px] text-accent">{d.code}</div>
      </div>
      {selected && (
        <button type="button" onClick={() => clear(null)} aria-label="Seçimi kaldır" className="-mt-1 -mr-1 rounded-md p-1 text-muted hover:bg-surface-2 hover:text-foreground">
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
