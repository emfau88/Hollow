import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveVisualTheme } from './VisualTheme';

function pngDimensions(assetPath: string): [number, number] {
  const bytes = readFileSync(resolve(process.cwd(), 'public', assetPath));
  expect(bytes.subarray(1, 4).toString('ascii')).toBe('PNG');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}

describe('visual theme selection', () => {
  it('keeps the established theme as the safe default', () => {
    expect(resolveVisualTheme('').id).toBe('legacy');
    expect(resolveVisualTheme('?automation=1').id).toBe('legacy');
  });

  it('accepts both public names for the Style B slice', () => {
    expect(resolveVisualTheme('?theme=style-b').id).toBe('style-b');
    expect(resolveVisualTheme('?theme=comedy').id).toBe('style-b');
  });

  it('keeps the production V7 wall kit unless the prototype is explicitly requested', () => {
    const production = resolveVisualTheme('?theme=style-b').assets.wallKit!;
    const unknown = resolveVisualTheme('?theme=style-b&wall-prototype=unknown').assets.wallKit!;

    expect(production.id).toBe('production-v7');
    expect(production.atlas).toBe('assets/generated/style-b-v3/walls/wall-atlas-built-v7.png');
    expect(production.occlusionAtlas).toBeUndefined();
    expect(production.geometry).toEqual({
      frameWidth: 96,
      frameHeight: 96,
      originX: 0.5,
      originY: 0.5,
      thresholdDepth: 1.9,
      edgeDepth: 2,
      jointDepth: 2.1,
    });
    expect(unknown).toBe(production);
  });

  it('selects isolated Golden V1 paths only for an explicit Style B prototype query', () => {
    const prototype = resolveVisualTheme('?theme=style-b&wall-prototype=golden-v1');
    const wallKit = prototype.assets.wallKit!;

    expect(wallKit.id).toBe('golden-v1');
    expect(wallKit.atlas).toBe('assets/generated/style-b-wall-prototypes/golden-v1/wall-atlas-built.png');
    expect(wallKit.naturalThresholdAtlas)
      .toBe('assets/generated/style-b-wall-prototypes/golden-v1/threshold-natural.png');
    expect(wallKit.occlusionAtlas).toBeUndefined();
    expect(wallKit.geometry.occlusionDepth).toBe(34);
    expect(prototype.assets.terrain).toBe(resolveVisualTheme('?theme=style-b').assets.terrain);
    expect(resolveVisualTheme('?wall-prototype=golden-v1').id).toBe('legacy');
  });

  it('ships the complete V7 architecture atlas family at the expected frame grid', () => {
    const wallKit = resolveVisualTheme('?theme=style-b').assets.wallKit!;
    for (const path of [wallKit.atlas!, wallKit.neutralAtlas!, wallKit.naturalAtlas!, wallKit.corridorAtlas!]) {
      expect(pngDimensions(path)).toEqual([384, 384]);
    }
    expect(pngDimensions(wallKit.builtThresholdAtlas!)).toEqual([384, 96]);
    expect(pngDimensions(wallKit.naturalThresholdAtlas!)).toEqual([384, 96]);
  });
});
