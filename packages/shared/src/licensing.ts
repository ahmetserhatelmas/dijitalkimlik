import type { AiPermissionKey, AiPermissions, LicensingRules, RuleViolation, UsageRequest } from "./domain";
import { AI_PERMISSION_KEYS } from "./domain";
import { copy, fill, type Locale } from "./i18n";

const AI_PROHIBITION: Partial<Record<AiPermissionKey, string>> = {
  modelTraining: "ai_training",
  voiceSynthesis: "voice_cloning",
  digitalCharacter: "digital_character",
  motionSynthesis: "motion_synthesis",
  video: "ai_video",
  stillImages: "ai_still_image",
  transformations: "ai_transformation",
};

const AI_LABEL: Record<AiPermissionKey, string> = {
  transformations: "AI transformations of the likeness",
  stillImages: "AI-generated still images",
  video: "AI-generated video",
  digitalCharacter: "digital-character creation",
  voiceSynthesis: "voice synthesis or cloning",
  motionSynthesis: "motion synthesis",
  modelTraining: "AI model training",
};

export function inclusiveDays(startsOn: string, endsOn: string): number | null {
  const start = Date.parse(`${startsOn}T00:00:00Z`);
  const end = Date.parse(`${endsOn}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
  return Math.floor((end - start) / 86_400_000) + 1;
}

function prohibitedIds(rules: LicensingRules): Set<string> {
  return new Set([...rules.prohibited.categories, ...rules.prohibited.custom.map((item) => item.id)]);
}

export function validateUsage(rules: LicensingRules, usage: UsageRequest): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const banned = prohibitedIds(rules);

  if (usage.categories.length === 0) {
    violations.push({ code: "category_required", message: "Select at least one usage category." });
  }

  for (const category of usage.categories) {
    if (!rules.permitted.categories.includes(category)) {
      violations.push({
        code: "category_not_permitted",
        message: `${labelCategory(category)} is not in this person's permitted uses.`,
        params: { category },
      });
    }
  }

  if (usage.categories.includes("other") && usage.otherCategoryNote.trim().length < 3) {
    violations.push({
      code: "other_category_note_required",
      message: "Describe the other usage category so it can be reviewed against the person's rules.",
    });
  }

  if (usage.commercial && rules.permitted.commercialUse === "non_commercial") {
    violations.push({ code: "commercial_not_permitted", message: "Commercial use is not permitted." });
  }
  if (!usage.commercial && rules.permitted.commercialUse === "commercial") {
    violations.push({
      code: "non_commercial_not_permitted",
      message: "This person's rules allow commercial use only.",
    });
  }

  for (const channel of usage.distributionChannels) {
    if (!rules.permitted.distributionChannels.includes(channel)) {
      violations.push({
        code: "channel_not_permitted",
        message: `Distribution channel “${channel}” is not permitted.`,
        params: { channel },
      });
    }
  }

  const worldwide = rules.permitted.territories.includes("WORLDWIDE");
  if (!worldwide) {
    for (const territory of usage.territories) {
      if (!rules.permitted.territories.includes(territory)) {
        violations.push({
          code: "territory_not_permitted",
          message: `Territory “${territory}” is outside the permitted territory.`,
          params: { territory },
        });
      }
    }
  }

  const days = inclusiveDays(usage.startsOn, usage.endsOn);
  if (days === null) {
    violations.push({ code: "invalid_duration", message: "The end date must be on or after the start date." });
  }

  if (usage.editing && !rules.permitted.allowEditing) {
    violations.push({ code: "editing_not_permitted", message: "Editing is not permitted." });
  }
  if (usage.cropping && !rules.permitted.allowCropping) {
    violations.push({ code: "cropping_not_permitted", message: "Cropping is not permitted." });
  }

  for (const key of AI_PERMISSION_KEYS) {
    if (!usage.ai[key]) continue;
    if (!rules.permitted.ai[key]) {
      violations.push({
        code: `ai_${key}_not_permitted`,
        message: `${AI_LABEL[key]} is not permitted. A basic photo license does not include this right.`,
        params: { ai: key },
      });
    }
    const prohibition = AI_PROHIBITION[key];
    if (prohibition && banned.has(prohibition)) {
      violations.push({
        code: `ai_${key}_prohibited`,
        message: `${AI_LABEL[key]} is explicitly prohibited.`,
        params: { ai: key },
      });
    }
  }

  if (usage.sublicensing && !rules.permitted.sublicensing) {
    violations.push({ code: "sublicensing_not_permitted", message: "Sublicensing is not permitted." });
  }
  if (usage.sublicensing && banned.has("sublicensing")) {
    violations.push({ code: "sublicensing_prohibited", message: "Sublicensing is explicitly prohibited." });
  }

  if (rules.permitted.companyAllowlist && !rules.permitted.companyAllowlist.includes(usage.companyName)) {
    violations.push({
      code: "company_not_allowed",
      message: `${usage.companyName} is not on the authorized company list.`,
      params: { company: usage.companyName },
    });
  }

  for (const declaration of usage.contentDeclarations) {
    if (banned.has(declaration)) {
      const custom = rules.prohibited.custom.find((item) => item.id === declaration);
      violations.push({
        code: "prohibited_content",
        message: custom
          ? `The request declares “${custom.label}”, which this person prohibits.`
          : `The request declares “${declaration}”, which this person prohibits.`,
        params: { label: custom?.label ?? declaration },
      });
    }
  }

  if (rules.commercial.pricingMode === "negotiable" && usage.proposedAmountMinor === null) {
    violations.push({
      code: "proposed_amount_required",
      message: "This person marked the price as negotiable. Propose an amount for them to accept or reject.",
    });
  }

  return dedupe(violations);
}

