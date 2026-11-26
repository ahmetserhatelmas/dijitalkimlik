import { cookies } from "next/headers";
import { apiOrigin } from "@/lib/api";

function safeHost(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return "invalid";
  }
}

function parseJson(raw: string): { data?: { accessToken?: string; profile?: unknown; roles?: string[] }; error?: { message?: string } } | null {
  try {
    return JSON.parse(raw) as { data?: { accessToken?: string; profile?: unknown; roles?: string[] }; error?: { message?: string } };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const body = await request.text();
  const origin = apiOrigin();
  let response: Response;
  try {
    response = await fetch(`${origin}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  } catch (error) {
    const host = safeHost(origin);
    const reason = error instanceof Error ? error.message : "fetch failed";
    return Response.json({ error: { code: "API_UNREACHABLE", message: "API'ye ulaşılamadı. Biraz sonra tekrar dene.", details: { host, reason } } }, { status: 502 });
  }
  const raw = await response.text();
  const payload = parseJson(raw);
  if (!payload) {
    return Response.json({
      error: {
        code: "API_UNREACHABLE",
        message: "API yanıt vermedi. Biraz sonra tekrar dene.",
        details: { host: safeHost(origin), status: response.status, body: raw.slice(0, 300) },
      },
    }, { status: 502 });
  }
  if (!response.ok) return Response.json(payload, { status: response.status });
  (await cookies()).set("suret_token", payload.data.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return Response.json({ data: { profile: payload.data.profile, roles: payload.data.roles } });
}
