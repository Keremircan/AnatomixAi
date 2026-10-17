import type { Metadata } from "next";
import { AuthScreen } from "@/components/auth/AuthScreen";

export const metadata: Metadata = {
  title: "Giriş Yap · ANATOMIX.AI",
  description: "Hasta veya Sağlık Profesyoneli portalına giriş yapın ya da hesap oluşturun.",
};

export default function LoginPage() {
  return <AuthScreen />;
}
