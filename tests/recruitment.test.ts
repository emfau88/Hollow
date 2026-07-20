import { describe, expect, it } from 'vitest';
import { canRecruitUnit, type RecruitmentContext, type Stock } from '../src/core/GameRules';

const fullStock: Stock = { ore: 0, biomass: 0, essence: 5, metal: 0, ration: 4, armour: 4 };
const context: RecruitmentContext = {
  stock: fullStock,
  beds: 2,
  bedsUsed: 1,
  hasKitchen: true,
  hasWorkshop: true,
  shrineClaimed: false,
};

describe('Rekrutierung', () => {
  it('blockiert ohne freies Bett', () => {
    expect(canRecruitUnit('guard', { ...context, bedsUsed: 2 })).toBe(false);
  });

  it('erlaubt Guard mit Küche, Werkstatt, Ration, Rüstung und Bett', () => {
    expect(canRecruitUnit('guard', context)).toBe(true);
  });

  it('blockiert Hexbinder bis der Schrein erobert wurde', () => {
    expect(canRecruitUnit('hexbinder', context)).toBe(false);
    expect(canRecruitUnit('hexbinder', { ...context, shrineClaimed: true })).toBe(true);
  });
});
