import { notFound } from "next/navigation";
import { formatMinor, term, type Appearance, type Currency } from "@suret/shared";
import { DiscoverRequest } from "@/components/workspace";
import { SiteFooter, SiteHeader } from "@/components/shell";
import { apiBase } from "@/lib/api";
import { getCopy, getLocale } from "@/lib/locale-server";

export const dynamic = "force-dynamic";

type Card = {
  assetId: string;
  displayName: string;
  caption: string;
  subject: "face" | "place" | "object";
  imageUrl: string | null;
  appearance: Appearance | null;
  permittedCategories: string[];
  prohibitedCategories: string[];
  customProhibitions: string[];
  channels: string[];
  territories: string[];
  ai: Record<string, boolean>;
  allowDownloadOriginal: boolean;
  commercial: { pricingMode: string; currency: Currency; basePriceMinor: number | null };
};

export default async function FacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const response = await fetch(`${apiBase}/api/v1/marketplace/faces/${id}`, { cache: "no-store" }).catch(() => null);
  if (!response || response.status === 404 || !response.ok) notFound();
  const card = (await response.json()).data as Card;
  const t = await getCopy();
  const locale = await getLocale();
  const price = card.commercial.pricingMode === "fixed" && card.commercial.basePriceMinor !== null
    ? formatMinor(card.commercial.basePriceMinor, card.commercial.currency)
    : card.commercial.pricingMode === "negotiable"
      ? t.marketplace.negotiable
      : term(locale, "pricingModes", card.commercial.pricingMode);
  const prohibitions = [
    ...card.prohibitedCategories.map((item) => term(locale, "prohibitions", item)),
    ...card.customProhibitions,
  ];
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid gap-8 md:grid-cols-[1.1fr_0.9fr]">
          {card.imageUrl ? (
            <img src={card.imageUrl} alt={card.caption || card.displayName} className="min-h-80 w-full rounded-3xl object-cover" />
          ) : (
            <div className="flex min-h-80 items-end rounded-3xl bg-teal p-8 text-white">
              <h1 className="text-5xl">{card.displayName}</h1>
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-accent">{t.marketplace.subjects[card.subject]}</p>
            <h1 className="mt-2 text-5xl">{card.displayName}</h1>
            <TraitLine appearance={card.appearance} labels={t.appearance as { [key: string]: string }} />
            <p className="mt-4 text-lg text-muted">{card.caption}</p>
            <p className="mt-6 text-sm text-muted">{t.marketplace.price}</p>
            <p className="mt-1 text-4xl font-semibold text-accent">{price}</p>
            <div className="mt-8">
              <h2 className="text-2xl">{t.marketplace.requestTitle}</h2>
              <p className="mt-2 text-sm text-muted">{t.marketplace.requestLede}</p>
              <div className="mt-4">
                <DiscoverRequest assetId={card.assetId} channels={card.channels} territories={card.territories} categories={card.permittedCategories} suggestedAmount={card.commercial.basePriceMinor != null ? String(card.commercial.basePriceMinor / 100) : ""} />
              </div>
            </div>
          </div>
        </div>
        <div className="mt-12 grid gap-8 md:grid-cols-2">
          <section>
            <h2 className="text-2xl">{t.face.permitted}</h2>
            <p className="mt-2 text-muted">{card.permittedCategories.map((item) => term(locale, "categories", item)).join(", ") || t.face.none}</p>
            <h2 className="mt-6 text-2xl">{t.marketplace.channels}</h2>
            <p className="mt-2 text-muted">{card.channels.map((item) => term(locale, "channels", item)).join(", ") || t.face.none}</p>
            <h2 className="mt-6 text-2xl">{t.marketplace.territories}</h2>
            <p className="mt-2 text-muted">{card.territories.map((item) => term(locale, "territories", item)).join(", ") || t.face.none}</p>
          </section>
          <section>
            <h2 className="text-2xl">{t.face.prohibited}</h2>
            <p className="mt-2 text-muted">{prohibitions.join(", ") || t.face.none}</p>
            <h2 className="mt-6 text-2xl">{t.face.ai}</h2>
            <ul className="mt-2 text-sm text-muted">
              {Object.entries(card.ai).map(([key, allowed]) => (
                <li key={key}>{term(locale, "ai", key)}: {allowed ? t.face.permittedValue : t.face.notPermitted}</li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

function TraitLine({ appearance, labels }: { appearance: Appearance | null; labels: { [key: string]: string } }) {
  if (!appearance) return null;
  const parts = [appearance.gender, appearance.ageRange, appearance.heightRange, appearance.hairColor, appearance.eyeColor]
    .flatMap((item) => (item ? [labels[item] ?? item] : []));
  if (parts.length === 0) return null;
  return <p className="mt-3 text-sm text-muted">{parts.join(" · ")}</p>;
}
