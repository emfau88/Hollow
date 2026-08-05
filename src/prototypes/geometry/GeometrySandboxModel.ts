import { ROOM_DEFINITIONS, RECIPES, type ItemKind, type RoomKind } from '../../data/definitions';
import {
  applyRecipe,
  bedroomCapacity,
  canStartRecipe,
  prisonCapacity,
  productionStations,
  roomCost,
  type Stock,
} from '../../core/GameRules';
import { proofCellKey, type ProofCell } from './GeometryProofModel';
import { DEFAULT_WORK_PRIORITIES, workerTaskOrder, type WorkPriorities } from '../../core/WorkerPriorities';

/**
 * @deprecated Presentation prototype only. The real GameScene and its
 * CanonicalGameState projection own gameplay. Do not add or mirror gameplay
 * features here; new geometry renderers consume CanonicalGameState instead.
 */

export const SANDBOX_BOUNDS = { minX: 0, maxX: 47, minZ: 0, maxZ: 31 } as const;
export const SANDBOX_HEART = { x: 7, z: 25 } as const;
export const SANDBOX_START = { x: 10, z: 27 } as const;
export const SANDBOX_HEART_RESERVED = new Set(
  Array.from({ length: 9 }, (_, index) => proofCellKey(6 + (index % 3), 24 + Math.floor(index / 3))),
);

export type SandboxDepositKind = 'iron' | 'fungus';

export interface SandboxDeposit {
  id: number;
  kind: SandboxDepositKind;
  x: number;
  z: number;
  remaining: number;
}

export interface SandboxRoom {
  id: number;
  kind: RoomKind;
  x: number;
  z: number;
  w: number;
  h: number;
  buildProgress: number;
}

export interface SandboxDiscoverySite {
  id: string;
  label: string;
  kind: 'fungus' | 'iron' | 'cache' | 'hostile' | 'shrine';
  x: number;
  z: number;
  w: number;
  h: number;
  entry: { x: number; z: number };
}

export interface SandboxEnemy {
  id: string;
  siteId: string;
  x: number;
  z: number;
  hp: number;
  maxHp: number;
  defeated: boolean;
}

export interface SandboxCreature {
  id: string;
  x: number;
  z: number;
  hunger: number;
  meals: number;
}

export interface SandboxKitchenFlow {
  inputBiomass: number;
  outputRations: number;
  rationsProduced: number;
  rationsFed: number;
}

export const SANDBOX_DISCOVERY_SITES: SandboxDiscoverySite[] = [
  { id: 'fungus-grotto', label: 'Leuchtende Pilzgrotte', kind: 'fungus', x: 20, z: 10, w: 7, h: 7, entry: { x: 23, z: 17 } },
  { id: 'iron-gallery', label: 'Alte Eisengalerie', kind: 'iron', x: 27, z: 17, w: 7, h: 6, entry: { x: 26, z: 20 } },
  { id: 'forgotten-cache', label: 'Vergessenes Vorratsgewölbe', kind: 'cache', x: 37, z: 7, w: 7, h: 6, entry: { x: 40, z: 13 } },
  { id: 'spore-garden', label: 'Versunkener Sporenhain', kind: 'fungus', x: 39, z: 22, w: 7, h: 6, entry: { x: 38, z: 24 } },
];

export interface SandboxState {
  openCells: Map<string, ProofCell>;
  claimedCells: Set<string>;
  plannedDig: Map<string, { x: number; z: number }>;
  discoveredSites: Set<string>;
  clearedSites: Set<string>;
  enemies: SandboxEnemy[];
  creature: SandboxCreature;
  kitchenFlow: SandboxKitchenFlow;
  rooms: SandboxRoom[];
  deposits: SandboxDeposit[];
  stock: Stock;
  minedIron: number;
  minedBiomass: number;
  produced: Record<'kitchen' | 'smelter' | 'workshop', number>;
  productionClock: Record<'kitchen' | 'smelter' | 'workshop', number>;
  miningClock: number;
  activeMine?: { depositId: number; progress: number };
  diggingClock: number;
  activeDig?: { x: number; z: number; progress: number };
  claimingClock: number;
  activeClaim?: { x: number; z: number; progress: number };
  buildingClock: number;
  nextRoomId: number;
  workerJobs: { dig: number; build: number; claim: number; mine: number; idle: number };
  workPriorities: WorkPriorities;
  workerCount: number;
}

