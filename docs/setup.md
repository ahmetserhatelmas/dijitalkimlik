# Setup

Copy `.env.example` to `.env` in the repository root. The API reads that file when it starts from `apps/api`.

## Local demo without Supabase

```
ALLOW_DEV_AUTH=true
SEED_DEMO_DATA=true
DEV_LOGIN_PASSWORD=dev-only-password
STORAGE_PROVIDER=memory
PAYMENT_PROVIDER=sandbox
```

Seeded accounts:

| Email | Role |
| --- | --- |
| elif@suret.dev | Face owner, with advertising-only rules |
| northstar@suret.dev | Producer, with two projects |
| agency@suret.dev | Casting agency |
| admin@suret.dev | Administrator |

`ALLOW_DEV_AUTH` is refused when `NODE_ENV=production`.

Start the API on port 4000 and the website on port 3000. The website proxies `/api/backend/*` to the API and keeps the session in an httpOnly cookie.

The mobile app reads `EXPO_PUBLIC_API_URL`. A simulator on the same machine can use `http://localhost:4000`. An Android emulator often needs `http://10.0.2.2:4000`.

## Supabase

1. Create a project.
2. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and the backend-only `SUPABASE_SERVICE_ROLE_KEY`.
3. Set `DATABASE_URL` to the Postgres connection string and `SUPABASE_JWT_SECRET` if the project still uses the shared JWT secret.
4. Apply `supabase/migrations/20261010000000_init.sql`.
5. Apply `supabase/migrations/20261010000001_storage.sql` after the storage schema exists.
6. Create private buckets `face-originals`, `face-previews`, and `evidence` if the storage migration did not.
7. Set `STORAGE_PROVIDER=supabase`.
8. Turn off `ALLOW_DEV_AUTH` and point Auth at Supabase. The API verifies Supabase access tokens when dev auth is disabled. Email verification then uses Supabase's message, not the development button.

The service role bypasses row-level security. The API still checks the caller's role and resource on every sensitive route. The policies protect direct database access with the anon or authenticated key.

## Blockchain

```bash
npx pnpm@10.15.1 --filter @suret/contracts chain
npx pnpm@10.15.1 --filter @suret/contracts deploy:local
```

`deploy:local` deploys `LicenseRegistry` and sets the first Hardhat account as the recorder. That account's private key is printed by the local node. It is a public development key with funds only on that local chain. Do not reuse it anywhere else.

Then set:

```
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_CHAIN_ID=31337
BLOCKCHAIN_CONTRACT_ADDRESS=0x...
BLOCKCHAIN_SIGNER_PRIVATE_KEY=0x...
```

The signer key stays on the API. Users do not connect a wallet.

Base Sepolia and Polygon Amoy are listed in `contracts/hardhat.config.ts` for a later testnet. They need a funded deployer key and an RPC URL. They are not deployed by this repository.

## Payments

`PAYMENT_PROVIDER=sandbox` signs a webhook with `PAYMENT_WEBHOOK_SECRET`. The sandbox simulate route builds that signature on the server.

For iyzico, set `PAYMENT_PROVIDER=iyzico`, `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, and `IYZICO_CALLBACK_URL`. The callback retrieves the payment from iyzico. It does not trust a browser success page. This code has not been run against an iyzico merchant account in this workspace.
