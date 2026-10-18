"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building, Check, Eye, EyeOff, LoaderCircle, Lock, Mail, ShieldCheck, Stethoscope, User, UserRound, type LucideIcon } from "lucide-react";
import { AnatomyBackdrop } from "./AnatomyBackdrop";
import { AuthError, PROFESSIONS, signIn, signUp, SPECIALTIES, type Profession, type UserRole } from "@/lib/auth";
import { useAnatomyStore } from "@/store/useAnatomyStore";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

const ROLES: { id: UserRole; label: string; desc: string; Icon: LucideIcon }[] = [
  { id: "patient", label: "Hasta Portalı", desc: "Şikayet analizi, poliklinik yönlendirmesi ve 3B semptom takibi", Icon: UserRound },
  { id: "clinician", label: "Sağlık Profesyoneli", desc: "ICD-10 notları, anatomi eğitimi, 3B vaka işaretleme ve egzersiz planı", Icon: Stethoscope },
];

const DISCLAIMER = "AnatomixAI’ın bir kesin teşhis aracı olmadığını, yalnızca bilgilendirme ve ön triyaj amaçlı olduğunu kabul ediyorum.";

/* ───────────────────────── Form parçaları ───────────────────────── */

function Field({ id, label, icon: Icon, hint, children }: { id: string; label: string; icon?: LucideIcon; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium">
        {label}
        {hint && <span className="ml-1.5 font-normal text-muted">{hint}</span>}
      </label>
      <div className="relative">
        {Icon && <Icon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />}
        {children}
      </div>
    </div>
  );
}

const inputCls =
  "h-11 w-full rounded-xl border border-line bg-surface-2/70 pr-3 pl-10 text-sm placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15 focus:outline-none";

function Consent({ id, checked, onChange, children, emphasis = false }: { id: string; checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; emphasis?: boolean }) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl text-[13px] leading-snug transition",
        emphasis && "border p-3",
        emphasis && (checked ? "border-line" : "border-caution/45 bg-caution/6"),
      )}
    >
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        className={cn(
          "mt-px grid size-[18px] shrink-0 place-items-center rounded-[5px] border transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent",
          checked ? "border-accent bg-accent text-accent-foreground" : "border-line bg-surface-2",
        )}
      >
        {checked && <Check className="size-3" strokeWidth={3.5} aria-hidden />}
      </span>
      <span className={checked ? "text-foreground" : "text-muted"}>{children}</span>
    </label>
  );
}

function passwordStrength(pw: string) {
  return Math.min(4, Number(pw.length >= 8) + Number(/[A-ZÇĞİÖŞÜ]/.test(pw)) + Number(/\d/.test(pw)) + Number(/[^\wçğıöşü]/i.test(pw)));
}

/* ───────────────────────── Ekran ───────────────────────── */

