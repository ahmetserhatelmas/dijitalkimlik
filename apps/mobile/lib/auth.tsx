import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { ApiError, api, clearToken, getToken, setToken } from "@/lib/api";

type Status = "loading" | "in" | "out";

const AuthContext = createContext<{
  status: Status;
  enter: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}>({
  status: "loading",
  enter: async () => undefined,
  signOut: async () => undefined,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>("loading");

  const set = useCallback((next: Status) => {
    setStatus(next);
  }, []);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    getToken().then(async (token) => {
      if (!active) return;
      if (!token) {
        set("out");
        return;
      }
      try {
        await api("me", { signal: controller.signal });
        if (active) set("in");
      } catch (caught) {
        if (caught instanceof ApiError && (caught.status === 401 || caught.code === "INVALID_TOKEN")) {
          await clearToken();
        }
        if (active) set("out");
      }
    }).catch(() => {
      if (active) set("out");
    }).finally(() => clearTimeout(timer));
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [set]);

  const enter = useCallback(async (token: string) => {
    await setToken(token);
    set("in");
  }, [set]);

  const signOut = useCallback(async () => {
    await clearToken();
    set("out");
  }, [set]);

  return <AuthContext.Provider value={{ status, enter, signOut }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
