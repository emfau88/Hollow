import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveVisualTheme } from '../src/config/VisualTheme';
import {
  alphaBounds,
  alphaHash,
  alphaMaskDistance,
  alphaPixelCount,
  cropAtlasFrame,
  readRgbaPng,
  rgbaHash,
  type AlphaBounds,
  type RgbaImage,
} from './helpers/pngRgba';

const FRAME_SIZE = 96;
const GRID_SIZE = 32;
const REQUIRED_FRAME_COUNT = 14;
const RESERVED_FRAMES = [14, 15] as const;
const MIN_OPAQUE_PIXELS = 64;
const MIN_FRAME_MARGIN = 2;
const MIN_CORRIDOR_CLEARANCE = 8;
const MIN_ORIENTED_MASK_DISTANCE = 0.04;

function publicAssetPath(assetPath: string): string {
  return resolve(process.cwd(), 'public', assetPath);
}

function requiredAlphaBounds(frame: RgbaImage): AlphaBounds {
  const bounds = alphaBounds(frame);
  expect(bounds, 'expected a non-empty alpha silhouette').toBeDefined();
  return bounds!;
}

function atlasFrames(path: string, expectedHeight = FRAME_SIZE * 4): RgbaImage[] {
  const atlas = readRgbaPng(path);
  expect([atlas.width, atlas.height], path).toEqual([FRAME_SIZE * 4, expectedHeight]);
  const count = (atlas.width / FRAME_SIZE) * (atlas.height / FRAME_SIZE);
  return Array.from({ length: count }, (_, index) => cropAtlasFrame(atlas, index));
}

function expectFrameInsideSafeCanvas(frame: RgbaImage): void {
  const bounds = requiredAlphaBounds(frame);
  expect(bounds.minX).toBeGreaterThanOrEqual(MIN_FRAME_MARGIN);
  expect(bounds.minY).toBeGreaterThanOrEqual(MIN_FRAME_MARGIN);
  expect(bounds.maxX).toBeLessThanOrEqual(FRAME_SIZE - MIN_FRAME_MARGIN);
  expect(bounds.maxY).toBeLessThanOrEqual(FRAME_SIZE - MIN_FRAME_MARGIN);
}

function expectEdgeAnchorsAndClearance(frames: RgbaImage[]): void {
  const [north, east, south, west] = frames.slice(0, 4).map(requiredAlphaBounds);
  const pivot = FRAME_SIZE / 2;

  // Each edge must cross the exact grid boundary at the frame pivot. Otherwise
  // an apparently valid sprite can float away from the topology it represents.
  expect(north.minY).toBeLessThanOrEqual(pivot);
  expect(north.maxY).toBeGreaterThan(pivot);
  expect(east.minX).toBeLessThanOrEqual(pivot);
  expect(east.maxX).toBeGreaterThan(pivot);
  expect(south.minY).toBeLessThanOrEqual(pivot);
  expect(south.maxY).toBeGreaterThan(pivot);
  expect(west.minX).toBeLessThanOrEqual(pivot);
  expect(west.maxX).toBeGreaterThan(pivot);

  // Opposing sprites are centred one logical tile apart. This is the actual
  // alpha corridor left between them, independent of decorative canvas size.
  const verticalClearance = GRID_SIZE + south.minY - north.maxY;
  const horizontalClearance = GRID_SIZE + east.minX - west.maxX;
  expect(verticalClearance, 'north/south alpha corridor').toBeGreaterThanOrEqual(MIN_CORRIDOR_CLEARANCE);
  expect(horizontalClearance, 'west/east alpha corridor').toBeGreaterThanOrEqual(MIN_CORRIDOR_CLEARANCE);
}

function expectPopulatedWallAtlas(path: string): RgbaImage[] {
  const frames = atlasFrames(path);
  for (let index = 0; index < REQUIRED_FRAME_COUNT; index++) {
    expect(alphaPixelCount(frames[index]), `${path} frame ${index}`).toBeGreaterThanOrEqual(MIN_OPAQUE_PIXELS);
    expectFrameInsideSafeCanvas(frames[index]);
  }
  for (const index of RESERVED_FRAMES) {
    expect(alphaPixelCount(frames[index]), `${path} reserved frame ${index}`).toBe(0);
  }
  expectEdgeAnchorsAndClearance(frames);
  return frames;
}

function minimumPairwiseMaskDistance(frames: RgbaImage[]): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let first = 0; first < frames.length; first++) {
    for (let second = first + 1; second < frames.length; second++) {
      minimum = Math.min(minimum, alphaMaskDistance(frames[first], frames[second]));
    }
  }
  return minimum;
}

const activeWallKit = resolveVisualTheme('?theme=style-b').assets.wallKit!;
const activeFamilies = [
  ['built', activeWallKit.atlas!],
  ['fortified', activeWallKit.neutralAtlas!],
  ['natural', activeWallKit.naturalAtlas!],
  ['corridor', activeWallKit.corridorAtlas!],
] as const;

