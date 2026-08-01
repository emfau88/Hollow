export type ProofStage = 0 | 1 | 2;
export type ProofZone = 'start' | 'target' | 'corridor';
export type BoundarySide = 'north' | 'east' | 'south' | 'west';

export interface ProofCell {
  x: number;
  z: number;
  zone: ProofZone;
}

export interface BoundaryEdge {
  key: string;
  x: number;
  z: number;
  axis: 'horizontal' | 'vertical';
  side: BoundarySide;
  start: { x: number; z: number };
  end: { x: number; z: number };
}

export interface GeometryProofLayout {
  stage: ProofStage;
  cells: ProofCell[];
  edges: BoundaryEdge[];
  vertices: Array<{ x: number; z: number }>;
  nextDig: Array<{ x: number; z: number }>;
  actorPath: Array<{ x: number; z: number }>;
  connected: boolean;
}

export const PROOF_BOUNDS = { minX: 0, maxX: 19, minZ: 0, maxZ: 15 } as const;

export function proofCellKey(x: number, z: number): string {
  return `${x},${z}`;
}

function addRect(
  cells: Map<string, ProofCell>,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  zone: ProofZone,
): void {
  for (let z = z0; z <= z1; z += 1) {
    for (let x = x0; x <= x1; x += 1) {
      cells.set(proofCellKey(x, z), { x, z, zone });
    }
  }
}

function addCells(
  cells: Map<string, ProofCell>,
  positions: Array<{ x: number; z: number }>,
  zone: ProofZone,
): void {
  for (const position of positions) {
    const key = proofCellKey(position.x, position.z);
    if (!cells.has(key)) cells.set(key, { ...position, zone });
  }
}

export const VERTICAL_DIG = Array.from({ length: 5 }, (_, index) => ({ x: 5, z: 8 - index }));
export const HORIZONTAL_DIG = Array.from({ length: 6 }, (_, index) => ({ x: 6 + index, z: 4 }));

export function buildBoundaryEdges(cells: ProofCell[]): BoundaryEdge[] {
  const open = new Set(cells.map((cell) => proofCellKey(cell.x, cell.z)));
  const edges = new Map<string, BoundaryEdge>();
  const add = (edge: BoundaryEdge): void => {
    edges.set(edge.key, edge);
  };

  for (const cell of cells) {
    if (!open.has(proofCellKey(cell.x, cell.z - 1))) {
      add({
        key: `h:${cell.x}:${cell.z}`,
        x: cell.x + 0.5,
        z: cell.z,
        axis: 'horizontal',
        side: 'north',
        start: { x: cell.x, z: cell.z },
        end: { x: cell.x + 1, z: cell.z },
      });
    }
    if (!open.has(proofCellKey(cell.x + 1, cell.z))) {
      add({
        key: `v:${cell.x + 1}:${cell.z}`,
        x: cell.x + 1,
        z: cell.z + 0.5,
        axis: 'vertical',
        side: 'east',
        start: { x: cell.x + 1, z: cell.z },
        end: { x: cell.x + 1, z: cell.z + 1 },
      });
    }
    if (!open.has(proofCellKey(cell.x, cell.z + 1))) {
      add({
        key: `h:${cell.x}:${cell.z + 1}`,
        x: cell.x + 0.5,
        z: cell.z + 1,
        axis: 'horizontal',
        side: 'south',
        start: { x: cell.x, z: cell.z + 1 },
        end: { x: cell.x + 1, z: cell.z + 1 },
      });
    }
    if (!open.has(proofCellKey(cell.x - 1, cell.z))) {
      add({
        key: `v:${cell.x}:${cell.z}`,
        x: cell.x,
        z: cell.z + 0.5,
        axis: 'vertical',
        side: 'west',
        start: { x: cell.x, z: cell.z },
        end: { x: cell.x, z: cell.z + 1 },
      });
    }
  }
  return [...edges.values()];
}

export function boundaryVertices(edges: BoundaryEdge[]): Array<{ x: number; z: number }> {
  const vertices = new Map<string, { point: { x: number; z: number }; axes: BoundaryEdge['axis'][] }>();
  for (const edge of edges) {
    for (const point of [edge.start, edge.end]) {
      const key = proofCellKey(point.x, point.z);
      const vertex = vertices.get(key) ?? { point, axes: [] };
      vertex.axes.push(edge.axis);
      vertices.set(key, vertex);
    }
  }
  return [...vertices.values()]
    .filter(({ axes }) => axes.length !== 2 || axes[0] !== axes[1])
    .map(({ point }) => point);
}

export function roomsConnected(cells: ProofCell[]): boolean {
  const start = { x: 4, z: 11 };
  const target = proofCellKey(14, 4);
  return reachableCellKeys(cells, start).has(target);
}

