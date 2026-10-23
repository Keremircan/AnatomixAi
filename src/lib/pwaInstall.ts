"use client";

import { useSyncExternalStore } from "react";

/**
 * "Uygulamayı yükle" durumu. Chrome/Edge/Android `beforeinstallprompt` olayını sayfa açılır açılmaz bir kez
 * gönderir; olay bu modül yüklendiğinde yakalanır ve daha sonra (ör. profil sayfasında) kullanılır.
 * iOS Safari bu olayı desteklemez; orada kullanıcıya "Ana Ekrana Ekle" adımları gösterilir.
 */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // tarayıcının kendi bandı yerine uygulama içi düğme kullanılır
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

const subscribe = (cb: () => void) => {
  listeners.add(cb);
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", cb);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", cb);
  };
};

type InstallState = "installed" | "prompt" | "ios" | "unavailable";

function snapshot(): InstallState {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (installed || standalone) return "installed";
  if (deferred) return "prompt";
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "unavailable";
}

export function useInstallState() {
  return useSyncExternalStore(subscribe, snapshot, () => "unavailable" as InstallState);
}

/** Tarayıcının yükleme penceresini açar; kullanıcı kabul ederse true. */
export async function promptInstall() {
  const e = deferred;
  if (!e) return false;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  emit();
  return outcome === "accepted";
}
