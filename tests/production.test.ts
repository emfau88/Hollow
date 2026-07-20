import { describe, expect, it } from 'vitest';
import { applyRecipe, canStartRecipe, type Stock } from '../src/core/GameRules';

const stock = (overrides: Partial<Stock> = {}): Stock => ({
  ore: 0,
  biomass: 0,
  essence: 0,
  metal: 0,
  ration: 0,
  armour: 0,
  ...overrides,
});

describe('Sichtbare Produktionsketten', () => {
  it('verarbeitet 2 Erz zu 1 Metall', () => {
    const result = applyRecipe('smelter', stock({ ore: 2 }));
    expect(result.ore).toBe(0);
    expect(result.metal).toBe(1);
  });

  it('verarbeitet 2 Biomasse zu 2 Rationen', () => {
    const result = applyRecipe('kitchen', stock({ biomass: 2 }));
    expect(result.biomass).toBe(0);
    expect(result.ration).toBe(2);
  });

  it('startet ohne vollständigen Input nicht', () => {
    expect(canStartRecipe('workshop', stock())).toBe(false);
    expect(applyRecipe('workshop', stock())).toEqual(stock());
  });
});
