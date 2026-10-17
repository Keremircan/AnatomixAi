/** Giriş ekranının sol panelindeki silüet: ızgara, tarama çizgisi ve nabız noktaları (yalnızca dekoratif). */

const LIMBS = [
  { pts: "110,72 110,98", w: 20 },
  { pts: "76,102 57,176 47,244", w: 20 },
  { pts: "144,102 163,176 173,244", w: 20 },
  { pts: "95,246 91,345 89,430", w: 28 },
  { pts: "125,246 129,345 131,430", w: 28 },
];
const TORSO = "M70 100 Q72 91 88 91 L132 91 Q148 91 150 100 L146 190 Q144 222 151 252 L69 252 Q76 222 74 190 Z";
const POINTS: [number, number, string][] = [
  [91, 345, "var(--accent)"],
  [118, 128, "var(--pain)"],
  [110, 172, "var(--teal)"],
];

export function AnatomyBackdrop() {
  return (
    <div className="relative mx-auto aspect-[220/460] h-full max-h-[440px]" aria-hidden>
      <svg viewBox="0 0 220 460" className="absolute inset-0 size-full">
        <defs>
          <linearGradient id="bd-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.16" />
            <stop offset="1" stopColor="var(--accent)" stopOpacity="0.03" />
          </linearGradient>
        </defs>
        <g fill="none" strokeLinecap="round" strokeLinejoin="round">
          {LIMBS.map((l) => (
            <polyline key={"o" + l.pts} points={l.pts} stroke="var(--accent)" strokeOpacity="0.45" strokeWidth={l.w + 2} />
          ))}
          <path d={TORSO} fill="var(--accent)" fillOpacity="0.45" stroke="var(--accent)" strokeOpacity="0.45" strokeWidth="2" />
          <ellipse cx="110" cy="46" rx="25" ry="30" fill="var(--accent)" fillOpacity="0.45" />
          {LIMBS.map((l) => (
            <polyline key={"f" + l.pts} points={l.pts} stroke="var(--background)" strokeWidth={l.w} />
          ))}
          <path d={TORSO} fill="var(--background)" />
          <ellipse cx="110" cy="46" rx="24" ry="29" fill="var(--background)" />
          {LIMBS.map((l) => (
            <polyline key={"g" + l.pts} points={l.pts} stroke="url(#bd-fill)" strokeWidth={l.w} />
          ))}
          <path d={TORSO} fill="url(#bd-fill)" />
          <ellipse cx="110" cy="46" rx="24" ry="29" fill="url(#bd-fill)" />
          {/* Omurga ve kaburga ipuçları */}
          <path d="M110 96 V246" stroke="var(--accent)" strokeOpacity="0.35" strokeDasharray="2 5" />
          {[118, 134, 150].map((y) => (
            <path key={y} d={`M92 ${y} Q110 ${y + 9} 128 ${y}`} stroke="var(--accent)" strokeOpacity="0.25" />
          ))}
        </g>
        {POINTS.map(([x, y, c]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="9" fill="none" stroke={c} strokeWidth="1.5" className="animate-pulse-ring" />
            <circle cx={x} cy={y} r="4" fill={c} />
          </g>
        ))}
      </svg>
      {/* Tarama çizgisi */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-full animate-scan">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-accent to-transparent shadow-[0_0_18px_4px_color-mix(in_oklab,var(--accent)_45%,transparent)]" />
        </div>
      </div>
    </div>
  );
}
