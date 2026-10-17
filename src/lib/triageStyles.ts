import { CalendarCheck, Leaf, Siren, TriangleAlert, type LucideIcon } from "lucide-react";
import type { TriageLevel } from "@/lib/triage";

/**
 * Seviye başına renk ve ikon. Sınıflar Tailwind'in tarayabilmesi için tam metin olarak yazılır.
 * Renkler globals.css belirteçlerinden gelir: danger (kırmızı), warning (turuncu), accent (cyan), success (zümrüt).
 */
export const LEVEL_STYLE: Record<
  TriageLevel,
  { Icon: LucideIcon; text: string; bg: string; soft: string; border: string; dot: string; cssVar: string }
> = {
  critical: { Icon: Siren, text: "text-danger", bg: "bg-danger", soft: "bg-danger/12", border: "border-danger/55", dot: "bg-danger", cssVar: "var(--danger)" },
  urgent: { Icon: TriangleAlert, text: "text-warning", bg: "bg-warning", soft: "bg-warning/12", border: "border-warning/55", dot: "bg-warning", cssVar: "var(--warning)" },
  routine: { Icon: CalendarCheck, text: "text-accent", bg: "bg-accent", soft: "bg-accent/12", border: "border-accent/55", dot: "bg-accent", cssVar: "var(--accent)" },
  self_care: { Icon: Leaf, text: "text-success", bg: "bg-success", soft: "bg-success/12", border: "border-success/55", dot: "bg-success", cssVar: "var(--success)" },
};
