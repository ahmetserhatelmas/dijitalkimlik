import { describe, expect, it } from "vitest";
import {
  activationBlockers,
  averageHash,
  blankRules,
  buildAgreementDocument,
  compareHashes,
  detectImageType,
  emptyAiPermissions,
  evaluateLicenseCoverage,
  hashAgreementDocument,
  hashesMatch,
  hammingDistance,
  nextAuditHash,
  quotePrice,
  signPayload,
  validateUsage,
  verifySignedPayload,
  type LicensingRules,
  type UsageRequest,
} from "../src/index";

function rules(patch?: Partial<LicensingRules>): LicensingRules {
  const base = blankRules();
  return {
    ...base,
    ...patch,
    permitted: { ...base.permitted, ...patch?.permitted, ai: { ...base.permitted.ai, ...patch?.permitted?.ai } },
    prohibited: { ...base.prohibited, ...patch?.prohibited },
    commercial: { ...base.commercial, ...patch?.commercial },
  };
}

function usage(patch?: Partial<UsageRequest>): UsageRequest {
  const { ai: aiPatch, ...rest } = patch ?? {};
  return {
    categories: ["advertising"],
    commercial: true,
    distributionChannels: ["streaming"],
    territories: ["TR"],
    startsOn: "2026-11-01",
    endsOn: "2027-01-29",
    downloadOriginal: false,
    editing: false,
    cropping: false,
    sublicensing: false,
    contentDeclarations: [],
    companyName: "Northstar Pictures",
    proposedAmountMinor: 250_000,
    otherCategoryNote: "",
    ...rest,
    ai: { ...emptyAiPermissions(false), ...aiPatch },
  };
}

const elifRules = rules({
  permitted: {
    categories: ["advertising"],
    commercialUse: "commercial",
    distributionChannels: ["streaming", "social_media"],
    territories: ["TR"],
    maxDurationDays: 90,
    allowDownloadOriginal: false,
    allowEditing: true,
    allowCropping: true,
    ai: emptyAiPermissions(false),
    sublicensing: false,
    additionalCompensationForExpandedUsage: true,
    companyAllowlist: null,
  },
  prohibited: {
    categories: ["erotic", "political_advertising", "gambling", "ai_training", "voice_cloning"],
    custom: [{ id: "weapons", label: "Weapons advertising", description: "No weapons campaigns." }],
  },
  commercial: {
    pricingMode: "fixed",
    currency: "TRY",
    basePriceMinor: 250_000,
    categoryPrices: { advertising: 250_000 },
    expandedRightsFeeMinor: 100_000,
    perDayMinor: null,
    renewalAllowed: false,
    renewalRequiresNewAgreement: true,
    sublicensingFeeMinor: null,
    notes: "Project-specific advertising only.",
  },
});

describe("user-defined rules", () => {
  it("lets a person permit and prohibit their own categories", () => {
    const permissive = rules({
      permitted: {
        categories: ["film"],
        commercialUse: "both",
        distributionChannels: ["cinema"],
        territories: ["WORLDWIDE"],
        maxDurationDays: null,
        allowDownloadOriginal: true,
        allowEditing: true,
        allowCropping: true,
        ai: { ...emptyAiPermissions(true), modelTraining: false },
        sublicensing: true,
        additionalCompensationForExpandedUsage: false,
        companyAllowlist: null,
      },
      prohibited: { categories: [], custom: [] },
      commercial: {
        pricingMode: "fixed",
        currency: "USD",
        basePriceMinor: 100,
        categoryPrices: {},
        expandedRightsFeeMinor: null,
        perDayMinor: null,
        renewalAllowed: true,
        renewalRequiresNewAgreement: true,
        sublicensingFeeMinor: null,
        notes: "",
      },
    });
    expect(validateUsage(permissive, usage({
      categories: ["film"],
      commercial: false,
      distributionChannels: ["cinema"],
      territories: ["US"],
      downloadOriginal: true,
      ai: { ...emptyAiPermissions(true), modelTraining: false },
      sublicensing: true,
      proposedAmountMinor: null,
    }))).toEqual([]);

    expect(validateUsage(elifRules, usage()).map((item) => item.code)).toEqual([]);
    expect(validateUsage(elifRules, usage({ categories: ["film"] })).some((item) => item.code === "category_not_permitted")).toBe(true);
  });

  it("blocks a request that violates a mandatory restriction", () => {
    const erotic = validateUsage(elifRules, usage({ contentDeclarations: ["erotic"] }));
    expect(erotic.some((item) => item.code === "prohibited_content")).toBe(true);
    const custom = validateUsage(elifRules, usage({ contentDeclarations: ["weapons"] }));
    expect(custom[0]?.message).toContain("Weapons advertising");
  });

  it("checks AI-derived permissions separately from a photo license", () => {
    const training = validateUsage(elifRules, usage({ ai: { modelTraining: true } }));
    expect(training.map((item) => item.code)).toEqual(expect.arrayContaining(["ai_modelTraining_not_permitted", "ai_modelTraining_prohibited"]));
    const character = validateUsage(elifRules, usage({ ai: { digitalCharacter: true, transformations: false } }));
    expect(character.some((item) => item.code === "ai_digitalCharacter_not_permitted")).toBe(true);
    expect(validateUsage(elifRules, usage({ editing: true }))).toEqual([]);
  });
});

