import { apiErrorText, copy, detectImageType, disputeSchema, localeFromHeader, sha256Hex, usageCheckSchema, type FaceAsset, type Role } from "@suret/shared";
import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import multer from "multer";
import { ZodError } from "zod";
import type { Actor } from "./actor.js";
import { isAdmin } from "./actor.js";
import { MemoryChainClient } from "./chain/ethers.js";
import type { ChainClient } from "./chain/types.js";
import type { AppConfig } from "./config.js";
import { AppError } from "./errors.js";
import { IyzicoPaymentProvider } from "./payments/iyzico.js";
import type { PaymentProvider } from "./payments/types.js";
import type { AppRepository } from "./repos/types.js";
import { AccountService } from "./services/accounts.js";
import { AssetService } from "./services/assets.js";
import { LicenseService } from "./services/licensing.js";
import { PaymentService } from "./services/payments.js";
import { ReportService } from "./services/reports.js";
import { RuleService } from "./services/rules.js";
import { assertAdmin } from "./services/access.js";
import { perceptualHashFor } from "./images.js";
import { MemoryStorageService } from "./storage/memory.js";
import type { StorageProvider } from "./storage/types.js";

declare global {
  namespace Express {
    interface Request {
      actor?: Actor;
      rawBody?: Buffer;
    }
  }
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

export type AppRuntime = {
  config: AppConfig;
  repo: AppRepository;
  storage: StorageProvider;
  payments: PaymentProvider;
  chain: ChainClient;
};

export function createApp(runtime: AppRuntime): {
  app: express.Express;
  accounts: AccountService;
  assets: AssetService;
  rules: RuleService;
  licenses: LicenseService;
  paymentService: PaymentService;
  reports: ReportService;
  chain: MemoryChainClient | null;
} {
  const accounts = new AccountService(runtime.repo, runtime.config);
  const assets = new AssetService(runtime.repo, runtime.storage);
  const rules = new RuleService(runtime.repo);
  const licenses = new LicenseService(runtime.repo, runtime.chain, runtime.payments.name === "sandbox");
  const paymentService = new PaymentService(runtime.repo, runtime.payments, licenses, runtime.config.paymentWebhookSecret);
  const reports = new ReportService(runtime.repo, runtime.storage);
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: runtime.config.corsOrigins, credentials: true }));
  app.use(rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false }));
  app.use(express.json({
    limit: "2mb",
    verify: (req, _res, buffer) => {
      (req as Request).rawBody = Buffer.from(buffer);
    },
  }));
  app.use(async (req, _res, next) => {
    try {
      const header = req.header("authorization") ?? "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!token) return next();
      const signingIn = req.path === "/api/v1/auth/login" || req.path === "/api/v1/auth/register";
      const identity = await accounts.readToken(token);
      if (!identity) return signingIn ? next() : next(new AppError(401, "INVALID_TOKEN", "Sign in again."));
      const profile = await runtime.repo.getProfile(identity.userId);
      if (!profile) return signingIn ? next() : next(new AppError(401, "INVALID_TOKEN", "Sign in again."));
      if (profile.suspendedAt) return next(new AppError(403, "SUSPENDED", "This account is suspended."));
      const roles = await runtime.repo.getRoles(profile.id);
      req.actor = { userId: profile.id, email: profile.email, roles, profile };
      next();
    } catch (error) {
      next(error);
    }
  });

  const requireActor = (req: Request, _res: Response, next: NextFunction) => {
    if (!req.actor) return next(new AppError(401, "UNAUTHENTICATED", "Sign in required."));
    next();
  };
  const actor = (req: Request): Actor => {
    if (!req.actor) throw new AppError(401, "UNAUTHENTICATED", "Sign in required.");
    return req.actor;
  };

  app.get("/api/v1/health", async (_req, res) => {
    res.json({
      data: {
        service: "suret-api",
        authMode: runtime.config.allowDevAuth ? "dev" : "supabase",
        dataStore: runtime.repo.constructor.name === "MemoryRepository" ? "memory" : "postgres",
        storage: runtime.storage.name,
        payments: runtime.payments.name,
        blockchain: runtime.chain.configured ? "configured" : "unconfigured",
        signatures: "demo",
        facialRecognitionEnabled: false,
      },
    });
  });

  app.post("/api/v1/auth/register", asyncHandler(async (req, res) => {
    res.status(201).json({ data: await accounts.register(req.body) });
  }));
  app.post("/api/v1/auth/login", asyncHandler(async (req, res) => {
    res.json({ data: await accounts.login(req.body) });
  }));
  app.post("/api/v1/auth/verify-email", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await accounts.verifyEmail(actor(req)) });
  }));
  app.get("/api/v1/me", requireActor, asyncHandler(async (req, res) => {
    const current = actor(req);
    res.json({ data: { profile: current.profile, roles: current.roles } });
  }));
  app.patch("/api/v1/profiles/:id", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await accounts.updateProfile(actor(req), req.params.id, req.body) });
  }));
  app.post("/api/v1/me/deletion-request", requireActor, asyncHandler(async (req, res) => {
    await accounts.requestDeletion(actor(req));
    res.status(202).json({ data: { status: "requested" } });
  }));

  app.get("/api/v1/marketplace/faces", asyncHandler(async (_req, res) => {
    res.json({ data: await assets.marketplace() });
  }));
  app.post("/api/v1/tools/photo-hash", upload.single("file"), asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, "FILE_REQUIRED", "Choose a photo to upload.");
    const bytes = new Uint8Array(req.file.buffer);
    const mediaType = detectImageType(bytes);
    if (mediaType !== "image/png" && mediaType !== "image/jpeg") {
      throw new AppError(415, "UNSUPPORTED_MEDIA", "Upload a PNG or JPEG image.");
    }
    const sha256 = sha256Hex(bytes);
    res.json({
      data: {
        mediaType,
        sha256,
        fileHash: `0x${sha256}`,
        perceptualHash: perceptualHashFor(bytes, mediaType),
      },
    });
  }));

  app.get("/api/v1/marketplace/faces/:assetId", asyncHandler(async (req, res) => {
    const card = await assets.marketplaceFace(String(req.params.assetId));
    if (!card) throw new AppError(404, "NOT_FOUND", "This likeness is not available.");
    res.json({ data: card });
  }));

  app.post("/api/v1/assets", requireActor, upload.single("file"), asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, "FILE_REQUIRED", "Choose a photo to upload.");
    const profileId = String(req.body.profileId ?? actor(req).userId);
    const asset = await assets.upload(actor(req), {
      profileId,
      filename: req.file.originalname,
      bytes: new Uint8Array(req.file.buffer),
      declaredType: req.file.mimetype,
      subject: typeof req.body.subject === "string" ? req.body.subject : undefined,
      caption: typeof req.body.caption === "string" ? req.body.caption : undefined,
    });
    res.status(201).json({ data: presentAsset(asset, actor(req)) });
  }));
  app.get("/api/v1/assets", requireActor, asyncHandler(async (req, res) => {
    const profileId = typeof req.query.profileId === "string" ? req.query.profileId : undefined;
    const list = await assets.listFor(actor(req), profileId);
    res.json({ data: list.map((item) => presentAsset(item, actor(req))) });
  }));
  app.get("/api/v1/assets/:id", requireActor, asyncHandler(async (req, res) => {
    const asset = await assets.get(actor(req), req.params.id);
    res.json({ data: presentAsset(asset, actor(req)) });
  }));
  app.post("/api/v1/assets/:id/attestation", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: presentAsset(await assets.attest(actor(req), req.params.id, req.body), actor(req)) });
  }));
  app.post("/api/v1/assets/:id/signed-url", requireActor, asyncHandler(async (req, res) => {
    const purpose = req.body?.purpose === "preview" ? "preview" : "original";
    res.json({ data: await assets.signedUrl(actor(req), req.params.id, purpose) });
  }));
  app.post("/api/v1/assets/:id/listing", requireActor, asyncHandler(async (req, res) => {
    const listed = req.body?.listed === true;
    res.json({ data: presentAsset(await assets.setListed(actor(req), req.params.id, listed), actor(req)) });
  }));
  app.delete("/api/v1/assets/:id", requireActor, asyncHandler(async (req, res) => {
    const removed = await assets.remove(actor(req), req.params.id);
    res.json({ data: { ...presentAsset(removed.asset, actor(req)), keptForLicense: removed.keptForLicense } });
  }));

  app.get("/api/v1/media/:token", asyncHandler(async (req, res) => {
    if (!(runtime.storage instanceof MemoryStorageService)) {
      throw new AppError(404, "NOT_FOUND", "This media route is only used by the local storage provider.");
    }
    const token = runtime.storage.resolveToken(req.params.token);
    const file = await runtime.storage.readFile(token.path);
    if (!file) throw new AppError(404, "NOT_FOUND", "File not found.");
    const contentType = file.contentType === "application/octet-stream" ? detectImageType(file.body) ?? file.contentType : file.contentType;
    const extension = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : contentType === "image/jpeg" ? "jpg" : "bin";
    res.setHeader("content-type", contentType);
    res.setHeader("cross-origin-resource-policy", "cross-origin");
    res.setHeader("cache-control", "private, max-age=60");
    if (req.query.download === "1") {
      res.setHeader("content-disposition", `attachment; filename="dijital-kimlik-orijinal.${extension}"`);
    }
    res.send(Buffer.from(file.body));
  }));

  app.get("/api/v1/profiles/:id/rule-sets", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await rules.list(actor(req), req.params.id) });
  }));
  app.post("/api/v1/profiles/:id/rule-sets", requireActor, asyncHandler(async (req, res) => {
    res.status(201).json({ data: await rules.create(actor(req), req.params.id, req.body) });
  }));
  app.patch("/api/v1/rule-sets/:id", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await rules.update(actor(req), req.params.id, req.body) });
  }));
  app.get("/api/v1/rule-sets/:id/versions", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await rules.versions(actor(req), req.params.id) });
  }));

  app.get("/api/v1/projects", requireActor, asyncHandler(async (req, res) => {
    const current = actor(req);
    res.json({ data: isAdmin(current) ? await runtime.repo.listProjects() : await runtime.repo.listProjects(current.userId) });
  }));
  app.post("/api/v1/projects", requireActor, asyncHandler(async (req, res) => {
    res.status(201).json({ data: await licenses.createProject(actor(req), req.body) });
  }));
  app.get("/api/v1/projects/:id", requireActor, asyncHandler(async (req, res) => {
    const project = await runtime.repo.getProject(req.params.id);
    if (!project) throw new AppError(404, "NOT_FOUND", "Project not found.");
    const member = await runtime.repo.isProjectMember(project.id, actor(req).userId);
    if (!member && !isAdmin(actor(req))) throw new AppError(403, "FORBIDDEN", "You do not have access to this project.");
    res.json({ data: project });
  }));
  app.patch("/api/v1/projects/:id", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await licenses.updateProject(actor(req), req.params.id, req.body) });
  }));

  app.post("/api/v1/license-requests/preview", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await licenses.preview(actor(req), req.body, localeFromHeader(req.header("accept-language"))) });
  }));
  app.post("/api/v1/license-requests", requireActor, asyncHandler(async (req, res) => {
    const locale = localeFromHeader(req.header("accept-language"));
    const result = await licenses.createRequest(actor(req), req.body, locale);
    if (!result.request.compatibility.allowed) {
      res.status(422).json({
        error: {
          code: "PROHIBITED_USE",
          message: apiErrorText(locale, "PROHIBITED_USE", "The request conflicts with this person's licensing rules. No license was created."),
          details: result.request.compatibility.violations,
        },
        data: result,
      });
      return;
    }
    res.status(201).json({ data: result });
  }));
  app.get("/api/v1/license-requests", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await visibleRequests(runtime.repo, actor(req)) });
  }));
  app.get("/api/v1/license-requests/:id", requireActor, asyncHandler(async (req, res) => {
    const request = await runtime.repo.getRequest(req.params.id);
    if (!request) throw new AppError(404, "NOT_FOUND", "Request not found.");
    const visible = (await visibleRequests(runtime.repo, actor(req))).some((item) => item.id === request.id);
    if (!visible) throw new AppError(403, "FORBIDDEN", "You do not have access to this request.");
    const agreement = await runtime.repo.getAgreementByRequestId(request.id);
    res.json({ data: { request, agreement } });
  }));
  app.post("/api/v1/license-requests/:id/decision", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await licenses.decide(actor(req), req.params.id, req.body, localeFromHeader(req.header("accept-language"))) });
  }));

  app.get("/api/v1/agreements", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await licenses.listForActor(actor(req)) });
  }));
  app.get("/api/v1/agreements/:id", requireActor, asyncHandler(async (req, res) => {
    const agreement = await licenses.getAgreement(actor(req), req.params.id);
    const snapshot = await runtime.repo.getSnapshot(agreement.id);
    const consents = await runtime.repo.listConsents(agreement.id);
    const signatures = await runtime.repo.listSignatures(agreement.id);
    const chain = await runtime.repo.getBlockchainRecord(agreement.licenseId);
    res.json({
      data: {
        agreement,
        snapshot,
        consents,
        signatures,
        chain,
        signatureDisclaimer: copy(localeFromHeader(req.header("accept-language"))).legal.signatureShort,
      },
    });
  }));
  app.post("/api/v1/agreements/:id/complete", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await licenses.complete(actor(req), req.params.id, localeFromHeader(req.header("accept-language"))) });
  }));
  app.post("/api/v1/agreements/:id/consent", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await licenses.consent(actor(req), req.params.id, localeFromHeader(req.header("accept-language"))) });
  }));
  app.post("/api/v1/agreements/:id/sign", requireActor, asyncHandler(async (req, res) => {
    res.json({
      data: await licenses.sign(actor(req), req.params.id, req.body, {
        ipAddress: req.ip ?? null,
        userAgent: req.header("user-agent") ?? null,
        locale: localeFromHeader(req.header("accept-language")),
      }),
    });
  }));

  app.post("/api/v1/licenses/:licenseId/usage-checks", requireActor, asyncHandler(async (req, res) => {
    usageCheckSchema.parse(req.body);
    res.json({ data: await licenses.checkUsage(actor(req), req.params.licenseId, req.body, localeFromHeader(req.header("accept-language"))) });
  }));
  app.post("/api/v1/licenses/:licenseId/blockchain", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await licenses.submitChain(actor(req), req.params.licenseId) });
  }));
  app.get("/api/v1/verification/:licenseId", asyncHandler(async (req, res) => {
    const presented = String(req.query.agreementHash ?? "");
    res.json({ data: await licenses.verify(req.params.licenseId, presented, localeFromHeader(req.header("accept-language"))) });
  }));

  app.get("/api/v1/wallet", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await paymentService.wallet(actor(req).userId) });
  }));
  app.post("/api/v1/agreements/:id/payments", requireActor, asyncHandler(async (req, res) => {
    const key = req.header("idempotency-key") ?? `manual_${req.params.id}`;
    res.status(201).json({ data: await paymentService.initiate(actor(req), req.params.id, key) });
  }));
  app.post("/api/v1/payments/:id/sandbox/simulate", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await paymentService.simulateSandbox(actor(req), req.params.id) });
  }));
  app.post("/api/v1/payments/webhooks/sandbox", asyncHandler(async (req, res) => {
    const result = await paymentService.applyWebhook(req.headers, req.rawBody?.toString("utf8") ?? JSON.stringify(req.body));
    res.json({ data: result });
  }));
  app.post("/api/v1/payments/webhooks/iyzico", asyncHandler(async (req, res) => {
    if (!(runtime.payments instanceof IyzicoPaymentProvider)) {
      throw new AppError(404, "NOT_FOUND", "iyzico is not the configured payment provider.");
    }
    const token = String(req.body?.token ?? "");
    if (!token) throw new AppError(400, "TOKEN_REQUIRED", "iyzico callback token is required.");
    const event = await runtime.payments.retrieve(token);
    res.json({ data: await paymentService.applyEvent(event) });
  }));
  app.get("/api/v1/payments", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await paymentService.list(actor(req)) });
  }));
  app.post("/api/v1/payments/:id/refund", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await paymentService.refund(actor(req), req.params.id) });
  }));

  app.get("/api/v1/notifications", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await runtime.repo.listNotifications(actor(req).userId) });
  }));
  app.post("/api/v1/notifications/:id/read", requireActor, asyncHandler(async (req, res) => {
    await runtime.repo.markNotificationRead(req.params.id, actor(req).userId, new Date().toISOString());
    res.json({ data: { id: req.params.id, read: true } });
  }));

  app.post("/api/v1/misuse-reports", requireActor, asyncHandler(async (req, res) => {
    res.status(201).json({ data: await reports.create(actor(req), req.body) });
  }));
  app.get("/api/v1/misuse-reports", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await reports.list(actor(req)) });
  }));
  app.get("/api/v1/misuse-reports/:id", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await reports.get(actor(req), req.params.id) });
  }));
  app.post("/api/v1/misuse-reports/:id/evidence", requireActor, upload.single("file"), asyncHandler(async (req, res) => {
    if (!req.file) throw new AppError(400, "FILE_REQUIRED", "Attach an evidence file.");
    res.status(201).json({
      data: await reports.addEvidence(actor(req), req.params.id, {
        bytes: new Uint8Array(req.file.buffer),
        contentType: req.file.mimetype,
        note: String(req.body.note ?? ""),
      }),
    });
  }));
  app.get("/api/v1/misuse-reports/:id/export", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await reports.exportBundle(actor(req), req.params.id) });
  }));
  app.post("/api/v1/disputes", requireActor, asyncHandler(async (req, res) => {
    disputeSchema.parse(req.body);
    res.status(201).json({ data: await reports.openDispute(actor(req), req.body) });
  }));

  app.post("/api/v1/agencies", requireActor, asyncHandler(async (req, res) => {
    res.status(201).json({ data: await accounts.createAgency(actor(req), req.body) });
  }));
  app.get("/api/v1/agencies", requireActor, asyncHandler(async (req, res) => {
    const ids = await runtime.repo.agencyIdsForUser(actor(req).userId);
    const agencies = (await runtime.repo.listAgencies()).filter((item) => ids.includes(item.id) || isAdmin(actor(req)));
    res.json({ data: agencies });
  }));
  app.post("/api/v1/representations", requireActor, asyncHandler(async (req, res) => {
    res.status(201).json({ data: await accounts.grantRepresentation(actor(req), req.body) });
  }));
  app.post("/api/v1/representations/:id/revoke", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await accounts.revokeRepresentation(actor(req), req.params.id) });
  }));
  app.get("/api/v1/representations", requireActor, asyncHandler(async (req, res) => {
    const current = actor(req);
    const own = await runtime.repo.listRepresentations({ profileId: current.userId });
    const agencyIds = await runtime.repo.agencyIdsForUser(current.userId);
    const managed = [];
    for (const agencyId of agencyIds) managed.push(...await runtime.repo.listRepresentations({ agencyId }));
    res.json({ data: isAdmin(current) ? await runtime.repo.listRepresentations({}) : [...own, ...managed] });
  }));

  app.get("/api/v1/admin/users", requireActor, asyncHandler(async (req, res) => {
    assertAdmin(actor(req));
    const profiles = await runtime.repo.listProfiles();
    const withRoles = [];
    for (const profile of profiles) withRoles.push({ profile, roles: await runtime.repo.getRoles(profile.id) });
    res.json({ data: withRoles });
  }));
  app.post("/api/v1/admin/users/:id/roles", requireActor, asyncHandler(async (req, res) => {
    const roles = Array.isArray(req.body?.roles) ? req.body.roles as Role[] : [];
    await accounts.setRoles(actor(req), req.params.id, roles);
    res.json({ data: { id: req.params.id, roles } });
  }));
  app.post("/api/v1/admin/users/:id/suspension", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await accounts.suspend(actor(req), req.params.id, Boolean(req.body?.suspended)) });
  }));
  app.post("/api/v1/admin/users/:id/verification", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await accounts.setVerification(actor(req), req.params.id, req.body?.status) });
  }));
  app.post("/api/v1/admin/assets/:id/moderation", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await assets.moderate(actor(req), req.params.id, req.body?.status) });
  }));
  app.get("/api/v1/admin/audit-logs", requireActor, asyncHandler(async (req, res) => {
    assertAdmin(actor(req));
    res.json({ data: await runtime.repo.listAudit() });
  }));
  app.get("/api/v1/admin/licenses", requireActor, asyncHandler(async (req, res) => {
    assertAdmin(actor(req));
    res.json({ data: await runtime.repo.listAgreements() });
  }));
  app.get("/api/v1/admin/payments", requireActor, asyncHandler(async (req, res) => {
    assertAdmin(actor(req));
    res.json({ data: await runtime.repo.listPayments() });
  }));
  app.get("/api/v1/admin/reports", requireActor, asyncHandler(async (req, res) => {
    assertAdmin(actor(req));
    res.json({ data: await reports.list(actor(req)) });
  }));
  app.post("/api/v1/admin/reports/:id/status", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await reports.reviewReport(actor(req), req.params.id, req.body?.status) });
  }));
  app.get("/api/v1/admin/disputes", requireActor, asyncHandler(async (req, res) => {
    res.json({ data: await reports.listDisputes(actor(req)) });
  }));
  app.get("/api/v1/admin/settings", requireActor, asyncHandler(async (req, res) => {
    assertAdmin(actor(req));
    res.json({ data: await runtime.repo.getSettings() });
  }));
  app.patch("/api/v1/admin/settings", requireActor, asyncHandler(async (req, res) => {
    assertAdmin(actor(req));
    const current = await runtime.repo.getSettings();
    await runtime.repo.updateSettings({ ...current, ...req.body, facialRecognitionEnabled: false, signatureMode: "demo" });
    res.json({ data: await runtime.repo.getSettings() });
  }));
  app.post("/api/v1/admin/jobs/expire-licenses", requireActor, asyncHandler(async (req, res) => {
    assertAdmin(actor(req));
    res.json({ data: { expired: await licenses.expireDue() } });
  }));

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const locale = localeFromHeader(req.header("accept-language"));
    const message = (code: string, fallback: string) => apiErrorText(locale, code, fallback);
    if (error instanceof ZodError) {
      res.status(400).json({ error: { code: "VALIDATION", message: message("VALIDATION", "Request validation failed."), details: error.flatten() } });
      return;
    }
    if (error instanceof multer.MulterError) {
      res.status(413).json({ error: { code: "FILE_TOO_LARGE", message: message("FILE_TOO_LARGE", error.message) } });
      return;
    }
    if (error instanceof AppError) {
      res.status(error.status).json({ error: { code: error.code, message: message(error.code, error.message), details: error.details ?? null } });
      return;
    }
    console.error(error);
    res.status(500).json({ error: { code: "INTERNAL", message: message("INTERNAL", "Unexpected error.") } });
  });

  return { app, accounts, assets, rules, licenses, paymentService, reports, chain: runtime.chain instanceof MemoryChainClient ? runtime.chain : null };
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

function presentAsset(asset: FaceAsset, current: Actor) {
  if (current.userId === asset.profileId || current.userId === asset.uploaderId || isAdmin(current)) return asset;
  return {
    ...asset,
    storagePath: null,
    previewPath: null,
  };
}

async function visibleRequests(repo: AppRepository, current: Actor) {
  if (isAdmin(current)) return repo.listRequests();
  const incoming = await repo.listRequests({ ownerId: current.userId });
  const outgoing = await repo.listRequests({ producerId: current.userId });
  const agencyIds = await repo.agencyIdsForUser(current.userId);
  const representations = await repo.listRepresentations({ status: "active" });
  const managed = [];
  for (const representation of representations) {
    if (agencyIds.includes(representation.agencyId) && representation.scopes.includes("review_requests")) {
      managed.push(...await repo.listRequests({ ownerId: representation.profileId }));
    }
  }
  const byId = new Map([...incoming, ...outgoing, ...managed].map((item) => [item.id, item]));
  return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
