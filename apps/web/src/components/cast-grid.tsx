"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AGE_RANGES, COUNTRIES, EYE_COLORS, GENDERS, HAIR_COLORS, HEIGHT_RANGES, formatPlace, provincesOf, type Appearance, type Place } from "@suret/shared";
import { useLocale } from "@/lib/locale";

export type CastCard = {
  assetId: string;
  displayName: string;
  caption: string;
  imageUrl: string | null;
  appearance: Appearance | null;
  place: Place | null;
  price: string;
};

type Labels = {
  gender: string;
  age: string;
  height: string;
  hair: string;
  eyes: string;
  any: string;
  [key: string]: string;
};

function labelOf(labels: { [key: string]: string }, id: string): string {
  return labels[id] ?? id;
}

export function CastGrid({ cards, labels, placeLabels, noMatch }: { cards: CastCard[]; labels: Labels; placeLabels: { country: string; province: string }; noMatch: string }) {
  const locale = useLocale();
  const [gender, setGender] = useState("");
  const [age, setAge] = useState("");
  const [height, setHeight] = useState("");
  const [hair, setHair] = useState("");
  const [eyes, setEyes] = useState("");
  const [country, setCountry] = useState("");
  const [province, setProvince] = useState("");
  const provinces = provincesOf(country);
  const shown = useMemo(() => cards.filter((card) => {
    const traits = card.appearance;
    if (gender && traits?.gender !== gender) return false;
    if (age && traits?.ageRange !== age) return false;
    if (height && traits?.heightRange !== height) return false;
    if (hair && traits?.hairColor !== hair) return false;
    if (eyes && traits?.eyeColor !== eyes) return false;
    if (country && card.place?.country !== country) return false;
    if (province && card.place?.province !== province) return false;
    return true;
  }), [cards, gender, age, height, hair, eyes, country, province]);
  return (
    <>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Filter label={labels.gender} value={gender} any={labels.any} options={GENDERS} text={labels} onChange={setGender} />
        <Filter label={labels.age} value={age} any={labels.any} options={AGE_RANGES} text={labels} onChange={setAge} />
        <Filter label={labels.height} value={height} any={labels.any} options={HEIGHT_RANGES} text={labels} onChange={setHeight} />
        <Filter label={labels.hair} value={hair} any={labels.any} options={HAIR_COLORS} text={labels} onChange={setHair} />
        <Filter label={labels.eyes} value={eyes} any={labels.any} options={EYE_COLORS} text={labels} onChange={setEyes} />
        <Filter label={placeLabels.country} value={country} any={labels.any} options={COUNTRIES.map((item) => item.code)} text={Object.fromEntries(COUNTRIES.map((item) => [item.code, item[locale]]))} onChange={(value) => { setCountry(value); if (!provincesOf(value).some((item) => item.code === province)) setProvince(""); }} />
        <Filter label={placeLabels.province} value={province} any={labels.any} options={provinces.map((item) => item.code)} text={Object.fromEntries(provinces.map((item) => [item.code, item[locale]]))} onChange={setProvince} />
      </div>
      {shown.length === 0 && <p className="mt-8 text-muted">{noMatch}</p>}
      <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((card) => (
          <Link key={card.assetId} href={`/marketplace/${card.assetId}`} className="overflow-hidden rounded-3xl border border-line bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-accent">
            {card.imageUrl ? (
              <img src={card.imageUrl} alt={card.caption || card.displayName} className="aspect-[4/5] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/5] items-end bg-canvas-deep p-5">
                <span className="text-5xl font-semibold text-accent">{card.displayName.slice(0, 1)}</span>
              </div>
            )}
            <div className="p-5">
              <h2 className="text-2xl">{card.displayName}</h2>
              {formatPlace(card.place, locale) && <p className="mt-1 text-sm text-muted">{formatPlace(card.place, locale)}</p>}
              <p className="mt-1 line-clamp-2 text-sm text-muted">{card.caption}</p>
              <TraitLine card={card} labels={labels} />
              <p className="mt-4 text-lg font-semibold text-accent">{card.price}</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}

function TraitLine({ card, labels }: { card: CastCard; labels: Labels }) {
  const traits = card.appearance;
  if (!traits) return null;
  const parts = [traits.gender, traits.ageRange, traits.heightRange, traits.hairColor, traits.eyeColor]
    .flatMap((item) => (item ? [labelOf(labels, item)] : []));
  if (parts.length === 0) return null;
  return <p className="mt-2 text-sm text-muted">{parts.join(" · ")}</p>;
}

function Filter({ label, value, any, options, text, onChange }: { label: string; value: string; any: string; options: readonly string[]; text: { [key: string]: string }; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">{label}
      <select className="mt-1 w-full rounded-xl border border-line bg-white px-3 py-2" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{any}</option>
        {options.map((id) => <option key={id} value={id}>{labelOf(text, id)}</option>)}
      </select>
    </label>
  );
}
