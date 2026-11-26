import type { RepresentationScope } from "@suret/shared";
import type { Actor } from "../actor.js";
import { isAdmin } from "../actor.js";
import { forbidden } from "../errors.js";
import type { AppRepository } from "../repos/types.js";

export async function assertSelfOrScope(
  repo: AppRepository,
  actor: Actor,
  profileId: string,
  scope: RepresentationScope,
): Promise<void> {
  if (actor.userId === profileId) return;
  const allowed = await hasScope(repo, actor, profileId, scope);
  if (!allowed) throw forbidden();
}

export async function hasScope(
  repo: AppRepository,
  actor: Actor,
  profileId: string,
  scope: RepresentationScope,
): Promise<boolean> {
  if (actor.userId === profileId) return true;
  const agencyIds = await repo.agencyIdsForUser(actor.userId);
  if (agencyIds.length === 0) return false;
  const representations = await repo.listRepresentations({ profileId, status: "active" });
  return representations.some((item) => agencyIds.includes(item.agencyId) && item.scopes.includes(scope));
}

export function assertAdmin(actor: Actor): void {
  if (!isAdmin(actor)) throw forbidden("Administrator access is required.");
}

export async function assertCanEditRules(repo: AppRepository, actor: Actor, profileId: string): Promise<void> {
  if (isAdmin(actor) && actor.userId !== profileId) {
    throw forbidden("Administrators cannot change another person's licensing rules.");
  }
  await assertSelfOrScope(repo, actor, profileId, "edit_rules");
}
