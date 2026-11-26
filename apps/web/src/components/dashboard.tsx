"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useCopy } from "@/lib/locale";

type Session = { profile: { id: string; displayName: string; email: string; emailVerified: boolean }; roles: string[] };

function navigation(t: ReturnType<typeof useCopy>) {
  return {
    owner: [
      ["/owner", t.dash.overview],
      ["/owner/profile", t.dash.profile],
      ["/owner/assets", t.dash.photos],
      ["/owner/rules", t.dash.rules],
      ["/owner/requests", t.dash.requests],
      ["/owner/licenses", t.dash.sales],
    ],
    producer: [
      ["/producer", t.dash.profile],
      ["/marketplace", t.nav.marketplace],
      ["/producer/requests", t.dash.requests],
      ["/producer/licenses", t.dash.purchases],
    ],
    agency: [["/agency", t.dash.agency]],
    admin: [["/admin", t.dash.admin]],
  };
}

export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    api<Session>("me").then(setSession).catch(() => setSession(null));
  }, []);
  return session;
}

export function Dashboard({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const router = useRouter();
  const t = useCopy();
  const nav = navigation(t);
  if (session === undefined) return <p className="p-8 text-muted">{t.dash.loading}</p>;
  if (session === null) {
    return <p className="p-8">{t.dash.signInPrompt} <Link className="underline" href="/login">{t.dash.goSignIn}</Link></p>;
  }
  const items = [
    ...(session.roles.includes("face_owner") ? nav.owner : []),
    ...(session.roles.includes("producer") ? nav.producer : []),
    ...(session.roles.includes("agency_member") ? nav.agency : []),
    ...(session.roles.includes("admin") ? nav.admin : []),
  ];
  return (
    <div className="mx-auto grid min-h-screen max-w-6xl gap-8 px-5 py-8 md:grid-cols-[240px_1fr]">
      <aside className="h-fit rounded-3xl border border-line bg-white p-5">
        <Link href="/" className="text-xl font-semibold">Dijital Kimlik</Link>
        <p className="mt-4 text-sm font-medium">{session.profile.displayName}</p>
        <p className="text-xs text-muted">{session.profile.email}</p>
        {!session.profile.emailVerified && <Link href="/verify-email" className="mt-2 block text-xs text-accent">{t.dash.verifyEmail}</Link>}
        <nav aria-label="Account" className="mt-6 flex flex-col gap-1 text-sm">
          {items.map(([href, label]) => (
            <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={`rounded-xl px-3 py-2.5 ${pathname === href ? "bg-accent text-white" : "hover:bg-canvas-deep"}`}>{label}</Link>
          ))}
        </nav>
        <button
          className="mt-6 text-sm text-muted"
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            router.push("/");
          }}
        >{t.dash.signOut}</button>
      </aside>
      <main>{children}</main>
    </div>
  );
}

export function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5">
      <h2 className="text-2xl">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function StatusPill({ value }: { value: string }) {
  const t = useCopy();
  const label = (t.statuses as Record<string, string>)[value] ?? value.replaceAll("_", " ");
  return <span className="rounded-full bg-canvas-deep px-2.5 py-1 text-xs font-semibold uppercase tracking-wide">{label}</span>;
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-teal-soft px-4 py-3 text-sm text-teal" role="status">{children}</p>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-danger" role="alert">{children}</p>;
}
