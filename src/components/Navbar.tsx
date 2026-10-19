"use client";

import { useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSignOut } from "@/hooks/useSignOut";
import { ThemeToggle } from "@/components/ThemeToggle";
import { UserAvatar } from "@/components/UserAvatar";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Clock, LoaderCircle, LogIn, LogOut, Scale, Stethoscope, UserRound, X } from "lucide-react";
import { displayName, PROFESSIONS, type UserProfile } from "@/lib/auth";
import { useAnatomyStore, type UserRole } from "@/store/useAnatomyStore";
import { cn } from "@/lib/utils";

export function Navbar() {
  const role = useAnatomyStore((s) => s.role);
  const user = useAnatomyStore((s) => s.user);
  const isAuthenticated = useAnatomyStore((s) => s.isAuthenticated);
  const authReady = useAnatomyStore((s) => s.authReady);
  const pathname = usePathname();
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <header className="glass sticky top-0 z-40 h-16 border-x-0 border-t-0 print:hidden">
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Link href="/" aria-label="ANATOMIX.AI ana sayfa" className="rounded-xl">
          <BrandLogo beta textClassName="hidden sm:flex" />
        </Link>

        <div className="flex-1" />

        <button
          type="button"
          onClick={() => dialogRef.current?.showModal()}
          aria-label="Yasal uyarı"
          className="flex h-9 shrink-0 items-center gap-2 rounded-xl border border-caution/40 bg-caution/10 px-3 text-[13px] font-medium text-caution transition hover:bg-caution/15"
        >
          <Scale className="size-4" aria-hidden />
          <span className="hidden lg:inline">Yasal Uyarı</span>
        </button>

        <ThemeToggle />

        {/* Proxy, /login dışındaki her sayfayı oturum ister; bu yüzden oturum bilgisi gelene kadar giriş ekranı dışında
            gerçek menüyle aynı ölçülerdeki iskelet gösterilir, giriş ekranında ise hiçbir şey (F5'te düzen kaymaz). */}
        {!authReady ? (
          pathname !== "/login" && <UserMenuSkeleton />
        ) : isAuthenticated && user ? (
          <UserMenu user={user} />
        ) : (
          pathname !== "/login" && (
            <Link
              href="/login"
              className="flex h-9 shrink-0 items-center gap-2 rounded-xl bg-accent px-3 text-[13px] font-semibold text-accent-foreground shadow-[0_6px_20px_-8px_var(--accent)] transition hover:bg-accent-strong"
            >
              <LogIn className="size-4" aria-hidden />
              <span className="hidden sm:inline">Giriş Yap / Kayıt Ol</span>
            </Link>
          )
        )}
      </div>

      <DisclaimerDialog ref={dialogRef} role={role} />
    </header>
  );
}

const ROLE_BADGE: Record<UserRole, { label: string; Icon: typeof UserRound; cls: string }> = {
  patient: { label: "Hasta", Icon: UserRound, cls: "border-accent/35 bg-accent/10 text-accent" },
  clinician: { label: "Sağlık Profesyoneli", Icon: Stethoscope, cls: "border-teal/35 bg-teal/10 text-teal" },
};

/**
 * Rol rozeti. `ghost` iskelet sürümüdür: aynı metni saydam çizer, böylece genişliği gerçek rozetle birebir aynıdır.
 * Hangi iskeletin görüneceğini <html data-anx-role> belirler (layout'taki satır içi betik, boyamadan önce).
 */
