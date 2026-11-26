"use client";

import { copy, isLocale, type Copy, type Locale } from "@suret/shared";
import { useRouter } from "next/navigation";
import { createContext, useContext, useState } from "react";

const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; t: Copy } | null>(null);

export function LocaleProvider({ initial, children }: { initial: Locale; children: React.ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initial);
  function setLocale(next: Locale) {
    document.cookie = `suret_locale=${next}; path=/; max-age=31536000; samesite=lax`;
    setLocaleState(next);
    router.refresh();
  }
  return <LocaleContext.Provider value={{ locale, setLocale, t: copy(locale) }}>{children}</LocaleContext.Provider>;
}

export function useCopy(): Copy {
  const context = useContext(LocaleContext);
  return context?.t ?? copy("tr");
}

export function useLocale(): Locale {
  return useContext(LocaleContext)?.locale ?? "tr";
}

export function LanguageSwitch() {
  const context = useContext(LocaleContext);
  const locale = context?.locale ?? "tr";
  const t = context?.t ?? copy(locale);
  return (
    <div className="flex items-center gap-1 text-xs" role="group" aria-label={t.language.label}>
      {(["tr", "en"] as const).map((item) => (
        <button
          key={item}
          type="button"
          aria-pressed={locale === item}
          className={`rounded-full px-2 py-1 ${locale === item ? "bg-ink text-white" : "text-muted hover:text-ink"}`}
          onClick={() => context?.setLocale(item)}
        >
          {item === "tr" ? "TR" : "EN"}
        </button>
      ))}
    </div>
  );
}

export function readLocaleCookie(): Locale {
  if (typeof document === "undefined") return "tr";
  const match = document.cookie.match(/(?:^|; )suret_locale=([^;]+)/);
  return isLocale(match?.[1]) ? match[1] : "tr";
}
