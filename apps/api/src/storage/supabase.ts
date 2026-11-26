import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "../errors.js";
import type { StorageProvider } from "./types.js";

export class SupabaseStorageService implements StorageProvider {
  readonly name = "supabase" as const;
  private readonly client: SupabaseClient;

  constructor(
    url: string,
    serviceRoleKey: string,
    private readonly buckets: { originals: string; previews: string; evidence: string },
  ) {
    this.client = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
  }

  async uploadFile(input: { path: string; body: Uint8Array; contentType: string }) {
    const bucket = this.bucketFor(input.path);
    const { error } = await this.client.storage.from(bucket).upload(input.path, input.body, {
      contentType: input.contentType,
      upsert: false,
    });
    if (error) throw new AppError(502, "STORAGE_UPLOAD_FAILED", error.message);
    return { path: input.path, size: input.body.byteLength, contentType: input.contentType };
  }

  async deleteFile(key: string) {
    const { error } = await this.client.storage.from(this.bucketFor(key)).remove([key]);
    if (error) throw new AppError(502, "STORAGE_DELETE_FAILED", error.message);
  }

  async getSignedUrl(input: { path: string; expiresInSeconds: number }) {
    const { data, error } = await this.client.storage.from(this.bucketFor(input.path)).createSignedUrl(input.path, input.expiresInSeconds);
    if (error || !data?.signedUrl) throw new AppError(502, "STORAGE_URL_FAILED", error?.message ?? "No signed URL returned.");
    return data.signedUrl;
  }

  async getFileMetadata(key: string) {
    const folder = key.includes("/") ? key.slice(0, key.lastIndexOf("/")) : "";
    const name = key.slice(folder.length + (folder ? 1 : 0));
    const { data, error } = await this.client.storage.from(this.bucketFor(key)).list(folder, { search: name, limit: 20 });
    if (error) throw new AppError(502, "STORAGE_METADATA_FAILED", error.message);
    const match = data?.find((item) => item.name === name);
    if (!match) return null;
    return { size: match.metadata?.size ?? 0, contentType: match.metadata?.mimetype ?? "application/octet-stream" };
  }

  async checkFileExists(key: string) {
    return (await this.getFileMetadata(key)) !== null;
  }

  async readFile(key: string) {
    const { data, error } = await this.client.storage.from(this.bucketFor(key)).download(key);
    if (error || !data) return null;
    return { body: new Uint8Array(await data.arrayBuffer()), contentType: data.type || "application/octet-stream" };
  }

  private bucketFor(key: string): string {
    if (key.startsWith("previews/")) return this.buckets.previews;
    if (key.startsWith("evidence/")) return this.buckets.evidence;
    return this.buckets.originals;
  }
}
