import { PageIntro, SiteFooter, SiteHeader } from "@/components/shell";
import { getCopy } from "@/lib/locale-server";

export default async function PricingPage() {
  const t = await getCopy();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <PageIntro eyebrow={t.pricing.eyebrow} title={t.pricing.title} lede={t.pricing.lede} />
        <div className="mt-8 space-y-4 text-muted">
          {t.pricing.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
