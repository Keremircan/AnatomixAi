"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, HeartPulse, LoaderCircle, Lock, Plus, Ruler, X } from "lucide-react";
import { AuthError, saveHealthData } from "@/lib/auth";
import {
  BLOOD_PRESSURE, BLOOD_SUGAR, BLOOD_TYPES, bmiOf, DISABILITY_MAX_LENGTH, EMPTY_HEALTH, HABIT_LABEL, HABITS, ITEM_MAX_LENGTH, LIST_MAX_ITEMS, SUGGESTIONS,
  type HealthData, type HealthListKey,
} from "@/lib/health";
import { useAnatomyStore } from "@/store/useAnatomyStore";
import { cn } from "@/lib/utils";
import { BirthDatePicker } from "@/components/ui/BirthDatePicker";

const STEPS = [
  { title: "Biyometri ve temel bilgiler", hint: "Yaş, boy ve kilo; ağrı ve risk değerlendirmesinde kullanılır." },
  { title: "Vital ve kronik göstergeler", hint: "Tansiyon, şeker, alerji ve süregelen hastalıklar triyaj seviyesini etkileyebilir." },
  { title: "Geçmiş ve alışkanlıklar", hint: "Ameliyat, implant ve alışkanlıklar başvuru önerilerini kişiselleştirir." },
] as const;

/* ───────────────────────── Form parçaları ───────────────────────── */

function Label({ htmlFor, children, optional = true }: { htmlFor?: string; children: React.ReactNode; optional?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-[13px] font-medium">
      {children}
      {optional && <span className="ml-1.5 font-normal text-muted">(opsiyonel)</span>}
    </label>
  );
}

