"use client";

import { useEffect, useRef, useState } from "react";
import {
  Armchair, BriefcaseMedical, Check, ClipboardList, Crosshair, Gauge, Hospital, Info, ListChecks, MapPin, Phone, Stethoscope, Thermometer, TriangleAlert, type LucideIcon,
} from "lucide-react";
import { layerDef, layerOfMesh } from "@/lib/layers";
import { TRIAGE_LEVELS, type TriageLevel } from "@/lib/triage";
import { LEVEL_STYLE } from "@/lib/triageStyles";
import { useAnatomyStore, type AnalysisResult } from "@/store/useAnatomyStore";
import { cn } from "@/lib/utils";

const LEVEL_ORDER: TriageLevel[] = ["critical", "urgent", "routine", "self_care"];

/** Sonuçların hemen üstünde duran sabit feragatname (SRS FR-1.3.2). */
function Disclaimer() {
  return (
    <p className="flex gap-2 rounded-xl border border-line bg-surface-2/70 px-3 py-2.5 text-[11px] leading-snug text-muted">
      <Info className="mt-px size-3.5 shrink-0 text-accent" aria-hidden />
      <span>
        <b className="font-medium text-foreground">ANATOMIX.AI tanı koymaz ve hekim muayenesinin yerini tutmaz.</b> Sonuçlar yalnızca hangi sağlık
        birimine başvurabileceğinize dair bilgilendirme amaçlıdır.
      </span>
    </p>
  );
}

function SectionTitle({ icon: Icon, children, tone = "text-accent" }: { icon: LucideIcon; children: React.ReactNode; tone?: string }) {
  return (
    <h3 className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">
      <Icon className={cn("size-3.5", tone)} aria-hidden />
      {children}
    </h3>
  );
}

