import { fill, term } from "@suret/shared";
import { Link, router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useCopy, useLocale } from "@/lib/i18n";
import { colors, styles } from "@/lib/theme";

const links = [
  ["/profile", "profilePrivacy"],
  ["/assets", "photos"],
  ["/rules", "rules"],
  ["/requests", "requests"],
  ["/licenses", "history"],
  ["/notifications", "notifications"],
  ["/report", "report"],
] as const;

export default function HomeScreen() {
  const t = useCopy();
  const locale = useLocale();
  const { signOut } = useAuth();
  const [name, setName] = useState("");
  const [verification, setVerification] = useState("unverified");
  useEffect(() => {
    api<{ profile: { displayName: string; verificationStatus: string } }>("me").then((me) => {
      setName(me.profile.displayName);
      setVerification(me.profile.verificationStatus);
    }).catch((caught) => {
      if (caught instanceof ApiError && (caught.status === 401 || caught.code === "INVALID_TOKEN")) {
        signOut().finally(() => router.replace("/"));
      }
    });
  }, [signOut]);
  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{fill(t.mobile.hello, { name: name || "…" })}</Text>
      <Text style={styles.body}>{fill(t.mobile.homeLede, { status: term(locale, "statuses", verification) })}</Text>
      {links.map(([href, key]) => (
        <Link key={href} href={href} asChild>
          <Pressable style={StyleSheet.flatten([styles.card, { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }])}>
            <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "600" }}>{t.mobile[key]}</Text>
            <Text style={{ color: colors.teal, fontSize: 20 }}>›</Text>
          </Pressable>
        </Link>
      ))}
      <Pressable style={StyleSheet.flatten([styles.button, styles.secondary])} onPress={() => { signOut().finally(() => router.replace("/")); }}>
        <Text style={styles.buttonText}>{t.mobile.signOut}</Text>
      </Pressable>
    </View>
  );
}
