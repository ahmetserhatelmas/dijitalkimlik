import { assertPublishable, blankRules, fill, SUGGESTED_CHANNELS, SUGGESTED_TERRITORIES, term, USAGE_CATEGORIES, violationText, type LicensingRules, type RuleViolation } from "@suret/shared";
import { useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { ApiError, api, apiUrl } from "@/lib/api";
import { useCopy, useLocale } from "@/lib/i18n";
import { colors, styles } from "@/lib/theme";

type RuleRow = { ruleSet: { id: string; assetId: string | null }; version: { rules: LicensingRules } | null };
type Photo = { id: string; caption: string; imageUrl: string | null };

function reachable(url: string): string {
  try {
    const parsed = new URL(url);
    return `${apiUrl}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function RulesScreen() {
  const t = useCopy();
  const locale = useLocale();
  const [rules, setRules] = useState<LicensingRules>(blankRules());
  const [ruleSetId, setRuleSetId] = useState<string | null>(null);
  const [profileId, setProfileId] = useState("");
  const [message, setMessage] = useState("");
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [rows, setRows] = useState<RuleRow[]>([]);
  const [selected, setSelected] = useState<string>("general");
  const scrollRef = useRef<ScrollView>(null);

  function showSet(assetKey: string, loaded: RuleRow[]) {
    const own = loaded.find((row) => (row.ruleSet.assetId ?? "general") === assetKey);
    const general = loaded.find((row) => !row.ruleSet.assetId);
    if (own?.version) {
      setRules(structuredClone(own.version.rules));
      setRuleSetId(own.ruleSet.id);
      return;
    }
    setRules(structuredClone(general?.version?.rules ?? blankRules()));
    setRuleSetId(null);
  }

  function show(text: string) {
    setMessage(text);
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }

  useEffect(() => {
    api<{ profile: { id: string } }>("me").then(async (me) => {
      setProfileId(me.profile.id);
      const [loaded, assets] = await Promise.all([
        api<RuleRow[]>(`profiles/${me.profile.id}/rule-sets`),
        api<Array<{ id: string; caption: string }>>("assets"),
      ]);
      const withPhotos = await Promise.all(assets.map(async (asset) => {
        try {
          const signed = await api<{ url: string }>(`assets/${asset.id}/signed-url`, { method: "POST", body: JSON.stringify({ purpose: "preview" }) });
          return { ...asset, imageUrl: reachable(signed.url) };
        } catch {
          return { ...asset, imageUrl: null };
        }
      }));
      setRows(loaded);
      setPhotos(withPhotos);
      showSet("general", loaded);
    }).catch(() => undefined);
  }, []);

  function explain(caught: unknown): string {
    if (caught instanceof ApiError && Array.isArray(caught.details)) {
      const lines = caught.details.filter((item): item is RuleViolation => Boolean(item) && typeof item === "object" && "code" in item).map((item) => violationText(locale, item));
      if (lines.length) return lines.join("\n");
    }
    return caught instanceof Error ? caught.message : t.rules.publish;
  }

  const photo = photos.find((item) => item.id === selected);
  const editingName = selected === "general" ? t.rules.general : (photo?.caption || t.assets.photograph);
  const hasOwn = selected !== "general" && rows.some((row) => row.ruleSet.assetId === selected);

  function choose(key: string) {
    setSelected(key);
    setMessage("");
    showSet(key, rows);
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.scroll, { paddingBottom: 160 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets>
        <Text style={styles.title}>{t.rules.mobileTitle}</Text>
        <Text style={styles.body}>{t.rules.mobileLede}</Text>

        <Text style={section}>{t.rules.whichPhoto}</Text>
        <Pressable style={StyleSheet.flatten([choice, selected === "general" && choiceOn])} onPress={() => choose("general")}>
          <Text style={StyleSheet.flatten([choiceText, selected === "general" && choiceTextOn])}>{t.rules.general}</Text>
        </Pressable>
        {photos.map((item) => {
          const on = selected === item.id;
          const own = rows.some((row) => row.ruleSet.assetId === item.id);
          return (
            <Pressable key={item.id} style={StyleSheet.flatten([choice, on && choiceOn])} onPress={() => choose(item.id)}>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={thumb} /> : <View style={thumb} />}
              <View style={{ flex: 1 }}>
                <Text style={StyleSheet.flatten([choiceText, on && choiceTextOn])}>{item.caption || t.assets.photograph}</Text>
                {own ? <Text style={StyleSheet.flatten([hint, on && choiceTextOn])}>{t.rules.hasOwn}</Text> : null}
              </View>
            </Pressable>
          );
        })}

        <Text style={styles.body}>{fill(t.rules.nowEditing, { name: editingName })}</Text>
        {selected !== "general" && !hasOwn ? <Text style={styles.body}>{t.rules.copied}</Text> : null}
        {selected !== "general" ? <Text style={styles.body}>{t.rules.photoNote}</Text> : null}

        <Text style={section}>{t.rules.uses}</Text>
        {USAGE_CATEGORIES.map((category) => (
          <View key={category} style={row}>
            <Text style={rowLabel}>{term(locale, "categories", category)}</Text>
            <Switch
              value={rules.permitted.categories.includes(category)}
              onValueChange={() => setRules((current) => ({
                ...current,
                permitted: { ...current.permitted, categories: toggle(current.permitted.categories, category) },
              }))}
            />
          </View>
        ))}

        <View style={row}>
          <Text style={rowLabel}>{t.rules.modelTraining}</Text>
          <Switch value={rules.permitted.ai.modelTraining} onValueChange={(value) => setRules((current) => ({ ...current, permitted: { ...current.permitted, ai: { ...current.permitted.ai, modelTraining: value } } }))} />
        </View>

        <Text style={section}>{t.rules.where}</Text>
        <Text style={hint}>{t.rules.channelLabel}</Text>
        <View style={wrap}>
          {SUGGESTED_CHANNELS.map((channel) => {
            const on = rules.permitted.distributionChannels.includes(channel);
            return (
              <Pressable key={channel} style={StyleSheet.flatten([pill, on && pillOn])} onPress={() => setRules((current) => ({ ...current, permitted: { ...current.permitted, distributionChannels: toggle(current.permitted.distributionChannels, channel) } }))}>
                <Text style={StyleSheet.flatten([pillText, on && choiceTextOn])}>{term(locale, "channels", channel)}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={hint}>{t.rules.territories}</Text>
        <View style={wrap}>
          {SUGGESTED_TERRITORIES.map((territory) => {
            const on = rules.permitted.territories.includes(territory);
            return (
              <Pressable key={territory} style={StyleSheet.flatten([pill, on && pillOn])} onPress={() => setRules((current) => ({ ...current, permitted: { ...current.permitted, territories: toggle(current.permitted.territories, territory) } }))}>
                <Text style={StyleSheet.flatten([pillText, on && choiceTextOn])}>{term(locale, "territories", territory)}</Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable style={styles.button} onPress={async () => {
          const missing = assertPublishable(rules);
          if (missing.length) {
            show(missing.map((item) => violationText(locale, item)).join("\n"));
            return;
          }
          try {
            const assetId = selected === "general" ? null : selected;
            const payload = { name: t.rules.name, rules, publish: true, ...(assetId ? { assetId } : {}) };
            if (ruleSetId) {
              await api(`rule-sets/${ruleSetId}`, { method: "PATCH", body: JSON.stringify(payload) });
              setRows((current) => current.map((row) => row.ruleSet.id === ruleSetId ? { ...row, version: { rules } } : row));
            } else {
              const created = await api<{ ruleSet: { id: string; assetId: string | null } }>(`profiles/${profileId}/rule-sets`, { method: "POST", body: JSON.stringify(payload) });
              setRuleSetId(created.ruleSet.id);
              setRows((current) => [...current.filter((row) => row.ruleSet.id !== created.ruleSet.id), { ruleSet: created.ruleSet, version: { rules } }]);
            }
            show(t.rules.published);
          } catch (caught) {
            show(explain(caught));
          }
        }}><Text style={styles.buttonText}>{selected === "general" ? t.rules.publishGeneral : t.rules.publishThis}</Text></Pressable>
        {message ? <Text style={message === t.rules.published ? styles.body : styles.error}>{message}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const section = { fontSize: 18, fontWeight: "700" as const, color: colors.ink, marginTop: 8, marginBottom: 10 };
const choice = { backgroundColor: colors.card, borderRadius: 16, padding: 12, marginBottom: 8, flexDirection: "row" as const, alignItems: "center" as const, gap: 12 };
const choiceOn = { backgroundColor: colors.ink };
const choiceText = { color: colors.ink, fontSize: 16, fontWeight: "700" as const };
const choiceTextOn = { color: "#fff" };
const hint = { color: colors.muted, fontSize: 13, marginBottom: 8 };
const thumb = { width: 56, height: 56, borderRadius: 12, backgroundColor: "#e7dfd4" };
const row = { backgroundColor: colors.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: 12 };
const rowLabel = { flex: 1, color: colors.ink, fontSize: 16 };
const wrap = { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 8, marginBottom: 14 };
const pill = { backgroundColor: colors.card, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10 };
const pillOn = { backgroundColor: colors.ink };
const pillText = { color: colors.ink, fontSize: 14, fontWeight: "600" as const };
