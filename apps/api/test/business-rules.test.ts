import { signPayload, type UsageRequest } from "@suret/shared";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/http.js";
import { MemoryChainClient } from "../src/chain/ethers.js";
import { loadConfig } from "../src/config.js";
import { checkerPng } from "../src/images.js";
import { SandboxPaymentProvider } from "../src/payments/sandbox.js";
import { MemoryRepository } from "../src/repos/memory.js";
import { MemoryStorageService } from "../src/storage/memory.js";

const secret = "test-webhook-secret";

type Session = { token: string; id: string; email: string; displayName: string };

function usage(patch: Partial<Omit<UsageRequest, "ai">> & { ai?: Partial<UsageRequest["ai"]> } = {}): UsageRequest {
  const { ai, ...rest } = patch;
  return {
    categories: ["advertising"],
    commercial: true,
    distributionChannels: ["streaming"],
    territories: ["TR"],
    startsOn: "2026-11-01",
    endsOn: "2027-01-29",
    downloadOriginal: false,
    editing: false,
    cropping: false,
    sublicensing: false,
    contentDeclarations: [],
    companyName: "Northstar Pictures",
    proposedAmountMinor: null,
    otherCategoryNote: "",
    ...rest,
    ai: {
      transformations: false,
      stillImages: false,
      video: false,
      digitalCharacter: false,
      voiceSynthesis: false,
      motionSynthesis: false,
      modelTraining: false,
      ...ai,
    },
  };
}

function elifRules() {
  return {
    permitted: {
      categories: ["advertising"],
      commercialUse: "commercial",
      distributionChannels: ["streaming", "social_media"],
      territories: ["TR"],
      maxDurationDays: 90,
      allowDownloadOriginal: false,
      allowEditing: true,
      allowCropping: true,
      ai: usage().ai,
      sublicensing: false,
      additionalCompensationForExpandedUsage: true,
      companyAllowlist: null,
    },
    prohibited: {
      categories: ["erotic", "political_advertising", "gambling", "ai_training", "voice_cloning"],
      custom: [{ id: "weapons", label: "Weapons advertising", description: "No weapons campaigns." }],
    },
    commercial: {
      pricingMode: "fixed",
      currency: "TRY",
      basePriceMinor: 250000,
      categoryPrices: {},
      expandedRightsFeeMinor: null,
      perDayMinor: null,
      renewalAllowed: false,
      renewalRequiresNewAgreement: true,
      sublicensingFeeMinor: null,
      notes: "Project-specific advertising.",
    },
  };
}

