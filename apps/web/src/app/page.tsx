import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/shell";
import { getCopy } from "@/lib/locale-server";

export default async function HomePage() {
  const t = await getCopy();
  return (
    <>
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-5 pb-8 pt-16 md:pt-24">
          <p className="text-sm font-semibold text-accent">{t.home.eyebrow}</p>
          <h1 className="mt-3 max-w-3xl text-5xl leading-[1.05] md:text-6xl">{t.home.title}</h1>
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">{t.home.lede}</p>
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-5 md:grid-cols-2">
          <Link href="/login?role=face_owner" className="rounded-3xl border border-line bg-white p-8 shadow-sm transition hover:border-accent">
            <p className="text-sm font-semibold text-accent">{t.home.actorCta}</p>
            <h2 className="mt-3 text-3xl">{t.auth.actorEntry}</h2>
            <p className="mt-3 max-w-md leading-relaxed text-muted">{t.home.actorBody}</p>
          </Link>
          <Link href="/login?role=producer" className="rounded-3xl bg-accent p-8 text-white shadow-sm transition hover:bg-accent-deep">
            <p className="text-sm font-semibold text-white/80">{t.home.producerCta}</p>
            <h2 className="mt-3 text-3xl">{t.auth.producerEntry}</h2>
            <p className="mt-3 max-w-md leading-relaxed text-white/85">{t.home.producerBody}</p>
          </Link>
        </section>
        <section className="mx-auto grid max-w-6xl gap-4 px-5 py-16 md:grid-cols-3">
          {t.home.steps.map(([title, body], index) => (
            <article key={title} className="rounded-3xl bg-canvas-deep p-6">
              <p className="text-sm font-semibold text-accent">0{index + 1}</p>
              <h2 className="mt-3 text-2xl">{title}</h2>
              <p className="mt-2 leading-relaxed text-muted">{body}</p>
            </article>
          ))}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
