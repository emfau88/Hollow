import type { TerrainArchitecture } from './TerrainArchitecture';

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

/** Frame indices shared by all modular wall families. */
export function wallEdgeFrame(side: WallSide): number {
  return ({ north: 0, east: 1, south: 2, west: 3 } as const)[side];
}

/** Corridor edges overlap cleanly and never receive freestanding room posts. */
export function shouldRenderWallPost(kind: WallJoint, architecture: TerrainArchitecture): boolean {
  return kind === 'convex' && architecture !== 'corridor';
}
