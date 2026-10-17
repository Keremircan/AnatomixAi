import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Koşullu Tailwind sınıflarını birleştirir, çakışanlarda sonuncuyu tutar. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
