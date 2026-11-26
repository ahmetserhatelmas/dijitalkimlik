import { Link, router } from "expo-router";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput } from "react-native";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { useCopy } from "@/lib/i18n";
import { styles } from "@/lib/theme";

export default function RegisterScreen() {
  const t = useCopy();
  const { enter } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Text style={styles.title}>{t.auth.create}</Text>
        <Text style={styles.body}>{t.auth.createLead}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <TextInput style={styles.input} placeholder={t.auth.name} placeholderTextColor="#8a8176" value={displayName} onChangeText={setDisplayName} />
        <TextInput style={styles.input} autoCapitalize="none" keyboardType="email-address" placeholder={t.auth.email} placeholderTextColor="#8a8176" value={email} onChangeText={setEmail} />
        <TextInput style={styles.input} secureTextEntry placeholder={t.auth.password} placeholderTextColor="#8a8176" value={password} onChangeText={setPassword} />
        <Pressable style={styles.button} onPress={async () => {
          try {
            const result = await api<{ accessToken: string }>("auth/register", {
              method: "POST",
              body: JSON.stringify({ email, password, displayName, role: "face_owner" }),
            });
            if (result.accessToken) await enter(result.accessToken);
            router.replace("/home");
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : t.auth.registerFailed);
          }
        }}><Text style={styles.buttonText}>{t.auth.create}</Text></Pressable>
        <Link href="/login" style={styles.link}>{t.auth.hasAccount}</Link>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
