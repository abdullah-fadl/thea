import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Convert Arabic/Eastern Arabic numerals (٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹) to Western (0-9) */
export function normalizeArabicNumerals(value: string): string {
  const arabicToEn: Record<string, string> = {
    '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
    '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
  };
  return String(value).replace(/[٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹]/g, (c) => arabicToEn[c] ?? c);
}