function Bullets({ items, dot }: { items: string[]; dot: string }) {
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

/** 4 basamaklı triyaj ölçeği; aktif seviye renkli, diğerleri soluk. */
function LevelScale({ level }: { level: TriageLevel }) {
  return (
    <div className="grid grid-cols-4 gap-1" aria-label={`Triyaj ölçeği: ${TRIAGE_LEVELS[level].code}`}>
      {LEVEL_ORDER.map((l) => {
        const on = l === level;
        return (
          <div key={l} className={cn("rounded-md px-1.5 py-1", on ? LEVEL_STYLE[l].soft : "opacity-45")}>
            <div className={cn("h-1 rounded-full", LEVEL_STYLE[l].bg)} />
            <div className={cn("mt-1 font-mono text-[10px]", on ? LEVEL_STYLE[l].text : "text-muted")}>{TRIAGE_LEVELS[l].code}</div>
          </div>
        );
      })}
    </div>
  );
}

/** Klinisyen modunda yaklaşık acil servis triyaj eşdeğerleri (ESI / Manchester). */
function ClinicalScore({ level, onDanger = false }: { level: TriageLevel; onDanger?: boolean }) {
  const t = TRIAGE_LEVELS[level];
  return (
    <div className={cn("mt-4 rounded-xl border px-3 py-2.5", onDanger ? "border-danger/40 bg-background/40" : "border-line bg-surface-2/60")}>
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

/** Seviye başlığı: dinamik ışıma, kenarlık ve ikon. */
function LevelHeader({ result, clinician }: { result: AnalysisResult; clinician: boolean }) {
  const t = TRIAGE_LEVELS[result.triageLevel];
  const st = LEVEL_STYLE[result.triageLevel];
  return (
    <section
      className={cn("relative overflow-hidden rounded-card border bg-surface/70 p-4 backdrop-blur", st.border)}
      style={{ boxShadow: `0 18px 50px -28px ${st.cssVar}` }}
    >
      <div aria-hidden className="absolute -top-16 -right-16 size-48 rounded-full opacity-25 blur-3xl" style={{ background: st.cssVar }} />
      <div className="relative">
        <div className="flex items-start gap-3">
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl", st.soft, st.text)}>
            <st.Icon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase", st.soft, st.text)}>
              <span className={cn("size-1.5 rounded-full", st.dot)} />
              {t.code} · {t.badge}
            </span>
            <h2 className="mt-1.5 text-lg font-semibold tracking-tight">{t.label}</h2>
            <p className="mt-0.5 text-sm text-muted">{t.action}</p>
          </div>
        </div>
        <div className="mt-3.5">
          <LevelScale level={result.triageLevel} />
        </div>
        {clinician && <ClinicalScore level={result.triageLevel} />}
      </div>
    </section>
  );
}

/** Vurgulanan bölge; 3B modeldeki seçimle eşleşiyorsa senkron rozeti gösterir. */
function RegionSync({ result }: { result: AnalysisResult }) {
  const selected = useAnatomyStore((s) => s.selectedMesh?.name);
  const synced = !!result.meshIdToHighlight && selected === result.meshIdToHighlight;
  const layer = result.meshIdToHighlight ? layerOfMesh(result.meshIdToHighlight) : undefined;
  const showLayer = useAnatomyStore((s) => s.showLayer);
  const select = useAnatomyStore((s) => s.setSelectedMesh);
  /** Kamerayı bölgeye yeniden odaklar (katman kapatılmışsa yeniden açar). */
  const refocus = () => {
    if (!result.meshIdToHighlight || !layer) return;
    showLayer(layer);
    select({ name: result.meshIdToHighlight, label: result.primaryRegion, layer, focusRadius: 0.16 });
  };
  return (
    <section className="glass flex items-center gap-3 rounded-card p-3.5">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-pain/12 text-pain">
        <Crosshair className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium tracking-[0.12em] text-muted uppercase">İlgili bölge</div>
        <div className="truncate text-sm font-semibold">{result.primaryRegion}</div>
        {result.meshIdToHighlight && <div className="truncate font-mono text-[10px] text-muted">{result.meshIdToHighlight}</div>}
      </div>
      {result.meshIdToHighlight && (
        <button
          type="button"
          onClick={refocus}
          title="Kamerayı bu bölgeye odakla"
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition",
            synced ? "border-accent/40 bg-accent/10 text-accent hover:bg-accent/20" : "border-line text-muted hover:border-accent/40 hover:text-accent",
          )}
        >
          <span className={cn("size-1.5 rounded-full", synced ? "animate-pulse bg-accent" : "bg-muted")} />
          {synced ? `3B · ${layer ? layerDef(layer).short : ""}` : "3B'de odakla"}
        </button>
      )}
    </section>
  );
}

function Department({ result }: { result: AnalysisResult }) {
  const st = LEVEL_STYLE[result.triageLevel];
  const title = {
    critical: "Başvuru",
    urgent: "Başvurulacak birim",
    routine: "Randevu alınması önerilen poliklinik",
    self_care: "Şikayet sürerse",
  }[result.triageLevel];
  return (
    <section className={cn("rounded-card border p-4", st.border, st.soft)}>
      <SectionTitle icon={Stethoscope} tone={st.text}>
        {title}
      </SectionTitle>
      <p className="mt-2 text-xl font-semibold tracking-tight">{result.department}</p>
    </section>
  );
}

function Conditions({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="glass rounded-card p-4">
      <SectionTitle icon={ListChecks}>Olası klinik ihtimaller</SectionTitle>
      <ul className="mt-2.5 grid gap-1.5">
        {items.map((c) => (
          <li key={c} className="rounded-lg bg-surface-2/70 px-3 py-2 text-sm">
            {c}
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[11px] leading-snug text-muted">Bu liste kesin tanı değildir ve olasılık sırasına göre dizilmemiştir; yalnızca eğitim amaçlıdır.</p>
    </section>
  );
}

function WarningSigns({ items, level }: { items: string[]; level: TriageLevel }) {
  if (!items.length) return null;
  return (
    <section className="rounded-card border border-warning/35 bg-warning/8 p-4">
      <SectionTitle icon={TriangleAlert} tone="text-warning">
        {level === "urgent" ? "Beklemeden 112’yi arayın" : "Şu durumlarda beklemeyin"}
      </SectionTitle>
      <Bullets items={items} dot="bg-warning" />
      {level !== "urgent" && <p className="mt-2 text-[11px] text-muted">Bu belirtilerden biri olursa 112’yi arayın veya acil servise başvurun.</p>}
    </section>
  );
}

function ClinicalNotes({ result }: { result: AnalysisResult }) {
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

/* ───────────────────────── T1 · Kritik ───────────────────────── */

function CriticalView({ result, clinician }: { result: AnalysisResult; clinician: boolean }) {
  return (
    <section
      role="alert"
      aria-labelledby="rf-title"
      className="relative overflow-hidden rounded-card border border-danger/60 bg-danger/12 p-5 shadow-[0_20px_60px_-25px_var(--danger)]"
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{ backgroundImage: "repeating-linear-gradient(135deg, color-mix(in oklab, var(--danger) 10%, transparent) 0 14px, transparent 14px 28px)" }}
      />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full bg-danger px-3 py-1 text-[11px] font-semibold tracking-wider text-white uppercase">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-80" />
            <span className="relative inline-flex size-2 rounded-full bg-white" />
          </span>
          T1 · Kırmızı bayrak · Acil
        </span>

        <h2 id="rf-title" className="mt-4 text-2xl font-semibold tracking-tight">
          Acil yardım gerektirebilecek bir belirti
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground/90">{result.redFlagReason}</p>

        <a
          href="tel:112"
          className="mt-5 flex h-14 items-center justify-center gap-3 rounded-2xl bg-danger text-lg font-semibold text-white shadow-[0_10px_30px_-10px_var(--danger)] transition hover:brightness-110"
        >
          <Phone className="size-5" strokeWidth={2.4} aria-hidden />
          112 ACİL SERVİSİ ARAYIN
        </a>
        <p className="mt-2 text-center text-xs text-muted">
          Arama başlamazsa telefonunuzdan <b className="font-mono text-foreground">112</b> numarasını tuşlayın.
        </p>

        <div className="mt-5 grid gap-2 text-sm">
          <p className="flex gap-2.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            Kendiniz araç kullanmayın. Size en yakın hastanenin acil servisine bir yakınınızla ya da ambulansla gidin.
          </p>
          <p className="flex gap-2.5">
            <Hospital className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            Beklerken hareketi azaltın, yalnız kalmayın ve kullandığınız ilaçların listesini hazırlayın.
          </p>
        </div>

        {clinician && <ClinicalScore level="critical" onDanger />}

        <p className="mt-5 border-t border-danger/30 pt-3 font-mono text-[10px] text-muted">
          Kural {result.ruleId} · Bölge: {result.primaryRegion} · Evde bakım ve diğer öneriler bu seviyede gösterilmez.
        </p>
      </div>
    </section>
  );
}

/* ───────────────────────── T2 · Öncelikli ───────────────────────── */

function UrgentView({ result, clinician }: { result: AnalysisResult; clinician: boolean }) {
  return (
    <>
      <LevelHeader result={result} clinician={clinician} />
      <RegionSync result={result} />
      <Department result={result} />
      {result.firstAid && (
        <section className="rounded-card border border-warning/45 bg-warning/10 p-4">
          <SectionTitle icon={BriefcaseMedical} tone="text-warning">
            Başvuruya kadar geçici ilk yardım
          </SectionTitle>
          <Bullets items={result.firstAid} dot="bg-warning" />
        </section>
      )}
      <WarningSigns items={result.warningSigns} level="urgent" />
      <Conditions items={result.possibleConditions} />
    </>
  );
}

/* ───────────────────────── T3 · Rutin ───────────────────────── */

function RoutineView({ result, clinician }: { result: AnalysisResult; clinician: boolean }) {
  return (
    <>
      <LevelHeader result={result} clinician={clinician} />
      <RegionSync result={result} />
      <Department result={result} />
      <Conditions items={result.possibleConditions} />
      {result.visitPrep && (
        <section className="glass rounded-card p-4">
          <SectionTitle icon={ClipboardList}>Randevuya giderken</SectionTitle>
          <Bullets items={result.visitPrep} dot="bg-accent" />
        </section>
      )}
      <WarningSigns items={result.warningSigns} level="routine" />
    </>
  );
}

/* ───────────────────────── T4 · Evde bakım ───────────────────────── */

function SelfCareView({ result, clinician }: { result: AnalysisResult; clinician: boolean }) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const ergo = result.ergonomics ?? [];
  return (
    <>
      <LevelHeader result={result} clinician={clinician} />
      <RegionSync result={result} />

      <section className="rounded-card border border-success/40 bg-success/8 p-4">
        <SectionTitle icon={Thermometer} tone="text-success">
          Rahatlama ve dinlenme
        </SectionTitle>
        <Bullets items={result.supportiveAdvice} dot="bg-success" />
      </section>

      {result.stretches && (
        <section className="glass rounded-card p-4">
          <SectionTitle icon={Check} tone="text-success">
            Güvenli esneme rehberi
          </SectionTitle>
          <ol className="mt-2.5 grid gap-2">
            {result.stretches.map((s, i) => (
              <li key={s.name} className="rounded-xl border border-line bg-surface-2/50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    <span className="mr-1.5 font-mono text-[11px] text-success">{i + 1}.</span>
                    {s.name}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] text-muted">{s.dose}</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{s.detail}</p>
              </li>
            ))}
          </ol>
          <p className="mt-2.5 text-[11px] text-muted">Ağrı sınırını zorlamayın; ağrı artarsa hareketi bırakın.</p>
        </section>
      )}

      {ergo.length > 0 && (
        <section className="glass rounded-card p-4">
          <div className="flex items-center justify-between">
            <SectionTitle icon={Armchair} tone="text-success">
              Ergonomi ve duruş
            </SectionTitle>
            <span className="font-mono text-[10px] text-muted tabular-nums">
              {Object.values(checked).filter(Boolean).length}/{ergo.length}
            </span>
          </div>
          <ul className="mt-2.5 grid gap-1.5">
            {ergo.map((e, i) => (
              <li key={e}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={!!checked[i]}
                  onClick={() => setChecked((c) => ({ ...c, [i]: !c[i] }))}
                  className="flex w-full items-center gap-2.5 rounded-lg px-1 py-1 text-left text-sm hover:bg-surface-2/60"
                >
                  <span className={cn("grid size-[18px] shrink-0 place-items-center rounded-[5px] border", checked[i] ? "border-success bg-success text-background" : "border-line")}>
                    {checked[i] && <Check className="size-3" strokeWidth={3.5} aria-hidden />}
                  </span>
                  <span className={checked[i] ? "text-muted line-through" : ""}>{e}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Department result={result} />
      <WarningSigns items={result.warningSigns} level="self_care" />
    </>
  );
}

export function AnalysisResultCard() {
  const result = useAnatomyStore((s) => s.analysisResult);
  const state = useAnatomyStore((s) => s.analysisState);
  const role = useAnatomyStore((s) => s.role);
  const ref = useRef<HTMLDivElement>(null);

  // Sonuç (özellikle kritik seviye) panelin alt kısmında kalmasın.
  useEffect(() => {
    if (!result) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  }, [result]);

  if (state !== "completed" || !result) return null;
  const clinician = role === "clinician";

  return (
    <div ref={ref} className="grid scroll-mt-3 grid-cols-[minmax(0,1fr)] gap-3 animate-rise">
      <Disclaimer />
      {result.triageLevel === "critical" && <CriticalView result={result} clinician={clinician} />}
      {result.triageLevel === "urgent" && <UrgentView result={result} clinician={clinician} />}
      {result.triageLevel === "routine" && <RoutineView result={result} clinician={clinician} />}
      {result.triageLevel === "self_care" && <SelfCareView key={result.ruleId} result={result} clinician={clinician} />}
      {clinician && result.triageLevel !== "critical" && <ClinicalNotes result={result} />}
    </div>
  );
}
