import { describe, expect, it } from 'vitest';
import { classifyTerrainArchitecture } from './TerrainArchitecture';

describe('classifyTerrainArchitecture', () => {
  it('keeps the fixed headquarters on the room architecture', () => {
    expect(classifyTerrainArchitecture({
      inStartingChamber: true,
      hasCompletedRoom: false,
      inStrategicChamber: false,
    })).toBe('room');
  });

  it('promotes completed functional rooms to room architecture', () => {
    expect(classifyTerrainArchitecture({
      inStartingChamber: false,
      hasCompletedRoom: true,
      inStrategicChamber: false,
    })).toBe('room');
  });

  it('keeps natural and strategic caverns on chamber architecture', () => {
    expect(classifyTerrainArchitecture({
      inStartingChamber: false,
      hasCompletedRoom: false,
      inStrategicChamber: true,
    })).toBe('chamber');
  });

  it('keeps every unassigned excavation on corridor architecture', () => {
    expect(classifyTerrainArchitecture({
      inStartingChamber: false,
      hasCompletedRoom: false,
      inStrategicChamber: false,
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
      inStrategicChamber: false,
    }));
    expect(new Set(roles)).toEqual(new Set(['corridor']));
  });

  it('keeps a corridor-to-chamber transition semantically stable', () => {
    const corridor = classifyTerrainArchitecture({
      inStartingChamber: false,
      hasCompletedRoom: false,
      inStrategicChamber: false,
    });
    const chamber = classifyTerrainArchitecture({
      inStartingChamber: false,
      hasCompletedRoom: false,
      inStrategicChamber: true,
    });
    expect([corridor, chamber]).toEqual(['corridor', 'chamber']);
  });
});
