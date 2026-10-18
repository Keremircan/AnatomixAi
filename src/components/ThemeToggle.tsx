"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

/**
 * Koyu / açık tema düğmesi. Hangi ikonun görüneceğini JS değil CSS belirler: next-themes <html> etiketine
 * "dark" / "light" sınıfını sayfa boyanmadan ekler, böylece F5'te düğme boş ya da yanlış ikonla açılmaz.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "light" ? "dark" : "light")}
      aria-label="Temayı değiştir (koyu / açık)"
      title="Temayı değiştir"
      className={cn(
        "relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-line text-muted transition hover:bg-surface-2 hover:text-foreground",
        className,
      )}
    >
      {/* İki ikon üst üste; aktif olan döner ve belirir, diğeri küçülerek kaybolur. */}
      <Sun className="absolute size-[18px] scale-50 -rotate-90 opacity-0 transition-all duration-300 light:scale-100 light:rotate-0 light:opacity-100" aria-hidden />
      <Moon className="absolute size-[18px] scale-100 rotate-0 opacity-100 transition-all duration-300 light:scale-50 light:rotate-90 light:opacity-0" aria-hidden />
    </button>
  );
}
