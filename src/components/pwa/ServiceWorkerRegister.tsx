"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
// Yükleme olayını (beforeinstallprompt) sayfa açılır açılmaz yakalamak için modül burada yüklenir.
import "@/lib/pwaInstall";

const THEME_COLOR = { dark: "#060b12", light: "#f3f6f9" } as const;

/**
 * PWA çalışma zamanı:
 * - Service worker kaydı (yalnızca production derlemesinde; geliştirmede önbellek sıcak yenilemeyle çakışır).
 * - Durum çubuğu / adres çubuğu rengi uygulamanın seçili temasını izler (işletim sistemi temasını değil).
 */
export function ServiceWorkerRegister() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () => void navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  useEffect(() => {
    if (!resolvedTheme) return;
    const color = THEME_COLOR[resolvedTheme === "light" ? "light" : "dark"];
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
      m.content = color;
    });
  }, [resolvedTheme]);

  return null;
}