export interface SandboxActionResult {
  ok: boolean;
  message: string;
}

export interface SandboxTickResult {
  terrainChanged: boolean;
  roomsChanged: boolean;
  resourcesChanged: boolean;
}

export interface SandboxTickOptions {
  autonomousDigging?: boolean;
  autonomousClaiming?: boolean;
  autonomousMining?: boolean;
}

export interface SandboxLoopProgress {
  discovered: boolean;
  cleared: boolean;
  claimed: boolean;
  biomassStored: boolean;
  kitchenReady: boolean;
  rationProduced: boolean;
  creatureFed: boolean;
  completed: boolean;
}

function addRect(
  cells: Map<string, ProofCell>,
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  zone: ProofCell['zone'],
): void {
  for (let z = z0; z <= z1; z += 1) {
    for (let x = x0; x <= x1; x += 1) {
      cells.set(proofCellKey(x, z), { x, z, zone });
    }
  }
}

function depositCluster(
  kind: SandboxDepositKind,
  centerX: number,
  centerZ: number,
  units: number,
  idStart: number,
): SandboxDeposit[] {
  const offsets = [
    [0, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [2, 0], [0, 2],
  ] as const;
  return offsets.map(([dx, dz], index) => ({
    id: idStart + index,
    kind,
    x: centerX + dx,
    z: centerZ + dz,
    remaining: units + (index % 3) * 3,
  }));
}

export function createSandboxState(): SandboxState {
  const openCells = new Map<string, ProofCell>();
  addRect(openCells, 3, 13, 22, 28, 'start');
  const claimedCells = new Set(openCells.keys());
  for (const site of SANDBOX_DISCOVERY_SITES) {
    addRect(openCells, site.x, site.x + site.w - 1, site.z, site.z + site.h - 1, 'target');
  }
  const deposits = [
    ...depositCluster('iron', 18, 25, 12, 0),
    ...depositCluster('iron', 30, 20, 15, 20),
    ...depositCluster('iron', 40, 10, 18, 40),
    ...depositCluster('iron', 15, 8, 14, 60),
    ...depositCluster('iron', 35, 28, 16, 80),
    ...depositCluster('fungus', 23, 13, 9, 100),
    ...depositCluster('fungus', 42, 24, 11, 120),
  ];
  return {
    openCells,
    claimedCells,
    plannedDig: new Map(),
    discoveredSites: new Set(),
    clearedSites: new Set(),
    enemies: [{ id: 'grotto-crawler', siteId: 'fungus-grotto', x: 24, z: 15, hp: 30, maxHp: 30, defeated: false }],
    creature: { id: 'covenant-adept', x: 10, z: 26, hunger: 0.42, meals: 0 },
    kitchenFlow: { inputBiomass: 0, outputRations: 0, rationsProduced: 0, rationsFed: 0 },
    rooms: [{ id: 1, kind: 'storage', x: 3, z: 22, w: 3, h: 2, buildProgress: 6 }],
    deposits,
    stock: { ore: 0, biomass: 0, essence: 4, metal: 24, ration: 0, armour: 0 },
    minedIron: 0,
    minedBiomass: 0,
    produced: { kitchen: 0, smelter: 0, workshop: 0 },
    productionClock: { kitchen: 0, smelter: 0, workshop: 0 },
    miningClock: 0,
    diggingClock: 0,
    claimingClock: 0,
    buildingClock: 0,
    nextRoomId: 2,
    workerJobs: { dig: 0, build: 0, claim: 0, mine: 0, idle: 3 },
    workPriorities: { ...DEFAULT_WORK_PRIORITIES },
    workerCount: 3,
  };
}

function siteCells(site: SandboxDiscoverySite): Array<{ x: number; z: number }> {
  const cells: Array<{ x: number; z: number }> = [];
  for (let z = site.z; z < site.z + site.h; z += 1) {
    for (let x = site.x; x < site.x + site.w; x += 1) cells.push({ x, z });
  }
  return cells;
}

function sandboxSiteAt(x: number, z: number): SandboxDiscoverySite | undefined {
  return SANDBOX_DISCOVERY_SITES.find((site) => x >= site.x && x < site.x + site.w && z >= site.z && z < site.z + site.h);
}

function siteBlockedByEnemy(state: SandboxState, x: number, z: number): boolean {
  const site = sandboxSiteAt(x, z);
  return Boolean(site
    && state.discoveredSites.has(site.id)
    && state.enemies.some((enemy) => enemy.siteId === site.id && !enemy.defeated));
}

function revealConnectedSites(state: SandboxState): boolean {
  const reachable = reachableSandboxOpenCells(state);
  let revealed = false;
  for (const site of SANDBOX_DISCOVERY_SITES) {
    if (state.discoveredSites.has(site.id) || !siteCells(site).some((cell) => reachable.has(proofCellKey(cell.x, cell.z)))) continue;
    state.discoveredSites.add(site.id);
    revealed = true;
  }
  return revealed;
}

function claimableSandboxCells(state: SandboxState): Array<{ x: number; z: number }> {
  return [...state.openCells.values()]
    .filter((cell) => !state.claimedCells.has(proofCellKey(cell.x, cell.z)))
    .filter((cell) => !siteBlockedByEnemy(state, cell.x, cell.z))
    .filter((cell) => neighbours(cell.x, cell.z).some((neighbour) => state.claimedCells.has(proofCellKey(neighbour.x, neighbour.z))))
    .map(({ x, z }) => ({ x, z }));
}

export function activeSandboxEnemy(state: SandboxState, siteId = 'fungus-grotto'): SandboxEnemy | undefined {
  return state.enemies.find((enemy) => enemy.siteId === siteId && !enemy.defeated);
}

export function advanceSandboxCombat(
  state: SandboxState,
  enemyId: string,
  deltaSeconds: number,
): { attacked: boolean; defeated: boolean; hp: number } {
  const enemy = state.enemies.find((candidate) => candidate.id === enemyId);
  if (!enemy || enemy.defeated || !state.discoveredSites.has(enemy.siteId)) {
    return { attacked: false, defeated: Boolean(enemy?.defeated), hp: enemy?.hp ?? 0 };
  }
  enemy.hp = Math.max(0, enemy.hp - deltaSeconds * 12);
  if (enemy.hp <= 0) {
    enemy.defeated = true;
    state.clearedSites.add(enemy.siteId);
  }
  return { attacked: true, defeated: enemy.defeated, hp: enemy.hp };
}

export function sandboxCreatureHungry(state: SandboxState): boolean {
  return state.creature.hunger >= 0.55;
}

export function advanceSandboxCreatureNeeds(state: SandboxState, deltaSeconds: number): void {
  state.creature.hunger = Math.min(1, state.creature.hunger + deltaSeconds / 75);
}

function completedKitchen(state: SandboxState): SandboxRoom | undefined {
  return state.rooms.find((room) => room.kind === 'kitchen' && sandboxRoomComplete(room));
}

export function pickupSandboxKitchenBiomass(state: SandboxState): SandboxActionResult {
  if (!completedKitchen(state)) return { ok: false, message: 'Es gibt noch keine fertige Pilzküche.' };
  if (state.kitchenFlow.inputBiomass >= 4) return { ok: false, message: 'Der Kücheneingang ist bereits gefüllt.' };
  if (state.stock.biomass < 1) return { ok: false, message: 'Im Lager liegt keine Biomasse.' };
  state.stock.biomass -= 1;
  return { ok: true, message: 'Biomasse aus dem Lager aufgenommen.' };
}

export function deliverSandboxKitchenBiomass(state: SandboxState): SandboxActionResult {
  if (!completedKitchen(state)) return { ok: false, message: 'Es gibt noch keine fertige Pilzküche.' };
  state.kitchenFlow.inputBiomass += 1;
  return { ok: true, message: 'Biomasse an die Pilzküche geliefert.' };
}

export function pickupSandboxKitchenRation(state: SandboxState): SandboxActionResult {
  if (state.kitchenFlow.outputRations < 1) return { ok: false, message: 'An der Küche wartet keine Ration.' };
  state.kitchenFlow.outputRations -= 1;
  return { ok: true, message: 'Frische Ration an der Küche aufgenommen.' };
}

export function feedSandboxCreature(state: SandboxState): SandboxActionResult {
  if (!sandboxCreatureHungry(state)) return { ok: false, message: 'Die Kreatur ist noch nicht hungrig.' };
  state.creature.hunger = 0;
  state.creature.meals += 1;
  state.kitchenFlow.rationsFed += 1;
  return { ok: true, message: 'Die Kreatur wurde mit einer frischen Ration versorgt.' };
}

export function sandboxLoopProgress(state: SandboxState): SandboxLoopProgress {
  const fungusSite = SANDBOX_DISCOVERY_SITES.find((site) => site.id === 'fungus-grotto')!;
  const fungusCells = siteCells(fungusSite);
  const discovered = state.discoveredSites.has(fungusSite.id);
  const cleared = state.clearedSites.has(fungusSite.id);
  const claimed = fungusCells.some((cell) => state.claimedCells.has(proofCellKey(cell.x, cell.z)));
  const progress = {
    discovered,
    cleared,
    claimed,
    biomassStored: state.minedBiomass > 0,
    kitchenReady: Boolean(completedKitchen(state)),
    rationProduced: state.kitchenFlow.rationsProduced > 0,
    creatureFed: state.kitchenFlow.rationsFed > 0,
    completed: false,
  };
  progress.completed = progress.discovered
    && progress.cleared
    && progress.claimed
    && progress.biomassStored
    && progress.kitchenReady
    && progress.rationProduced
    && progress.creatureFed;
  return progress;
}

export function nextSandboxClaimTarget(state: SandboxState): { x: number; z: number } | undefined {
  return claimableSandboxCells(state)[0];
}

export function advanceSandboxClaiming(
  state: SandboxState,
  target: { x: number; z: number },
  deltaSeconds: number,
): { completed: boolean; progress: number } {
  const key = proofCellKey(target.x, target.z);
  const valid = claimableSandboxCells(state).some((cell) => cell.x === target.x && cell.z === target.z);
  if (!valid || state.workerJobs.claim < 1) {
    state.activeClaim = undefined;
    state.claimingClock = 0;
    return { completed: false, progress: 0 };
  }
  if (!state.activeClaim || state.activeClaim.x !== target.x || state.activeClaim.z !== target.z) {
    state.activeClaim = { ...target, progress: 0 };
    state.claimingClock = 0;
  }
  state.claimingClock += deltaSeconds / 1.15;
  state.activeClaim.progress = Math.min(1, state.claimingClock);
  if (state.claimingClock < 1) return { completed: false, progress: state.activeClaim.progress };
  state.claimedCells.add(key);
  state.activeClaim = undefined;
  state.claimingClock = 0;
  return { completed: true, progress: 1 };
}

export function advanceSandboxMining(
  state: SandboxState,
  depositId: number,
  deltaSeconds: number,
): { completed: boolean; progress: number; item?: 'ore' | 'biomass'; resourcesChanged: boolean } {
  const deposit = state.deposits.find((candidate) => candidate.id === depositId);
  if (!deposit || deposit.remaining <= 0 || !state.claimedCells.has(proofCellKey(deposit.x, deposit.z)) || state.workerJobs.mine < 1) {
    state.activeMine = undefined;
    state.miningClock = 0;
    return { completed: false, progress: 0, resourcesChanged: false };
  }
  if (!state.activeMine || state.activeMine.depositId !== depositId) {
    state.activeMine = { depositId, progress: 0 };
    state.miningClock = 0;
  }
  state.miningClock += deltaSeconds / 1.05;
  state.activeMine.progress = Math.min(1, state.miningClock);
  if (state.miningClock < 1) return { completed: false, progress: state.activeMine.progress, resourcesChanged: false };
  deposit.remaining -= 1;
  state.activeMine = undefined;
  state.miningClock = 0;
  return {
    completed: true,
    progress: 1,
    item: deposit.kind === 'iron' ? 'ore' : 'biomass',
    resourcesChanged: deposit.remaining === 0,
  };
}

export function deliverSandboxResource(state: SandboxState, item: 'ore' | 'biomass'): SandboxActionResult {
  if (totalStock(state) >= storageCapacity(state)) return { ok: false, message: 'Das Lager ist voll.' };
  state.stock[item] += 1;
  if (item === 'ore') state.minedIron += 1;
  else state.minedBiomass += 1;
  return { ok: true, message: item === 'ore' ? 'Roherz eingelagert.' : 'Biomasse eingelagert.' };
}

export function sandboxInBounds(x: number, z: number): boolean {
  return x >= SANDBOX_BOUNDS.minX
    && x <= SANDBOX_BOUNDS.maxX
    && z >= SANDBOX_BOUNDS.minZ
    && z <= SANDBOX_BOUNDS.maxZ;
}

function neighbours(x: number, z: number): Array<{ x: number; z: number }> {
  return [
    { x, z: z - 1 },
    { x: x + 1, z },
    { x, z: z + 1 },
    { x: x - 1, z },
  ];
}

function reachableSandboxOpenCells(state: SandboxState): Set<string> {
  const startKey = proofCellKey(SANDBOX_START.x, SANDBOX_START.z);
  const visited = new Set<string>();
  if (!state.openCells.has(startKey)) return visited;
  const queue: Array<{ x: number; z: number }> = [{ ...SANDBOX_START }];
  visited.add(startKey);
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const neighbour of neighbours(current.x, current.z)) {
      const key = proofCellKey(neighbour.x, neighbour.z);
      if (!state.openCells.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push(neighbour);
    }
  }
  return visited;
}

