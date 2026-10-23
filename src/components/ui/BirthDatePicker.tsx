"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { ageOf } from "@/lib/health";
import { cn } from "@/lib/utils";

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
const WEEKDAYS = ["Pt", "Sa", "Ça", "Pe", "Cu", "Ct", "Pz"];
const MIN_YEAR = 1900;
const YEARS_PER_PAGE = 20;

type View = "years" | "months" | "days";
const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
/** Pazartesi = 0 */
const firstWeekday = (y: number, m: number) => (new Date(y, m, 1).getDay() + 6) % 7;

function parse(v: string | null) {
  if (!v) return null;
  const [y, m, d] = v.split("-").map(Number);
  return { y, m: m - 1, d };
}

const cell = "grid place-items-center rounded-lg text-sm tabular-nums transition disabled:pointer-events-none disabled:opacity-30";
const cellIdle = "hover:bg-surface-2 text-foreground";
const cellOn = "bg-accent font-semibold text-accent-foreground shadow-[0_6px_16px_-8px_var(--accent)]";

/**
 * Doğum tarihi seçici (tarayıcının biçimlendirilemeyen yerel takvimi yerine). Doğum tarihi için ay ay gezinmek
 * yorucu olduğundan seçim Yıl → Ay → Gün sırasıyla üç dokunuşta yapılır. Satır içinde açılır: sihirbazın
 * kayan gövdesinde kırpılmaz, telefonda da tam genişlik kullanır. Gelecek tarihler seçilemez.
 */
