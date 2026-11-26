import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AGE_RANGES, EYE_COLORS, HAIR_COLORS, HEIGHT_RANGES, blankRules, emptyAiPermissions, type Appearance, type LicensingRules, type UsageCategory } from "@suret/shared";
import type { AppConfig } from "./config.js";
import type { AppRepository } from "./repos/types.js";
import type { AccountService } from "./services/accounts.js";
import type { AssetService } from "./services/assets.js";
import type { RuleService } from "./services/rules.js";
import type { Actor } from "./actor.js";

const portraitDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "../data/demo-portraits");

const women = ["Ayşe Yılmaz", "Zeynep Arslan", "Selin Koç", "Deniz Aksoy", "Merve Yıldız", "Nazlı Demir", "İrem Kurt", "Ece Uçar", "Melis Erdoğan", "Sude Aslan", "Ceren Yalçın", "Pınar Güneş"];
const men = ["Mehmet Kaya", "Can Öztürk", "Burak Aydın", "Emre Çelik", "Kerem Acar", "Hakan Polat", "Oğuz Tan", "Baran Şen", "Tolga Kılıç", "Emir Doğan", "Kaan Özdemir", "Yusuf Karaca"];
const cities = ["İstanbul", "Ankara", "İzmir", "Antalya", "Bursa", "Eskişehir"];
const categories: UsageCategory[] = ["advertising", "film", "television", "social_media", "commercial_campaign"];
const channels = ["streaming", "social_media", "cinema", "broadcast_tv", "outdoor"] as const;
const territories = ["TR", "EU", "WORLDWIDE"] as const;

export async function seedDemoCast(input: {
  config: AppConfig;
  repo: AppRepository;
  accounts: AccountService;
  assets: AssetService;
  rules: RuleService;
}): Promise<void> {
  if (!input.config.seedDemoData) return;
  const existing = new Map((await input.repo.listProfiles()).map((profile) => [profile.email, profile]));
  const people = [...women, ...men];
  for (let index = 0; index < people.length; index += 1) {
    const email = `oyuncu${String(index + 1).padStart(2, "0")}@suret.dev`;
    const current = existing.get(email);
    if (current) {
      if (!current.appearance) {
        current.appearance = appearanceFor(index);
        await input.repo.updateProfile(current);
      }
      continue;
    }
    const photo = path.join(portraitDir, `${index < 12 ? "kadin" : "erkek"}-${String((index % 12) + 1).padStart(2, "0")}.jpg`);
    if (!existsSync(photo)) {
      console.warn(`Demo portrait missing: ${photo}`);
      continue;
    }
    const registered = await input.accounts.register({
      email,
      password: input.config.devLoginPassword,
      displayName: people[index],
      role: "face_owner",
    });
    const profile = registered.profile;
    profile.emailVerified = true;
    profile.verificationStatus = "verified";
    profile.bio = `${cities[index % cities.length]} merkezli oyuncu. Proje bazında benzerlik lisansı verir.`;
    profile.location = cities[index % cities.length];
    profile.privacy = { discoverable: true, showPreviewToProducers: true, showLegalName: false };
    profile.appearance = appearanceFor(index);
    await input.repo.updateProfile(profile);
    const actor: Actor = { userId: profile.id, email: profile.email, roles: ["face_owner"], profile };
    await input.rules.create(actor, profile.id, {
      name: `${people[index]} ilanı`,
      publish: true,
      rules: rulesFor(index),
    });
    const bytes = new Uint8Array(readFileSync(photo));
    const uploaded = await input.assets.upload(actor, {
      profileId: profile.id,
      filename: path.basename(photo),
      bytes,
      caption: `${people[index]} — stüdyo portresi`,
      subject: "face",
    });
    await input.assets.attest(actor, uploaded.id, {
      statement: "Bu fotoğraftaki kişiyim ve bu benzerliği lisanslama yetkim var.",
    });
  }
}

function appearanceFor(index: number): Appearance {
  return {
    gender: index < 12 ? "woman" : "man",
    ageRange: AGE_RANGES[index % AGE_RANGES.length],
    heightRange: HEIGHT_RANGES[index % HEIGHT_RANGES.length],
    hairColor: HAIR_COLORS[index % HAIR_COLORS.length],
    eyeColor: EYE_COLORS[(index * 2) % EYE_COLORS.length],
  };
}

function rulesFor(index: number): LicensingRules {
  const rules = blankRules();
  rules.permitted.categories = [categories[index % categories.length]];
  rules.permitted.commercialUse = "commercial";
  const channel = channels[index % channels.length];
  rules.permitted.distributionChannels = channel === "social_media" ? ["social_media"] : [channel, "social_media"];
  rules.permitted.territories = [territories[index % territories.length]];
  rules.permitted.maxDurationDays = 90 + (index % 4) * 30;
  rules.permitted.allowEditing = true;
  rules.permitted.allowCropping = index % 2 === 0;
  rules.permitted.ai = emptyAiPermissions(false);
  rules.prohibited.categories = ["erotic", "political_advertising", "gambling", "ai_training", "voice_cloning", "different_project_without_permission"];
  rules.commercial.pricingMode = "fixed";
  rules.commercial.currency = "TRY";
  rules.commercial.basePriceMinor = (8_000 + index * 1_500) * 100;
  rules.commercial.notes = "Yalnızca seçilen proje için.";
  return rules;
}