export function canDigSandboxCell(state: SandboxState, x: number, z: number): boolean {
  if (!sandboxInBounds(x, z) || state.openCells.has(proofCellKey(x, z))) return false;
  const reachable = reachableSandboxOpenCells(state);
  return neighbours(x, z).some((cell) => reachable.has(proofCellKey(cell.x, cell.z)));
}

export function canPlanSandboxCell(state: SandboxState, x: number, z: number): boolean {
  const key = proofCellKey(x, z);
  if (!sandboxInBounds(x, z) || state.openCells.has(key) || state.plannedDig.has(key)) return false;
  const reachable = reachableSandboxOpenCells(state);
  return neighbours(x, z).some((cell) => {
    const neighbourKey = proofCellKey(cell.x, cell.z);
    return reachable.has(neighbourKey) || state.plannedDig.has(neighbourKey);
  });
}

export function planSandboxDigCell(state: SandboxState, x: number, z: number): SandboxActionResult {
  if (!canPlanSandboxCell(state, x, z)) {
    return { ok: false, message: 'Der Grabauftrag muss an offenen Boden oder einen geplanten Gang anschließen.' };
  }
  state.plannedDig.set(proofCellKey(x, z), { x, z });
  return { ok: true, message: `Grabauftrag ${x}/${z} eingeplant.` };
}

