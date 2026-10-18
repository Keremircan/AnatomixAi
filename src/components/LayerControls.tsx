"use client";

import { useId, useRef, useState, useSyncExternalStore } from "react";
import { Check, Columns3, Layers, RotateCcw, Search, type LucideIcon } from "lucide-react";
import { formatMB, LAYERS, layerDef, MANIFEST_URL, pickLod, SIDE_TR, type AnatomyLayer, type Lod } from "@/lib/layers";
import { useAnatomyStore, type ViewMode } from "@/store/useAnatomyStore";
import { cn } from "@/lib/utils";

/** Sunucuda masaüstü, istemcide ekrana göre seçilen model sürümü (boyut etiketleri için). */
function useLod(): Lod {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(max-width: 767px), (pointer: coarse)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    pickLod,
    () => "desktop",
  );
}

/* ───────────────────────── Yapı arama ───────────────────────── */

type Structure = { id: string; label: string; group?: string; side?: string; layer: AnatomyLayer; lc: string };
type Manifest = { layers: Record<string, { structures: { id: string; label: string; group?: string; side?: string }[] }> };

let indexPromise: Promise<Structure[]> | null = null;
/** Manifest yalnızca arama kutusu ilk kez kullanıldığında indirilir. */
function loadIndex() {
  indexPromise ??= fetch(MANIFEST_URL)
    .then((r) => r.json() as Promise<Manifest>)
    .then((m) =>
      LAYERS.flatMap(({ id }) =>
        (m.layers[id]?.structures ?? []).map((s) => ({ ...s, layer: id, lc: `${s.label} ${s.id}`.toLocaleLowerCase("tr-TR") })),
      ),
    )
    .catch((e) => {
      indexPromise = null;
      throw e;
    });
  return indexPromise;
}

