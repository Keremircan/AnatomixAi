"use client";

import { useState } from "react";
import { Activity, CircleCheck, ClipboardPlus, Droplet, HeartPulse, History, LoaderCircle, Pencil, Sparkles, Trash2, type LucideIcon } from "lucide-react";
import { AuthError, deleteHealthData } from "@/lib/auth";
import { ageOf, bmiOf, HABIT_LABEL, hasAnyHealthData, type HealthData } from "@/lib/health";
import { useAnatomyStore } from "@/store/useAnatomyStore";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });

const Empty = () => <span className="text-muted">Belirtilmedi</span>;

function Field({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={cn("rounded-xl bg-surface-2/60 px-3 py-2.5", wide && "col-span-2")}>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}

function Tags({ items, tone = "accent" }: { items: string[]; tone?: "accent" | "warning" }) {
  if (!items.length) return <Empty />;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {items.map((t) => (
        <span key={t} className={cn("rounded-md px-2 py-0.5 text-[12px] font-medium", tone === "warning" ? "bg-warning/12 text-warning" : "bg-accent/12 text-accent")}>
          {t}
        </span>
      ))}
    </div>
  );
}

function MedCard({ title, icon: Icon, step, children }: { title: string; icon: LucideIcon; step: number; children: React.ReactNode }) {
  const open = useAnatomyStore((s) => s.openHealthWizard);
  return (
    <section className="glass flex flex-col rounded-card p-5" aria-label={title}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">
          <Icon className="size-4 text-accent" aria-hidden />
          {title}
        </h3>
        <button
          type="button"
          onClick={() => open(step)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-accent transition hover:bg-accent/10"
          aria-label={`${title} bölümünü düzenle`}
        >
          <Pencil className="size-3.5" aria-hidden />
          Düzenle
        </button>
      </div>
      <dl className="mt-3 grid flex-1 grid-cols-2 content-start gap-2">{children}</dl>
    </section>
  );
}

/** Profil sayfası: kişiselleştirilmiş sağlık profili kartları ya da formu başlatma çağrısı. */
export function HealthCards({ health, loading }: { health: HealthData | null | undefined; loading: boolean }) {
  const open = useAnatomyStore((s) => s.openHealthWizard);
  const setHealth = useAnatomyStore((s) => s.setHealth);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return <div className="glass h-40 animate-pulse rounded-card" aria-busy="true" aria-label="Sağlık profili yükleniyor" />;
  }

  if (!hasAnyHealthData(health)) {
    return (
      <section className="glass relative overflow-hidden rounded-card border-dashed p-5 sm:p-6" aria-label="Sağlık profili">
        <div aria-hidden className="absolute -right-16 -bottom-16 size-56 rounded-full bg-accent/10 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent/12 text-accent">
            <HeartPulse className="size-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold tracking-tight">Kişiselleştirilmiş sağlık profili</h2>
            <p className="mt-1 text-sm text-muted">
              Kan grubu, kronik hastalıklar, ilaçlar ve alerjileriniz triyaj önerilerini size göre ayarlar. Yaklaşık 2 dakika sürer; tamamen isteğe bağlıdır.
            </p>
          </div>
          <button
            type="button"
            onClick={() => open(0)}
            className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-[0_8px_24px_-12px_var(--accent)] transition hover:bg-accent-strong"
          >
            <ClipboardPlus className="size-4" aria-hidden />
            Kişiselleştirme formunu doldur
          </button>
        </div>
      </section>
    );
  }

  const h = health!;
  const age = ageOf(h.birthDate);
  const bmi = bmiOf(h);

  async function remove() {
    setDeleting(true);
    setError(null);
    try {
      await deleteHealthData();
      setHealth(null, true);
      setConfirming(false);
    } catch (e) {
      setError(e instanceof AuthError ? e.message : "Silinemedi.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="grid gap-3" aria-label="Sağlık profili">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
          <HeartPulse className="size-5 text-accent" aria-hidden />
          Sağlık profili
          {h.isCompleted ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/12 px-2 py-0.5 text-[11px] font-medium text-success">
              <CircleCheck className="size-3" aria-hidden />
              Tamamlandı
            </span>
          ) : (
            <button type="button" onClick={() => open(0)} className="inline-flex items-center gap-1 rounded-full bg-caution/12 px-2 py-0.5 text-[11px] font-medium text-caution hover:bg-caution/20">
              Eksik · tamamla
            </button>
          )}
        </h2>
        <span className="flex items-center gap-1.5 text-[11px] text-muted">
          <Sparkles className="size-3.5 text-accent" aria-hidden />
          Triyaj değerlendirmesine katılıyor
          {h.updatedAt && <span>· {dateFmt.format(new Date(h.updatedAt))}</span>}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <MedCard title="Biyometri" icon={Droplet} step={0}>
          <Field label="Kan grubu">{h.bloodType ? <span className="font-mono text-base text-danger">{h.bloodType}</span> : <Empty />}</Field>
          <Field label="Yaş">{age !== null ? `${age}` : <Empty />}</Field>
          <Field label="Boy">{h.heightCm ? `${h.heightCm} cm` : <Empty />}</Field>
          <Field label="Kilo">{h.weightKg ? `${h.weightKg.toLocaleString("tr-TR")} kg` : <Empty />}</Field>
          {bmi && (
            <Field label="Vücut kitle indeksi" wide>
              <span className="font-mono">{bmi.value.toLocaleString("tr-TR")}</span> <span className="text-muted">· {bmi.label}</span>
            </Field>
          )}
        </MedCard>

        <MedCard title="Vital ve kronik" icon={Activity} step={1}>
          <Field label="Tansiyon">{h.bloodPressureStatus ?? <Empty />}</Field>
          <Field label="Kan şekeri">{h.bloodSugarStatus ?? <Empty />}</Field>
          <Field label="Alerjiler" wide>
            <Tags items={h.allergies} tone="warning" />
          </Field>
          <Field label="Kronik hastalıklar" wide>
            <Tags items={h.chronicConditions} />
          </Field>
          <Field label="Düzenli ilaçlar" wide>
            <Tags items={h.regularMedications} />
          </Field>
        </MedCard>

        <MedCard title="Geçmiş ve alışkanlıklar" icon={History} step={2}>
          <Field label="Ameliyatlar" wide>
            <Tags items={h.surgicalHistory} />
          </Field>
          <Field label="Tıbbi cihaz / implant" wide>
            <Tags items={h.medicalDevices} />
          </Field>
          <Field label="Engel durumu" wide>
            {h.disabilityStatus ?? <Empty />}
          </Field>
          <Field label="Sigara">{h.lifestyle.smoking ? HABIT_LABEL[h.lifestyle.smoking] : <Empty />}</Field>
          <Field label="Alkol">{h.lifestyle.alcohol ? HABIT_LABEL[h.lifestyle.alcohol] : <Empty />}</Field>
        </MedCard>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 px-1 text-[12px]">
        {error && <span className="text-danger">{error}</span>}
        {confirming ? (
          <>
            <span className="text-muted">Sağlık profiliniz kalıcı olarak silinsin mi?</span>
            <button type="button" onClick={() => setConfirming(false)} disabled={deleting} className="rounded-lg px-2.5 py-1 text-muted hover:bg-surface-2">
              Vazgeç
            </button>
            <button type="button" onClick={() => void remove()} disabled={deleting} className="flex items-center gap-1.5 rounded-lg bg-danger px-2.5 py-1 font-medium text-white hover:brightness-110">
              {deleting && <LoaderCircle className="size-3 animate-spin" aria-hidden />}
              Evet, sil
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirming(true)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-muted transition hover:bg-danger/10 hover:text-danger">
            <Trash2 className="size-3.5" aria-hidden />
            Sağlık profilini sil
          </button>
        )}
      </div>
    </section>
  );
}
