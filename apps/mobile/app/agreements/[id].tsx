import { term } from "@suret/shared";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { api } from "@/lib/api";
import { useCopy, useLocale } from "@/lib/i18n";
import { styles } from "@/lib/theme";

type Bundle = {
  agreement: { id: string; requestId: string; licenseId: string; status: string; document: { text: string; licensorProfileId: string; licenseeProfileId: string }; documentHash: string };
};

export default function AgreementScreen() {
  const t = useCopy();
  const locale = useLocale();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [bundle, setBundle] = useState<Bundle | null>(null);
  const [userId, setUserId] = useState("");
  const [message, setMessage] = useState("");
  async function load() {
    const me = await api<{ profile: { id: string } }>("me");
    setUserId(me.profile.id);
    setBundle(await api<Bundle>(`agreements/${id}`));
  }
  useEffect(() => { void load().catch(() => setBundle(null)); }, [id]);
  if (!bundle) return <ScrollView contentContainerStyle={styles.scroll}><Text>{t.agreement.loading}</Text></ScrollView>;
  const owner = userId === bundle.agreement.document.licensorProfileId;
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>{term(locale, "statuses", bundle.agreement.status)}</Text>
      <Text style={styles.card}>{bundle.agreement.document.text}</Text>
      {bundle.agreement.status === "draft" && owner ? (
        <>
          <Text style={styles.body}>{t.requests.writes}</Text>
          <Pressable style={styles.button} onPress={async () => {
            try {
              const result = await api<{ status: string }>(`license-requests/${bundle.agreement.requestId}/decision`, { method: "POST", body: JSON.stringify({ decision: "approve" }) });
              setMessage(result.status === "active" ? t.requests.decided : t.agreement.recordFailed);
              await load();
            } catch (caught) {
              setMessage(caught instanceof Error ? caught.message : t.agreement.recordFailed);
            }
          }}><Text style={styles.buttonText}>{t.requests.approve}</Text></Pressable>
          <Pressable style={[styles.button, styles.secondary]} onPress={async () => {
            try {
              await api(`license-requests/${bundle.agreement.requestId}/decision`, { method: "POST", body: JSON.stringify({ decision: "reject" }) });
              setMessage(t.requests.rejected);
              await load();
            } catch (caught) {
              setMessage(caught instanceof Error ? caught.message : t.agreement.recordFailed);
            }
          }}><Text style={styles.buttonText}>{t.requests.reject}</Text></Pressable>
        </>
      ) : null}
      {bundle.agreement.status === "draft" && !owner ? <Text style={styles.body}>{t.requests.waiting}</Text> : null}
      {(bundle.agreement.status === "pending_consent" || bundle.agreement.status === "approved") && owner ? (
        <>
          <Text style={styles.body}>{t.requests.writes}</Text>
          <Pressable style={styles.button} onPress={async () => {
            try {
              const result = await api<{ status: string }>(`agreements/${id}/complete`, { method: "POST" });
              setMessage(result.status === "active" ? t.requests.decided : t.agreement.recordFailed);
              await load();
            } catch (caught) {
              setMessage(caught instanceof Error ? caught.message : t.agreement.recordFailed);
            }
          }}><Text style={styles.buttonText}>{t.requests.approve}</Text></Pressable>
        </>
      ) : null}
      {(bundle.agreement.status === "pending_consent" || bundle.agreement.status === "approved") && !owner ? <Text style={styles.body}>{t.requests.waiting}</Text> : null}
      {(bundle.agreement.status === "recording" || bundle.agreement.status === "recording_failed") ? (
        <Pressable style={styles.button} onPress={async () => {
          try {
            await api(`licenses/${bundle.agreement.licenseId}/blockchain`, { method: "POST" });
            setMessage(t.agreement.recorded);
            await load();
          } catch (caught) {
            setMessage(caught instanceof Error ? caught.message : t.agreement.recordFailed);
            await load();
          }
        }}><Text style={styles.buttonText}>{t.agreement.record}</Text></Pressable>
      ) : null}
      {bundle.agreement.status === "active" ? <Text style={styles.body}>{t.agreement.activeNote}</Text> : null}
      {message ? <Text style={styles.body}>{message}</Text> : null}
    </ScrollView>
  );
}
