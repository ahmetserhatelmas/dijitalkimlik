# Suret

Suret is a likeness-licensing platform. A person defines the uses they permit and the uses they prohibit. A producer can request those rights for one project. The accepted agreement is snapshotted, paid through a conventional card flow, and can be hash-checked against a blockchain record.

The repository is a pnpm workspace:

- `apps/web` — Next.js App Router site
- `apps/mobile` — Expo app for iOS and Android, focused on the face owner
- `apps/api` — Express API used by both clients
- `packages/shared` — rules, agreement hashing, and validation
- `contracts` — Solidity registry and Hardhat tests
- `supabase/migrations` — PostgreSQL schema, constraints, and row-level security

## What is real in this demo

- Custom permitted and prohibited uses, with independent AI permissions
- Server-side rejection of requests that violate those rules
- Project-specific licenses. A new project, including one with the same name, is not covered
- Immutable rule snapshots and agreement documents
- Consent plus a clearly labeled development signature
- Sandbox card payments confirmed only by a signed webhook
- Private file storage behind an authorization check and a short-lived URL
- Exact SHA-256 and perceptual-hash duplicate flags
- Misuse reports, evidence hashes, and a hash-chained audit log
- A Solidity registry that stores hashes, not personal data

## What is not claimed

Blockchain recording does not stop copying, prove identity, or detect outside misuse. A matching hash means the presented agreement text is the text that was recorded. Current license status lives in the application database.

The typed-name signature is a development implementation, not a qualified electronic signature. Sandbox payment is not a charge to a card network. iyzico runs only when merchant credentials are present, and it has not been certified against a live account here. Facial recognition is disabled.

Without `DATABASE_URL`, the API uses a file-backed memory store for local development. The SQL migrations are the schema to apply on Supabase.

## Run it

```bash
cp .env.example .env
npx pnpm@10.15.1 install
npx pnpm@10.15.1 --filter @suret/api dev
npx pnpm@10.15.1 --filter @suret/web dev
npx pnpm@10.15.1 --filter @suret/mobile dev
```

Set `SEED_DEMO_DATA=true` for the local accounts described in `docs/setup.md`.

## Tests

```bash
npx pnpm@10.15.1 --filter @suret/shared test
npx pnpm@10.15.1 --filter @suret/api test
npx pnpm@10.15.1 --filter @suret/contracts test
```

See `docs/setup.md`, `docs/architecture.md`, `docs/security.md`, `docs/api.md`, and `docs/deployment.md`.
