import { cookies } from "next/headers";
import { apiOrigin } from "@/lib/api";

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
  } catch {
    return Response.json({ error: { code: "API_UNREACHABLE", message: "API'ye ulaşılamadı. Biraz sonra tekrar dene." } }, { status: 502 });
  }
  const payload = await response.json().catch(() => null);
  if (!payload) {
    return Response.json({ error: { code: "API_UNREACHABLE", message: "API yanıt vermedi. Biraz sonra tekrar dene." } }, { status: 502 });
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