async function harness() {
  const repo = new MemoryRepository();
  const chain = new MemoryChainClient();
  const config = loadConfig({
    NODE_ENV: "test",
    ALLOW_DEV_AUTH: "true",
    SEED_DEMO_DATA: "false",
    DEV_JWT_SECRET: "test-secret",
    PAYMENT_WEBHOOK_SECRET: secret,
    API_PUBLIC_URL: "http://localhost:4000",
    STORAGE_ROOT: `data/test-${crypto.randomUUID()}`,
  });
  const storage = new MemoryStorageService(config.storageRoot, config.apiPublicUrl, config.devJwtSecret);
  const payments = new SandboxPaymentProvider(secret, config.apiPublicUrl);
  const runtime = createApp({ config, repo, storage, payments, chain });
  const api = request(runtime.app);

  async function register(email: string, role: "face_owner" | "producer" | "agency_member", displayName: string): Promise<Session> {
    const response = await api.post("/api/v1/auth/register").send({ email, password: "password123", displayName, role });
    expect(response.status).toBe(201);
    const token = response.body.data.accessToken as string;
    await api.post("/api/v1/auth/verify-email").set(auth(token)).expect(200);
    return { token, id: response.body.data.profile.id, email, displayName };
  }

  return { api, repo, chain, register };
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

describe("platform business rules", () => {
  let env: Awaited<ReturnType<typeof harness>>;

  beforeEach(async () => {
    env = await harness();
  });

  it("lets a person define permitted and prohibited uses, and blocks a violating request", async () => {
    const owner = await env.register("elif@example.com", "face_owner", "Elif Demir");
    const producer = await env.register("producer@example.com", "producer", "Northstar Pictures");
    const admin = await prepareAdmin(env);
    const assetId = await authorizeAsset(env, owner, admin);
    const rules = await env.api.post(`/api/v1/profiles/${owner.id}/rule-sets`).set(auth(owner.token)).send({
      name: "Elif's rules",
      publish: true,
      rules: elifRules(),
    });
    expect(rules.status).toBe(201);
    const project = await createProject(env, producer, "Astronaut campaign");
    const blocked = await env.api.post("/api/v1/license-requests").set(auth(producer.token)).send({
      projectId: project.id,
      assetId,
      intendedUse: "This campaign includes erotic content.",
      usage: usage({ contentDeclarations: ["erotic"] }),
    });
    expect(blocked.status).toBe(422);
    expect(blocked.body.error.code).toBe("PROHIBITED_USE");
    expect(blocked.body.data.agreement).toBeNull();
  });

  it("does not let an astronaut advertisement license authorize a different film, even under the same name", async () => {
    const { owner, producer, agreement } = await activeAdvertisingLicense();
    const film = await createProject(env, producer, "Black Sea feature");
    const filmCheck = await env.api.post(`/api/v1/licenses/${agreement.licenseId}/usage-checks`).set(auth(producer.token)).send({
      projectId: film.id,
      usage: usage({ categories: ["film"] }),
    });
    expect(filmCheck.body.data.allowed).toBe(false);
    expect(filmCheck.body.data.violations.map((item: { code: string }) => item.code)).toContain("project_mismatch");

    await env.api.patch(`/api/v1/projects/${agreement.document.projectId}`).set(auth(producer.token)).send({ name: "Renamed campaign" }).expect(200);
    const sameProject = await env.api.post(`/api/v1/licenses/${agreement.licenseId}/usage-checks`).set(auth(producer.token)).send({
      projectId: agreement.document.projectId,
      usage: usage(),
    });
    expect(sameProject.body.data.allowed).toBe(true);

    const lookalike = await createProject(env, producer, "Astronaut campaign");
    const renamedBypass = await env.api.post(`/api/v1/licenses/${agreement.licenseId}/usage-checks`).set(auth(producer.token)).send({
      projectId: lookalike.id,
      usage: usage(),
    });
    expect(renamedBypass.body.data.allowed).toBe(false);
    expect(renamedBypass.body.data.attemptedProjectName).toBe("Astronaut campaign");
    expect(owner.id).toBeTruthy();
  });

  it("checks AI permissions separately and preserves the accepted rule version", async () => {
    const owner = await env.register("elif2@example.com", "face_owner", "Elif Demir");
    const producer = await env.register("producer2@example.com", "producer", "Northstar Pictures");
    const admin = await prepareAdmin(env);
    const assetId = await authorizeAsset(env, owner, admin);
    const created = await env.api.post(`/api/v1/profiles/${owner.id}/rule-sets`).set(auth(owner.token)).send({
      name: "Elif's rules",
      publish: true,
      rules: elifRules(),
    });
    const ruleSetId = created.body.data.ruleSet.id as string;
    const project = await createProject(env, producer, "Astronaut campaign");
    const ai = await env.api.post("/api/v1/license-requests").set(auth(producer.token)).send({
      projectId: project.id,
      assetId,
      intendedUse: "Train a private model on this face.",
      usage: usage({ ai: { modelTraining: true } }),
    });
    expect(ai.status).toBe(422);
    expect(ai.body.error.details.map((item: { code: string }) => item.code)).toEqual(
      expect.arrayContaining(["ai_modelTraining_not_permitted", "ai_modelTraining_prohibited"]),
    );

    const request = await env.api.post("/api/v1/license-requests").set(auth(producer.token)).send({
      projectId: project.id,
      assetId,
      intendedUse: "Astronaut-themed streaming advertisement for three months.",
      usage: usage(),
    });
    expect(request.status).toBe(201);
    const agreementId = request.body.data.agreement.id as string;
    const before = await env.api.get(`/api/v1/agreements/${agreementId}`).set(auth(owner.token));
    const snapshotBefore = structuredClone(before.body.data.snapshot.rules);

    const edited = structuredClone(elifRules());
    edited.permitted.categories = ["advertising", "film"];
    edited.prohibited.categories = ["erotic"];
    await env.api.patch(`/api/v1/rule-sets/${ruleSetId}`).set(auth(owner.token)).send({ rules: edited, publish: true }).expect(200);
    const after = await env.api.get(`/api/v1/agreements/${agreementId}`).set(auth(owner.token));
    expect(after.body.data.snapshot.rules).toEqual(snapshotBefore);
    expect(after.body.data.agreement.documentHash).toBe(before.body.data.agreement.documentHash);
    expect(after.body.data.snapshot.versionNumber).toBe(1);
  });

  it("stops another person, including an administrator, from changing someone's rules", async () => {
    const owner = await env.register("elif3@example.com", "face_owner", "Elif Demir");
    const stranger = await env.register("stranger@example.com", "face_owner", "Someone Else");
    const admin = await prepareAdmin(env);
    const created = await env.api.post(`/api/v1/profiles/${owner.id}/rule-sets`).set(auth(owner.token)).send({
      name: "Private rules",
      publish: false,
      rules: elifRules(),
    });
    const ruleSetId = created.body.data.ruleSet.id as string;
    await env.api.patch(`/api/v1/rule-sets/${ruleSetId}`).set(auth(stranger.token)).send({ rules: elifRules(), publish: true }).expect(403);
    await env.api.patch(`/api/v1/rule-sets/${ruleSetId}`).set(auth(admin.token)).send({ rules: elifRules(), publish: true }).expect(403);
  });

  it("flags exact and similar uploads instead of treating a hash as identity", async () => {
    const owner = await env.register("elif4@example.com", "face_owner", "Elif Demir");
    const original = checkerPng(32);
    const first = await env.api.post("/api/v1/assets").set(auth(owner.token)).attach("file", original, { filename: "a.png", contentType: "image/png" });
    expect(first.status).toBe(201);
    const exact = await env.api.post("/api/v1/assets").set(auth(owner.token)).attach("file", original, { filename: "b.png", contentType: "image/png" });
    expect(exact.status).toBe(201);
    expect(exact.body.data.duplicateFlags.some((item: { kind: string }) => item.kind === "exact")).toBe(true);
    expect(exact.body.data.moderationStatus).toBe("pending_review");

    const similar = await env.api.post("/api/v1/assets").set(auth(owner.token)).attach("file", checkerPng(64), { filename: "c.png", contentType: "image/png" });
    expect(similar.body.data.duplicateFlags.some((item: { kind: string }) => item.kind === "similar")).toBe(true);
    await env.api.post("/api/v1/assets").set(auth(owner.token)).attach("file", Buffer.from("not an image"), { filename: "x.txt", contentType: "text/plain" }).expect(415);
  });

  it("rejects unsigned and duplicate payment webhooks and does not activate without chain confirmation", async () => {
    const { owner, producer, agreement } = await draftAgreement();
    env.chain.failNext = true;
    const approved = await env.api.post(`/api/v1/license-requests/${agreement.requestId}/decision`).set(auth(owner.token)).send({ decision: "approve" });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe("recording_failed");
    const raw = JSON.stringify({
      eventId: "evt-1",
      providerRef: `approval_${agreement.id}`,
      status: "succeeded",
      amountMinor: agreement.amountMinor,
    });
    await env.api.post("/api/v1/payments/webhooks/sandbox").set("x-suret-timestamp", String(Date.now())).set("x-suret-signature", "bad").send(raw).expect(401);
    const timestamp = String(Date.now());
    const signature = signPayload(secret, timestamp, raw);
    const first = await env.api.post("/api/v1/payments/webhooks/sandbox").set("x-suret-timestamp", timestamp).set("x-suret-signature", signature).set("content-type", "application/json").send(raw);
    expect(first.status).toBe(200);
    expect(first.body.data.duplicate).toBe(true);
    const second = await env.api.post("/api/v1/payments/webhooks/sandbox").set("x-suret-timestamp", timestamp).set("x-suret-signature", signature).set("content-type", "application/json").send(raw);
    expect(second.body.data.duplicate).toBe(true);
    const still = await env.api.get(`/api/v1/agreements/${agreement.id}`).set(auth(producer.token));
    expect(still.body.data.agreement.status).toBe("recording_failed");
  });

  it("keeps a license inactive when blockchain recording fails, then activates only after confirmation", async () => {
    const { owner, producer, agreement } = await draftAgreement();
    env.chain.failNext = true;
    const failed = await env.api.post(`/api/v1/license-requests/${agreement.requestId}/decision`).set(auth(owner.token)).send({ decision: "approve" });
    expect(failed.status).toBe(200);
    expect(failed.body.data.status).toBe("recording_failed");
    const afterFailure = await env.api.get(`/api/v1/agreements/${agreement.id}`).set(auth(producer.token));
    expect(afterFailure.body.data.agreement.status).toBe("recording_failed");
    expect(afterFailure.body.data.chain.status).toBe("failed");
    const confirmed = await env.api.post(`/api/v1/licenses/${agreement.licenseId}/blockchain`).set(auth(producer.token));
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.data.status).toBe("confirmed");
    const active = await env.api.get(`/api/v1/agreements/${agreement.id}`).set(auth(producer.token));
    expect(active.body.data.agreement.status).toBe("active");
  });

  it("detects an agreement-hash mismatch and accepts a misuse report with evidence", async () => {
    const { owner, agreement } = await activeAdvertisingLicense();
    const mismatch = await env.api.get(`/api/v1/verification/${agreement.licenseId}`).query({ agreementHash: "ab".repeat(32) });
    expect(mismatch.body.data.documentMatches).toBe(false);
    expect(mismatch.body.data.chainMatches).toBe(false);
    const match = await env.api.get(`/api/v1/verification/${agreement.licenseId}`).query({ agreementHash: agreement.documentHash });
    expect(match.body.data.documentMatches).toBe(true);
    expect(match.body.data.chainMatches).toBe(true);
    expect(match.body.data.explanation).toContain("Kimliği");
    const english = await env.api.get(`/api/v1/verification/${agreement.licenseId}`).set("accept-language", "en").query({ agreementHash: agreement.documentHash });
    expect(english.body.data.explanation).toContain("does not prove identity");

    const report = await env.api.post("/api/v1/misuse-reports").set(auth(owner.token)).send({
      licenseId: agreement.licenseId,
      assetId: agreement.document.assetId,
      suspectedProject: "Unrelated cologne campaign",
      url: "https://example.com/suspected-ad",
      observedAt: new Date().toISOString(),
      description: "The face appears in a campaign that is not the licensed astronaut advertisement.",
    });
    expect(report.status).toBe(201);
    const evidence = await env.api
      .post(`/api/v1/misuse-reports/${report.body.data.id}/evidence`)
      .set(auth(owner.token))
      .field("note", "Screenshot of the suspected page")
      .attach("file", Buffer.from("evidence-bytes"), { filename: "note.txt", contentType: "text/plain" });
    expect(evidence.status).toBe(201);
    const exported = await env.api.get(`/api/v1/misuse-reports/${report.body.data.id}/export`).set(auth(owner.token));
    expect(exported.body.data.agreement.documentHash).toBe(agreement.documentHash);
    expect(exported.body.data.evidence[0].sha256).toHaveLength(64);
    expect(exported.body.data.blockchain.status).toBe("confirmed");
    expect(exported.body.data.auditChainIntact).toBe(true);
  });

  it("gives the licensee the original only after an active license grants the download", async () => {
    const owner = await env.register(`elif-${crypto.randomUUID()}@example.com`, "face_owner", "Elif Demir");
    const producer = await env.register(`producer-${crypto.randomUUID()}@example.com`, "producer", "Northstar Pictures");
    const admin = await prepareAdmin(env);
    const assetId = await authorizeAsset(env, owner, admin);
    const rules = elifRules();
    rules.permitted.allowDownloadOriginal = true;
    await env.api.post(`/api/v1/profiles/${owner.id}/rule-sets`).set(auth(owner.token)).send({ name: "Rules", publish: true, rules }).expect(201);
    const project = await createProject(env, producer, "File delivery");
    const requested = await env.api.post("/api/v1/license-requests").set(auth(producer.token)).send({
      projectId: project.id,
      assetId,
      intendedUse: "A licensed advertising still that includes the original file.",
      usage: usage({ downloadOriginal: true, startsOn: "2026-10-01", endsOn: "2026-12-20" }),
    });
    expect(requested.status).toBe(201);
    const agreement = requested.body.data.agreement;
    expect(agreement.document.granted.downloadOriginal).toBe(true);
    const before = await env.api.post(`/api/v1/assets/${assetId}/signed-url`).set(auth(producer.token)).send({ purpose: "original" });
    expect(before.status).toBe(403);
    const approved = await env.api.post(`/api/v1/license-requests/${agreement.requestId}/decision`).set(auth(owner.token)).send({ decision: "approve" });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe("active");
    const file = await env.api.post(`/api/v1/assets/${assetId}/signed-url`).set(auth(producer.token)).send({ purpose: "original" });
    expect(file.status).toBe(200);
    expect(file.body.data.url).toContain("/api/v1/media/");
    const stranger = await env.register(`other-${crypto.randomUUID()}@example.com`, "producer", "Other Producer");
    const denied = await env.api.post(`/api/v1/assets/${assetId}/signed-url`).set(auth(stranger.token)).send({ purpose: "original" });
    expect(denied.status).toBe(403);
  });

  it("lets the owner delete an unlicensed photo and keeps a licensed file", async () => {
    const owner = await env.register(`elif-${crypto.randomUUID()}@example.com`, "face_owner", "Elif Demir");
    const uploaded = await env.api.post("/api/v1/assets").set(auth(owner.token)).attach("file", checkerPng(24), { filename: "spare.png", contentType: "image/png" });
    expect(uploaded.status).toBe(201);
    const spareId = uploaded.body.data.id as string;
    const removed = await env.api.delete(`/api/v1/assets/${spareId}`).set(auth(owner.token));
    expect(removed.status).toBe(200);
    const listed = await env.api.get("/api/v1/assets").set(auth(owner.token));
    expect(listed.body.data.map((item: { id: string }) => item.id)).not.toContain(spareId);
    const { owner: licensor, producer, assetId, agreement } = await activeAdvertisingLicense();
    await env.api.patch(`/api/v1/profiles/${licensor.id}`).set(auth(licensor.token)).send({
      privacy: { discoverable: true, showPreviewToProducers: false, showLegalName: false },
    }).expect(200);
    const visible = await env.api.get("/api/v1/marketplace/faces");
    expect(visible.body.data.some((item: { assetId: string }) => item.assetId === assetId)).toBe(true);
    const hidden = await env.api.post(`/api/v1/assets/${assetId}/listing`).set(auth(licensor.token)).send({ listed: false });
    expect(hidden.status).toBe(200);
    const after = await env.api.get("/api/v1/marketplace/faces");
    expect(after.body.data.some((item: { assetId: string }) => item.assetId === assetId)).toBe(false);
    await env.api.post(`/api/v1/assets/${assetId}/listing`).set(auth(licensor.token)).send({ listed: true }).expect(200);
    const withdrawn = await env.api.delete(`/api/v1/assets/${assetId}`).set(auth(licensor.token)).set("accept-language", "tr");
    expect(withdrawn.status).toBe(200);
    expect(withdrawn.body.data.keptForLicense).toBe(true);
    const afterDelete = await env.api.get("/api/v1/assets").set(auth(licensor.token));
    expect(afterDelete.body.data.map((item: { id: string }) => item.id)).not.toContain(assetId);
    const gone = await env.api.get("/api/v1/marketplace/faces");
    expect(gone.body.data.some((item: { assetId: string }) => item.assetId === assetId)).toBe(false);
    const kept = await env.api.get(`/api/v1/agreements/${agreement.id}`).set(auth(licensor.token));
    expect(kept.status).toBe(200);
    const file = await env.api.post(`/api/v1/assets/${assetId}/signed-url`).set(auth(producer.token)).send({ purpose: "original" });
    expect(file.status).toBe(409);
    expect(file.body.error.code).toBe("DOWNLOAD_NOT_YET");
  });

  it("applies a photo's own rules and leaves the general rules for the other photo", async () => {
    const owner = await env.register(`elif-${crypto.randomUUID()}@example.com`, "face_owner", "Elif Demir");
    const producer = await env.register(`producer-${crypto.randomUUID()}@example.com`, "producer", "Northstar Pictures");
    const admin = await prepareAdmin(env);
    const first = await authorizeAsset(env, owner, admin);
    const second = await authorizeAsset(env, owner, admin);
    const general = elifRules();
    general.permitted.territories = ["TR"];
    await env.api.post(`/api/v1/profiles/${owner.id}/rule-sets`).set(auth(owner.token)).send({ name: "General", publish: true, rules: general }).expect(201);
    const own = elifRules();
    own.permitted.territories = ["DE"];
    await env.api.post(`/api/v1/profiles/${owner.id}/rule-sets`).set(auth(owner.token)).send({ name: "This photo", assetId: second, publish: true, rules: own }).expect(201);
    const project = await createProject(env, producer, "Separate photo terms");
    const requestFor = (assetId: string, territory: string) => env.api.post("/api/v1/license-requests/preview").set(auth(producer.token)).send({
      projectId: project.id,
      assetId,
      intendedUse: "A streaming advertisement for this one photograph.",
      usage: usage({ territories: [territory] }),
    });
    expect((await requestFor(first, "TR")).body.data.allowed).toBe(true);
    expect((await requestFor(second, "TR")).body.data.allowed).toBe(false);
    expect((await requestFor(second, "DE")).body.data.allowed).toBe(true);
  });

  it("does not let an administrator fabricate consent", async () => {
    const { admin, agreement } = await draftAgreement();
    const response = await env.api.post(`/api/v1/agreements/${agreement.id}/consent`).set(auth(admin.token));
    expect(response.status).toBe(403);
  });

  async function prepareAdmin(current: Awaited<ReturnType<typeof harness>>): Promise<Session> {
    const admin = await current.register("admin@example.com", "face_owner", "Platform Admin");
    const profile = (await current.repo.getProfile(admin.id))!;
    profile.verificationStatus = "verified";
    await current.repo.updateProfile(profile);
    await current.repo.setRoles(admin.id, ["admin"]);
    return admin;
  }

  async function authorizeAsset(current: Awaited<ReturnType<typeof harness>>, owner: Session, admin: Session): Promise<string> {
    const uploaded = await current.api.post("/api/v1/assets").set(auth(owner.token)).attach("file", checkerPng(32), { filename: "portrait.png", contentType: "image/png" });
    expect(uploaded.status).toBe(201);
    const assetId = uploaded.body.data.id as string;
    await current.api.post(`/api/v1/assets/${assetId}/attestation`).set(auth(owner.token)).send({
      statement: "I am the person in this photograph and I can license this likeness.",
    }).expect(200);
    const ownerProfile = (await current.repo.getProfile(owner.id))!;
    ownerProfile.verificationStatus = "verified";
    await current.repo.updateProfile(ownerProfile);
    await current.api.post(`/api/v1/admin/assets/${assetId}/moderation`).set(auth(admin.token)).send({ status: "authorized" }).expect(200);
    return assetId;
  }

  async function createProject(current: Awaited<ReturnType<typeof harness>>, producer: Session, name: string) {
    const response = await current.api.post("/api/v1/projects").set(auth(producer.token)).send({
      name,
      description: `${name} is a distinct production with its own scope.`,
      companyName: "Northstar Pictures",
    });
    expect(response.status).toBe(201);
    return response.body.data as { id: string; name: string };
  }

  async function draftAgreement() {
    const owner = await env.register(`elif-${crypto.randomUUID()}@example.com`, "face_owner", "Elif Demir");
    const producer = await env.register(`producer-${crypto.randomUUID()}@example.com`, "producer", "Northstar Pictures");
    const admin = await prepareAdmin(env);
    const assetId = await authorizeAsset(env, owner, admin);
    await env.api.post(`/api/v1/profiles/${owner.id}/rule-sets`).set(auth(owner.token)).send({ name: "Rules", publish: true, rules: elifRules() }).expect(201);
    const project = await createProject(env, producer, "Astronaut campaign");
    const request = await env.api.post("/api/v1/license-requests").set(auth(producer.token)).send({
      projectId: project.id,
      assetId,
      intendedUse: "Astronaut-themed streaming advertisement for three months.",
      usage: usage(),
    });
    expect(request.status).toBe(201);
    return { owner, producer, admin, assetId, agreement: request.body.data.agreement, project };
  }

  async function signedLicense() {
    const draft = await draftAgreement();
    const approved = await env.api.post(`/api/v1/license-requests/${draft.agreement.requestId}/decision`).set(auth(draft.owner.token)).send({ decision: "approve" });
    expect(approved.status).toBe(200);
    expect(approved.body.data.status).toBe("active");
    return { ...draft, agreement: approved.body.data };
  }

  async function activeAdvertisingLicense() {
    return signedLicense();
  }
});
