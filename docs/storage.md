# Storage

The API depends on `StorageProvider`:

- `uploadFile`
- `deleteFile`
- `getSignedUrl`
- `getFileMetadata`
- `checkFileExists`
- `readFile` for the local provider and for evidence handling

`SupabaseStorageService` chooses a private bucket from the path prefix: `originals/`, `previews/`, or `evidence/`. Uploads use `upsert: false`. The asset service checks authorization before asking for a signed URL.

`MemoryStorageService` is only for local development. Its signed URL is an HMAC that expires and is checked again when the bytes are served.

PostgreSQL stores the path, hash, owner, and metadata. It does not store the image bytes. That split is what lets a later provider replace Supabase without changing licensing rules.

## Adding Cloudflare R2 later

R2 is not part of this demo and no R2 credentials are required.

1. Add a `R2StorageService` that implements the same interface with an S3-compatible client pointed at the R2 endpoint.
2. Keep the same object keys (`originals/{profileId}/{assetId}` and `evidence/{reportId}/{evidenceId}`).
3. Select it with `STORAGE_PROVIDER=r2` beside the existing `memory` and `supabase` options.
4. Continue issuing short-lived signed URLs from the API after the same authorization check.
5. Leave the database columns unchanged, because they already store a provider-neutral path.

Do not rewrite agreements or asset ids during that migration. Copy objects, verify hashes, then switch the provider.