export function AuthScreen() {
  const router = useRouter();
  const login = useAnatomyStore((s) => s.login);
  const isAuthenticated = useAnatomyStore((s) => s.isAuthenticated);
  const uid = useId();

  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<UserRole>("patient");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [profession, setProfession] = useState<Profession>("physician");
  const [specialty, setSpecialty] = useState(SPECIALTIES.physician[0]);
  const [institution, setInstitution] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [adult, setAdult] = useState(false);
  const [kvkk, setKvkk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Next.js gizlenen sayfaların durumunu korur (Activity). Giriş formu ise her açılışta boş gelmeli:
  // şifre ve onaylar gizli DOM'da kalmasın diye sayfa gizlenirken form sıfırlanır.
  useLayoutEffect(() => {
    return () => {
      setMode("login");
      setRole("patient");
      setFullName("");
      setEmail("");
      setPassword("");
      setShowPw(false);
      setProfession("physician");
      setSpecialty(SPECIALTIES.physician[0]);
      setInstitution("");
      setAccepted(false);
      setAdult(false);
      setKvkk(false);
      setSubmitting(false);
      setError(null);
    };
  }, []);

  /** Girişten sonra korunan sayfaya (?next=) ya da ana sayfaya dön; proxy yeni çerezleri görsün diye yenilenir. */
  const goNext = useCallback(() => {
    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
    router.refresh();
  }, [router]);

  // Oturum zaten açıksa (ör. başka sekmede giriş yapıldıysa) çalışma alanına dön.
  useEffect(() => {
    if (isAuthenticated && !submitting) goNext();
  }, [isAuthenticated, submitting, goNext]);

  const register = mode === "register";
  const strength = passwordStrength(password);
  const canSubmit = accepted && !submitting && (!register || (adult && kvkk && fullName.trim().length > 1));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      if (register) {
        // Sunucu hesabı oluşturur ve oturum çerezini yazar.
        login(
          await signUp({
            email,
            password,
            role,
            fullName: fullName.trim(),
            ...(role === "clinician" ? { profession, specialty, institution: institution.trim() || undefined } : {}),
            consents: { medicalDisclaimer: accepted, healthData: kvkk, adult },
          }),
        );
      } else {
        login(await signIn({ email, password, role }));
      }
      goNext();
    } catch (err) {
      setError(err instanceof AuthError ? err.message : "Bir sorun oluştu. Lütfen tekrar deneyin.");
      setSubmitting(false);
    }
  }

  return (
    <main className="grid flex-1 place-items-center p-3 sm:p-6">
      <div className="grid w-full max-w-6xl gap-4 lg:grid-cols-[1.05fr_1fr]">
        {/* Sol: marka ve silüet */}
        <section className="glass relative hidden overflow-hidden rounded-card p-10 lg:flex lg:flex-col">
          <div
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: "radial-gradient(color-mix(in oklab, var(--muted) 30%, transparent) 1px, transparent 1px)",
              backgroundSize: "18px 18px",
              maskImage: "radial-gradient(ellipse at 50% 55%, #000 30%, transparent 75%)",
            }}
          />
          <div aria-hidden className="absolute top-1/2 left-1/2 size-[420px] -translate-1/2 rounded-full bg-accent/10 blur-3xl" />
          <div className="relative max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full border border-accent/35 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <ShieldCheck className="size-3.5" aria-hidden />
              Klinik ön triyaj · poliklinik yönlendirme
            </span>
            <h1 className="mt-5 text-4xl leading-[1.08] font-semibold tracking-[-0.03em]">Şikayetinizi gösterin. Nereye başvuracağınızı öğrenin.</h1>
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              Semptomunuzu yazın ya da 3B model üzerinde işaretleyin. ANATOMIX.AI aciliyet seviyesini ve ilgili polikliniği önerir; tanı koymaz.
            </p>
          </div>
          <div className="relative mt-6 min-h-[300px] flex-1">
            <AnatomyBackdrop />
            <div className="glass absolute top-8 left-0 rounded-xl px-3.5 py-2.5 text-xs shadow-elev animate-rise">
              <div className="text-muted">Triyaj</div>
              <div className="mt-0.5 flex items-center gap-2 font-medium">
                <span className="size-2 rounded-full bg-accent" />
                T3 · Rutin poliklinik
              </div>
            </div>
            <div className="glass absolute top-32 right-0 rounded-xl px-3.5 py-2.5 text-xs shadow-elev animate-rise">
              <div className="text-muted">Önerilen branş</div>
              <div className="mt-0.5 font-medium">Ortopedi ve Travmatoloji</div>
            </div>
            <div className="glass absolute bottom-4 left-6 rounded-xl px-3.5 py-2.5 text-xs shadow-elev animate-rise">
              <div className="text-muted">Kırmızı bayrak kontrolü</div>
              <div className="mt-0.5 flex items-center gap-1.5 font-medium">
                <ShieldCheck className="size-3.5 text-success" aria-hidden />
                Yapay zekadan önce ve sonra
              </div>
            </div>
          </div>
          <dl className="relative mt-6 grid grid-cols-3 gap-4 border-t border-line pt-5 text-sm">
            <div>
              <dt className="text-xs text-muted">Triyaj seviyesi</dt>
              <dd className="mt-1 font-semibold">4 seviye</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Anatomik sistem</dt>
              <dd className="mt-1 font-semibold">12 katman</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Veri bölgesi</dt>
              <dd className="mt-1 font-semibold">AB · KVKK</dd>
            </div>
          </dl>
        </section>

        {/* Sağ: form */}
        <section className="glass rounded-card p-5 sm:p-8" aria-labelledby={`${uid}-title`}>
          <div role="radiogroup" aria-label="Portal" className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-surface-2/60 p-1">
            {ROLES.map(({ id, label, desc, Icon }) => {
              const on = role === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setRole(id)}
                  className={cn("rounded-xl px-3 py-3 text-left transition", on ? "bg-surface shadow-sm ring-1 ring-accent/45" : "hover:bg-surface/50")}
                >
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Icon className={cn("size-4", on ? "text-accent" : "text-muted")} aria-hidden />
                    {label}
                  </span>
                  <span className="mt-1 block text-[11px] leading-snug text-muted">{desc}</span>
                </button>
              );
            })}
          </div>

          <div role="tablist" aria-label="Oturum" className="relative mt-6 grid grid-cols-2 border-b border-line">
            {(["login", "register"] as const).map((m) => (
              <button
                key={m}
                id={`${uid}-tab-${m}`}
                type="button"
                role="tab"
                aria-selected={mode === m}
                aria-controls={`${uid}-panel`}
                onClick={() => {
                  setMode(m);
                  setError(null);
                }}
                className={cn("h-10 text-sm font-medium transition", mode === m ? "text-foreground" : "text-muted hover:text-foreground")}
              >
                {m === "login" ? "Giriş Yap" : "Hesap Oluştur"}
              </button>
            ))}
            <span
              aria-hidden
              className="absolute -bottom-px left-0 h-0.5 w-1/2 rounded-full bg-accent transition-transform duration-300"
              style={{ transform: register ? "translateX(100%)" : "none" }}
            />
          </div>

          <form
            id={`${uid}-panel`}
            role="tabpanel"
            aria-labelledby={`${uid}-tab-${mode}`}
            onSubmit={onSubmit}
            noValidate
            className="mt-5 grid gap-4"
          >
            <h2 id={`${uid}-title`} className="sr-only">
              {register ? "Hesap oluştur" : "Giriş yap"}
            </h2>

            {register && (
              <Field id={`${uid}-name`} label="Ad Soyad" icon={User}>
                <input id={`${uid}-name`} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required className={inputCls} placeholder="Ayşe Yılmaz" />
              </Field>
            )}

            <Field id={`${uid}-email`} label="E-posta" icon={Mail}>
              <input
                id={`${uid}-email`}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className={inputCls}
                placeholder="ornek@eposta.com"
              />
            </Field>

            <div className="grid gap-1.5">
              <Field id={`${uid}-pw`} label="Şifre" icon={Lock}>
                <input
                  id={`${uid}-pw`}
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={register ? "new-password" : "current-password"}
                  required
                  minLength={8}
                  className={cn(inputCls, "pr-11")}
                  placeholder="En az 8 karakter"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? "Şifreyi gizle" : "Şifreyi göster"}
                  className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-muted hover:text-foreground"
                >
                  {showPw ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              </Field>
              {register && (
                <div className="flex items-center gap-2" aria-live="polite">
                  <div className="grid flex-1 grid-cols-4 gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className={cn("h-1 rounded-full", i < strength ? (strength < 2 ? "bg-warning" : strength < 4 ? "bg-caution" : "bg-success") : "bg-line")} />
                    ))}
                  </div>
                  <span className="w-12 text-right text-[11px] text-muted">{["Zayıf", "Zayıf", "Orta", "İyi", "Güçlü"][strength]}</span>
                </div>
              )}
            </div>

            {register && role === "clinician" && (
              <div className="grid gap-3 rounded-xl border border-dashed border-accent/40 bg-accent/5 p-4 animate-rise">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <label htmlFor={`${uid}-prof`} className="text-[13px] font-medium">
                      Meslek
                    </label>
                    <select
                      id={`${uid}-prof`}
                      value={profession}
                      onChange={(e) => {
                        const p = e.target.value as Profession;
                        setProfession(p);
                        setSpecialty(SPECIALTIES[p][0]);
                      }}
                      className="h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm focus:border-accent focus:outline-none"
                    >
                      {PROFESSIONS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <label htmlFor={`${uid}-spec`} className="text-[13px] font-medium">
                      Uzmanlık alanı / Branş
                    </label>
                    <select
                      id={`${uid}-spec`}
                      value={specialty}
                      onChange={(e) => setSpecialty(e.target.value)}
                      className="h-11 rounded-xl border border-line bg-surface-2 px-3 text-sm focus:border-accent focus:outline-none"
                    >
                      {SPECIALTIES[profession].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <Field id={`${uid}-inst`} label="Kurum / Diploma No" hint="(opsiyonel)" icon={Building}>
                  <input id={`${uid}-inst`} value={institution} onChange={(e) => setInstitution(e.target.value)} className={inputCls} placeholder="Ör. Ankara Şehir Hastanesi veya diploma no" />
                </Field>
                <p className="text-[11px] leading-snug text-muted">
                  Hesabınız mesleki belgeniz yönetici tarafından doğrulanana kadar “doğrulama bekliyor” durumunda kalır.
                </p>
              </div>
            )}

            <div className="grid gap-2.5 pt-1">
              {register && (
                <>
                  <Consent id={`${uid}-adult`} checked={adult} onChange={setAdult}>
                    18 yaşından büyüğüm.
                  </Consent>
                  <Consent id={`${uid}-kvkk`} checked={kvkk} onChange={setKvkk}>
                    Sağlık verilerimin KVKK aydınlatma metnindeki koşullarla işlenmesine açık rıza veriyorum.
                  </Consent>
                </>
              )}
              <Consent id={`${uid}-disc`} checked={accepted} onChange={setAccepted} emphasis>
                {DISCLAIMER}
              </Consent>
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-foreground shadow-[0_10px_28px_-12px_var(--accent)] transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {submitting ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
              {submitting ? (register ? "Hesap oluşturuluyor…" : "Giriş yapılıyor…") : register ? "Kayıt Ol" : "Giriş Yap"}
              {!submitting && <ArrowRight className="size-4" aria-hidden />}
            </button>
            {!accepted && <p className="-mt-2 text-center text-[11px] text-muted">Devam etmek için sorumluluk reddini onaylayın.</p>}
          </form>

          <p className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-muted">
            <span className="flex items-center gap-1">
              <Lock className="size-3" aria-hidden />
              Şifreli oturum
            </span>
            <span>Veriler AB bölgesinde</span>
            <span>KVKK · GDPR</span>
          </p>
        </section>
      </div>
    </main>
  );
}
