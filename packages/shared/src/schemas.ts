import { z } from "zod";
import {
  AGE_RANGES,
  AI_PERMISSION_KEYS,
  CURRENCIES,
  EYE_COLORS,
  GENDERS,
  HAIR_COLORS,
  HEIGHT_RANGES,
  REPRESENTATION_SCOPES,
  ROLES,
  USAGE_CATEGORIES,
} from "./domain";

export const aiPermissionsSchema = z.object({
  transformations: z.boolean(),
  stillImages: z.boolean(),
  video: z.boolean(),
  digitalCharacter: z.boolean(),
  voiceSynthesis: z.boolean(),
  motionSynthesis: z.boolean(),
  modelTraining: z.boolean(),
});

const money = z.number().int().nonnegative().nullable();

export const licensingRulesSchema = z.object({
  permitted: z.object({
    categories: z.array(z.enum(USAGE_CATEGORIES)),
    commercialUse: z.enum(["commercial", "non_commercial", "both"]),
    distributionChannels: z.array(z.string().trim().min(1).max(80)).max(40),
    territories: z.array(z.string().trim().min(2).max(40)).max(80),
    maxDurationDays: z.number().int().positive().max(3650).nullable(),
    allowDownloadOriginal: z.boolean(),
    allowEditing: z.boolean(),
    allowCropping: z.boolean(),
    ai: aiPermissionsSchema,
    sublicensing: z.boolean(),
    additionalCompensationForExpandedUsage: z.boolean(),
    companyAllowlist: z.array(z.string().trim().min(1).max(160)).max(100).nullable(),
  }),
  prohibited: z.object({
    categories: z.array(z.string().trim().min(1).max(80)).max(80),
    custom: z
      .array(
        z.object({
          id: z.string().trim().min(1).max(80),
          label: z.string().trim().min(1).max(160),
          description: z.string().trim().max(500),
        }),
      )
      .max(40),
  }),
  commercial: z.object({
    pricingMode: z.enum(["fixed", "negotiable", "category_based"]),
    currency: z.enum(CURRENCIES),
    basePriceMinor: money,
    categoryPrices: z.record(z.string(), z.number().int().nonnegative()),
    expandedRightsFeeMinor: money,
    perDayMinor: money,
    renewalAllowed: z.boolean(),
    renewalRequiresNewAgreement: z.boolean(),
    sublicensingFeeMinor: money,
    notes: z.string().trim().max(2000),
  }),
});

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const usageRequestSchema = z.object({
  categories: z.array(z.enum(USAGE_CATEGORIES)).min(1),
  commercial: z.boolean(),
  distributionChannels: z.array(z.string().trim().min(1).max(80)).min(1).max(40),
  territories: z.array(z.string().trim().min(2).max(40)).min(1).max(80),
  startsOn: dateOnly,
  endsOn: dateOnly,
  downloadOriginal: z.boolean(),
  editing: z.boolean(),
  cropping: z.boolean(),
  ai: aiPermissionsSchema,
  sublicensing: z.boolean(),
  contentDeclarations: z.array(z.string().trim().min(1).max(80)).max(80),
  companyName: z.string().trim().min(1).max(160),
  proposedAmountMinor: z.number().int().nonnegative().nullable(),
  otherCategoryNote: z.string().trim().max(500),
});

export const registerSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
  displayName: z.string().trim().min(2).max(120),
  role: z.enum(["face_owner", "producer", "agency_member"]),
  companyName: z.string().trim().max(160).optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});

export const appearanceSchema = z.object({
  gender: z.enum(GENDERS).nullable(),
  ageRange: z.enum(AGE_RANGES).nullable(),
  heightRange: z.enum(HEIGHT_RANGES).nullable(),
  hairColor: z.enum(HAIR_COLORS).nullable(),
  eyeColor: z.enum(EYE_COLORS).nullable(),
});

export const profilePatchSchema = z.object({
  displayName: z.string().trim().min(2).max(120).optional(),
  bio: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(120).nullable().optional(),
  place: z.object({
    country: z.string().nullable(),
    province: z.string().nullable(),
  }).optional(),
  companyName: z.string().trim().max(160).nullable().optional(),
  appearance: appearanceSchema.optional(),
  privacy: z
    .object({
      discoverable: z.boolean(),
      showPreviewToProducers: z.boolean(),
      showLegalName: z.boolean(),
    })
    .optional(),
});

export const ruleSetCreateSchema = z.object({
  name: z.string().trim().min(2).max(120),
  assetId: z.string().uuid().nullable().optional(),
  rules: licensingRulesSchema,
  publish: z.boolean().optional(),
});

export const ruleSetUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  rules: licensingRulesSchema,
  publish: z.boolean().optional(),
});

export const projectCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().min(10).max(4000),
  companyName: z.string().trim().min(2).max(160),
});

export const projectPatchSchema = projectCreateSchema.partial();

export const licenseRequestSchema = z.object({
  projectId: z.string().uuid(),
  assetId: z.string().uuid(),
  intendedUse: z.string().trim().min(10).max(4000),
  usage: usageRequestSchema,
});

export const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(2000).optional(),
});

export const signSchema = z.object({
  typedName: z.string().trim().min(2).max(120),
});

export const misuseReportSchema = z.object({
  licenseId: z.string().uuid().nullable().optional(),
  assetId: z.string().uuid().nullable().optional(),
  suspectedProject: z.string().trim().min(2).max(200),
  url: z.string().trim().url().max(2000).nullable().optional(),
  observedAt: z.string().datetime(),
  description: z.string().trim().min(10).max(8000),
});

export const representationSchema = z.object({
  agencyId: z.string().uuid(),
  profileId: z.string().uuid(),
  scopes: z.array(z.enum(REPRESENTATION_SCOPES)).max(REPRESENTATION_SCOPES.length),
  evidenceNote: z.string().trim().min(5).max(2000),
});

export const agencyCreateSchema = z.object({
  name: z.string().trim().min(2).max(160),
});

export const usageCheckSchema = z.object({
  projectId: z.string().uuid(),
  usage: usageRequestSchema,
});

export const disputeSchema = z.object({
  reportId: z.string().uuid().nullable().optional(),
  agreementId: z.string().uuid().nullable().optional(),
  summary: z.string().trim().min(10).max(4000),
});

export const attestationSchema = z.object({
  statement: z.string().trim().min(20).max(2000),
});

export const roleList = ROLES;
export const aiPermissionKeys = AI_PERMISSION_KEYS;
