export type TerrainArchitecture = 'room' | 'chamber' | 'corridor';

export interface TerrainArchitectureFacts {
  inStartingChamber: boolean;
  hasCompletedRoom: boolean;
  inStrategicChamber: boolean;
}

/**
 * Visual architecture is semantic, not inferred from the current open shape.
 * A two-cell-wide route therefore remains a corridor instead of suddenly
 * switching to the deep room-wall family merely because it contains a 2x2.
 */
export function classifyTerrainArchitecture(facts: TerrainArchitectureFacts): TerrainArchitecture {
  if (facts.inStartingChamber || facts.hasCompletedRoom) return 'room';
  if (facts.inStrategicChamber) return 'chamber';
  return 'corridor';
}
