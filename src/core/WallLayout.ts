export type WallSide = 'north' | 'east' | 'south' | 'west';
export type WallJoint = 'convex' | 'concave' | 'diagonal';

export interface WallNeighbours {
  north: boolean;
  east: boolean;
  south: boolean;
  west: boolean;
}

export interface WallVertexCells {
  northWest: boolean;
  northEast: boolean;
  southEast: boolean;
  southWest: boolean;
}

export interface WallAdjacentCells {
  north: boolean;
  northEast: boolean;
  east: boolean;
  southEast: boolean;
  south: boolean;
  southWest: boolean;
  west: boolean;
  northWest: boolean;
}

/**
 * Selects the solid-facing boundary edges of one open terrain tile. Each edge
 * is positioned on the grid boundary by TerrainRenderer; corners are handled
 * independently at shared grid vertices so they cannot leave a missing tile.
 */
export function wallSides(neighbours: WallNeighbours): WallSide[] {
  const { north, east, south, west } = neighbours;
  const sides: WallSide[] = [];
  if (north) sides.push('north');
  if (east) sides.push('east');
  if (south) sides.push('south');
  if (west) sides.push('west');
  return sides;
}

/**
 * Classifies a grid vertex from the four walkable cells surrounding it.
 * One open quadrant is a room's outside corner, three open quadrants are an
 * inward rock corner, and diagonal pairs need a compact cap to avoid pinholes.
 * Adjacent pairs form a straight wall and deliberately receive no post.
 */
export function wallJoint(cells: WallVertexCells): WallJoint | undefined {
  const { northWest, northEast, southEast, southWest } = cells;
  const count = Number(northWest) + Number(northEast) + Number(southEast) + Number(southWest);
  if (count === 1) return 'convex';
  if (count === 3) return 'concave';
  if (count !== 2) return undefined;
  const diagonal = (northWest && southEast) || (northEast && southWest);
  return diagonal ? 'diagonal' : undefined;
}

/**
 * A cell is room-like when it belongs to at least one fully open 2x2 block.
 * Everything else is a narrow passage, bend or dead end. This lets the
 * renderer keep deep 2.5D wall faces around chambers without letting opposite
 * faces overlap across a one-tile tunnel.
 */
export function isNarrowPassage(cells: WallAdjacentCells): boolean {
  const { north, northEast, east, southEast, south, southWest, west, northWest } = cells;
  const belongsToOpenSquare = (north && northEast && east)
    || (east && southEast && south)
    || (south && southWest && west)
    || (west && northWest && north);
  return !belongsToOpenSquare;
}

/** Frame indices shared by both Style B wall atlases. */
export function wallEdgeFrame(side: WallSide, narrow: boolean): number {
  const normal: Record<WallSide, number> = { north: 0, east: 1, south: 2, west: 3 };
  const compact: Record<WallSide, number> = { north: 8, east: 9, south: 10, west: 11 };
  return (narrow ? compact : normal)[side];
}

/** Only broad chamber corners receive a freestanding post. */
export function shouldRenderWallPost(kind: WallJoint, narrow: boolean): boolean {
  return kind === 'convex' && !narrow;
}
