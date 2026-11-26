"use client";

import Link from "next/link";
import { useSession } from "@/components/dashboard";
import { LanguageSwitch, useCopy } from "@/lib/locale";

function accountPath(roles: string[]): string {
  if (roles.includes("producer")) return "/producer";
  if (roles.includes("admin")) return "/admin";
  if (roles.includes("agency_member")) return "/agency";
  return "/owner";
}

export function SiteHeader() {
  const t = useCopy();
  const session = useSession();
  const producer = session?.roles.includes("producer");
  const actor = session?.roles.includes("face_owner") && !producer;
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link href={session ? accountPath(session.roles) : "/"} className="text-xl font-semibold tracking-tight text-ink">Dijital Kimlik</Link>
        <nav aria-label="Primary" className="flex items-center gap-2 text-sm">
          <Link href="/marketplace" className="hidden rounded-full px-3 py-2 text-muted hover:text-ink sm:inline">{t.nav.marketplace}</Link>
          {producer && <Link href="/producer/requests" className="hidden rounded-full px-3 py-2 text-muted hover:text-ink md:inline">{t.dash.requests}</Link>}
          {producer && <Link href="/producer" className="hidden rounded-full px-3 py-2 text-muted hover:text-ink md:inline">{t.dash.purchases}</Link>}
          {actor && <Link href="/owner" className="hidden rounded-full px-3 py-2 text-muted hover:text-ink md:inline">{t.dash.profile}</Link>}
          <LanguageSwitch />
          {session ? (
            <Link href={accountPath(session.roles)} className="rounded-full bg-accent px-4 py-2 font-medium text-white hover:bg-accent-deep">{session.profile.displayName}</Link>
          ) : session === null ? (
            <>
              <Link href="/login?role=face_owner" className="rounded-full border border-line px-4 py-2 font-medium text-ink hover:border-accent hover:text-accent">{t.auth.actorEntry}</Link>
              <Link href="/login?role=producer" className="rounded-full bg-accent px-4 py-2 font-medium text-white hover:bg-accent-deep">{t.auth.producerEntry}</Link>
            </>
          ) : null}
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const t = useCopy();
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-base font-semibold text-ink">Dijital Kimlik</p>
          <p className="mt-1 max-w-md">{t.footer.blurb}</p>
        </div>
        <div className="flex gap-4">
          <Link href="/marketplace">{t.nav.marketplace}</Link>
          <Link href="/support">{t.nav.support}</Link>
        </div>
      </div>
    </footer>
  );
}

export function PageIntro({ eyebrow, title, lede }: { eyebrow: string; title: string; lede: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-sm font-semibold text-accent">{eyebrow}</p>
      <h1 className="mt-2 text-4xl leading-tight md:text-5xl">{title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-muted">{lede}</p>
    </div>
  );
}
