"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Check, ClipboardList, Crosshair, Info, LoaderCircle, PencilLine, RotateCcw, Sparkles, Stethoscope, X,
} from "lucide-react";
import { layerDef } from "@/lib/layers";
import { answersComplete, DURATIONS, QUICK_TAGS, redFlagQuestion, TRIAGE_LEVELS, type TriageAnswers } from "@/lib/triage";
import { LEVEL_STYLE } from "@/lib/triageStyles";
import { ANALYSIS_DURATION_MS, SYMPTOM_MAX_LENGTH, useAnatomyStore, type TriageStep } from "@/store/useAnatomyStore";
import { cn } from "@/lib/utils";

const STEPS = ["Anlatın", "Analiz", "Sorular", "Sonuç"] as const;
const STEP_INDEX: Record<TriageStep, number> = { describe: 0, analyzing: 0, review: 1, questions: 2, done: 3 };

function Stepper({ step }: { step: TriageStep }) {
  const at = STEP_INDEX[step];
  return (
    <ol className="flex items-center gap-1.5 text-[11px] font-medium" aria-label="Triyaj adımları">
      {STEPS.map((s, i) => (
        <li key={s} className="flex min-w-0 items-center gap-1.5" aria-current={i === at ? "step" : undefined}>
          <span
            className={cn(
              "grid size-5 shrink-0 place-items-center rounded-full text-[10px] transition",
              i < at ? "bg-accent text-accent-foreground" : i === at ? "text-accent ring-2 ring-accent" : "bg-surface-2 text-muted",
            )}
          >
            {i < at ? <Check className="size-3" strokeWidth={3} aria-hidden /> : i + 1}
          </span>
          <span className={cn("truncate", i === at ? "text-foreground" : "text-muted")}>{s}</span>
          {i < STEPS.length - 1 && <span className="h-px w-3 shrink-0 bg-line" />}
        </li>
      ))}
    </ol>
  );
}

const PIPELINE = ["Kırmızı bayrak ön kontrolü", "Semptom ve bölge çıkarımı", "Anatomik eşleme", "Takip sorularının hazırlanması"];

/** Analiz sürerken adımları süreye yayarak ilerleten gösterge. */
function AnalysisSteps() {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const step = ANALYSIS_DURATION_MS / PIPELINE.length;
    const timers = PIPELINE.map((_, i) => setTimeout(() => setDone(i + 1), step * (i + 1) - 120));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <ol className="mt-3 grid gap-1.5 text-xs" aria-live="polite">
      {PIPELINE.map((s, i) => (
        <li key={s} className={cn("flex items-center gap-2 transition-colors", i < done ? "text-foreground" : "text-muted")}>
          <span className={cn("grid size-4 shrink-0 place-items-center rounded-full", i < done ? "bg-success text-background" : "border border-line")}>
            {i < done ? <Check className="size-2.5" strokeWidth={4} aria-hidden /> : i === done && <span className="size-1.5 animate-pulse rounded-full bg-accent" />}
          </span>
          {s}
        </li>
      ))}
    </ol>
  );
}

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="text-[11px] font-medium tracking-[0.12em] text-muted uppercase">{children}</div>
);

const primaryBtn =
  "flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-accent-foreground shadow-[0_8px_24px_-12px_var(--accent)] transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none";
const ghostBtn =
  "flex h-10 items-center gap-2 rounded-xl border border-line px-3.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-40";

/* ───────────────────────── 1 · Anlatın ───────────────────────── */