export function digSandboxCell(state: SandboxState, x: number, z: number): SandboxActionResult {
  if (!canDigSandboxCell(state, x, z)) {
    return { ok: false, message: 'Das Feld muss direkt an bereits offenen Boden grenzen.' };
  }
  state.openCells.set(proofCellKey(x, z), { x, z, zone: 'corridor' });
  return { ok: true, message: `Feld ${x}/${z} geöffnet.` };
}

export function normalizedRect(start: { x: number; z: number }, end: { x: number; z: number }): {
  x: number;
  z: number;
  w: number;
  h: number;
} {
  const x = Math.min(start.x, end.x);
  const z = Math.min(start.z, end.z);
  return { x, z, w: Math.abs(end.x - start.x) + 1, h: Math.abs(end.z - start.z) + 1 };
}

export function excavateSandboxChamber(
  state: SandboxState,
  start: { x: number; z: number },
  end: { x: number; z: number },
): SandboxActionResult {
  const rect = normalizedRect(start, end);
  if (rect.w > 8 || rect.h > 8) return { ok: false, message: 'Kammern dürfen im Proof höchstens 8 × 8 Felder groß sein.' };
  const pending = new Map<string, { x: number; z: number }>();
  for (let z = rect.z; z < rect.z + rect.h; z += 1) {
    for (let x = rect.x; x < rect.x + rect.w; x += 1) {
      if (!sandboxInBounds(x, z)) return { ok: false, message: 'Die Kammer liegt außerhalb der Karte.' };
      const key = proofCellKey(x, z);
      if (!state.openCells.has(key) && !state.plannedDig.has(key)) pending.set(key, { x, z });
    }
  }
  let opened = 0;
  let progressed = true;
  while (pending.size > 0 && progressed) {
    progressed = false;
    for (const [key, cell] of pending) {
      if (!canPlanSandboxCell(state, cell.x, cell.z)) continue;
      state.plannedDig.set(key, cell);
      pending.delete(key);
      opened += 1;
      progressed = true;
    }
  }
  if (pending.size > 0) return { ok: false, message: 'Die Kammer muss an offenen Boden angeschlossen sein.' };
  return { ok: true, message: opened > 0 ? `${opened} Kammerfelder als Grabauftrag eingeplant.` : 'Dieser Bereich ist bereits offen oder geplant.' };
}

