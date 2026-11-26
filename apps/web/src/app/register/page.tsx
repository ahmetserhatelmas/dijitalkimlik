"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { SiteHeader } from "@/components/shell";
import { ErrorText } from "@/components/dashboard";
import { useCopy } from "@/lib/locale";

function RegisterForm() {
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
          <h1 className="mt-2 text-4xl">{t.auth.create}</h1>
          <p className="mt-3 text-muted">{actor ? t.auth.actorLead : t.auth.producerLead}</p>
          <div className="mt-8 flex gap-2 text-sm">
            <Link href="/register?role=face_owner" className={`rounded-full px-4 py-2 ${actor ? "bg-accent text-white" : "border border-line"}`}>{t.auth.faceOwner}</Link>
            <Link href="/register?role=producer" className={`rounded-full px-4 py-2 ${actor ? "border border-line" : "bg-accent text-white"}`}>{t.auth.producer}</Link>
          </div>
        </div>
        <form
          className="space-y-4 rounded-3xl border border-line bg-white p-6 shadow-sm"
          onSubmit={async (event) => {
            event.preventDefault();
            setError("");
            const form = new FormData(event.currentTarget);
            const response = await fetch("/api/auth/register", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                email: form.get("email"),
                password: form.get("password"),
                displayName: form.get("displayName"),
                role,
                companyName: form.get("companyName") || undefined,
              }),
            });
            const body = await response.json();
            if (!response.ok) {
              setError(body.error?.message ?? t.auth.registerFailed);
              return;
            }
            router.push(role === "producer" ? "/marketplace" : "/owner");
          }}
        >
          <label className="block text-sm font-medium">{t.auth.name}<input className="mt-1 w-full rounded-2xl border border-line px-4 py-3" name="displayName" required minLength={2} /></label>
          <label className="block text-sm font-medium">{t.auth.email}<input className="mt-1 w-full rounded-2xl border border-line px-4 py-3" name="email" type="email" required /></label>
          <label className="block text-sm font-medium">{t.auth.password}<input className="mt-1 w-full rounded-2xl border border-line px-4 py-3" name="password" type="password" required minLength={8} /></label>
          {!actor && <label className="block text-sm font-medium">{t.auth.company}<input className="mt-1 w-full rounded-2xl border border-line px-4 py-3" name="companyName" required /></label>}
          {error && <ErrorText>{error}</ErrorText>}
          <button className="w-full rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white hover:bg-accent-deep" type="submit">{t.auth.create}</button>
          <p className="text-sm"><Link href={`/login?role=${role}`} className="font-medium text-accent">{t.auth.hasAccount}</Link></p>
        </form>
      </main>
    </>
  );
}

export default function RegisterPage() {
  return <Suspense><RegisterForm /></Suspense>;
}
