import type { AutomationState } from '../../core/AutomationBridge';
import type { GridCell, SpatialZone } from './layout';

export const INTEGRATION_SLICE = {
  minX: 22,
  maxX: 59,
  minY: 21,
  maxY: 43,
  originX: 40,
  originY: 33.5,
} as const;

export const STARTING_CHAMBER = { x: 25, y: 25, w: 15, h: 13 } as const;
export const FUNGUS_CHAMBER = { x: 47, y: 31, w: 9, h: 9 } as const;
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
  control: AutomationState['knownTiles'][number]['control'];
  visibility: AutomationState['knownTiles'][number]['visibility'];
}

export function mapToWorld(x: number, y: number): { x: number; z: number } {
  return {
    x: x - INTEGRATION_SLICE.originX,
    z: y - INTEGRATION_SLICE.originY,
  };
}

export function insideRect(
  x: number,
  y: number,
  rect: { x: number; y: number; w: number; h: number },
): boolean {
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

export function architectureForMapCell(x: number, y: number): SpatialZone {
  if (insideRect(x, y, STARTING_CHAMBER)) return 'built';
  if (insideRect(x, y, FUNGUS_CHAMBER)) return 'natural';
  return 'corridor';
}

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function knownTileMap(state: AutomationState): Map<string, AutomationState['knownTiles'][number]> {
  return new Map(state.knownTiles.map((tile) => [tileKey(tile.x, tile.y), tile]));
}

export function snapshotToSpatialCells(state: AutomationState): IntegratedCell[] {
  return state.knownTiles
    .filter((tile) => (
      tile.geology === 'excavated'
      && tile.x >= INTEGRATION_SLICE.minX
      && tile.x <= INTEGRATION_SLICE.maxX
      && tile.y >= INTEGRATION_SLICE.minY
      && tile.y <= INTEGRATION_SLICE.maxY
    ))
    .map((tile) => {
      const world = mapToWorld(tile.x, tile.y);
      return {
        x: world.x,
        z: world.z,
        mapX: tile.x,
        mapY: tile.y,
        zone: architectureForMapCell(tile.x, tile.y),
        control: tile.control,
        visibility: tile.visibility,
      };
    });
}

export function terrainSignature(state: AutomationState): string {
  return state.knownTiles
    .filter((tile) => (
      tile.x >= INTEGRATION_SLICE.minX
      && tile.x <= INTEGRATION_SLICE.maxX
      && tile.y >= INTEGRATION_SLICE.minY
      && tile.y <= INTEGRATION_SLICE.maxY
    ))
    .map((tile) => {
      if (tile.geology === 'solid') return `${tile.x},${tile.y}:solid`;
      const architecture = architectureForMapCell(tile.x, tile.y);
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

export function tutorialRouteProgress(state: AutomationState): {
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