export function assertPublishable(rules: LicensingRules): RuleViolation[] {
  const violations: RuleViolation[] = [];
  if (rules.permitted.categories.length === 0) {
    violations.push({ code: "publish_categories", message: "Choose at least one permitted category before publishing." });
  }
  if (rules.permitted.distributionChannels.length === 0) {
    violations.push({ code: "publish_channels", message: "Choose at least one distribution channel before publishing." });
  }
  if (rules.permitted.territories.length === 0) {
    violations.push({ code: "publish_territories", message: "Choose at least one territory before publishing." });
  }
  if (rules.commercial.pricingMode === "fixed" && (rules.commercial.basePriceMinor === null || rules.commercial.basePriceMinor < 0)) {
    violations.push({ code: "publish_price", message: "A fixed price needs a base amount." });
  }
  return violations;
}

export type PriceQuote = {
  amountMinor: number;
  currency: LicensingRules["commercial"]["currency"];
  pricingMode: LicensingRules["commercial"]["pricingMode"];
  negotiable: boolean;
  formula: string;
};

export function quotePrice(rules: LicensingRules, usage: UsageRequest, locale: Locale = "tr"): PriceQuote {
  const phrases = copy(locale).formula;
  const commercial = rules.commercial;
  const days = inclusiveDays(usage.startsOn, usage.endsOn) ?? 0;
  if (commercial.pricingMode === "negotiable") {
    return {
      amountMinor: usage.proposedAmountMinor ?? 0,
      currency: commercial.currency,
      pricingMode: commercial.pricingMode,
      negotiable: true,
      formula: phrases.negotiated,
    };
  }

  let amount = 0;
  const parts: string[] = [];
  if (commercial.pricingMode === "category_based") {
    const prices = usage.categories.map((category) => commercial.categoryPrices[category] ?? 0);
    amount = prices.reduce((sum, price) => sum + price, 0);
    parts.push(phrases.categories);
  } else {
    amount = commercial.basePriceMinor ?? 0;
    parts.push(phrases.base);
  }

  const aiRequested = AI_PERMISSION_KEYS.some((key) => usage.ai[key]);
  if (aiRequested && commercial.expandedRightsFeeMinor) {
    amount += commercial.expandedRightsFeeMinor;
    parts.push(phrases.expanded);
  }
  if (usage.sublicensing && commercial.sublicensingFeeMinor) {
    amount += commercial.sublicensingFeeMinor;
    parts.push(phrases.sublicensing);
  }
  if (commercial.perDayMinor && days > 0) {
    amount += commercial.perDayMinor * days;
    parts.push(fill(phrases.daily, { days }));
  }

  return {
    amountMinor: amount,
    currency: commercial.currency,
    pricingMode: commercial.pricingMode,
    negotiable: false,
    formula: parts.join(" + "),
  };
}

