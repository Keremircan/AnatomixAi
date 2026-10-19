import { Gauge, Info, Stethoscope, type LucideIcon } from "lucide-react";
import { regionMapPoint, type RegionHit } from "@/lib/bodyRegions";
import { TRIAGE_LEVELS, type AnalysisResult, type TriageLevel } from "@/lib/triage";
import { LEVEL_STYLE } from "@/lib/triageStyles";
import { cn } from "@/lib/utils";

export const LEVEL_ORDER: TriageLevel[] = ["critical", "urgent", "routine", "self_care"];

/** Sonuçların üstünde duran sabit feragatname (SRS FR-1.3.2). */
export function Disclaimer({ className }: { className?: string }) {
  return (
    <p className={cn("flex gap-2 rounded-xl border border-line bg-surface-2/70 px-3 py-2.5 text-[12px] leading-snug text-muted", className)}>
      <Info className="mt-px size-3.5 shrink-0 text-accent" aria-hidden />
      <span>
        <b className="font-medium text-foreground">ANATOMIX.AI tanı koymaz ve hekim muayenesinin yerini tutmaz.</b> Sonuçlar yalnızca hangi sağlık
        birimine başvurabileceğinize dair bilgilendirme amaçlıdır.
      </span>
    </p>
  );
}

export function SectionTitle({ icon: Icon, children, tone = "text-accent" }: { icon: LucideIcon; children: React.ReactNode; tone?: string }) {
  return (
    <h3 className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">
      <Icon className={cn("size-3.5", tone)} aria-hidden />
      {children}
    </h3>
  );
}

export function Bullets({ items, dot }: { items: string[]; dot: string }) {
  return (
    <ul className="mt-2.5 grid gap-2 text-sm">
      {items.map((t) => (
        <li key={t} className="flex gap-2.5">
          <span className={cn("mt-2 size-1.5 shrink-0 rounded-full", dot)} />
          {t}
        </li>
      ))}
    </ul>
  );
}

