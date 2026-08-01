import { describe, expect, it } from 'vitest';
import { architectureTransition, classifyTerrainArchitecture } from './TerrainArchitecture';

describe('classifyTerrainArchitecture', () => {
  it('keeps the fixed headquarters on the room architecture', () => {
    expect(classifyTerrainArchitecture({
      inStartingChamber: true,
      hasCompletedRoom: false,
    })).toBe('built-room');
  });

  it('promotes completed functional rooms to room architecture', () => {
    expect(classifyTerrainArchitecture({
      inStartingChamber: false,
      hasCompletedRoom: true,
    })).toBe('built-room');
  });

  it('keeps natural resource caverns on their own architecture', () => {
    expect(classifyTerrainArchitecture({
      inStartingChamber: false,
      hasCompletedRoom: false,
      strategicChamber: 'natural',
    })).toBe('natural-cavern');
  });

  it('keeps enemy strongholds on fortified architecture', () => {
    expect(classifyTerrainArchitecture({
      inStartingChamber: false,
      hasCompletedRoom: false,
      strategicChamber: 'fortified',
    })).toBe('fortified-chamber');
  });

  it('keeps every unassigned excavation on corridor architecture', () => {
    expect(classifyTerrainArchitecture({
      inStartingChamber: false,
      hasCompletedRoom: false,
    })).toBe('corridor');
  });

  it.each<[string, Array<[number, number]>]>([
    ['one-cell horizontal', [[0, 0], [1, 0], [2, 0]]],
    ['one-cell vertical', [[0, 0], [0, 1], [0, 2]]],
    ['two-cell horizontal', [[0, 0], [1, 0], [0, 1], [1, 1]]],
    ['two-cell vertical', [[0, 0], [0, 1], [1, 0], [1, 1]]],
    ['L bend', [[0, 0], [1, 0], [1, 1]]],
    ['T junction', [[0, 0], [1, 0], [2, 0], [1, 1]]],
  ])('does not infer %s as room architecture', (_label, cells) => {
    const roles = cells.map(() => classifyTerrainArchitecture({
      inStartingChamber: false,
      hasCompletedRoom: false,
    }));
    expect(new Set(roles)).toEqual(new Set(['corridor']));
  });

  it('keeps a corridor-to-chamber transition semantically stable', () => {
    const corridor = classifyTerrainArchitecture({
      inStartingChamber: false,
      hasCompletedRoom: false,
    });
    const chamber = classifyTerrainArchitecture({
      inStartingChamber: false,
      hasCompletedRoom: false,
      strategicChamber: 'natural',
    });
    expect([corridor, chamber]).toEqual(['corridor', 'natural-cavern']);
  });
});

describe('architectureTransition', () => {
  it('creates a built threshold in either corridor direction', () => {
    expect(architectureTransition('corridor', 'built-room')).toBe('built-room');
    expect(architectureTransition('built-room', 'corridor')).toBe('built-room');
  });

  it('creates a natural threshold without converting the cavern', () => {
    expect(architectureTransition('corridor', 'natural-cavern')).toBe('natural-cavern');
  });

  it('does not add seams inside one architecture family', () => {
    expect(architectureTransition('corridor', 'corridor')).toBeUndefined();
    expect(architectureTransition('built-room', 'built-room')).toBeUndefined();
  });

  it('does not invent a doorway between adjacent authored spaces', () => {
    expect(architectureTransition('built-room', 'natural-cavern')).toBeUndefined();
  });
});
