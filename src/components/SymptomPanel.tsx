"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, RotateCcw, Sparkles } from "lucide-react";
import { QUICK_TAGS, TRIAGE_LEVELS } from "@/lib/triage";
import { LEVEL_STYLE } from "@/lib/triageStyles";
import { ANALYSIS_DURATION_MS, SYMPTOM_MAX_LENGTH, useAnatomyStore } from "@/store/useAnatomyStore";
import { cn } from "@/lib/utils";

const STEPS = ["Kırmızı bayrak ön kontrolü", "Semptom ve bölge çıkarımı", "Anatomik eşleme", "Branş ve triyaj kuralları"];

/** Analiz sürerken adımları süreye yayarak ilerleten gösterge. */
function AnalysisSteps() {
  const [done, setDone] = useState(0);
  useEffect(() => {
    const step = ANALYSIS_DURATION_MS / STEPS.length;
    const timers = STEPS.map((_, i) => setTimeout(() => setDone(i + 1), step * (i + 1) - 120));
    return () => timers.forEach(clearTimeout);
  }, []);
  return (
    <ol className="mt-3 grid gap-1.5 text-xs" aria-live="polite">
      {STEPS.map((s, i) => (
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

export function SymptomPanel() {
  const text = useAnatomyStore((s) => s.symptomText);
  const setText = useAnatomyStore((s) => s.setSymptomText);
  const state = useAnatomyStore((s) => s.analysisState);
  const run = useAnatomyStore((s) => s.runAnalysis);
  const reset = useAnatomyStore((s) => s.resetAnalysis);
  const analyzing = state === "analyzing";

  return (
    <section aria-labelledby="symptom-title" className="glass rounded-card p-4 sm:p-5">
      <h2 id="symptom-title" className="text-base font-semibold tracking-tight">
        Şikayetinizi anlatın
      </h2>
      <p className="mt-1 text-xs text-muted">Kendi cümlelerinizle yazın: nerede, ne zamandır, nasıl bir ağrı?</p>

      <form
        className="mt-3"
        onSubmit={(e) => {
          e.preventDefault();
          void run();
        }}
      >
        <label htmlFor="symptom-text" className="sr-only">
          Şikayet metni
        </label>
        <div className="relative">
          <textarea
            id="symptom-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void run();
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
          <div className="text-[11px] font-medium tracking-[0.12em] text-muted uppercase">Hızlı test</div>
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
                    on ? `${st.border} ${st.soft}` : "border-line hover:border-line hover:bg-surface-2/70",
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
          <button
            type="submit"
            disabled={analyzing || !text.trim()}
            className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-accent-foreground shadow-[0_8px_24px_-12px_var(--accent)] transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none"
          >
            {analyzing ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <Sparkles className="size-4" aria-hidden />}
            {analyzing ? "Analiz ediliyor…" : "Analiz Et"}
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={state === "idle" && !text}
            className="flex h-10 items-center gap-2 rounded-xl border border-line px-3.5 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-40"
          >
            <RotateCcw className="size-4" aria-hidden />
            Yeni şikayet
          </button>
        </div>
      </form>

      {analyzing && <AnalysisSteps />}
    </section>
  );
}
