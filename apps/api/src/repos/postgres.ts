import {
  AGE_RANGES,
  AUDIT_GENESIS,
  DEFAULT_SETTINGS,
  EYE_COLORS,
  GENDERS,
  HAIR_COLORS,
  HEIGHT_RANGES,
  blankAppearance,
  nextAuditHash,
  type Agency,
  type AuditLog,
  type BlockchainRecord,
  type ConsentRecord,
  type DisputeCase,
  type ElectronicSignature,
  type FaceAsset,
  type LicenseAgreement,
  type LicenseRequest,
  type LicenseStatus,
  type MisuseEvidence,
  type MisuseReport,
  type Notification,
  type PaymentRecord,
  type PlatformSettings,
  type Profile,
  type Project,
  type RepresentationAuthorization,
  type Role,
  type RuleSet,
  type RuleSnapshot,
  type RuleVersion,
} from "@suret/shared";
import { FAKE_WALLET_START_MINOR } from "../wallet.js";
import { asJson, iso, type Database } from "./database.js";
import type { AccessLog, AppRepository, Attestation, DeletionRequest, RequestFilter } from "./types.js";

export class PostgresRepository implements AppRepository {
  constructor(private readonly db: Database) {}

  transaction<T>(fn: (repo: AppRepository) => Promise<T>): Promise<T> {
    return this.db.transaction(async (tx) => fn(new PostgresRepository(tx)));
  }

  private async one(sql: string, params: unknown[] = []): Promise<Record<string, unknown> | null> {
    const result = await this.db.query<Record<string, unknown>>(sql, params);
    return result.rows[0] ?? null;
  }

  async insertProfile(profile: Profile, passwordHash: string | null): Promise<void> {
    await this.db.query(
      `insert into profiles (
        id, email, display_name, bio, location, company_name, appearance, verification_status, email_verified,
        privacy, deletion_requested_at, suspended_at, created_at, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::verification_status,$9,$10::jsonb,$11,$12,$13,$14)`,
      [
        profile.id, profile.email, profile.displayName, profile.bio, profile.location, profile.companyName,
        JSON.stringify(profile.appearance ?? blankAppearance()),
        profile.verificationStatus, profile.emailVerified, JSON.stringify(profile.privacy),
        profile.deletionRequestedAt, profile.suspendedAt, profile.createdAt, profile.updatedAt,
      ],
    );
    if (passwordHash) await this.setPasswordHash(profile.id, passwordHash);
  }

  async updateProfile(profile: Profile): Promise<void> {
    await this.db.query(
      `update profiles set email=$2, display_name=$3, bio=$4, location=$5, company_name=$6, appearance=$7::jsonb,
        verification_status=$8::verification_status, email_verified=$9, privacy=$10::jsonb,
        deletion_requested_at=$11, suspended_at=$12, updated_at=$13 where id=$1`,
      [
        profile.id, profile.email, profile.displayName, profile.bio, profile.location, profile.companyName,
        JSON.stringify(profile.appearance ?? blankAppearance()),
        profile.verificationStatus, profile.emailVerified, JSON.stringify(profile.privacy),
        profile.deletionRequestedAt, profile.suspendedAt, profile.updatedAt,
      ],
    );
  }

  async getProfile(id: string): Promise<Profile | null> {
    return this.mapProfile(await this.one("select * from profiles where id=$1", [id]));
  }

  async getProfileByEmail(email: string): Promise<Profile | null> {
    return this.mapProfile(await this.one("select * from profiles where lower(email)=lower($1)", [email]));
  }

  async listProfiles(): Promise<Profile[]> {
    const result = await this.db.query("select * from profiles order by created_at");
    return result.rows.map((row) => this.mapProfile(row)!);
  }

  async getPasswordHash(userId: string): Promise<string | null> {
    const row = await this.one("select password_hash from dev_credentials where user_id=$1", [userId]);
    return row ? String(row.password_hash) : null;
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.db.query(
      `insert into dev_credentials (user_id, password_hash) values ($1,$2)
       on conflict (user_id) do update set password_hash=excluded.password_hash`,
      [userId, passwordHash],
    );
  }

  async getRoles(userId: string): Promise<Role[]> {
    const result = await this.db.query<{ role: Role }>("select role from user_roles where user_id=$1", [userId]);
    return result.rows.map((row) => row.role);
  }

  async setRoles(userId: string, roles: Role[]): Promise<void> {
    await this.db.query("delete from user_roles where user_id=$1", [userId]);
    for (const role of roles) {
      await this.db.query("insert into user_roles (user_id, role) values ($1,$2::user_role)", [userId, role]);
    }
  }

  async insertAgency(agency: Agency): Promise<void> {
    await this.db.query("insert into agencies (id, name, created_by, created_at) values ($1,$2,$3,$4)", [
      agency.id, agency.name, agency.createdBy, agency.createdAt,
    ]);
  }

  async listAgencies(): Promise<Agency[]> {
    const result = await this.db.query("select * from agencies order by created_at");
    return result.rows.map((row) => this.mapAgency(row));
  }

