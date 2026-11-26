import { PageIntro, SiteFooter, SiteHeader } from "@/components/shell";
import { getCopy } from "@/lib/locale-server";

export default async function HowItWorksPage() {
  const t = await getCopy();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <PageIntro eyebrow={t.how.eyebrow} title={t.how.title} lede={t.how.lede} />
        <ol className="mt-10 space-y-6 text-muted">
          {t.how.items.map(([title, body]) => (
            <li key={title}><strong className="text-ink">{title}</strong> {body}</li>
          ))}
        </ol>
      </main>
      <SiteFooter />
    </>
  );
}
