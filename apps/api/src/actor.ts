import type { Profile, Role } from "@suret/shared";

export type Actor = {
  userId: string;
  email: string;
  roles: Role[];
  profile: Profile;
};

export function isAdmin(actor: Actor): boolean {
  return actor.roles.includes("admin");
}
