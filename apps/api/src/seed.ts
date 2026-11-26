import { blankRules, emptyAiPermissions, type LicensingRules } from "@suret/shared";
import type { AppConfig } from "./config.js";
import { checkerPng } from "./images.js";
import type { AppRepository } from "./repos/types.js";
import type { AccountService } from "./services/accounts.js";
import type { AssetService } from "./services/assets.js";
import type { LicenseService } from "./services/licensing.js";
import type { RuleService } from "./services/rules.js";
import type { Actor } from "./actor.js";

export async function seedDemoData(input: {
  config: AppConfig;
  repo: AppRepository;
  accounts: AccountService;
  assets: AssetService;
  rules: RuleService;
  licenses: LicenseService;
}): Promise<void> {
  if (!input.config.seedDemoData) return;
  if ((await input.repo.listProfiles()).length > 0) return;
  const password = input.config.devLoginPassword;
  const owner = await input.accounts.register({
    email: "elif@suret.dev",
    password,
    displayName: "Elif Demir",
    role: "face_owner",
  });
  const producer = await input.accounts.register({
    email: "northstar@suret.dev",
    password,
    displayName: "Northstar Pictures",
    role: "producer",
    companyName: "Northstar Pictures",
  });
  const agencyUser = await input.accounts.register({
    email: "agency@suret.dev",
    password,
    displayName: "Mira Casting",
    role: "agency_member",
    companyName: "Mira Casting",
  });
  const admin = await input.accounts.register({
    email: "admin@suret.dev",
    password,
    displayName: "Platform yöneticisi",
    role: "face_owner",
  });
  await input.repo.setRoles(admin.profile.id, ["admin"]);

  const ownerProfile = owner.profile;
  ownerProfile.emailVerified = true;
  ownerProfile.verificationStatus = "verified";
  ownerProfile.bio = "Projeye özel ticari benzerlik lisansları için uygun oyuncu.";
  ownerProfile.place = { country: "TR", province: "TR-34" };
  ownerProfile.location = "İstanbul, Türkiye";
  ownerProfile.privacy = { discoverable: true, showPreviewToProducers: true, showLegalName: false };
  await input.repo.updateProfile(ownerProfile);
  for (const profile of [producer.profile, agencyUser.profile, admin.profile]) {
    profile.emailVerified = true;
    profile.verificationStatus = "verified";
    await input.repo.updateProfile(profile);
  }

  const ownerActor: Actor = { userId: owner.profile.id, email: owner.profile.email, roles: ["face_owner"], profile: ownerProfile };
  const uploaded = await input.assets.upload(ownerActor, {
    profileId: owner.profile.id,
    filename: "studio-portrait.png",
    bytes: new Uint8Array(checkerPng(64)),
  });
  await input.assets.attest(ownerActor, uploaded.id, {
    statement: "Bu fotoğraftaki kişiyim ve bu benzerliği lisanslama yetkim var.",
  });
  const adminActor: Actor = { userId: admin.profile.id, email: admin.profile.email, roles: ["admin"], profile: { ...admin.profile, emailVerified: true, verificationStatus: "verified" } };
  await input.assets.moderate(adminActor, uploaded.id, "authorized");

  await input.rules.create(ownerActor, owner.profile.id, {
    name: "Elif’in ticari tercihleri",
    publish: true,
    rules: elifRules(),
  });

  const producerActor: Actor = {
    userId: producer.profile.id,
    email: producer.profile.email,
    roles: ["producer"],
    profile: { ...producer.profile, emailVerified: true, verificationStatus: "verified", companyName: "Northstar Pictures" },
  };
  await input.licenses.createProject(producerActor, {
    name: "Kuzey Yıldız Astronot Kampanyası",
    description: "Astronot temalı, üç aylık bir yayın akışı reklamı.",
    companyName: "Northstar Pictures",
  });
  await input.licenses.createProject(producerActor, {
    name: "Karadeniz Uzun Metraj",
    description: "Ayrı bir dram filmi. Bir reklam lisansı bu projeyi kapsamaz.",
    companyName: "Northstar Pictures",
  });

  const agencyActor: Actor = {
    userId: agencyUser.profile.id,
    email: agencyUser.profile.email,
    roles: ["agency_member"],
    profile: { ...agencyUser.profile, emailVerified: true },
  };
  await input.accounts.createAgency(agencyActor, { name: "Mira Casting" });
}

function elifRules(): LicensingRules {
  const rules = blankRules();
  rules.permitted.categories = ["advertising"];
  rules.permitted.commercialUse = "commercial";
  rules.permitted.distributionChannels = ["streaming", "social_media"];
  rules.permitted.territories = ["TR"];
  rules.permitted.maxDurationDays = 90;
  rules.permitted.allowEditing = true;
  rules.permitted.allowCropping = true;
  rules.permitted.ai = emptyAiPermissions(false);
  rules.prohibited.categories = ["erotic", "political_advertising", "gambling", "ai_training", "voice_cloning", "different_project_without_permission"];
  rules.commercial.pricingMode = "fixed";
  rules.commercial.currency = "TRY";
  rules.commercial.basePriceMinor = 250_000;
  rules.commercial.notes = "Yalnızca reklam. Başka bir proje yeni bir sözleşme gerektirir.";
  return rules;
}