function DescribeStep({ onAnalyze }: { onAnalyze: () => void }) {
  const text = useAnatomyStore((s) => s.symptomText);
  const setText = useAnatomyStore((s) => s.setSymptomText);
  const step = useAnatomyStore((s) => s.triageStep);
  const reset = useAnatomyStore((s) => s.resetAnalysis);
  const analyzing = step === "analyzing";

  return (
    <form
      className="mt-4"
      onSubmit={(e) => {
        e.preventDefault();
        onAnalyze();
      }}
    >
      <label htmlFor="symptom-text" className="text-sm font-medium">
        Şikayetinizi kendi cümlelerinizle yazın
      </label>
      <p className="mt-0.5 text-xs text-muted">Nerede, ne zamandır, nasıl bir ağrı? Ne kadar ayrıntı, o kadar isabetli yönlendirme.</p>
      <div className="relative mt-2">
        <textarea
          id="symptom-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onAnalyze();
            }
          }}
          rows={4}
          maxLength={SYMPTOM_MAX_LENGTH}
          disabled={analyzing}
          placeholder="Örn: Sağ dizimde 4 gündür merdiven inerken artan ağrı ve hafif şişlik var."
          className="w-full resize-none rounded-xl border border-line bg-surface-2/70 p-3 pb-7 text-sm leading-relaxed placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15 focus:outline-none disabled:opacity-60"
        />
        <span className="pointer-events-none absolute right-3 bottom-2.5 font-mono text-[10px] text-muted tabular-nums">
          {text.length}/{SYMPTOM_MAX_LENGTH}
        </span>
      </div>

      <div className="mt-2.5">
        <Eyebrow>Hızlı test</Eyebrow>
        <div className="mt-1.5 grid grid-cols-2 gap-1.5">
          {QUICK_TAGS.map((t) => {
            const st = LEVEL_STYLE[t.level];
            const on = text === t.text;
            return (
              <button
                key={t.level}
                type="button"
                disabled={analyzing}
                onClick={() => setText(t.text)}
                title={t.text}
                className={cn(
                  "flex min-w-0 flex-col gap-0.5 rounded-xl border px-2.5 py-2 text-left transition disabled:opacity-50",
                  on ? `${st.border} ${st.soft}` : "border-line hover:bg-surface-2/70",
                )}
              >
                <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-wide text-muted uppercase">
                  <span className={cn("size-2 shrink-0 rounded-full", st.dot)} />
                  {TRIAGE_LEVELS[t.level].code} · {t.kind}
                </span>
                <span className="truncate text-xs font-medium text-foreground">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button type="submit" disabled={analyzing || !text.trim()} className={primaryBtn}>
          {analyzing ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
          {analyzing ? "Analiz ediliyor…" : "Analiz Et"}
        </button>
        <button type="button" onClick={reset} disabled={analyzing || !text} className={ghostBtn}>
          <RotateCcw className="size-4" aria-hidden />
          Temizle
        </button>
      </div>
      {analyzing && <AnalysisSteps />}
    </form>
  );
}

/* ───────────────────────── 2 · Analiz (çıkarım + ilgili yapılar) ───────────────────────── */

function ReviewStep() {
  const text = useAnatomyStore((s) => s.symptomText);
  const x = useAnatomyStore((s) => s.extraction);
  const selected = useAnatomyStore((s) => s.selectedMesh?.name);
  const focus = useAnatomyStore((s) => s.focusStructure);
  const remove = useAnatomyStore((s) => s.removeRegion);
  const edit = useAnatomyStore((s) => s.editComplaint);
  const next = useAnatomyStore((s) => s.startQuestions);
  if (!x) return null;

  return (
    <div className="mt-4 grid gap-4 animate-rise">
      <blockquote className="relative rounded-xl border border-line bg-surface-2/50 px-3 py-2.5 text-sm leading-relaxed">
        <span className="text-muted">“</span>
        {text}
        <span className="text-muted">”</span>
        <button type="button" onClick={edit} className="mt-1.5 flex items-center gap-1 text-[11px] font-medium text-accent hover:underline">
          <PencilLine className="size-3" aria-hidden />
          Metni düzenle
        </button>
      </blockquote>

      <div>
        <div className="flex items-center justify-between">
          <Eyebrow>İlgili bölgeler ve yapılar</Eyebrow>
          <span className="text-[10px] text-muted">3B’de görmek için tıklayın</span>
        </div>
        {x.regions.length === 0 ? (
          <p className="mt-2 flex gap-2 rounded-xl border border-dashed border-line p-3 text-xs text-muted">
            <Info className="mt-px size-3.5 shrink-0 text-accent" aria-hidden />
            Metinde belirli bir vücut bölgesi bulunamadı. Genel değerlendirme yapılacak; isterseniz metni düzenleyip bölgeyi ekleyin.
          </p>
        ) : (
          <ul className="mt-2 grid gap-2">
            {x.regions.map((r, i) => (
              <li key={r.id} className="rounded-xl border border-line bg-surface/60 p-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-pain/12 text-pain">
                    <Crosshair className="size-3.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{r.name}</div>
                    <div className="text-[10px] text-muted">{i === 0 ? "Birincil şikayet bölgesi" : "Ek bölge"}{r.sideAssumed && " · taraf varsayıldı"}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(r.id)}
                    aria-label={`${r.name} bölgesini kaldır`}
                    title="Yanlış eşleşmeyse kaldırın"
                    className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </div>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {r.structures.map((st) => {
                    const on = selected === st.meshId;
                    return (
                      <li key={st.meshId}>
                        <button
                          type="button"
                          onClick={() => focus(r, st.meshId)}
                          aria-pressed={on}
                          title={`${layerDef(st.layer).label} · ${st.meshId}`}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition",
                            on ? "border-accent/50 bg-accent/12 font-medium text-accent" : "border-line hover:border-accent/40 hover:text-accent",
                          )}
                        >
                          <span className="size-2 shrink-0 rounded-[3px]" style={{ background: layerDef(st.layer).color }} />
                          {st.label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <Eyebrow>Çıkarılan belirtiler</Eyebrow>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {x.symptoms.length ? (
            x.symptoms.map((s) => (
              <span key={s.code} className="rounded-full bg-surface-2 px-2.5 py-1 text-[11px]" title={`“${s.expr}” · ${s.code}`}>
                {s.name}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted">Belirgin bir belirti ifadesi bulunamadı.</span>
          )}
          {x.duration && <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">Süre: {x.duration.label}</span>}
          {x.onset && <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-muted">{x.onset === "sudden" ? "Ani başlangıç" : "Kademeli başlangıç"}</span>}
        </div>
        {x.notes.map((n) => (
          <p key={n} className="mt-2 flex gap-1.5 text-xs text-muted">
            <Info className="mt-px size-3.5 shrink-0 text-accent" aria-hidden />
            {n}
          </p>
        ))}
      </div>

      <button type="button" onClick={next} className={primaryBtn}>
        Doğru, takip sorularına geç
        <ArrowRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/* ───────────────────────── 3 · Takip soruları ───────────────────────── */

function Choice<T extends string | boolean>({
  value, options, onChange, danger,
}: { value: T | null; options: { v: T; label: string }[]; onChange: (v: T) => void; danger?: T }) {
  return (
    <div className="mt-1.5 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(options.length, 3)}, minmax(0, 1fr))` }}>
      {options.map((o) => {
        const on = value === o.v;
        return (
          <button
            key={String(o.v)}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.v)}
            className={cn(
              "min-h-9 rounded-lg border px-2 py-1.5 text-[13px] transition",
              on ? (o.v === danger ? "border-danger/60 bg-danger/12 font-medium text-danger" : "border-accent/60 bg-accent/12 font-medium text-accent") : "border-line hover:bg-surface-2/70",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const SEVERITY_WORD = (n: number) => (n === 0 ? "Yok" : n <= 3 ? "Hafif" : n <= 6 ? "Orta" : n <= 8 ? "Şiddetli" : "Dayanılmaz");
const SEVERITY_COLOR = (n: number) => (n <= 3 ? "var(--success)" : n <= 6 ? "var(--caution)" : n <= 8 ? "var(--warning)" : "var(--danger)");

function SeverityScale({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <div className="mt-2">
      <div role="radiogroup" aria-label="Ağrı şiddeti, 0–10" className="grid grid-cols-11 gap-1">
        {Array.from({ length: 11 }, (_, n) => {
          const on = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={`${n} — ${SEVERITY_WORD(n)}`}
              onClick={() => onChange(n)}
              className={cn("h-9 rounded-md border font-mono text-xs tabular-nums transition", on ? "border-transparent font-semibold text-white" : "border-line hover:bg-surface-2/70")}
              style={on ? { background: SEVERITY_COLOR(n) } : { boxShadow: `inset 0 -2px 0 color-mix(in oklab, ${SEVERITY_COLOR(n)} 55%, transparent)` }}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted">
        <span>0 · Ağrı yok</span>
        <span>10 · Dayanılmaz</span>
      </div>
    </div>
  );
}

function Question({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="flex w-full items-baseline gap-2 text-sm font-medium">
        <span className="font-mono text-[11px] text-muted">{n}.</span>
        <span className="flex-1">{title}</span>
        {hint && <span className="text-[10px] font-normal text-accent">{hint}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

function QuestionsStep({ onFinish }: { onFinish: () => void }) {
  const x = useAnatomyStore((s) => s.extraction);
  const a = useAnatomyStore((s) => s.answers);
  const set = useAnatomyStore((s) => s.setAnswer);
  const back = useAnatomyStore((s) => s.backToReview);
  if (!x) return null;
  const rf = redFlagQuestion(x);
  const answered = Object.values(a).filter((v) => v !== null).length;
  const total = Object.keys(a).length;
  const fromText = (k: keyof TriageAnswers) =>
    (k === "duration" && x.duration && a.duration === x.duration.bucket) ||
    (k === "onset" && x.onset && a.onset === x.onset) ||
    (k === "course" && x.course && a.course === x.course) ||
    (k === "fever" && x.fever && a.fever)
      ? "metinden dolduruldu"
      : undefined;

  return (
    <div className="mt-4 grid gap-5 animate-rise">
      <div className="flex items-center justify-between">
        <Eyebrow>Takip soruları</Eyebrow>
        <span className="font-mono text-[11px] text-muted tabular-nums">
          {answered}/{total} yanıtlandı
        </span>
      </div>

      <Question n={1} title="Ağrınızın şiddeti 10 üzerinden kaç?" hint={a.severity !== null ? SEVERITY_WORD(a.severity) : undefined}>
        <SeverityScale value={a.severity} onChange={(v) => set("severity", v)} />
      </Question>

      <Question n={2} title="Şikayetiniz ne zamandır var?" hint={fromText("duration")}>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {DURATIONS.map((d) => (
            <button
              key={d.id}
              type="button"
              aria-pressed={a.duration === d.id}
              onClick={() => set("duration", d.id)}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-[13px] transition",
                a.duration === d.id ? "border-accent/60 bg-accent/12 font-medium text-accent" : "border-line hover:bg-surface-2/70",
              )}
            >
              {d.label}
            </button>
          ))}
        </div>
      </Question>

      <Question n={3} title="Nasıl başladı?" hint={fromText("onset")}>
        <Choice value={a.onset} onChange={(v) => set("onset", v)} options={[{ v: "sudden", label: "Aniden" }, { v: "gradual", label: "Yavaş yavaş" }]} />
      </Question>

      <Question n={4} title="Başladığından beri nasıl seyrediyor?" hint={fromText("course")}>
        <Choice value={a.course} onChange={(v) => set("course", v)} options={[{ v: "worse", label: "Artıyor" }, { v: "same", label: "Aynı" }, { v: "better", label: "Azalıyor" }]} />
      </Question>

      <Question n={5} title="Ateşiniz var mı (38 °C ve üzeri)?" hint={fromText("fever")}>
        <Choice value={a.fever} onChange={(v) => set("fever", v)} options={[{ v: true, label: "Evet" }, { v: false, label: "Hayır" }]} />
      </Question>

      <Question n={6} title={rf.q}>
        <Choice value={a.redFlag} danger onChange={(v) => set("redFlag", v)} options={[{ v: true, label: "Evet" }, { v: false, label: "Hayır" }]} />
        {a.redFlag && (
          <p className="mt-2 rounded-lg border border-danger/40 bg-danger/10 px-2.5 py-2 text-xs text-danger">
            Bu yanıt öncelikli değerlendirme gerektirebilir. Belirtiler şu an çok şiddetliyse beklemeden 112’yi arayın.
          </p>
        )}
      </Question>

      <div className="flex gap-2">
        <button type="button" onClick={back} className={ghostBtn} title="Analiz adımına dön">
          <ArrowLeft className="size-4" aria-hidden />
          Geri
        </button>
        <button type="button" onClick={onFinish} disabled={!answersComplete(a)} className={primaryBtn}>
          <ClipboardList className="size-4" aria-hidden />
          Triyaj sonucunu gör
        </button>
      </div>
      {!answersComplete(a) && <p className="-mt-3 text-center text-[11px] text-muted">Sonuç için tüm soruları yanıtlayın.</p>}
    </div>
  );
}

/* ───────────────────────── 4 · Sonuç özeti (çalışma alanında) ───────────────────────── */

function DoneStep() {
  const result = useAnatomyStore((s) => s.analysisResult);
  const reset = useAnatomyStore((s) => s.resetAnalysis);
  if (!result) return null;
  const t = TRIAGE_LEVELS[result.triageLevel];
  const st = LEVEL_STYLE[result.triageLevel];
  return (
    <div className="mt-4 grid gap-3 animate-rise">
      <div className={cn("flex items-center gap-3 rounded-xl border p-3", st.border, st.soft)}>
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-xl font-mono text-sm font-semibold", st.text, "bg-background/50")}>{t.code}</span>
        <div className="min-w-0">
          <div className={cn("text-sm font-semibold", st.text)}>{t.label}</div>
          <div className="flex items-center gap-1.5 truncate text-xs text-muted">
            <Stethoscope className="size-3 shrink-0" aria-hidden />
            {result.department}
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Link href="/triyaj" className={primaryBtn}>
          Triyaj sonucunu aç
          <ArrowRight className="size-4" aria-hidden />
        </Link>
        <button type="button" onClick={reset} className={ghostBtn}>
          <RotateCcw className="size-4" aria-hidden />
          Yeni şikayet
        </button>
      </div>
    </div>
  );
}

/** Sağ panel: şikayet → analiz → takip soruları → triyaj sonucu sayfası. */
export function TriageFlow() {
  const router = useRouter();
  const step = useAnatomyStore((s) => s.triageStep);
  const run = useAnatomyStore((s) => s.runAnalysis);
  const finish = useAnatomyStore((s) => s.finishTriage);

  const analyze = async () => {
    await run();
    // Ön kapıda kırmızı bayrak: takip soruları atlanır, sonuç sayfası hemen açılır.
    if (useAnatomyStore.getState().triageStep === "done") router.push("/triyaj");
  };

  return (
    <section aria-labelledby="triage-title" className="glass rounded-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <h2 id="triage-title" className="text-base font-semibold tracking-tight">
          {step === "questions" ? "Birkaç soru daha" : step === "review" ? "Şikayetinizi doğrulayın" : step === "done" ? "Triyaj tamamlandı" : "Şikayetinizi anlatın"}
        </h2>
      </div>
      <div className="mt-3">
        <Stepper step={step} />
      </div>

      {(step === "describe" || step === "analyzing") && <DescribeStep onAnalyze={() => void analyze()} />}
      {step === "review" && <ReviewStep />}
      {step === "questions" && (
        <QuestionsStep
          onFinish={() => {
            finish();
            router.push("/triyaj");
          }}
        />
      )}
      {step === "done" && <DoneStep />}
    </section>
  );
}
