import { cookies } from "next/headers";

export async function POST() {
  (await cookies()).delete("suret_token");
  return Response.json({ data: { ok: true } });
}
