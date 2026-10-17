"use client";

import { useEffect } from "react";
import { useAnatomyStore } from "@/store/useAnatomyStore";

/**
 * Kayıtlı oturumu hidrasyondan sonra geri yükler.
 * Böylece sunucu çıktısı ile istemcinin ilk çizimi aynı kalır (hidrasyon uyuşmazlığı oluşmaz).
 */
export function SessionHydrator() {
  useEffect(() => {
    void useAnatomyStore.persist.rehydrate();
  }, []);
  return null;
}
