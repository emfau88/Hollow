import type { CanonicalGameState } from '../../core/AutomationBridge';
import type { ItemKind, RoomKind, UnitKind } from '../../data/definitions';
import {
  DWARF_CHAMBER,
  FUNGUS_CHAMBER,
  IRON_CHAMBER,
  SHRINE_CHAMBER,
  STARTING_CHAMBER,
  architectureForMapCell,
  tileKey,
} from './IntegrationModel';

type KnownTile = CanonicalGameState['knownTiles'][number];
type Room = CanonicalGameState['rooms'][number];

/**
 * Read-only render fixture expressed entirely in the canonical GameScene
 * projection. It deliberately contains no update logic or gameplay rules.
 */
export function createCampaignEvaluationState(base: CanonicalGameState): CanonicalGameState {
  const rooms: Room[] = [
    room(1, 'storage', 26, 33, 3, 2),
    room(2, 'kitchen', 20, 31, 4, 4, 6),
    room(3, 'smelter', 19, 37, 4, 4, 5),
    room(4, 'workshop', 41, 24, 4, 4, 4),
    room(5, 'bedroom', 42, 40, 4, 3),
    room(6, 'prison', 10, 30, 4, 4),
  ];
  const tiles = new Map<string, KnownTile>();

  const addRect = (rect: { x: number; y: number; w: number; h: number }): void => {
    for (let y = rect.y; y < rect.y + rect.h; y += 1) {
      for (let x = rect.x; x < rect.x + rect.w; x += 1) addOpenTile(tiles, x, y, rooms);
    }
  };
  const addPath = (points: Array<{ x: number; y: number }>, width = 1): void => {
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      const dx = Math.sign(end.x - start.x);
      const dy = Math.sign(end.y - start.y);
      const length = Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y));
      for (let step = 0; step <= length; step += 1) {
        for (let lane = 0; lane < width; lane += 1) {
          addOpenTile(tiles, start.x + dx * step + (dy === 0 ? 0 : lane), start.y + dy * step + (dx === 0 ? 0 : lane), rooms);
        }
      }
    }
  };

  [STARTING_CHAMBER, FUNGUS_CHAMBER, IRON_CHAMBER, DWARF_CHAMBER, SHRINE_CHAMBER, ...rooms].forEach(addRect);

  // Central one-cell network with T and cross junctions.
  addPath([{ x: 13, y: 32 }, { x: 25, y: 32 }]);
  addPath([{ x: 24, y: 28 }, { x: 24, y: 36 }]);
  addPath([{ x: 13, y: 28 }, { x: 13, y: 32 }]);
  addPath([{ x: 13, y: 29 }, { x: 17, y: 29 }, { x: 17, y: 28 }]);
  addPath([{ x: 21, y: 34 }, { x: 21, y: 37 }]);

  // East branch proves the normal one-field corridor at full map scale.
  addPath([{ x: 39, y: 34 }, { x: 47, y: 34 }]);
  addPath([{ x: 39, y: 26 }, { x: 41, y: 26 }]);
  addPath([{ x: 43, y: 24 }, { x: 43, y: 20 }, { x: 45, y: 20 }]);
  addPath([{ x: 37, y: 37 }, { x: 37, y: 39 }, { x: 43, y: 39 }, { x: 43, y: 40 }]);

  // A short two-wide junction gives a direct comparison without changing the
  // regular one-cell rule.
  addPath([{ x: 31, y: 37 }, { x: 31, y: 42 }, { x: 41, y: 42 }], 2);
  addPath([{ x: 22, y: 39 }, { x: 19, y: 39 }]);

  return {
    ...base,
    started: true,
    outcome: 'playing',
    elapsed: 498,
    speed: 0,
    frameLoopRunning: false,
    phase: 5,
    tool: 'pan',
    objective: {
      title: 'Kampagnen-Renderprüfung',
      body: 'Großer, repräsentativer Stand im kanonischen Zustandsformat.',
      checklist: [
        { label: 'Mehrere Raumtypen', done: true },
        { label: 'Ein-Feld-Gänge und Kreuzungen', done: true },
        { label: 'Ressourcen, Einheiten und Gegner', done: true },
      ],
    },
    heart: { hp: 86, maxHp: 100 },
    stock: { ore: 18, biomass: 14, essence: 9, metal: 8, ration: 12, armour: 5 },
    workers: [
      worker(1, 29.2, 31.7, 'haul', 'Lager auffüllen', 'ore', 2),
      worker(2, 22.1, 32.4, 'work', 'Pilzküche'),
      worker(3, 20.5, 38.4, 'work', 'Schmelze'),
      worker(4, 36.4, 34.2, 'move', 'Ostgang'),
      worker(5, 48.8, 35.6, 'harvest', 'Pilzgrotte', 'biomass', 1),
      worker(6, 17.4, 40.3, 'mine', 'Eisenader', 'ore', 1),
      worker(7, 43.2, 25.8, 'work', 'Werkstatt'),
      worker(8, 43.5, 41.4, 'idle'),
    ],
    units: [
      unit(101, 'guard', 38.2, 32.8, 92),
      unit(102, 'guard', 15.1, 31.8, 78),
      unit(103, 'archer', 46.1, 33.8, 54),
      unit(104, 'archer', 44.1, 20.2, 60),
      unit(105, 'hexbinder', 36.1, 29.2, 48),
      unit(106, 'inquisitor', 14.4, 30.6, 104),
    ],
    enemies: [
      enemy(201, 'crawler', 50.2, 36.1, 28),
      enemy(202, 'crawler', 53.1, 33.4, 32),
      enemy(203, 'dwarf', 12.2, 24.1, 58),
      enemy(204, 'dwarf', 15.2, 26.1, 62),
      enemy(205, 'crossbow', 13.2, 27.1, 42),
      enemy(206, 'adept', 47.2, 17.2, 50),
      enemy(207, 'adept', 50.3, 18.1, 44),
      enemy(208, 'captain', 49.1, 15.5, 112),
    ],
    rooms,
    items: [
      item(301, 'ore', 4, 27.2, 33.2, 'storage'),
      item(302, 'metal', 3, 28.1, 34.1, 'storage'),
      item(303, 'ration', 3, 22.4, 33.5, 'room'),
      item(304, 'biomass', 3, 49.4, 37.1, 'ground'),
      item(305, 'biomass', 2, 53.1, 37.5, 'ground'),
      item(306, 'ore', 3, 16.4, 41.4, 'ground'),
      item(307, 'ore', 2, 18.2, 39.2, 'ground'),
      item(308, 'essence', 2, 48.2, 18.2, 'ground'),
      item(309, 'armour', 2, 43.2, 26.6, 'room'),
    ],
    targets: [
      target('iron', 'Eisenader', 17, 41, true, true),
      target('fungus', 'Pilzgrotte', 51, 35, true, true),
      target('dwarf', 'Zwergenposten', 14, 25, true, false),
      target('shrine', 'Inquisitorenschrein', 49, 17, true, false),
    ],
    knownTiles: [...tiles.values()].sort((a, b) => a.y - b.y || a.x - b.x),
  };
}

