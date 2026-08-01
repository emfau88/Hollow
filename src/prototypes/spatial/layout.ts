export type SpatialZone = 'built' | 'corridor' | 'natural';

export interface GridCell {
  x: number;
  z: number;
  zone: SpatialZone;
}

export type BoundarySide = 'north' | 'east' | 'south' | 'west';

export interface BoundaryEdge {
  axis: 'x' | 'z';
  constant: number;
  start: number;
  end: number;
  side: BoundarySide;
  zone: SpatialZone;
}

export interface BoundaryRun extends BoundaryEdge {
  length: number;
}

export interface Point2 {
  x: number;
  z: number;
}

export interface OpenPortal {
  x: number;
  z: number;
  side: BoundarySide;
}

export interface SpatialPrototypeLayout {
  cells: GridCell[];
  boundaries: BoundaryRun[];
  grotto: Point2[];
  metrics: {
    tileSize: number;
    actorWidth: number;
    corridorWallThickness: number;
    builtWallHeight: number;
    corridorWallHeight: number;
  };
}

export const spatialCellKey = (x: number, z: number): string => `${x},${z}`;

function addRect(
  cells: Map<string, GridCell>,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  zone: SpatialZone,
): void {
  for (let z = z0; z <= z1; z += 1) {
    for (let x = x0; x <= x1; x += 1) {
      cells.set(spatialCellKey(x, z), { x, z, zone });
    }
  }
}

function boundaryEdges(cells: GridCell[], portals: OpenPortal[]): BoundaryEdge[] {
  const occupied = new Map(cells.map((cell) => [spatialCellKey(cell.x, cell.z), cell]));
  const openPortals = new Set(portals.map((portal) => `${portal.x},${portal.z},${portal.side}`));
  const edges: BoundaryEdge[] = [];

  const add = (cell: GridCell, side: BoundarySide): void => {
    if (openPortals.has(`${cell.x},${cell.z},${side}`)) return;

    if (side === 'north' || side === 'south') {
      edges.push({
        axis: 'x',
        constant: cell.z + (side === 'north' ? -0.5 : 0.5),
        start: cell.x - 0.5,
        end: cell.x + 0.5,
        side,
        zone: cell.zone,
      });
      return;
    }

    edges.push({
      axis: 'z',
      constant: cell.x + (side === 'west' ? -0.5 : 0.5),
      start: cell.z - 0.5,
      end: cell.z + 0.5,
      side,
      zone: cell.zone,
    });
  };

  for (const cell of cells) {
    if (!occupied.has(spatialCellKey(cell.x, cell.z - 1))) add(cell, 'north');
    if (!occupied.has(spatialCellKey(cell.x + 1, cell.z))) add(cell, 'east');
    if (!occupied.has(spatialCellKey(cell.x, cell.z + 1))) add(cell, 'south');
    if (!occupied.has(spatialCellKey(cell.x - 1, cell.z))) add(cell, 'west');
  }

  return edges;
}

export function buildBoundaryRuns(cells: GridCell[], portals: OpenPortal[] = []): BoundaryRun[] {
  return mergeBoundaryEdges(boundaryEdges(cells, portals));
}

export function mergeBoundaryEdges(edges: BoundaryEdge[]): BoundaryRun[] {
  const groups = new Map<string, BoundaryEdge[]>();

  for (const edge of edges) {
    const key = `${edge.axis}:${edge.constant}:${edge.side}:${edge.zone}`;
    const group = groups.get(key) ?? [];
    group.push(edge);
    groups.set(key, group);
  }

  const runs: BoundaryRun[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => a.start - b.start);
    let current = { ...group[0] };

    for (let index = 1; index < group.length; index += 1) {
      const next = group[index];
      if (Math.abs(current.end - next.start) < 0.0001) {
        current.end = next.end;
      } else {
        runs.push({ ...current, length: current.end - current.start });
        current = { ...next };
      }
    }
    runs.push({ ...current, length: current.end - current.start });
  }

  return runs;
}

export function createSpatialPrototypeLayout(): SpatialPrototypeLayout {
  const cellMap = new Map<string, GridCell>();

  // One built room, a two-tile vestibule, a one-tile run and a north T-branch.
  addRect(cellMap, -5, 0, -2, 2, 'built');
  addRect(cellMap, 1, 7, 0, 0, 'corridor');
  addRect(cellMap, 1, 2, 1, 1, 'corridor');
  addRect(cellMap, 4, 4, -3, -1, 'corridor');

  const cells = [...cellMap.values()];
  const boundaries = buildBoundaryRuns(cells, [{ x: 7, z: 0, side: 'east' }]);

  // The final edge back to the first point is deliberately the open cave mouth.
  const grotto: Point2[] = [
    { x: 7.35, z: -0.72 },
    { x: 8.05, z: -2.25 },
    { x: 9.55, z: -3.18 },
    { x: 11.55, z: -3.05 },
    { x: 13.05, z: -1.72 },
    { x: 13.45, z: 0.18 },
    { x: 12.65, z: 2.28 },
    { x: 10.65, z: 3.05 },
    { x: 8.72, z: 2.38 },
    { x: 7.35, z: 0.72 },
  ];

  return {
    cells,
    boundaries,
    grotto,
    metrics: {
      tileSize: 1,
      actorWidth: 0.42,
      corridorWallThickness: 0.22,
      builtWallHeight: 0.92,
      corridorWallHeight: 0.38,
    },
  };
}