function RoleBadge({ role, pending, rejected, ghost, title }: { role: UserRole; pending: boolean; rejected: boolean; ghost?: boolean; title?: string }) {
  const badge = ROLE_BADGE[role];
  return (
    <span
      data-role-hint={ghost ? (pending ? (rejected ? "clinician-rejected" : "clinician-pending") : role) : undefined}
      className={cn(
        "shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium",
        ghost ? "role-hint animate-pulse border-line bg-surface-2 text-transparent" : cn("hidden sm:flex", badge.cls),
      )}
      title={title}
    >
      <badge.Icon className="size-3.5" aria-hidden />
      {badge.label}
      {pending && (
        <span
          className={cn("ml-0.5 flex items-center gap-1 rounded-full px-1.5", !ghost && (rejected ? "bg-danger/15 text-danger" : "bg-caution/15 text-caution"))}
          title={ghost ? undefined : rejected ? "Mesleki belge doğrulaması reddedildi" : "Mesleki belge doğrulaması bekleniyor"}
        >
          <Clock className="size-3" aria-hidden />
          <span className="hidden xl:inline">{rejected ? "doğrulama reddedildi" : "doğrulama bekliyor"}</span>
        </span>
      )}
    </span>
  );
}

const menuCls = "flex shrink-0 items-center gap-2 border-l border-line pl-2 sm:gap-3 sm:pl-3";
const signOutCls = "flex h-9 items-center gap-1.5 rounded-xl border border-line px-2.5 text-[13px]";

/** Oturum bilgisi gelene kadar UserMenu ile aynı ölçülerde yer tutucu. */
function UserMenuSkeleton() {
  return (
    <div className={menuCls} aria-hidden>
      <span className="flex items-center gap-2.5 p-1 pr-2">
        <span className="size-9 animate-pulse rounded-full bg-surface-2" />
        <span className="hidden w-44 gap-1.5 md:grid">
          <span className="h-3 w-28 animate-pulse rounded bg-surface-2" />
          <span className="h-2.5 w-40 animate-pulse rounded bg-surface-2" />
        </span>
      </span>
      <RoleBadge ghost role="patient" pending={false} rejected={false} />
      <RoleBadge ghost role="clinician" pending={false} rejected={false} />
      <RoleBadge ghost role="clinician" pending rejected={false} />
      <RoleBadge ghost role="clinician" pending rejected />
      <span className={cn(signOutCls, "animate-pulse bg-surface-2 text-transparent")}>
        <LogOut className="size-4" aria-hidden />
        <span className="hidden xl:inline">Çıkış Yap</span>
      </span>
    </div>
  );
}

/** Oturum açık kullanıcının profil bilgisi, salt okunur rol rozeti ve çıkış düğmesi. */
function UserMenu({ user }: { user: UserProfile }) {
  const { signOut, leaving } = useSignOut();
  const pathname = usePathname();
  const onProfile = pathname === "/profile";
  const badge = ROLE_BADGE[user.role];
  const profession = PROFESSIONS.find((p) => p.id === user.profession)?.label;
  const pending = user.role === "clinician" && !user.verified;
  const rejected = user.verificationStatus === "rejected";

  return (
    <div className={menuCls}>
      {/* Avatar ve ad: profil sayfasına bağlantı */}
      <Link
        href="/profile"
        aria-current={onProfile ? "page" : undefined}
        title="Profilim"
        className={cn("flex min-w-0 items-center gap-2.5 rounded-xl p-1 pr-2 transition hover:bg-surface-2", onProfile && "bg-surface-2 ring-1 ring-accent/30")}
      >
        <UserAvatar user={user} size={36} className="rounded-full" textClassName="text-xs" />
        <span className="hidden w-44 min-w-0 leading-tight md:block">
          <span className="block truncate text-[13px] font-medium">{displayName(user)}</span>
          <span className="block truncate text-[11px] text-muted">{user.email}</span>
        </span>
        <span className="sr-only md:hidden">Profilim</span>
      </Link>
      <RoleBadge role={user.role} pending={pending} rejected={rejected} title={[badge.label, profession, user.specialty].filter(Boolean).join(" · ")} />
      <button
        type="button"
        onClick={signOut}
        disabled={leaving}
        aria-label="Çıkış yap"
        title="Çıkış yap"
        className={cn(signOutCls, "text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-60")}
      >
        {leaving ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
        <span className="hidden xl:inline">Çıkış Yap</span>
      </button>
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
