import {
  buildAgreementDocument,
  copy,
  fill,
  canTransition,
  decisionSchema,
  evaluateLicenseCoverage,
  hashAgreementDocument,
  hashCanonical,
  licenseRequestSchema,
  projectCreateSchema,
  projectPatchSchema,
  quotePrice,
  readyForRecording,
  sha256Bytes32,
  signSchema,
  usageCheckSchema,
  validateUsage,
  type BlockchainRecord,
  type LicenseAgreement,
  type PaymentRecord,
  type LicenseRequest,
  type LicenseStatus,
  type Project,
  type Locale,
  type RuleVersion,
} from "@suret/shared";
import type { Actor } from "../actor.js";
import { isAdmin } from "../actor.js";
import type { ChainClient } from "../chain/types.js";
import { AppError, forbidden, notFound } from "../errors.js";
import { newId, nowIso, todayUtc } from "../ids.js";
import type { AppRepository } from "../repos/types.js";
import { hasScope } from "./access.js";

export class LicenseService {
  constructor(
    private readonly repo: AppRepository,
    private readonly chain: ChainClient,
    private readonly sandboxPayments = false,
  ) {}

  async createProject(actor: Actor, input: unknown): Promise<Project> {
    if (!actor.roles.includes("producer") && !isAdmin(actor)) throw forbidden("A producer account is required.");
    const body = projectCreateSchema.parse(input);
    const timestamp = nowIso();
    const project: Project = {
      id: newId(),
      ownerId: actor.userId,
      name: body.name,
      description: body.description,
      companyName: body.companyName,
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repo.transaction(async (repo) => {
      await repo.insertProject(project);
      await repo.addProjectMember(project.id, actor.userId, "owner", timestamp);
    });
    return project;
  }

  async updateProject(actor: Actor, projectId: string, input: unknown): Promise<Project> {
    const project = await this.requireProject(projectId);
    if (!(await this.repo.isProjectMember(projectId, actor.userId)) && !isAdmin(actor)) throw forbidden();
    const body = projectPatchSchema.parse(input);
    if (body.name) project.name = body.name;
    if (body.description) project.description = body.description;
    if (body.companyName) project.companyName = body.companyName;
    project.updatedAt = nowIso();
    await this.repo.updateProject(project);
    return project;
  }

  async preview(actor: Actor, input: unknown, locale: Locale = "tr") {
    this.assertVerified(actor);
    const body = licenseRequestSchema.parse(input);
    const context = await this.loadRequestContext(actor, body.projectId, body.assetId);
    const violations = validateUsage(context.version.rules, body.usage);
    return {
      allowed: violations.length === 0,
      violations,
      quote: violations.length === 0 ? quotePrice(context.version.rules, body.usage, locale) : null,
      ruleVersionId: context.version.id,
      ruleVersionNumber: context.version.versionNumber,
    };
  }

  async createRequest(actor: Actor, input: unknown, locale: Locale = "tr"): Promise<{ request: LicenseRequest; agreement: LicenseAgreement | null }> {
    this.assertVerified(actor);
    const body = licenseRequestSchema.parse(input);
    return this.repo.transaction(async (repo) => {
      const context = await this.loadRequestContext(actor, body.projectId, body.assetId, repo);
      const violations = validateUsage(context.version.rules, body.usage);
      const timestamp = nowIso();
      const request: LicenseRequest = {
        id: newId(),
        producerId: actor.userId,
        projectId: body.projectId,
        assetId: body.assetId,
        ruleVersionId: context.version.id,
        intendedUse: body.intendedUse,
        usage: body.usage,
        compatibility: { allowed: violations.length === 0, violations },
        status: violations.length === 0 ? "pending_review" : "blocked",
        decisionNote: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      await repo.insertRequest(request);
      await repo.appendAudit({
        id: newId(),
        actorId: actor.userId,
        action: violations.length === 0 ? "license_requested" : "license_request_blocked",
        entityType: "license_request",
        entityId: request.id,
        payload: { violations },
        createdAt: timestamp,
      });
      if (violations.length > 0) return { request, agreement: null };
      const agreement = await this.createDraft(repo, request, context, timestamp, locale);
      const phrases = copy(locale).notifications;
      await this.notify(repo, context.owner.id, phrases.requestTitle, fill(phrases.requestBody, { project: context.project.name }), `/owner/requests/${request.id}`, timestamp);
      return { request, agreement };
    });
  }

  async decide(actor: Actor, requestId: string, input: unknown, locale: Locale = "tr"): Promise<LicenseAgreement> {
    const body = decisionSchema.parse(input);
    const sealed = await this.repo.transaction(async (repo) => {
      const request = await repo.getRequest(requestId);
      if (!request || request.status !== "pending_review") throw notFound("There is no pending request to decide.");
      const asset = await repo.getAsset(request.assetId);
      if (!asset) throw notFound("Asset not found.");
      if (actor.userId !== asset.profileId) {
        throw forbidden("Only the person licensing their likeness can approve or reject this request.");
      }
      const agreement = await repo.getAgreementByRequestId(request.id);
      if (!agreement) throw notFound("Agreement not found.");
      const timestamp = nowIso();
      if (body.decision === "approve" && agreement.paymentRequired && this.sandboxPayments) {
        const balance = await repo.getWalletBalance(agreement.document.licenseeProfileId);
        if (balance < agreement.amountMinor) {
          throw new AppError(402, "INSUFFICIENT_FUNDS", "The fake balance does not cover this agreement.");
        }
      }
      request.status = body.decision === "approve" ? "approved" : "rejected";
      request.decisionNote = body.note ?? null;
      request.updatedAt = timestamp;
      await repo.updateRequest(request);
      if (body.decision === "reject") {
        await this.move(repo, agreement, "rejected");
      } else {
        await this.sealAcceptance(repo, agreement, timestamp, locale);
      }
      await repo.appendAudit({
        id: newId(),
        actorId: actor.userId,
        action: body.decision === "approve" ? "license_approved" : "license_rejected",
        entityType: "license_agreement",
        entityId: agreement.id,
        payload: { note: body.note ?? null },
        createdAt: timestamp,
      });
      return (await repo.getAgreement(agreement.id))!;
    });
    return this.recordIfReady(actor, sealed);
  }

  async complete(actor: Actor, agreementId: string, locale: Locale = "tr"): Promise<LicenseAgreement> {
    const sealed = await this.repo.transaction(async (repo) => {
      const agreement = await this.requireAgreement(repo, agreementId);
      if (actor.userId !== agreement.document.licensorProfileId) {
        throw forbidden("Only the person licensing their likeness can approve this request.");
      }
      if (agreement.status !== "pending_consent" && agreement.status !== "approved") {
        throw new AppError(409, "INVALID_TRANSITION", "This request is not waiting for approval.");
      }
      const timestamp = nowIso();
      if (agreement.paymentRequired && this.sandboxPayments) {
        const balance = await repo.getWalletBalance(agreement.document.licenseeProfileId);
        if (balance < agreement.amountMinor) {
          throw new AppError(402, "INSUFFICIENT_FUNDS", "The fake balance does not cover this agreement.");
        }
      }
      await this.sealAcceptance(repo, agreement, timestamp, locale);
      return (await repo.getAgreement(agreement.id))!;
    });
    return this.recordIfReady(actor, sealed);
  }

  private async recordIfReady(actor: Actor, agreement: LicenseAgreement): Promise<LicenseAgreement> {
    if (agreement.status === "recording") {
      try {
        await this.submitChain(actor, agreement.licenseId);
      } catch {
        // A failed write stays recording_failed. Approval does not mark the license active.
      }
    }
    return (await this.repo.getAgreement(agreement.id))!;
  }

  private async sealAcceptance(repo: AppRepository, agreement: LicenseAgreement, timestamp: string, locale: Locale): Promise<void> {
    const phrases = copy(locale).legal;
    if (agreement.status === "draft") await this.move(repo, agreement, "pending_consent");
    const consents = await repo.listConsents(agreement.id);
    for (const party of ["licensor", "licensee"] as const) {
      if (consents.some((item) => item.party === party)) continue;
      await repo.insertConsent({
        id: newId(),
        agreementId: agreement.id,
        party,
        userId: party === "licensor" ? agreement.document.licensorProfileId : agreement.document.licenseeProfileId,
        statement: phrases.consent,
        agreementHash: agreement.documentHash,
        createdAt: timestamp,
      });
    }
    if (agreement.status === "pending_consent") await this.move(repo, agreement, "approved");
    const signatures = await repo.listSignatures(agreement.id);
    for (const party of ["licensor", "licensee"] as const) {
      if (signatures.some((item) => item.party === party)) continue;
      await repo.insertSignature({
        id: newId(),
        agreementId: agreement.id,
        party,
        signerUserId: party === "licensor" ? agreement.document.licensorProfileId : agreement.document.licenseeProfileId,
        typedName: party === "licensor" ? agreement.document.licensorDisplayName : agreement.document.licenseeCompanyName,
        method: "demo_typed_name",
        disclaimer: phrases.approval,
        agreementHash: agreement.documentHash,
        ipAddress: null,
        userAgent: null,
        signedAt: timestamp,
      });
    }
    if (agreement.status === "approved") await this.move(repo, agreement, "signed");
    if (agreement.paymentRequired && this.sandboxPayments) {
      await this.move(repo, agreement, "payment_pending");
      await this.collectSandbox(repo, agreement, timestamp);
      await this.move(repo, agreement, "recording");
    } else if (agreement.paymentRequired) {
      await this.move(repo, agreement, "payment_pending");
    } else {
      await this.move(repo, agreement, "recording");
    }
  }

  private async collectSandbox(repo: AppRepository, agreement: LicenseAgreement, timestamp: string): Promise<void> {
    await repo.adjustWallet(agreement.document.licenseeProfileId, -agreement.amountMinor);
    const payment: PaymentRecord = {
      id: newId(),
      agreementId: agreement.id,
      provider: "sandbox",
      providerRef: `approval_${agreement.id}`,
      amountMinor: agreement.amountMinor,
      currency: agreement.currency,
      status: "succeeded",
      idempotencyKey: `approval_${agreement.id}`,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await repo.insertPayment(payment);
  }

  async consent(actor: Actor, agreementId: string, locale: Locale = "tr"): Promise<LicenseAgreement> {
    return this.repo.transaction(async (repo) => {
      const agreement = await this.requireAgreement(repo, agreementId);
      const party = this.partyFor(actor, agreement);
      if (!party) throw forbidden();
      if (agreement.status !== "pending_consent" && agreement.status !== "approved") {
        throw new AppError(409, "INVALID_TRANSITION", "Consent is collected while the agreement is awaiting consent.");
      }
      const existing = (await repo.listConsents(agreement.id)).find((item) => item.party === party);
      if (!existing) {
        await repo.insertConsent({
          id: newId(),
          agreementId: agreement.id,
          party,
          userId: actor.userId,
          statement: copy(locale).legal.consent,
          agreementHash: agreement.documentHash,
          createdAt: nowIso(),
        });
        await repo.appendAudit({
          id: newId(),
          actorId: actor.userId,
          action: "consent_recorded",
          entityType: "license_agreement",
          entityId: agreement.id,
          payload: { party },
          createdAt: nowIso(),
        });
      }
      const consents = await repo.listConsents(agreement.id);
      if (agreement.status === "pending_consent" && consents.some((item) => item.party === "licensor") && consents.some((item) => item.party === "licensee")) {
        await this.move(repo, agreement, "approved");
      }
      return (await repo.getAgreement(agreement.id))!;
    });
  }

  async sign(actor: Actor, agreementId: string, input: unknown, meta: { ipAddress: string | null; userAgent: string | null; locale?: Locale }): Promise<LicenseAgreement> {
    const body = signSchema.parse(input);
    if (body.typedName.trim().toLocaleLowerCase("en") !== actor.profile.displayName.trim().toLocaleLowerCase("en")) {
      throw new AppError(422, "NAME_MISMATCH", "The typed name must match the name on your profile. This demo signature is not a qualified electronic signature.");
    }
    return this.repo.transaction(async (repo) => {
      const agreement = await this.requireAgreement(repo, agreementId);
      const party = this.partyFor(actor, agreement);
      if (!party) throw forbidden();
      if (agreement.status !== "approved") throw new AppError(409, "CONSENT_REQUIRED", "Both parties must record consent before signing.");
      const consented = (await repo.listConsents(agreement.id)).some((item) => item.party === party);
      if (!consented) throw new AppError(409, "CONSENT_REQUIRED", "Record consent for this exact agreement before signing.");
      const existing = (await repo.listSignatures(agreement.id)).find((item) => item.party === party);
      if (!existing) {
        await repo.insertSignature({
          id: newId(),
          agreementId: agreement.id,
          party,
          signerUserId: actor.userId,
          typedName: body.typedName.trim(),
          method: "demo_typed_name",
          disclaimer: copy(meta.locale ?? "tr").legal.signature,
          agreementHash: agreement.documentHash,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          signedAt: nowIso(),
        });
      }
      const signatures = await repo.listSignatures(agreement.id);
      const both = signatures.some((item) => item.party === "licensor") && signatures.some((item) => item.party === "licensee");
      if (both && agreement.status === "approved") {
        await this.move(repo, agreement, "signed");
        if (agreement.paymentRequired) {
          await this.move(repo, agreement, "payment_pending");
          await this.advanceAfterPayment(repo, agreement.id);
        } else {
          await this.move(repo, agreement, "recording");
        }
      }
      return (await repo.getAgreement(agreement.id))!;
    });
  }

  async advanceAfterPayment(repo: AppRepository, agreementId: string): Promise<void> {
    const agreement = await repo.getAgreement(agreementId);
    if (!agreement || agreement.status !== "payment_pending") return;
    const blockers = await this.recordingBlockers(repo, agreement);
    if (blockers.length > 0) return;
    await this.move(repo, agreement, "recording");
    await repo.appendAudit({
      id: newId(),
      actorId: null,
      action: "payment_confirmed",
      entityType: "license_agreement",
      entityId: agreement.id,
      payload: { nextStatus: "recording" },
      createdAt: nowIso(),
    });
  }

  async submitChain(actor: Actor, licenseId: string): Promise<BlockchainRecord> {
    const agreement = await this.repo.getAgreementByLicenseId(licenseId);
    if (!agreement) throw notFound("License not found.");
    if (!this.canView(actor, agreement) && !isAdmin(actor)) throw forbidden();
    const outcome = await this.repo.transaction(async (repo) => {
      const current = await this.requireAgreement(repo, agreement.id);
      if (current.status !== "recording" && current.status !== "recording_failed") {
        throw new AppError(409, "NOT_READY_TO_RECORD", "The license can be recorded only after consent, signature, and any required payment.");
      }
      const blockers = await this.recordingBlockers(repo, current);
      if (blockers.length > 0) throw new AppError(409, "NOT_READY_TO_RECORD", "Required steps are still missing.", blockers);
      const existing = await repo.getBlockchainRecord(current.licenseId);
      if (existing?.status === "confirmed") return { ok: true as const, record: existing };
      const snapshot = await repo.getSnapshot(current.id);
      if (!snapshot) throw notFound("Rule snapshot not found.");
      const write = {
        licenseId: sha256Bytes32(current.licenseId),
        agreementHashHex: asBytes32(current.documentHash),
        ruleSnapshotHashHex: asBytes32(hashCanonical(snapshot.rules)),
        assetReferenceHex: asBytes32(current.document.assetSha256),
        projectReferenceHex: sha256Bytes32(current.document.projectId),
      };
      try {
        const receipt = await this.chain.recordLicense(write);
        const record = await this.confirmChain(repo, actor, current, existing, write, receipt);
        return { ok: true as const, record };
      } catch (error) {
        const verified = await this.chain.verify({ licenseId: write.licenseId, agreementHashHex: write.agreementHashHex }).catch(() => null);
        if (verified && existing?.txHash) {
          const record = await this.confirmChain(repo, actor, current, existing, write, {
            txHash: existing.txHash,
            chainId: existing.chainId ?? 0,
            contractAddress: existing.contractAddress ?? "",
          });
          return { ok: true as const, record };
        }
        const message = error instanceof Error ? error.message : "Blockchain recording failed.";
        const record = this.chainRecord(existing, current, write, {
          status: "failed",
          txHash: null,
          chainId: null,
          contractAddress: null,
          error: message,
          confirmedAt: null,
        });
        if (existing) await repo.updateBlockchainRecord(record);
        else await repo.insertBlockchainRecord(record);
        if (current.status === "recording") await this.move(repo, current, "recording_failed");
        await repo.appendAudit({
          id: newId(),
          actorId: actor.userId,
          action: "blockchain_failed",
          entityType: "license",
          entityId: current.licenseId,
          payload: { error: message },
          createdAt: nowIso(),
        });
        return { ok: false as const, message };
      }
    });
    if (!outcome.ok) {
      throw new AppError(502, "RECORDING_FAILED", "The blockchain record was not confirmed. The license is not active.", {
        licenseStatus: "recording_failed",
        reason: outcome.message,
      });
    }
    return outcome.record;
  }

  private async confirmChain(
    repo: AppRepository,
    actor: Actor,
    current: LicenseAgreement,
    existing: BlockchainRecord | null,
    write: { agreementHashHex: string; ruleSnapshotHashHex: string; assetReferenceHex: string; projectReferenceHex: string },
    receipt: { txHash: string; chainId: number; contractAddress: string },
  ): Promise<BlockchainRecord> {
    const record = this.chainRecord(existing, current, write, {
      status: "confirmed",
      txHash: receipt.txHash,
      chainId: receipt.chainId,
      contractAddress: receipt.contractAddress,
      error: null,
      confirmedAt: nowIso(),
    });
    if (existing) await repo.updateBlockchainRecord(record);
    else await repo.insertBlockchainRecord(record);
    if (current.status === "recording_failed") await this.move(repo, current, "recording");
    await this.move(repo, current, "active", nowIso());
    await repo.appendAudit({
      id: newId(),
      actorId: actor.userId,
      action: "blockchain_confirmed",
      entityType: "license",
      entityId: current.licenseId,
      payload: { txHash: receipt.txHash, chainId: receipt.chainId },
      createdAt: nowIso(),
    });
    return record;
  }

  async verify(licenseId: string, presentedHash: string, locale: Locale = "tr") {
    const agreement = await this.repo.getAgreementByLicenseId(licenseId);
    if (!agreement) throw notFound("License not found.");
    const chain = await this.repo.getBlockchainRecord(licenseId);
    const record = chain
      ? {
          chainId: chain.chainId,
          contractAddress: chain.contractAddress,
          txHash: chain.txHash,
          licenseKey: sha256Bytes32(licenseId),
          agreementHash: chain.agreementHash,
          ruleSnapshotHash: chain.ruleSnapshotHash,
          assetReference: chain.assetReference,
          projectReference: chain.projectReference,
          status: chain.status,
          confirmedAt: chain.confirmedAt,
        }
      : null;
    const presented = presentedHash.trim() ? normalizeHash(presentedHash) : "";
    const compared = presented.length > 0;
    const documentMatches = compared ? presented === normalizeHash(agreement.documentHash) : null;
    const recorded = chain?.agreementHash ? normalizeHash(chain.agreementHash) : null;
    const chainMatches = compared ? chain?.status === "confirmed" && recorded === presented : null;
    let onChainVerified: boolean | null = null;
    if (compared && this.chain.configured && chain?.status === "confirmed") {
      onChainVerified = await this.chain.verify({
        licenseId: sha256Bytes32(licenseId),
        agreementHashHex: asBytes32(presented),
      });
    }
    return {
      licenseId,
      agreementId: agreement.id,
      licenseStatus: agreement.status,
      documentMatches,
      chainStatus: chain?.status ?? null,
      chainMatches,
      onChainVerified,
      txHash: chain?.txHash ?? null,
      chainId: chain?.chainId ?? null,
      record,
      explanation: copy(locale).verify.explanation,
    };
  }

  async checkUsage(actor: Actor, licenseId: string, input: unknown, locale: Locale = "tr") {
    const body = usageCheckSchema.parse(input);
    const agreement = await this.repo.getAgreementByLicenseId(licenseId);
    if (!agreement) throw notFound("License not found.");
    if (!this.canView(actor, agreement) && !isAdmin(actor)) throw forbidden();
    const project = await this.repo.getProject(body.projectId);
    const violations = evaluateLicenseCoverage({
      licenseStatus: agreement.status,
      licensedProjectId: agreement.document.projectId,
      licensedAssetId: agreement.document.assetId,
      granted: agreement.document.granted,
      attemptProjectId: body.projectId,
      attemptAssetId: agreement.document.assetId,
      attempt: body.usage,
    });
    return {
      allowed: violations.length === 0,
      violations,
      licensedProjectId: agreement.document.projectId,
      attemptedProjectId: body.projectId,
      attemptedProjectName: project?.name ?? null,
      note: locale === "en"
        ? "Authorization uses the project ID and the granted scope. The project name is not an authorization key."
        : "Yetki, proje kimliğini ve verilen kapsamı kullanır. Proje adı bir yetki anahtarı değildir.",
    };
  }

  async expireDue(): Promise<number> {
    const today = todayUtc();
    let count = 0;
    await this.repo.transaction(async (repo) => {
      for (const agreement of await repo.listAgreements()) {
        if (agreement.status === "active" && agreement.document.granted.endsOn < today) {
          await this.move(repo, agreement, "expired");
          count += 1;
        }
      }
    });
    return count;
  }

  async getAgreement(actor: Actor, agreementId: string): Promise<LicenseAgreement> {
    const agreement = await this.repo.getAgreement(agreementId);
    if (!agreement) throw notFound("Agreement not found.");
    if (!(await this.canRead(actor, agreement))) throw forbidden();
    return agreement;
  }

  async listForActor(actor: Actor): Promise<LicenseAgreement[]> {
    const agreements = await this.repo.listAgreements();
    const visible: LicenseAgreement[] = [];
    for (const agreement of agreements) {
      if (await this.canRead(actor, agreement)) visible.push(agreement);
    }
    return visible;
  }

  private async createDraft(
    repo: AppRepository,
    request: LicenseRequest,
    context: RequestContext,
    timestamp: string,
    locale: Locale = "tr",
  ): Promise<LicenseAgreement> {
    const quote = quotePrice(context.version.rules, request.usage, locale);
    const offered = request.usage.proposedAmountMinor;
    const counter = offered != null && offered !== quote.amountMinor;
    const amountMinor = counter ? offered : quote.amountMinor;
    const formula = counter ? copy(locale).formula.counter : quote.formula;
    const settings = await repo.getSettings();
    const agreementId = newId();
    const licenseId = newId();
    const snapshotId = newId();
    const document = buildAgreementDocument({
      documentVersion: 1,
      licenseId,
      agreementId,
      ruleSnapshotId: snapshotId,
      ruleSetId: context.ruleSetId,
      ruleVersionId: context.version.id,
      ruleVersionNumber: context.version.versionNumber,
      licensorProfileId: context.owner.id,
      licensorDisplayName: context.owner.displayName,
      licenseeProfileId: context.producer.id,
      licenseeCompanyName: context.project.companyName,
      projectId: context.project.id,
      projectName: context.project.name,
      projectDescription: context.project.description,
      assetId: context.asset.id,
      assetSha256: context.asset.sha256,
      intendedUse: request.intendedUse,
      granted: { ...request.usage, downloadOriginal: true },
      restrictions: context.version.rules.prohibited,
      commercial: {
        amountMinor,
        currency: quote.currency,
        pricingMode: quote.pricingMode,
        formula,
      },
      renewalAllowed: context.version.rules.commercial.renewalAllowed,
      renewalRequiresNewAgreement: context.version.rules.commercial.renewalRequiresNewAgreement,
      createdAt: timestamp,
    }, locale);
    const documentHash = hashAgreementDocument(document);
    const agreement: LicenseAgreement = {
      id: agreementId,
      licenseId,
      requestId: request.id,
      status: "draft",
      document,
      documentHash,
      amountMinor,
      currency: quote.currency,
      paymentRequired: settings.paymentRequired && amountMinor > 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      activatedAt: null,
    };
    await repo.insertAgreement(agreement);
    await repo.insertSnapshot({
      id: snapshotId,
      agreementId,
      ruleSetId: context.ruleSetId,
      ruleVersionId: context.version.id,
      versionNumber: context.version.versionNumber,
      rules: structuredClone(context.version.rules),
      createdAt: timestamp,
    });
    return agreement;
  }

  private async loadRequestContext(actor: Actor, projectId: string, assetId: string, repo: AppRepository = this.repo): Promise<RequestContext> {
    const project = await repo.getProject(projectId);
    if (!project || project.status !== "active") throw notFound("Project not found.");
    if (!(await repo.isProjectMember(project.id, actor.userId))) throw forbidden("You are not a member of this project.");
    const asset = await repo.getAsset(assetId);
    if (!asset || asset.removalStatus === "removed") throw notFound("Asset not found.");
    if (asset.listed === false) throw new AppError(409, "ASSET_NOT_LISTED", "This photo is not on the marketplace.");
    if (asset.moderationStatus === "rejected" || asset.moderationStatus === "suspended" || asset.moderationStatus === "removed") {
      throw new AppError(409, "ASSET_NOT_AUTHORIZED", "This asset is not available for licensing.");
    }
    const owner = await repo.getProfile(asset.profileId);
    const producer = await repo.getProfile(actor.userId);
    if (!owner || !producer || owner.suspendedAt) throw forbidden("The licensor is not available.");
    const resolved = await this.resolveRules(repo, owner.id, asset.id);
    if (!resolved) throw new AppError(422, "NO_PUBLISHED_RULES", "This person has not published licensing rules for this asset.");
    return { project, asset, owner, producer, version: resolved.version, ruleSetId: resolved.ruleSetId };
  }

  private async resolveRules(repo: AppRepository, profileId: string, assetId: string): Promise<{ ruleSetId: string; version: RuleVersion } | null> {
    const sets = await repo.listRuleSets(profileId);
    const chosen = sets.find((item) => item.assetId === assetId && item.status === "published" && item.currentVersionId)
      ?? sets.find((item) => item.assetId === null && item.status === "published" && item.currentVersionId);
    if (!chosen?.currentVersionId) return null;
    const version = await repo.getRuleVersion(chosen.currentVersionId);
    if (!version || version.status !== "published") return null;
    return { ruleSetId: chosen.id, version };
  }

  private async move(repo: AppRepository, agreement: LicenseAgreement, status: LicenseStatus, activatedAt?: string): Promise<void> {
    if (!canTransition(agreement.status, status)) {
      throw new AppError(409, "INVALID_TRANSITION", `Cannot move a license from ${agreement.status} to ${status}.`);
    }
    const nextActivated = activatedAt ?? agreement.activatedAt;
    await repo.updateAgreementStatus(agreement.id, { status, updatedAt: nowIso(), activatedAt: nextActivated });
    agreement.status = status;
    agreement.activatedAt = nextActivated;
  }

  private async recordingBlockers(repo: AppRepository, agreement: LicenseAgreement): Promise<string[]> {
    const payments = await repo.listPayments();
    const payment = payments.filter((item) => item.agreementId === agreement.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    return readyForRecording({
      consents: await repo.listConsents(agreement.id),
      signatures: await repo.listSignatures(agreement.id),
      expectedHash: agreement.documentHash,
      paymentStatus: agreement.paymentRequired ? payment?.status ?? null : "not_required",
      paymentRequired: agreement.paymentRequired,
    });
  }

  private chainRecord(
    existing: BlockchainRecord | null,
    agreement: LicenseAgreement,
    write: { agreementHashHex: string; ruleSnapshotHashHex: string; assetReferenceHex: string; projectReferenceHex: string },
    patch: Pick<BlockchainRecord, "status" | "txHash" | "chainId" | "contractAddress" | "error" | "confirmedAt">,
  ): BlockchainRecord {
    return {
      id: existing?.id ?? newId(),
      licenseId: agreement.licenseId,
      agreementHash: write.agreementHashHex,
      ruleSnapshotHash: write.ruleSnapshotHashHex,
      assetReference: write.assetReferenceHex,
      projectReference: write.projectReferenceHex,
      submittedAt: existing?.submittedAt ?? nowIso(),
      ...patch,
    };
  }

  private partyFor(actor: Actor, agreement: LicenseAgreement): "licensor" | "licensee" | null {
    if (actor.userId === agreement.document.licensorProfileId) return "licensor";
    if (actor.userId === agreement.document.licenseeProfileId) return "licensee";
    return null;
  }

  private canView(actor: Actor, agreement: LicenseAgreement): boolean {
    return actor.userId === agreement.document.licensorProfileId || actor.userId === agreement.document.licenseeProfileId;
  }

  private async canRead(actor: Actor, agreement: LicenseAgreement): Promise<boolean> {
    if (this.canView(actor, agreement) || isAdmin(actor)) return true;
    return hasScope(this.repo, actor, agreement.document.licensorProfileId, "view_agreements");
  }

  private async requireAgreement(repo: AppRepository, id: string): Promise<LicenseAgreement> {
    const agreement = await repo.getAgreement(id);
    if (!agreement) throw notFound("Agreement not found.");
    return agreement;
  }

  private async requireProject(id: string): Promise<Project> {
    const project = await this.repo.getProject(id);
    if (!project) throw notFound("Project not found.");
    return project;
  }

  private assertVerified(actor: Actor): void {
    if (!actor.profile.emailVerified) throw new AppError(403, "EMAIL_UNVERIFIED", "Verify your email before requesting a license.");
  }

  private async notify(repo: AppRepository, userId: string, title: string, body: string, link: string, createdAt: string): Promise<void> {
    await repo.insertNotification({ id: newId(), userId, title, body, link, readAt: null, createdAt });
  }
}

type RequestContext = {
  project: Project;
  asset: import("@suret/shared").FaceAsset;
  owner: import("@suret/shared").Profile;
  producer: import("@suret/shared").Profile;
  version: RuleVersion;
  ruleSetId: string;
};

function asBytes32(hex: string): string {
  const normalized = hex.startsWith("0x") ? hex : `0x${hex}`;
  if (!/^0x[0-9a-fA-F]{64}$/.test(normalized)) throw new AppError(500, "HASH_FORMAT", "Expected a SHA-256 hash.");
  return normalized.toLowerCase();
}

function normalizeHash(value: string): string {
  return value.trim().toLowerCase().replace(/^0x/, "");
}
