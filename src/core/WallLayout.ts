export type WallSide = 'north' | 'east' | 'south' | 'west';
export type WallPart = WallSide | 'north-east' | 'east-south' | 'south-west' | 'west-north';

export interface WallNeighbours {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
}

/**
 * Selects non-overlapping wall art for one open terrain tile.
 *
 * A single L-piece is only safe for an exact two-side corner. Dead ends and
 * isolated tiles must use independent straight sides; stacking multiple large
 * L-pieces otherwise paints apparent barriers across the only open passage.
 */
export function wallParts(neighbours: WallNeighbours): WallPart[] {
  const { north, east, south, west } = neighbours;
  const count = Number(north) + Number(east) + Number(south) + Number(west);
  if (count === 2) {
    if (north && east) return ['north-east'];
    if (east && south) return ['east-south'];
    if (south && west) return ['south-west'];
    if (west && north) return ['west-north'];
  }

  const parts: WallPart[] = [];
  if (north) parts.push('north');
  if (east) parts.push('east');
  if (south) parts.push('south');
  if (west) parts.push('west');
  return parts;
}
