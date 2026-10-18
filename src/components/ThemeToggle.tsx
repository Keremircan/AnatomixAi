"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/** Koyu / açık tema düğmesi. Tema sunucuda bilinmediği için ikon yalnızca istemcide yerleşince gösterilir. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const dark = !mounted || resolvedTheme !== "light";
  const label = dark ? "Açık temaya geç" : "Koyu temaya geç";

  return (
    <button
      type="button"
      onClick={() => setTheme(dark ? "light" : "dark")}
      aria-label={label}
      title={label}
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-line text-muted transition hover:bg-surface-2 hover:text-foreground",
        className,
      )}
    >
      {/* İki ikon üst üste; aktif olan döner ve belirir, diğeri küçülerek kaybolur. */}
      <Sun
        className={cn("absolute size-[18px] transition-all duration-300", mounted && !dark ? "scale-100 rotate-0 opacity-100" : "scale-50 -rotate-90 opacity-0")}
        aria-hidden
      />
      <Moon
        className={cn("absolute size-[18px] transition-all duration-300", mounted && dark ? "scale-100 rotate-0 opacity-100" : "scale-50 rotate-90 opacity-0")}
        aria-hidden
      />
    </button>
  );
}
