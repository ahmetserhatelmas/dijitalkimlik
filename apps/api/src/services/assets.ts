import { attestationSchema, blankAppearance, compareHashes, detectImageType, sha256Hex, type AssetSubject, type FaceAsset } from "@suret/shared";
import type { Actor } from "../actor.js";
import { isAdmin } from "../actor.js";
import { AppError, forbidden, notFound } from "../errors.js";
import { newId, nowIso } from "../ids.js";
import { perceptualHashFor } from "../images.js";
import type { AppRepository } from "../repos/types.js";
import type { StorageProvider } from "../storage/types.js";
import { assertAdmin, assertSelfOrScope, hasScope } from "./access.js";

export class AssetService {
  constructor(
    private readonly repo: AppRepository,
    private readonly storage: StorageProvider,
  ) {}

  async upload(actor: Actor, input: { profileId: string; filename: string; bytes: Uint8Array; declaredType?: string; subject?: string; caption?: string }): Promise<FaceAsset> {
    await assertSelfOrScope(this.repo, actor, input.profileId, "upload_assets");
    const settings = await this.repo.getSettings();
    if (input.bytes.byteLength === 0 || input.bytes.byteLength > settings.maxUploadBytes) {
      throw new AppError(413, "FILE_TOO_LARGE", `Photos must be between 1 byte and ${settings.maxUploadBytes} bytes.`);
    }
    const detected = detectImageType(input.bytes);
    if (detected !== "image/png" && detected !== "image/jpeg") {
      throw new AppError(415, "UNSUPPORTED_MEDIA", "Upload a PNG or JPEG image.");
    }
    if (input.declaredType && input.declaredType !== detected) {
      throw new AppError(415, "MEDIA_TYPE_MISMATCH", "The declared file type does not match the file contents.");
    }
    const sha256 = sha256Hex(input.bytes);
    const perceptualHash = perceptualHashFor(input.bytes, detected);
    const fingerprints = await this.repo.listAssetFingerprints();
    const comparison = compareHashes({ sha256, perceptualHash }, fingerprints);
    const duplicateFlags = [
      ...(comparison.exact ? [{ kind: "exact" as const, matchedAssetId: comparison.exact.assetId, distance: 0 }] : []),
      ...comparison.similar.map((item) => ({ kind: "similar" as const, matchedAssetId: item.assetId, distance: item.distance })),
    ];
    const assetId = newId();
    const storagePath = `originals/${input.profileId}/${assetId}`;
    const timestamp = nowIso();
    const published = (await this.repo.listRuleSets(input.profileId)).some((item) => item.status === "published" && item.currentVersionId);
    await this.storage.uploadFile({ path: storagePath, body: input.bytes, contentType: detected });
    const asset: FaceAsset = {
      id: assetId,
      profileId: input.profileId,
      uploaderId: actor.userId,
      storagePath,
      previewPath: null,
      fileType: detected,
      fileSize: input.bytes.byteLength,
      sha256,
      perceptualHash,
      duplicateFlags,
      authorizationEvidenceId: null,
      subject: subjectOf(input.subject),
      caption: (input.caption ?? "").trim().slice(0, 500),
      moderationStatus: published ? "authorized" : "pending_review",
      removalStatus: "active",
      listed: true,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repo.transaction(async (repo) => {
      await repo.insertAsset(asset);
      await repo.appendAudit({
        id: newId(),
        actorId: actor.userId,
        action: "asset_uploaded",
        entityType: "face_asset",
        entityId: asset.id,
        payload: { sha256, duplicateFlags, fileType: detected },
        createdAt: timestamp,
      });
    });
    return asset;
  }

  async attest(actor: Actor, assetId: string, input: unknown): Promise<FaceAsset> {
    const asset = await this.requireAsset(assetId);
    await assertSelfOrScope(this.repo, actor, asset.profileId, "upload_assets");
    const body = attestationSchema.parse(input);
    const attestation = { id: newId(), assetId, statement: body.statement, attestedBy: actor.userId, createdAt: nowIso() };
    asset.authorizationEvidenceId = attestation.id;
    asset.updatedAt = attestation.createdAt;
    await this.repo.transaction(async (repo) => {
      await repo.insertAttestation(attestation);
      await repo.updateAsset(asset);
      await repo.appendAudit({
        id: newId(),
        actorId: actor.userId,
        action: "asset_attested",
        entityType: "face_asset",
        entityId: asset.id,
        payload: { attestationId: attestation.id },
        createdAt: attestation.createdAt,
      });
    });
    return asset;
  }

  async moderate(actor: Actor, assetId: string, status: FaceAsset["moderationStatus"]): Promise<FaceAsset> {
    assertAdmin(actor);
    const asset = await this.requireAsset(assetId);
    if (status === "authorized") {
      const owner = await this.repo.getProfile(asset.profileId);
      if (!owner || owner.verificationStatus !== "verified") {
        throw new AppError(409, "OWNER_NOT_VERIFIED", "Authorize the person before authorizing the asset. A file hash is not proof of identity.");
      }
    }
    asset.moderationStatus = status;
    asset.updatedAt = nowIso();
    await this.repo.updateAsset(asset);
    return asset;
  }

  async setListed(actor: Actor, assetId: string, listed: boolean): Promise<FaceAsset> {
    const asset = await this.requireAsset(assetId);
    if (actor.userId !== asset.profileId && !isAdmin(actor)) throw forbidden();
    if (asset.removalStatus === "removed") throw notFound("Asset not found.");
    asset.listed = listed;
    asset.updatedAt = nowIso();
    await this.repo.updateAsset(asset);
    return asset;
  }

  async signedUrl(actor: Actor, assetId: string, purpose: "original" | "preview"): Promise<{ url: string; expiresInSeconds: number }> {
    const asset = await this.requireAsset(assetId);
    const withdrawn = asset.removalStatus === "removed" || asset.moderationStatus === "removed";
    const isOwner = actor.userId === asset.profileId || (await hasScope(this.repo, actor, asset.profileId, "upload_assets"));
    if (withdrawn) {
      if (purpose !== "original") throw notFound("Asset not found.");
      await this.assertLicenseeMayDownload(actor.userId, asset.id);
    } else if (purpose === "original") {
      if (!isOwner && !isAdmin(actor)) await this.assertLicenseeMayDownload(actor.userId, asset.id);
    } else {
      const owner = await this.repo.getProfile(asset.profileId);
      const producerPreview = actor.roles.includes("producer") && owner?.privacy.showPreviewToProducers && asset.moderationStatus === "authorized";
      if (!isOwner && !isAdmin(actor) && !producerPreview) throw forbidden("This preview is not available.");
    }
    const expiresInSeconds = 120;
    const url = await this.storage.getSignedUrl({ path: asset.storagePath, expiresInSeconds });
    await this.repo.insertAccessLog({
      id: newId(),
      assetId: asset.id,
      actorId: actor.userId,
      action: purpose === "original" ? "signed_url_original" : "signed_url_preview",
      createdAt: nowIso(),
    });
    return { url, expiresInSeconds };
  }

  async remove(actor: Actor, assetId: string): Promise<{ asset: FaceAsset; keptForLicense: boolean }> {
    const asset = await this.requireAsset(assetId);
    if (actor.userId !== asset.profileId && !isAdmin(actor)) throw forbidden();
    const agreements = await this.repo.listAgreements();
    const keptForLicense = agreements.some((item) => item.document.assetId === asset.id && ["active", "recording", "payment_pending", "signed"].includes(item.status));
    if (!keptForLicense) await this.storage.deleteFile(asset.storagePath);
    asset.removalStatus = "removed";
    asset.moderationStatus = "removed";
    asset.listed = false;
    asset.updatedAt = nowIso();
    await this.repo.updateAsset(asset);
    return { asset, keptForLicense };
  }

  async listFor(actor: Actor, profileId?: string): Promise<FaceAsset[]> {
    const ownerId = profileId ?? actor.userId;
    if (profileId) await assertSelfOrScope(this.repo, actor, profileId, "upload_assets");
    const assets = isAdmin(actor) && !profileId ? await this.repo.listAssets() : await this.repo.listAssets({ profileId: ownerId });
    await this.releasePublished(assets);
    if (isAdmin(actor) && !profileId) return assets;
    return assets.filter((item) => item.removalStatus === "active");
  }

  async get(actor: Actor, assetId: string): Promise<FaceAsset> {
    const asset = await this.requireAsset(assetId);
    const visible = actor.userId === asset.profileId || isAdmin(actor) || (await hasScope(this.repo, actor, asset.profileId, "upload_assets"));
    if (!visible && asset.moderationStatus === "authorized") return asset;
    if (!visible) throw forbidden();
    return asset;
  }

  async marketplace() {
    const [assets, profiles, ruleSets] = await Promise.all([
      this.repo.listAssets(),
      this.repo.listProfiles(),
      this.repo.listRuleSets(),
    ]);
    await this.releasePublished(assets, ruleSets);
    const cards = [];
    for (const asset of assets) {
      if (asset.removalStatus !== "active" || asset.listed === false) continue;
      if (asset.moderationStatus === "rejected" || asset.moderationStatus === "suspended" || asset.moderationStatus === "removed") continue;
      const profile = profiles.find((item) => item.id === asset.profileId);
      if (!profile || profile.suspendedAt || profile.deletionRequestedAt || !profile.privacy.discoverable) continue;
      const ruleSet = ruleSets.find((item) => item.profileId === profile.id && item.assetId === asset.id && item.status === "published")
        ?? ruleSets.find((item) => item.profileId === profile.id && item.assetId === null && item.status === "published");
      if (!ruleSet?.currentVersionId) continue;
      const version = await this.repo.getRuleVersion(ruleSet.currentVersionId);
      if (!version) continue;
      let imageUrl: string | null = null;
      try {
        imageUrl = await this.storage.getSignedUrl({ path: asset.storagePath, expiresInSeconds: 60 * 60 });
      } catch {
        imageUrl = null;
      }
      const subject = subjectOf(asset.subject);
      cards.push({
        assetId: asset.id,
        profileId: profile.id,
        displayName: profile.displayName,
        bio: profile.bio,
        location: profile.location,
        appearance: profile.appearance ?? blankAppearance(),
        subject,
        caption: asset.caption?.trim() || profile.bio,
        imageUrl,
        ruleSetId: ruleSet.id,
        ruleVersionNumber: version.versionNumber,
        permittedCategories: version.rules.permitted.categories,
        prohibitedCategories: version.rules.prohibited.categories,
        customProhibitions: version.rules.prohibited.custom.map((item) => item.label),
        channels: version.rules.permitted.distributionChannels,
        territories: version.rules.permitted.territories,
        ai: version.rules.permitted.ai,
        allowDownloadOriginal: version.rules.permitted.allowDownloadOriginal === true,
        commercial: {
          pricingMode: version.rules.commercial.pricingMode,
          currency: version.rules.commercial.currency,
          basePriceMinor: version.rules.commercial.basePriceMinor,
        },
        previewAvailable: true,
      });
    }
    return cards;
  }

  private async releasePublished(assets: FaceAsset[], ruleSets?: Awaited<ReturnType<AppRepository["listRuleSets"]>>): Promise<void> {
    const sets = ruleSets ?? await this.repo.listRuleSets();
    const timestamp = nowIso();
    for (const asset of assets) {
      if (asset.moderationStatus !== "pending_review" || asset.removalStatus !== "active") continue;
      const published = sets.some((item) => item.profileId === asset.profileId && item.status === "published" && item.currentVersionId);
      if (!published) continue;
      asset.moderationStatus = "authorized";
      asset.updatedAt = timestamp;
      await this.repo.updateAsset(asset);
    }
  }

  private async assertLicenseeMayDownload(userId: string, assetId: string): Promise<void> {
    const today = nowIso().slice(0, 10);
    const agreements = await this.repo.listAgreements();
    const matches = agreements.filter((item) => item.status === "active"
      && item.document.assetId === assetId
      && item.document.licenseeProfileId === userId);
    if (matches.some((item) => item.document.granted.startsOn <= today && item.document.granted.endsOn >= today)) return;
    const upcoming = matches.find((item) => item.document.granted.startsOn > today);
    if (upcoming) {
      throw new AppError(409, "DOWNLOAD_NOT_YET", "The file opens on the license start date.", {
        startsOn: upcoming.document.granted.startsOn,
        endsOn: upcoming.document.granted.endsOn,
      });
    }
    if (matches.some((item) => item.document.granted.endsOn < today)) {
      throw new AppError(409, "DOWNLOAD_ENDED", "The license window for this file has ended.");
    }
    throw forbidden("Original files stay private.");
  }

  private async requireAsset(id: string): Promise<FaceAsset> {
    const asset = await this.repo.getAsset(id);
    if (!asset) throw notFound("Asset not found.");
    return asset;
  }
}

function subjectOf(value: string | undefined): AssetSubject {
  return value === "place" || value === "object" ? value : "face";
}