export function reachableCellKeys(
  cells: ProofCell[],
  start = { x: 4, z: 11 },
): Set<string> {
  const open = new Set(cells.map((cell) => proofCellKey(cell.x, cell.z)));
  const queue = [start];
  const visited = new Set([proofCellKey(start.x, start.z)]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbour of [
      { x: current.x, z: current.z - 1 },
      { x: current.x + 1, z: current.z },
      { x: current.x, z: current.z + 1 },
      { x: current.x - 1, z: current.z },
    ]) {
      const key = proofCellKey(neighbour.x, neighbour.z);
      if (!open.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push(neighbour);
    }
  }
  return visited;
}

export function digFrontier(cells: ProofCell[]): Array<{ x: number; z: number }> {
  const open = new Set(cells.map((cell) => proofCellKey(cell.x, cell.z)));
  const reachable = reachableCellKeys(cells);
  const frontier = new Map<string, { x: number; z: number }>();
  for (const key of reachable) {
    const [x, z] = key.split(',').map(Number);
    for (const neighbour of [
      { x, z: z - 1 },
      { x: x + 1, z },
      { x, z: z + 1 },
      { x: x - 1, z },
    ]) {
      const neighbourKey = proofCellKey(neighbour.x, neighbour.z);
      if (
        neighbour.x < PROOF_BOUNDS.minX
        || neighbour.x > PROOF_BOUNDS.maxX
        || neighbour.z < PROOF_BOUNDS.minZ
        || neighbour.z > PROOF_BOUNDS.maxZ
        || open.has(neighbourKey)
      ) continue;
      frontier.set(neighbourKey, neighbour);
    }
  }
  return [...frontier.values()];
}

export function findOpenPath(
  cells: ProofCell[],
  start = { x: 4, z: 11 },
  target = { x: 14, z: 4 },
): Array<{ x: number; z: number }> {
  const open = new Set(cells.map((cell) => proofCellKey(cell.x, cell.z)));
  const startKey = proofCellKey(start.x, start.z);
  const targetKey = proofCellKey(target.x, target.z);
  const queue = [start];
  const previous = new Map<string, string | undefined>([[startKey, undefined]]);
  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentKey = proofCellKey(current.x, current.z);
    if (currentKey === targetKey) break;
    for (const neighbour of [
      { x: current.x, z: current.z - 1 },
      { x: current.x + 1, z: current.z },
      { x: current.x, z: current.z + 1 },
      { x: current.x - 1, z: current.z },
    ]) {
      const key = proofCellKey(neighbour.x, neighbour.z);
      if (!open.has(key) || previous.has(key)) continue;
      previous.set(key, currentKey);
      queue.push(neighbour);
    }
  }
  if (!previous.has(targetKey)) return [];
  const path: Array<{ x: number; z: number }> = [];
  let cursor: string | undefined = targetKey;
  while (cursor) {
    const [x, z] = cursor.split(',').map(Number);
    path.push({ x, z });
    cursor = previous.get(cursor);
  }
  return path.reverse();
}

export function createGeometryProofLayout(stage: ProofStage): GeometryProofLayout {
  const cells = new Map<string, ProofCell>();
  addRect(cells, 2, 7, 9, 13, 'start');
  addRect(cells, 12, 17, 2, 6, 'target');
  if (stage >= 1) addCells(cells, VERTICAL_DIG, 'corridor');
  if (stage >= 2) addCells(cells, HORIZONTAL_DIG, 'corridor');
  const cellList = [...cells.values()];
  const edges = buildBoundaryEdges(cellList);
  const actorPath = stage === 0
    ? [{ x: 3.5, z: 11.5 }, { x: 6.5, z: 11.5 }, { x: 6.5, z: 12.5 }, { x: 3.5, z: 12.5 }]
    : stage === 1
      ? [{ x: 4.5, z: 11.5 }, { x: 5.5, z: 9.5 }, { x: 5.5, z: 4.5 }, { x: 5.5, z: 9.5 }]
      : [{ x: 4.5, z: 11.5 }, { x: 5.5, z: 9.5 }, { x: 5.5, z: 4.5 }, { x: 14.5, z: 4.5 }, { x: 5.5, z: 4.5 }];
  return {
    stage,
    cells: cellList,
    edges,
    vertices: boundaryVertices(edges),
    nextDig: stage === 0 ? VERTICAL_DIG : stage === 1 ? HORIZONTAL_DIG : [],
    actorPath,
    connected: roomsConnected(cellList),
  };
}

export function boundaryDifference(first: BoundaryEdge[], second: BoundaryEdge[]): Set<string> {
  const firstKeys = new Set(first.map((edge) => edge.key));
  const secondKeys = new Set(second.map((edge) => edge.key));
  return new Set([
    ...[...firstKeys].filter((key) => !secondKeys.has(key)),
    ...[...secondKeys].filter((key) => !firstKeys.has(key)),
  ]);
}
