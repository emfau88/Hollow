import { proofCellKey, type BoundaryEdge, type ProofCell } from './GeometryProofModel';

export type WallCornerKind = 'outer' | 'inner' | 'junction';
export type PassageThresholdKind = 'built' | 'natural';

export interface WallCorner {
  x: number;
  z: number;
  kind: WallCornerKind;
}

export interface PassageThreshold {
  key: string;
  x: number;
  z: number;
  vertical: boolean;
  kind: PassageThresholdKind;
}

/**
 * Classify only actual turns in the built boundary. Straight joins deliberately
 * stay free of posts so the masonry reads as broad, calm runs rather than a
 * fence. One occupied quadrant is an exterior corner, three form an inset
 * corner, and a diagonal pair is the rare junction case.
 */
export function classifyWallCorners(
  edges: BoundaryEdge[],
  constructed: ReadonlySet<string>,
): WallCorner[] {
  const candidates = new Map<string, { x: number; z: number }>();
  for (const edge of edges) {
    candidates.set(proofCellKey(edge.start.x, edge.start.z), edge.start);
    candidates.set(proofCellKey(edge.end.x, edge.end.z), edge.end);
  }

  const corners: WallCorner[] = [];
  for (const point of candidates.values()) {
    const quadrants = [
      constructed.has(proofCellKey(point.x - 1, point.z - 1)),
      constructed.has(proofCellKey(point.x, point.z - 1)),
      constructed.has(proofCellKey(point.x, point.z)),
      constructed.has(proofCellKey(point.x - 1, point.z)),
    ];
    const occupied = quadrants.filter(Boolean).length;
    if (occupied === 1) corners.push({ ...point, kind: 'outer' });
    else if (occupied === 3) corners.push({ ...point, kind: 'inner' });
    else if (occupied === 2 && quadrants[0] === quadrants[2]) {
      corners.push({ ...point, kind: 'junction' });
    }
  }
  return corners;
}

/**
 * Find semantic floor transitions without adding new gameplay state. A
 * start/corridor boundary receives Covenant stone and brass; the first step
 * from a corridor into a target biome receives a lower natural sill.
 */
export function findPassageThresholds(cells: ProofCell[]): PassageThreshold[] {
  const byKey = new Map(cells.map((cell) => [proofCellKey(cell.x, cell.z), cell]));
  const thresholds: PassageThreshold[] = [];

  for (const cell of cells) {
    for (const neighbour of [
      { x: cell.x + 1, z: cell.z, vertical: true },
      { x: cell.x, z: cell.z + 1, vertical: false },
    ]) {
      const adjacent = byKey.get(proofCellKey(neighbour.x, neighbour.z));
      if (!adjacent || adjacent.zone === cell.zone) continue;
      if (cell.zone !== 'corridor' && adjacent.zone !== 'corridor') continue;

      const kind: PassageThresholdKind = cell.zone === 'target' || adjacent.zone === 'target'
        ? 'natural'
        : 'built';
      const x = neighbour.vertical ? cell.x + 1 : cell.x + 0.5;
      const z = neighbour.vertical ? cell.z + 0.5 : cell.z + 1;
      thresholds.push({
        key: `${kind}:${neighbour.vertical ? 'v' : 'h'}:${x}:${z}`,
        x,
        z,
        vertical: neighbour.vertical,
        kind,
      });
    }
  }

  return thresholds;
}
