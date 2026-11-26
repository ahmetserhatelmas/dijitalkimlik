# Architecture

Both clients call the Express API. Licensing decisions are made there, using the shared package, and again by database constraints.

```
apps/web ── httpOnly cookie ──┐
                              ├── apps/api ── PostgreSQL or local memory
apps/mobile ── bearer token ──┘            ├── StorageProvider
                                           ├── PaymentProvider
                                           └── ChainClient
```

`packages/shared` owns the rule schema, request validation, price quote, agreement text, document hash, license transitions, and activation checks. The API cannot mark a license active while consent, the matching signature, a required payment, or a required chain confirmation is missing.

## Rules and agreements

A person can keep a general rule set and an asset-specific rule set. A request uses the asset-specific published version when one exists. The request stores a snapshot. The agreement document is hashed with canonical JSON. Database triggers reject updates to snapshots, consents, signatures, rule versions, and agreement content. Status changes are allowed. Editing preferences inserts a new rule version and leaves the snapshot alone.

A license stores one project ID and one asset ID. Coverage checks use those identifiers. The project name is ignored. AI permissions are individual booleans, so a photo license does not include training, voice, motion, or a digital character.

## Lifecycle

`draft → pending_consent → approved → signed → payment_pending → recording → active`

Payment success moves a ready agreement to `recording`. It does not activate it. Chain success moves `recording` to `active`. Chain failure moves it to `recording_failed` and can be retried. A failed transaction is not stored as confirmed.

## Storage

Business code depends on `StorageProvider`: `uploadFile`, `deleteFile`, `getSignedUrl`, `getFileMetadata`, `checkFileExists`. `SupabaseStorageService` is the hosted provider. `MemoryStorageService` is the local demo and writes under `data/storage`. See `docs/storage.md` for a later Cloudflare R2 provider. R2 is not implemented.

## Blockchain

`LicenseRegistry` stores the license id, agreement hash, rule-snapshot hash, and privacy-preserving asset and project references. The license id on chain is the SHA-256 of the license UUID. The contract is not a proxy. The owner can pause it, rotate the recorder, and publish a successor address. Old records stay on the contract that recorded them. Verification in the app compares the visitor's hash with the stored agreement and, when a chain is configured, with the contract. The page also shows the platform status so a hash match is not presented as an active right.

## Local data

Without `DATABASE_URL`, `MemoryRepository` implements the same repository port and can persist to `data/dev-store.json`. Tests use a fresh memory repository. `docs/setup.md` explains the Postgres path. A PGlite test applies the migration, checks that rule versions cannot be updated, and checks that row-level security hides another person's asset.
