import type { TerrainArchitecture } from './TerrainArchitecture';

export type WallSide = 'north' | 'east' | 'south' | 'west';
export type WallQuadrant = 'northWest' | 'northEast' | 'southEast' | 'southWest';
export type WallDiagonal = 'northWestSouthEast' | 'northEastSouthWest';
export type WallJoint =
  | { kind: 'convex'; quadrant: WallQuadrant }
  | { kind: 'concave'; quadrant: WallQuadrant }
  | { kind: 'diagonal'; diagonal: WallDiagonal };

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
  if (count === 1) {
    const quadrant = (Object.entries(cells) as Array<[WallQuadrant, boolean]>)
      .find(([, open]) => open)?.[0];
    return quadrant ? { kind: 'convex', quadrant } : undefined;
  }
  if (count === 3) {
    const quadrant = (Object.entries(cells) as Array<[WallQuadrant, boolean]>)
      .find(([, open]) => !open)?.[0];
    return quadrant ? { kind: 'concave', quadrant } : undefined;
  }
  if (count !== 2) return undefined;
  if (northWest && southEast) return { kind: 'diagonal', diagonal: 'northWestSouthEast' };
  if (northEast && southWest) return { kind: 'diagonal', diagonal: 'northEastSouthWest' };
  return undefined;
}

/** Frame indices shared by all modular wall families. */
export function wallEdgeFrame(side: WallSide): number {
  return ({ north: 0, east: 1, south: 2, west: 3 } as const)[side];
}

/**
 * All wall families own complete vertex modules. Corridor modules are subtle
 * caps rather than room posts, so bends and T-junctions no longer depend on
 * overlapping straight sprites.
 */
export function wallJointFrame(joint: WallJoint): number {
  if (joint.kind === 'convex') {
    return ({ northWest: 4, northEast: 5, southEast: 6, southWest: 7 } as const)[joint.quadrant];
  }
  if (joint.kind === 'concave') {
    return ({ northWest: 8, northEast: 9, southEast: 10, southWest: 11 } as const)[joint.quadrant];
  }
  return joint.diagonal === 'northWestSouthEast' ? 12 : 13;
}

export function architecturePriority(architecture: TerrainArchitecture): number {
  return ({
    corridor: 0,
    'natural-cavern': 1,
    'fortified-chamber': 2,
    'built-room': 3,
  } as const)[architecture];
}