function StructureSearch() {
  const [q, setQ] = useState("");
  const [index, setIndex] = useState<Structure[] | null>(null);
  const [cursor, setCursor] = useState(-1);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const showLayer = useAnatomyStore((s) => s.showLayer);
  const select = useAnatomyStore((s) => s.setSelectedMesh);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const term = q.trim().toLocaleLowerCase("tr-TR");
  const hits = open && index && term.length >= 2 ? index.filter((s) => s.lc.includes(term)).slice(0, 40) : [];

  const ensureIndex = () => {
    if (index) return;
    loadIndex().then(setIndex, () => setError(true));
  };

  const go = (s: Structure) => {
    showLayer(s.layer);
    select({ name: s.id, label: s.label, group: s.group, layer: s.layer });
    setQ(s.label);
    setCursor(-1);
    setOpen(false);
    inputRef.current?.blur();
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        ref={inputRef}
        type="search"
        value={q}
        placeholder="Yapı ara (ör. femur, stomach)"
        autoComplete="off"
        role="combobox"
        aria-expanded={hits.length > 0}
        aria-controls={listId}
        aria-activedescendant={cursor >= 0 ? `${listId}-${cursor}` : undefined}
        onFocus={ensureIndex}
        onBlur={() => setOpen(false)}
        onChange={(e) => {
          setQ(e.target.value);
          setCursor(-1);
          setOpen(true);
          ensureIndex();
        }}
        onKeyDown={(e) => {
          if (!hits.length) return;
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => (c + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            go(hits[Math.max(cursor, 0)]);
          } else if (e.key === "Escape") setOpen(false);
        }}
        className="h-10 w-full rounded-xl border border-line bg-surface-2/80 pr-3 pl-9 text-sm placeholder:text-muted/80 focus:border-accent focus:ring-4 focus:ring-accent/15 focus:outline-none"
      />
      {error && <p className="mt-1.5 text-[11px] text-danger">Yapı listesi yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.</p>}
      {hits.length > 0 && (
        <ul id={listId} role="listbox" className="glass absolute inset-x-0 top-full z-20 mt-1.5 max-h-72 overflow-y-auto rounded-xl p-1 shadow-elev">
          {hits.map((h, i) => (
            <li
              key={h.id}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === cursor}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => go(h)}
              className={cn("flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-[13px]", i === cursor ? "bg-accent/15" : "hover:bg-surface-2")}
            >
              <span className="min-w-0 truncate">
                {h.label}
                {h.side && h.side !== "C" && <span className="text-muted"> ({SIDE_TR[h.side]})</span>}
              </span>
              <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
                <span className="size-1.5 rounded-full" style={{ background: layerDef(h.layer).color }} />
                {layerDef(h.layer).short}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ───────────────────────── Katman paneli ───────────────────────── */

function Checkbox({ on }: { on: boolean }) {
  return (
    <span className={cn("grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition", on ? "border-accent bg-accent text-accent-foreground" : "border-line bg-surface-2")}>
      {on && <Check className="size-3" strokeWidth={3.5} aria-hidden />}
    </span>
  );
}

/** Sol kenarda (dar ekranda altta) yüzen anatomik sistem paneli. */
export function LayerControls({ className }: { className?: string }) {
  const active = useAnatomyStore((s) => s.activeLayers);
  const toggle = useAnatomyStore((s) => s.toggleLayer);
  const opacity = useAnatomyStore((s) => s.layerOpacity);
  const setOpacity = useAnatomyStore((s) => s.setLayerOpacity);
  const envelopes = useAnatomyStore((s) => s.showEnvelopes);
  const setEnvelopes = useAnatomyStore((s) => s.setShowEnvelopes);
  const lod = useLod();

  return (
    <nav aria-label="Anatomik sistemler" className={cn("glass rounded-2xl shadow-elev", className)}>
      {/* Dar ekran: yatay kaydırılan sistem çipleri */}
      <ul className="flex gap-1.5 p-1.5 md:hidden">
        {LAYERS.map((l) => {
          const on = active.includes(l.id);
          return (
            <li key={l.id}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(l.id)}
                className={cn("flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium whitespace-nowrap", on ? "bg-surface-2 text-foreground ring-1 ring-accent/40" : "text-muted")}
              >
                <span className="size-2 rounded-full" style={{ background: l.color, opacity: on ? 1 : 0.45 }} />
                {l.short}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Geniş ekran: arama, sistem listesi, şeffaflık ve zar seçeneği */}
      <div className="hidden flex-col gap-3 p-3 md:flex">
        <StructureSearch />

        <ul className="flex flex-col">
          {LAYERS.map((l) => {
            const on = active.includes(l.id);
            const pct = Math.round(opacity[l.id] * 100);
            return (
              <li key={l.id} className="flex items-center gap-2 border-b border-line/50 py-2 last:border-b-0">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  onClick={() => toggle(l.id)}
                  className="flex min-w-0 flex-1 items-start gap-2.5 rounded-lg py-0.5 text-left"
                >
                  <span className="mt-0.5">
                    <Checkbox on={on} />
                  </span>
                  <span className="min-w-0">
                    <span className={cn("flex items-center gap-2 text-[13px] leading-tight font-medium", on ? "text-foreground" : "text-muted")}>
                      <span className="size-2 shrink-0 rounded-full" style={{ background: l.color }} />
                      {l.label}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] text-muted tabular-nums">
                      {l.count} yapı · {formatMB(l.bytes[lod])}
                    </span>
                  </span>
                </button>
                <input
                  type="range"
                  min={10}
                  max={100}
                  step={5}
                  value={pct}
                  onChange={(e) => setOpacity(l.id, Number(e.target.value) / 100)}
                  aria-label={`${l.label} saydamlığı`}
                  aria-valuetext={`%${pct}`}
                  title={`Saydamlık: %${pct}`}
                  className="h-1 w-20 shrink-0 cursor-pointer accent-[var(--accent)] disabled:opacity-40"
                  disabled={!on}
                />
              </li>
            );
          })}
        </ul>

        <button type="button" role="checkbox" aria-checked={envelopes} onClick={() => setEnvelopes(!envelopes)} className="flex items-center gap-2.5 text-left text-[13px] text-muted hover:text-foreground">
          <Checkbox on={envelopes} />
          Zarları ve fasyaları göster
        </button>

        <p className="text-[11px] leading-snug text-muted">
          Bir dokuya dokunun: o bölgeye yakınlaşır. Yan yana modda seçili sistemler ayrı figürler olarak dizilir.
        </p>
      </div>
    </nav>
  );
}

/* ───────────────────────── Görünüm modu ───────────────────────── */

const MODES: { id: ViewMode; label: string; Icon: LucideIcon }[] = [
  { id: "stacked", label: "Üst Üste", Icon: Layers },
  { id: "sideBySide", label: "Yan Yana", Icon: Columns3 },
];

/** Sağ üstteki görünüm modu seçici ve kadrajı sıfırlama düğmesi. */
export function ViewModeToggle({ className }: { className?: string }) {
  const mode = useAnatomyStore((s) => s.viewMode);
  const setMode = useAnatomyStore((s) => s.setViewMode);
  const reset = useAnatomyStore((s) => s.resetView);

  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <div role="radiogroup" aria-label="Görünüm modu" className="glass inline-flex rounded-xl p-1 shadow-elev">
        {MODES.map(({ id, label, Icon }) => {
          const on = mode === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setMode(id)}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap transition",
                on ? "bg-accent text-accent-foreground shadow-[0_6px_20px_-8px_var(--accent)]" : "text-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={reset}
        aria-label="Görünümü sıfırla"
        title="Görünümü sıfırla"
        className="glass grid size-10 place-items-center rounded-xl text-muted shadow-elev transition hover:text-foreground"
      >
        <RotateCcw className="size-4" aria-hidden />
      </button>
    </div>
  );
}
