"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Armchair, ArrowLeft, BookOpen, BriefcaseMedical, Check, CircleHelp, ClipboardList, Clock, Crosshair, Hospital, Lock, MapPin, Phone, Plus, Printer, Stethoscope,
  Thermometer, TriangleAlert,
} from "lucide-react";
import { layerDef } from "@/lib/layers";
import { doctorQuestions, DURATIONS, TRIAGE_LEVELS, type TriageResult } from "@/lib/triage";
import { LEVEL_STYLE } from "@/lib/triageStyles";
import { useAnatomyStore } from "@/store/useAnatomyStore";
import { cn } from "@/lib/utils";
import { BodyMap2D, Bullets, ClinicalNotes, ClinicalScore, Disclaimer, LevelScale, SectionTitle } from "./parts";

const card = "glass rounded-card p-5";
const ghostBtn = "flex h-10 items-center gap-2 rounded-xl border border-line px-3.5 text-sm font-medium transition hover:bg-surface-2";
const primaryBtn = "flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:bg-accent-strong";

/** Sonuç sayfası işlemleri: 3B'de göster, yazdır, yeni değerlendirme. */
function useActions() {
  const router = useRouter();
  const focusResult = useAnatomyStore((s) => s.focusResult);
  const reset = useAnatomyStore((s) => s.resetAnalysis);
  return {
    show3d: () => {
      focusResult();
      router.push("/");
    },
    restart: () => {
      reset();
      router.push("/");
    },
  };
}

/* ───────────────────────── T1 · Acil ───────────────────────── */

function CriticalResult({ result, clinician }: { result: TriageResult; clinician: boolean }) {
  const { restart } = useActions();
  return (
    <div className="grid gap-4">
      <section
        role="alert"
        aria-labelledby="t1-title"
        className="relative overflow-hidden rounded-card bg-danger p-6 text-white shadow-[0_30px_80px_-30px_var(--danger)] sm:p-9"
      >
        <div aria-hidden className="absolute inset-0" style={{ backgroundImage: "repeating-linear-gradient(135deg, rgb(255 255 255 / 0.07) 0 16px, transparent 16px 32px)" }} />
        <div className="relative grid items-end gap-6 lg:grid-cols-[1fr_auto]">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium opacity-90">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-white opacity-80" />
                <span className="relative inline-flex size-2 rounded-full bg-white" />
              </span>
              T1 · Acil · Kırmızı bayrak
            </div>
            <h1 id="t1-title" className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Hemen 112’yi arayın.
            </h1>
            <p className="mt-3 max-w-xl text-[15px] opacity-90">{result.redFlagReason} Beklemeyin; yalnız kalmayın.</p>
            <div className="mt-4 inline-flex flex-wrap gap-x-4 gap-y-1 rounded-xl bg-white/10 px-3 py-2 font-mono text-[11px]">
              <span>Kural {result.ruleId}</span>
              <span>{result.primaryRegion}</span>
              <span>{result.ruleId.startsWith("RF-Q") ? "Karar anı: takip sorusu" : "Karar anı: ön kapı (yapay zekâdan önce)"}</span>
            </div>
          </div>
          <a
            href="tel:112"
            className="inline-flex h-16 items-center justify-center gap-3 rounded-2xl bg-white px-8 text-2xl font-semibold text-danger shadow-xl transition hover:scale-[1.02]"
          >
            <Phone className="size-6" strokeWidth={2.4} aria-hidden />
            112
          </a>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className={card}>
          <SectionTitle icon={MapPin} tone="text-danger">
            Acil servise nasıl gidilir
          </SectionTitle>
          <Bullets
            dot="bg-danger"
            items={["Kendiniz araç kullanmayın; ambulansı ya da bir yakınınızı bekleyin.", "Size en yakın hastanenin acil servisine başvurun.", "Kimliğinizi ve kullandığınız ilaçların listesini yanınıza alın."]}
          />
        </section>
        <section className={card}>
          <SectionTitle icon={Hospital} tone="text-danger">
            Yardım gelene kadar
          </SectionTitle>
          <Bullets dot="bg-danger" items={["Hareketi azaltın; oturun ya da uzanın.", "Yanınızda biri varsa durumu ona söyleyin.", "Kapıyı açık bırakın, telefonunuzu yanınızda tutun."]} />
        </section>
      </div>

      {clinician && <ClinicalScore level="critical" />}

      <p className="flex gap-2 text-xs text-muted">
        <Lock className="mt-px size-3.5 shrink-0" aria-hidden />
        Bu seviyede olası durumlar, evde bakım ve poliklinik önerileri gösterilmez.
      </p>
      <div>
        <button type="button" onClick={restart} className={ghostBtn}>
          <Plus className="size-4" aria-hidden />
          Yeni değerlendirme
        </button>
      </div>
    </div>
  );
}

