# Security and privacy

- Passwords for development auth are hashed with scrypt. They are not returned by the API. Production should use Supabase Auth and keep `ALLOW_DEV_AUTH` off.
- The service-role key, payment secret, webhook secret, and blockchain signer key are read only by the API process.
- The website session cookie is httpOnly. The mobile app stores its bearer token in the platform secure store.
- Uploads are limited to 10 MB by default, sniffed as PNG, JPEG, or WebP, and rejected when the declared type does not match the bytes. SVG is not accepted.
- Signed media URLs expire in 120 seconds. The asset service checks the caller before creating one and writes an access log.
- Storage paths cannot contain `..`. Uploads do not overwrite an existing object.
- Payment webhooks require an HMAC and a fresh timestamp. Event ids are stored. A repeated event does not apply twice. The amount must match the agreement.
- Sandbox payments are refused in production unless `ALLOW_SANDBOX_IN_PRODUCTION=true`.
- Rate limiting is enabled on the API. Errors returned to clients do not include stack traces.
- Audit entries hash the previous entry. Reports can export the agreement, snapshot, consents, signatures, chain reference, access log, and evidence hashes.
- Administrators can suspend users and authorize assets. They cannot record consent for a party they are not, and they cannot edit another person's rules.
- An agency can act only inside granted scopes. Signing and approval stay with the face owner.
- Account deletion hides the profile and keeps the signed agreement. The agreement text is immutable, so deletion does not rewrite it.
- Facial recognition is hard-disabled. A file hash is not treated as identity or ownership.
- Personal data, photographs, signatures, and agreement text are not written on chain.
- Row-level security is defined for direct Supabase access. The API uses a privileged database role and repeats authorization in services because that role bypasses the policies.

Identity verification, consent wording, electronic signatures, biometric processing, and international transfers need qualified legal review, including under Turkish KVKK, before a production launch.
