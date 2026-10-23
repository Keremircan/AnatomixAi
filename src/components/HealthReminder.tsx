"use client";

import { useEffect, useState } from "react";
import { HeartPulse, X } from "lucide-react";
import { dismissHealthReminder, fetchHealthData } from "@/lib/auth";
import { useAnatomyStore } from "@/store/useAnatomyStore";

/**
 * Ana sayfa: oturum açılınca sağlık profilini bir kez yükler (triyaj bu profili kullanır) ve profil tamamlanmamışsa
 * sağ altta isteğe bağlı bir hatırlatma bandı gösterir. "Şimdi değil" bandı sunucuda 14 gün susturur.
 */
export function HealthReminder() {
  const isAuthenticated = useAnatomyStore((s) => s.isAuthenticated);
  const health = useAnatomyStore((s) => s.health);
  const remind = useAnatomyStore((s) => s.healthReminder);
  const setHealth = useAnatomyStore((s) => s.setHealth);
  const hide = useAnatomyStore((s) => s.hideHealthReminder);
  const openWizard = useAnatomyStore((s) => s.openHealthWizard);
  const wizardOpen = useAnatomyStore((s) => s.healthWizardStep !== null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!isAuthenticated || health !== undefined) return;
    let cancelled = false;
    fetchHealthData()
      .then((r) => !cancelled && setHealth(r.health, r.remind))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, health, setHealth]);

  // Sahne açılırken dikkati dağıtmasın diye bant kısa bir gecikmeyle kayarak gelir.
  useEffect(() => {
    if (!remind) return;
    const t = setTimeout(() => setShown(true), 1200);
    return () => clearTimeout(t);
  }, [remind]);

  if (!remind || !shown || wizardOpen) return null;

  return (
    <aside
      aria-label="Sağlık profili hatırlatması"
      className="glass fixed right-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 w-[min(calc(100vw-1.5rem),24rem)] rounded-card p-4 shadow-elev animate-rise sm:right-5 md:bottom-5"
    >
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent/12 text-accent">
          <HeartPulse className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-sm font-semibold">Sağlık profilinizi tamamlayın</h2>
            <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-muted">Opsiyonel</span>
          </div>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            Yapay zekanın analiz doğruluğunu artırmak ve önerileri size göre kişiselleştirmek için sağlık profilinizi tamamlayın.
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => openWizard(0)}
              className="h-9 rounded-xl bg-accent px-3.5 text-[13px] font-semibold text-accent-foreground transition hover:bg-accent-strong"
            >
              Formu başlat
            </button>
            <button
              type="button"
              onClick={() => {
                hide();
                void dismissHealthReminder();
              }}
              className="h-9 rounded-xl border border-line px-3.5 text-[13px] font-medium text-muted transition hover:bg-surface-2 hover:text-foreground"
            >
              Şimdi değil
            </button>
          </div>
        </div>
        <button type="button" onClick={hide} aria-label="Kapat" className="-mt-1 -mr-1 rounded-lg p-1 text-muted hover:bg-surface-2 hover:text-foreground">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </aside>
  );
}
