"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AGE_RANGES,
  EYE_COLORS,
  GENDERS,
  HAIR_COLORS,
  HEIGHT_RANGES,
  SUGGESTED_CHANNELS,
  SUGGESTED_PROHIBITIONS,
  USAGE_CATEGORIES,
  AI_PERMISSION_KEYS,
  COUNTRIES,
  blankAppearance,
  blankPlace,
  blankRules,
  formatPlace,
  provincesOf,
  type Place,
  type Appearance,
  fill,
  formatMinor,
  term,
  violationText,
  type LicensingRules,
} from "@suret/shared";
import { ErrorText, Notice, Panel, StatusPill, useSession } from "@/components/dashboard";
import { ApiError, api } from "@/lib/api";
import { useCopy, useLocale } from "@/lib/locale";

const field = "mt-1 w-full rounded-xl border border-line bg-white px-3 py-2";
type UsageViolation = { code: string; message: string; params?: Record<string, string | number> };

export function OwnerHome() {
  const session = useSession();
  const t = useCopy();
  if (!session) return null;
  return (
    <div className="space-y-4">
      <h1 className="text-4xl">{fill(t.owner.hello, { name: session.profile.displayName })}</h1>
      <p className="max-w-xl text-muted">{t.owner.lede}</p>
      <div className="grid gap-3 md:grid-cols-3">
        <Link className="rounded-3xl border border-line bg-white p-5 shadow-sm hover:border-accent" href="/owner/assets">{t.owner.addPhoto}</Link>
        <Link className="rounded-3xl border border-line bg-white p-5 shadow-sm hover:border-accent" href="/owner/rules">{t.owner.editRules}</Link>
        <Link className="rounded-3xl border border-line bg-white p-5 shadow-sm hover:border-accent" href="/owner/requests">{t.owner.review}</Link>
      </div>
    </div>
  );
}

export function ProfileForm() {
  const session = useSession();
  const t = useCopy();
  const locale = useLocale();
  const [message, setMessage] = useState("");
  const [appearance, setAppearance] = useState<Appearance>(blankAppearance());
  const [place, setPlace] = useState<Place>(blankPlace());
  useEffect(() => {
    api<{ profile: { appearance?: Appearance; place?: Place } }>("me")
      .then((me) => {
        setAppearance(me.profile.appearance ?? blankAppearance());
        setPlace(me.profile.place ?? blankPlace());
      })
      .catch(() => {
        setAppearance(blankAppearance());
        setPlace(blankPlace());
      });
  }, []);
  if (!session) return null;
  const actor = session.roles.includes("face_owner");
  const provinces = provincesOf(place.country);
  function choose<K extends keyof Appearance>(key: K, value: string) {
    setAppearance((current) => ({ ...current, [key]: (value || null) as Appearance[K] }));
  }
  function chooseCountry(value: string) {
    setPlace((current) => {
      const country = value || null;
      const province = provincesOf(country).some((item) => item.code === current.province) ? current.province : null;
      return { country, province };
    });
  }
  return (
    <form
      className="max-w-lg space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        await api(`profiles/${session.profile.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            displayName: form.get("displayName"),
            bio: form.get("bio"),
            place,
            ...(actor ? { appearance } : {}),
          }),
        });
        setMessage(t.profile.saved);
      }}
    >
      <h1 className="text-4xl">{t.profile.title}</h1>
      <label className="block text-sm">{t.profile.name}<input className={field} name="displayName" defaultValue={session.profile.displayName} required /></label>
      <label className="block text-sm">{t.profile.bio}<textarea className={field} name="bio" rows={4} /></label>
      <TraitSelect label={t.profile.country} value={place.country} unset={t.appearance.unset} options={COUNTRIES.map((country) => country.code)} text={(id) => COUNTRIES.find((country) => country.code === id)?.[locale] ?? id} onChange={chooseCountry} />
      <TraitSelect label={t.profile.province} value={place.province} unset={t.appearance.unset} options={provinces.map((province) => province.code)} text={(id) => provinces.find((province) => province.code === id)?.[locale] ?? id} onChange={(value) => setPlace((current) => ({ ...current, province: value || null }))} />
      {actor && (
        <fieldset className="space-y-3">
          <legend className="text-lg font-semibold">{t.appearance.title}</legend>
          <p className="text-sm text-muted">{t.appearance.lede}</p>
          <TraitSelect label={t.appearance.gender} value={appearance.gender} unset={t.appearance.unset} options={GENDERS} text={(id) => t.appearance[id]} onChange={(value) => choose("gender", value)} />
          <TraitSelect label={t.appearance.age} value={appearance.ageRange} unset={t.appearance.unset} options={AGE_RANGES} text={(id) => t.appearance[id]} onChange={(value) => choose("ageRange", value)} />
          <TraitSelect label={t.appearance.height} value={appearance.heightRange} unset={t.appearance.unset} options={HEIGHT_RANGES} text={(id) => t.appearance[id]} onChange={(value) => choose("heightRange", value)} />
          <TraitSelect label={t.appearance.hair} value={appearance.hairColor} unset={t.appearance.unset} options={HAIR_COLORS} text={(id) => t.appearance[id]} onChange={(value) => choose("hairColor", value)} />
          <TraitSelect label={t.appearance.eyes} value={appearance.eyeColor} unset={t.appearance.unset} options={EYE_COLORS} text={(id) => t.appearance[id]} onChange={(value) => choose("eyeColor", value)} />
        </fieldset>
      )}
      <button className="rounded-full bg-accent px-4 py-2 text-sm text-white" type="submit">{t.profile.save}</button>
      {message && <Notice>{message}</Notice>}
    </form>
  );
}

function TraitSelect<T extends string>({ label, value, unset, options, text, onChange }: { label: string; value: T | null; unset: string; options: readonly T[]; text: (id: T) => string; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm">{label}
      <select className={field} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
        <option value="">{unset}</option>
        {options.map((id) => <option key={id} value={id}>{text(id)}</option>)}
      </select>
    </label>
  );
}

