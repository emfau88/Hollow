import { describe, expect, it } from 'vitest';
import type { AutomationState } from '../src/core/AutomationBridge';
import { createCampaignEvaluationState } from '../src/prototypes/spatial/CampaignEvaluationState';
import {
  CAMPAIGN_EVALUATION_SLICE,
  FUNGUS_CHAMBER,
  INTEGRATION_SLICE,
  architectureForMapCell,
  knownTileMap,
  mapToWorld,
  snapshotToSpatialCells,
  terrainSignature,
  tileKey,
  tutorialRouteProgress,
} from '../src/prototypes/spatial/IntegrationModel';

type KnownTile = AutomationState['knownTiles'][number];

function tile(
  x: number,
  y: number,
  geology: KnownTile['geology'] = 'excavated',
  control: KnownTile['control'] = 'neutral',
): KnownTile {
  return {
    x,
    y,
    geology,
    control,
    visibility: 'revealed',
    construction: 'none',
  };
}

function state(
  knownTiles: KnownTile[],
  workers: AutomationState['workers'] = [],
): AutomationState {
  return { knownTiles, workers } as AutomationState;
}

describe('spatial integration model', () => {
  it('maps the game slice to a stable Three.js origin', () => {
    expect(mapToWorld(INTEGRATION_SLICE.originX, INTEGRATION_SLICE.originY)).toEqual({ x: 0, z: 0 });
    expect(mapToWorld(32, 30)).toEqual({ x: -8, z: -3.5 });
  });

  it('keeps the headquarters, connecting tunnel and grotto architecturally distinct', () => {
    expect(architectureForMapCell(32, 30)).toBe('built');
    expect(architectureForMapCell(43, 34)).toBe('corridor');
    expect(architectureForMapCell(51, 35)).toBe('natural');
  });

  it('turns only excavated, in-slice simulation tiles into open renderer cells', () => {
    const cells = snapshotToSpatialCells(state([
      tile(32, 30, 'excavated', 'owned'),
      tile(43, 34, 'solid'),
      tile(INTEGRATION_SLICE.maxX + 1, 30),
    ]));

    expect(cells).toHaveLength(1);
    expect(cells[0]).toMatchObject({ mapX: 32, mapY: 30, zone: 'built', control: 'owned' });
  });

  it('invalidates terrain geometry when excavation or ownership changes', () => {
    const solid = state([tile(40, 34, 'solid')]);
    const open = state([tile(40, 34, 'excavated')]);
    const claimed = state([tile(40, 34, 'excavated', 'owned')]);

    expect(terrainSignature(solid)).not.toBe(terrainSignature(open));
    expect(terrainSignature(open)).not.toBe(terrainSignature(claimed));
  });

  it('does not rebuild terrain for control states with the same visible floor', () => {
    const claiming = state([tile(40, 34, 'excavated', 'claiming')]);
    const owned = state([tile(40, 34, 'excavated', 'owned')]);

    expect(terrainSignature(claiming)).toBe(terrainSignature(owned));
  });

  it('reports real route opening and worker arrival separately', () => {
    const routeTiles = Array.from({ length: 7 }, (_, index) => tile(40 + index, 34));
    const connected = tutorialRouteProgress(state(routeTiles));
    const arrived = tutorialRouteProgress(state(routeTiles, [{
      id: 1,
      x: FUNGUS_CHAMBER.x + 1,
      y: FUNGUS_CHAMBER.y + 1,
      state: 'move',
    }]));

    expect(connected).toMatchObject({ opened: 7, total: 7, connected: true, workerInGrotto: false });
    expect(arrived.workerInGrotto).toBe(true);
  });

  it('projects completed canonical rooms as built architecture', () => {
    const roomState = state([tile(20, 31)]);
    roomState.rooms = [{ id: 1, kind: 'kitchen', x: 20, y: 31, w: 4, h: 4, complete: true, inputStored: 0 }];

    expect(architectureForMapCell(20, 31, roomState)).toBe('built');
    expect(snapshotToSpatialCells(roomState, CAMPAIGN_EVALUATION_SLICE)[0]?.zone).toBe('built');
  });

  it('builds a representative read-only campaign fixture in the canonical contract', () => {
    const base = {
      version: 1,
      seed: 1337,
      rooms: [],
      knownTiles: [],
      workers: [],
      units: [],
      enemies: [],
      items: [],
      targets: [],
    } as unknown as AutomationState;
    const evaluation = createCampaignEvaluationState(base);
    const tiles = knownTileMap(evaluation);

    expect(base.knownTiles).toEqual([]);
    expect(evaluation.version).toBe(1);
    expect(new Set(evaluation.rooms.map((room) => room.kind))).toEqual(new Set([
      'storage', 'bedroom', 'kitchen', 'smelter', 'workshop', 'prison',
    ]));
    expect(evaluation.workers.length).toBeGreaterThanOrEqual(8);
    expect(evaluation.units.length).toBeGreaterThanOrEqual(6);
    expect(evaluation.enemies.length).toBeGreaterThanOrEqual(8);
    expect(evaluation.items.length).toBeGreaterThanOrEqual(8);
    expect(evaluation.targets.map((target) => target.id)).toEqual(['iron', 'fungus', 'dwarf', 'shrine']);
    expect(Array.from({ length: 8 }, (_, index) => tiles.get(tileKey(40 + index, 34))?.geology)).toEqual(
      Array.from({ length: 8 }, () => 'excavated'),
    );
    expect(snapshotToSpatialCells(evaluation, CAMPAIGN_EVALUATION_SLICE).length).toBeGreaterThan(400);
  });
});
