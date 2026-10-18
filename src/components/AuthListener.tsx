"use client";

import { useEffect } from "react";
import { fetchCurrentUser } from "@/lib/auth";
import { useAnatomyStore } from "@/store/useAnatomyStore";

/**
 * Sayfa açılışında HttpOnly oturum çerezine bağlı kullanıcıyı /api/auth/me üzerinden alır ve store'a aktarır.
 * Giriş/çıkış sonrasında store'u giriş ekranı ve Navbar doğrudan günceller.
 */
export function AuthListener() {
  useEffect(() => {
    let cancelled = false;
    void fetchCurrentUser().then((user) => {
      if (cancelled) return;
      const { login, logout } = useAnatomyStore.getState();
      if (user) login(user);
      else logout();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
