import type { Metadata } from "next";
import { TriageResultView } from "@/components/triage/TriageResultView";

export const metadata: Metadata = {
  title: "Triyaj Sonucu · ANATOMIX.AI",
  description: "Şikayetinizin aciliyet seviyesi (T1–T4), önerilen başvuru birimi ve gerekçesi.",
};

export default function TriagePage() {
  return (
    <main className="mx-auto w-full max-w-[1240px] flex-1 p-3 sm:p-5">
      <TriageResultView />
    </main>
  );
}