export function AssetManager() {
  const session = useSession();
  const t = useCopy();
  const locale = useLocale();
  const [assets, setAssets] = useState<Array<Record<string, unknown>>>([]);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!pickedFile) {
      setPicked(null);
      return;
    }
    const url = URL.createObjectURL(pickedFile);
    setPicked(url);
    return () => URL.revokeObjectURL(url);
  }, [pickedFile]);
  async function load() {
    if (!session) return;
    const list = await api<Array<Record<string, unknown>>>(`assets?profileId=${session.profile.id}`);
    setAssets(list);
    const next: Record<string, string> = {};
    await Promise.all(list.map(async (asset) => {
      try {
        const signed = await api<{ url: string }>(`assets/${String(asset.id)}/signed-url`, {
          method: "POST",
          body: JSON.stringify({ purpose: "preview" }),
        });
        next[String(asset.id)] = signed.url;
      } catch {
        // A missing preview leaves the card without an image.
      }
    }));
    setPreviews(next);
  }
  useEffect(() => { if (session) void load(); }, [session]);
  if (!session) return null;
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">{t.assets.title}</h1>
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const formElement = event.currentTarget;
          setError("");
          setMessage("");
          const form = new FormData(formElement);
          form.set("profileId", session.profile.id);
          try {
            const created = await api<Record<string, unknown>>("assets", { method: "POST", body: form });
            const flags = (created.duplicateFlags as unknown[]) ?? [];
            formElement.reset();
            setPickedFile(null);
            setMessage(flags.length ? t.assets.uploadedFlagged : t.assets.uploadedPending);
            await load();
          } catch (caught) {
            setMessage("");
            setError(caught instanceof ApiError ? caught.message : t.assets.uploadFailed);
          }
        }}
      >
        <label className="block text-sm">{t.assets.subject}
          <select className={field} name="subject" defaultValue="face">
            <option value="face">{t.assets.face}</option>
            <option value="place">{t.assets.place}</option>
            <option value="object">{t.assets.object}</option>
          </select>
        </label>
        <label className="block text-sm">{t.assets.caption}<input className={field} name="caption" maxLength={500} /></label>
        <div className="block text-sm">
          <span>{t.assets.photograph}</span>
          <label className="mt-2 flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white">{t.assets.choose}</span>
            <span className="text-muted">{pickedFile?.name ?? t.assets.noneSelected}</span>
            <input
              className="sr-only"
              name="file"
              type="file"
              accept="image/png,image/jpeg,.png,.jpg,.jpeg"
              required
              onChange={(event) => setPickedFile(event.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {picked && <img src={picked} alt={t.assets.photograph} className="h-56 w-44 rounded-2xl object-cover" />}
        <button className="rounded-full bg-accent px-4 py-2 text-sm text-white" type="submit">{t.assets.upload}</button>
      </form>
      {message && <Notice>{message}</Notice>}
      {error && <ErrorText>{error}</ErrorText>}
      <ul className="space-y-3">
        {assets.map((asset) => (
          <li key={String(asset.id)} className="rounded-2xl border border-line bg-card p-4">
            <div className="flex gap-4">
              {previews[String(asset.id)] ? (
                <img src={previews[String(asset.id)]} alt={String(asset.caption || t.assets.photograph)} className="h-36 w-28 shrink-0 rounded-2xl object-cover" />
              ) : (
                <div className="flex h-36 w-28 shrink-0 items-center justify-center rounded-2xl bg-canvas-deep text-xs text-muted">{t.assets.photograph}</div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <StatusPill value={String(asset.moderationStatus)} />
                  <span className="text-xs text-muted">{String(asset.fileType)} · {String(asset.fileSize)} {t.assets.bytes}</span>
                </div>
                {Boolean(asset.caption) && <p className="mt-2 text-sm">{String(asset.caption)}</p>}
                {Array.isArray(asset.duplicateFlags) && asset.duplicateFlags.length > 0 && (
                  <p className="mt-2 text-sm text-warn">{fill(t.assets.flagged, { kinds: asset.duplicateFlags.map((flag) => term(locale, "statuses", (flag as { kind: string }).kind)).join(", ") })}</p>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <Link className="rounded-full bg-accent px-3 py-1.5 text-sm text-white" href={`/owner/rules?asset=${String(asset.id)}`}>{t.assets.permissions}</Link>
                  <button
                    className="text-sm underline"
                    onClick={async () => {
                      const next = asset.listed === false;
                      try {
                        await api(`assets/${String(asset.id)}/listing`, { method: "POST", body: JSON.stringify({ listed: next }) });
                        setMessage(next ? t.assets.relisted : t.assets.unlisted);
                        await load();
                      } catch (caught) {
                        setError(caught instanceof ApiError ? caught.message : t.assets.deleteFailed);
                      }
                    }}
                  >{asset.listed === false ? t.assets.relist : t.assets.unlist}</button>
                  <button
                    className="text-sm text-danger underline"
                    onClick={async () => {
                      if (!window.confirm(t.assets.delete)) return;
                      try {
                        const removed = await api<{ keptForLicense?: boolean }>(`assets/${String(asset.id)}`, { method: "DELETE" });
                        setMessage(removed.keptForLicense ? t.assets.deletedLicensed : t.assets.deleted);
                        await load();
                      } catch (caught) {
                        setError(caught instanceof ApiError ? caught.message : t.assets.deleteFailed);
                      }
                    }}
                  >{t.assets.delete}</button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {assets.length === 0 && <p className="text-muted">{t.assets.empty}</p>}
    </div>
  );
}

export function RuleEditor() {
  const session = useSession();
  const t = useCopy();
  const locale = useLocale();
  const requestedAsset = useSearchParams().get("asset") ?? "";
  const [rules, setRules] = useState<LicensingRules>(blankRules());
  const [ruleSetId, setRuleSetId] = useState<string | null>(null);
  const [rows, setRows] = useState<Array<{ ruleSet: { id: string; assetId: string | null }; version: { rules: LicensingRules } | null }>>([]);
  const [photos, setPhotos] = useState<Array<{ id: string; caption: string }>>([]);
  const [assetId, setAssetId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function showSet(next: string, loaded: typeof rows) {
    const own = loaded.find((row) => (row.ruleSet.assetId ?? "") === next);
    const general = loaded.find((row) => !row.ruleSet.assetId);
    if (own?.version) {
      setRules(structuredClone(own.version.rules));
      setRuleSetId(own.ruleSet.id);
      return;
    }
    setRules(structuredClone(general?.version?.rules ?? blankRules()));
    setRuleSetId(null);
  }
  useEffect(() => {
    if (!session) return;
    Promise.all([
      api<Array<{ ruleSet: { id: string; assetId: string | null }; version: { rules: LicensingRules } | null }>>(`profiles/${session.profile.id}/rule-sets`),
      api<Array<{ id: string; caption: string }>>(`assets?profileId=${session.profile.id}`),
    ]).then(([loaded, assets]) => {
      setRows(loaded);
      setPhotos(assets);
      const initial = assets.some((item) => item.id === requestedAsset) ? requestedAsset : "";
      setAssetId(initial);
      showSet(initial, loaded);
    }).catch(() => undefined);
  }, [session, requestedAsset]);
  if (!session) return null;
  function toggleCategory(category: LicensingRules["permitted"]["categories"][number]) {
    setRules((current) => {
      const categories = current.permitted.categories.includes(category)
        ? current.permitted.categories.filter((item) => item !== category)
        : [...current.permitted.categories, category];
      return { ...current, permitted: { ...current.permitted, categories } };
    });
  }
  function toggleBan(id: string) {
    setRules((current) => {
      const categories = current.prohibited.categories.includes(id)
        ? current.prohibited.categories.filter((item) => item !== id)
        : [...current.prohibited.categories, id];
      return { ...current, prohibited: { ...current.prohibited, categories } };
    });
  }
  return (
    <form
      className="space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const publish = (event.nativeEvent as SubmitEvent).submitter?.getAttribute("value") === "publish";
        try {
          const payload = { name: t.rules.name, rules, publish, ...(assetId ? { assetId } : {}) };
          if (ruleSetId) {
            await api(`rule-sets/${ruleSetId}`, { method: "PATCH", body: JSON.stringify(payload) });
          } else {
            const created = await api<{ ruleSet: { id: string; assetId: string | null } }>(`profiles/${session.profile.id}/rule-sets`, {
              method: "POST",
              body: JSON.stringify(payload),
            });
            setRuleSetId(created.ruleSet.id);
            setRows((current) => [...current.filter((row) => row.ruleSet.id !== created.ruleSet.id), { ruleSet: created.ruleSet, version: { rules } }]);
          }
          setMessage(publish ? t.rules.published : t.rules.draftSaved);
        } catch (caught) {
          setError(caught instanceof ApiError ? caught.message : t.rules.saveFailed);
        }
      }}
    >
      <h1 className="text-4xl">{t.rules.title}</h1>
      <p className="max-w-2xl text-sm text-muted">{t.rules.mobileLede}</p>
      <label className="block text-sm">{t.rules.whichPhoto}
        <select className={field} value={assetId} onChange={(event) => { setAssetId(event.target.value); showSet(event.target.value, rows); }}>
          <option value="">{t.rules.general}</option>
          {photos.map((photo) => <option key={photo.id} value={photo.id}>{photo.caption || t.assets.photograph}</option>)}
        </select>
      </label>
      {assetId ? <p className="text-sm text-muted">{t.rules.photoNote}</p> : null}
      <fieldset>
        <legend className="text-sm font-semibold">{t.rules.permitted}</legend>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {USAGE_CATEGORIES.map((category) => (
            <label key={category} className="flex gap-2 text-sm"><input type="checkbox" checked={rules.permitted.categories.includes(category)} onChange={() => toggleCategory(category)} />{term(locale, "categories", category)}</label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">{t.rules.prohibited}</legend>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {SUGGESTED_PROHIBITIONS.map((item) => (
            <label key={item} className="flex gap-2 text-sm"><input type="checkbox" checked={rules.prohibited.categories.includes(item)} onChange={() => toggleBan(item)} />{term(locale, "prohibitions", item)}</label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">{t.rules.ai}</legend>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {(Object.keys(rules.permitted.ai) as Array<keyof LicensingRules["permitted"]["ai"]>).map((key) => (
            <label key={key} className="flex gap-2 text-sm">
              <input type="checkbox" checked={rules.permitted.ai[key]} onChange={() => setRules((current) => ({ ...current, permitted: { ...current.permitted, ai: { ...current.permitted.ai, [key]: !current.permitted.ai[key] } } }))} />
              {term(locale, "ai", key)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">{t.rules.channelLabel}</legend>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {[...SUGGESTED_CHANNELS, ...rules.permitted.distributionChannels.filter((item) => !(SUGGESTED_CHANNELS as readonly string[]).includes(item))].map((channel) => (
            <label key={channel} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={rules.permitted.distributionChannels.includes(channel)}
                onChange={() => setRules((current) => ({
                  ...current,
                  permitted: {
                    ...current.permitted,
                    distributionChannels: current.permitted.distributionChannels.includes(channel)
                      ? current.permitted.distributionChannels.filter((item) => item !== channel)
                      : [...current.permitted.distributionChannels, channel],
                  },
                }))}
              />
              {term(locale, "channels", channel)}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-semibold">{t.rules.territories}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[...COUNTRIES.map((country) => country.code), ...rules.permitted.territories.filter((code) => !COUNTRIES.some((country) => country.code === code))].map((code) => (
            <label key={code} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={rules.permitted.territories.includes(code)}
                onChange={() => setRules((current) => ({
                  ...current,
                  permitted: {
                    ...current.permitted,
                    territories: current.permitted.territories.includes(code)
                      ? current.permitted.territories.filter((item) => item !== code)
                      : [...current.permitted.territories, code],
                  },
                }))}
              />
              {term(locale, "territories", code)}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">{t.rules.maxDays}<input className={field} inputMode="numeric" value={rules.permitted.maxDurationDays ?? ""} onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          setRules((current) => ({ ...current, permitted: { ...current.permitted, maxDurationDays: digits ? Number(digits) : null } }));
        }} /></label>
        <label className="text-sm">{t.rules.pricing}
          <select className={field} value={rules.commercial.pricingMode} onChange={(event) => setRules((current) => ({ ...current, commercial: { ...current.commercial, pricingMode: event.target.value as LicensingRules["commercial"]["pricingMode"] } }))}>
            <option value="fixed">{t.rules.fixed}</option>
            <option value="negotiable">{t.rules.negotiable}</option>
            <option value="category_based">{t.rules.categoryBased}</option>
          </select>
        </label>
        <label className="text-sm">{t.rules.basePrice}<input className={field} inputMode="numeric" value={rules.commercial.basePriceMinor ?? ""} onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, "");
          setRules((current) => ({ ...current, commercial: { ...current.commercial, basePriceMinor: digits ? Number(digits) : null } }));
        }} /></label>
        <label className="text-sm">{t.rules.currency}
          <select className={field} value={rules.commercial.currency} onChange={(event) => setRules((current) => ({ ...current, commercial: { ...current.commercial, currency: event.target.value as LicensingRules["commercial"]["currency"] } }))}>
            <option>TRY</option><option>USD</option><option>EUR</option>
          </select>
        </label>
      </div>
      <div className="flex gap-3">
        <button className="rounded-full border border-line px-4 py-2 text-sm" type="submit" value="draft">{t.rules.draft}</button>
        <button className="rounded-full bg-accent px-4 py-2 text-sm text-white" type="submit" value="publish">{t.rules.publish}</button>
      </div>
      {message && <Notice>{message}</Notice>}
      {error && <ErrorText>{error}</ErrorText>}
    </form>
  );
}

type RequestUsage = {
  categories: string[];
  commercial: boolean;
  distributionChannels: string[];
  territories: string[];
  startsOn: string;
  endsOn: string;
  downloadOriginal: boolean;
  editing: boolean;
  cropping: boolean;
  sublicensing: boolean;
  contentDeclarations: string[];
  companyName: string;
  otherCategoryNote: string;
  ai: Record<string, boolean>;
};
type RequestRow = {
  id: string;
  assetId: string;
  status: string;
  intendedUse: string;
  createdAt: string;
  usage: RequestUsage;
  compatibility?: { allowed: boolean; violations: UsageViolation[] };
};
type AgreementCard = {
  id: string;
  requestId: string;
  status: string;
  amountMinor: number;
  currency: "TRY" | "USD" | "EUR";
  document: { projectName: string; text: string };
};

function stamp(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(locale === "en" ? "en-GB" : "tr-TR", { dateStyle: "medium", timeStyle: "short" });
}

export function RequestList({ mode }: { mode: "owner" | "producer" }) {
  const t = useCopy();
  const locale = useLocale();
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [agreements, setAgreements] = useState<AgreementCard[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  function load() {
    api<RequestRow[]>("license-requests").then(async (list) => {
      setRows(list);
      const cards = await api<Array<{ assetId: string; imageUrl: string | null }>>("marketplace/faces").catch(() => []);
      const next: Record<string, string> = {};
      for (const card of cards) if (card.imageUrl) next[card.assetId] = card.imageUrl;
      const missing = [...new Set(list.map((row) => row.assetId))].filter((id) => id && !next[id]);
      await Promise.all(missing.map(async (id) => {
        try {
          const signed = await api<{ url: string }>(`assets/${id}/signed-url`, { method: "POST", body: JSON.stringify({ purpose: "preview" }) });
          next[id] = signed.url;
        } catch {
          // A request can exist after its preview is no longer available.
        }
      }));
      setPhotos(next);
    }).catch(() => setRows([]));
    api<AgreementCard[]>("agreements").then(setAgreements).catch(() => setAgreements([]));
  }
  useEffect(() => { load(); }, []);
  async function decide(id: string, decision: "approve" | "reject") {
    setError("");
    try {
      const result = await api<{ status: string }>(`license-requests/${id}/decision`, { method: "POST", body: JSON.stringify({ decision }) });
      setMessage(decision === "reject" ? t.requests.rejected : result.status === "active" ? t.requests.decided : t.agreement.recordFailed);
      load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.requests.empty);
    }
  }
  async function complete(id: string) {
    setError("");
    try {
      const result = await api<{ status: string }>(`agreements/${id}/complete`, { method: "POST" });
      setMessage(result.status === "active" ? t.requests.decided : t.agreement.recordFailed);
      load();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : t.agreement.recordFailed);
    }
  }
  return (
    <div>
      <h1 className="text-4xl">{mode === "owner" ? t.requests.incoming : t.requests.yours}</h1>
      <ul className="mt-6 space-y-3">
        {[...rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((row) => {
          const agreement = agreements.find((item) => item.requestId === row.id);
          const open = openId === row.id;
          const yes = t.common.yes;
          const no = t.common.no;
          return (
            <li key={row.id} className="flex items-start gap-4 rounded-2xl border border-line bg-card p-4">
              <div className="min-w-0 flex-1">
              <button className="w-full text-left" type="button" onClick={() => setOpenId(open ? null : row.id)}>
                <div className="flex items-center justify-between"><StatusPill value={row.status} /><span className="text-xs text-muted">{stamp(row.createdAt, locale)}</span></div>
                {agreement && <p className="mt-2 text-lg">{agreement.document.projectName}</p>}
                <p className="mt-2 text-sm">{row.intendedUse}</p>
                <p className="mt-2 text-sm text-muted">{row.usage.startsOn} – {row.usage.endsOn} · {row.usage.distributionChannels.join(", ")} · {row.usage.territories.join(", ")}</p>
                {agreement && <p className="mt-1 text-sm">{t.agreement.amount} {formatMinor(agreement.amountMinor, agreement.currency)}</p>}
                <p className="mt-3 text-sm underline">{open ? t.requests.hide : t.requests.details}</p>
              </button>
              {agreement && (
                <div className="mt-3 flex items-center gap-3">
                  <Link className="text-sm underline" href={`/agreements/${agreement.id}`}>{t.requests.openAgreement}</Link>
                  <StatusPill value={agreement.status} />
                </div>
              )}
              {open && (
                <div className="mt-4 space-y-3 border-t border-line pt-4 text-sm">
                  <p>{t.discover.category}: {row.usage.categories.map((item) => term(locale, "categories", item)).join(", ")}</p>
                  <p>{t.legal.commercial}: {row.usage.commercial ? yes : no}</p>
                  <p>{t.legal.editing}: {row.usage.editing ? yes : no}</p>
                  <p>{t.legal.cropping}: {row.usage.cropping ? yes : no}</p>
                  <p>{t.legal.download}: {row.usage.downloadOriginal ? yes : no}</p>
                  <p>{t.legal.sublicensing}: {row.usage.sublicensing ? yes : no}</p>
                  {row.usage.companyName && <p>{row.usage.companyName}</p>}
                  {row.usage.otherCategoryNote && <p>{row.usage.otherCategoryNote}</p>}
                  {row.usage.contentDeclarations.length > 0 && <p>{t.discover.declarations}: {row.usage.contentDeclarations.join(", ")}</p>}
                  <div>
                    <p className="mb-1">{t.face.ai}</p>
                    <ul>
                      {AI_PERMISSION_KEYS.map((key) => (
                        <li key={key}>{term(locale, "ai", key)}: {row.usage.ai?.[key] ? yes : no}</li>
                      ))}
                    </ul>
                  </div>
                  {agreement && (
                    <>
                      <pre className="overflow-auto whitespace-pre-wrap rounded-2xl border border-line bg-white p-4 leading-relaxed">{agreement.document.text}</pre>
                    </>
                  )}
                </div>
              )}
              {mode === "owner" && (row.status === "pending_review" || agreement?.status === "pending_consent" || agreement?.status === "approved") && <p className="mt-2 text-sm">{t.requests.writes}</p>}
              {mode === "producer" && (row.status === "pending_review" || agreement?.status === "pending_consent" || agreement?.status === "approved") && <p className="mt-2 text-sm">{t.requests.waiting}</p>}
              {row.compatibility && !row.compatibility.allowed && (
                <ul className="mt-2 text-sm text-danger">{row.compatibility.violations.map((item) => <li key={item.code + item.message}>{violationText(locale, item)}</li>)}</ul>
              )}
              {mode === "owner" && row.status === "pending_review" && (
                <div className="mt-3 flex gap-3">
                  <button className="rounded-full bg-accent px-4 py-2 text-sm text-white" type="button" onClick={() => decide(row.id, "approve")}>{t.requests.approve}</button>
                  <button className="rounded-full border border-line px-4 py-2 text-sm" type="button" onClick={() => decide(row.id, "reject")}>{t.requests.reject}</button>
                </div>
              )}
              {mode === "owner" && agreement && (agreement.status === "pending_consent" || agreement.status === "approved") && (
                <div className="mt-3">
                  <button className="rounded-full bg-accent px-4 py-2 text-sm text-white" type="button" onClick={() => complete(agreement.id)}>{t.requests.approve}</button>
                </div>
              )}
              </div>
              {photos[row.assetId] && <img src={photos[row.assetId]} alt={row.intendedUse} className="h-36 w-28 shrink-0 rounded-2xl object-cover" />}
            </li>
          );
        })}
      </ul>
      {rows.length === 0 && <p className="mt-6 text-muted">{t.requests.empty}</p>}
      {message && <Notice>{message}</Notice>}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

export function LicenseList() {
  const t = useCopy();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => { api<Array<Record<string, unknown>>>("agreements").then(setRows).catch(() => setRows([])); }, []);
  if (rows.length === 0) return null;
  return (
    <div className="mt-8">
      <h2 className="text-2xl">{t.requests.agreements}</h2>
      <ul className="mt-3 space-y-2">
        {[...rows].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? ""))).map((row) => (
          <li key={String(row.id)}>
            <Link className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3" href={`/agreements/${row.id}`}>
              <span className="text-sm">{String((row.document as { projectName?: string })?.projectName ?? row.licenseId)}</span>
              <StatusPill value={String(row.status)} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

type BoughtAgreement = {
  id: string;
  status: string;
  amountMinor: number;
  currency: "TRY" | "USD" | "EUR";
  createdAt?: string;
  document: {
    projectName: string;
    licensorDisplayName: string;
    licenseeProfileId: string;
    assetId: string;
    granted: { startsOn: string; endsOn: string };
  };
};

export function ProducerAccount() {
  const t = useCopy();
  const locale = useLocale();
  const session = useSession();
  const [profile, setProfile] = useState<{ displayName: string; email: string; companyName: string | null; bio: string; location: string | null; place?: Place } | null>(null);
  const [rows, setRows] = useState<BoughtAgreement[]>([]);
  const [photos, setPhotos] = useState<Record<string, string>>({});
  useEffect(() => {
    api<{ profile: { displayName: string; email: string; companyName: string | null; bio: string; location: string | null; place?: Place } }>("me").then((me) => setProfile(me.profile)).catch(() => setProfile(null));
    api<BoughtAgreement[]>("agreements").then(setRows).catch(() => setRows([]));
    api<Array<{ assetId: string; imageUrl: string | null }>>("marketplace/faces").then((cards) => {
      const next: Record<string, string> = {};
      for (const card of cards) if (card.imageUrl) next[card.assetId] = card.imageUrl;
      setPhotos(next);
    }).catch(() => setPhotos({}));
  }, []);
  const accepted = new Set(["signed", "payment_pending", "recording", "active", "expired", "recording_failed", "suspended", "refund_pending", "refunded", "disputed"]);
  const mine = (session ? rows.filter((row) => row.document.licenseeProfileId === session.profile.id) : rows).filter((row) => accepted.has(row.status));
  const people = [...mine].sort((a, b) => String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")));
  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-accent">{t.producer.account}</p>
        <h1 className="mt-1 text-4xl">{profile?.displayName ?? session?.profile.displayName}</h1>
        <p className="mt-2 text-muted">{profile?.email ?? session?.profile.email}</p>
        {profile?.companyName && <p className="mt-1 text-sm">{profile.companyName}</p>}
        {(formatPlace(profile?.place, locale) || profile?.location) && <p className="text-sm text-muted">{formatPlace(profile?.place, locale) || profile?.location}</p>}
        {profile?.bio && <p className="mt-3 max-w-xl text-sm">{profile.bio}</p>}
      </div>
      <section>
        <h2 className="text-2xl">{t.producer.people}</h2>
        {people.length === 0 ? <p className="mt-3 text-muted">{t.producer.peopleEmpty}</p> : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {people.map((row) => (
              <li key={row.id}>
                <Link href={`/agreements/${row.id}`} className="flex gap-3 rounded-3xl border border-line bg-white p-3 shadow-sm hover:border-accent">
                  {photos[row.document.assetId] ? (
                    <img src={photos[row.document.assetId]} alt={row.document.licensorDisplayName} className="h-24 w-20 rounded-2xl object-cover" />
                  ) : (
                    <div className="flex h-24 w-20 items-center justify-center rounded-2xl bg-canvas-deep text-xl font-semibold text-accent">{row.document.licensorDisplayName.slice(0, 1)}</div>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{row.document.licensorDisplayName}</span>
                    <span className="mt-1 block truncate text-sm text-muted">{row.document.projectName}</span>
                    <span className="mt-2 block text-sm font-semibold text-accent">{formatMinor(row.amountMinor, row.currency)}</span>
                    <span className="mt-2 inline-block"><StatusPill value={row.status} /></span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function PaymentList() {
  const t = useCopy();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [balance, setBalance] = useState<number | null>(null);
  useEffect(() => {
    api<Array<Record<string, unknown>>>("payments").then(setRows).catch(() => setRows([]));
    api<{ balanceMinor: number }>("wallet").then((wallet) => setBalance(wallet.balanceMinor)).catch(() => setBalance(null));
  }, []);
  return (
    <div>
      <h1 className="text-4xl">{t.payments.title}</h1>
      <p className="mt-2 text-sm text-muted">{t.payments.lede}</p>
      {balance !== null && <p className="mt-3 text-sm">{fill(t.payments.balance, { amount: formatMinor(balance, "TRY") })}</p>}
      <ul className="mt-6 space-y-2">
        {rows.map((row) => (
          <li key={String(row.id)} className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3 text-sm">
            <span>{formatMinor(Number(row.amountMinor), row.currency as "TRY")}</span>
            <StatusPill value={String(row.status)} />
          </li>
        ))}
      </ul>
      {rows.length === 0 && <p className="mt-4 text-muted">{t.payments.empty}</p>}
    </div>
  );
}

export function PrivacyForm() {
  const session = useSession();
  const t = useCopy();
  const [message, setMessage] = useState("");
  if (!session) return null;
  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-4xl">{t.privacy.title}</h1>
      <p className="text-sm text-muted">{t.privacy.lede}</p>
      <form
        className="space-y-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          await api(`profiles/${session.profile.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              privacy: {
                discoverable: form.get("discoverable") === "on",
                showPreviewToProducers: form.get("preview") === "on",
                showLegalName: false,
              },
            }),
          });
          setMessage(t.privacy.saved);
        }}
      >
        <label className="flex gap-2 text-sm"><input name="discoverable" type="checkbox" /> {t.privacy.discoverable}</label>
        <label className="flex gap-2 text-sm"><input name="preview" type="checkbox" /> {t.privacy.preview}</label>
        <button className="rounded-full bg-teal px-4 py-2 text-sm text-white" type="submit">{t.privacy.save}</button>
      </form>
      <button
        className="text-sm text-danger underline"
        onClick={async () => {
          await api("me/deletion-request", { method: "POST" });
          setMessage(t.privacy.deleted);
        }}
      >{t.privacy.delete}</button>
      {message && <Notice>{message}</Notice>}
    </div>
  );
}

export function ReportForm() {
  const t = useCopy();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  return (
    <form
      className="max-w-xl space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const form = new FormData(event.currentTarget);
        try {
          const report = await api<{ id: string }>("misuse-reports", {
            method: "POST",
            body: JSON.stringify({
              licenseId: form.get("licenseId") || null,
              assetId: form.get("assetId") || null,
              suspectedProject: form.get("suspectedProject"),
              url: form.get("url") || null,
              observedAt: new Date().toISOString(),
              description: form.get("description"),
            }),
          });
          const evidence = form.get("file");
          if (evidence instanceof File && evidence.size > 0) {
            const body = new FormData();
            body.set("file", evidence);
            body.set("note", t.report.evidenceNote);
            await api(`misuse-reports/${report.id}/evidence`, { method: "POST", body });
          }
          setMessage(t.report.submitted);
        } catch (caught) {
          setError(caught instanceof ApiError ? caught.message : t.report.failed);
        }
      }}
    >
      <h1 className="text-4xl">{t.report.title}</h1>
      <p className="text-sm text-muted">{t.report.lede}</p>
      <label className="block text-sm">{t.report.licenseId}<input className={field} name="licenseId" /></label>
      <label className="block text-sm">{t.report.assetId}<input className={field} name="assetId" /></label>
      <label className="block text-sm">{t.report.project}<input className={field} name="suspectedProject" required /></label>
      <label className="block text-sm">{t.report.url}<input className={field} name="url" type="url" /></label>
      <label className="block text-sm">{t.report.observed}<textarea className={field} name="description" required minLength={10} rows={4} /></label>
      <label className="block text-sm">{t.report.evidence}<input className="mt-1 block" name="file" type="file" /></label>
      <button className="rounded-full bg-accent px-4 py-2 text-sm text-white" type="submit">{t.report.submit}</button>
      {message && <Notice>{message}</Notice>}
      {error && <ErrorText>{error}</ErrorText>}
    </form>
  );
}

export function ProjectManager() {
  const t = useCopy();
  const [projects, setProjects] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [message, setMessage] = useState("");
  useEffect(() => { api<Array<{ id: string; name: string; description: string }>>("projects").then(setProjects).catch(() => setProjects([])); }, []);
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">{t.projects.title}</h1>
      <form
        className="grid gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          await api("projects", {
            method: "POST",
            body: JSON.stringify({ name: form.get("name"), description: form.get("description"), companyName: form.get("companyName") }),
          });
          setMessage(t.projects.created);
          setProjects(await api("projects"));
          event.currentTarget.reset();
        }}
      >
        <input className={field} name="name" placeholder={t.projects.name} required />
        <input className={field} name="companyName" placeholder={t.projects.company} required />
        <textarea className={field} name="description" placeholder={t.projects.description} required minLength={10} />
        <button className="w-fit rounded-full bg-accent px-4 py-2 text-sm text-white" type="submit">{t.projects.create}</button>
      </form>
      {message && <Notice>{message}</Notice>}
      <ul className="space-y-2">
        {projects.map((project) => <li key={project.id} className="rounded-xl border border-line bg-card p-4"><strong>{project.name}</strong><p className="text-sm text-muted">{project.description}</p></li>)}
      </ul>
    </div>
  );
}

function groupLira(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function moneyText(value: string): string {
  const cleaned = value.replace(/\./g, "").replace(/[^\d,]/g, "");
  const comma = cleaned.indexOf(",");
  const wholeRaw = (comma === -1 ? cleaned : cleaned.slice(0, comma)).replace(/^0+(?=\d)/, "");
  const whole = groupLira(wholeRaw);
  if (comma === -1) return whole;
  const fraction = cleaned.slice(comma + 1).replace(/\D/g, "").slice(0, 2);
  return `${whole || "0"},${fraction}`;
}

function moneyMinor(value: string): number | null {
  const normalized = value.replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const lira = Number(normalized);
  if (!Number.isFinite(lira) || lira <= 0) return null;
  return Math.round(lira * 100);
}

export function DiscoverRequest({ assetId, channels = [], territories = [], categories = [], suggestedAmount = "" }: { assetId?: string; channels?: string[]; territories?: string[]; categories?: string[]; allowDownload?: boolean; suggestedAmount?: string }) {
  const t = useCopy();
  const locale = useLocale();
  const router = useRouter();
  const [companyName, setCompanyName] = useState("Dijital Kimlik");
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState("");
  const [amount, setAmount] = useState(() => moneyText(suggestedAmount.replace(".", ",")));
  const startsOn = new Date().toISOString().slice(0, 10);
  const end = new Date();
  end.setFullYear(end.getFullYear() + 1);
  const endsOn = end.toISOString().slice(0, 10);
  useEffect(() => {
    api<{ profile: { companyName: string | null; displayName: string } }>("me")
      .then((me) => setCompanyName(me.profile.companyName || me.profile.displayName || "Dijital Kimlik"))
      .catch(() => undefined);
  }, []);
  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        const form = new FormData(event.currentTarget);
        if (!assetId) {
          setError(t.discover.pickListing);
          return;
        }
        const amountMinor = moneyMinor(amount);
        if (amountMinor === null) {
          setError(t.discover.amountInvalid);
          return;
        }
        if (String(form.get("endsOn")) < String(form.get("startsOn"))) {
          setError(t.discover.datesInvalid);
          return;
        }
        try {
          const intendedUse = String(form.get("intendedUse") ?? "").trim();
          const createdProject = await api<{ id: string; companyName: string }>("projects", {
            method: "POST",
            body: JSON.stringify({ name: intendedUse.slice(0, 160), description: intendedUse, companyName }),
          });
          const projectId = createdProject.id;
          const usage = {
            categories: [form.get("category")],
            commercial: true,
            distributionChannels: [String(form.get("channel"))],
            territories: [String(form.get("territory"))],
            startsOn: form.get("startsOn"),
            endsOn: form.get("endsOn"),
            downloadOriginal: true,
            editing: false,
            cropping: false,
            ai: { transformations: false, stillImages: false, video: false, digitalCharacter: false, voiceSynthesis: false, motionSynthesis: false, modelTraining: false },
            sublicensing: false,
            contentDeclarations: [],
            companyName,
            proposedAmountMinor: amountMinor,
            otherCategoryNote: "",
          };
          const created = await api<{ request: { compatibility: { allowed: boolean; violations: UsageViolation[] } }; agreement: { id: string } | null }>("license-requests", {
            method: "POST",
            body: JSON.stringify({ projectId, assetId, intendedUse, usage }),
          });
          if (!created.request.compatibility.allowed) {
            setError(created.request.compatibility.violations.map((item) => violationText(locale, item)).join(" "));
            return;
          }
          if (created.agreement?.id) {
            router.push(`/agreements/${created.agreement.id}`);
            return;
          }
          setResult(t.discover.sent);
        } catch (caught) {
          if (caught instanceof ApiError && caught.code === "PROHIBITED_USE") {
            const details = Array.isArray(caught.details) ? caught.details.map((item) => violationText(locale, item as UsageViolation)).join(" ") : caught.message;
            setError(details);
            return;
          }
          setError(caught instanceof ApiError ? caught.message : t.discover.failed);
        }
      }}
    >
      {assetId ? null : <p className="text-sm text-muted">{t.discover.pickListing}</p>}
      {categories.length ? <input type="hidden" name="category" value={categories[0]} /> : (
        <label className="block text-sm">{t.discover.category}
          <select className={field} name="category">{USAGE_CATEGORIES.map((category) => <option key={category} value={category}>{term(locale, "categories", category)}</option>)}</select>
        </label>
      )}
      {channels.length ? <input type="hidden" name="channel" value={channels[0]} /> : <label className="block text-sm">{t.discover.channel}<input className={field} name="channel" required /></label>}
      {territories.length ? <input type="hidden" name="territory" value={territories[0]} /> : <label className="block text-sm">{t.discover.territory}<input className={field} name="territory" required /></label>}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">{t.discover.starts}<input className={field} type="date" name="startsOn" required defaultValue={startsOn} /></label>
        <label className="text-sm">{t.discover.ends}<input className={field} type="date" name="endsOn" required defaultValue={endsOn} /></label>
      </div>
      <label className="block text-sm">{t.discover.intended}<textarea className={field} name="intendedUse" required minLength={10} /></label>
      <label className="block text-sm">{t.discover.amount}<input className={field} name="amount" inputMode="decimal" autoComplete="off" spellCheck={false} placeholder="9.500" value={amount} onChange={(event) => setAmount(moneyText(event.target.value))} required /></label>
      <button className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white" type="submit">{t.discover.submit}</button>
      {result && <Notice>{result}</Notice>}
      {error && <ErrorText>{error}</ErrorText>}
    </form>
  );
}