/* ───────────────────────── T2–T4 ───────────────────────── */

const ANSWER_ROWS = (r: TriageResult): [string, string][] => {
  const a = r.answers;
  return [
    ["Ağrı şiddeti", a.severity !== null ? `${a.severity}/10` : "—"],
    ["Süre", DURATIONS.find((d) => d.id === a.duration)?.label ?? "—"],
    ["Başlangıç", a.onset === "sudden" ? "Aniden" : a.onset === "gradual" ? "Yavaş yavaş" : "—"],
    ["Seyir", a.course === "worse" ? "Artıyor" : a.course === "same" ? "Aynı" : a.course === "better" ? "Azalıyor" : "—"],
    ["Ateş", a.fever ? "Var" : "Yok"],
    ["Kırmızı bayrak sorusu", a.redFlag ? "Evet" : "Hayır"],
  ];
};

function Header({ result }: { result: TriageResult }) {
  const t = TRIAGE_LEVELS[result.triageLevel];
  const st = LEVEL_STYLE[result.triageLevel];
  const { show3d, restart } = useActions();
  return (
    <section className={cn("relative overflow-hidden rounded-card border bg-surface/70 p-5 backdrop-blur sm:p-6", st.border)} style={{ boxShadow: `0 24px 60px -36px ${st.cssVar}` }}>
      <div aria-hidden className="absolute -top-20 -right-20 size-64 rounded-full opacity-20 blur-3xl" style={{ background: st.cssVar }} />
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-4">
          <div className={cn("grid size-16 shrink-0 place-items-center rounded-2xl border", st.soft, st.text, st.border)}>
            <span className="font-mono text-xl font-semibold">{t.code}</span>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium tracking-[0.12em] text-muted uppercase">Triyaj sonucu</div>
            <h1 className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xl font-semibold tracking-[-0.02em] sm:text-[28px]">
              {t.label}
              <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium", st.soft, st.text)}>
                <Clock className="size-3" aria-hidden />
                {t.timeframe}
              </span>
            </h1>
            <p className="mt-1 max-w-xl text-sm text-muted">{t.action}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="button" onClick={show3d} className={ghostBtn}>
            <Crosshair className="size-4" aria-hidden />
            3B modelde göster
          </button>
          <button type="button" onClick={() => window.print()} className={ghostBtn}>
            <Printer className="size-4" aria-hidden />
            Yazdır / PDF
          </button>
          <button type="button" onClick={restart} className={primaryBtn}>
            <Plus className="size-4" aria-hidden />
            Yeni değerlendirme
          </button>
        </div>
      </div>
      <div className="relative mt-5">
        <LevelScale level={result.triageLevel} labels />
      </div>
      <ol className="relative mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-muted">
        {["Kırmızı bayrak ön kontrolü", "Semptom çıkarımı", "Bölge onayı", "Takip soruları · 6 yanıt", "Kural kontrolü"].map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <Check className="size-3 text-success" strokeWidth={3} aria-hidden />
            {s}
          </li>
        ))}
      </ol>
    </section>
  );
}

