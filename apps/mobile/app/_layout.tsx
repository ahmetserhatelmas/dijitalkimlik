import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Text, View } from "react-native";
import { AuthProvider, useAuth } from "@/lib/auth";
import { LocaleProvider, useCopy } from "@/lib/i18n";
import { colors, styles } from "@/lib/theme";

function Routes() {
  const t = useCopy();
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const root = segments[0];
  const header = {
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.canvas },
    headerTintColor: colors.ink,
    headerTitleStyle: { fontWeight: "700" as const, color: colors.ink },
    contentStyle: { backgroundColor: colors.canvas },
  };

  useEffect(() => {
    if (status === "loading" || !root) return;
    const publicRoute = root === "index" || root === "login" || root === "register";
    if (status === "out" && !publicRoute) router.replace("/");
    if (status === "in" && root === "index") router.replace("/home");
  }, [status, root, router]);

  return (
    <View style={{ flex: 1 }}>
      <Stack screenOptions={header}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: t.auth.signIn }} />
        <Stack.Screen name="register" options={{ title: t.auth.create }} />
        <Stack.Screen name="verify-email" options={{ title: t.email.title }} />
        <Stack.Screen name="home" options={{ title: t.dash.overview }} />
        <Stack.Screen name="profile" options={{ title: t.dash.profile }} />
        <Stack.Screen name="assets" options={{ title: t.dash.photos }} />
        <Stack.Screen name="rules" options={{ title: t.dash.rules }} />
        <Stack.Screen name="requests" options={{ title: t.dash.requests }} />
        <Stack.Screen name="licenses" options={{ title: t.dash.licenses }} />
        <Stack.Screen name="notifications" options={{ title: t.notifications.title }} />
        <Stack.Screen name="report" options={{ title: t.dash.reports }} />
        <Stack.Screen name="agreements/[id]" options={{ title: t.requests.agreements }} />
      </Stack>
      {status === "loading" ? (
        <View style={[styles.screen, { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }]}>
          <Text style={styles.body}>{t.common.loading}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <LocaleProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Routes />
      </AuthProvider>
    </LocaleProvider>
  );
}
