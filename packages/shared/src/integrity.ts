import { hmac } from "@noble/hashes/hmac";
import { sha256 } from "@noble/hashes/sha256";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils";

export function sha256Hex(data: Uint8Array | string): string {
  const bytes = typeof data === "string" ? utf8ToBytes(data) : data;
  return bytesToHex(sha256(bytes));
}

export function sha256Bytes32(data: string): string {
  return `0x${sha256Hex(data)}`;
}

export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      sorted[key] = sortValue(source[key]);
    }
    return sorted;
  }
  return value;
}

export function hashCanonical(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

export function safeEqual(left: string, right: string): boolean {
  const a = utf8ToBytes(left);
  const b = utf8ToBytes(right);
  const length = Math.max(a.length, b.length);
  let mismatch = a.length === b.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) {
    mismatch |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return mismatch === 0;
}

export function signPayload(secret: string, timestamp: string, rawBody: string): string {
  return bytesToHex(hmac(sha256, utf8ToBytes(secret), utf8ToBytes(`${timestamp}.${rawBody}`)));
}

export function verifySignedPayload(input: {
  secret: string;
  timestamp: string;
  rawBody: string;
  signature: string;
  nowMs?: number;
  toleranceSeconds?: number;
}): { ok: true } | { ok: false; reason: string } {
  const tolerance = (input.toleranceSeconds ?? 300) * 1000;
  const stamped = Number(input.timestamp);
  if (!Number.isFinite(stamped)) return { ok: false, reason: "Invalid timestamp" };
  const now = input.nowMs ?? Date.now();
  if (Math.abs(now - stamped) > tolerance) return { ok: false, reason: "Timestamp outside the allowed window" };
  const expected = signPayload(input.secret, input.timestamp, input.rawBody);
  if (!safeEqual(expected, input.signature)) return { ok: false, reason: "Signature mismatch" };
  return { ok: true };
}

export function averageHash(gray: Uint8Array, width: number, height: number): string {
  if (width < 1 || height < 1 || gray.length < width * height) {
    throw new Error("Invalid grayscale buffer");
  }
  const samples: number[] = [];
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const sx = Math.min(width - 1, Math.floor(((x + 0.5) * width) / 8));
      const sy = Math.min(height - 1, Math.floor(((y + 0.5) * height) / 8));
      samples.push(gray[sy * width + sx] ?? 0);
    }
  }
  const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
  let bits = "";
  for (const sample of samples) bits += sample >= average ? "1" : "0";
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += Number.parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

export function hammingDistance(left: string, right: string): number {
  if (left.length !== right.length) return Number.POSITIVE_INFINITY;
  let distance = 0;
  for (let i = 0; i < left.length; i += 1) {
    let nibble = Number.parseInt(left[i] ?? "0", 16) ^ Number.parseInt(right[i] ?? "0", 16);
    while (nibble > 0) {
      distance += nibble & 1;
      nibble >>= 1;
    }
  }
  return distance;
}

export const SIMILAR_HASH_THRESHOLD = 10;

export type HashComparison = {
  exact: { assetId: string } | null;
  similar: { assetId: string; distance: number }[];
};

export function compareHashes(
  candidate: { sha256: string; perceptualHash: string | null },
  existing: { assetId: string; sha256: string; perceptualHash: string | null }[],
): HashComparison {
  const exact = existing.find((item) => item.sha256 === candidate.sha256);
  const similar =
    candidate.perceptualHash === null
      ? []
      : existing
          .filter((item) => item.perceptualHash && item.sha256 !== candidate.sha256)
          .map((item) => ({
            assetId: item.assetId,
            distance: hammingDistance(candidate.perceptualHash as string, item.perceptualHash as string),
          }))
          .filter((item) => item.distance <= SIMILAR_HASH_THRESHOLD)
          .sort((a, b) => a.distance - b.distance);
  return { exact: exact ? { assetId: exact.assetId } : null, similar };
}

export function detectImageType(data: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (data.length >= 8 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) {
    return "image/png";
  }
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (
    data.length >= 12 &&
    data[0] === 0x52 &&
    data[1] === 0x49 &&
    data[2] === 0x46 &&
    data[3] === 0x46 &&
    data[8] === 0x57 &&
    data[9] === 0x45 &&
    data[10] === 0x42 &&
    data[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function nextAuditHash(prevHash: string, payload: unknown): string {
  return sha256Hex(`${prevHash}|${canonicalJson(payload)}`);
}

export const AUDIT_GENESIS = "suret-audit-genesis-v1";

export function hashesMatch(document: unknown, expectedHash: string): boolean {
  return safeEqual(hashCanonical(document), expectedHash);
}
