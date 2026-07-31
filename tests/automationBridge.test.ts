import { describe, expect, it } from 'vitest';
import { parseAutomationOptions } from '../src/core/AutomationBridge';

describe('automation options', () => {
  it('is opt-in and uses a stable default seed', () => {
    expect(parseAutomationOptions('')).toEqual({ enabled: false, seed: 1337 });
    expect(parseAutomationOptions('?automation=1')).toEqual({ enabled: true, seed: 1337 });
  });

  it('accepts a non-negative integer seed', () => {
    expect(parseAutomationOptions('?automation=1&seed=42')).toEqual({ enabled: true, seed: 42 });
  });

  it('rejects invalid and negative seeds', () => {
    expect(parseAutomationOptions('?automation=1&seed=-2').seed).toBe(1337);
    expect(parseAutomationOptions('?automation=1&seed=abc').seed).toBe(1337);
    expect(parseAutomationOptions('?automation=1&seed=1.5').seed).toBe(1337);
  });
});
