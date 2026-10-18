"use client";

import { useEffect } from "react";
import { fetchCurrentUser, ROLE_HINT_KEY, type UserProfile } from "@/lib/auth";
import { useAnatomyStore } from "@/store/useAnatomyStore";

function roleHint(user: UserProfile | null) {
  if (!user) return null;
  if (user.role === "patient" || user.verified) return user.role;
  return user.verificationStatus === "rejected" ? "clinician-rejected" : "clinician-pending";
}

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

    // Bir sonraki F5'te iskelet doğru genişlikte çizilsin diye rol ipucunu sakla.
    const unsubscribe = useAnatomyStore.subscribe((s, prev) => {
      if (!s.authReady || (s.user === prev.user && s.authReady === prev.authReady)) return;
      const hint = roleHint(s.user);
      try {
        if (hint) localStorage.setItem(ROLE_HINT_KEY, hint);
        else localStorage.removeItem(ROLE_HINT_KEY);
      } catch {}
      if (hint) document.documentElement.dataset.anxRole = hint;
      else delete document.documentElement.dataset.anxRole;
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return null;
}
