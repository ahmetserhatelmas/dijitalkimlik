import type { Place } from "./places";

export const ROLES = ["face_owner", "producer", "agency_member", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const USAGE_CATEGORIES = [
  "advertising",
  "film",
  "television",
  "social_media",
  "commercial_campaign",
  "ai_still_image",
  "ai_video",
  "digital_character",
  "other",
] as const;
export type UsageCategory = (typeof USAGE_CATEGORIES)[number];

export const SUGGESTED_PROHIBITIONS = [
  "erotic",
  "political_advertising",
  "gambling",
  "alcohol",
  "tobacco",
  "deceptive_endorsement",
  "different_project_without_permission",
  "ai_training",
  "voice_cloning",
  "digital_character",
  "motion_synthesis",
  "sublicensing",
] as const;

export const SUGGESTED_CHANNELS = [
  "cinema",
  "broadcast_tv",
  "streaming",
  "social_media",
  "outdoor",
  "print",
  "in_app",
  "internal",
] as const;

export const SUGGESTED_TERRITORIES = ["WORLDWIDE", "TR", "EU", "US", "UK"] as const;

export const LICENSE_STATUSES = [
  "draft",
  "pending_consent",
  "approved",
  "signed",
  "payment_pending",
  "recording",
  "active",
  "rejected",
  "cancelled",
  "expired",
  "refund_pending",
  "refunded",
  "disputed",
  "recording_failed",
  "suspended",
] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export const REQUEST_STATUSES = ["pending_review", "blocked", "approved", "rejected", "cancelled"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const ASSET_STATUSES = ["pending_review", "authorized", "rejected", "suspended", "removed"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const ASSET_SUBJECTS = ["face", "place", "object"] as const;
export type AssetSubject = (typeof ASSET_SUBJECTS)[number];

export const RULE_STATUSES = ["draft", "published", "archived"] as const;
export type RuleStatus = (typeof RULE_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "initiated",
  "pending",
  "succeeded",
  "failed",
  "cancelled",
  "refund_pending",
  "refunded",
  "not_required",
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CHAIN_STATUSES = ["pending", "submitted", "confirmed", "failed"] as const;
export type ChainStatus = (typeof CHAIN_STATUSES)[number];

export const VERIFICATION_STATUSES = ["unverified", "pending", "verified", "rejected"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const REPRESENTATION_SCOPES = [
  "upload_assets",
  "edit_profile",
  "edit_rules",
  "review_requests",
  "view_agreements",
] as const;
export type RepresentationScope = (typeof REPRESENTATION_SCOPES)[number];

export const CURRENCIES = ["TRY", "USD", "EUR"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const PARTIES = ["licensor", "licensee"] as const;
export type Party = (typeof PARTIES)[number];

export const SIGNATURE_METHOD = "demo_typed_name" as const;

export const DEMO_SIGNATURE_DISCLAIMER =
  "Development implementation. Typing a name here records a demo signature for this workflow. It is not a qualified electronic signature and is not represented as legally equivalent to one. A production deployment needs a legally reviewed signing process.";

export const CONSENT_STATEMENT =
  "I have reviewed this exact agreement, including the granted permissions, restrictions, territory, duration, compensation, and AI-related terms. I understand that later changes to general licensing preferences do not rewrite this agreement.";

export const AI_PERMISSION_KEYS = [
  "transformations",
  "stillImages",
  "video",
  "digitalCharacter",
  "voiceSynthesis",
  "motionSynthesis",
  "modelTraining",
] as const;
export type AiPermissionKey = (typeof AI_PERMISSION_KEYS)[number];

export type AiPermissions = Record<AiPermissionKey, boolean>;

export type CustomProhibition = {
  id: string;
  label: string;
  description: string;
};

export type LicensingRules = {
  permitted: {
    categories: UsageCategory[];
    commercialUse: "commercial" | "non_commercial" | "both";
    distributionChannels: string[];
    territories: string[];
    maxDurationDays: number | null;
    allowDownloadOriginal: boolean;
    allowEditing: boolean;
    allowCropping: boolean;
    ai: AiPermissions;
    sublicensing: boolean;
    additionalCompensationForExpandedUsage: boolean;
    companyAllowlist: string[] | null;
  };
  prohibited: {
    categories: string[];
    custom: CustomProhibition[];
  };
  commercial: {
    pricingMode: "fixed" | "negotiable" | "category_based";
    currency: Currency;
    basePriceMinor: number | null;
    categoryPrices: Record<string, number>;
    expandedRightsFeeMinor: number | null;
    perDayMinor: number | null;
    renewalAllowed: boolean;
    renewalRequiresNewAgreement: boolean;
    sublicensingFeeMinor: number | null;
    notes: string;
  };
};

export type UsageRequest = {
  categories: UsageCategory[];
  commercial: boolean;
  distributionChannels: string[];
  territories: string[];
  startsOn: string;
  endsOn: string;
  downloadOriginal: boolean;
  editing: boolean;
  cropping: boolean;
  ai: AiPermissions;
  sublicensing: boolean;
  contentDeclarations: string[];
  companyName: string;
  proposedAmountMinor: number | null;
  otherCategoryNote: string;
};

export type PrivacySettings = {
  discoverable: boolean;
  showPreviewToProducers: boolean;
  showLegalName: boolean;
};

export const GENDERS = ["woman", "man"] as const;
export const AGE_RANGES = ["18_24", "25_34", "35_44", "45_54", "55_plus"] as const;
export const HEIGHT_RANGES = ["under_160", "160_169", "170_179", "180_189", "190_plus"] as const;
export const HAIR_COLORS = ["black", "brown", "blonde", "red", "gray"] as const;
export const EYE_COLORS = ["brown", "hazel", "green", "blue", "gray"] as const;

export type Appearance = {
  gender: (typeof GENDERS)[number] | null;
  ageRange: (typeof AGE_RANGES)[number] | null;
  heightRange: (typeof HEIGHT_RANGES)[number] | null;
  hairColor: (typeof HAIR_COLORS)[number] | null;
  eyeColor: (typeof EYE_COLORS)[number] | null;
};

export function blankAppearance(): Appearance {
  return { gender: null, ageRange: null, heightRange: null, hairColor: null, eyeColor: null };
}

export type Profile = {
  id: string;
  email: string;
  displayName: string;
  bio: string;
  location: string | null;
  place: Place;
  companyName: string | null;
  appearance: Appearance;
  verificationStatus: VerificationStatus;
  emailVerified: boolean;
  privacy: PrivacySettings;
  deletionRequestedAt: string | null;
  suspendedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FaceAsset = {
  id: string;
  profileId: string;
  uploaderId: string;
  storagePath: string;
  previewPath: string | null;
  fileType: string;
  fileSize: number;
  sha256: string;
  perceptualHash: string | null;
  duplicateFlags: DuplicateFlag[];
  authorizationEvidenceId: string | null;
  subject: AssetSubject;
  caption: string;
  moderationStatus: AssetStatus;
  removalStatus: "active" | "removed";
  listed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DuplicateFlag = {
  kind: "exact" | "similar";
  matchedAssetId: string;
  distance: number | null;
};

export type RuleSet = {
  id: string;
  profileId: string;
  assetId: string | null;
  name: string;
  status: RuleStatus;
  currentVersionId: string | null;
  currentVersionNumber: number;
  createdAt: string;
  updatedAt: string;
};

export type RuleVersion = {
  id: string;
  ruleSetId: string;
  versionNumber: number;
  rules: LicensingRules;
  status: RuleStatus;
  createdBy: string;
  createdAt: string;
};

export type Project = {
  id: string;
  ownerId: string;
  name: string;
  description: string;
  companyName: string;
  status: "active" | "archived";
  createdAt: string;
  updatedAt: string;
};

export type LicenseRequest = {
  id: string;
  producerId: string;
  projectId: string;
  assetId: string;
  ruleVersionId: string | null;
  intendedUse: string;
  usage: UsageRequest;
  compatibility: CompatibilityResult;
  status: RequestStatus;
  decisionNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CompatibilityResult = {
  allowed: boolean;
  violations: RuleViolation[];
};

export type RuleViolation = {
  code: string;
  message: string;
  params?: Record<string, string | number>;
};

export type AgreementDocument = {
  documentVersion: 1;
  licenseId: string;
  agreementId: string;
  ruleSnapshotId: string;
  ruleSetId: string;
  ruleVersionId: string;
  ruleVersionNumber: number;
  licensorProfileId: string;
  licensorDisplayName: string;
  licenseeProfileId: string;
  licenseeCompanyName: string;
  projectId: string;
  projectName: string;
  projectDescription: string;
  assetId: string;
  assetSha256: string;
  intendedUse: string;
  granted: UsageRequest;
  restrictions: LicensingRules["prohibited"];
  commercial: {
    amountMinor: number;
    currency: Currency;
    pricingMode: LicensingRules["commercial"]["pricingMode"];
    formula: string;
  };
  renewalAllowed: boolean;
  renewalRequiresNewAgreement: boolean;
  derivativeClause: string;
  projectBindingClause: string;
  breachClause: string;
  terminationClause: string;
  text: string;
  createdAt: string;
};

export type RuleSnapshot = {
  id: string;
  agreementId: string;
  ruleSetId: string;
  ruleVersionId: string;
  versionNumber: number;
  rules: LicensingRules;
  createdAt: string;
};

export type LicenseAgreement = {
  id: string;
  licenseId: string;
  requestId: string;
  status: LicenseStatus;
  document: AgreementDocument;
  documentHash: string;
  amountMinor: number;
  currency: Currency;
  paymentRequired: boolean;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
};

export type ConsentRecord = {
  id: string;
  agreementId: string;
  party: Party;
  userId: string;
  statement: string;
  agreementHash: string;
  createdAt: string;
};

export type ElectronicSignature = {
  id: string;
  agreementId: string;
  party: Party;
  signerUserId: string;
  typedName: string;
  method: typeof SIGNATURE_METHOD;
  disclaimer: string;
  agreementHash: string;
  ipAddress: string | null;
  userAgent: string | null;
  signedAt: string;
};

export type PaymentRecord = {
  id: string;
  agreementId: string;
  provider: "sandbox" | "iyzico";
  providerRef: string;
  amountMinor: number;
  currency: Currency;
  status: PaymentStatus;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

export type BlockchainRecord = {
  id: string;
  licenseId: string;
  chainId: number | null;
  contractAddress: string | null;
  txHash: string | null;
  agreementHash: string;
  ruleSnapshotHash: string;
  assetReference: string;
  projectReference: string;
  status: ChainStatus;
  error: string | null;
  submittedAt: string | null;
  confirmedAt: string | null;
};

export type MisuseReport = {
  id: string;
  reporterId: string;
  licenseId: string | null;
  assetId: string | null;
  suspectedProject: string;
  url: string | null;
  observedAt: string;
  description: string;
  status: "submitted" | "in_review" | "confirmed" | "dismissed";
  createdAt: string;
  updatedAt: string;
};

export type MisuseEvidence = {
  id: string;
  reportId: string;
  storagePath: string;
  sha256: string;
  fileType: string;
  fileSize: number;
  note: string;
  createdAt: string;
};

export type DisputeCase = {
  id: string;
  reportId: string | null;
  agreementId: string | null;
  status: "open" | "in_review" | "resolved" | "closed";
  summary: string;
  openedBy: string;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  sequence: number;
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
  prevHash: string;
  entryHash: string;
  createdAt: string;
};

export type Notification = {
  id: string;
  userId: string;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

export type Agency = {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
};

export type RepresentationAuthorization = {
  id: string;
  agencyId: string;
  profileId: string;
  scopes: RepresentationScope[];
  status: "pending" | "active" | "revoked";
  evidenceNote: string;
  grantedBy: string;
  createdAt: string;
  revokedAt: string | null;
};

export type PlatformSettings = {
  signatureMode: "demo";
  paymentRequired: boolean;
  chainRequired: boolean;
  maxUploadBytes: number;
  facialRecognitionEnabled: false;
};

export const DEFAULT_PRIVACY: PrivacySettings = {
  discoverable: false,
  showPreviewToProducers: false,
  showLegalName: false,
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  signatureMode: "demo",
  paymentRequired: true,
  chainRequired: true,
  maxUploadBytes: 10 * 1024 * 1024,
  facialRecognitionEnabled: false,
};

export function emptyAiPermissions(value = false): AiPermissions {
  return {
    transformations: value,
    stillImages: value,
    video: value,
    digitalCharacter: value,
    voiceSynthesis: value,
    motionSynthesis: value,
    modelTraining: value,
  };
}

export function blankRules(): LicensingRules {
  return {
    permitted: {
      categories: [],
      commercialUse: "both",
      distributionChannels: [],
      territories: [],
      maxDurationDays: null,
      allowDownloadOriginal: false,
      allowEditing: false,
      allowCropping: false,
      ai: emptyAiPermissions(false),
      sublicensing: false,
      additionalCompensationForExpandedUsage: true,
      companyAllowlist: null,
    },
    prohibited: {
      categories: [],
      custom: [],
    },
    commercial: {
      pricingMode: "negotiable",
      currency: "TRY",
      basePriceMinor: null,
      categoryPrices: {},
      expandedRightsFeeMinor: null,
      perDayMinor: null,
      renewalAllowed: false,
      renewalRequiresNewAgreement: true,
      sublicensingFeeMinor: null,
      notes: "",
    },
  };
}
