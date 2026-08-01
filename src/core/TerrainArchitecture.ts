export type TerrainArchitecture =
  | 'built-room'
  | 'natural-cavern'
  | 'fortified-chamber'
  | 'corridor';

export type StrategicChamberKind = 'natural' | 'fortified';

export interface TerrainArchitectureFacts {
  inStartingChamber: boolean;
  hasCompletedRoom: boolean;
  strategicChamber?: StrategicChamberKind;
}

/**
 * Visual architecture is semantic, not inferred from the current open shape.
 * A two-cell-wide route therefore remains a corridor instead of suddenly
 * switching to the deep room-wall family merely because it contains a 2x2.
 */
export function classifyTerrainArchitecture(facts: TerrainArchitectureFacts): TerrainArchitecture {
  if (facts.inStartingChamber || facts.hasCompletedRoom) return 'built-room';
  if (facts.strategicChamber === 'natural') return 'natural-cavern';
  if (facts.strategicChamber === 'fortified') return 'fortified-chamber';
  return 'corridor';
}

/** Returns the authored side of a corridor threshold, if one is required. */
export function architectureTransition(
  first: TerrainArchitecture,
  second: TerrainArchitecture,
): TerrainArchitecture | undefined {
  if (first === second) return undefined;
  if (first === 'corridor' && second !== 'corridor') return second;
  if (second === 'corridor' && first !== 'corridor') return first;
  return undefined;
}
