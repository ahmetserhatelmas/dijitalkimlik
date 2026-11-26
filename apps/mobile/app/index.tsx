import { Link } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LanguageSwitch, useCopy } from "@/lib/i18n";
import { styles } from "@/lib/theme";

export default function WelcomeScreen() {
  const t = useCopy();
  return (
    <View style={[styles.screen, { justifyContent: "space-between", paddingTop: 72, paddingBottom: 36 }]}>
      <LanguageSwitch />
      <View>
        <Text style={[styles.title, { fontSize: 56, marginBottom: 12 }]}>Suret</Text>
        <Text style={styles.body}>{t.mobile.welcome}</Text>
      </View>
      <View>
        <Link href="/login" asChild>
          <Pressable style={styles.button}><Text style={styles.buttonText}>{t.auth.signIn}</Text></Pressable>
        </Link>
        <Link href="/register" asChild>
          <Pressable style={StyleSheet.flatten([styles.button, styles.secondary])}><Text style={styles.buttonText}>{t.nav.createAccount}</Text></Pressable>
        </Link>
      </View>
    </View>
  );
}
