import { describe, expect, it } from 'vitest';
import { resolveVisualTheme } from './VisualTheme';

describe('visual theme selection', () => {
  it('keeps the established theme as the safe default', () => {
    expect(resolveVisualTheme('').id).toBe('legacy');
    expect(resolveVisualTheme('?automation=1').id).toBe('legacy');
  });

  it('accepts both public names for the Style B slice', () => {
    expect(resolveVisualTheme('?theme=style-b').id).toBe('style-b');
    expect(resolveVisualTheme('?theme=comedy').id).toBe('style-b');
  });
});
