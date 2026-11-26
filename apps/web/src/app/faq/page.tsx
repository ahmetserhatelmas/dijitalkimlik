import { PageIntro, SiteFooter, SiteHeader } from "@/components/shell";
import { getCopy } from "@/lib/locale-server";

export default async function FaqPage() {
  const t = await getCopy();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <PageIntro eyebrow={t.faq.eyebrow} title={t.faq.title} lede={t.faq.lede} />
        <div className="mt-10 space-y-6">
          {t.faq.items.map(([question, answer]) => (
            <article key={question}>
              <h2 className="text-2xl">{question}</h2>
              <p className="mt-2 text-muted">{answer}</p>
            </article>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
