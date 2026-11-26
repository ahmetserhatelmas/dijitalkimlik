import { fill, term } from "@suret/shared";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { api, apiUrl, uploadFile } from "@/lib/api";
import { useCopy, useLocale } from "@/lib/i18n";
import { styles } from "@/lib/theme";

type Asset = {
  id: string;
  moderationStatus: string;
  duplicateFlags: { kind: string }[];
  sha256: string;
  listed?: boolean;
  subject?: "face" | "place" | "object";
  caption?: string;
  imageUrl?: string | null;
};

function reachable(url: string): string {
  try {
    const parsed = new URL(url);
    return `${apiUrl}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

export default function AssetsScreen() {
  const t = useCopy();
  const locale = useLocale();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [subject, setSubject] = useState<"face" | "place" | "object">("face");
  async function load() {
    const rows = await api<Asset[]>("assets");
    const withPhotos = await Promise.all(rows.map(async (asset) => {
      try {
        const signed = await api<{ url: string }>(`assets/${asset.id}/signed-url`, { method: "POST", body: JSON.stringify({ purpose: "original" }) });
        return { ...asset, imageUrl: reachable(signed.url) };
      } catch {
        return { ...asset, imageUrl: null };
      }
    }));
    setAssets(withPhotos);
  }
  useEffect(() => { void load().catch(() => setAssets([])); }, []);
  async function pick(source: "camera" | "library") {
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage(t.assets.permission);
      return;
    }
    const picker = {
      mediaTypes: ["images"] as const,
      quality: 0.9,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    };
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync(picker)
      : await ImagePicker.launchImageLibraryAsync(picker);
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const type = asset.mimeType ?? "image/jpeg";
    if (type !== "image/png" && type !== "image/jpeg") {
      setMessage(t.errors.UNSUPPORTED_MEDIA);
      return;
    }
    setProgress(0);
    try {
      await uploadFile("assets", { uri: asset.uri, name: asset.fileName ?? (type === "image/png" ? "likeness.png" : "likeness.jpg"), type }, setProgress, { subject, caption });
      setMessage(t.assets.uploadedPending);
      await load();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : t.assets.uploadFailed);
    } finally {
      setProgress(null);
    }
  }
  return (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <Text style={styles.title}>{t.assets.title}</Text>
      <Text style={styles.body}>{t.assets.private}</Text>
      {progress !== null && <Text style={styles.body}>{fill(t.assets.uploading, { progress: Math.round(progress * 100) })}</Text>}
      {message ? <Text style={styles.body}>{message}</Text> : null}
      <TextInput style={styles.input} placeholder={t.assets.caption} value={caption} onChangeText={setCaption} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["face", "place", "object"] as const).map((item) => (
          <Pressable key={item} style={[styles.card, { flex: 1 }, subject === item ? { borderColor: "#6b3f2a" } : null]} onPress={() => setSubject(item)}>
            <Text>{t.assets[item]}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable style={styles.button} onPress={() => pick("camera")}><Text style={styles.buttonText}>{t.assets.take}</Text></Pressable>
      <Pressable style={[styles.button, styles.secondary]} onPress={() => pick("library")}><Text style={styles.buttonText}>{t.assets.library}</Text></Pressable>
      {assets.map((asset) => (
        <View key={asset.id} style={styles.card}>
          {asset.imageUrl ? <Image source={{ uri: asset.imageUrl }} style={{ width: "100%", height: 180, borderRadius: 12, marginBottom: 8 }} /> : null}
          {asset.caption ? <Text style={{ marginBottom: 4 }}>{asset.caption}</Text> : null}
          {asset.subject ? <Text style={{ color: "#645d53", marginBottom: 4 }}>{t.assets[asset.subject]}</Text> : null}
          <Text>{term(locale, "statuses", asset.moderationStatus)}</Text>
          <Text style={{ color: "#645d53", marginTop: 4 }}>{asset.duplicateFlags.length ? fill(t.assets.flagged, { kinds: asset.duplicateFlags.map((flag) => term(locale, "statuses", flag.kind)).join(", ") }) : t.assets.noFlag}</Text>
          <Pressable style={[styles.button, styles.secondary]} onPress={() => {
            const next = asset.listed === false;
            void api(`assets/${asset.id}/listing`, { method: "POST", body: JSON.stringify({ listed: next }) })
              .then(async () => {
                setMessage(next ? t.assets.relisted : t.assets.unlisted);
                await load();
              })
              .catch((caught: unknown) => setMessage(caught instanceof Error ? caught.message : t.assets.deleteFailed));
          }}><Text style={styles.buttonText}>{asset.listed === false ? t.assets.relist : t.assets.unlist}</Text></Pressable>
          <Pressable style={[styles.button, styles.secondary]} onPress={() => {
            if (confirmId !== asset.id) {
              setConfirmId(asset.id);
              setMessage(t.assets.confirmDelete);
              return;
            }
            setConfirmId(null);
            void api<{ keptForLicense?: boolean }>(`assets/${asset.id}`, { method: "DELETE" })
              .then(async (removed) => {
                setMessage(removed.keptForLicense ? t.assets.deletedLicensed : t.assets.deleted);
                await load();
              })
              .catch((caught: unknown) => setMessage(caught instanceof Error ? caught.message : t.assets.deleteFailed));
          }}><Text style={styles.buttonText}>{confirmId === asset.id ? t.assets.confirmDelete : t.assets.delete}</Text></Pressable>
        </View>
      ))}
    </ScrollView>
  );
}
