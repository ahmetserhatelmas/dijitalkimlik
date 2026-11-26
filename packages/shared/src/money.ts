import type { Currency } from "./domain";

export function groupDigits(value: number | string): string {
  const digits = String(value).replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  if (!digits) return "";
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function formatMinor(amountMinor: number, currency: Currency): string {
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency, useGrouping: true }).format(amountMinor / 100);
}
