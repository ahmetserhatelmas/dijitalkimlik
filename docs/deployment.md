# Deployment

## API

Run `apps/api` with `NODE_ENV=production`, `ALLOW_DEV_AUTH=false`, Supabase `DATABASE_URL`, Supabase Storage, and either iyzico or an explicitly allowed sandbox. Put the process behind TLS. Do not ship the service-role key, webhook secret, or signer key to the web or mobile bundles.

Apply the SQL migrations before serving traffic. Create the three private storage buckets.

## Web

Set `API_PUBLIC_URL` to the internal API origin. Build with `pnpm --filter @suret/web build`. The site should not call Supabase with the service-role key.

## Mobile

Build with EAS or the native Expo toolchain. Set `EXPO_PUBLIC_API_URL` to the public API origin. Camera and photo permissions are declared in `apps/mobile/app.json`.

## Chain

For a public test, deploy `LicenseRegistry` to Base Sepolia or Polygon Amoy with Hardhat and the network entries in `contracts/hardhat.config.ts`. Fund only the backend signer. Record the contract address in the API environment. Production should use a reviewed deployment, monitoring, and a documented successor if the contract is replaced. The demo contract is not an upgradeable proxy. Records on a replaced contract remain readable there.

Confirm a transaction receipt with status 1 before marking a license active. If the receipt fails, leave the license at `recording_failed` and retry.

## Payments

Point the iyzico callback at `POST /api/v1/payments/webhooks/iyzico`. The handler loads the payment from iyzico with the callback token. Store no card numbers.
