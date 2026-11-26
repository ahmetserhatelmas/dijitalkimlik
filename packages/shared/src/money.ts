import type { Currency } from "./domain";

const FORMAT: Record<Currency, { locale: string; currency: Currency }> = {
  TRY: { locale: "tr-TR", currency: "TRY" },
  USD: { locale: "en-US", currency: "USD" },
  EUR: { locale: "de-DE", currency: "EUR" },
};

export function formatMinor(amountMinor: number, currency: Currency): string {
  const { locale } = FORMAT[currency];
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(amountMinor / 100);
}
