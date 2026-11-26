import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text } from "react-native";
import { api } from "@/lib/api";
import { useCopy } from "@/lib/i18n";
import { styles } from "@/lib/theme";

export default function NotificationsScreen() {
  const t = useCopy();
  const [items, setItems] = useState<Array<{ id: string; title: string; body: string; readAt: string | null }>>([]);
  useEffect(() => { api<typeof items>("notifications").then(setItems).catch(() => setItems([])); }, []);
  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <Text style={styles.title}>{t.notifications.title}</Text>
      {items.length === 0 && <Text style={styles.body}>{t.notifications.empty}</Text>}
      {items.map((item) => (
        <Pressable key={item.id} style={styles.card} onPress={async () => {
          await api(`notifications/${item.id}/read`, { method: "POST" });
          setItems(await api("notifications"));
        }}>
          <Text>{item.title}</Text>
          <Text style={{ color: "#645d53", marginTop: 4 }}>{item.body}</Text>
          <Text style={{ marginTop: 6 }}>{item.readAt ? t.notifications.read : t.notifications.mark}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}
