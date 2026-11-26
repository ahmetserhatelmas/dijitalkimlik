# API

Base path: `/api/v1`. Successful responses use `{ "data": ... }`. Failures use `{ "error": { "code", "message", "details" } }`.

Send `Authorization: Bearer <token>` except for health, registration, login, marketplace reads, verification, and payment webhooks.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Integration mode, with no secrets |
| POST | `/auth/register`, `/auth/login`, `/auth/verify-email` | Account workflow |
| GET | `/me` | Current profile and roles |
| PATCH | `/profiles/:id` | Profile and privacy |
| POST | `/me/deletion-request` | Deletion request |
| GET | `/marketplace/faces` | Public cards without file paths |
| POST | `/assets` | Multipart upload |
| POST | `/assets/:id/attestation` | Authority attestation |
| POST | `/assets/:id/signed-url` | Short-lived URL after authorization |
| POST | `/profiles/:id/rule-sets` | Create rules |
| PATCH | `/rule-sets/:id` | New version |
| POST | `/projects` | Producer project |
| POST | `/license-requests/preview` | Compatibility check |
| POST | `/license-requests` | Create or block a request |
| POST | `/license-requests/:id/decision` | Owner approval |
| POST | `/agreements/:id/consent` | Consent for the current hash |
| POST | `/agreements/:id/sign` | Development signature |
| POST | `/agreements/:id/payments` | Start payment. `Idempotency-Key` supported |
| POST | `/payments/webhooks/sandbox` | Signed webhook |
| POST | `/payments/webhooks/iyzico` | Token retrieval |
| POST | `/payments/:id/sandbox/simulate` | Sandbox only |
| POST | `/licenses/:licenseId/blockchain` | Authorized recording |
| POST | `/licenses/:licenseId/usage-checks` | Project and scope check |
| GET | `/verification/:licenseId?agreementHash=` | Hash comparison |
| POST | `/misuse-reports` | Report |
| GET | `/misuse-reports/:id/export` | Evidence bundle |
| POST | `/agencies`, `/representations` | Agency and scoped authority |
| GET | `/admin/audit-logs` | Administrator audit |

A blocked request returns HTTP 422 `PROHIBITED_USE` and does not create an agreement. A chain failure returns HTTP 502 `RECORDING_FAILED` after the license is marked `recording_failed`.

The OpenAPI sketch is `docs/openapi.yaml`.