  async getAgency(id: string): Promise<Agency | null> {
    const row = await this.one("select * from agencies where id=$1", [id]);
    return row ? this.mapAgency(row) : null;
  }

  async addAgencyMember(agencyId: string, userId: string): Promise<void> {
    await this.db.query(
      `insert into agency_memberships (agency_id, user_id) values ($1,$2) on conflict do nothing`,
      [agencyId, userId],
    );
  }

  async listAgencyMembers(agencyId: string): Promise<string[]> {
    const result = await this.db.query<{ user_id: string }>("select user_id from agency_memberships where agency_id=$1", [agencyId]);
    return result.rows.map((row) => row.user_id);
  }

  async agencyIdsForUser(userId: string): Promise<string[]> {
    const result = await this.db.query<{ agency_id: string }>("select agency_id from agency_memberships where user_id=$1", [userId]);
    return result.rows.map((row) => row.agency_id);
  }

  async insertRepresentation(rep: RepresentationAuthorization): Promise<void> {
    await this.db.query(
      `insert into representation_authorizations (
        id, agency_id, profile_id, scopes, status, evidence_note, granted_by, created_at, revoked_at
      ) values ($1,$2,$3,$4,$5::representation_status,$6,$7,$8,$9)`,
      [rep.id, rep.agencyId, rep.profileId, rep.scopes, rep.status, rep.evidenceNote, rep.grantedBy, rep.createdAt, rep.revokedAt],
    );
  }

  async updateRepresentation(rep: RepresentationAuthorization): Promise<void> {
    await this.db.query(
      `update representation_authorizations set scopes=$2, status=$3::representation_status, evidence_note=$4, revoked_at=$5 where id=$1`,
      [rep.id, rep.scopes, rep.status, rep.evidenceNote, rep.revokedAt],
    );
  }

