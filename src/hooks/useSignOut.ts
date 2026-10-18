"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth";
import { useAnatomyStore } from "@/store/useAnatomyStore";

/** Çıkış: oturum çerezini sunucuda siler, yerel durumu (analiz dahil) temizler ve giriş ekranına döner. */
export function useSignOut() {
  const logout = useAnatomyStore((s) => s.logout);
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function run() {
    setLeaving(true);
    try {
      await signOut();
    } catch {
      // Ağ hatasında da yerel oturum temizlenir; çerez bir sonraki istekte proxy tarafından doğrulanır.
    }
    logout();
    router.replace("/login");
    router.refresh();
  }

  return { signOut: run, leaving };
}
