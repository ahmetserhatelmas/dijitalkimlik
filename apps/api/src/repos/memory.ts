import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AUDIT_GENESIS, DEFAULT_SETTINGS, blankPlace, formatPlace, nextAuditHash, placeFromLegacy, type AuditLog, type PlatformSettings, type Profile } from "@suret/shared";
import { FAKE_WALLET_START_MINOR } from "../wallet.js";
import type { AppRepository } from "./types.js";

type MemoryState = {
  profiles: Awaited<ReturnType<AppRepository["listProfiles"]>>;
  passwords: { userId: string; passwordHash: string }[];
  roles: { userId: string; role: Awaited<ReturnType<AppRepository["getRoles"]>>[number] }[];
  agencies: Awaited<ReturnType<AppRepository["listAgencies"]>>;
  memberships: { agencyId: string; userId: string }[];
  representations: Awaited<ReturnType<AppRepository["listRepresentations"]>>;
  assets: Awaited<ReturnType<AppRepository["listAssets"]>>;
  attestations: Awaited<ReturnType<AppRepository["insertAttestation"]>> extends void
    ? import("./types.js").Attestation[]
    : never;
  accessLogs: import("./types.js").AccessLog[];
  ruleSets: Awaited<ReturnType<AppRepository["listRuleSets"]>>;
  ruleVersions: import("@suret/shared").RuleVersion[];
  projects: Awaited<ReturnType<AppRepository["listProjects"]>>;
  members: { projectId: string; userId: string; memberRole: string; createdAt: string }[];
  requests: Awaited<ReturnType<AppRepository["listRequests"]>>;
  agreements: Awaited<ReturnType<AppRepository["listAgreements"]>>;
  snapshots: import("@suret/shared").RuleSnapshot[];
  consents: import("@suret/shared").ConsentRecord[];
  signatures: import("@suret/shared").ElectronicSignature[];
  payments: Awaited<ReturnType<AppRepository["listPayments"]>>;
  wallets: Record<string, number>;
  webhookEvents: { eventId: string; provider: string; payloadHash: string; receivedAt: string }[];
  chain: import("@suret/shared").BlockchainRecord[];
  notifications: import("@suret/shared").Notification[];
  reports: Awaited<ReturnType<AppRepository["listReports"]>>;
  evidence: import("@suret/shared").MisuseEvidence[];
  disputes: Awaited<ReturnType<AppRepository["listDisputes"]>>;
  audit: AuditLog[];
  settings: PlatformSettings;
  deletions: import("./types.js").DeletionRequest[];
};

