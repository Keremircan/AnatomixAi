import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * ANATOMIX.AI marka simgesi: tarama çerçevesi (biyometrik köşe işaretleri) içinde kafatası, omuz hattı,
 * omurga ve pelvisten oluşan sade bir iskelet; ortasından yatay bir tarama ışını geçer.
 * Tamamen vektördür, renkleri tema belirteçlerinden (--accent, --teal) alır.
 */
export function BrandMark({ className, scanning = false }: { className?: string; scanning?: boolean }) {
  const id = useId();
  const g = `${id}-g`;
  const beam = `${id}-b`;
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden>
      <defs>
        <linearGradient id={g} x1="12" y1="6" x2="28" y2="35" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent-strong)" />
          <stop offset="0.55" stopColor="var(--accent)" />
          <stop offset="1" stopColor="var(--teal)" />
        </linearGradient>
        <linearGradient id={beam} x1="3" y1="0" x2="37" y2="0" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="0.5" stopColor="var(--accent-strong)" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Tarama çerçevesi: dört köşe işareti */}
      <path
        d="M3.5 11V6.5a3 3 0 0 1 3-3H11M29 3.5h4.5a3 3 0 0 1 3 3V11M36.5 29v4.5a3 3 0 0 1-3 3H29M11 36.5H6.5a3 3 0 0 1-3-3V29"
        stroke="var(--accent)"
        strokeOpacity="0.55"
        strokeWidth="1.6"
        strokeLinecap="round"
      />

      {/* Kafatası */}
      <circle cx="20" cy="9" r="3.3" stroke={`url(#${g})`} strokeWidth="2" />
      {/* Köprücük kemikleri (omuz hattı) */}
      <path d="M12.6 16.4Q20 13.2 27.4 16.4" stroke={`url(#${g})`} strokeWidth="1.8" strokeLinecap="round" />
      {/* Omurlar: boyundan bele genişleyen diskler */}
      <g stroke={`url(#${g})`} strokeWidth="2" strokeLinecap="round">
        <path d="M18.6 17.9h2.8" />
        <path d="M17.9 20.6h4.2" />
        <path d="M17.5 23.3h5" />
        <path d="M17.8 26h4.4" />
      </g>
      {/* Pelvis */}
      <path d="M14.4 28.8Q20 34.4 25.6 28.8" stroke={`url(#${g})`} strokeWidth="2" strokeLinecap="round" />

      {/* Tarama ışını */}
      <g className={scanning ? "animate-mark-scan" : undefined}>
        <rect x="3" y="21.4" width="34" height="1.1" rx="0.55" fill={`url(#${beam})`} opacity="0.9" />
      </g>
    </svg>
  );
}

const SIZES = {
  sm: { box: "size-9 rounded-[11px]", mark: "size-[26px]", text: "text-sm min-[400px]:text-[15px] sm:text-[17px]" },
  lg: { box: "size-12 rounded-2xl", mark: "size-9", text: "text-xl" },
} as const;

/** Simge + ANATOMIX.AI yazısı. Yazı her genişlikte görünür; BETA rozeti dar ekranda gizlenir. */
export function BrandLogo({
  size = "sm",
  beta = false,
  textClassName,
  scanning = false,
}: {
  size?: keyof typeof SIZES;
  beta?: boolean;
  textClassName?: string;
  scanning?: boolean;
}) {
  const s = SIZES[size];
  return (
    <span className="flex shrink-0 items-center gap-2 min-[400px]:gap-2.5">
      <span
        className={cn(
          "relative grid shrink-0 place-items-center border border-accent/30 bg-[radial-gradient(circle_at_50%_35%,color-mix(in_oklab,var(--accent)_22%,transparent),color-mix(in_oklab,var(--accent)_6%,transparent)_70%)] shadow-[inset_0_0_12px_-4px_var(--accent)]",
          s.box,
        )}
      >
        <BrandMark className={s.mark} scanning={scanning} />
      </span>
      <span className={cn("items-center gap-2", textClassName ?? "flex")}>
        <span className={cn("font-semibold tracking-tight", s.text)}>
          ANATOMIX<span className="text-accent">.AI</span>
        </span>
        {beta && (
          <span className="hidden rounded-full border border-line bg-surface-2 px-2 py-0.5 font-mono text-[10px] tracking-wider text-muted sm:inline">BETA</span>
        )}
      </span>
    </span>
  );
}