export function AgreementDesk({ id }: { id: string }) {
  const session = useSession();
  const t = useCopy();
  const locale = useLocale();
  const [bundle, setBundle] = useState<Record<string, unknown> | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  async function load() {
    setBundle(await api(`agreements/${id}`));
    const wallet = await api<{ balanceMinor: number }>("wallet").catch(() => null);
    setBalance(wallet?.balanceMinor ?? null);
  }
  useEffect(() => { void load().catch((caught) => setError(caught instanceof Error ? caught.message : t.agreement.loadFailed)); }, [id]);
  if (!bundle) return error ? <ErrorText>{error}</ErrorText> : <p className="text-muted">{t.agreement.loading}</p>;
  const agreement = bundle.agreement as {
    id: string;
    requestId: string;
    licenseId: string;
    status: string;
    documentHash: string;
    document: {
      text: string;
      projectName: string;
      licensorDisplayName: string;
      licensorProfileId: string;
      licenseeCompanyName: string;
      licenseeProfileId: string;
      assetId: string;
      intendedUse: string;
      derivativeClause: string;
      projectBindingClause: string;
      breachClause: string;
      terminationClause: string;
      granted: {
        categories: string[];
        distributionChannels: string[];
        territories: string[];
        downloadOriginal: boolean;
        startsOn: string;
        endsOn: string;
        ai: Record<string, boolean>;
      };
      restrictions: { categories: string[]; custom: Array<{ label: string }> };
    };
    amountMinor: number;
    currency: "TRY";
    paymentRequired: boolean;
  };
  const me = session?.profile.id;
  const party = me === agreement.document.licensorProfileId ? "licensor" : me === agreement.document.licenseeProfileId ? "licensee" : null;
  const canDownload = agreement.status === "active" && party === "licensee";
  const today = new Date().toISOString().slice(0, 10);
  const downloadOpen = agreement.document.granted.startsOn <= today && agreement.document.granted.endsOn >= today;
  const granted = agreement.document.granted;
  const prohibitions = [
    ...agreement.document.restrictions.categories.map((item) => term(locale, "prohibitions", item)),
    ...agreement.document.restrictions.custom.map((item) => item.label),
  ];
  const sections: Array<{ title: string; lines: string[] }> = [
    { title: t.legal.licensor, lines: [agreement.document.licensorDisplayName] },
    { title: t.legal.licensee, lines: [agreement.document.licenseeCompanyName] },
    ...(agreement.document.projectName.trim() !== agreement.document.intendedUse.trim()
      ? [{ title: t.legal.project, lines: [agreement.document.projectName] }]
      : []),
    { title: t.discover.intended, lines: [agreement.document.intendedUse] },
    { title: t.marketplace.price, lines: [formatMinor(agreement.amountMinor, agreement.currency)] },
    { title: t.agreement.dates, lines: [`${formatDay(granted.startsOn, locale)} – ${formatDay(granted.endsOn, locale)}`] },
    { title: t.face.permitted, lines: [granted.categories.map((item) => term(locale, "categories", item)).join(", ") || t.face.none] },
    { title: t.marketplace.channels, lines: [granted.distributionChannels.map((item) => term(locale, "channels", item)).join(", ") || t.face.none] },
    { title: t.marketplace.territories, lines: [granted.territories.map((item) => term(locale, "territories", item)).join(", ") || t.face.none] },
    { title: t.face.prohibited, lines: [prohibitions.join(", ") || t.face.none] },
    { title: t.face.ai, lines: AI_PERMISSION_KEYS.map((key) => `${term(locale, "ai", key)}: ${granted.ai[key] ? t.face.permittedValue : t.face.notPermitted}`) },
    { title: t.agreement.terms, lines: [agreement.document.projectBindingClause, agreement.document.derivativeClause, agreement.document.breachClause, agreement.document.terminationClause] },
  ];
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-4xl">{t.agreement.heading}</h1>
        <StatusPill value={agreement.status} />
      </div>
      <article className="rounded-3xl border border-line bg-white p-6 shadow-sm md:p-8">
        <p className="text-sm font-semibold text-accent">Dijital Kimlik</p>
        <div className="mt-6 space-y-5">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-sm font-semibold text-accent">{section.title}</h2>
              {section.lines.map((line, index) => <p key={`${section.title}-${index}`} className="mt-1 text-sm leading-relaxed">{line}</p>)}
            </section>
          ))}
        </div>
        <button
          className="mt-8 rounded-full bg-accent px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          disabled={pdfBusy}
          onClick={async () => {
            setPdfBusy(true);
            setError("");
            try {
              const { downloadAgreementPdf } = await import("@/lib/agreement-pdf");
              await downloadAgreementPdf({
                brand: "Dijital Kimlik",
                title: t.agreement.heading,
                sections,
                footer: `${t.agreement.hash} ${agreement.documentHash}`,
                filename: locale === "en" ? "dijital-kimlik-agreement.pdf" : "dijital-kimlik-sozlesme.pdf",
              });
            } catch {
              setError(t.agreement.pdfFailed);
            } finally {
              setPdfBusy(false);
            }
          }}
        >{t.agreement.pdf}</button>
        <p className="mt-4 text-xs text-muted">{t.agreement.hash} {agreement.documentHash}</p>
      </article>
      <details className="rounded-2xl border border-line bg-white p-4 text-sm">
        <summary className="cursor-pointer font-medium">{t.agreement.fullText}</summary>
        <pre className="mt-3 overflow-auto whitespace-pre-wrap leading-relaxed text-muted">{agreement.document.text}</pre>
      </details>
      <div className="flex flex-wrap gap-3">
        {agreement.status === "draft" && party === "licensor" && (
          <>
            <p className="w-full text-sm">{t.requests.writes}</p>
            <button className="rounded-full bg-accent px-4 py-2 text-sm text-white" onClick={async () => {
              try {
                const result = await api<{ status: string }>(`license-requests/${agreement.requestId}/decision`, { method: "POST", body: JSON.stringify({ decision: "approve" }) });
                setMessage(result.status === "active" ? t.requests.decided : t.agreement.recordFailed);
                await load();
              } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : t.agreement.recordFailed);
              }
            }}>{t.requests.approve}</button>
            <button className="rounded-full border border-line px-4 py-2 text-sm" onClick={async () => {
              try {
                await api(`license-requests/${agreement.requestId}/decision`, { method: "POST", body: JSON.stringify({ decision: "reject" }) });
                setMessage(t.requests.rejected);
                await load();
              } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : t.agreement.recordFailed);
              }
            }}>{t.requests.reject}</button>
          </>
        )}
        {agreement.status === "draft" && party === "licensee" && <p className="text-sm">{t.requests.waiting}</p>}
        {(agreement.status === "pending_consent" || agreement.status === "approved") && party === "licensor" && (
          <>
            <p className="w-full text-sm">{t.requests.writes}</p>
            <button className="rounded-full bg-accent px-4 py-2 text-sm text-white" onClick={async () => {
              try {
                const result = await api<{ status: string }>(`agreements/${id}/complete`, { method: "POST" });
                setMessage(result.status === "active" ? t.requests.decided : t.agreement.recordFailed);
                await load();
              } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : t.agreement.recordFailed);
              }
            }}>{t.requests.approve}</button>
          </>
        )}
        {(agreement.status === "pending_consent" || agreement.status === "approved") && party === "licensee" && <p className="text-sm">{t.requests.waiting}</p>}
        {agreement.paymentRequired && agreement.status === "payment_pending" && (
          <button
            className="rounded-full bg-accent px-4 py-2 text-sm text-white"
            onClick={async () => {
              try {
                const payment = await api<{ payment: { id: string } }>(`agreements/${id}/payments`, { method: "POST", headers: { "idempotency-key": agreement.id } });
                const result = await api<{ licenseStatus: string; walletBalanceMinor: number }>(`payments/${payment.payment.id}/sandbox/simulate`, { method: "POST" });
                setBalance(result.walletBalanceMinor);
                setMessage(fill(t.agreement.sandboxResult, {
                  status: term(locale, "statuses", result.licenseStatus),
                  balance: formatMinor(result.walletBalanceMinor, agreement.currency),
                }));
                await load();
              } catch (caught) {
                setError(caught instanceof ApiError ? caught.message : t.agreement.signFailed);
              }
            }}
          >{t.agreement.sandbox}</button>
        )}
        {(agreement.status === "recording" || agreement.status === "recording_failed") && (
          <button className="rounded-full bg-ink px-4 py-2 text-sm text-white" onClick={async () => {
            try {
              await api(`licenses/${agreement.licenseId}/blockchain`, { method: "POST" });
              setMessage(t.agreement.recorded);
              await load();
            } catch (caught) {
              setError(caught instanceof ApiError ? caught.message : t.agreement.recordFailed);
              await load();
            }
          }}>{t.agreement.record}</button>
        )}
      </div>
      {balance !== null && <p className="text-sm text-muted">{fill(t.payments.balance, { amount: formatMinor(balance, "TRY") })}</p>}
      {agreement.status === "active" && (
        <Notice>
          {t.agreement.activeNote}{" "}
          <Link className="underline" href={`/verify/${agreement.licenseId}?agreementHash=${agreement.documentHash}`}>{t.agreement.verifyRecord}</Link>
        </Notice>
      )}
      {canDownload && !downloadOpen && (
        <p className="text-sm text-muted">{fill(t.agreement.downloadWindow, { start: agreement.document.granted.startsOn, end: agreement.document.granted.endsOn })}</p>
      )}
      {canDownload && downloadOpen && (
        <button
          className="rounded-full bg-teal px-4 py-2 text-sm text-white"
          onClick={async () => {
            try {
              const signed = await api<{ url: string }>(`assets/${agreement.document.assetId}/signed-url`, { method: "POST", body: JSON.stringify({ purpose: "original" }) });
              const mediaPath = new URL(signed.url).pathname.replace(/^\/api\/v1\//, "");
              const file = await fetch(`/api/backend/${mediaPath}?download=1`, { credentials: "include" });
              if (!file.ok) throw new Error(t.agreement.downloadFailed);
              const blob = await file.blob();
              const type = file.headers.get("content-type") ?? blob.type;
              const extension = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
              const objectUrl = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = objectUrl;
              link.download = `dijital-kimlik-orijinal.${extension}`;
              document.body.appendChild(link);
              link.click();
              link.remove();
              URL.revokeObjectURL(objectUrl);
              setError("");
              setMessage(t.agreement.downloadReady);
            } catch (caught) {
              setError(caught instanceof ApiError ? caught.message : t.agreement.downloadFailed);
            }
          }}
        >{t.agreement.download}</button>
      )}
      {message && <Notice>{message}</Notice>}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

export function AgencyDesk() {
  const t = useCopy();
  const [message, setMessage] = useState("");
  return (
    <div className="space-y-4">
      <h1 className="text-4xl">{t.agencyPage.title}</h1>
      <p className="max-w-xl text-sm text-muted">{t.agencyPage.lede}</p>
      <form className="space-y-3" onSubmit={async (event) => {
        event.preventDefault();
        const name = new FormData(event.currentTarget).get("name");
        await api("agencies", { method: "POST", body: JSON.stringify({ name }) });
        setMessage(t.agencyPage.created);
      }}>
        <input className={field} name="name" placeholder={t.agencyPage.name} required />
        <button className="rounded-full bg-teal px-4 py-2 text-sm text-white" type="submit">{t.agencyPage.create}</button>
      </form>
      {message && <Notice>{message}</Notice>}
    </div>
  );
}

export function AdminDesk() {
  const t = useCopy();
  const [auditCount, setAuditCount] = useState<number | null>(null);
  const [users, setUsers] = useState<Array<{ profile: { id: string; email: string; displayName: string }; roles: string[] }>>([]);
  useEffect(() => {
    api<unknown[]>("admin/audit-logs").then((rows) => setAuditCount(rows.length)).catch(() => setAuditCount(null));
    api<Array<{ profile: { id: string; email: string; displayName: string }; roles: string[] }>>("admin/users").then(setUsers).catch(() => setUsers([]));
  }, []);
  return (
    <div className="space-y-6">
      <h1 className="text-4xl">{t.admin.title}</h1>
      <p className="text-sm text-muted">{t.admin.lede}</p>
      <Panel title={t.admin.audit}>{auditCount === null ? t.admin.auditDenied : fill(t.admin.auditCount, { count: auditCount })}</Panel>
      <ul className="space-y-2">
        {users.map((user) => (
          <li key={user.profile.id} className="flex items-center justify-between rounded-xl border border-line bg-card px-4 py-3 text-sm">
            <span>{user.profile.displayName} · {user.profile.email}</span>
            <button className="underline" onClick={async () => {
              const assetId = window.prompt(t.admin.assetPrompt);
              if (!assetId) return;
              await api(`admin/users/${user.profile.id}/verification`, { method: "POST", body: JSON.stringify({ status: "verified" }) });
              await api(`admin/assets/${assetId}/moderation`, { method: "POST", body: JSON.stringify({ status: "authorized" }) });
            }}>{t.admin.authorize}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDay(value: string, locale: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return locale === "en" ? `${month}/${day}/${year}` : `${day}.${month}.${year}`;
}
