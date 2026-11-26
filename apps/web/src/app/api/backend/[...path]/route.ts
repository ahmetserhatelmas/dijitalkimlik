import { cookies } from "next/headers";

const methods = ["GET", "POST", "PATCH", "PUT", "DELETE"] as const;

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const token = (await cookies()).get("suret_token")?.value;
  const incoming = new URL(request.url);
  const target = `${process.env.API_PUBLIC_URL ?? "http://localhost:4000"}/api/v1/${path.join("/")}${incoming.search}`;
  const headers = new Headers();
  if (token) headers.set("authorization", `Bearer ${token}`);
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const idempotency = request.headers.get("idempotency-key");
  if (idempotency) headers.set("idempotency-key", idempotency);
  const body = request.method === "GET" || request.method === "HEAD" ? undefined : await request.arrayBuffer();
  const response = await fetch(target, { method: request.method, headers, body, cache: "no-store" });
  return new Response(response.body, {
    status: response.status,
    headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;

void methods;
