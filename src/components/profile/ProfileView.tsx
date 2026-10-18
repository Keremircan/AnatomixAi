"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, BadgeCheck, BriefcaseMedical, Building, CalendarDays, CircleAlert, CircleCheck, Clock, IdCard, LoaderCircle, LogOut, Mail, ShieldCheck,
  Stethoscope, UserRound, type LucideIcon,
} from "lucide-react";
import { AuthError, DISCLAIMER_VERSION, fetchProfileDetails, KVKK_VERSION, PROFESSIONS, type ConsentKind, type ProfileDetails } from "@/lib/auth";
import { useSignOut } from "@/hooks/useSignOut";
import { cn } from "@/lib/utils";

const dateFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });

const CONSENTS: { kind: ConsentKind; label: string; currentVersion?: string }[] = [
  { kind: "medical_disclaimer", label: "Tıbbi sorumluluk reddi (Disclaimer)", currentVersion: DISCLAIMER_VERSION },
  { kind: "health_data_processing", label: "KVKK · sağlık verisi açık rızası", currentVersion: KVKK_VERSION },
  { kind: "adult_declaration", label: "18 yaş beyanı" },
];

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; profile: ProfileDetails };

function initials(p: ProfileDetails) {
  return (p.fullName || p.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toLocaleUpperCase("tr-TR"))
    .join("");
}

/* ───────────────────────── Parçalar ───────────────────────── */

function Card({ title, icon: Icon, children, className }: { title: string; icon: LucideIcon; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("glass rounded-card p-5 sm:p-6", className)} aria-label={title}>
      <h2 className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] text-muted uppercase">
        <Icon className="size-3.5 text-accent" aria-hidden />
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Row({ label, value, icon: Icon }: { label: string; value?: string; icon: LucideIcon }) {
  return (
    <div className="flex items-start gap-3 border-b border-line/60 py-3 first:pt-0 last:border-b-0 last:pb-0">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-2 text-muted">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted">{label}</dt>
        <dd className={cn("mt-0.5 text-sm font-medium break-words", !value && "font-normal text-muted italic")}>{value || "Belirtilmedi"}</dd>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="grid gap-4" aria-busy="true" aria-label="Profil yükleniyor">
      <div className="glass flex items-center gap-5 rounded-card p-6">
        <span className="size-20 shrink-0 animate-pulse rounded-2xl bg-surface-2" />
        <div className="grid min-w-0 flex-1 gap-2">
          <span className="h-6 w-56 max-w-full animate-pulse rounded-lg bg-surface-2" />
          <span className="h-4 w-72 max-w-full animate-pulse rounded-lg bg-surface-2" />
          <span className="h-6 w-40 max-w-full animate-pulse rounded-full bg-surface-2" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="glass h-56 animate-pulse rounded-card" />
        <div className="glass h-56 animate-pulse rounded-card" />
      </div>
    </div>
  );
}

/* ───────────────────────── Sayfa ───────────────────────── */

export function ProfileView() {
  const router = useRouter();
  const { signOut, leaving } = useSignOut();
  const [state, setState] = useState<State>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  // Next.js gizlenen sayfaların durumunu korur; başka bir hesapla giriş yapıldığında eski profil
  // bir an bile görünmesin diye sayfa gizlenirken veriler temizlenir.
  useLayoutEffect(() => () => setState({ status: "loading" }), []);

  useEffect(() => {
    let cancelled = false;
    fetchProfileDetails()
      .then((profile) => {
        if (cancelled) return;
        if (!profile) router.replace("/login?next=/profile");
        else setState({ status: "ready", profile });
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ status: "error", message: e instanceof AuthError ? e.message : "Profil bilgileri yüklenemedi." });
      });
    return () => {
      cancelled = true;
    };
  }, [router, reloadKey]);

  return (
    <main className="flex-1 p-3 sm:p-6">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-[minmax(0,1fr)] gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg text-sm text-muted transition hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden />
            3B çalışma alanına dön
          </Link>
          <span className="font-mono text-[11px] tracking-wider text-muted uppercase">Profil</span>
        </div>

        {state.status === "loading" && <Skeleton />}

        {state.status === "error" && (
          <div role="alert" className="glass flex flex-wrap items-center gap-3 rounded-card border-danger/40 p-5 text-sm">
            <CircleAlert className="size-5 text-danger" aria-hidden />
            <span className="flex-1">{state.message}</span>
            <button
              type="button"
              onClick={() => {
                setState({ status: "loading" });
                setReloadKey((k) => k + 1);
              }}
              className="rounded-xl border border-line px-3 py-1.5 text-sm hover:bg-surface-2"
            >
              Tekrar dene
            </button>
          </div>
        )}

        {state.status === "ready" && <ProfileContent profile={state.profile} onSignOut={signOut} leaving={leaving} />}
      </div>
    </main>
  );
}