function roomCells(room: { x: number; z: number; w: number; h: number }): Array<{ x: number; z: number }> {
  const cells: Array<{ x: number; z: number }> = [];
  for (let z = room.z; z < room.z + room.h; z += 1) {
    for (let x = room.x; x < room.x + room.w; x += 1) cells.push({ x, z });
  }
  return cells;
}

export function validateSandboxRoom(
  state: SandboxState,
  kind: RoomKind,
  start: { x: number; z: number },
  end: { x: number; z: number },
): SandboxActionResult & { rect?: { x: number; z: number; w: number; h: number }; cost?: number } {
  const rect = normalizedRect(start, end);
  const definition = ROOM_DEFINITIONS[kind];
  const maxW = Math.max(6, definition.maxW);
  const maxH = Math.max(6, definition.maxH);
  if (rect.w < definition.minW || rect.h < definition.minH || rect.w > maxW || rect.h > maxH) {
    return {
      ok: false,
      message: `${definition.label}: erlaubt sind ${definition.minW}–${maxW} × ${definition.minH}–${maxH} Felder.`,
    };
  }
  const cells = roomCells(rect);
  if (cells.some((cell) => SANDBOX_HEART_RESERVED.has(proofCellKey(cell.x, cell.z)))) {
    return { ok: false, message: 'Der freigehaltene Bereich um das Dungeon-Herz kann nicht überbaut werden.' };
  }
  if (cells.some((cell) => !state.openCells.has(proofCellKey(cell.x, cell.z)))) {
    return { ok: false, message: 'Räume können nur auf vollständig ausgegrabenem Boden gebaut werden.' };
  }
  if (cells.some((cell) => !state.claimedCells.has(proofCellKey(cell.x, cell.z)))) {
    return { ok: false, message: 'Der Boden muss zuerst vom Covenant beansprucht werden.' };
  }
  const occupied = new Set(state.rooms.flatMap((room) => roomCells(room).map((cell) => proofCellKey(cell.x, cell.z))));
  if (cells.some((cell) => occupied.has(proofCellKey(cell.x, cell.z)))) {
    return { ok: false, message: 'Der Bereich überschneidet einen vorhandenen Raum.' };
  }
  const cost = roomCost(kind, cells.length);
  if (state.stock.metal < cost) return { ok: false, message: `${cost} Metall benötigt, ${state.stock.metal} vorhanden.` };
  return { ok: true, message: `${definition.label} kann gebaut werden.`, rect, cost };
}

