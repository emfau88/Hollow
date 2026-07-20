import { describe, expect, it } from 'vitest';
import { prisonerConsequences, type Stock } from '../src/core/GameRules';

const stock: Stock = { ore: 0, biomass: 0, essence: 0, metal: 0, ration: 3, armour: 0 };
const current = { trust: 20, fear: 10, stock, finalWaveSize: 6 };

describe('Gefangenenentscheidung', () => {
  it('Freilassen erhöht Vertrauen und schwächt die Finalwelle', () => {
    const result = prisonerConsequences('release', current);
    expect(result.trust).toBe(35);
    expect(result.finalWaveSize).toBe(5);
  });

  it('Rekrutieren verbraucht zwei Rationen', () => {
    const result = prisonerConsequences('recruit', current);
    expect(result.trust).toBe(25);
    expect(result.stock.ration).toBe(1);
  });

  it('Opfern erzeugt Essenz und eine stärkere Finalwelle', () => {
    const result = prisonerConsequences('sacrifice', current);
    expect(result.fear).toBe(30);
    expect(result.stock.essence).toBe(6);
    expect(result.finalWaveSize).toBe(7);
  });
});