describe("project-specific coverage", () => {
  const granted = usage();

  it("does not let an astronaut advertisement license cover a different film", () => {
    const violations = evaluateLicenseCoverage({
      licenseStatus: "active",
      licensedProjectId: "project-astronaut",
      licensedAssetId: "asset-1",
      granted,
      attemptProjectId: "project-film",
      attemptAssetId: "asset-1",
      attempt: usage({ categories: ["film"] }),
    });
    expect(violations.some((item) => item.code === "project_mismatch")).toBe(true);
    expect(violations.some((item) => item.code === "granted_category")).toBe(true);
  });

  it("does not treat a matching project name as authorization", () => {
    const renamed = evaluateLicenseCoverage({
      licenseStatus: "active",
      licensedProjectId: "project-astronaut",
      licensedAssetId: "asset-1",
      granted,
      attemptProjectId: "project-new-with-same-name",
      attemptAssetId: "asset-1",
      attempt: granted,
    });
    expect(renamed.map((item) => item.code)).toEqual(["project_mismatch"]);
    const reupload = evaluateLicenseCoverage({
      licenseStatus: "active",
      licensedProjectId: "project-astronaut",
      licensedAssetId: "asset-1",
      granted,
      attemptProjectId: "project-astronaut",
      attemptAssetId: "asset-2",
      attempt: granted,
    });
    expect(reupload.map((item) => item.code)).toEqual(["asset_mismatch"]);
    const same = evaluateLicenseCoverage({
      licenseStatus: "active",
      licensedProjectId: "project-astronaut",
      licensedAssetId: "asset-1",
      granted,
      attemptProjectId: "project-astronaut",
      attemptAssetId: "asset-1",
      attempt: granted,
    });
    expect(same).toEqual([]);
  });
});

describe("agreement integrity", () => {
  const document = buildAgreementDocument({
    documentVersion: 1,
    licenseId: "license-1",
    agreementId: "agreement-1",
    ruleSnapshotId: "snap-1",
    ruleSetId: "rules-1",
    ruleVersionId: "version-1",
    ruleVersionNumber: 1,
    licensorProfileId: "owner",
    licensorDisplayName: "Elif Demir",
    licenseeProfileId: "producer",
    licenseeCompanyName: "Northstar Pictures",
    projectId: "project-astronaut",
    projectName: "Astronaut campaign",
    projectDescription: "A three-month streaming advertisement.",
    assetId: "asset-1",
    assetSha256: "abc",
    intendedUse: "Astronaut-themed advertisement.",
    granted: usage(),
    restrictions: elifRules.prohibited,
    commercial: { amountMinor: 250_000, currency: "TRY", pricingMode: "fixed", formula: "base price" },
    renewalAllowed: false,
    renewalRequiresNewAgreement: true,
    createdAt: "2026-10-10T00:00:00.000Z",
  });

  it("preserves the exact hashed agreement and detects a mismatch", () => {
    const hash = hashAgreementDocument(document);
    expect(hashesMatch(document, hash)).toBe(true);
    const edited = { ...document, granted: usage({ categories: ["film"] }) };
    expect(hashesMatch(edited, hash)).toBe(false);
  });

  it("keeps a signed snapshot stable when a copy of the general rules changes", () => {
    const snapshot = structuredClone(elifRules);
    const accepted = structuredClone(snapshot);
    snapshot.prohibited.categories.push("alcohol");
    snapshot.permitted.categories.push("film");
    expect(accepted.prohibited.categories).not.toContain("alcohol");
    expect(accepted.permitted.categories).toEqual(["advertising"]);
  });
});