export function placeSandboxRoom(
  state: SandboxState,
  kind: RoomKind,
  start: { x: number; z: number },
  end: { x: number; z: number },
): SandboxActionResult {
  const validation = validateSandboxRoom(state, kind, start, end);
  if (!validation.ok || !validation.rect || validation.cost === undefined) return validation;
  state.stock.metal -= validation.cost;
  state.rooms.push({ id: state.nextRoomId, kind, ...validation.rect, buildProgress: 0 });
  state.nextRoomId += 1;
  return { ok: true, message: `${ROOM_DEFINITIONS[kind].label} als Bauauftrag angelegt (${validation.cost} Metall).` };
}

export function sandboxRoomComplete(room: SandboxRoom): boolean {
  return room.buildProgress >= room.w * room.h;
}

export function storageCapacity(state: SandboxState): number {
  return 80 + state.rooms
    .filter((room) => room.kind === 'storage')
    .filter(sandboxRoomComplete)
    .reduce((sum, room) => sum + room.w * room.h * 5, 0);
}

export function workerCapacity(state: SandboxState): number {
  return state.workerCount;
}

export function sandboxBedCapacity(state: SandboxState): number {
  return state.rooms
    .filter((room) => room.kind === 'bedroom')
    .filter(sandboxRoomComplete)
    .reduce((sum, room) => sum + bedroomCapacity(room.w * room.h), 0);
}

