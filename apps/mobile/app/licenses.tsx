import { fill, formatMinor, term } from "@suret/shared";
import { useEffect, useState } from "react";
import { ScrollView, Text } from "react-native";
import { api } from "@/lib/api";
import { useCopy, useLocale } from "@/lib/i18n";
import { styles } from "@/lib/theme";

export default function LicensesScreen() {
  const t = useCopy();
  const locale = useLocale();
  const [agreements, setAgreements] = useState<Array<{ id: string; status: string; amountMinor: number; currency: "TRY" | "USD" | "EUR"; document: { projectName: string; granted: { endsOn: string } } }>>([]);
  const [payments, setPayments] = useState<Array<{ id: string; amountMinor: number; currency: "TRY" | "USD" | "EUR"; status: string }>>([]);
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    api<typeof agreements>("agreements").then(setAgreements).catch(() => setAgreements([]));
    api<typeof payments>("payments").then(setPayments).catch(() => setPayments([]));
    api<{ balanceMinor: number }>("wallet").then((wallet) => setBalance(wallet.balanceMinor)).catch(() => setBalance(null));
  }, []);
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>{t.licenses.title}</Text>
      {balance !== null && <Text style={styles.body}>{fill(t.payments.balance, { amount: formatMinor(balance, "TRY") })}</Text>}
      <Text style={styles.body}>{t.payments.lede}</Text>
      {agreements.map((item) => (
        <Text key={item.id} style={styles.card}>{item.document.projectName} · {term(locale, "statuses", item.status)} · {fill(t.licenses.through, { date: item.document.granted.endsOn })} · {formatMinor(item.amountMinor, item.currency)}</Text>
      ))}
      <Text style={styles.title}>{t.payments.compensation}</Text>
      {payments.length === 0 && <Text style={styles.body}>{t.payments.empty}</Text>}
      {payments.map((item) => <Text key={item.id} style={styles.card}>{formatMinor(item.amountMinor, item.currency)} · {term(locale, "statuses", item.status)}</Text>)}
    </ScrollView>
  );
}
