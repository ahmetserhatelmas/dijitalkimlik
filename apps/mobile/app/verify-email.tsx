import { router } from "expo-router";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { api } from "@/lib/api";
import { useCopy } from "@/lib/i18n";
import { styles } from "@/lib/theme";

export default function VerifyEmailScreen() {
  const t = useCopy();
  useEffect(() => {
    let active = true;
    api("auth/verify-email", { method: "POST" })
      .catch(() => undefined)
      .finally(() => {
        if (active) router.replace("/home");
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <View style={styles.screen}>
      <Text style={styles.body}>{t.common.loading}</Text>
    </View>
  );
}