export function summonSandboxWorker(state: SandboxState): SandboxActionResult {
  if (!state.rooms.some((room) => room.kind === 'kitchen' && sandboxRoomComplete(room))) {
    return { ok: false, message: 'Eine fertige Pilzküche wird für zusätzliche Arbeiter benötigt.' };
  }
  if (state.workerCount >= 5) return { ok: false, message: 'Das Arbeiterlimit von 5 ist erreicht.' };
  if (state.stock.essence < 2) return { ok: false, message: 'Ein Arbeiter benötigt 2 Essenz.' };
  state.stock.essence -= 2;
  state.workerCount += 1;
  return { ok: true, message: `Arbeiter gerufen (${state.workerCount}/5).` };
}

export function sandboxPrisonCapacity(state: SandboxState): number {
  return state.rooms
    .filter((room) => room.kind === 'prison')
    .filter(sandboxRoomComplete)
    .reduce((sum, room) => sum + prisonCapacity(room.w * room.h), 0);
}

export function totalStock(state: SandboxState): number {
  return (Object.keys(state.stock) as ItemKind[]).reduce((sum, kind) => sum + state.stock[kind], 0);
}

export function remainingDepositUnits(state: SandboxState, kind?: SandboxDepositKind): number {
  return state.deposits
    .filter((deposit) => !kind || deposit.kind === kind)
    .reduce((sum, deposit) => sum + deposit.remaining, 0);
}

export function advanceSandboxDigging(
  state: SandboxState,
  target: { x: number; z: number },
  deltaSeconds: number,
): { completed: boolean; progress: number } {
  const key = proofCellKey(target.x, target.z);
  if (!state.plannedDig.has(key) || !canDigSandboxCell(state, target.x, target.z) || state.workerJobs.dig < 1) {
    state.activeDig = undefined;
    return { completed: false, progress: 0 };
  }
  if (!state.activeDig || state.activeDig.x !== target.x || state.activeDig.z !== target.z) {
    state.activeDig = { ...target, progress: 0 };
  }
  state.activeDig.progress = Math.min(1, state.activeDig.progress + deltaSeconds / 1.25);
  if (state.activeDig.progress < 1) return { completed: false, progress: state.activeDig.progress };
  state.plannedDig.delete(key);
  state.openCells.set(key, { ...target, zone: 'corridor' });
  revealConnectedSites(state);
  state.activeDig = undefined;
  return { completed: true, progress: 1 };
}

