import { term } from "@suret/shared";
import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput } from "react-native";
import { api, clearToken } from "@/lib/api";
import { router } from "expo-router";
import { LanguageSwitch, useCopy, useLocale } from "@/lib/i18n";
import { styles } from "@/lib/theme";

export default function ProfileScreen() {
  const t = useCopy();
  const locale = useLocale();
  const [profile, setProfile] = useState<{ id: string; displayName: string; bio?: string; verificationStatus: string; emailVerified: boolean } | null>(null);
  const [bio, setBio] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    api<{ profile: { id: string; displayName: string; verificationStatus: string; emailVerified: boolean } }>("me").then((me) => setProfile(me.profile)).catch(() => setProfile(null));
  }, []);
  if (!profile) return <ScrollView contentContainerStyle={styles.scroll}><Text>{t.profile.signIn}</Text></ScrollView>;
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <LanguageSwitch />
      <Text style={styles.title}>{profile.displayName}</Text>
      <Text style={styles.body}>{t.profile.verification}: {term(locale, "statuses", profile.verificationStatus)}. {t.profile.emailVerified}: {profile.emailVerified ? t.profile.yes : t.profile.no}.</Text>
      <TextInput style={styles.input} placeholder={t.profile.bio} value={bio} onChangeText={setBio} />
      <Pressable style={styles.button} onPress={async () => {
        await api(`profiles/${profile.id}`, { method: "PATCH", body: JSON.stringify({ bio, privacy: { discoverable: true, showPreviewToProducers: false, showLegalName: false } }) });
        setMessage(t.profile.savedMobile);
      }}><Text style={styles.buttonText}>{t.profile.save}</Text></Pressable>
      <Pressable style={[styles.button, styles.secondary]} onPress={async () => {
        await api("me/deletion-request", { method: "POST" });
        setMessage(t.mobile.deletionDone);
      }}><Text style={styles.buttonText}>{t.mobile.deletion}</Text></Pressable>
      <Pressable onPress={async () => { await clearToken(); router.replace("/"); }}><Text style={{ marginTop: 16 }}>{t.dash.signOut}</Text></Pressable>
      {message ? <Text style={styles.body}>{message}</Text> : null}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