function emptyState(): MemoryState {
  return {
    profiles: [],
    passwords: [],
    roles: [],
    agencies: [],
    memberships: [],
    representations: [],
    assets: [],
    attestations: [],
    accessLogs: [],
    ruleSets: [],
    ruleVersions: [],
    projects: [],
    members: [],
    requests: [],
    agreements: [],
    snapshots: [],
    consents: [],
    signatures: [],
    payments: [],
    wallets: {},
    webhookEvents: [],
    chain: [],
    notifications: [],
    reports: [],
    evidence: [],
    disputes: [],
    audit: [],
    settings: structuredClone(DEFAULT_SETTINGS),
    deletions: [],
  };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

export class MemoryRepository implements AppRepository {
  private state: MemoryState;
  private depth = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly file?: string) {
    this.state = emptyState();
    if (file) {
      try {
        this.state = { ...emptyState(), ...JSON.parse(readFileSync(file, "utf8")) };
        if (!this.state.wallets) this.state.wallets = {};
      } catch {
        this.state = emptyState();
      }
    }
  }

  async transaction<T>(fn: (repo: AppRepository) => Promise<T>): Promise<T> {
    if (this.depth > 0) return fn(this);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.queue;
    this.queue = gate;
    await previous;
    this.depth += 1;
    try {
      return await fn(this);
    } finally {
      this.depth -= 1;
      this.persist();
      release();
    }
  }

  private persist(): void {
    if (!this.file) return;
    mkdirSync(path.dirname(this.file), { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.state));
  }

  private mark(): void {
    if (this.depth === 0) this.persist();
  }

  async insertProfile(profile: MemoryState["profiles"][number], passwordHash: string | null): Promise<void> {
    this.state.profiles.push(clone(profile));
    if (passwordHash) this.state.passwords.push({ userId: profile.id, passwordHash });
    this.mark();
  }

  async updateProfile(profile: MemoryState["profiles"][number]): Promise<void> {
    const index = this.state.profiles.findIndex((item) => item.id === profile.id);
    if (index >= 0) this.state.profiles[index] = clone(profile);
    this.mark();
  }

  async getProfile(id: string) {
    return withPlace(clone(this.state.profiles.find((item) => item.id === id) ?? null));
  }

  async getProfileByEmail(email: string) {
    const match = this.state.profiles.find((item) => item.email.toLowerCase() === email.toLowerCase());
    return withPlace(clone(match ?? null));
  }

  async listProfiles() {
    return clone(this.state.profiles).map((profile) => withPlace(profile) as Profile);
  }

  async getPasswordHash(userId: string) {
    return this.state.passwords.find((item) => item.userId === userId)?.passwordHash ?? null;
  }

  async setPasswordHash(userId: string, passwordHash: string) {
    const existing = this.state.passwords.find((item) => item.userId === userId);
    if (existing) existing.passwordHash = passwordHash;
    else this.state.passwords.push({ userId, passwordHash });
    this.mark();
  }

  async getRoles(userId: string) {
    return this.state.roles.filter((item) => item.userId === userId).map((item) => item.role);
  }

  async setRoles(userId: string, roles: MemoryState["roles"][number]["role"][]) {
    this.state.roles = this.state.roles.filter((item) => item.userId !== userId);
    for (const role of roles) this.state.roles.push({ userId, role });
    this.mark();
  }

  async insertAgency(agency: MemoryState["agencies"][number]) {
    this.state.agencies.push(clone(agency));
    this.mark();
  }

  async listAgencies() {
    return clone(this.state.agencies);
  }

  async getAgency(id: string) {
    return clone(this.state.agencies.find((item) => item.id === id) ?? null);
  }

  async addAgencyMember(agencyId: string, userId: string) {
    if (!this.state.memberships.some((item) => item.agencyId === agencyId && item.userId === userId)) {
      this.state.memberships.push({ agencyId, userId });
    }
    this.mark();
  }

  async listAgencyMembers(agencyId: string) {
    return this.state.memberships.filter((item) => item.agencyId === agencyId).map((item) => item.userId);
  }

  async agencyIdsForUser(userId: string) {
    return this.state.memberships.filter((item) => item.userId === userId).map((item) => item.agencyId);
  }

  async insertRepresentation(rep: MemoryState["representations"][number]) {
    this.state.representations.push(clone(rep));
    this.mark();
  }

  async updateRepresentation(rep: MemoryState["representations"][number]) {
    const index = this.state.representations.findIndex((item) => item.id === rep.id);
    if (index >= 0) this.state.representations[index] = clone(rep);
    this.mark();
  }

  async listRepresentations(filter: { profileId?: string; agencyId?: string; status?: MemoryState["representations"][number]["status"] }) {
    return clone(
      this.state.representations.filter((item) => {
        if (filter.profileId && item.profileId !== filter.profileId) return false;
        if (filter.agencyId && item.agencyId !== filter.agencyId) return false;
        if (filter.status && item.status !== filter.status) return false;
        return true;
      }),
    );
  }

  async getRepresentation(id: string) {
    return clone(this.state.representations.find((item) => item.id === id) ?? null);
  }

  async insertAsset(asset: MemoryState["assets"][number]) {
    this.state.assets.push(clone(asset));
    this.mark();
  }

  async updateAsset(asset: MemoryState["assets"][number]) {
    const index = this.state.assets.findIndex((item) => item.id === asset.id);
    if (index >= 0) this.state.assets[index] = clone(asset);
    this.mark();
  }

  async getAsset(id: string) {
    return clone(this.state.assets.find((item) => item.id === id) ?? null);
  }

  async listAssets(filter?: { profileId?: string }) {
    return clone(this.state.assets.filter((item) => !filter?.profileId || item.profileId === filter.profileId));
  }

  async listAssetFingerprints() {
    return this.state.assets
      .filter((item) => item.removalStatus !== "removed")
      .map((item) => ({ assetId: item.id, sha256: item.sha256, perceptualHash: item.perceptualHash }));
  }

  async insertAttestation(attestation: MemoryState["attestations"][number]) {
    this.state.attestations.push(clone(attestation));
    this.mark();
  }

  async insertAccessLog(entry: MemoryState["accessLogs"][number]) {
    this.state.accessLogs.push(clone(entry));
    this.mark();
  }

  async listAccessLogs(assetId: string) {
    return clone(this.state.accessLogs.filter((item) => item.assetId === assetId));
  }

  async insertRuleSet(ruleSet: MemoryState["ruleSets"][number]) {
    this.state.ruleSets.push(clone(ruleSet));
    this.mark();
  }

  async updateRuleSet(ruleSet: MemoryState["ruleSets"][number]) {
    const index = this.state.ruleSets.findIndex((item) => item.id === ruleSet.id);
    if (index >= 0) this.state.ruleSets[index] = clone(ruleSet);
    this.mark();
  }

  async getRuleSet(id: string) {
    return clone(this.state.ruleSets.find((item) => item.id === id) ?? null);
  }

  async listRuleSets(profileId?: string) {
    return clone(this.state.ruleSets.filter((item) => !profileId || item.profileId === profileId));
  }

  async insertRuleVersion(version: MemoryState["ruleVersions"][number]) {
    this.state.ruleVersions.push(clone(version));
    this.mark();
  }

  async getRuleVersion(id: string) {
    return clone(this.state.ruleVersions.find((item) => item.id === id) ?? null);
  }

  async getRuleVersions(ids: string[]) {
    const wanted = new Set(ids);
    return clone(this.state.ruleVersions.filter((item) => wanted.has(item.id)));
  }

  async listRuleVersions(ruleSetId: string) {
    return clone(this.state.ruleVersions.filter((item) => item.ruleSetId === ruleSetId));
  }

  async insertProject(project: MemoryState["projects"][number]) {
    this.state.projects.push(clone(project));
    this.mark();
  }

  async updateProject(project: MemoryState["projects"][number]) {
    const index = this.state.projects.findIndex((item) => item.id === project.id);
    if (index >= 0) this.state.projects[index] = clone(project);
    this.mark();
  }

  async getProject(id: string) {
    return clone(this.state.projects.find((item) => item.id === id) ?? null);
  }

  async listProjects(ownerId?: string) {
    return clone(this.state.projects.filter((item) => !ownerId || item.ownerId === ownerId));
  }

  async addProjectMember(projectId: string, userId: string, memberRole: string, createdAt: string) {
    if (!this.state.members.some((item) => item.projectId === projectId && item.userId === userId)) {
      this.state.members.push({ projectId, userId, memberRole, createdAt });
    }
    this.mark();
  }

  async isProjectMember(projectId: string, userId: string) {
    return this.state.members.some((item) => item.projectId === projectId && item.userId === userId);
  }

  async insertRequest(request: MemoryState["requests"][number]) {
    this.state.requests.push(clone(request));
    this.mark();
  }

  async updateRequest(request: MemoryState["requests"][number]) {
    const index = this.state.requests.findIndex((item) => item.id === request.id);
    if (index >= 0) this.state.requests[index] = clone(request);
    this.mark();
  }

  async getRequest(id: string) {
    return clone(this.state.requests.find((item) => item.id === id) ?? null);
  }

  async listRequests(filter?: { producerId?: string; ownerId?: string; projectId?: string }) {
    const owned = new Set(this.state.assets.filter((item) => item.profileId === filter?.ownerId).map((item) => item.id));
    return clone(
      this.state.requests.filter((item) => {
        if (filter?.producerId && item.producerId !== filter.producerId) return false;
        if (filter?.projectId && item.projectId !== filter.projectId) return false;
        if (filter?.ownerId && !owned.has(item.assetId)) return false;
        return true;
      }),
    );
  }

  async insertAgreement(agreement: MemoryState["agreements"][number]) {
    this.state.agreements.push(clone(agreement));
    this.mark();
  }

  async updateAgreementStatus(
    id: string,
    patch: { status: MemoryState["agreements"][number]["status"]; updatedAt: string; activatedAt: string | null },
  ) {
    const current = this.state.agreements.find((item) => item.id === id);
    if (!current) return;
    current.status = patch.status;
    current.updatedAt = patch.updatedAt;
    current.activatedAt = patch.activatedAt;
    this.mark();
  }

  async getAgreement(id: string) {
    return clone(this.state.agreements.find((item) => item.id === id) ?? null);
  }

  async getAgreementByRequestId(requestId: string) {
    return clone(this.state.agreements.find((item) => item.requestId === requestId) ?? null);
  }

  async getAgreementByLicenseId(licenseId: string) {
    return clone(this.state.agreements.find((item) => item.licenseId === licenseId) ?? null);
  }

  async listAgreements() {
    return clone(this.state.agreements);
  }

  async insertSnapshot(snapshot: MemoryState["snapshots"][number]) {
    if (this.state.snapshots.some((item) => item.agreementId === snapshot.agreementId)) {
      throw new Error("This record is immutable");
    }
    this.state.snapshots.push(clone(snapshot));
    this.mark();
  }

  async getSnapshot(agreementId: string) {
    return clone(this.state.snapshots.find((item) => item.agreementId === agreementId) ?? null);
  }

  async insertConsent(consent: MemoryState["consents"][number]) {
    if (this.state.consents.some((item) => item.agreementId === consent.agreementId && item.party === consent.party)) {
      throw new Error("This record is immutable");
    }
    this.state.consents.push(clone(consent));
    this.mark();
  }

  async listConsents(agreementId: string) {
    return clone(this.state.consents.filter((item) => item.agreementId === agreementId));
  }

  async insertSignature(signature: MemoryState["signatures"][number]) {
    if (this.state.signatures.some((item) => item.agreementId === signature.agreementId && item.party === signature.party)) {
      throw new Error("This record is immutable");
    }
    this.state.signatures.push(clone(signature));
    this.mark();
  }

  async listSignatures(agreementId: string) {
    return clone(this.state.signatures.filter((item) => item.agreementId === agreementId));
  }

  async insertPayment(payment: MemoryState["payments"][number]) {
    this.state.payments.push(clone(payment));
    this.mark();
  }

  async updatePayment(payment: MemoryState["payments"][number]) {
    const index = this.state.payments.findIndex((item) => item.id === payment.id);
    if (index >= 0) this.state.payments[index] = clone(payment);
    this.mark();
  }

  async getPayment(id: string) {
    return clone(this.state.payments.find((item) => item.id === id) ?? null);
  }

  async getPaymentByProviderRef(provider: MemoryState["payments"][number]["provider"], providerRef: string) {
    return clone(this.state.payments.find((item) => item.provider === provider && item.providerRef === providerRef) ?? null);
  }

  async findPaymentByIdempotency(agreementId: string, key: string) {
    return clone(this.state.payments.find((item) => item.agreementId === agreementId && item.idempotencyKey === key) ?? null);
  }

  async listPayments() {
    return clone(this.state.payments);
  }

  async getWalletBalance(userId: string) {
    return this.ensureWallet(userId);
  }

  async adjustWallet(userId: string, deltaMinor: number) {
    const next = this.ensureWallet(userId) + deltaMinor;
    if (next < 0) throw new Error("INSUFFICIENT_FUNDS");
    this.state.wallets[userId] = next;
    this.mark();
    return next;
  }

  private ensureWallet(userId: string) {
    if (!this.state.wallets) this.state.wallets = {};
    if (this.state.wallets[userId] === undefined) {
      this.state.wallets[userId] = FAKE_WALLET_START_MINOR;
      this.mark();
    }
    return this.state.wallets[userId];
  }

  async claimWebhookEvent(eventId: string, provider: string, payloadHash: string, receivedAt: string) {
    if (this.state.webhookEvents.some((item) => item.eventId === eventId)) return false;
    this.state.webhookEvents.push({ eventId, provider, payloadHash, receivedAt });
    this.mark();
    return true;
  }

  async insertBlockchainRecord(record: MemoryState["chain"][number]) {
    this.state.chain.push(clone(record));
    this.mark();
  }

  async updateBlockchainRecord(record: MemoryState["chain"][number]) {
    const index = this.state.chain.findIndex((item) => item.id === record.id);
    if (index >= 0) this.state.chain[index] = clone(record);
    this.mark();
  }

  async getBlockchainRecord(licenseId: string) {
    return clone(this.state.chain.find((item) => item.licenseId === licenseId) ?? null);
  }

  async insertNotification(notification: MemoryState["notifications"][number]) {
    this.state.notifications.push(clone(notification));
    this.mark();
  }

  async listNotifications(userId: string) {
    return clone(this.state.notifications.filter((item) => item.userId === userId));
  }

  async markNotificationRead(id: string, userId: string, readAt: string) {
    const notification = this.state.notifications.find((item) => item.id === id && item.userId === userId);
    if (notification) notification.readAt = readAt;
    this.mark();
  }

  async insertReport(report: MemoryState["reports"][number]) {
    this.state.reports.push(clone(report));
    this.mark();
  }

  async updateReport(report: MemoryState["reports"][number]) {
    const index = this.state.reports.findIndex((item) => item.id === report.id);
    if (index >= 0) this.state.reports[index] = clone(report);
    this.mark();
  }

  async getReport(id: string) {
    return clone(this.state.reports.find((item) => item.id === id) ?? null);
  }

  async listReports() {
    return clone(this.state.reports);
  }

  async insertEvidence(evidence: MemoryState["evidence"][number]) {
    this.state.evidence.push(clone(evidence));
    this.mark();
  }

  async listEvidence(reportId: string) {
    return clone(this.state.evidence.filter((item) => item.reportId === reportId));
  }

  async insertDispute(dispute: MemoryState["disputes"][number]) {
    this.state.disputes.push(clone(dispute));
    this.mark();
  }

  async updateDispute(dispute: MemoryState["disputes"][number]) {
    const index = this.state.disputes.findIndex((item) => item.id === dispute.id);
    if (index >= 0) this.state.disputes[index] = clone(dispute);
    this.mark();
  }

  async listDisputes() {
    return clone(this.state.disputes);
  }

  async getDispute(id: string) {
    return clone(this.state.disputes.find((item) => item.id === id) ?? null);
  }

  async appendAudit(input: {
    id: string;
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }): Promise<AuditLog> {
    const prevHash = this.state.audit.at(-1)?.entryHash ?? AUDIT_GENESIS;
    const body = {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload,
      createdAt: input.createdAt,
    };
    const entry: AuditLog = {
      id: input.id,
      sequence: this.state.audit.length + 1,
      prevHash,
      entryHash: nextAuditHash(prevHash, body),
      ...body,
    };
    this.state.audit.push(entry);
    this.mark();
    return clone(entry);
  }

  async listAudit() {
    return clone(this.state.audit);
  }

  async getSettings() {
    return clone(this.state.settings);
  }

  async updateSettings(settings: PlatformSettings) {
    this.state.settings = clone({ ...settings, facialRecognitionEnabled: false, signatureMode: "demo" });
    this.mark();
  }

  async insertDeletionRequest(request: MemoryState["deletions"][number]) {
    this.state.deletions.push(clone(request));
    this.mark();
  }

  async listDeletionRequests() {
    return clone(this.state.deletions);
  }
}

function withPlace<T extends Profile | null>(profile: T): T {
  if (!profile) return profile;
  if (!profile.place?.country) {
    const resolved = placeFromLegacy(profile.location);
    profile.place = resolved.country ? resolved : profile.place ?? blankPlace();
    if (resolved.country) profile.location = formatPlace(resolved, "tr");
  }
  return profile;
}