export function tickSandboxEconomy(
  state: SandboxState,
  deltaSeconds: number,
  options: SandboxTickOptions = {},
): SandboxTickResult {
  let terrainChanged = false;
  let roomsChanged = false;
  let resourcesChanged = false;
  advanceSandboxCreatureNeeds(state, deltaSeconds);
  const workers = Math.max(1, workerCapacity(state));
  const executableDig = [...state.plannedDig.values()].filter((cell) => canDigSandboxCell(state, cell.x, cell.z)).length;
  const claimable = claimableSandboxCells(state).length;
  const buildCells = state.rooms.reduce((sum, room) => sum + Math.max(0, room.w * room.h - room.buildProgress), 0);
  const mineNodes = state.deposits.filter((deposit) => deposit.remaining > 0 && state.claimedCells.has(proofCellKey(deposit.x, deposit.z))).length;
  const available = { dig: executableDig, build: buildCells, claim: claimable, mine: mineNodes };
  const jobs = { dig: 0, build: 0, claim: 0, mine: 0, idle: 0 };
  const foodUrgent = state.stock.ration < 3 || state.stock.biomass < 4;
  for (let index = 0; index < workers; index += 1) {
    const selected = workerTaskOrder(index, foodUrgent, state.workPriorities).find((task) => (
      (task === 'dig' || task === 'build' || task === 'claim' || task === 'mine') && available[task] > 0
    ));
    if (selected === 'dig' || selected === 'build' || selected === 'claim' || selected === 'mine') {
      jobs[selected] += 1;
      available[selected] -= 1;
    } else {
      jobs.idle += 1;
    }
  }
  state.workerJobs = jobs;

  if (options.autonomousDigging !== false) {
    state.diggingClock += deltaSeconds * jobs.dig * 0.9;
    while (state.diggingClock >= 1) {
      const next = [...state.plannedDig.values()].find((cell) => canDigSandboxCell(state, cell.x, cell.z));
      if (!next) break;
      state.diggingClock -= 1;
      state.plannedDig.delete(proofCellKey(next.x, next.z));
      state.openCells.set(proofCellKey(next.x, next.z), { ...next, zone: 'corridor' });
      revealConnectedSites(state);
      terrainChanged = true;
    }
  }

  if (options.autonomousClaiming !== false) {
    const nextClaim = claimableSandboxCells(state)[0];
    if (jobs.claim > 0 && nextClaim) {
      if (!state.activeClaim || state.activeClaim.x !== nextClaim.x || state.activeClaim.z !== nextClaim.z) {
        state.activeClaim = { ...nextClaim, progress: 0 };
        state.claimingClock = 0;
      }
      state.claimingClock += deltaSeconds * jobs.claim * 0.35;
      state.activeClaim.progress = Math.min(1, state.claimingClock);
      if (state.claimingClock >= 1) {
        state.claimedCells.add(proofCellKey(nextClaim.x, nextClaim.z));
        state.claimingClock = 0;
        state.activeClaim = undefined;
        terrainChanged = true;
      }
    } else {
      state.activeClaim = undefined;
      state.claimingClock = 0;
    }
  } else if (jobs.claim === 0) {
    state.activeClaim = undefined;
    state.claimingClock = 0;
  }

  state.buildingClock += deltaSeconds * jobs.build * 0.55;
  while (state.buildingClock >= 1) {
    const room = state.rooms.find((candidate) => !sandboxRoomComplete(candidate));
    if (!room) break;
    state.buildingClock -= 1;
    room.buildProgress += 1;
    roomsChanged = true;
  }

  if (options.autonomousMining !== false) {
    const mineable = (): SandboxDeposit | undefined => state.deposits.find((deposit) => (
      deposit.remaining > 0 && state.claimedCells.has(proofCellKey(deposit.x, deposit.z))
    ));
    state.miningClock += deltaSeconds * jobs.mine * 0.7;
    while (state.miningClock >= 1 && totalStock(state) < storageCapacity(state)) {
      const deposit = mineable();
      if (!deposit) break;
      state.miningClock -= 1;
      deposit.remaining -= 1;
      if (deposit.kind === 'iron') {
        state.stock.ore += 1;
        state.minedIron += 1;
      } else {
        state.stock.biomass += 1;
        state.minedBiomass += 1;
      }
      if (deposit.remaining === 0) resourcesChanged = true;
    }
  }

  for (const kind of ['kitchen', 'smelter', 'workshop'] as const) {
    const stationCount = state.rooms
      .filter((room) => room.kind === kind && sandboxRoomComplete(room))
      .reduce((sum, room) => sum + productionStations(room.w * room.h), 0);
    if (stationCount === 0) continue;
    state.productionClock[kind] += deltaSeconds * stationCount;
    const recipe = RECIPES[kind];
    if (kind === 'kitchen') {
      while (
        state.productionClock.kitchen >= recipe.seconds
        && state.kitchenFlow.inputBiomass >= recipe.inputAmount
        && state.kitchenFlow.outputRations <= 4
      ) {
        state.productionClock.kitchen -= recipe.seconds;
        state.kitchenFlow.inputBiomass -= recipe.inputAmount;
        state.kitchenFlow.outputRations += recipe.outputAmount;
        state.kitchenFlow.rationsProduced += recipe.outputAmount;
        state.produced.kitchen += recipe.outputAmount;
        resourcesChanged = true;
      }
      continue;
    }
    while (state.productionClock[kind] >= recipe.seconds && canStartRecipe(kind, state.stock)) {
      state.productionClock[kind] -= recipe.seconds;
      state.stock = applyRecipe(kind, state.stock);
      state.produced[kind] += recipe.outputAmount;
    }
  }
  return { terrainChanged, roomsChanged, resourcesChanged };
}