describe("activation requirements", () => {
  it("refuses to treat a license as active without consent, signature, payment, and chain confirmation", () => {
    const hash = "a".repeat(64);
    expect(activationBlockers({
      consents: [],
      signatures: [],
      expectedHash: hash,
      paymentStatus: "succeeded",
      paymentRequired: true,
      chainStatus: null,
      chainRequired: true,
    })).toHaveLength(5);

    expect(activationBlockers({
      consents: [{ party: "licensor" }, { party: "licensee" }],
      signatures: [
        { party: "licensor", agreementHash: hash },
        { party: "licensee", agreementHash: hash },
      ],
      expectedHash: hash,
      paymentStatus: "succeeded",
      paymentRequired: true,
      chainStatus: "confirmed",
      chainRequired: true,
    })).toEqual([]);

    expect(activationBlockers({
      consents: [{ party: "licensor" }, { party: "licensee" }],
      signatures: [
        { party: "licensor", agreementHash: hash },
        { party: "licensee", agreementHash: hash },
      ],
      expectedHash: hash,
      paymentStatus: "pending",
      paymentRequired: true,
      chainStatus: "confirmed",
      chainRequired: true,
    })).toEqual(["Payment has not been confirmed by the server."]);
  });
});

describe("duplicate detection", () => {
  it("flags identical files and close perceptual hashes without treating them as identity", () => {
    const width = 16;
    const height = 16;
    const left = new Uint8Array(width * height);
    const right = new Uint8Array(width * height);
    const other = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const value = ((Math.floor(x / 2) + Math.floor(y / 2)) % 2) * 240;
        left[y * width + x] = value;
        right[y * width + x] = value;
        other[y * width + x] = (x * 17 + y * 3) % 255;
      }
    }
    right[0] = right[0] === 0 ? 12 : right[0] - 12;
    const leftHash = averageHash(left, width, height);
    const rightHash = averageHash(right, width, height);
    const otherHash = averageHash(other, width, height);
    expect(hammingDistance(leftHash, rightHash)).toBeLessThanOrEqual(10);
    expect(hammingDistance(leftHash, otherHash)).toBeGreaterThan(10);

    const comparison = compareHashes(
      { sha256: "same", perceptualHash: leftHash },
      [
        { assetId: "original", sha256: "same", perceptualHash: leftHash },
        { assetId: "resized", sha256: "different", perceptualHash: rightHash },
        { assetId: "unrelated", sha256: "other", perceptualHash: otherHash },
      ],
    );
    expect(comparison.exact).toEqual({ assetId: "original" });
    expect(comparison.similar.map((item) => item.assetId)).toEqual(["resized"]);
  });

  it("recognizes png, jpeg, and webp magic bytes", () => {
    expect(detectImageType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe("image/png");
    expect(detectImageType(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]))).toBe("image/jpeg");
    expect(detectImageType(Uint8Array.from([0, 1, 2, 3]))).toBeNull();
  });
});

describe("payments and audit hashing", () => {
  it("verifies webhook signatures and rejects stale or altered bodies", () => {
    const body = JSON.stringify({ eventId: "evt-1", status: "succeeded" });
    const timestamp = "1000000";
    const signature = signPayload("secret", timestamp, body);
    expect(verifySignedPayload({ secret: "secret", timestamp, rawBody: body, signature, nowMs: 1000000 })).toEqual({ ok: true });
    expect(verifySignedPayload({ secret: "secret", timestamp, rawBody: body, signature: "nope", nowMs: 1000000 }).ok).toBe(false);
    expect(verifySignedPayload({
      secret: "secret",
      timestamp,
      rawBody: body.replace("succeeded", "failed"),
      signature,
      nowMs: 1000000,
    }).ok).toBe(false);
  });

  it("chains audit hashes so a changed entry breaks the link", () => {
    const first = nextAuditHash("genesis", { action: "create", id: "1" });
    const second = nextAuditHash(first, { action: "sign", id: "1" });
    const tampered = nextAuditHash(first, { action: "sign", id: "2" });
    expect(second).not.toBe(tampered);
  });

  it("quotes a fixed price on the server instead of trusting a lower proposal", () => {
    const quote = quotePrice(elifRules, usage({ proposedAmountMinor: 1 }));
    expect(quote.amountMinor).toBe(250_000);
    expect(quote.negotiable).toBe(false);
  });
});
