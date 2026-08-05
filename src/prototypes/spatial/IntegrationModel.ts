import type { CanonicalGameState } from '../../core/AutomationBridge';
import type { GridCell, SpatialZone } from './layout';

export interface SpatialProjection {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  originX: number;
  originY: number;
}

export const INTEGRATION_SLICE: SpatialProjection = {
  minX: 22,
  maxX: 59,
  minY: 21,
  maxY: 43,
  originX: 40,
  originY: 33.5,
};

export const CAMPAIGN_EVALUATION_SLICE: SpatialProjection = {
  minX: 8,
  maxX: 59,
  minY: 12,
  maxY: 45,
  originX: 33.5,
  originY: 28.5,
};

export const STARTING_CHAMBER = { x: 25, y: 25, w: 15, h: 13 } as const;
export const FUNGUS_CHAMBER = { x: 47, y: 31, w: 9, h: 9 } as const;
export const IRON_CHAMBER = { x: 15, y: 38, w: 5, h: 6 } as const;
export const DWARF_CHAMBER = { x: 10, y: 22, w: 8, h: 7 } as const;
export const SHRINE_CHAMBER = { x: 45, y: 14, w: 8, h: 7 } as const;
export const HEART_TILE = { x: 32, y: 30 } as const;
export const FUNGUS_TILE = { x: 51, y: 35 } as const;
export const TUTORIAL_ROUTE = {
  start: { x: 39, y: 34 },
  end: { x: 47, y: 34 },
  solidCells: Array.from({ length: 7 }, (_, index) => ({ x: 40 + index, y: 34 })),
} as const;

export interface IntegratedCell extends GridCell {
  mapX: number;
  mapY: number;
  control: CanonicalGameState['knownTiles'][number]['control'];
  visibility: CanonicalGameState['knownTiles'][number]['visibility'];
}

export function mapToWorld(
  x: number,
  y: number,
  projection: SpatialProjection = INTEGRATION_SLICE,
): { x: number; z: number } {
  return {
    x: x - projection.originX,
    z: y - projection.originY,
  };
}

export function insideRect(
  x: number,
  y: number,
  rect: { x: number; y: number; w: number; h: number },
): boolean {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

export function architectureForMapCell(
  x: number,
  y: number,
  state?: Pick<CanonicalGameState, 'rooms'>,
): SpatialZone {
  if (insideRect(x, y, STARTING_CHAMBER)) return 'built';
  if (state?.rooms?.some((room) => room.complete && insideRect(x, y, room))) return 'built';
  if ([FUNGUS_CHAMBER, IRON_CHAMBER, DWARF_CHAMBER, SHRINE_CHAMBER].some((rect) => insideRect(x, y, rect))) {
    return 'natural';
  }
  return 'corridor';
}

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function knownTileMap(state: CanonicalGameState): Map<string, CanonicalGameState['knownTiles'][number]> {
  return new Map(state.knownTiles.map((tile) => [tileKey(tile.x, tile.y), tile]));
}

export function snapshotToSpatialCells(
  state: CanonicalGameState,
  projection: SpatialProjection = INTEGRATION_SLICE,
): IntegratedCell[] {
  return state.knownTiles
    .filter((tile) => (
      tile.geology === 'excavated'
      && tile.x >= projection.minX
      && tile.x <= projection.maxX
      && tile.y >= projection.minY
      && tile.y <= projection.maxY
    ))
    .map((tile) => {
      const world = mapToWorld(tile.x, tile.y, projection);
      return {
        x: world.x,
        z: world.z,
        mapX: tile.x,
        mapY: tile.y,
        zone: architectureForMapCell(tile.x, tile.y, state),
        control: tile.control,
        visibility: tile.visibility,
      };
    });
}

export function terrainSignature(
  state: CanonicalGameState,
  projection: SpatialProjection = INTEGRATION_SLICE,
): string {
  return state.knownTiles
    .filter((tile) => (
      tile.x >= projection.minX
      && tile.x <= projection.maxX
      && tile.y >= projection.minY
      && tile.y <= projection.maxY
    ))
    .map((tile) => {
      if (tile.geology === 'solid') return `${tile.x},${tile.y}:solid`;
      const architecture = architectureForMapCell(tile.x, tile.y, state);
      const surface = architecture === 'built'
        ? 'built'
        : architecture === 'natural'
          ? 'natural'
          : tile.control === 'owned' || tile.control === 'claiming'
            ? 'claimed'
            : 'raw';
      return `${tile.x},${tile.y}:open:${surface}`;
    })
    .sort()
    .join('|');
}

export function tutorialRouteProgress(state: CanonicalGameState): {
  opened: number;
  total: number;
  connected: boolean;
  workerInGrotto: boolean;
} {
  const tiles = knownTileMap(state);
  const opened = TUTORIAL_ROUTE.solidCells.filter(
    (point) => tiles.get(tileKey(point.x, point.y))?.geology === 'excavated',
  ).length;
  return {
    opened,
    total: TUTORIAL_ROUTE.solidCells.length,
    connected: opened === TUTORIAL_ROUTE.solidCells.length,
    workerInGrotto: state.workers.some((worker) => insideRect(worker.x, worker.y, FUNGUS_CHAMBER)),
  };
}
