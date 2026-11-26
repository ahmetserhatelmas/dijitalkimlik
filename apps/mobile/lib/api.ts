import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";

const TOKEN = "suret_token";
const tokenOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK };

function devApiUrl(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(":")[0];
  if (!host || host === "localhost" || host === "127.0.0.1") return null;
  return `http://${host}:4000`;
}

export const apiUrl = devApiUrl() ?? process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:4000";

export async function getToken(): Promise<string | null> {
  const saved = await SecureStore.getItemAsync(TOKEN, tokenOptions);
  if (saved) return saved;
  const older = await SecureStore.getItemAsync(TOKEN);
  if (!older) return null;
  await SecureStore.setItemAsync(TOKEN, older, tokenOptions);
  return older;
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN, token, tokenOptions);
}

export async function clearToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN, tokenOptions);
  await SecureStore.deleteItemAsync(TOKEN).catch(() => undefined);
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "REQUEST_FAILED", public details: unknown = null) {
    super(message);
  }
}

async function localeHeader(): Promise<string> {
  const value = await SecureStore.getItemAsync("suret_locale");
  return value === "en" ? "en" : "tr";
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers = new Headers(init.headers);
  headers.set("accept-language", await localeHeader());
  const route = path.replace(/^\//, "");
  const signingIn = route === "auth/login" || route === "auth/register";
  if (token && !signingIn) headers.set("authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) headers.set("content-type", "application/json");
  const response = await fetch(`${apiUrl}/api/v1/${path.replace(/^\//, "")}`, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, payload.error?.message ?? "Request failed.", payload.error?.code ?? "REQUEST_FAILED", payload.error?.details ?? null);
  return payload.data as T;
}

export function uploadFile(path: string, file: { uri: string; name: string; type: string }, onProgress: (ratio: number) => void, fields: Record<string, string> = {}): Promise<unknown> {
  return Promise.all([getToken(), localeHeader()]).then(([token, locale]) => new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("file", { uri: file.uri, name: file.name, type: file.type } as unknown as Blob);
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${apiUrl}/api/v1/${path}`);
    xhr.setRequestHeader("accept-language", locale);
    if (token) xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      const payload = JSON.parse(xhr.responseText || "{}");
      if (xhr.status >= 400) reject(new ApiError(xhr.status, payload.error?.message ?? "Upload failed."));
      else resolve(payload.data);
    };
    xhr.onerror = () => reject(new Error("Upload failed."));
    xhr.send(form);
  }));
}
