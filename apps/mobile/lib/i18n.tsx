import { copy, isLocale, type Copy, type Locale } from "@suret/shared";
import * as SecureStore from "expo-secure-store";
import { createContext, useContext, useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";

const KEY = "suret_locale";
const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; t: Copy }>({
  locale: "tr",
  setLocale: () => undefined,
  t: copy("tr"),
});

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("tr");
  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((value) => {
      if (isLocale(value)) setLocaleState(value);
    }).catch(() => undefined);
  }, []);
  function setLocale(next: Locale) {
    setLocaleState(next);
    SecureStore.setItemAsync(KEY, next).catch(() => undefined);
  }
  return <LocaleContext.Provider value={{ locale, setLocale, t: copy(locale) }}>{children}</LocaleContext.Provider>;
}

export function useCopy(): Copy {
  return useContext(LocaleContext).t;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

export function LanguageSwitch() {
  const { locale, setLocale, t } = useContext(LocaleContext);
  return (
    <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }} accessibilityLabel={t.language.label}>
      {(["tr", "en"] as const).map((item) => (
        <Pressable key={item} onPress={() => setLocale(item)} style={{ paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: locale === item ? "#1c1915" : "#fffdf8" }}>
          <Text style={{ color: locale === item ? "white" : "#1c1915" }}>{item === "tr" ? "TR" : "EN"}</Text>
        </Pressable>
      ))}
    </View>
  );
}
