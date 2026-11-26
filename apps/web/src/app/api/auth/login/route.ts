import { cookies } from "next/headers";
import { apiOrigin } from "@/lib/api";

export async function POST(request: Request) {
  const body = await request.text();
  const response = await fetch(`${apiOrigin()}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
  const payload = await response.json();
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
