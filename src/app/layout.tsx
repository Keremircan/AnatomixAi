import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/Navbar";
import { AuthListener } from "@/components/AuthListener";
import { HealthOnboardingModal } from "@/components/HealthOnboardingModal";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ROLE_HINT_KEY } from "@/lib/auth";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "ANATOMIX.AI",
  description: "3B anatomi üzerinde klinik ön triyaj ve poliklinik yönlendirme platformu.",
};

/** Boyamadan önce son oturumun rol ipucunu <html data-anx-role> olarak yazar (Navbar iskeleti doğru genişlikte çizilir). */
const roleHintScript = `try{var r=localStorage.getItem(${JSON.stringify(ROLE_HINT_KEY)});if(r)document.documentElement.dataset.anxRole=r}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="tr" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <script dangerouslySetInnerHTML={{ __html: roleHintScript }} />
        <ThemeProvider>
          <div className="app-backdrop" aria-hidden />
          <AuthListener />
          <Navbar />
          {children}
          <HealthOnboardingModal />
        </ThemeProvider>
      </body>
    </html>
  );
}