export function BirthDatePicker({ id, value, onChange }: { id: string; value: string | null; onChange: (v: string | null) => void }) {
  const today = new Date();
  const ty = today.getFullYear();
  const tm = today.getMonth();
  const td = today.getDate();
  const sel = parse(value);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("years");
  const [year, setYear] = useState(sel?.y ?? ty - 30);
  const [month, setMonth] = useState(sel?.m ?? 0);
  const [pageStart, setPageStart] = useState(() => (sel?.y ?? ty - 30) - ((sel?.y ?? ty - 30) % YEARS_PER_PAGE));

  const show = () => {
    const y = sel?.y ?? ty - 30;
    setYear(y);
    setMonth(sel?.m ?? 0);
    setPageStart(y - (y % YEARS_PER_PAGE));
    setView(sel ? "days" : "years");
    setOpen(true);
  };

  const age = ageOf(value);
  const label = sel ? `${sel.d} ${MONTHS[sel.m]} ${sel.y}` : null;
  const futureMonth = (m: number) => year === ty && m > tm;

  return (
    <div className="grid gap-2">
      <button
        id={id}
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => (open ? setOpen(false) : show())}
        className={cn(
          "flex h-11 w-full items-center gap-2.5 rounded-xl border bg-surface-2/70 px-3 text-left text-sm transition",
          open ? "border-accent ring-4 ring-accent/15" : "border-line hover:border-accent/50",
        )}
      >
        <CalendarDays className="size-4 shrink-0 text-accent" aria-hidden />
        <span className={cn("flex-1 truncate", !label && "text-muted/70")}>{label ?? "Gün / ay / yıl seçin"}</span>
        {age !== null && <span className="shrink-0 rounded-md bg-accent/12 px-1.5 py-0.5 text-[11px] font-medium text-accent">{age} yaş</span>}
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>

      {open && (
        <div id={`${id}-panel`} role="group" aria-label="Doğum tarihi seçimi" className="w-full max-w-sm rounded-2xl border border-line bg-surface p-3 shadow-elev animate-rise">
          {/* Başlık: görünüm geçişleri ve önceki/sonraki */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={view === "years" ? "Önceki yıllar" : view === "months" ? "Önceki yıl" : "Önceki ay"}
              disabled={view === "years" ? pageStart <= MIN_YEAR : view === "months" ? year <= MIN_YEAR : year <= MIN_YEAR && month === 0}
              onClick={() => {
                if (view === "years") setPageStart((p) => p - YEARS_PER_PAGE);
                else if (view === "months") setYear((y) => y - 1);
                else if (month === 0) {
                  setMonth(11);
                  setYear((y) => y - 1);
                } else setMonth((m) => m - 1);
              }}
              className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </button>
            <div className="flex flex-1 items-center justify-center gap-1">
              {view === "days" && (
                <button type="button" onClick={() => setView("months")} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold transition hover:bg-surface-2">
                  {MONTHS[month]}
                </button>
              )}
              {view !== "years" ? (
                <button
                  type="button"
                  onClick={() => {
                    setPageStart(year - (year % YEARS_PER_PAGE));
                    setView("years");
                  }}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-accent transition hover:bg-accent/10"
                >
                  {year}
                  <ChevronDown className="size-3.5" aria-hidden />
                </button>
              ) : (
                <span className="px-2.5 py-1.5 text-sm font-semibold tabular-nums">
                  {Math.max(pageStart, MIN_YEAR)} – {Math.min(pageStart + YEARS_PER_PAGE - 1, ty)}
                </span>
              )}
            </div>
            <button
              type="button"
              aria-label={view === "years" ? "Sonraki yıllar" : view === "months" ? "Sonraki yıl" : "Sonraki ay"}
              disabled={view === "years" ? pageStart + YEARS_PER_PAGE > ty : view === "months" ? year >= ty : year === ty && month >= tm}
              onClick={() => {
                if (view === "years") setPageStart((p) => p + YEARS_PER_PAGE);
                else if (view === "months") setYear((y) => y + 1);
                else if (month === 11) {
                  setMonth(0);
                  setYear((y) => y + 1);
                } else setMonth((m) => m + 1);
              }}
              className="grid size-9 place-items-center rounded-lg text-muted transition hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
            >
              <ChevronRight className="size-4" aria-hidden />
            </button>
          </div>

          <p className="mt-1 mb-2 text-center text-[11px] text-muted">
            {view === "years" ? "Doğum yılınızı seçin" : view === "months" ? "Ayı seçin" : "Günü seçin"}
          </p>

          {view === "years" && (
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: YEARS_PER_PAGE }, (_, i) => pageStart + i).map((y) => (
                <button
                  key={y}
                  type="button"
                  disabled={y < MIN_YEAR || y > ty}
                  aria-pressed={sel?.y === y}
                  onClick={() => {
                    setYear(y);
                    if (y === ty && month > tm) setMonth(tm);
                    setView("months");
                  }}
                  className={cn(cell, "h-10", sel?.y === y ? cellOn : cellIdle, y === year && sel?.y !== y && "ring-1 ring-accent/40")}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {view === "months" && (
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS.map((name, m) => {
                const on = sel?.y === year && sel.m === m;
                return (
                  <button
                    key={name}
                    type="button"
                    disabled={futureMonth(m)}
                    aria-pressed={on}
                    onClick={() => {
                      setMonth(m);
                      setView("days");
                    }}
                    className={cn(cell, "h-11", on ? cellOn : cellIdle)}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          )}

          {view === "days" && (
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w) => (
                <span key={w} className="grid h-7 place-items-center text-[11px] font-medium text-muted">
                  {w}
                </span>
              ))}
              {Array.from({ length: firstWeekday(year, month) }, (_, i) => (
                <span key={`e${i}`} />
              ))}
              {Array.from({ length: daysIn(year, month) }, (_, i) => i + 1).map((d) => {
                const on = sel?.y === year && sel.m === month && sel.d === d;
                const future = year === ty && month === tm && d > td;
                const isToday = year === ty && month === tm && d === td;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={future}
                    aria-pressed={on}
                    aria-label={`${d} ${MONTHS[month]} ${year}`}
                    onClick={() => {
                      onChange(iso(year, month, d));
                      setOpen(false);
                    }}
                    className={cn(cell, "h-10", on ? cellOn : cellIdle, isToday && !on && "ring-1 ring-accent/50")}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
            {value ? (
              <button
                type="button"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] text-muted transition hover:bg-danger/10 hover:text-danger"
              >
                <X className="size-3.5" aria-hidden />
                Temizle
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1 text-[12px] font-medium text-accent transition hover:bg-accent/10">
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
