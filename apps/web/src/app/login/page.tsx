"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { SiteHeader } from "@/components/shell";
import { ErrorText } from "@/components/dashboard";
import { useCopy } from "@/lib/locale";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const role = params.get("role") === "producer" ? "producer" : "face_owner";
  const t = useCopy();
  const [error, setError] = useState("");
  const actor = role === "face_owner";
  return (
    <>
      <SiteHeader />
      <main className="mx-auto grid max-w-5xl gap-10 px-5 py-16 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold text-accent">{actor ? t.auth.actorEntry : t.auth.producerEntry}</p>
          <h1 className="mt-2 text-4xl">{actor ? t.auth.actorEntry : t.auth.producerEntry}</h1>
          <p className="mt-3 text-muted">{actor ? t.auth.actorLead : t.auth.producerLead}</p>
          <div className="mt-8 flex gap-2 text-sm">
            <Link href="/login?role=face_owner" className={`rounded-full px-4 py-2 ${actor ? "bg-accent text-white" : "border border-line"}`}>{t.auth.actorEntry}</Link>
            <Link href="/login?role=producer" className={`rounded-full px-4 py-2 ${actor ? "border border-line" : "bg-accent text-white"}`}>{t.auth.producerEntry}</Link>
          </div>
        </div>
        <form
          key={role}
          className="space-y-4 rounded-3xl border border-line bg-white p-6 shadow-sm"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const form = new FormData(event.currentTarget);
            const response = await fetch("/api/auth/login", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
            });
            const body = await response.json();
            if (!response.ok) {
              setError(body.error?.message ?? t.auth.signInFailed);
              return;
            }
            const roles: string[] = body.data.roles ?? [];
            router.push(roles.includes("admin") ? "/admin" : roles.includes("producer") ? "/marketplace" : roles.includes("agency_member") ? "/agency" : "/owner");
          }}
        >
          <label className="block text-sm font-medium">{t.auth.email}<input className="mt-1 w-full rounded-2xl border border-line px-4 py-3" name="email" type="email" required autoComplete="email" defaultValue={actor ? t.auth.demoActorEmail : t.auth.demoProducerEmail} /></label>
          <label className="block text-sm font-medium">{t.auth.password}<input className="mt-1 w-full rounded-2xl border border-line px-4 py-3" name="password" type="password" required autoComplete="current-password" defaultValue={t.auth.demoPasswordValue} /></label>
          <div className="rounded-2xl bg-canvas-deep px-4 py-3 text-sm">
            <p className="font-semibold text-accent">{t.auth.demoTitle}</p>
            <p className="mt-2">{t.auth.demoEmail}: <span className="font-medium">{actor ? t.auth.demoActorEmail : t.auth.demoProducerEmail}</span></p>
            <p>{t.auth.demoPassword}: <span className="font-medium">{t.auth.demoPasswordValue}</span></p>
            <p className="mt-2 text-muted">{actor ? t.auth.demoActorMore : t.auth.demoProducerMore}</p>
          </div>
          {error && <ErrorText>{error}</ErrorText>}
          <button className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-deep" type="submit">{t.auth.signIn}</button>
          <p className="text-sm"><Link href={`/register?role=${role}`} className="font-medium text-accent">{t.auth.create}</Link></p>
        </form>
      </main>
    </>
  );
}

export default function LoginPage() {
  return <Suspense><LoginForm /></Suspense>;
}
