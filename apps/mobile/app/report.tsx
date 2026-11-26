import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput } from "react-native";
import { api } from "@/lib/api";
import { useCopy } from "@/lib/i18n";
import { styles } from "@/lib/theme";

export default function ReportScreen() {
  const t = useCopy();
  const [suspectedProject, setSuspectedProject] = useState("");
  const [description, setDescription] = useState("");
  const [licenseId, setLicenseId] = useState("");
  const [message, setMessage] = useState("");
  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={styles.title}>{t.report.mobileTitle}</Text>
      <Text style={styles.body}>{t.report.mobileLede}</Text>
      <TextInput style={styles.input} placeholder={t.report.licenseOptional} value={licenseId} onChangeText={setLicenseId} />
      <TextInput style={styles.input} placeholder={t.report.project} value={suspectedProject} onChangeText={setSuspectedProject} />
      <TextInput style={[styles.input, { minHeight: 120 }]} multiline placeholder={t.report.whatHappened} value={description} onChangeText={setDescription} />
      <Pressable style={styles.button} onPress={async () => {
        await api("misuse-reports", {
          method: "POST",
          body: JSON.stringify({
            licenseId: licenseId || null,
            suspectedProject,
            observedAt: new Date().toISOString(),
            description,
            url: null,
          }),
        });
        setMessage(t.report.submittedShort);
      }}><Text style={styles.buttonText}>{t.report.submit}</Text></Pressable>
      {message ? <Text style={styles.body}>{message}</Text> : null}
    </ScrollView>
    </KeyboardAvoidingView>
  );
}
