import Image from "next/image";
import { cn } from "@/lib/utils";

/** Logo dosyası: public/brand/anatomix-mark.png (saydam zemin, 365 × 512). */
const MARK = { src: "/brand/anatomix-mark.png", width: 365, height: 512 };

/**
 * ANATOMIX.AI marka simgesi: iskeleti görünen, sıçrayan insan figürü ve "X". Logonun özgün renkleri iki temada
 * da aynı kalsın diye beyaz, yuvarlak köşeli bir zemin üzerinde gösterilir (koyu temada da okunur).
 */
export function BrandMark({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <span className={cn("relative grid shrink-0 place-items-center overflow-hidden bg-white ring-1 ring-black/5 dark:ring-white/10", className)}>
      <Image src={MARK.src} width={MARK.width} height={MARK.height} alt="" aria-hidden priority={priority} className="h-[82%] w-auto" />
    </span>
  );
}

const SIZES = {
  sm: { box: "size-9 rounded-[11px]", text: "text-sm min-[400px]:text-[15px] sm:text-[17px]" },
  lg: { box: "size-12 rounded-2xl", text: "text-xl" },
} as const;

/** Simge + ANATOMIX.AI yazısı. Yazı her genişlikte görünür; BETA rozeti dar ekranda gizlenir. */
export function BrandLogo({ size = "sm", beta = false, textClassName }: { size?: keyof typeof SIZES; beta?: boolean; textClassName?: string }) {
  const s = SIZES[size];
  return (
    <span className="flex shrink-0 items-center gap-2 min-[400px]:gap-2.5">
      <BrandMark className={s.box} priority />
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
