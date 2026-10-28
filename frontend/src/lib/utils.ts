import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Safely converts a value to a number, returning a default if the result is NaN.
 * Handles undefined, null, NaN, and non-numeric strings.
 */
export function safeNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
}

/**
 * Safely rounds a number, returning a default if the result is NaN.
 */
export function safeRound(value: unknown, fallback = 0): number {
  return safeNumber(Math.round(safeNumber(value)), fallback);
}

/**
 * Clamps a number between min and max, safely handling NaN.
 */
export function clamp(value: unknown, min: number, max: number, fallback = min): number {
  const num = safeNumber(value, fallback);
  return Math.max(min, Math.min(max, num));
}

/**
 * Formats a number with locale string, safely handling NaN.
 */
export function safeToLocaleString(value: unknown, fallback = "—"): string {
  const num = safeNumber(value);
  if (num === 0 && value === 0) return "0";
  if (num === 0 && value !== 0 && value !== "0") return fallback;
  return num.toLocaleString();
}
