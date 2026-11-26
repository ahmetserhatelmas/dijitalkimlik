export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("accept-language") && typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|; )suret_locale=([^;]+)/);
    headers.set("accept-language", match?.[1] === "en" ? "en" : "tr");
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(`/api/backend/${path.replace(/^\//, "")}`, {
    ...init,
    headers,
    credentials: "include",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(response.status, payload.error?.code ?? "REQUEST_FAILED", payload.error?.message ?? "Request failed.", payload.error?.details ?? payload.data);
  }
  return payload.data as T;
}

export const apiBase = process.env.API_PUBLIC_URL ?? "http://localhost:4000";
