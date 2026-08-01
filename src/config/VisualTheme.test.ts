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

  it('ships the complete V7 architecture atlas family at the expected frame grid', () => {
    const wallKit = resolveVisualTheme('?theme=style-b').assets.wallKit!;
    for (const path of [wallKit.atlas!, wallKit.neutralAtlas!, wallKit.naturalAtlas!, wallKit.corridorAtlas!]) {
      expect(pngDimensions(path)).toEqual([384, 384]);
    }
    expect(pngDimensions(wallKit.builtThresholdAtlas!)).toEqual([384, 96]);
    expect(pngDimensions(wallKit.naturalThresholdAtlas!)).toEqual([384, 96]);
  });
});