function room(id: number, kind: RoomKind, x: number, y: number, w: number, h: number, inputStored = 0): Room {
  return { id, kind, x, y, w, h, complete: true, inputStored };
}

function addOpenTile(
  tiles: Map<string, KnownTile>,
  x: number,
  y: number,
  rooms: CanonicalGameState['rooms'],
): void {
  const zone = architectureForMapCell(x, y, { rooms });
  const hostile = [DWARF_CHAMBER, SHRINE_CHAMBER].some((rect) => (
    x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h
  ));
  tiles.set(tileKey(x, y), {
    x,
    y,
    geology: 'excavated',
    visibility: 'revealed',
    control: hostile ? 'enemy' : zone === 'natural' ? 'neutral' : 'owned',
    construction: zone === 'built' ? 'complete' : 'none',
  });
}

function worker(
  id: number,
  x: number,
  y: number,
  state: string,
  jobId?: string,
  carryKind?: ItemKind,
  carryAmount = 0,
): CanonicalGameState['workers'][number] {
  return { id, x, y, state, jobId, carry: carryKind ? { kind: carryKind, amount: carryAmount } : undefined };
}

function unit(
  id: number,
  kind: UnitKind,
  x: number,
  y: number,
  hp: number,
): CanonicalGameState['units'][number] {
  return { id, kind, x, y, hp, hungry: false };
}

function enemy(
  id: number,
  kind: string,
  x: number,
  y: number,
  hp: number,
): CanonicalGameState['enemies'][number] {
  return { id, kind, x, y, hp, active: true };
}

function item(
  id: number,
  kind: ItemKind,
  amount: number,
  x: number,
  y: number,
  location: string,
): CanonicalGameState['items'][number] {
  return { id, kind, amount, x, y, location };
}

function target(
  id: string,
  label: string,
  x: number,
  y: number,
  discovered: boolean,
  claimed: boolean,
): CanonicalGameState['targets'][number] {
  return { id, label, status: claimed ? 'gesichert' : 'entdeckt', x, y, discovered, claimed };
}
