"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Tema tercihi (koyu / açık). next-themes, <html> etiketine "dark" veya "light" sınıfını
 * sayfa boyanmadan önce ekler ve tercihi localStorage'da ("anatomix-theme") saklar.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false} storageKey="anatomix-theme" disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
