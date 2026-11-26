import { StyleSheet } from "react-native";

export const colors = {
  canvas: "#f6f1e8",
  card: "#ffffff",
  ink: "#161411",
  muted: "#6d645b",
  line: "#e4d9cc",
  accent: "#161411",
  teal: "#c4552a",
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.canvas, padding: 22 },
  scroll: { backgroundColor: colors.canvas, padding: 22, paddingBottom: 64, flexGrow: 1 },
  title: { fontSize: 34, fontWeight: "700", color: colors.ink, marginBottom: 8, letterSpacing: -0.6 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 23, marginBottom: 18 },
  input: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    fontSize: 16,
    color: colors.ink,
    minHeight: 54,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 10,
    minHeight: 56,
  },
  buttonText: { color: "white", fontWeight: "700", fontSize: 16 },
  secondary: { backgroundColor: colors.teal },
  card: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    marginBottom: 12,
    fontSize: 16,
    color: colors.ink,
  },
  error: { color: "#9f1239", marginBottom: 10, fontSize: 15 },
  link: { color: colors.teal, fontWeight: "700", fontSize: 15, marginTop: 18, textAlign: "center" },
});