/** 4 basamaklı triyaj ölçeği (T1 Acil … T4 Evde izlem); aktif seviye renkli, diğerleri soluk. */
export function LevelScale({ level, labels = false }: { level: TriageLevel; labels?: boolean }) {
  return (
    <div className="grid grid-cols-4 gap-1.5" aria-label={`Triyaj ölçeği: ${TRIAGE_LEVELS[level].code} ${TRIAGE_LEVELS[level].label}`}>
      {LEVEL_ORDER.map((l) => {
        const on = l === level;
        return (
          <div key={l} className={cn("rounded-lg border px-2 py-1.5", on ? cn(LEVEL_STYLE[l].soft, LEVEL_STYLE[l].border) : "border-transparent opacity-50")}>
            <div className={cn("h-1 rounded-full", LEVEL_STYLE[l].bg, !on && "opacity-50")} />
            <div className="mt-1.5 flex items-baseline gap-1.5 text-[11px]">
              <span className={cn("font-mono font-semibold", on ? LEVEL_STYLE[l].text : "text-muted")}>{TRIAGE_LEVELS[l].code}</span>
              {labels && <span className={cn("truncate", on ? "font-medium" : "text-muted")}>{TRIAGE_LEVELS[l].label}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Klinisyen modunda yaklaşık acil servis triyaj eşdeğerleri (ESI / Manchester). */
export function ClinicalScore({ level, onDanger = false }: { level: TriageLevel; onDanger?: boolean }) {
  const t = TRIAGE_LEVELS[level];
  return (
    <div className={cn("rounded-xl border px-3 py-2.5", onDanger ? "border-danger/40 bg-background/40" : "border-line bg-surface-2/60")}>
      <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">
        <Gauge className="size-3.5 text-teal" aria-hidden />
        Klinik triyaj puanı
      </div>
      <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
        <div>
          <dt className="text-[10px] text-muted">ESI</dt>
          <dd className="font-mono font-semibold">{t.esi}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted">Manchester</dt>
          <dd className="font-semibold">{t.mts}</dd>
        </div>
        <div>
          <dt className="text-[10px] text-muted">Hedef süre</dt>
          <dd className="font-mono font-semibold">{t.mtsTarget}</dd>
        </div>
      </dl>
      <p className="mt-1.5 text-[10px] leading-snug text-muted">Yaklaşık eşdeğerdir; ön triyaj puanı acil servis triyajının yerini tutmaz.</p>
    </div>
  );
}

export function ClinicalNotes({ result }: { result: AnalysisResult }) {
  if (!result.clinicalNotes) return null;
  return (
    <details className="group glass rounded-card p-4">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">
        <span className="flex items-center gap-2">
          <Stethoscope className="size-3.5 text-teal" aria-hidden />
          Klinik & ICD-10 notları
        </span>
        <span className="transition group-open:rotate-180">▾</span>
      </summary>
      <p className="mt-3 text-sm leading-relaxed">{result.clinicalNotes}</p>
      <p className="mt-2 font-mono text-[10px] text-muted">Kural {result.ruleId} · Klinik karar desteği değildir.</p>
    </details>
  );
}

/* ───────────────────────── 2B vücut haritası ───────────────────────── */

const LIMBS = [
  "110,72 110,98",
  "76,102 57,176 47,244",
  "144,102 163,176 173,244",
  "95,246 91,345 89,430",
  "125,246 129,345 131,430",
];
const LIMB_W = [20, 20, 20, 28, 28];
const TORSO = "M70 100 Q72 91 88 91 L132 91 Q148 91 150 100 L146 190 Q144 222 151 252 L69 252 Q76 222 74 190 Z";

/** Şikayet bölgelerini gösteren sade 2B silüet; bölgelerin çoğu arkadaysa arkadan çizilir. */
export function BodyMap2D({ regions, className }: { regions: RegionHit[]; className?: string }) {
  const points = regions.map((r) => ({ id: r.id, name: r.name, ...regionMapPoint(r) }));
  const view = points.length && points.filter((p) => p.view === "back").length > points.length / 2 ? "back" : "front";
  return (
    <svg viewBox="0 0 220 460" className={className} role="img" aria-label={`Vücut bölge haritası (${view === "front" ? "önden" : "arkadan"}): ${regions.map((r) => r.name).join(", ") || "bölge yok"}`}>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        {LIMBS.map((p, i) => (
          <polyline key={"o" + p} points={p} stroke="var(--line)" strokeWidth={LIMB_W[i] + 3} />
        ))}
        <path d={TORSO} fill="var(--line)" stroke="var(--line)" strokeWidth="3" />
        <ellipse cx="110" cy="46" rx="25" ry="30" fill="var(--line)" />
        {LIMBS.map((p, i) => (
          <polyline key={"f" + p} points={p} stroke="var(--surface-2)" strokeWidth={LIMB_W[i]} />
        ))}
        <path d={TORSO} fill="var(--surface-2)" />
        <ellipse cx="110" cy="46" rx="23.5" ry="28.5" fill="var(--surface-2)" />
        {view === "back" ? (
          <path d="M110 96 L110 250" stroke="var(--muted)" strokeOpacity="0.4" strokeWidth="1.5" strokeDasharray="3 4" />
        ) : (
          <path d="M92 140 Q110 150 128 140 M110 150 L110 240" stroke="var(--muted)" strokeOpacity="0.25" strokeWidth="1.2" />
        )}
      </g>
      {points.map((p) => (
        <g key={p.id} opacity={p.view === view ? 1 : 0.45}>
          <circle cx={p.x} cy={p.y} r="15" fill="var(--pain)" fillOpacity="0.18" />
          <circle cx={p.x} cy={p.y} r="11" fill="none" stroke="var(--pain)" strokeWidth="1.5" className="animate-pain-ring" />
          <circle cx={p.x} cy={p.y} r="5" fill="var(--pain)" />
          <title>{p.name}</title>
        </g>
      ))}
    </svg>
  );
}
