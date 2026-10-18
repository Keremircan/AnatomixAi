import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/ProfileView";

export const metadata: Metadata = {
  title: "Profilim · ANATOMIX.AI",
  description: "Hesap bilgileriniz, mesleki bilgileriniz ve yasal onaylarınız.",
};

/** Oturum zorunludur: proxy oturumsuz istekleri /login'e yönlendirir; veri /api/user/profile'dan gelir. */
export default function ProfilePage() {
  return <ProfileView />;
}