describe('active Style B wall asset compatibility', () => {
  it.each(activeFamilies)('%s atlas fills every runtime frame without clipping or closing a tile', (_family, assetPath) => {
    const frames = expectPopulatedWallAtlas(publicAssetPath(assetPath));

    // The current V7 compatibility floor detects accidental byte duplication.
    // The stricter optional Golden suite below additionally requires genuinely
    // different alpha silhouettes for every orientation.
    expect(new Set(frames.slice(0, 4).map(rgbaHash)).size).toBe(4);
    expect(new Set(frames.slice(4, 8).map(rgbaHash)).size).toBe(4);
    expect(new Set(frames.slice(8, 12).map(rgbaHash)).size).toBe(4);
    expect(new Set(frames.slice(12, 14).map(rgbaHash)).size).toBe(2);
  });

  it.each([
    ['built', activeWallKit.builtThresholdAtlas!],
    ['natural', activeWallKit.naturalThresholdAtlas!],
  ] as const)('%s threshold atlas exposes four populated directional slots', (_family, assetPath) => {
    const frames = atlasFrames(publicAssetPath(assetPath), FRAME_SIZE);
    expect(frames).toHaveLength(4);
    for (const frame of frames) {
      expect(alphaPixelCount(frame)).toBeGreaterThanOrEqual(MIN_OPAQUE_PIXELS);
      expectFrameInsideSafeCanvas(frame);
    }
    // The renderer stores each boundary once, so east and south are its two
    // directly reachable slots. They must never collapse to one payload.
    expect(alphaHash(frames[1])).not.toBe(alphaHash(frames[2]));
  });
});

const prototypeWallKit = resolveVisualTheme('?theme=style-b&wall-prototype=golden-v1').assets.wallKit!;
const defaultGoldenDirectory = dirname(publicAssetPath(prototypeWallKit.atlas!));
const configuredGoldenDirectory = process.env.STYLE_B_GOLDEN_WALL_DIR;
const goldenDirectory = configuredGoldenDirectory
  ? (isAbsolute(configuredGoldenDirectory)
      ? configuredGoldenDirectory
      : resolve(process.cwd(), configuredGoldenDirectory))
  : defaultGoldenDirectory;
const goldenPath = (assetPath: string): string => resolve(goldenDirectory, basename(assetPath));
const goldenFiles = {
  built: goldenPath(prototypeWallKit.atlas!),
  fortified: goldenPath(prototypeWallKit.neutralAtlas!),
  natural: goldenPath(prototypeWallKit.naturalAtlas!),
  corridor: goldenPath(prototypeWallKit.corridorAtlas!),
  builtThreshold: goldenPath(prototypeWallKit.builtThresholdAtlas!),
  naturalThreshold: goldenPath(prototypeWallKit.naturalThresholdAtlas!),
} as const;
const goldenPaths = Object.values(goldenFiles);
const presentGoldenFiles = goldenPaths.filter(existsSync);
const completeGoldenPrototype = presentGoldenFiles.length === goldenPaths.length;

describe('Style B golden prototype file set', () => {
  it('is either deliberately absent or complete', () => {
    expect(
      presentGoldenFiles.length === 0 || completeGoldenPrototype,
      `Found ${presentGoldenFiles.length}/${goldenPaths.length} Golden files in ${goldenDirectory}`,
    ).toBe(true);
  });
});

describe.skipIf(!completeGoldenPrototype)('Style B golden prototype visual contract', () => {
  const familyPaths = [
    goldenFiles.built,
    goldenFiles.fortified,
    goldenFiles.natural,
    goldenFiles.corridor,
  ];

  it.each(familyPaths)('%s has authored alpha geometry for every orientation', (path) => {
    const frames = expectPopulatedWallAtlas(path);
    for (const [label, orientedFrames] of [
      ['edges', frames.slice(0, 4)],
      ['convex joints', frames.slice(4, 8)],
      ['concave joints', frames.slice(8, 12)],
      ['diagonal joints', frames.slice(12, 14)],
    ] as const) {
      expect(
        minimumPairwiseMaskDistance(orientedFrames),
        `${path} ${label} repeat the same alpha silhouette`,
      ).toBeGreaterThanOrEqual(MIN_ORIENTED_MASK_DISTANCE);
    }
  });

  it('keeps the two authored prototype families visually independent', () => {
    const families = familyPaths.map((path) => atlasFrames(path));
    for (let frame = 0; frame < REQUIRED_FRAME_COUNT; frame++) {
      // Golden-v1 deliberately authors built + corridor first. Fortified may
      // mirror built and natural may mirror corridor until their promotion
      // pass, but the two evaluated material families must never collapse.
      expect(new Set(families.map((family) => rgbaHash(family[frame]))).size, `frame ${frame}`)
        .toBeGreaterThanOrEqual(2);
      expect(rgbaHash(families[0][frame]), `built/corridor frame ${frame}`)
        .not.toBe(rgbaHash(families[3][frame]));
    }
  });

  it.each([goldenFiles.builtThreshold, goldenFiles.naturalThreshold])(
    '%s authors all threshold directions rather than rotating or duplicating one sill',
    (path) => {
      const frames = atlasFrames(path, FRAME_SIZE);
      for (const frame of frames) {
        expect(alphaPixelCount(frame)).toBeGreaterThanOrEqual(MIN_OPAQUE_PIXELS);
        expectFrameInsideSafeCanvas(frame);
      }
      expect(minimumPairwiseMaskDistance(frames)).toBeGreaterThanOrEqual(MIN_ORIENTED_MASK_DISTANCE);
    },
  );
});
