import { createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { AppError } from "../errors.js";
import type { StorageProvider } from "./types.js";

function safeJoin(root: string, key: string): string {
  if (!key || key.includes("..") || path.isAbsolute(key)) throw new AppError(400, "INVALID_PATH", "Invalid storage path.");
  const resolved = path.resolve(root, key);
  const base = path.resolve(root);
  if (!resolved.startsWith(`${base}${path.sep}`)) throw new AppError(400, "INVALID_PATH", "Invalid storage path.");
  return resolved;
}

export class MemoryStorageService implements StorageProvider {
  readonly name = "memory" as const;
  private readonly types = new Map<string, string>();

  constructor(
    private readonly root: string,
    private readonly apiPublicUrl: string,
    private readonly secret: string,
  ) {
    mkdirSync(root, { recursive: true });
  }

  async uploadFile(input: { path: string; body: Uint8Array; contentType: string }) {
    const full = safeJoin(this.root, input.path);
    if (this.exists(full)) throw new AppError(409, "FILE_EXISTS", "A file already exists at that path.");
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, input.body);
    this.types.set(input.path, input.contentType);
    return { path: input.path, size: input.body.byteLength, contentType: input.contentType };
  }

  async deleteFile(key: string) {
    const full = safeJoin(this.root, key);
    if (this.exists(full)) rmSync(full);
    this.types.delete(key);
  }

  async getSignedUrl(input: { path: string; expiresInSeconds: number }) {
    const exp = Date.now() + input.expiresInSeconds * 1000;
    const payload = Buffer.from(JSON.stringify({ path: input.path, exp })).toString("base64url");
    const sig = createHmac("sha256", this.secret).update(payload).digest("base64url");
    return `${this.apiPublicUrl}/api/v1/media/${payload}.${sig}`;
  }

  async getFileMetadata(key: string) {
    const full = safeJoin(this.root, key);
    if (!this.exists(full)) return null;
    return { size: statSync(full).size, contentType: this.types.get(key) ?? "application/octet-stream" };
  }

  async checkFileExists(key: string) {
    return this.exists(safeJoin(this.root, key));
  }

  async readFile(key: string) {
    const full = safeJoin(this.root, key);
    if (!this.exists(full)) return null;
    return { body: new Uint8Array(readFileSync(full)), contentType: this.types.get(key) ?? "application/octet-stream" };
  }

  resolveToken(token: string): { path: string } {
    const separator = token.lastIndexOf(".");
    if (separator <= 0) throw new AppError(401, "INVALID_MEDIA_TOKEN", "The media link is invalid.");
    const payload = token.slice(0, separator);
    const sig = token.slice(separator + 1);
    const expected = createHmac("sha256", this.secret).update(payload).digest("base64url");
    const left = Buffer.from(sig);
    const right = Buffer.from(expected);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      throw new AppError(401, "INVALID_MEDIA_TOKEN", "The media link is invalid.");
    }
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { path?: string; exp?: number };
    if (!parsed.path || !parsed.exp || parsed.exp < Date.now()) {
      throw new AppError(401, "MEDIA_TOKEN_EXPIRED", "The media link has expired.");
    }
    return { path: parsed.path };
  }

  private exists(full: string): boolean {
    try {
      return statSync(full).isFile();
    } catch {
      return false;
    }
  }
}
