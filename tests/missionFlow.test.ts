import { describe, expect, it } from 'vitest';
import { missionPhase } from '../src/core/GameRules';

const base = {
  phase: 1,
  hasKitchen: false,
  biomassMined: 0,
  rationsProduced: 0,
  hasSmelter: false,
  metalProduced: 0,
  beds: 0,
  hasWorkshop: false,
  armourProduced: 0,
  recruited: 0,
  dwarfClaimed: false,
  dwarfOreMined: 0,
};

describe('Missionsfluss', () => {
  it('überspringt keine Phase', () => {
    expect(missionPhase({ ...base, dwarfClaimed: true, dwarfOreMined: 12 })).toBe(1);
  });

  it('schließt die fünf aufeinanderfolgenden Phasen ab', () => {
    let phase = missionPhase({ ...base, hasKitchen: true, biomassMined: 4, rationsProduced: 2 });
    expect(phase).toBe(2);
    phase = missionPhase({ ...base, phase, hasSmelter: true, metalProduced: 2, beds: 2 });
    expect(phase).toBe(3);
    phase = missionPhase({ ...base, phase, hasWorkshop: true, armourProduced: 2, recruited: 2 });
    expect(phase).toBe(4);
    phase = missionPhase({ ...base, phase, dwarfClaimed: true, dwarfOreMined: 6 });
    expect(phase).toBe(5);
  });
});
