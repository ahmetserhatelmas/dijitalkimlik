import { formatMinor, term, type Currency } from "@suret/shared";
import { Link } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { api } from "@/lib/api";
import { useCopy, useLocale } from "@/lib/i18n";
import { styles } from "@/lib/theme";

type RequestRow = {
  id: string;
  status: string;
  intendedUse: string;
  producerId: string;
  usage: { distributionChannels: string[]; territories: string[]; startsOn: string; endsOn: string; downloadOriginal: boolean };
};
type AgreementCard = {
  id: string;
  requestId: string;
  status: string;
  amountMinor: number;
  currency: Currency;
  document: { projectName: string };
};

export default function RequestsScreen() {
  const t = useCopy();
  const locale = useLocale();
  const [userId, setUserId] = useState("");
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [agreements, setAgreements] = useState<AgreementCard[]>([]);
  const [message, setMessage] = useState("");
  async function load() {
    const me = await api<{ profile: { id: string } }>("me");
    setUserId(me.profile.id);
    setRequests(await api<RequestRow[]>("license-requests"));
    setAgreements(await api<AgreementCard[]>("agreements"));
  }
  useEffect(() => { void load().catch(() => setRequests([])); }, []);
  async function decide(id: string, decision: "approve" | "reject") {
    try {
      const result = await api<{ status: string }>(`license-requests/${id}/decision`, { method: "POST", body: JSON.stringify({ decision }) });
      setMessage(decision === "reject" ? t.requests.rejected : result.status === "active" ? t.requests.decided : t.agreement.recordFailed);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : t.requests.empty);
    }
  }
  async function complete(id: string) {
    try {
      const result = await api<{ status: string }>(`agreements/${id}/complete`, { method: "POST" });
      setMessage(result.status === "active" ? t.requests.decided : t.agreement.recordFailed);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : t.agreement.recordFailed);
    }
  }
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>{t.requests.title}</Text>
      {message ? <Text style={styles.body}>{message}</Text> : null}
      {requests.length === 0 && <Text style={styles.body}>{t.requests.empty}</Text>}
      {requests.map((request) => {
        const agreement = agreements.find((item) => item.requestId === request.id);
        const incoming = request.producerId !== userId;
        return (
          <View key={request.id} style={styles.card}>
            {agreement ? <Text style={styles.body}>{agreement.document.projectName}</Text> : null}
            <Text>{term(locale, "statuses", request.status)}</Text>
            <Text style={styles.body}>{request.intendedUse}</Text>
            <Text style={styles.body}>{request.usage.startsOn} – {request.usage.endsOn}</Text>
            <Text style={styles.body}>{request.usage.distributionChannels.join(", ")} · {request.usage.territories.join(", ")}</Text>
            {agreement ? <Text style={styles.body}>{t.agreement.amount} {formatMinor(agreement.amountMinor, agreement.currency)}</Text> : null}
            {request.usage.downloadOriginal ? <Text style={styles.body}>{t.discover.download}</Text> : null}
            {incoming && (request.status === "pending_review" || agreement?.status === "pending_consent" || agreement?.status === "approved") ? <Text style={styles.body}>{t.requests.writes}</Text> : null}
            {!incoming && (request.status === "pending_review" || agreement?.status === "pending_consent" || agreement?.status === "approved") ? <Text style={styles.body}>{t.requests.waiting}</Text> : null}
            {incoming && agreement && (agreement.status === "pending_consent" || agreement.status === "approved") ? (
              <View style={{ marginTop: 8 }}>
                <Pressable style={styles.button} onPress={() => complete(agreement.id)}><Text style={styles.buttonText}>{t.requests.approve}</Text></Pressable>
              </View>
            ) : null}
            {incoming && request.status === "pending_review" ? (
              <View style={{ marginTop: 8, gap: 8 }}>
                <Pressable style={styles.button} onPress={() => decide(request.id, "approve")}><Text style={styles.buttonText}>{t.requests.approve}</Text></Pressable>
                <Pressable style={[styles.button, styles.secondary]} onPress={() => decide(request.id, "reject")}><Text style={styles.buttonText}>{t.requests.reject}</Text></Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
      <Text style={styles.title}>{t.requests.agreements}</Text>
      {agreements.map((agreement) => (
        <Link key={agreement.id} href={`/agreements/${agreement.id}`} style={styles.card}>
          <Text>{agreement.document.projectName} · {term(locale, "statuses", agreement.status)}</Text>
        </Link>
      ))}
    </ScrollView>
  );
}
