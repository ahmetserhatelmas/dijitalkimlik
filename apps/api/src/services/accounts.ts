import {
  blankAppearance,
  agencyCreateSchema,
  loginSchema,
  profilePatchSchema,
  registerSchema,
  representationSchema,
  type Agency,
  type Profile,
  type RepresentationAuthorization,
  type Role,
} from "@suret/shared";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { SignJWT, createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Actor } from "../actor.js";
import { isAdmin } from "../actor.js";
import type { AppConfig } from "../config.js";
import { AppError, forbidden, notFound } from "../errors.js";
import { newId, nowIso } from "../ids.js";
import type { AppRepository } from "../repos/types.js";
import { assertAdmin, assertSelfOrScope } from "./access.js";

const scrypt = promisify(scryptCallback);

export class AccountService {
  private jwks: JWTVerifyGetKey | null = null;

  constructor(
    private readonly repo: AppRepository,
    private readonly config: AppConfig,
  ) {}

  async register(input: unknown): Promise<{ profile: Profile; roles: Role[]; accessToken: string | null; emailConfirmationRequired: boolean }> {
    const body = registerSchema.parse(input);
    if (await this.repo.getProfileByEmail(body.email)) throw new AppError(409, "EMAIL_IN_USE", "An account with that email already exists.");
    const timestamp = nowIso();
    const profile: Profile = {
      id: newId(),
      email: body.email.toLowerCase(),
      displayName: body.displayName,
      bio: "",
      location: null,
      companyName: body.companyName ?? null,
      appearance: blankAppearance(),
      verificationStatus: "unverified",
      emailVerified: true,
      privacy: { discoverable: false, showPreviewToProducers: false, showLegalName: false },
      deletionRequestedAt: null,
      suspendedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const passwordHash = await hashPassword(body.password);
    const useSupabase = !this.config.allowDevAuth;
    if (useSupabase) await this.createSupabaseUser({ id: profile.id, email: profile.email, password: body.password });
    try {
      await this.repo.transaction(async (repo) => {
        await repo.insertProfile(profile, passwordHash);
        await repo.setRoles(profile.id, [body.role]);
        await repo.appendAudit({
          id: newId(),
          actorId: profile.id,
          action: "account_registered",
          entityType: "profile",
          entityId: profile.id,
          payload: { role: body.role },
          createdAt: timestamp,
        });
      });
    } catch (error) {
      if (useSupabase) await this.deleteSupabaseUser(profile.id);
      throw error;
    }
    const accessToken = useSupabase
      ? (await this.supabaseSignIn(profile.email, body.password)).accessToken
      : await this.sign(profile);
    return { profile, roles: [body.role], accessToken, emailConfirmationRequired: false };
  }

  async login(input: unknown): Promise<{ accessToken: string; profile: Profile; roles: Role[] }> {
    const body = loginSchema.parse(input);
    if (!this.config.allowDevAuth) {
      const session = await this.supabaseSignIn(body.email, body.password);
      const profile = await this.repo.getProfile(session.userId);
      if (!profile) throw new AppError(401, "INVALID_LOGIN", "Email or password is incorrect.");
      if (profile.suspendedAt) throw forbidden("This account is suspended.");
      const roles = await this.repo.getRoles(profile.id);
      return { accessToken: session.accessToken, profile, roles };
    }
    const profile = await this.repo.getProfileByEmail(body.email);
    if (!profile) throw new AppError(401, "INVALID_LOGIN", "Email or password is incorrect.");
    const passwordHash = await this.repo.getPasswordHash(profile.id);
    if (!passwordHash || !(await verifyPassword(body.password, passwordHash))) {
      throw new AppError(401, "INVALID_LOGIN", "Email or password is incorrect.");
    }
    if (profile.suspendedAt) throw forbidden("This account is suspended.");
    const roles = await this.repo.getRoles(profile.id);
    return { accessToken: await this.sign(profile), profile, roles };
  }

  async verifyEmail(actor: Actor): Promise<Profile> {
    if (!this.config.allowDevAuth) {
      throw new AppError(400, "EMAIL_PROVIDER_REQUIRED", "Use the verification link sent by the authentication provider.");
    }
    const profile = await this.requireProfile(actor.userId);
    profile.emailVerified = true;
    profile.updatedAt = nowIso();
    await this.repo.updateProfile(profile);
    return profile;
  }

  async updateProfile(actor: Actor, profileId: string, input: unknown): Promise<Profile> {
    await assertSelfOrScope(this.repo, actor, profileId, "edit_profile");
    const patch = profilePatchSchema.parse(input);
    const profile = await this.requireProfile(profileId);
    if (patch.displayName) profile.displayName = patch.displayName;
    if (patch.bio !== undefined) profile.bio = patch.bio;
    if (patch.location !== undefined) profile.location = patch.location;
    if (patch.companyName !== undefined) profile.companyName = patch.companyName;
    if (!profile.appearance) profile.appearance = blankAppearance();
    if (patch.appearance) profile.appearance = patch.appearance;
    if (patch.privacy) profile.privacy = patch.privacy;
    profile.updatedAt = nowIso();
    await this.repo.updateProfile(profile);
    return profile;
  }

  async requestDeletion(actor: Actor): Promise<void> {
    const profile = await this.requireProfile(actor.userId);
    const timestamp = nowIso();
    profile.deletionRequestedAt = timestamp;
    profile.privacy = { ...profile.privacy, discoverable: false };
    profile.updatedAt = timestamp;
    await this.repo.transaction(async (repo) => {
      await repo.updateProfile(profile);
      await repo.insertDeletionRequest({
        id: newId(),
        userId: profile.id,
        status: "requested",
        requestedAt: timestamp,
        completedAt: null,
        note: "Profile hidden from discovery. Signed agreements are retained where a legal record is required and are not rewritten.",
      });
      await repo.appendAudit({
        id: newId(),
        actorId: actor.userId,
        action: "deletion_requested",
        entityType: "profile",
        entityId: profile.id,
        payload: {},
        createdAt: timestamp,
      });
    });
  }

  async createAgency(actor: Actor, input: unknown): Promise<Agency> {
    if (!actor.roles.includes("agency_member") && !isAdmin(actor)) throw forbidden("An agency account is required.");
    const body = agencyCreateSchema.parse(input);
    const agency: Agency = { id: newId(), name: body.name, createdBy: actor.userId, createdAt: nowIso() };
    await this.repo.transaction(async (repo) => {
      await repo.insertAgency(agency);
      await repo.addAgencyMember(agency.id, actor.userId);
    });
    return agency;
  }

  async grantRepresentation(actor: Actor, input: unknown): Promise<RepresentationAuthorization> {
    const body = representationSchema.parse(input);
    if (actor.userId !== body.profileId && !isAdmin(actor)) {
      throw forbidden("Only the person, or an administrator recording their instruction, can grant representation.");
    }
    const agency = await this.repo.getAgency(body.agencyId);
    if (!agency) throw notFound("Agency not found.");
    const record: RepresentationAuthorization = {
      id: newId(),
      agencyId: body.agencyId,
      profileId: body.profileId,
      scopes: body.scopes,
      status: "active",
      evidenceNote: body.evidenceNote,
      grantedBy: actor.userId,
      createdAt: nowIso(),
      revokedAt: null,
    };
    await this.repo.insertRepresentation(record);
    return record;
  }

  async revokeRepresentation(actor: Actor, representationId: string): Promise<RepresentationAuthorization> {
    const record = await this.repo.getRepresentation(representationId);
    if (!record) throw notFound("Representation not found.");
    if (actor.userId !== record.profileId && !isAdmin(actor)) throw forbidden();
    record.status = "revoked";
    record.revokedAt = nowIso();
    await this.repo.updateRepresentation(record);
    return record;
  }

  async setRoles(actor: Actor, userId: string, roles: Role[]): Promise<void> {
    assertAdmin(actor);
    await this.requireProfile(userId);
    await this.repo.setRoles(userId, roles);
  }

  async suspend(actor: Actor, userId: string, suspended: boolean): Promise<Profile> {
    assertAdmin(actor);
    const profile = await this.requireProfile(userId);
    profile.suspendedAt = suspended ? nowIso() : null;
    profile.updatedAt = nowIso();
    await this.repo.updateProfile(profile);
    return profile;
  }

  async setVerification(actor: Actor, userId: string, status: Profile["verificationStatus"]): Promise<Profile> {
    assertAdmin(actor);
    const profile = await this.requireProfile(userId);
    profile.verificationStatus = status;
    profile.updatedAt = nowIso();
    await this.repo.updateProfile(profile);
    return profile;
  }

  async sign(profile: Profile): Promise<string> {
    return new SignJWT({ email: profile.email })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(profile.id)
      .setIssuedAt()
      .setExpirationTime("12h")
      .sign(new TextEncoder().encode(this.config.devJwtSecret));
  }

  async readToken(token: string): Promise<{ userId: string; email: string } | null> {
    try {
      if (!this.config.allowDevAuth) {
        const { payload } = await jwtVerify(token, this.supabaseJwks(), {
          issuer: `${this.authBase()}/auth/v1`,
          audience: "authenticated",
        });
        if (!payload.sub) return null;
        return { userId: payload.sub, email: String(payload.email ?? "") };
      }
      const { payload } = await jwtVerify(token, new TextEncoder().encode(this.config.devJwtSecret));
      if (!payload.sub) return null;
      return { userId: payload.sub, email: String(payload.email ?? "") };
    } catch {
      return null;
    }
  }

  private authBase(): string {
    return this.config.supabaseUrl.replace(/\/$/, "");
  }

  private supabaseJwks(): JWTVerifyGetKey {
    if (!this.jwks) {
      this.jwks = createRemoteJWKSet(new URL(`${this.authBase()}/auth/v1/.well-known/jwks.json`));
    }
    return this.jwks;
  }

  private async supabaseSignIn(email: string, password: string): Promise<{ accessToken: string; userId: string }> {
    const response = await fetch(`${this.authBase()}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: this.config.supabaseAnonKey, "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json().catch(() => ({})) as { access_token?: string; user?: { id?: string } };
    if (!response.ok || !body.access_token || !body.user?.id) {
      throw new AppError(401, "INVALID_LOGIN", "Email or password is incorrect.");
    }
    return { accessToken: body.access_token, userId: body.user.id };
  }

  private async createSupabaseUser(input: { id: string; email: string; password: string }): Promise<void> {
    const response = await fetch(`${this.authBase()}/auth/v1/admin/users`, {
      method: "POST",
      headers: {
        apikey: this.config.supabaseServiceRoleKey,
        authorization: `Bearer ${this.config.supabaseServiceRoleKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ id: input.id, email: input.email, password: input.password, email_confirm: true }),
    });
    if (response.ok) return;
    const body = await response.json().catch(() => ({})) as { msg?: string; message?: string; error_description?: string };
    const message = body.msg || body.message || body.error_description || "";
    if (response.status === 422 || /already|exists/i.test(message)) {
      throw new AppError(409, "EMAIL_IN_USE", "An account with that email already exists.");
    }
    throw new AppError(502, "AUTH_PROVIDER", "The authentication provider could not create the account.");
  }

  private async deleteSupabaseUser(id: string): Promise<void> {
    await fetch(`${this.authBase()}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: {
        apikey: this.config.supabaseServiceRoleKey,
        authorization: `Bearer ${this.config.supabaseServiceRoleKey}`,
      },
    }).catch(() => undefined);
  }

  private async requireProfile(id: string): Promise<Profile> {
    const profile = await this.repo.getProfile(id);
    if (!profile) throw notFound("Profile not found.");
    return profile;
  }
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(password, salt, 32)) as Buffer;
  return `scrypt$${salt}$${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, hex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !hex) return false;
  const hash = (await scrypt(password, salt, 32)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  if (hash.length !== expected.length) return false;
  return timingSafeEqual(hash, expected);
}
