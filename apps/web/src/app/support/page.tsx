import { PageIntro, SiteFooter, SiteHeader } from "@/components/shell";
import { getCopy } from "@/lib/locale-server";

export default async function SupportPage() {
  const t = await getCopy();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-5 py-16">
        <PageIntro eyebrow={t.support.eyebrow} title={t.support.title} lede={t.support.lede} />
        <p className="mt-8 text-muted">{t.support.body}</p>
      </main>
      <SiteFooter />
    </>
  );
}