function RegionSummary({ result }: { result: TriageResult }) {
  return (
    <section className={cn(card, "lg:col-span-4 lg:row-span-3")}>
      <div className="flex items-center justify-between">
        <SectionTitle icon={Crosshair} tone="text-pain">
          Vücut bölgesi özeti
        </SectionTitle>
        <span className="rounded-full bg-pain/12 px-2 py-0.5 text-[11px] font-medium text-pain">{result.regions.length} bölge</span>
      </div>
      <div className="relative mt-3 rounded-xl bg-[radial-gradient(60%_55%_at_50%_48%,var(--scene-glow),transparent_70%)] py-3">
        <BodyMap2D regions={result.regions} className="mx-auto h-[300px] w-auto" />
      </div>

      {result.regions.length > 0 && (
        <ul className="mt-3 grid gap-2.5">
          {result.regions.map((r) => (
            <li key={r.id}>
              <div className="text-sm font-semibold">{r.name}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {r.structures.map((s) => (
                  <span key={s.meshId} className="flex items-center gap-1.5 rounded-full bg-surface-2 px-2 py-0.5 text-[11px]">
                    <span className="size-1.5 rounded-[2px]" style={{ background: layerDef(s.layer).color }} />
                    {s.label}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">Yanıtlarınız</div>
      <dl className="mt-2 grid grid-cols-2 gap-1.5">
        {ANSWER_ROWS(result).map(([k, v]) => (
          <div key={k} className="rounded-lg bg-surface-2/70 px-3 py-2">
            <dt className="text-[10px] text-muted">{k}</dt>
            <dd className="text-sm font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      {result.symptoms.length > 0 && (
        <>
          <div className="mt-4 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">Belirtiler</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.symptoms.map((s) => (
              <span key={s.code} className="rounded-full border border-line px-2.5 py-0.5 text-[11px]">
                {s.name}
              </span>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

function Recommendation({ result }: { result: TriageResult }) {
  const st = LEVEL_STYLE[result.triageLevel];
  const title = { critical: "Başvuru", urgent: "Bugün başvurulacak birim", routine: "Önerilen poliklinik", self_care: "Şikayet sürerse başvurulacak birim" }[result.triageLevel];
  return (
    <section className={cn(card, "relative overflow-hidden lg:col-span-8")}>
      <div aria-hidden className="absolute -top-16 -right-16 size-56 rounded-full bg-accent/10 blur-2xl" />
      <div className="relative">
        <SectionTitle icon={Stethoscope} tone={st.text}>
          {title}
        </SectionTitle>
        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{result.department}</h2>
        <div className="mt-4 rounded-xl border border-line bg-surface/60 p-3.5">
          <div className="text-xs text-muted">Gerekçe</div>
          <p className="mt-1 text-sm leading-relaxed">{result.summary}</p>
          <ul className="mt-2.5 grid gap-1">
            {result.reasons.map((r) => (
              <li key={r} className="flex gap-2 font-mono text-[11px] text-muted">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", st.dot)} />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Conditions({ items }: { items: string[] }) {
  if (!items.length) return null;
  return (
    <section className="lg:col-span-12">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <h3 className="text-sm font-semibold">Bu şikayetle ilişkilendirilebilecek bazı durumlar</h3>
        <span className="text-xs text-muted">Eğitim amaçlıdır · olasılık sıralaması değildir</span>
      </div>
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {items.map((c) => (
          <div key={c} className="glass rounded-card p-4">
            <span className="grid size-8 place-items-center rounded-lg bg-accent/10 text-accent">
              <BookOpen className="size-4" aria-hidden />
            </span>
            <div className="mt-3 text-sm font-medium">{c}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function SelfCare({ result }: { result: TriageResult }) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  if (result.triageLevel !== "self_care") {
    return (
      <section className={cn(card, "lg:col-span-12")}>
        <SectionTitle icon={Lock}>Öz-bakım rehberi</SectionTitle>
        <p className="mt-2 text-sm text-muted">
          Esneme ve ergonomi önerileri yalnızca <b className="font-medium text-foreground">T4 · Evde izlem</b> seviyesinde gösterilir. Muayene gerektiren bir
          şikayette ev önerileri durumu olduğundan hafif gösterebilir.
        </p>
      </section>
    );
  }
  const ergo = result.ergonomics ?? [];
  return (
    <section className={cn(card, "lg:col-span-12")}>
      <SectionTitle icon={Thermometer} tone="text-success">
        Öz-bakım rehberi · rahatlama, esneme, ergonomi
      </SectionTitle>
      <div className="mt-3 grid gap-4 lg:grid-cols-3">
        <div>
          <div className="text-sm font-medium">Rahatlama ve dinlenme</div>
          <Bullets items={result.supportiveAdvice} dot="bg-success" />
        </div>
        {result.stretches && (
          <ol className="grid gap-2">
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
        )}
        {ergo.length > 0 && (
          <div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium">
                <Armchair className="size-4 text-success" aria-hidden />
                Ergonomi ve duruş
              </span>
              <span className="font-mono text-[10px] text-muted tabular-nums">
                {Object.values(checked).filter(Boolean).length}/{ergo.length}
              </span>
            </div>
            <ul className="mt-2 grid gap-1.5">
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
          </div>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">Ağrı artarsa hareketi bırakın. Size özel egzersiz planını yalnızca sağlık profesyoneliniz oluşturabilir.</p>
    </section>
  );
}

function StandardResult({ result, clinician }: { result: TriageResult; clinician: boolean }) {
  const level = result.triageLevel;
  return (
    <div className="grid gap-4">
      <Header result={result} />
      <div className="grid gap-4 lg:grid-cols-12">
        <RegionSummary result={result} />
        <Recommendation result={result} />

        {level === "urgent" && result.firstAid && (
          <section className="rounded-card border border-warning/45 bg-warning/10 p-5 lg:col-span-4">
            <SectionTitle icon={BriefcaseMedical} tone="text-warning">
              Başvuruya kadar
            </SectionTitle>
            <Bullets items={result.firstAid} dot="bg-warning" />
          </section>
        )}
        {level === "routine" && result.visitPrep && (
          <section className={cn(card, "lg:col-span-4")}>
            <SectionTitle icon={ClipboardList}>Randevuya giderken</SectionTitle>
            <Bullets items={result.visitPrep} dot="bg-accent" />
          </section>
        )}
        {level === "self_care" && (
          <section className={cn(card, "lg:col-span-4")}>
            <SectionTitle icon={CircleHelp}>Doktorunuza sorabilecekleriniz</SectionTitle>
            <ol className="mt-2.5 grid gap-2 text-sm">
              {doctorQuestions(level).map((q, i) => (
                <li key={q} className="flex gap-2.5">
                  <span className="mt-0.5 font-mono text-[11px] text-muted tabular-nums">{i + 1}.</span>
                  {q}
                </li>
              ))}
            </ol>
          </section>
        )}
        <section className="rounded-card border border-warning/35 bg-warning/8 p-5 lg:col-span-4">
          <SectionTitle icon={TriangleAlert} tone="text-warning">
            Şu durumlarda beklemeyin
          </SectionTitle>
          <Bullets items={result.warningSigns} dot="bg-warning" />
          <p className="mt-2 text-[11px] text-muted">Bu belirtilerden biri olursa 112’yi arayın veya acil servise başvurun.</p>
        </section>

        {level !== "self_care" && (
          <section className={cn(card, "lg:col-span-8")}>
            <SectionTitle icon={CircleHelp}>Doktorunuza sorabilecekleriniz</SectionTitle>
            <ol className="mt-2.5 grid gap-2 text-sm sm:grid-cols-2">
              {doctorQuestions(level).map((q, i) => (
                <li key={q} className="flex gap-2.5">
                  <span className="mt-0.5 font-mono text-[11px] text-muted tabular-nums">{i + 1}.</span>
                  {q}
                </li>
              ))}
            </ol>
          </section>
        )}
        <Conditions items={result.possibleConditions} />
        <SelfCare key={result.ruleId} result={result} />
        {clinician && (
          <div className="grid gap-4 lg:col-span-12 lg:grid-cols-2">
            <ClinicalScore level={level} />
            <ClinicalNotes result={result} />
          </div>
        )}
      </div>
    </div>
  );
}

/** /triyaj sayfası: son triyajın tam sonucu. Sonuç yalnızca bellekte tutulur (sayfa yenilenince silinir). */
export function TriageResultView() {
  const result = useAnatomyStore((s) => s.analysisResult);
  const role = useAnatomyStore((s) => s.role);

  if (!result) {
    return (
      <div className="mx-auto grid max-w-md place-items-center gap-3 py-20 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent">
          <ClipboardList className="size-6" aria-hidden />
        </span>
        <h1 className="text-xl font-semibold tracking-tight">Gösterilecek triyaj sonucu yok</h1>
        <p className="text-sm text-muted">Sağlık verilerinizi korumak için sonuçlar yalnızca bu oturumda, sayfa yenilenene kadar tutulur.</p>
        <Link href="/" className={cn(primaryBtn, "mt-2")}>
          <ArrowLeft className="size-4" aria-hidden />
          Şikayetinizi anlatın
        </Link>
      </div>
    );
  }

  const clinician = role === "clinician";
  return (
    <div className="grid gap-4">
      <Disclaimer />
      {result.triageLevel === "critical" ? <CriticalResult result={result} clinician={clinician} /> : <StandardResult result={result} clinician={clinician} />}
      <footer className="flex flex-wrap gap-x-5 gap-y-1 px-1 pb-4 font-mono text-[10px] text-muted">
        <span>Kural {result.ruleId}</span>
        <span>İlk kural seviyesi {TRIAGE_LEVELS[result.baseLevel].code}</span>
        <span>Kural tabanı v0.4 · simülasyon</span>
      </footer>
    </div>
  );
}