function ProfileContent({ profile: p, onSignOut, leaving }: { profile: ProfileDetails; onSignOut: () => void; leaving: boolean }) {
  const clinician = p.role === "clinician";
  const profession = PROFESSIONS.find((x) => x.id === p.profession);
  const verified = p.verificationStatus === "verified";
  const rejected = p.verificationStatus === "rejected";
  const consentByKind = new Map(p.consents.map((c) => [c.kind, c]));

  return (
    <>
      {/* Kullanıcı kartı */}
      <section className="glass relative overflow-hidden rounded-card p-5 sm:p-7 animate-rise" aria-label="Kullanıcı bilgileri">
        <div aria-hidden className={cn("absolute -top-24 -right-24 size-72 rounded-full opacity-20 blur-3xl", clinician ? "bg-teal" : "bg-accent")} />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <span
            className={cn(
              "grid size-20 shrink-0 place-items-center rounded-2xl border text-2xl font-semibold tracking-tight",
              clinician ? "border-teal/40 bg-teal/12 text-teal" : "border-accent/40 bg-accent/12 text-accent",
            )}
            aria-hidden
          >
            {initials(p)}
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">
              {clinician && profession && profession.id !== "nurse" ? `${profession.title} ` : ""}
              {p.fullName || p.email.split("@")[0]}
            </h1>
            <p className="mt-1 flex items-center gap-2 truncate text-sm text-muted">
              <Mail className="size-4 shrink-0" aria-hidden />
              {p.email}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {clinician ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-teal/40 bg-teal/10 px-2.5 py-1 text-xs font-medium text-teal">
                  <Stethoscope className="size-3.5" aria-hidden />
                  Sağlık Profesyoneli
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-medium text-accent">
                  <UserRound className="size-3.5" aria-hidden />
                  Hasta Hesabı
                </span>
              )}
              {clinician &&
                (verified ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-success/40 bg-success/10 px-2.5 py-1 text-xs font-medium text-success">
                    <BadgeCheck className="size-3.5" aria-hidden />
                    Doğrulanmış Uzman
                  </span>
                ) : rejected ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-danger/40 bg-danger/10 px-2.5 py-1 text-xs font-medium text-danger">
                    <CircleAlert className="size-3.5" aria-hidden />
                    Doğrulama Reddedildi
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-caution/40 bg-caution/10 px-2.5 py-1 text-xs font-medium text-caution">
                    <Clock className="size-3.5" aria-hidden />
                    Onay Bekliyor
                  </span>
                ))}
              <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                <CalendarDays className="size-3.5" aria-hidden />
                {dateFmt.format(new Date(p.createdAt))} tarihinden beri üye
              </span>
            </div>
          </div>
        </div>
        {clinician && !verified && (
          <p className={cn("relative mt-5 rounded-xl border px-3.5 py-2.5 text-[13px] leading-snug", rejected ? "border-danger/35 bg-danger/8" : "border-caution/35 bg-caution/8")}>
            {rejected
              ? "Mesleki belge doğrulamanız onaylanmadı. Ayrıntılar için destek ekibiyle iletişime geçin."
              : "Mesleki belgeniz yönetici tarafından incelendikten sonra hesabınız “Doğrulanmış Uzman” olarak işaretlenir. Bu süreçte hasta verisi paylaşımı gibi uzman özellikleri kapalı kalır."}
          </p>
        )}
      </section>

      <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-4", clinician && "md:grid-cols-2")}>
        {clinician && (
          <Card title="Klinik / mesleki bilgiler" icon={BriefcaseMedical}>
            <dl>
              <Row label="Meslek" value={profession?.label} icon={IdCard} />
              <Row label="Uzmanlık alanı / Branş" value={p.specialty} icon={Stethoscope} />
              <Row label="Çalıştığı kurum / Hastane" value={p.institution} icon={Building} />
            </dl>
          </Card>
        )}

        <Card title="Güvenlik ve yasal onaylar" icon={ShieldCheck}>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-2/50 px-3.5 py-3">
            <span className="text-sm">Hesap durumu</span>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-success">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-success" />
              </span>
              {p.isActive ? "Aktif" : "Pasif"}
            </span>
          </div>

          <ul className="mt-3 grid gap-2">
            {CONSENTS.map(({ kind, label, currentVersion }) => {
              const c = consentByKind.get(kind);
              const outdated = c && currentVersion && c.version !== currentVersion;
              return (
                <li key={kind} className="flex items-start gap-3 rounded-xl px-1 py-2">
                  {c && !outdated ? (
                    <CircleCheck className="mt-0.5 size-5 shrink-0 text-success" aria-label="Onaylandı" />
                  ) : (
                    <CircleAlert className="mt-0.5 size-5 shrink-0 text-caution" aria-label="Onay gerekli" />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {c ? (
                        <>
                          {dateTimeFmt.format(new Date(c.acceptedAt))} tarihinde onaylandı
                          {kind !== "adult_declaration" && <span className="font-mono"> · sürüm {c.version}</span>}
                          {outdated && <span className="text-caution"> · güncel sürüm {currentVersion} için yeniden onay gerekli</span>}
                        </>
                      ) : (
                        <span className="text-caution">Onay kaydı bulunamadı.</span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <Link
          href="/"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground shadow-[0_8px_24px_-12px_var(--accent)] transition hover:bg-accent-strong"
        >
          <ArrowLeft className="size-4" aria-hidden />
          3B çalışma alanına dön
        </Link>
        <button
          type="button"
          onClick={onSignOut}
          disabled={leaving}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
        >
          {leaving ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
          Çıkış Yap
        </button>
      </div>
    </>
  );
}