function ChipGroup<T extends string>({
  label, options, value, onChange, render = (v) => v, cols,
}: { label: string; options: readonly T[]; value: T | null; onChange: (v: T | null) => void; render?: (v: T) => string; cols?: string }) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1.5 text-[13px] font-medium">
        {label}
        <span className="ml-1.5 font-normal text-muted">(opsiyonel)</span>
      </legend>
      <div className={cn("grid gap-1.5", cols ?? "grid-cols-2 sm:grid-cols-4")}>
        {options.map((o) => {
          const on = value === o;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={on}
              // Seçili seçeneğe yeniden tıklamak seçimi kaldırır.
              onClick={() => onChange(on ? null : o)}
              className={cn(
                "min-h-9 min-w-0 rounded-lg border px-1.5 py-1.5 text-[13px] leading-tight [overflow-wrap:anywhere] transition",
                on ? "border-accent/60 bg-accent/12 font-medium text-accent" : "border-line hover:bg-surface-2/70",
              )}
            >
              {render(o)}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** Etiket girişi: Enter veya virgülle ekler; öneriler tek tıkla eklenir; etiketler × ile çıkarılır. */
function TagInput({ id, label, value, onChange, suggestions, placeholder }: { id: string; label: string; value: string[]; onChange: (v: string[]) => void; suggestions: readonly string[]; placeholder: string }) {
  const [draft, setDraft] = useState("");
  const full = value.length >= LIST_MAX_ITEMS;
  const has = (t: string) => value.some((v) => v.toLocaleLowerCase("tr-TR") === t.toLocaleLowerCase("tr-TR"));
  const add = (raw: string) => {
    const t = raw.replace(/\s+/g, " ").trim().slice(0, ITEM_MAX_LENGTH);
    if (t && !has(t) && !full) onChange([...value, t]);
    setDraft("");
  };
  const open = suggestions.filter((s) => !has(s));

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface-2/70 p-1.5 focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15">
        {value.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-lg bg-accent/12 py-1 pr-1 pl-2.5 text-[12px] font-medium text-accent">
            {t}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== t))} aria-label={`${t} kaldır`} className="grid size-5 place-items-center rounded-md hover:bg-accent/20">
              <X className="size-3" aria-hidden />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          disabled={full}
          maxLength={ITEM_MAX_LENGTH}
          onChange={(e) => {
            const v = e.target.value;
            if (v.endsWith(",")) add(v.slice(0, -1));
            else setDraft(v);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={value.length ? "Ekle…" : placeholder}
          className="h-8 min-w-32 flex-1 bg-transparent px-1.5 text-sm placeholder:text-muted/70 focus:outline-none"
        />
      </div>
      {open.length > 0 && !full && (
        <div className="flex flex-wrap gap-1">
          {open.slice(0, 8).map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted transition hover:border-accent/50 hover:text-accent">
              <Plus className="size-3" aria-hidden />
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-surface-2/70 px-3 text-sm placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15 focus:outline-none";

/* ───────────────────────── Adımlar ───────────────────────── */

type StepProps = { data: HealthData; set: <K extends keyof HealthData>(k: K, v: HealthData[K]) => void; uid: string };

function StepBiometrics({ data, set, uid }: StepProps) {
  const bmi = bmiOf(data);
  return (
    <div className="grid gap-5">
      <ChipGroup label="Kan grubu" options={BLOOD_TYPES} value={data.bloodType} onChange={(v) => set("bloodType", v)} cols="grid-cols-4" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-h`}>Boy (cm)</Label>
          <input id={`${uid}-h`} type="number" inputMode="numeric" min={40} max={250} value={data.heightCm ?? ""} placeholder="175"
            onChange={(e) => set("heightCm", e.target.value === "" ? null : Math.round(Number(e.target.value)))} className={inputCls} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${uid}-w`}>Kilo (kg)</Label>
          <input id={`${uid}-w`} type="number" inputMode="decimal" min={2} max={400} step={0.1} value={data.weightKg ?? ""} placeholder="72"
            onChange={(e) => set("weightKg", e.target.value === "" ? null : Number(e.target.value))} className={inputCls} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${uid}-b`}>Doğum tarihi</Label>
        <BirthDatePicker id={`${uid}-b`} value={data.birthDate} onChange={(v) => set("birthDate", v)} />
      </div>
      {bmi && (
        <p className="flex items-center gap-2 rounded-xl border border-line bg-surface-2/50 px-3 py-2 text-sm">
          <Ruler className="size-4 text-accent" aria-hidden />
          Vücut kitle indeksi: <b className="font-mono font-semibold">{bmi.value.toLocaleString("tr-TR")}</b>
          <span className="text-muted">· {bmi.label}</span>
        </p>
      )}
    </div>
  );
}

function StepVitals({ data, set, uid }: StepProps) {
  return (
    <div className="grid gap-5">
      <ChipGroup label="Tansiyon durumu" options={BLOOD_PRESSURE} value={data.bloodPressureStatus} onChange={(v) => set("bloodPressureStatus", v)} />
      <ChipGroup label="Kan şekeri durumu" options={BLOOD_SUGAR} value={data.bloodSugarStatus} onChange={(v) => set("bloodSugarStatus", v)} cols="grid-cols-2 sm:grid-cols-3" />
      <TagList data={data} set={set} uid={uid} k="allergies" label="Bilinen alerjiler" placeholder="Ör. penisilin, fıstık" />
      <TagList data={data} set={set} uid={uid} k="chronicConditions" label="Süregelen (kronik) hastalıklar" placeholder="Ör. astım, hipotiroidi" />
      <TagList data={data} set={set} uid={uid} k="regularMedications" label="Düzenli kullanılan ilaçlar" placeholder="Ör. levotiroksin 50 mcg" />
    </div>
  );
}

function StepHistory({ data, set, uid }: StepProps) {
  return (
    <div className="grid gap-5">
      <TagList data={data} set={set} uid={uid} k="surgicalHistory" label="Geçirilmiş ameliyatlar" placeholder="Ör. apandisit ameliyatı (2019)" />
      <TagList data={data} set={set} uid={uid} k="medicalDevices" label="Tıbbi cihaz, implant veya protez" placeholder="Ör. kalp pili, platin" />
      <div className="grid gap-1.5">
        <Label htmlFor={`${uid}-dis`}>Engel durumu</Label>
        <textarea id={`${uid}-dis`} rows={2} maxLength={DISABILITY_MAX_LENGTH} value={data.disabilityStatus ?? ""} placeholder="Varsa kısaca açıklayın"
          onChange={(e) => set("disabilityStatus", e.target.value || null)} className={cn(inputCls, "h-auto resize-none py-2.5")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChipGroup label="Sigara" options={HABITS} value={data.lifestyle.smoking} render={(v) => HABIT_LABEL[v]} cols="grid-cols-3"
          onChange={(v) => set("lifestyle", { ...data.lifestyle, smoking: v })} />
        <ChipGroup label="Alkol" options={HABITS} value={data.lifestyle.alcohol} render={(v) => HABIT_LABEL[v]} cols="grid-cols-3"
          onChange={(v) => set("lifestyle", { ...data.lifestyle, alcohol: v })} />
      </div>
    </div>
  );
}

function TagList({ data, set, uid, k, label, placeholder }: StepProps & { k: HealthListKey; label: string; placeholder: string }) {
  return <TagInput id={`${uid}-${k}`} label={label} value={data[k]} onChange={(v) => set(k, v)} suggestions={SUGGESTIONS[k]} placeholder={placeholder} />;
}

/* ───────────────────────── Tamamlandı ───────────────────────── */

const CONFETTI = Array.from({ length: 22 }, (_, i) => ({
  x: Math.cos((i / 22) * Math.PI * 2) * (70 + (i % 3) * 22),
  y: Math.sin((i / 22) * Math.PI * 2) * (70 + (i % 3) * 22) - 20,
  c: ["var(--accent)", "var(--teal)", "var(--success)", "var(--caution)", "var(--pain)"][i % 5],
  r: (i * 47) % 360,
}));

function Done({ onClose }: { onClose: () => void }) {
  return (
    <div className="grid place-items-center gap-3 px-6 py-12 text-center">
      <div className="relative grid size-20 place-items-center">
        {CONFETTI.map((p, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute size-2 rounded-[2px] animate-confetti"
            style={{ background: p.c, "--cx": `${p.x}px`, "--cy": `${p.y}px`, "--cr": `${p.r}deg`, animationDelay: `${(i % 4) * 40}ms` } as React.CSSProperties}
          />
        ))}
        <span className="grid size-20 place-items-center rounded-full bg-success/15 text-success animate-rise">
          <Check className="size-10" strokeWidth={2.6} aria-hidden />
        </span>
      </div>
      <h2 className="mt-2 text-xl font-semibold tracking-tight">Kişiselleştirme tamamlandı</h2>
      <p className="max-w-sm text-sm text-muted">Triyaj önerileriniz artık sağlık profilinize göre değerlendirilecek. Bilgilerinizi istediğiniz an profil sayfanızdan düzenleyebilir veya silebilirsiniz.</p>
      <button type="button" onClick={onClose} className="mt-2 h-10 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-strong">
        Tamam
      </button>
    </div>
  );
}

/* ───────────────────────── Sihirbaz ───────────────────────── */

/**
 * Kişiselleştirilmiş sağlık profili sihirbazı (3 adım, tamamen isteğe bağlı). Her "Sonraki adım"da ilerleme
 * kaydedilir; son adımda profil tamamlandı olarak işaretlenir. Ana sayfadaki hatırlatma bandından veya profil
 * sayfasından açılır (store: healthWizardStep).
 */
export function HealthOnboardingModal() {
  const step = useAnatomyStore((s) => s.healthWizardStep);
  const stored = useAnatomyStore((s) => s.health);
  const setHealth = useAnatomyStore((s) => s.setHealth);
  const openStep = useAnatomyStore((s) => s.openHealthWizard);
  const close = useAnatomyStore((s) => s.closeHealthWizard);
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const uid = useId();
  const [data, setData] = useState<HealthData>(EMPTY_HEALTH);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const open = step !== null;

  // Açılışta mevcut profil forma yüklenir; dialog açılır/kapanır.
  const [openedFor, setOpenedFor] = useState(false);
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setData(stored ?? EMPTY_HEALTH);
      setDone(false);
      setError(null);
    }
  }
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    // Yeni adım en üstten başlar (scrollTo bazı tarayıcılarda Promise döndürür; değer döndürülmemeli).
    bodyRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const set: StepProps["set"] = (k, v) => setData((d) => ({ ...d, [k]: v }));

  async function persist(completed: boolean) {
    setSaving(true);
    setError(null);
    try {
      const res = await saveHealthData({ ...data, isCompleted: completed || !!stored?.isCompleted });
      setHealth(res.health, false);
      return true;
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Kaydedilemedi. Lütfen tekrar deneyin.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function next(skip: boolean) {
    if (step === null) return;
    const last = step === STEPS.length - 1;
    // "Atla": bu adımda girilenler yine korunur ama sunucuya yalnızca son adımda/ileri dendiğinde gider.
    if (!skip || last) {
      const ok = await persist(last);
      if (!ok) return;
    }
    if (last) setDone(true);
    else openStep(step + 1);
  }

  if (!open && !openedFor) return null;
  const s = step ?? 0;

  return (
    <dialog
      ref={ref}
      aria-labelledby={`${uid}-title`}
      onCancel={(e) => {
        e.preventDefault();
        if (!saving) close();
      }}
      className="glass m-auto w-[min(94vw,40rem)] overflow-hidden rounded-card p-0 text-foreground shadow-elev open:animate-rise"
    >
      {done ? (
        <Done onClose={close} />
      ) : (
        <div className="flex max-h-[min(88dvh,46rem)] flex-col">
          <header className="border-b border-line px-5 pt-5 pb-4 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent">
                  <HeartPulse className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 id={`${uid}-title`} className="text-lg font-semibold tracking-tight">
                    Kişiselleştirilmiş sağlık profili
                  </h2>
                  <p className="text-xs text-muted">Tamamen isteğe bağlı · her adımı atlayabilirsiniz</p>
                </div>
              </div>
              <button type="button" onClick={close} disabled={saving} aria-label="Kapat" className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-foreground">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <ol className="mt-4 grid grid-cols-3 gap-1.5" aria-label="Adımlar">
              {STEPS.map((st, i) => (
                <li key={st.title} aria-current={i === s ? "step" : undefined}>
                  <button type="button" onClick={() => openStep(i)} disabled={saving} className="w-full text-left">
                    <span className={cn("block h-1 rounded-full transition", i <= s ? "bg-accent" : "bg-line")} />
                    <span className={cn("mt-1.5 block truncate text-[11px]", i === s ? "font-medium text-foreground" : "text-muted")}>
                      {i + 1}. {st.title}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </header>

          <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            <p className="mb-4 text-sm text-muted">{STEPS[s].hint}</p>
            {s === 0 && <StepBiometrics data={data} set={set} uid={uid} />}
            {s === 1 && <StepVitals data={data} set={set} uid={uid} />}
            {s === 2 && <StepHistory data={data} set={set} uid={uid} />}
            <p className="mt-5 flex gap-2 text-[11px] leading-snug text-muted">
              <Lock className="mt-px size-3.5 shrink-0" aria-hidden />
              Bu bilgiler yalnızca sizin hesabınızda saklanır ve triyaj önerilerini kişiselleştirmek için kullanılır. Teşhis amacı taşımaz; dilediğiniz an profilinizden silebilirsiniz.
            </p>
          </div>

          <footer className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3.5 sm:px-6">
            {error && (
              <p role="alert" className="basis-full text-[13px] text-danger">
                {error}
              </p>
            )}
            {s > 0 && (
              <button type="button" onClick={() => openStep(s - 1)} disabled={saving} className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm text-muted transition hover:bg-surface-2 hover:text-foreground">
                <ArrowLeft className="size-4" aria-hidden />
                Geri
              </button>
            )}
            <span className="flex-1" />
            <button type="button" onClick={() => void next(true)} disabled={saving} className="h-10 rounded-xl border border-line px-4 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground">
              Atla
            </button>
            <button
              type="button"
              onClick={() => void next(false)}
              disabled={saving}
              className="flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:bg-accent-strong disabled:opacity-60"
            >
              {saving ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : s === STEPS.length - 1 ? <Check className="size-4" aria-hidden /> : null}
              {s === STEPS.length - 1 ? "Tamamla" : "Sonraki adım"}
              {!saving && s < STEPS.length - 1 && <ArrowRight className="size-4" aria-hidden />}
            </button>
          </footer>
        </div>
      )}
    </dialog>
  );
}