export function evaluateLicenseCoverage(input: {
  licenseStatus: string;
  licensedProjectId: string;
  licensedAssetId: string;
  granted: UsageRequest;
  attemptProjectId: string;
  attemptAssetId: string;
  attempt: UsageRequest;
}): RuleViolation[] {
  const violations: RuleViolation[] = [];
  if (input.licenseStatus !== "active") {
    violations.push({
      code: "license_not_active",
      message: `This license is ${input.licenseStatus} and cannot authorize use.`,
      params: { status: input.licenseStatus },
    });
  }
  if (input.attemptAssetId !== input.licensedAssetId) {
    violations.push({
      code: "asset_mismatch",
      message: "This license is bound to a specific asset. A re-upload receives a new asset ID and needs its own agreement.",
    });
  }
  if (input.attemptProjectId !== input.licensedProjectId) {
    violations.push({
      code: "project_mismatch",
      message:
        "This license is bound to one project. A different project needs its own agreement, even if the project name matches.",
    });
  }

  const granted = input.granted;
  const attempt = input.attempt;
  for (const category of attempt.categories) {
    if (!granted.categories.includes(category)) {
      violations.push({
        code: "granted_category",
        message: `${labelCategory(category)} was not granted by this agreement.`,
        params: { category },
      });
    }
  }
  if (attempt.commercial && !granted.commercial) {
    violations.push({ code: "granted_commercial", message: "Commercial use was not granted." });
  }
  for (const channel of attempt.distributionChannels) {
    if (!granted.distributionChannels.includes(channel)) {
      violations.push({ code: "granted_channel", message: `Channel “${channel}” was not granted.`, params: { channel } });
    }
  }
  if (!granted.territories.includes("WORLDWIDE")) {
    for (const territory of attempt.territories) {
      if (!granted.territories.includes(territory)) {
        violations.push({ code: "granted_territory", message: `Territory “${territory}” was not granted.`, params: { territory } });
      }
    }
  }
  if (attempt.startsOn < granted.startsOn || attempt.endsOn > granted.endsOn) {
    violations.push({ code: "granted_duration", message: "The dates fall outside the licensed window." });
  }
  if (attempt.editing && !granted.editing) {
    violations.push({ code: "granted_editing", message: "Editing was not granted." });
  }
  if (attempt.cropping && !granted.cropping) {
    violations.push({ code: "granted_cropping", message: "Cropping was not granted." });
  }
  for (const key of AI_PERMISSION_KEYS) {
    if (attempt.ai[key] && !granted.ai[key]) {
      violations.push({
        code: `granted_ai_${key}`,
        message: `${AI_LABEL[key]} was not granted by this agreement.`,
        params: { ai: key },
      });
    }
  }
  if (attempt.sublicensing && !granted.sublicensing) {
    violations.push({ code: "granted_sublicensing", message: "Sublicensing was not granted." });
  }
  return violations;
}

export function labelCategory(category: string): string {
  return category.replaceAll("_", " ");
}

function dedupe(violations: RuleViolation[]): RuleViolation[] {
  const seen = new Set<string>();
  return violations.filter((item) => {
    const key = `${item.code}:${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function anyAiRequested(ai: AiPermissions): boolean {
  return AI_PERMISSION_KEYS.some((key) => ai[key]);
}
