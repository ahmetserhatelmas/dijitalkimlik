import { assertPublishable, ruleSetCreateSchema, ruleSetUpdateSchema, type RuleSet, type RuleVersion } from "@suret/shared";
import type { Actor } from "../actor.js";
import { AppError, notFound } from "../errors.js";
import { newId, nowIso } from "../ids.js";
import type { AppRepository } from "../repos/types.js";
import { assertCanEditRules, hasScope } from "./access.js";

export class RuleService {
  constructor(private readonly repo: AppRepository) {}

  async create(actor: Actor, profileId: string, input: unknown): Promise<{ ruleSet: RuleSet; version: RuleVersion }> {
    await assertCanEditRules(this.repo, actor, profileId);
    const body = ruleSetCreateSchema.parse(input);
    if (body.assetId) {
      const asset = await this.repo.getAsset(body.assetId);
      if (!asset || asset.profileId !== profileId) throw notFound("Asset not found for this profile.");
    }
    if (body.publish) {
      const problems = assertPublishable(body.rules);
      if (problems.length) throw new AppError(422, "RULES_NOT_PUBLISHABLE", "These rules are not ready to publish.", problems);
    }
    const timestamp = nowIso();
    const ruleSet: RuleSet = {
      id: newId(),
      profileId,
      assetId: body.assetId ?? null,
      name: body.name,
      status: body.publish ? "published" : "draft",
      currentVersionId: null,
      currentVersionNumber: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    const version: RuleVersion = {
      id: newId(),
      ruleSetId: ruleSet.id,
      versionNumber: 1,
      rules: body.rules,
      status: ruleSet.status,
      createdBy: actor.userId,
      createdAt: timestamp,
    };
    ruleSet.currentVersionId = version.id;
    ruleSet.currentVersionNumber = 1;
    await this.repo.transaction(async (repo) => {
      const draft = { ...ruleSet, currentVersionId: null, currentVersionNumber: 0 };
      await repo.insertRuleSet(draft);
      await repo.insertRuleVersion(version);
      await repo.updateRuleSet(ruleSet);
      await repo.appendAudit({
        id: newId(),
        actorId: actor.userId,
        action: "rule_set_created",
        entityType: "licensing_rule_set",
        entityId: ruleSet.id,
        payload: { version: 1, status: ruleSet.status },
        createdAt: timestamp,
      });
    });
    return { ruleSet, version };
  }

  async update(actor: Actor, ruleSetId: string, input: unknown): Promise<{ ruleSet: RuleSet; version: RuleVersion }> {
    const existing = await this.repo.getRuleSet(ruleSetId);
    if (!existing) throw notFound("Rule set not found.");
    await assertCanEditRules(this.repo, actor, existing.profileId);
    const body = ruleSetUpdateSchema.parse(input);
    const publish = body.publish ?? existing.status === "published";
    if (publish) {
      const problems = assertPublishable(body.rules);
      if (problems.length) throw new AppError(422, "RULES_NOT_PUBLISHABLE", "These rules are not ready to publish.", problems);
    }
    const timestamp = nowIso();
    const version: RuleVersion = {
      id: newId(),
      ruleSetId: existing.id,
      versionNumber: existing.currentVersionNumber + 1,
      rules: body.rules,
      status: publish ? "published" : "draft",
      createdBy: actor.userId,
      createdAt: timestamp,
    };
    existing.name = body.name ?? existing.name;
    existing.status = version.status;
    existing.currentVersionId = version.id;
    existing.currentVersionNumber = version.versionNumber;
    existing.updatedAt = timestamp;
    await this.repo.transaction(async (repo) => {
      await repo.insertRuleVersion(version);
      await repo.updateRuleSet(existing);
      await repo.appendAudit({
        id: newId(),
        actorId: actor.userId,
        action: "rule_set_versioned",
        entityType: "licensing_rule_set",
        entityId: existing.id,
        payload: { version: version.versionNumber, status: version.status },
        createdAt: timestamp,
      });
    });
    return { ruleSet: existing, version };
  }

  async list(actor: Actor, profileId: string): Promise<Array<{ ruleSet: RuleSet; version: RuleVersion | null }>> {
    const visible = actor.userId === profileId || (await hasScope(this.repo, actor, profileId, "edit_rules")) || (await hasScope(this.repo, actor, profileId, "review_requests"));
    if (!visible) throw new AppError(403, "FORBIDDEN", "You do not have access to these rules.");
    const sets = await this.repo.listRuleSets(profileId);
    const result = [];
    for (const ruleSet of sets) {
      const version = ruleSet.currentVersionId ? await this.repo.getRuleVersion(ruleSet.currentVersionId) : null;
      result.push({ ruleSet, version });
    }
    return result;
  }

  async versions(actor: Actor, ruleSetId: string): Promise<RuleVersion[]> {
    const ruleSet = await this.repo.getRuleSet(ruleSetId);
    if (!ruleSet) throw notFound("Rule set not found.");
    const visible = actor.userId === ruleSet.profileId || (await hasScope(this.repo, actor, ruleSet.profileId, "edit_rules"));
    if (!visible) throw new AppError(403, "FORBIDDEN", "You do not have access to these rules.");
    return this.repo.listRuleVersions(ruleSetId);
  }
}
