import { averageHash } from "@suret/shared";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

export function checkerPng(size: number, shift = 0): Buffer {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const cell = (Math.floor(x / (size / 8)) + Math.floor(y / (size / 8)) + shift) % 2 === 0;
      const index = (y * size + x) * 4;
      const value = cell ? 235 : 25;
      png.data[index] = value;
      png.data[index + 1] = value;
      png.data[index + 2] = value;
      png.data[index + 3] = 255;
    }
  }
  return PNG.sync.write(png);
}

export function perceptualHashFor(bytes: Uint8Array, mime: string): string | null {
  try {
    if (mime === "image/png") {
      const png = PNG.sync.read(Buffer.from(bytes));
      return averageHash(toGray(png.data, png.width, png.height), png.width, png.height);
    }
    if (mime === "image/jpeg") {
      const decoded = jpeg.decode(Buffer.from(bytes), { useTArray: true, formatAsRGBA: true });
      return averageHash(toGray(decoded.data, decoded.width, decoded.height), decoded.width, decoded.height);
    }
  } catch {
    return null;
  }
  return null;
}

function toGray(data: Uint8Array | Buffer, width: number, height: number): Uint8Array {
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    gray[i] = Math.round(0.299 * (data[offset] ?? 0) + 0.587 * (data[offset + 1] ?? 0) + 0.114 * (data[offset + 2] ?? 0));
  }
  return gray;
}
