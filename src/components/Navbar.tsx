"use client";

import { useRef } from "react";
import { Scale, Stethoscope, UserRound, X } from "lucide-react";
import { useAnatomyStore, type UserRole } from "@/store/useAnatomyStore";
import { cn } from "@/lib/utils";

const ROLES: { id: UserRole; label: string; short: string; Icon: typeof UserRound }[] = [
  { id: "patient", label: "Hasta", short: "Hasta", Icon: UserRound },
  { id: "clinician", label: "Sağlık Profesyoneli", short: "Uzman", Icon: Stethoscope },
];

export function Navbar() {
  const role = useAnatomyStore((s) => s.role);
  const setRole = useAnatomyStore((s) => s.setRole);
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <header className="glass sticky top-0 z-40 border-x-0 border-t-0">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6">
        <Logo />

        <div className="flex flex-1 justify-end sm:justify-center">
          <div
            role="radiogroup"
            aria-label="Kullanıcı rolü"
            className="inline-flex rounded-xl border border-line bg-surface-2/80 p-1"
          >
            {ROLES.map(({ id, label, short, Icon }) => {
              const active = role === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setRole(id)}
                  className={cn(
                    "flex h-8 items-center gap-2 rounded-lg px-3 text-[13px] font-medium whitespace-nowrap transition",
                    active
                      ? "bg-surface text-foreground shadow-sm ring-1 ring-accent/40"
                      : "text-muted hover:text-foreground",
                  )}
                >
                  <Icon className={cn("size-4", active ? "text-accent" : "text-muted")} aria-hidden />
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{short}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-caution/40 bg-caution/10 px-3 text-[13px] font-medium text-caution transition hover:bg-caution/15"
        >
          <Scale className="size-4" aria-hidden />
          <span className="hidden md:inline">Yasal Uyarı</span>
        </button>
      </div>

      <DisclaimerDialog ref={dialogRef} role={role} />
    </header>
  );
}

function Logo() {
  return (
    <div className="flex shrink-0 items-center gap-2.5">
      <span className="relative grid size-9 place-items-center rounded-[11px] border border-accent/30 bg-accent/10 text-accent">
        <svg viewBox="0 0 32 32" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <circle cx="16" cy="7" r="3.2" />
          <path d="M16 11v12M10 14.5l6 2 6-2M12 28l4-5 4 5" />
        </svg>
        <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-accent shadow-[0_0_10px_var(--accent)] ring-2 ring-background" />
      </span>
      <span className="hidden items-center gap-2 sm:flex">
        <span className="text-[15px] font-semibold tracking-tight">
          ANATOMIX<span className="text-accent">.AI</span>
        </span>
        <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted">
          BETA
        </span>
      </span>
    </div>
  );
}

function DisclaimerDialog({ ref, role }: { ref: React.Ref<HTMLDialogElement>; role: UserRole }) {
  const close = (e: React.SyntheticEvent) => (e.currentTarget.closest("dialog") as HTMLDialogElement).close();
  return (
    <dialog
      ref={ref}
      aria-labelledby="disclaimer-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      className="glass m-auto w-[min(92vw,32rem)] rounded-card p-0 text-foreground open:animate-rise"
    >
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-caution/10 text-caution">
              <Scale className="size-5" aria-hidden />
            </span>
            <div>
              <h2 id="disclaimer-title" className="text-lg font-semibold tracking-tight">
                Yasal Uyarı
              </h2>
              <p className="font-mono text-[11px] text-muted">Feragatname v1.2</p>
            </div>
          </div>
          <button type="button" onClick={close} aria-label="Kapat" className="rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-foreground">
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="mt-5 space-y-3 text-sm leading-relaxed">
          <p className="font-medium">
            Bu platform bir tıbbi teşhis aracı değildir ve hekim muayenesinin yerini tutmaz.
          </p>
          {role === "patient" ? (
            <p className="text-muted">
              ANATOMIX.AI yalnızca şikayetinizin aciliyet seviyesi ve hangi sağlık birimine başvurabileceğiniz hakkında
              bilgi verir. Tanı koymaz, tedavi veya ilaç önermez.
            </p>
          ) : (
            <p className="text-muted">
              Sağlık Profesyoneli Portalı bir eğitim ve görselleştirme aracıdır; klinik karar desteği sağlamaz. Hasta
              verisine yalnızca hastanın verdiği süreli paylaşım izni kapsamında erişilir.
            </p>
          )}
          <p className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2.5 text-danger">
            Acil bir durumda beklemeyin, <b className="font-semibold">112</b>’yi arayın.
          </p>
        </div>

        <button
          type="button"
          onClick={close}
          className="mt-6 h-10 w-full rounded-xl bg-accent text-sm font-medium text-accent-foreground transition hover:bg-accent-strong"
        >
          Anladım
        </button>
      </div>
    </dialog>
  );
}