  async listRepresentations(filter: { profileId?: string; agencyId?: string; status?: RepresentationAuthorization["status"] }) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.profileId) params.push(filter.profileId), clauses.push(`profile_id=$${params.length}`);
    if (filter.agencyId) params.push(filter.agencyId), clauses.push(`agency_id=$${params.length}`);
    if (filter.status) params.push(filter.status), clauses.push(`status=$${params.length}::representation_status`);
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const result = await this.db.query(`select * from representation_authorizations ${where} order by created_at`, params);
    return result.rows.map((row) => this.mapRepresentation(row));
  }

  async getRepresentation(id: string) {
    const row = await this.one("select * from representation_authorizations where id=$1", [id]);
    return row ? this.mapRepresentation(row) : null;
  }

  async insertAsset(asset: FaceAsset): Promise<void> {
    await this.db.query(
      `insert into face_assets (
        id, profile_id, uploader_id, storage_path, preview_path, file_type, file_size, sha256, perceptual_hash,
        duplicate_flags, authorization_evidence_id, moderation_status, removal_status, subject, caption, listed, created_at, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11,$12::asset_status,$13::removal_status,$14,$15,$16,$17,$18)`,
      [
        asset.id, asset.profileId, asset.uploaderId, asset.storagePath, asset.previewPath, asset.fileType,
        asset.fileSize, asset.sha256, asset.perceptualHash, JSON.stringify(asset.duplicateFlags),
        asset.authorizationEvidenceId, asset.moderationStatus, asset.removalStatus, asset.subject ?? "face", asset.caption ?? "", asset.listed !== false, asset.createdAt, asset.updatedAt,
      ],
    );
  }

  async updateAsset(asset: FaceAsset): Promise<void> {
    await this.db.query(
      `update face_assets set preview_path=$2, perceptual_hash=$3, duplicate_flags=$4::jsonb,
        authorization_evidence_id=$5, moderation_status=$6::asset_status, removal_status=$7::removal_status, listed=$8, updated_at=$9
       where id=$1`,
      [
        asset.id, asset.previewPath, asset.perceptualHash, JSON.stringify(asset.duplicateFlags),
        asset.authorizationEvidenceId, asset.moderationStatus, asset.removalStatus, asset.listed !== false, asset.updatedAt,
      ],
    );
  }

  async getAsset(id: string) {
    const row = await this.one("select * from face_assets where id=$1", [id]);
    return row ? this.mapAsset(row) : null;
  }

  async listAssets(filter?: { profileId?: string }) {
    const result = filter?.profileId
      ? await this.db.query("select * from face_assets where profile_id=$1 order by created_at", [filter.profileId])
      : await this.db.query("select * from face_assets order by created_at");
    return result.rows.map((row) => this.mapAsset(row));
  }

  async listAssetFingerprints() {
    const result = await this.db.query<{ id: string; sha256: string; perceptual_hash: string | null }>(
      "select id, sha256, perceptual_hash from face_assets where removal_status='active'",
    );
    return result.rows.map((row) => ({ assetId: row.id, sha256: row.sha256, perceptualHash: row.perceptual_hash }));
  }

  async insertAttestation(attestation: Attestation) {
    await this.db.query(
      "insert into authorization_attestations (id, asset_id, statement, attested_by, created_at) values ($1,$2,$3,$4,$5)",
      [attestation.id, attestation.assetId, attestation.statement, attestation.attestedBy, attestation.createdAt],
    );
  }

  async insertAccessLog(entry: AccessLog) {
    await this.db.query(
      "insert into asset_access_logs (id, asset_id, actor_id, action, created_at) values ($1,$2,$3,$4,$5)",
      [entry.id, entry.assetId, entry.actorId, entry.action, entry.createdAt],
    );
  }

  async listAccessLogs(assetId: string) {
    const result = await this.db.query("select * from asset_access_logs where asset_id=$1 order by created_at", [assetId]);
    return result.rows.map((row) => ({
      id: String(row.id),
      assetId: String(row.asset_id),
      actorId: String(row.actor_id),
      action: String(row.action),
      createdAt: iso(row.created_at) ?? "",
    }));
  }

  async insertRuleSet(ruleSet: RuleSet) {
    await this.db.query(
      `insert into licensing_rule_sets (
        id, profile_id, asset_id, name, status, current_version_id, current_version_number, created_at, updated_at
      ) values ($1,$2,$3,$4,$5::rule_status,$6,$7,$8,$9)`,
      [
        ruleSet.id, ruleSet.profileId, ruleSet.assetId, ruleSet.name, ruleSet.status,
        ruleSet.currentVersionId, ruleSet.currentVersionNumber, ruleSet.createdAt, ruleSet.updatedAt,
      ],
    );
  }

  async updateRuleSet(ruleSet: RuleSet) {
    await this.db.query(
      `update licensing_rule_sets set name=$2, status=$3::rule_status, current_version_id=$4,
        current_version_number=$5, updated_at=$6 where id=$1`,
      [ruleSet.id, ruleSet.name, ruleSet.status, ruleSet.currentVersionId, ruleSet.currentVersionNumber, ruleSet.updatedAt],
    );
  }

  async getRuleSet(id: string) {
    const row = await this.one("select * from licensing_rule_sets where id=$1", [id]);
    return row ? this.mapRuleSet(row) : null;
  }

  async listRuleSets(profileId?: string) {
    const result = profileId
      ? await this.db.query("select * from licensing_rule_sets where profile_id=$1 order by created_at", [profileId])
      : await this.db.query("select * from licensing_rule_sets order by created_at");
    return result.rows.map((row) => this.mapRuleSet(row));
  }

  async insertRuleVersion(version: RuleVersion) {
    await this.db.query(
      `insert into licensing_rule_versions (id, rule_set_id, version_number, rules, status, created_by, created_at)
       values ($1,$2,$3,$4::jsonb,$5::rule_status,$6,$7)`,
      [version.id, version.ruleSetId, version.versionNumber, JSON.stringify(version.rules), version.status, version.createdBy, version.createdAt],
    );
  }

  async getRuleVersion(id: string) {
    const row = await this.one("select * from licensing_rule_versions where id=$1", [id]);
    return row ? this.mapRuleVersion(row) : null;
  }

  async listRuleVersions(ruleSetId: string) {
    const result = await this.db.query(
      "select * from licensing_rule_versions where rule_set_id=$1 order by version_number",
      [ruleSetId],
    );
    return result.rows.map((row) => this.mapRuleVersion(row));
  }

  async insertProject(project: Project) {
    await this.db.query(
      `insert into projects (id, owner_id, name, description, company_name, status, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [project.id, project.ownerId, project.name, project.description, project.companyName, project.status, project.createdAt, project.updatedAt],
    );
  }

  async updateProject(project: Project) {
    await this.db.query(
      "update projects set name=$2, description=$3, company_name=$4, status=$5, updated_at=$6 where id=$1",
      [project.id, project.name, project.description, project.companyName, project.status, project.updatedAt],
    );
  }

  async getProject(id: string) {
    const row = await this.one("select * from projects where id=$1", [id]);
    return row ? this.mapProject(row) : null;
  }

  async listProjects(ownerId?: string) {
    const result = ownerId
      ? await this.db.query("select * from projects where owner_id=$1 order by created_at", [ownerId])
      : await this.db.query("select * from projects order by created_at");
    return result.rows.map((row) => this.mapProject(row));
  }

  async addProjectMember(projectId: string, userId: string, memberRole: string, createdAt: string) {
    await this.db.query(
      `insert into project_members (project_id, user_id, member_role, created_at) values ($1,$2,$3,$4) on conflict do nothing`,
      [projectId, userId, memberRole, createdAt],
    );
  }

  async isProjectMember(projectId: string, userId: string) {
    const row = await this.one("select 1 as ok from project_members where project_id=$1 and user_id=$2", [projectId, userId]);
    return Boolean(row);
  }

  async insertRequest(request: LicenseRequest) {
    await this.db.query(
      `insert into license_requests (
        id, producer_id, project_id, asset_id, rule_version_id, intended_use, usage, compatibility, status, decision_note, created_at, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::request_status,$10,$11,$12)`,
      [
        request.id, request.producerId, request.projectId, request.assetId, request.ruleVersionId, request.intendedUse,
        JSON.stringify(request.usage), JSON.stringify(request.compatibility), request.status, request.decisionNote,
        request.createdAt, request.updatedAt,
      ],
    );
  }

  async updateRequest(request: LicenseRequest) {
    await this.db.query(
      "update license_requests set status=$2::request_status, decision_note=$3, updated_at=$4 where id=$1",
      [request.id, request.status, request.decisionNote, request.updatedAt],
    );
  }

  async getRequest(id: string) {
    const row = await this.one("select * from license_requests where id=$1", [id]);
    return row ? this.mapRequest(row) : null;
  }

  async listRequests(filter?: RequestFilter) {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter?.producerId) params.push(filter.producerId), clauses.push(`r.producer_id=$${params.length}`);
    if (filter?.projectId) params.push(filter.projectId), clauses.push(`r.project_id=$${params.length}`);
    if (filter?.ownerId) params.push(filter.ownerId), clauses.push(`a.profile_id=$${params.length}`);
    const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
    const result = await this.db.query(
      `select r.* from license_requests r join face_assets a on a.id=r.asset_id ${where} order by r.created_at`,
      params,
    );
    return result.rows.map((row) => this.mapRequest(row));
  }

  async insertAgreement(agreement: LicenseAgreement) {
    await this.db.query(
      `insert into license_agreements (
        id, license_id, request_id, status, document, document_hash, amount_minor, currency, payment_required, created_at, updated_at, activated_at
      ) values ($1,$2,$3,$4::license_status,$5::jsonb,$6,$7,$8,$9,$10,$11,$12)`,
      [
        agreement.id, agreement.licenseId, agreement.requestId, agreement.status, JSON.stringify(agreement.document),
        agreement.documentHash, agreement.amountMinor, agreement.currency, agreement.paymentRequired,
        agreement.createdAt, agreement.updatedAt, agreement.activatedAt,
      ],
    );
  }

  async updateAgreementStatus(id: string, patch: { status: LicenseStatus; updatedAt: string; activatedAt: string | null }) {
    await this.db.query(
      "update license_agreements set status=$2::license_status, updated_at=$3, activated_at=$4 where id=$1",
      [id, patch.status, patch.updatedAt, patch.activatedAt],
    );
  }

  async getAgreement(id: string) {
    const row = await this.one("select * from license_agreements where id=$1", [id]);
    return row ? this.mapAgreement(row) : null;
  }

  async getAgreementByRequestId(requestId: string) {
    const row = await this.one("select * from license_agreements where request_id=$1", [requestId]);
    return row ? this.mapAgreement(row) : null;
  }

  async getAgreementByLicenseId(licenseId: string) {
    const row = await this.one("select * from license_agreements where license_id=$1", [licenseId]);
    return row ? this.mapAgreement(row) : null;
  }

  async listAgreements() {
    const result = await this.db.query("select * from license_agreements order by created_at");
    return result.rows.map((row) => this.mapAgreement(row));
  }

  async insertSnapshot(snapshot: RuleSnapshot) {
    await this.db.query(
      `insert into agreement_rule_snapshots (id, agreement_id, rule_set_id, rule_version_id, version_number, rules, created_at)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7)`,
      [snapshot.id, snapshot.agreementId, snapshot.ruleSetId, snapshot.ruleVersionId, snapshot.versionNumber, JSON.stringify(snapshot.rules), snapshot.createdAt],
    );
  }

  async getSnapshot(agreementId: string) {
    const row = await this.one("select * from agreement_rule_snapshots where agreement_id=$1", [agreementId]);
    return row ? this.mapSnapshot(row) : null;
  }

  async insertConsent(consent: ConsentRecord) {
    await this.db.query(
      `insert into consent_records (id, agreement_id, party, user_id, statement, agreement_hash, created_at)
       values ($1,$2,$3::agreement_party,$4,$5,$6,$7)`,
      [consent.id, consent.agreementId, consent.party, consent.userId, consent.statement, consent.agreementHash, consent.createdAt],
    );
  }

  async listConsents(agreementId: string) {
    const result = await this.db.query("select * from consent_records where agreement_id=$1", [agreementId]);
    return result.rows.map((row) => this.mapConsent(row));
  }

  async insertSignature(signature: ElectronicSignature) {
    await this.db.query(
      `insert into electronic_signatures (
        id, agreement_id, party, signer_user_id, typed_name, method, disclaimer, agreement_hash, ip_address, user_agent, signed_at
      ) values ($1,$2,$3::agreement_party,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        signature.id, signature.agreementId, signature.party, signature.signerUserId, signature.typedName,
        signature.method, signature.disclaimer, signature.agreementHash, signature.ipAddress, signature.userAgent, signature.signedAt,
      ],
    );
  }

  async listSignatures(agreementId: string) {
    const result = await this.db.query("select * from electronic_signatures where agreement_id=$1", [agreementId]);
    return result.rows.map((row) => this.mapSignature(row));
  }

  async insertPayment(payment: PaymentRecord) {
    await this.db.query(
      `insert into payments (id, agreement_id, provider, provider_ref, amount_minor, currency, status, idempotency_key, created_at, updated_at)
       values ($1,$2,$3,$4,$5,$6,$7::payment_status,$8,$9,$10)`,
      [
        payment.id, payment.agreementId, payment.provider, payment.providerRef, payment.amountMinor,
        payment.currency, payment.status, payment.idempotencyKey, payment.createdAt, payment.updatedAt,
      ],
    );
  }

  async updatePayment(payment: PaymentRecord) {
    await this.db.query(
      "update payments set status=$2::payment_status, updated_at=$3, provider_ref=$4 where id=$1",
      [payment.id, payment.status, payment.updatedAt, payment.providerRef],
    );
  }

  async getPayment(id: string) {
    const row = await this.one("select * from payments where id=$1", [id]);
    return row ? this.mapPayment(row) : null;
  }

  async getPaymentByProviderRef(provider: PaymentRecord["provider"], providerRef: string) {
    const row = await this.one("select * from payments where provider=$1 and provider_ref=$2", [provider, providerRef]);
    return row ? this.mapPayment(row) : null;
  }

  async findPaymentByIdempotency(agreementId: string, key: string) {
    const row = await this.one("select * from payments where agreement_id=$1 and idempotency_key=$2", [agreementId, key]);
    return row ? this.mapPayment(row) : null;
  }

  async listPayments() {
    const result = await this.db.query("select * from payments order by created_at");
    return result.rows.map((row) => this.mapPayment(row));
  }

  async getWalletBalance(userId: string) {
    await this.db.query(
      "insert into fake_wallets (profile_id, balance_minor) values ($1,$2) on conflict (profile_id) do nothing",
      [userId, FAKE_WALLET_START_MINOR],
    );
    const row = await this.one("select balance_minor from fake_wallets where profile_id=$1", [userId]);
    return Number(row?.balance_minor ?? FAKE_WALLET_START_MINOR);
  }

  async adjustWallet(userId: string, deltaMinor: number) {
    await this.getWalletBalance(userId);
    const row = await this.one(
      `update fake_wallets set balance_minor = balance_minor + $2
       where profile_id=$1 and balance_minor + $2 >= 0
       returning balance_minor`,
      [userId, deltaMinor],
    );
    if (!row) throw new Error("INSUFFICIENT_FUNDS");
    return Number(row.balance_minor);
  }

  async claimWebhookEvent(eventId: string, provider: string, payloadHash: string, receivedAt: string) {
    const result = await this.db.query(
      `insert into webhook_events (event_id, provider, payload_hash, received_at) values ($1,$2,$3,$4)
       on conflict (event_id) do nothing returning event_id`,
      [eventId, provider, payloadHash, receivedAt],
    );
    return result.rows.length > 0;
  }

  async insertBlockchainRecord(record: BlockchainRecord) {
    await this.db.query(
      `insert into blockchain_records (
        id, license_id, chain_id, contract_address, tx_hash, agreement_hash, rule_snapshot_hash,
        asset_reference, project_reference, status, error, submitted_at, confirmed_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::chain_status,$11,$12,$13)`,
      [
        record.id, record.licenseId, record.chainId, record.contractAddress, record.txHash, record.agreementHash,
        record.ruleSnapshotHash, record.assetReference, record.projectReference, record.status, record.error,
        record.submittedAt, record.confirmedAt,
      ],
    );
  }

  async updateBlockchainRecord(record: BlockchainRecord) {
    await this.db.query(
      `update blockchain_records set chain_id=$2, contract_address=$3, tx_hash=$4, status=$5::chain_status,
        error=$6, submitted_at=$7, confirmed_at=$8 where id=$1`,
      [record.id, record.chainId, record.contractAddress, record.txHash, record.status, record.error, record.submittedAt, record.confirmedAt],
    );
  }

  async getBlockchainRecord(licenseId: string) {
    const row = await this.one("select * from blockchain_records where license_id=$1", [licenseId]);
    return row ? this.mapChain(row) : null;
  }

  async insertNotification(notification: Notification) {
    await this.db.query(
      "insert into notifications (id, user_id, title, body, link, read_at, created_at) values ($1,$2,$3,$4,$5,$6,$7)",
      [notification.id, notification.userId, notification.title, notification.body, notification.link, notification.readAt, notification.createdAt],
    );
  }

  async listNotifications(userId: string) {
    const result = await this.db.query("select * from notifications where user_id=$1 order by created_at desc", [userId]);
    return result.rows.map((row) => this.mapNotification(row));
  }

  async markNotificationRead(id: string, userId: string, readAt: string) {
    await this.db.query("update notifications set read_at=$3 where id=$1 and user_id=$2", [id, userId, readAt]);
  }

  async insertReport(report: MisuseReport) {
    await this.db.query(
      `insert into misuse_reports (
        id, reporter_id, license_id, asset_id, suspected_project, url, observed_at, description, status, created_at, updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::report_status,$10,$11)`,
      [
        report.id, report.reporterId, report.licenseId, report.assetId, report.suspectedProject, report.url,
        report.observedAt, report.description, report.status, report.createdAt, report.updatedAt,
      ],
    );
  }

  async updateReport(report: MisuseReport) {
    await this.db.query(
      "update misuse_reports set status=$2::report_status, updated_at=$3 where id=$1",
      [report.id, report.status, report.updatedAt],
    );
  }

  async getReport(id: string) {
    const row = await this.one("select * from misuse_reports where id=$1", [id]);
    return row ? this.mapReport(row) : null;
  }

  async listReports() {
    const result = await this.db.query("select * from misuse_reports order by created_at desc");
    return result.rows.map((row) => this.mapReport(row));
  }

  async insertEvidence(evidence: MisuseEvidence) {
    await this.db.query(
      `insert into misuse_evidence (id, report_id, storage_path, sha256, file_type, file_size, note, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [evidence.id, evidence.reportId, evidence.storagePath, evidence.sha256, evidence.fileType, evidence.fileSize, evidence.note, evidence.createdAt],
    );
  }

  async listEvidence(reportId: string) {
    const result = await this.db.query("select * from misuse_evidence where report_id=$1 order by created_at", [reportId]);
    return result.rows.map((row) => this.mapEvidence(row));
  }

  async insertDispute(dispute: DisputeCase) {
    await this.db.query(
      `insert into dispute_cases (id, report_id, agreement_id, status, summary, opened_by, resolution, created_at, updated_at)
       values ($1,$2,$3,$4::dispute_status,$5,$6,$7,$8,$9)`,
      [dispute.id, dispute.reportId, dispute.agreementId, dispute.status, dispute.summary, dispute.openedBy, dispute.resolution, dispute.createdAt, dispute.updatedAt],
    );
  }

  async updateDispute(dispute: DisputeCase) {
    await this.db.query(
      "update dispute_cases set status=$2::dispute_status, resolution=$3, updated_at=$4 where id=$1",
      [dispute.id, dispute.status, dispute.resolution, dispute.updatedAt],
    );
  }

  async listDisputes() {
    const result = await this.db.query("select * from dispute_cases order by created_at desc");
    return result.rows.map((row) => this.mapDispute(row));
  }

  async getDispute(id: string) {
    const row = await this.one("select * from dispute_cases where id=$1", [id]);
    return row ? this.mapDispute(row) : null;
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
    await this.db.query("select pg_advisory_xact_lock(80421)");
    const previous = await this.one("select entry_hash from audit_logs order by sequence desc limit 1");
    const prevHash = previous ? String(previous.entry_hash) : AUDIT_GENESIS;
    const body = {
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      payload: input.payload,
      createdAt: input.createdAt,
    };
    const entryHash = nextAuditHash(prevHash, body);
    const row = await this.one(
      `insert into audit_logs (id, actor_id, action, entity_type, entity_id, payload, prev_hash, entry_hash, created_at)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9) returning sequence`,
      [input.id, input.actorId, input.action, input.entityType, input.entityId, JSON.stringify(input.payload), prevHash, entryHash, input.createdAt],
    );
    return { id: input.id, sequence: Number(row?.sequence ?? 0), prevHash, entryHash, ...body };
  }

  async listAudit() {
    const result = await this.db.query("select * from audit_logs order by sequence");
    return result.rows.map((row) => ({
      id: String(row.id),
      sequence: Number(row.sequence),
      actorId: row.actor_id ? String(row.actor_id) : null,
      action: String(row.action),
      entityType: String(row.entity_type),
      entityId: String(row.entity_id),
      payload: asJson<Record<string, unknown>>(row.payload),
      prevHash: String(row.prev_hash),
      entryHash: String(row.entry_hash),
      createdAt: iso(row.created_at) ?? "",
    }));
  }

  async getSettings() {
    const row = await this.one("select settings from platform_settings where id=1");
    return row ? { ...DEFAULT_SETTINGS, ...asJson<PlatformSettings>(row.settings), facialRecognitionEnabled: false as const, signatureMode: "demo" as const } : structuredClone(DEFAULT_SETTINGS);
  }

  async updateSettings(settings: PlatformSettings) {
    const stored = { ...settings, facialRecognitionEnabled: false, signatureMode: "demo" };
    await this.db.query(
      `insert into platform_settings (id, settings) values (1, $1::jsonb)
       on conflict (id) do update set settings=excluded.settings`,
      [JSON.stringify(stored)],
    );
  }

  async insertDeletionRequest(request: DeletionRequest) {
    await this.db.query(
      "insert into deletion_requests (id, user_id, status, requested_at, completed_at, note) values ($1,$2,$3,$4,$5,$6)",
      [request.id, request.userId, request.status, request.requestedAt, request.completedAt, request.note],
    );
  }

  async listDeletionRequests() {
    const result = await this.db.query("select * from deletion_requests order by requested_at");
    return result.rows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      status: String(row.status) as DeletionRequest["status"],
      requestedAt: iso(row.requested_at) ?? "",
      completedAt: iso(row.completed_at),
      note: String(row.note),
    }));
  }

  private mapProfile(row: Record<string, unknown> | null): Profile | null {
    if (!row) return null;
    return {
      id: String(row.id),
      email: String(row.email),
      displayName: String(row.display_name),
      bio: String(row.bio),
      location: row.location ? String(row.location) : null,
      companyName: row.company_name ? String(row.company_name) : null,
      appearance: readAppearance(row.appearance),
      verificationStatus: String(row.verification_status) as Profile["verificationStatus"],
      emailVerified: Boolean(row.email_verified),
      privacy: asJson(row.privacy),
      deletionRequestedAt: iso(row.deletion_requested_at),
      suspendedAt: iso(row.suspended_at),
      createdAt: iso(row.created_at) ?? "",
      updatedAt: iso(row.updated_at) ?? "",
    };
  }

  private mapAgency(row: Record<string, unknown>): Agency {
    return { id: String(row.id), name: String(row.name), createdBy: String(row.created_by), createdAt: iso(row.created_at) ?? "" };
  }

  private mapRepresentation(row: Record<string, unknown>): RepresentationAuthorization {
    return {
      id: String(row.id),
      agencyId: String(row.agency_id),
      profileId: String(row.profile_id),
      scopes: asJson(row.scopes),
      status: String(row.status) as RepresentationAuthorization["status"],
      evidenceNote: String(row.evidence_note),
      grantedBy: String(row.granted_by),
      createdAt: iso(row.created_at) ?? "",
      revokedAt: iso(row.revoked_at),
    };
  }

  private mapAsset(row: Record<string, unknown>): FaceAsset {
    return {
      id: String(row.id),
      profileId: String(row.profile_id),
      uploaderId: String(row.uploader_id),
      storagePath: String(row.storage_path),
      previewPath: row.preview_path ? String(row.preview_path) : null,
      fileType: String(row.file_type),
      fileSize: Number(row.file_size),
      sha256: String(row.sha256),
      perceptualHash: row.perceptual_hash ? String(row.perceptual_hash) : null,
      duplicateFlags: asJson(row.duplicate_flags),
      authorizationEvidenceId: row.authorization_evidence_id ? String(row.authorization_evidence_id) : null,
      subject: row.subject === "place" || row.subject === "object" ? row.subject : "face",
      caption: row.caption ? String(row.caption) : "",
      moderationStatus: String(row.moderation_status) as FaceAsset["moderationStatus"],
      removalStatus: String(row.removal_status) as FaceAsset["removalStatus"],
      listed: row.listed !== false,
      createdAt: iso(row.created_at) ?? "",
      updatedAt: iso(row.updated_at) ?? "",
    };
  }

  private mapRuleSet(row: Record<string, unknown>): RuleSet {
    return {
      id: String(row.id),
      profileId: String(row.profile_id),
      assetId: row.asset_id ? String(row.asset_id) : null,
      name: String(row.name),
      status: String(row.status) as RuleSet["status"],
      currentVersionId: row.current_version_id ? String(row.current_version_id) : null,
      currentVersionNumber: Number(row.current_version_number),
      createdAt: iso(row.created_at) ?? "",
      updatedAt: iso(row.updated_at) ?? "",
    };
  }

  private mapRuleVersion(row: Record<string, unknown>): RuleVersion {
    return {
      id: String(row.id),
      ruleSetId: String(row.rule_set_id),
      versionNumber: Number(row.version_number),
      rules: asJson(row.rules),
      status: String(row.status) as RuleVersion["status"],
      createdBy: String(row.created_by),
      createdAt: iso(row.created_at) ?? "",
    };
  }

  private mapProject(row: Record<string, unknown>): Project {
    return {
      id: String(row.id),
      ownerId: String(row.owner_id),
      name: String(row.name),
      description: String(row.description),
      companyName: String(row.company_name),
      status: String(row.status) as Project["status"],
      createdAt: iso(row.created_at) ?? "",
      updatedAt: iso(row.updated_at) ?? "",
    };
  }

  private mapRequest(row: Record<string, unknown>): LicenseRequest {
    return {
      id: String(row.id),
      producerId: String(row.producer_id),
      projectId: String(row.project_id),
      assetId: String(row.asset_id),
      ruleVersionId: row.rule_version_id ? String(row.rule_version_id) : null,
      intendedUse: String(row.intended_use),
      usage: asJson(row.usage),
      compatibility: asJson(row.compatibility),
      status: String(row.status) as LicenseRequest["status"],
      decisionNote: row.decision_note ? String(row.decision_note) : null,
      createdAt: iso(row.created_at) ?? "",
      updatedAt: iso(row.updated_at) ?? "",
    };
  }

  private mapAgreement(row: Record<string, unknown>): LicenseAgreement {
    return {
      id: String(row.id),
      licenseId: String(row.license_id),
      requestId: String(row.request_id),
      status: String(row.status) as LicenseAgreement["status"],
      document: asJson(row.document),
      documentHash: String(row.document_hash),
      amountMinor: Number(row.amount_minor),
      currency: String(row.currency) as LicenseAgreement["currency"],
      paymentRequired: Boolean(row.payment_required),
      createdAt: iso(row.created_at) ?? "",
      updatedAt: iso(row.updated_at) ?? "",
      activatedAt: iso(row.activated_at),
    };
  }

  private mapSnapshot(row: Record<string, unknown>): RuleSnapshot {
    return {
      id: String(row.id),
      agreementId: String(row.agreement_id),
      ruleSetId: String(row.rule_set_id),
      ruleVersionId: String(row.rule_version_id),
      versionNumber: Number(row.version_number),
      rules: asJson(row.rules),
      createdAt: iso(row.created_at) ?? "",
    };
  }

  private mapConsent(row: Record<string, unknown>): ConsentRecord {
    return {
      id: String(row.id),
      agreementId: String(row.agreement_id),
      party: String(row.party) as ConsentRecord["party"],
      userId: String(row.user_id),
      statement: String(row.statement),
      agreementHash: String(row.agreement_hash),
      createdAt: iso(row.created_at) ?? "",
    };
  }

  private mapSignature(row: Record<string, unknown>): ElectronicSignature {
    return {
      id: String(row.id),
      agreementId: String(row.agreement_id),
      party: String(row.party) as ElectronicSignature["party"],
      signerUserId: String(row.signer_user_id),
      typedName: String(row.typed_name),
      method: "demo_typed_name",
      disclaimer: String(row.disclaimer),
      agreementHash: String(row.agreement_hash),
      ipAddress: row.ip_address ? String(row.ip_address) : null,
      userAgent: row.user_agent ? String(row.user_agent) : null,
      signedAt: iso(row.signed_at) ?? "",
    };
  }

  private mapPayment(row: Record<string, unknown>): PaymentRecord {
    return {
      id: String(row.id),
      agreementId: String(row.agreement_id),
      provider: String(row.provider) as PaymentRecord["provider"],
      providerRef: String(row.provider_ref),
      amountMinor: Number(row.amount_minor),
      currency: String(row.currency) as PaymentRecord["currency"],
      status: String(row.status) as PaymentRecord["status"],
      idempotencyKey: String(row.idempotency_key),
      createdAt: iso(row.created_at) ?? "",
      updatedAt: iso(row.updated_at) ?? "",
    };
  }

  private mapChain(row: Record<string, unknown>): BlockchainRecord {
    return {
      id: String(row.id),
      licenseId: String(row.license_id),
      chainId: row.chain_id === null ? null : Number(row.chain_id),
      contractAddress: row.contract_address ? String(row.contract_address) : null,
      txHash: row.tx_hash ? String(row.tx_hash) : null,
      agreementHash: String(row.agreement_hash),
      ruleSnapshotHash: String(row.rule_snapshot_hash),
      assetReference: String(row.asset_reference),
      projectReference: String(row.project_reference),
      status: String(row.status) as BlockchainRecord["status"],
      error: row.error ? String(row.error) : null,
      submittedAt: iso(row.submitted_at),
      confirmedAt: iso(row.confirmed_at),
    };
  }

  private mapNotification(row: Record<string, unknown>): Notification {
    return {
      id: String(row.id),
      userId: String(row.user_id),
      title: String(row.title),
      body: String(row.body),
      link: row.link ? String(row.link) : null,
      readAt: iso(row.read_at),
      createdAt: iso(row.created_at) ?? "",
    };
  }

  private mapReport(row: Record<string, unknown>): MisuseReport {
    return {
      id: String(row.id),
      reporterId: String(row.reporter_id),
      licenseId: row.license_id ? String(row.license_id) : null,
      assetId: row.asset_id ? String(row.asset_id) : null,
      suspectedProject: String(row.suspected_project),
      url: row.url ? String(row.url) : null,
      observedAt: iso(row.observed_at) ?? "",
      description: String(row.description),
      status: String(row.status) as MisuseReport["status"],
      createdAt: iso(row.created_at) ?? "",
      updatedAt: iso(row.updated_at) ?? "",
    };
  }

  private mapEvidence(row: Record<string, unknown>): MisuseEvidence {
    return {
      id: String(row.id),
      reportId: String(row.report_id),
      storagePath: String(row.storage_path),
      sha256: String(row.sha256),
      fileType: String(row.file_type),
      fileSize: Number(row.file_size),
      note: String(row.note),
      createdAt: iso(row.created_at) ?? "",
    };
  }

  private mapDispute(row: Record<string, unknown>): DisputeCase {
    return {
      id: String(row.id),
      reportId: row.report_id ? String(row.report_id) : null,
      agreementId: row.agreement_id ? String(row.agreement_id) : null,
      status: String(row.status) as DisputeCase["status"],
      summary: String(row.summary),
      openedBy: String(row.opened_by),
      resolution: row.resolution ? String(row.resolution) : null,
      createdAt: iso(row.created_at) ?? "",
      updatedAt: iso(row.updated_at) ?? "",
    };
  }
}

function listed<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === "string" && (allowed as readonly string[]).includes(value) ? value as T : null;
}

function readAppearance(value: unknown) {
  const row = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    gender: listed(row.gender, GENDERS),
    ageRange: listed(row.ageRange, AGE_RANGES),
    heightRange: listed(row.heightRange, HEIGHT_RANGES),
    hairColor: listed(row.hairColor, HAIR_COLORS),
    eyeColor: listed(row.eyeColor, EYE_COLORS),
  };
}
