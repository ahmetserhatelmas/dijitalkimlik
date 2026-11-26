import { formatMinor, term, type Appearance, type Currency, type Place } from "@suret/shared";
import { CastGrid } from "@/components/cast-grid";
import { PageIntro, SiteFooter, SiteHeader } from "@/components/shell";
import { apiOrigin } from "@/lib/api";
import { getCopy, getLocale } from "@/lib/locale-server";

type Card = {
  assetId: string;
  displayName: string;
  caption: string;
  subject: "face" | "place" | "object";
  imageUrl: string | null;
  appearance: Appearance | null;
  place: Place | null;
  permittedCategories: string[];
  commercial: { pricingMode: string; currency: Currency; basePriceMinor: number | null };
};

export const dynamic = "force-dynamic";

function priceLabel(card: Card, negotiable: string, locale: "tr" | "en"): string {
  if (card.commercial.pricingMode === "fixed" && card.commercial.basePriceMinor !== null) {
    return formatMinor(card.commercial.basePriceMinor, card.commercial.currency);
  }
  if (card.commercial.pricingMode === "negotiable") return negotiable;
  return term(locale, "pricingModes", card.commercial.pricingMode);
}

export default async function MarketplacePage() {
  const t = await getCopy();
  const locale = await getLocale();
  let cards: Card[] = [];
  let unavailable = false;
  try {
    const response = await fetch(`${apiOrigin()}/api/v1/marketplace/faces`, { cache: "no-store" });
    if (!response.ok) unavailable = true;
    else cards = (await response.json()).data;
  } catch {
    unavailable = true;
  }
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-5 py-16">
        <PageIntro eyebrow={t.marketplace.eyebrow} title={t.marketplace.title} lede={t.marketplace.lede} />
        {unavailable && <p className="mt-8 text-muted">{t.marketplace.unavailable}</p>}
        {!unavailable && cards.length === 0 && <p className="mt-8 text-muted">{t.marketplace.empty}</p>}
        {cards.length > 0 && (
          <CastGrid
            cards={cards.map((card) => ({
              assetId: card.assetId,
              displayName: card.displayName,
              caption: card.caption,
              imageUrl: card.imageUrl,
              appearance: card.appearance,
              place: card.place,
              price: priceLabel(card, t.marketplace.negotiable, locale),
            }))}
            labels={t.appearance as Record<string, string> & typeof t.appearance}
            placeLabels={{ country: t.profile.country, province: t.profile.province }}
            noMatch={t.marketplace.noMatch}
          />
        )}
      </main>
      <SiteFooter />
    </>
  );
}
