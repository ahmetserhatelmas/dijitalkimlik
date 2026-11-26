import type { AgreementDocument } from "./domain";
import { hashCanonical } from "./integrity";
import { copy, fill, term, type Locale } from "./i18n";
import { formatMinor } from "./money";

export function renderAgreementText(document: Omit<AgreementDocument, "text">, locale: Locale = "tr"): string {
  const text = copy(locale);
  const granted = document.granted;
  const aiLines = Object.entries(granted.ai)
    .map(([key, allowed]) => `- ${term(locale, "ai", key)}: ${allowed ? text.common.granted : text.common.notGranted}`)
    .join("\n");
  const restrictions = [
    ...document.restrictions.categories.map((item) => term(locale, "prohibitions", item)),
    ...document.restrictions.custom.map((item) => `${item.label} (${item.id})`),
  ];
  const yesNo = (value: boolean) => (value ? text.common.yes : text.common.no);
  return [
    text.legal.title,
    `${text.legal.licenseId}: ${document.licenseId}`,
    `${text.legal.agreementId}: ${document.agreementId}`,
    fill(text.legal.snapshot, { snapshot: document.ruleSnapshotId, set: document.ruleSetId, version: document.ruleVersionNumber }),
    "",
    `${text.legal.licensor}: ${document.licensorDisplayName} (${document.licensorProfileId})`,
    `${text.legal.licensee}: ${document.licenseeCompanyName} (${document.licenseeProfileId})`,
    `${text.legal.project}: ${document.projectName} (${document.projectId})`,
    `${text.legal.projectDescription}: ${document.projectDescription}`,
    `${text.legal.asset}: ${document.assetId}`,
    `${text.legal.assetHash}: ${document.assetSha256}`,
    "",
    text.legal.permitted,
    granted.categories.map((category) => `- ${term(locale, "categories", category)}`).join("\n"),
    granted.categories.includes("other") ? `${text.legal.otherNote}: ${granted.otherCategoryNote}` : "",
    `${text.legal.commercial}: ${yesNo(granted.commercial)}`,
    `${text.legal.channels}: ${granted.distributionChannels.map((item) => term(locale, "channels", item)).join(", ")}`,
    `${text.legal.territory}: ${granted.territories.map((item) => term(locale, "territories", item)).join(", ")}`,
    `${text.legal.window}: ${granted.startsOn} ${text.legal.to} ${granted.endsOn}`,
    `${text.legal.download}: ${yesNo(granted.downloadOriginal)}`,
    `${text.legal.editing}: ${yesNo(granted.editing)}`,
    `${text.legal.cropping}: ${yesNo(granted.cropping)}`,
    `${text.legal.sublicensing}: ${yesNo(granted.sublicensing)}`,
    "",
    text.legal.aiTitle,
    text.legal.aiIntro,
    aiLines,
    "",
    text.legal.restrictions,
    restrictions.length ? restrictions.map((item) => `- ${item}`).join("\n") : `- ${text.legal.noneBeyond}`,
    document.derivativeClause,
    document.projectBindingClause,
    "",
    text.legal.compensation,
    `${formatMinor(document.commercial.amountMinor, document.commercial.currency)} (${term(locale, "pricingModes", document.commercial.pricingMode)})`,
    document.commercial.formula,
    fill(text.legal.renewal, { allowed: yesNo(document.renewalAllowed), requires: yesNo(document.renewalRequiresNewAgreement) }),
    "",
    text.legal.intended,
    document.intendedUse,
    "",
    document.breachClause,
    document.terminationClause,
    "",
    text.legal.closing,
  ]
    .filter((line) => line !== "")
    .join("\n");
}

export function buildAgreementDocument(
  input: Omit<AgreementDocument, "text" | "derivativeClause" | "projectBindingClause" | "breachClause" | "terminationClause">,
  locale: Locale = "tr",
): AgreementDocument {
  const text = copy(locale);
  const base = {
    ...input,
    derivativeClause: text.legal.derivative,
    projectBindingClause: text.legal.projectBinding,
    breachClause: text.legal.breach,
    terminationClause: text.legal.termination,
  };
  return { ...base, text: renderAgreementText(base, locale) };
}

export function hashAgreementDocument(document: AgreementDocument): string {
  return hashCanonical(document);
}
