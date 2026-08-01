import { architectureTransition, type TerrainArchitecture } from '../../core/TerrainArchitecture';
import {
  architecturePriority,
  wallEdgeFrame,
  wallJoint,
  wallJointFrame,
  wallSides,
  type WallJoint,
  type WallQuadrant,
} from '../../core/WallLayout';

export type WallFamily = 'built' | 'fortified' | 'natural' | 'corridor';
export type SpecimenFamily = WallFamily;

export interface GauntletCell {
  x: number;
  z: number;
  architecture: TerrainArchitecture;
  specimen: boolean;
}

export interface JointSpecimen {
  label: string;
  x: number;
  z: number;
  expectedFrame: number;
}

export interface EdgeModule {
  kind: 'edge';
  x: number;
  z: number;
  frame: number;
  family: WallFamily;
}

export interface JointModule {
  kind: 'joint';
  x: number;
  z: number;
  frame: number;
  family: WallFamily;
  joint: WallJoint;
}

export interface ThresholdModule {
  kind: 'threshold';
  x: number;
  z: number;
  frame: number;
  family: 'built' | 'natural';
}

export type GauntletModule = EdgeModule | JointModule | ThresholdModule;

export interface GauntletLayout {
  cells: GauntletCell[];
  modules: GauntletModule[];
  specimens: JointSpecimen[];
  actorPath: Array<{ x: number; z: number }>;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  dynamicCrossOpen: boolean;
}

const cellKey = (x: number, z: number): string => `${x},${z}`;

export function architectureFamily(architecture: TerrainArchitecture): WallFamily {
  if (architecture === 'built-room') return 'built';
  if (architecture === 'fortified-chamber') return 'fortified';
  if (architecture === 'natural-cavern') return 'natural';
  return 'corridor';
}

function specimenArchitecture(family: SpecimenFamily): TerrainArchitecture {
  if (family === 'built') return 'built-room';
  if (family === 'fortified') return 'fortified-chamber';
  if (family === 'natural') return 'natural-cavern';
  return 'corridor';
}

function addRect(
  cells: Map<string, GauntletCell>,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  architecture: TerrainArchitecture,
  specimen = false,
): void {
  for (let z = z0; z <= z1; z += 1) {
    for (let x = x0; x <= x1; x += 1) {
      cells.set(cellKey(x, z), { x, z, architecture, specimen });
    }
  }
}

function specimenOpenQuadrants(joint: WallJoint): WallQuadrant[] {
  const quadrants: WallQuadrant[] = ['northWest', 'northEast', 'southEast', 'southWest'];
  if (joint.kind === 'convex') return [joint.quadrant];
  if (joint.kind === 'concave') return quadrants.filter((quadrant) => quadrant !== joint.quadrant);
  return joint.diagonal === 'northWestSouthEast'
    ? ['northWest', 'southEast']
    : ['northEast', 'southWest'];
}

function addJointSpecimen(
  cells: Map<string, GauntletCell>,
  specimens: JointSpecimen[],
  originX: number,
  originZ: number,
  joint: WallJoint,
  architecture: TerrainArchitecture,
): void {
  const positions: Record<WallQuadrant, { x: number; z: number }> = {
    northWest: { x: originX, z: originZ },
    northEast: { x: originX + 1, z: originZ },
    southEast: { x: originX + 1, z: originZ + 1 },
    southWest: { x: originX, z: originZ + 1 },
  };
  for (const quadrant of specimenOpenQuadrants(joint)) {
    const position = positions[quadrant];
    cells.set(cellKey(position.x, position.z), {
      ...position,
      architecture,
      specimen: true,
    });
  }
  const label = joint.kind === 'diagonal'
    ? joint.diagonal === 'northWestSouthEast' ? 'Diagonal \\' : 'Diagonal /'
    : `${joint.kind === 'convex' ? 'Außen' : 'Innen'} ${joint.quadrant.replace(/([A-Z])/g, ' $1')}`;
  specimens.push({
    label,
    x: originX + 1,
    z: originZ + 1,
    expectedFrame: wallJointFrame(joint),
  });
}

