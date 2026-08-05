import type { GridPoint } from './Grid';
import type { ItemKind, RoomKind, ToolKind, UnitKind } from '../data/definitions';

export interface AutomationOptions {
  enabled: boolean;
  seed: number;
}

export interface AutomationWorldTarget {
  id: string;
  label: string;
  status: string;
  x: number;
  y: number;
  discovered: boolean;
  claimed: boolean;
}

/**
 * Canonical, renderer-neutral projection of the real GameScene state.
 *
 * GameScene owns all gameplay rules. Alternative renderers may consume this
 * contract, but must never use it to grow a parallel simulation.
 */
export interface AutomationState {
  version: 1;
  seed: number;
  started: boolean;
  outcome: 'not-started' | 'playing' | 'victory' | 'defeat';
  elapsed: number;
  speed: 0 | 1 | 2;
  frameLoopRunning: boolean;
  phase: number;
  tool: ToolKind;
  objective: {
    title: string;
    body: string;
    checklist: Array<{ label: string; done: boolean }>;
  };
  heart: { hp: number; maxHp: number };
  stock: Record<ItemKind, number>;
  workers: Array<{
    id: number;
    x: number;
    y: number;
    state: string;
    jobId?: string;
    idleReason?: string;
    carry?: { kind: ItemKind; amount: number };
  }>;
  units: Array<{ id: number; kind: UnitKind; x: number; y: number; hp: number; hungry: boolean }>;
  enemies: Array<{ id: number; kind: string; x: number; y: number; hp: number; active: boolean }>;
  rooms: Array<{
    id: number;
    kind: RoomKind;
    x: number;
    y: number;
    w: number;
    h: number;
    complete: boolean;
    inputStored: number;
  }>;
  items: Array<{ id: number; kind: ItemKind; amount: number; x: number; y: number; location: string }>;
  targets: AutomationWorldTarget[];
  knownTiles: Array<{
    x: number;
    y: number;
    geology: 'solid' | 'excavated';
    visibility: 'charted' | 'revealed';
    control: 'neutral' | 'claiming' | 'owned' | 'enemy';
    construction: 'none' | 'planned' | 'building' | 'complete';
  }>;
  camera: { scrollX: number; scrollY: number; zoom: number };
  available: {
    summonWorker?: string;
    recruit: Record<'guard' | 'archer' | 'hexbinder', string | undefined>;
    tools: Partial<Record<ToolKind, string>>;
  };
}

/** Preferred name at renderer boundaries. Kept as an alias so the automation
 * and browser-test API remain backwards compatible. */
export type CanonicalGameState = AutomationState;

export interface AutomationActionResult {
  ok: boolean;
  action: string;
  reason?: string;
  state: AutomationState;
}

export interface HollowAgentApi {
  readonly version: 1;
  readonly seed: number;
  start(): AutomationActionResult;
  getState(): AutomationState;
  selectTool(tool: ToolKind): AutomationActionResult;
  planDig(start: GridPoint, end: GridPoint, horizontalFirst?: boolean): AutomationActionResult;
  placeRoom(kind: RoomKind, start: GridPoint, end: GridPoint): AutomationActionResult;
  summonWorker(): AutomationActionResult;
  recruit(kind: Exclude<UnitKind, 'inquisitor'>): AutomationActionResult;
  setSpeed(speed: 0 | 1 | 2): AutomationActionResult;
  setFrameLoop(enabled: boolean): AutomationActionResult;
  step(ticks?: number): AutomationActionResult;
  focusTarget(id: string): AutomationActionResult;
  reset(options?: { seed?: number }): void;
}

declare global {
  interface Window {
    hollowAgent?: HollowAgentApi;
  }
}

export function parseAutomationOptions(search: string): AutomationOptions {
  const params = new URLSearchParams(search);
  const seedParam = params.get('seed');
  const rawSeed = seedParam === null || seedParam.trim() === '' ? Number.NaN : Number(seedParam);
  return {
    enabled: params.has('automation'),
    seed: Number.isSafeInteger(rawSeed) && rawSeed >= 0 ? rawSeed : 1337,
  };
}

export function installAutomationBridge(api: HollowAgentApi): () => void {
  Object.defineProperty(window, 'hollowAgent', {
    configurable: true,
    enumerable: false,
    value: Object.freeze(api),
  });
  window.dispatchEvent(new CustomEvent('hollow:agent-ready', {
    detail: { version: api.version, seed: api.seed },
  }));
  document.documentElement.dataset.automationReady = String(api.version);
  document.documentElement.dataset.automationSeed = String(api.seed);
  return () => {
    delete window.hollowAgent;
    delete document.documentElement.dataset.automationReady;
    delete document.documentElement.dataset.automationSeed;
  };
}
