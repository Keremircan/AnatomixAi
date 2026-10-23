"use client";

import { useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";
import { promptInstall, useInstallState } from "@/lib/pwaInstall";
import { BrandMark } from "@/components/brand/BrandLogo";

/**
 * Profil sayfası: "Uygulamayı yükle". Uygulama zaten yüklüyse veya tarayıcı desteklemiyorsa gösterilmez.
 * iOS'ta yükleme penceresi olmadığı için Safari'deki adımlar anlatılır.
 */
export function InstallAppCard() {
  const state = useInstallState();
  const [busy, setBusy] = useState(false);
  if (state === "installed" || state === "unavailable") return null;

  return (
    <section className="glass flex flex-col gap-4 rounded-card p-5 sm:flex-row sm:items-center" aria-label="Uygulamayı yükle">
      <BrandMark className="size-12 rounded-2xl" />
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-semibold tracking-tight">ANATOMIX.AI’ı telefonunuza yükleyin</h2>
        {state === "prompt" ? (
          <p className="mt-0.5 text-sm text-muted">Ana ekranınızdan tek dokunuşla, tarayıcı çubuğu olmadan tam ekran açılır.</p>
        ) : (
          <p className="mt-0.5 flex flex-wrap items-center gap-1 text-sm text-muted">
            Safari’de
            <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-foreground">
              <Share className="size-3.5" aria-hidden />
              Paylaş
            </span>
            →
            <span className="inline-flex items-center gap-1 rounded-md bg-surface-2 px-1.5 py-0.5 text-foreground">
              <SquarePlus className="size-3.5" aria-hidden />
              Ana Ekrana Ekle
            </span>
            adımlarını izleyin.
          </p>
        )}
      </div>
      {state === "prompt" && (
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await promptInstall().finally(() => setBusy(false));
          }}
          className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground transition hover:bg-accent-strong disabled:opacity-60"
        >
          <Download className="size-4" aria-hidden />
          Uygulamayı yükle
        </button>
      )}
    </section>
  );
}
