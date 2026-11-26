import type {
  Agency,
  AuditLog,
  BlockchainRecord,
  ConsentRecord,
  DisputeCase,
  ElectronicSignature,
  FaceAsset,
  LicenseAgreement,
  LicenseRequest,
  LicenseStatus,
  MisuseEvidence,
  MisuseReport,
  Notification,
  PaymentRecord,
  PlatformSettings,
  Profile,
  Project,
  RepresentationAuthorization,
  Role,
  RuleSet,
  RuleSnapshot,
  RuleVersion,
} from "@suret/shared";

export type AccessLog = {
  id: string;
  assetId: string;
  actorId: string;
  action: string;
  createdAt: string;
};

export type Attestation = {
  id: string;
  assetId: string;
  statement: string;
  attestedBy: string;
  createdAt: string;
};

export type DeletionRequest = {
  id: string;
  userId: string;
  status: "requested" | "completed" | "rejected";
  requestedAt: string;
  completedAt: string | null;
  note: string;
};

export type RequestFilter = {
  producerId?: string;
  ownerId?: string;
  projectId?: string;
};

export interface AppRepository {
  transaction<T>(fn: (repo: AppRepository) => Promise<T>): Promise<T>;
  insertProfile(profile: Profile, passwordHash: string | null): Promise<void>;
  updateProfile(profile: Profile): Promise<void>;
  getProfile(id: string): Promise<Profile | null>;
  getProfileByEmail(email: string): Promise<Profile | null>;
  listProfiles(): Promise<Profile[]>;
  getPasswordHash(userId: string): Promise<string | null>;
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
  getRoles(userId: string): Promise<Role[]>;
  setRoles(userId: string, roles: Role[]): Promise<void>;
  insertAgency(agency: Agency): Promise<void>;
  listAgencies(): Promise<Agency[]>;
  getAgency(id: string): Promise<Agency | null>;
  addAgencyMember(agencyId: string, userId: string): Promise<void>;
  listAgencyMembers(agencyId: string): Promise<string[]>;
  agencyIdsForUser(userId: string): Promise<string[]>;
  insertRepresentation(rep: RepresentationAuthorization): Promise<void>;
  updateRepresentation(rep: RepresentationAuthorization): Promise<void>;
  listRepresentations(filter: {
    profileId?: string;
    agencyId?: string;
    status?: RepresentationAuthorization["status"];
  }): Promise<RepresentationAuthorization[]>;
  getRepresentation(id: string): Promise<RepresentationAuthorization | null>;
  insertAsset(asset: FaceAsset): Promise<void>;
  updateAsset(asset: FaceAsset): Promise<void>;
  getAsset(id: string): Promise<FaceAsset | null>;
  listAssets(filter?: { profileId?: string }): Promise<FaceAsset[]>;
  listAssetFingerprints(): Promise<{ assetId: string; sha256: string; perceptualHash: string | null }[]>;
  insertAttestation(attestation: Attestation): Promise<void>;
  insertAccessLog(entry: AccessLog): Promise<void>;
  listAccessLogs(assetId: string): Promise<AccessLog[]>;
  insertRuleSet(ruleSet: RuleSet): Promise<void>;
  updateRuleSet(ruleSet: RuleSet): Promise<void>;
  getRuleSet(id: string): Promise<RuleSet | null>;
  listRuleSets(profileId?: string): Promise<RuleSet[]>;
  insertRuleVersion(version: RuleVersion): Promise<void>;
  getRuleVersion(id: string): Promise<RuleVersion | null>;
  listRuleVersions(ruleSetId: string): Promise<RuleVersion[]>;
  insertProject(project: Project): Promise<void>;
  updateProject(project: Project): Promise<void>;
  getProject(id: string): Promise<Project | null>;
  listProjects(ownerId?: string): Promise<Project[]>;
  addProjectMember(projectId: string, userId: string, memberRole: string, createdAt: string): Promise<void>;
  isProjectMember(projectId: string, userId: string): Promise<boolean>;
  insertRequest(request: LicenseRequest): Promise<void>;
  updateRequest(request: LicenseRequest): Promise<void>;
  getRequest(id: string): Promise<LicenseRequest | null>;
  listRequests(filter?: RequestFilter): Promise<LicenseRequest[]>;
  insertAgreement(agreement: LicenseAgreement): Promise<void>;
  updateAgreementStatus(id: string, patch: { status: LicenseStatus; updatedAt: string; activatedAt: string | null }): Promise<void>;
  getAgreement(id: string): Promise<LicenseAgreement | null>;
  getAgreementByRequestId(requestId: string): Promise<LicenseAgreement | null>;
  getAgreementByLicenseId(licenseId: string): Promise<LicenseAgreement | null>;
  listAgreements(): Promise<LicenseAgreement[]>;
  insertSnapshot(snapshot: RuleSnapshot): Promise<void>;
  getSnapshot(agreementId: string): Promise<RuleSnapshot | null>;
  insertConsent(consent: ConsentRecord): Promise<void>;
  listConsents(agreementId: string): Promise<ConsentRecord[]>;
  insertSignature(signature: ElectronicSignature): Promise<void>;
  listSignatures(agreementId: string): Promise<ElectronicSignature[]>;
  insertPayment(payment: PaymentRecord): Promise<void>;
  updatePayment(payment: PaymentRecord): Promise<void>;
  getPayment(id: string): Promise<PaymentRecord | null>;
  getPaymentByProviderRef(provider: PaymentRecord["provider"], providerRef: string): Promise<PaymentRecord | null>;
  findPaymentByIdempotency(agreementId: string, key: string): Promise<PaymentRecord | null>;
  listPayments(): Promise<PaymentRecord[]>;
  getWalletBalance(userId: string): Promise<number>;
  adjustWallet(userId: string, deltaMinor: number): Promise<number>;
  claimWebhookEvent(eventId: string, provider: string, payloadHash: string, receivedAt: string): Promise<boolean>;
  insertBlockchainRecord(record: BlockchainRecord): Promise<void>;
  updateBlockchainRecord(record: BlockchainRecord): Promise<void>;
  getBlockchainRecord(licenseId: string): Promise<BlockchainRecord | null>;
  insertNotification(notification: Notification): Promise<void>;
  listNotifications(userId: string): Promise<Notification[]>;
  markNotificationRead(id: string, userId: string, readAt: string): Promise<void>;
  insertReport(report: MisuseReport): Promise<void>;
  updateReport(report: MisuseReport): Promise<void>;
  getReport(id: string): Promise<MisuseReport | null>;
  listReports(): Promise<MisuseReport[]>;
  insertEvidence(evidence: MisuseEvidence): Promise<void>;
  listEvidence(reportId: string): Promise<MisuseEvidence[]>;
  insertDispute(dispute: DisputeCase): Promise<void>;
  updateDispute(dispute: DisputeCase): Promise<void>;
  listDisputes(): Promise<DisputeCase[]>;
  getDispute(id: string): Promise<DisputeCase | null>;
  appendAudit(input: {
    id: string;
    actorId: string | null;
    action: string;
    entityType: string;
    entityId: string;
    payload: Record<string, unknown>;
    createdAt: string;
  }): Promise<AuditLog>;
  listAudit(): Promise<AuditLog[]>;
  getSettings(): Promise<PlatformSettings>;
  updateSettings(settings: PlatformSettings): Promise<void>;
  insertDeletionRequest(request: DeletionRequest): Promise<void>;
  listDeletionRequests(): Promise<DeletionRequest[]>;
}
