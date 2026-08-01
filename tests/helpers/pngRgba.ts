import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface AlphaBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paethPredictor(left: number, up: number, upperLeft: number): number {
  const prediction = left + up - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const upDistance = Math.abs(prediction - up);
  const upperLeftDistance = Math.abs(prediction - upperLeft);
  if (leftDistance <= upDistance && leftDistance <= upperLeftDistance) return left;
  return upDistance <= upperLeftDistance ? up : upperLeft;
}

/**
 * Minimal dependency-free PNG reader for asset contract tests. The Style B
 * pipeline deliberately exports non-interlaced 8-bit RGB/RGBA files; failing
 * on another encoding makes that build-contract change explicit.
 */
export function readRgbaPng(path: string): RgbaImage {
  const bytes = readFileSync(path);
  if (!bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    throw new Error(`${path} is not a PNG file`);
  }

  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = -1;
  let interlace = -1;
  const idat: Buffer[] = [];

  for (let offset = PNG_SIGNATURE.length; offset < bytes.length;) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const payload = bytes.subarray(offset + 8, offset + 8 + length);
    offset += length + 12;
    if (type === 'IHDR') {
      width = payload.readUInt32BE(0);
      height = payload.readUInt32BE(4);
      bitDepth = payload[8];
      colorType = payload[9];
      interlace = payload[12];
    } else if (type === 'IDAT') {
      idat.push(payload);
    } else if (type === 'IEND') {
      break;
    }
  }

  if (!width || !height || idat.length === 0) throw new Error(`${path} has incomplete PNG chunks`);
  if (bitDepth !== 8 || interlace !== 0 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(
      `${path} must be a non-interlaced 8-bit RGB/RGBA PNG; got bitDepth=${bitDepth}, colorType=${colorType}, interlace=${interlace}`,
    );
  }

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const stride = width * bytesPerPixel;
  const encoded = inflateSync(Buffer.concat(idat));
  const expectedLength = (stride + 1) * height;
  if (encoded.length !== expectedLength) {
    throw new Error(`${path} has ${encoded.length} decoded bytes; expected ${expectedLength}`);
  }

  const pixels = Buffer.alloc(stride * height);
  let encodedOffset = 0;
  for (let y = 0; y < height; y++) {
    const filter = encoded[encodedOffset++];
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x++) {
      const raw = encoded[encodedOffset++];
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[rowOffset - stride + x] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[rowOffset - stride + x - bytesPerPixel]
        : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paethPredictor(left, up, upperLeft);
      else if (filter !== 0) throw new Error(`${path} uses unsupported PNG filter ${filter}`);
      pixels[rowOffset + x] = (raw + predictor) & 0xff;
    }
  }

  if (colorType === 6) return { width, height, data: new Uint8Array(pixels) };

  const rgba = new Uint8Array(width * height * 4);
  for (let source = 0, target = 0; source < pixels.length; source += 3, target += 4) {
    rgba[target] = pixels[source];
    rgba[target + 1] = pixels[source + 1];
    rgba[target + 2] = pixels[source + 2];
    rgba[target + 3] = 255;
  }
  return { width, height, data: rgba };
}

export function cropAtlasFrame(
  atlas: RgbaImage,
  index: number,
  frameSize = 96,
  columns = 4,
): RgbaImage {
  const startX = (index % columns) * frameSize;
  const startY = Math.floor(index / columns) * frameSize;
  if (startX + frameSize > atlas.width || startY + frameSize > atlas.height) {
    throw new Error(`Frame ${index} falls outside ${atlas.width}x${atlas.height} atlas`);
  }
  const data = new Uint8Array(frameSize * frameSize * 4);
  for (let y = 0; y < frameSize; y++) {
    const sourceStart = ((startY + y) * atlas.width + startX) * 4;
    const targetStart = y * frameSize * 4;
    data.set(atlas.data.subarray(sourceStart, sourceStart + frameSize * 4), targetStart);
  }
  return { width: frameSize, height: frameSize, data };
}

export function alphaBounds(image: RgbaImage, threshold = 0): AlphaBounds | undefined {
  let minX = image.width;
  let minY = image.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      if (image.data[(y * image.width + x) * 4 + 3] <= threshold) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return maxX < 0 ? undefined : { minX, minY, maxX: maxX + 1, maxY: maxY + 1 };
}

export function alphaPixelCount(image: RgbaImage, threshold = 0): number {
  let count = 0;
  for (let offset = 3; offset < image.data.length; offset += 4) {
    if (image.data[offset] > threshold) count++;
  }
  return count;
}

export function rgbaHash(image: RgbaImage): string {
  return createHash('sha256').update(image.data).digest('hex');
}

export function alphaHash(image: RgbaImage): string {
  const alpha = Buffer.alloc(image.width * image.height);
  for (let source = 3, target = 0; source < image.data.length; source += 4, target++) {
    alpha[target] = image.data[source];
  }
  return createHash('sha256').update(alpha).digest('hex');
}

/** Ratio of pixels occupied by exactly one of the two alpha silhouettes. */
export function alphaMaskDistance(first: RgbaImage, second: RgbaImage, threshold = 8): number {
  if (first.width !== second.width || first.height !== second.height) {
    throw new Error('Alpha masks must have equal dimensions');
  }
  let union = 0;
  let difference = 0;
  for (let offset = 3; offset < first.data.length; offset += 4) {
    const firstOpaque = first.data[offset] > threshold;
    const secondOpaque = second.data[offset] > threshold;
    if (firstOpaque || secondOpaque) union++;
    if (firstOpaque !== secondOpaque) difference++;
  }
  return union === 0 ? 0 : difference / union;
}
