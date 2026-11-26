import {
  AUDIT_GENESIS,
  disputeSchema,
  misuseReportSchema,
  nextAuditHash,
  sha256Hex,
  type DisputeCase,
  type MisuseReport,
} from "@suret/shared";
import type { Actor } from "../actor.js";
import { isAdmin } from "../actor.js";
import { AppError, forbidden, notFound } from "../errors.js";
import { newId, nowIso } from "../ids.js";
import type { AppRepository } from "../repos/types.js";
import type { StorageProvider } from "../storage/types.js";
import { assertAdmin, hasScope } from "./access.js";

export class ReportService {
  constructor(
    private readonly repo: AppRepository,
    private readonly storage: StorageProvider,
  ) {}

  async create(actor: Actor, input: unknown): Promise<MisuseReport> {
    const body = misuseReportSchema.parse(input);
    if (body.licenseId) {
      const agreement = await this.repo.getAgreementByLicenseId(body.licenseId);
      if (!agreement) throw notFound("License not found.");
      const allowed = actor.userId === agreement.document.licensorProfileId
        || (await hasScope(this.repo, actor, agreement.document.licensorProfileId, "view_agreements"))
        || isAdmin(actor);
      if (!allowed) throw forbidden("Only the licensor or an authorized representative can file this report.");
    }
    const timestamp = nowIso();
    const report: MisuseReport = {
      id: newId(),
      reporterId: actor.userId,
      licenseId: body.licenseId ?? null,
      assetId: body.assetId ?? null,
      suspectedProject: body.suspectedProject,
      url: body.url ?? null,
      observedAt: body.observedAt,
      description: body.description,
      status: "submitted",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.repo.transaction(async (repo) => {
      await repo.insertReport(report);
      await repo.appendAudit({
        id: newId(),
        actorId: actor.userId,
        action: "misuse_reported",
        entityType: "misuse_report",
        entityId: report.id,
        payload: { licenseId: report.licenseId, assetId: report.assetId },
        createdAt: timestamp,
      });
    });
    return report;
  }

  async addEvidence(actor: Actor, reportId: string, file: { bytes: Uint8Array; contentType: string; note: string }) {
    const report = await this.requireReadable(actor, reportId);
    if (file.bytes.byteLength === 0 || file.bytes.byteLength > 15 * 1024 * 1024) {
      throw new AppError(413, "FILE_TOO_LARGE", "Evidence files must be 15 MB or smaller.");
    }
    const evidenceId = newId();
    const storagePath = `evidence/${report.id}/${evidenceId}`;
    const sha256 = sha256Hex(file.bytes);
    await this.storage.uploadFile({ path: storagePath, body: file.bytes, contentType: file.contentType || "application/octet-stream" });
    const evidence = {
      id: evidenceId,
      reportId: report.id,
      storagePath,
      sha256,
      fileType: file.contentType || "application/octet-stream",
      fileSize: file.bytes.byteLength,
      note: file.note,
      createdAt: nowIso(),
    };
    await this.repo.insertEvidence(evidence);
    return evidence;
  }

  async list(actor: Actor): Promise<MisuseReport[]> {
    const reports = await this.repo.listReports();
    if (isAdmin(actor)) return reports;
    return reports.filter((item) => item.reporterId === actor.userId);
  }

  async get(actor: Actor, reportId: string) {
    const report = await this.requireReadable(actor, reportId);
    const evidence = await this.repo.listEvidence(report.id);
    return { report, evidence: evidence.map((item) => ({ ...item, storagePath: undefined })) };
  }

  async exportBundle(actor: Actor, reportId: string) {
    const report = await this.requireReadable(actor, reportId);
    const evidence = await this.repo.listEvidence(report.id);
    const agreement = report.licenseId ? await this.repo.getAgreementByLicenseId(report.licenseId) : null;
    const snapshot = agreement ? await this.repo.getSnapshot(agreement.id) : null;
    const consents = agreement ? await this.repo.listConsents(agreement.id) : [];
    const signatures = agreement ? await this.repo.listSignatures(agreement.id) : [];
    const chain = agreement ? await this.repo.getBlockchainRecord(agreement.licenseId) : null;
    const audit = (await this.repo.listAudit()).filter((item) => {
      return item.entityId === report.id || item.entityId === agreement?.id || item.entityId === agreement?.licenseId || item.entityId === report.assetId;
    });
    const accessLogs = report.assetId ? await this.repo.listAccessLogs(report.assetId) : [];
    return {
      exportedAt: nowIso(),
      notice: "This bundle is a platform export for legal review. Blockchain anchoring shows whether the agreement hash was recorded. It does not detect or prove external misuse by itself.",
      report,
      evidence: evidence.map((item) => ({ id: item.id, sha256: item.sha256, fileType: item.fileType, fileSize: item.fileSize, note: item.note, createdAt: item.createdAt })),
      agreement: agreement ? { id: agreement.id, licenseId: agreement.licenseId, status: agreement.status, document: agreement.document, documentHash: agreement.documentHash } : null,
      ruleSnapshot: snapshot,
      consents,
      signatures,
      blockchain: chain,
      audit,
      auditChainIntact: auditChainIntact(await this.repo.listAudit()),
      accessLogs,
    };
  }

  async openDispute(actor: Actor, input: unknown): Promise<DisputeCase> {
    const body = disputeSchema.parse(input);
    const dispute: DisputeCase = {
      id: newId(),
      reportId: body.reportId ?? null,
      agreementId: body.agreementId ?? null,
      status: "open",
      summary: body.summary,
      openedBy: actor.userId,
      resolution: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    if (body.agreementId) {
      const agreement = await this.repo.getAgreement(body.agreementId);
      if (!agreement) throw notFound("Agreement not found.");
      const party = actor.userId === agreement.document.licensorProfileId || actor.userId === agreement.document.licenseeProfileId;
      if (!party && !isAdmin(actor)) throw forbidden();
      if (agreement.status === "active") {
        await this.repo.updateAgreementStatus(agreement.id, { status: "disputed", updatedAt: nowIso(), activatedAt: agreement.activatedAt });
      }
    }
    await this.repo.insertDispute(dispute);
    return dispute;
  }

  async reviewReport(actor: Actor, reportId: string, status: MisuseReport["status"]): Promise<MisuseReport> {
    assertAdmin(actor);
    const report = await this.repo.getReport(reportId);
    if (!report) throw notFound("Report not found.");
    report.status = status;
    report.updatedAt = nowIso();
    await this.repo.updateReport(report);
    await this.repo.appendAudit({
      id: newId(),
      actorId: actor.userId,
      action: "misuse_reviewed",
      entityType: "misuse_report",
      entityId: report.id,
      payload: { status },
      createdAt: report.updatedAt,
    });
    return report;
  }

  async listDisputes(actor: Actor): Promise<DisputeCase[]> {
    assertAdmin(actor);
    return this.repo.listDisputes();
  }

  private async requireReadable(actor: Actor, reportId: string): Promise<MisuseReport> {
    const report = await this.repo.getReport(reportId);
    if (!report) throw notFound("Report not found.");
    if (report.reporterId !== actor.userId && !isAdmin(actor)) throw forbidden();
    return report;
  }
}

function auditChainIntact(entries: { prevHash: string; entryHash: string; actorId: string | null; action: string; entityType: string; entityId: string; payload: Record<string, unknown>; createdAt: string }[]): boolean {
  let previous = AUDIT_GENESIS;
  for (const entry of entries) {
    if (entry.prevHash !== previous) return false;
    const expected = nextAuditHash(previous, {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      payload: entry.payload,
      createdAt: entry.createdAt,
    });
    if (expected !== entry.entryHash) return false;
    previous = entry.entryHash;
  }
  return true;
}
