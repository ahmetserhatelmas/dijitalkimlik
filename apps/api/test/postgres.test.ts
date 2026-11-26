import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import type { Database } from "../src/repos/database.js";
import { PostgresRepository } from "../src/repos/postgres.js";

const migrationPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../supabase/migrations/20261010000000_init.sql");

describe("postgres schema", () => {
  it("applies the migration, enforces snapshot immutability, and hides another user's assets with row level security", async () => {
    const db = new PGlite();
    await db.exec(readFileSync(migrationPath, "utf8"));
    const migrationsDir = path.resolve(path.dirname(migrationPath));
    await db.exec(readFileSync(path.join(migrationsDir, "20261016000000_asset_subject.sql"), "utf8"));
    await db.exec(readFileSync(path.join(migrationsDir, "20261016010000_asset_listed.sql"), "utf8"));
    await db.exec(readFileSync(path.join(migrationsDir, "20261126000000_profile_appearance.sql"), "utf8"));
    await db.exec(readFileSync(path.join(migrationsDir, "20261126010000_profile_place.sql"), "utf8"));
    const repository = new PostgresRepository(wrap(db));
    const ownerId = crypto.randomUUID();
    const otherId = crypto.randomUUID();
    const now = new Date().toISOString();
    const profile = {
      id: ownerId,
      email: "owner@example.com",
      displayName: "Owner",
      bio: "",
      location: null,
      place: { country: null, province: null },
      companyName: null,
      appearance: { gender: null, ageRange: null, heightRange: null, hairColor: null, eyeColor: null },
      verificationStatus: "verified" as const,
      emailVerified: true,
      privacy: { discoverable: false, showPreviewToProducers: false, showLegalName: false },
      deletionRequestedAt: null,
      suspendedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await repository.insertProfile(profile, null);
    await repository.insertProfile({ ...profile, id: otherId, email: "other@example.com" }, null);
    const assetId = crypto.randomUUID();
    await repository.insertAsset({
      id: assetId,
      profileId: ownerId,
      uploaderId: ownerId,
      storagePath: `originals/${ownerId}/${assetId}`,
      previewPath: null,
      fileType: "image/png",
      fileSize: 12,
      sha256: "a".repeat(64),
      perceptualHash: null,
      duplicateFlags: [],
      authorizationEvidenceId: null,
      subject: "face",
      caption: "",
      moderationStatus: "pending_review",
      removalStatus: "active",
      listed: true,
      createdAt: now,
      updatedAt: now,
    });

    await expect(db.exec("update licensing_rule_versions set rules = '{}'::jsonb")).resolves.toBeDefined();
    await expect(async () => {
      await db.query(`
        insert into licensing_rule_sets (id, profile_id, name, status, current_version_number, created_at, updated_at)
        values ('${crypto.randomUUID()}', '${ownerId}', 'Rules', 'draft', 0, now(), now())
      `);
    }).not.toThrow();

    const ruleSetId = crypto.randomUUID();
    const versionId = crypto.randomUUID();
    await db.query(
      `insert into licensing_rule_sets (id, profile_id, name, status, current_version_number, created_at, updated_at)
       values ($1, $2, 'Rules', 'draft', 0, now(), now())`,
      [ruleSetId, ownerId],
    );
    await db.query(
      `insert into licensing_rule_versions (id, rule_set_id, version_number, rules, status, created_by, created_at)
       values ($1, $2, 1, '{"ok":true}'::jsonb, 'published', $3, now())`,
      [versionId, ruleSetId, ownerId],
    );
    await expect(db.query("update licensing_rule_versions set status = 'archived' where id = $1", [versionId])).rejects.toThrow(/immutable/i);

    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [otherId]);
    await db.query("set role authenticated");
    const hidden = await db.query("select id from face_assets");
    expect(hidden.rows).toHaveLength(0);
    await db.query("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [ownerId]);
    await db.query("set role authenticated");
    const visible = await db.query<{ id: string }>("select id from face_assets");
    expect(visible.rows.map((row) => row.id)).toContain(assetId);
  });
});

function wrap(client: PGlite): Database {
  const database = {
    async query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }> {
      const result = await client.query(sql, params);
      return { rows: result.rows as T[] };
    },
    async transaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
      return client.transaction(async (tx) => {
        const nested: Database = {
          async query<R = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: R[] }> {
            const result = await tx.query(sql, params);
            return { rows: result.rows as R[] };
          },
          transaction: (inner) => inner(nested),
        };
        return fn(nested);
      });
    },
  };
  return database;
}
