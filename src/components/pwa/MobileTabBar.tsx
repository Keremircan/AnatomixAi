"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, MessageSquareText, PersonStanding, UserRound, type LucideIcon } from "lucide-react";
import { useAnatomyStore } from "@/store/useAnatomyStore";
import { cn } from "@/lib/utils";

/** Ana sayfadaki şikayet paneli (TriageFlow'u saran <aside id="sikayet">). */
export const COMPLAINT_ANCHOR = "sikayet";

type Tab = { id: "anatomy" | "complaint" | "result" | "profile"; label: string; href: string; Icon: LucideIcon };
const TABS: Tab[] = [
  { id: "anatomy", label: "Anatomi", href: "/", Icon: PersonStanding },
  { id: "complaint", label: "Şikayet", href: `/#${COMPLAINT_ANCHOR}`, Icon: MessageSquareText },
  { id: "result", label: "Sonuç", href: "/triyaj", Icon: ClipboardList },
  { id: "profile", label: "Profil", href: "/profile", Icon: UserRound },
];

/** Ana sayfada şikayet panelinin üst kenarı ekranın üst yarısına geldiyse "Şikayet" sekmesi etkindir. */
function useComplaintInView(enabled: boolean) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = enabled ? document.getElementById(COMPLAINT_ANCHOR) : null;
    if (!el) return;
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setInView(el.getBoundingClientRect().top < window.innerHeight * 0.5));
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [enabled]);
  return enabled && inView;
}

/**
 * Telefon görünümü: uygulama benzeri alt sekme çubuğu (md altında, oturum açıkken). Çentikli / ev göstergeli
 * ekranlarda alttaki güvenli alan kadar boşluk bırakır. Ana sayfada sekmeler ilgili bölüme kaydırır.
 */
export function MobileTabBar() {
  const pathname = usePathname();
  const isAuthenticated = useAnatomyStore((s) => s.isAuthenticated);
  const hasResult = useAnatomyStore((s) => !!s.analysisResult);
  const onHome = pathname === "/";
  const complaintInView = useComplaintInView(onHome && isAuthenticated);

  if (!isAuthenticated || pathname === "/login") return null;

  const active: Tab["id"] = pathname === "/triyaj" ? "result" : pathname === "/profile" ? "profile" : complaintInView ? "complaint" : "anatomy";
  const reduce = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  return (
    <nav aria-label="Uygulama gezintisi" className="mobile-tabbar glass fixed inset-x-0 bottom-0 z-40 border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] select-none md:hidden print:hidden">
      <ul className="mx-auto grid h-16 max-w-md grid-cols-4">
        {TABS.map(({ id, label, href, Icon }) => {
          const on = active === id;
          return (
            <li key={id}>
              <Link
                href={href}
                aria-current={on ? "page" : undefined}
                onClick={(e) => {
                  // Ana sayfadayken yeniden yükleme yerine ilgili bölüme yumuşakça kaydır.
                  if (!onHome || (id !== "anatomy" && id !== "complaint")) return;
                  e.preventDefault();
                  const behavior = reduce() ? "auto" : "smooth";
                  if (id === "anatomy") window.scrollTo({ top: 0, behavior });
                  else document.getElementById(COMPLAINT_ANCHOR)?.scrollIntoView({ behavior, block: "start" });
                }}
                className="flex h-full flex-col items-center justify-center gap-1 text-[10px] font-medium [-webkit-tap-highlight-color:transparent]"
              >
                <span className={cn("relative grid h-7 w-14 place-items-center rounded-full transition-colors duration-200", on ? "bg-accent/15 text-accent" : "text-muted")}>
                  <Icon className="size-5" strokeWidth={on ? 2.2 : 1.8} aria-hidden />
                  {id === "result" && hasResult && <span className="absolute top-0.5 right-3 size-2 rounded-full bg-pain ring-2 ring-surface" aria-label="Yeni sonuç" />}
                </span>
                <span className={on ? "text-foreground" : "text-muted"}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