export function buildGauntletModules(cells: GauntletCell[]): GauntletModule[] {
  const map = new Map(cells.map((cell) => [cellKey(cell.x, cell.z), cell]));
  const isOpen = (x: number, z: number): boolean => map.has(cellKey(x, z));
  const modules: GauntletModule[] = [];

  for (const cell of cells) {
    const sides = wallSides({
      north: !isOpen(cell.x, cell.z - 1),
      east: !isOpen(cell.x + 1, cell.z),
      south: !isOpen(cell.x, cell.z + 1),
      west: !isOpen(cell.x - 1, cell.z),
    });
    for (const side of sides) {
      modules.push({
        kind: 'edge',
        x: side === 'east' ? cell.x + 1 : side === 'west' ? cell.x : cell.x + 0.5,
        z: side === 'south' ? cell.z + 1 : side === 'north' ? cell.z : cell.z + 0.5,
        frame: wallEdgeFrame(side),
        family: architectureFamily(cell.architecture),
      });
    }
  }

  const minX = Math.min(...cells.map((cell) => cell.x));
  const maxX = Math.max(...cells.map((cell) => cell.x));
  const minZ = Math.min(...cells.map((cell) => cell.z));
  const maxZ = Math.max(...cells.map((cell) => cell.z));
  for (let z = minZ; z <= maxZ + 1; z += 1) {
    for (let x = minX; x <= maxX + 1; x += 1) {
      const vertexCells = {
        northWest: map.get(cellKey(x - 1, z - 1)),
        northEast: map.get(cellKey(x, z - 1)),
        southEast: map.get(cellKey(x, z)),
        southWest: map.get(cellKey(x - 1, z)),
      };
      const joint = wallJoint({
        northWest: Boolean(vertexCells.northWest),
        northEast: Boolean(vertexCells.northEast),
        southEast: Boolean(vertexCells.southEast),
        southWest: Boolean(vertexCells.southWest),
      });
      if (!joint) continue;
      const owner = Object.values(vertexCells)
        .filter((cell): cell is GauntletCell => Boolean(cell))
        .sort((first, second) => architecturePriority(second.architecture) - architecturePriority(first.architecture))[0];
      if (!owner) continue;
      modules.push({
        kind: 'joint',
        x,
        z,
        frame: wallJointFrame(joint),
        family: architectureFamily(owner.architecture),
        joint,
      });
    }
  }

  for (const cell of cells) {
    for (const side of ['east', 'south'] as const) {
      const neighbour = map.get(cellKey(
        side === 'east' ? cell.x + 1 : cell.x,
        side === 'south' ? cell.z + 1 : cell.z,
      ));
      if (!neighbour) continue;
      const destination = architectureTransition(cell.architecture, neighbour.architecture);
      if (!destination) continue;
      modules.push({
        kind: 'threshold',
        x: side === 'east' ? cell.x + 1 : cell.x + 0.5,
        z: side === 'south' ? cell.z + 1 : cell.z + 0.5,
        frame: wallEdgeFrame(side),
        family: destination === 'natural-cavern' ? 'natural' : 'built',
      });
    }
  }

  return modules;
}

export function createWallGauntletLayout(
  family: SpecimenFamily = 'built',
  dynamicCrossOpen = false,
): GauntletLayout {
  const cells = new Map<string, GauntletCell>();
  const specimens: JointSpecimen[] = [];
  const architecture = specimenArchitecture(family);
  const specimenJoints: WallJoint[] = [
    { kind: 'convex', quadrant: 'northWest' },
    { kind: 'convex', quadrant: 'northEast' },
    { kind: 'convex', quadrant: 'southEast' },
    { kind: 'convex', quadrant: 'southWest' },
    { kind: 'diagonal', diagonal: 'northWestSouthEast' },
    { kind: 'concave', quadrant: 'northWest' },
    { kind: 'concave', quadrant: 'northEast' },
    { kind: 'concave', quadrant: 'southEast' },
    { kind: 'concave', quadrant: 'southWest' },
    { kind: 'diagonal', diagonal: 'northEastSouthWest' },
  ];
  specimenJoints.forEach((joint, index) => {
    addJointSpecimen(cells, specimens, 1 + (index % 5) * 5, index < 5 ? 1 : 5, joint, architecture);
  });

  // One compact assembly below the specimen board: room, one-tile run, X/T/L,
  // two-tile run and both authored architecture thresholds.
  addRect(cells, 1, 6, 11, 15, 'built-room');
  addRect(cells, 7, 18, 13, 13, 'corridor');
  addRect(cells, 11, 11, 9, 18, 'corridor');
  addRect(cells, 15, 15, 14, 16, 'corridor');
  addRect(cells, 10, 16, 17, 18, 'corridor');
  addRect(cells, 9, 13, 19, 21, 'fortified-chamber');
  if (dynamicCrossOpen) cells.set(cellKey(15, 12), {
    x: 15,
    z: 12,
    architecture: 'corridor',
    specimen: false,
  });

  for (let z = 10; z <= 16; z += 1) {
    for (let x = 19; x <= 25; x += 1) {
      const dx = (x - 22) / 3.6;
      const dz = (z - 13) / 3.4;
      if (dx * dx + dz * dz <= 1.05) {
        cells.set(cellKey(x, z), { x, z, architecture: 'natural-cavern', specimen: false });
      }
    }
  }

  const cellList = [...cells.values()];
  return {
    cells: cellList,
    modules: buildGauntletModules(cellList),
    specimens,
    actorPath: [
      { x: 3.5, z: 15.55 },
      { x: 3.5, z: 13.5 },
      { x: 7.5, z: 13.5 },
      { x: 11.5, z: 13.5 },
      { x: 15.5, z: 13.5 },
      { x: 18.5, z: 13.5 },
      { x: 22.5, z: 13.5 },
      { x: 18.5, z: 13.5 },
      { x: 15.5, z: 13.5 },
      { x: 15.5, z: 17.5 },
      { x: 12.5, z: 18.5 },
      { x: 11.5, z: 20.5 },
      { x: 12.5, z: 18.5 },
      { x: 11.5, z: 13.5 },
      { x: 11.5, z: 9.5 },
      { x: 11.5, z: 13.5 },
      { x: 3.5, z: 13.5 },
    ],
    bounds: { minX: 0, maxX: 27, minZ: 0, maxZ: 22 },
    dynamicCrossOpen,
  };
}

export function topologyDegrees(cells: GauntletCell[]): Map<string, number> {
  const open = new Set(cells.map((cell) => cellKey(cell.x, cell.z)));
  return new Map(cells.map((cell) => [
    cellKey(cell.x, cell.z),
    [
      cellKey(cell.x, cell.z - 1),
      cellKey(cell.x + 1, cell.z),
      cellKey(cell.x, cell.z + 1),
      cellKey(cell.x - 1, cell.z),
    ].filter((key) => open.has(key)).length,
  ]));
}
