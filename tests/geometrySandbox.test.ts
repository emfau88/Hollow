import { describe, expect, it } from 'vitest';
import {
  advanceSandboxClaiming,
  advanceSandboxCombat,
  advanceSandboxDigging,
  advanceSandboxMining,
  createSandboxState,
  deliverSandboxResource,
  deliverSandboxKitchenBiomass,
  feedSandboxCreature,
  excavateSandboxChamber,
  nextSandboxClaimTarget,
  planSandboxDigCell,
  placeSandboxRoom,
  pickupSandboxKitchenBiomass,
  pickupSandboxKitchenRation,
  remainingDepositUnits,
  sandboxBedCapacity,
  sandboxPrisonCapacity,
  sandboxRoomComplete,
  sandboxLoopProgress,
  storageCapacity,
  summonSandboxWorker,
  tickSandboxEconomy,
  workerCapacity,
} from '../src/prototypes/geometry/GeometrySandboxModel';

describe('playable geometry sandbox', () => {
  it('starts on a large resource-rich map', () => {
    const state = createSandboxState();
    expect(state.openCells.size).toBe(252);
    expect(state.claimedCells.size).toBe(77);
    expect(state.discoveredSites.size).toBe(0);
    expect(state.rooms).toMatchObject([{ kind: 'storage', buildProgress: 6 }]);
    expect(sandboxRoomComplete(state.rooms[0])).toBe(true);
    expect(state.workerCount).toBe(3);
    expect(remainingDepositUnits(state, 'iron')).toBeGreaterThan(500);
    expect(state.stock.metal).toBeGreaterThan(10);
  });

  it('claims freshly excavated corridors field by field', () => {
    const state = createSandboxState();
    expect(planSandboxDigCell(state, 14, 25).ok).toBe(true);
    tickSandboxEconomy(state, 0.1, { autonomousDigging: false });
    expect(advanceSandboxDigging(state, { x: 14, z: 25 }, 1.3).completed).toBe(true);
    expect(state.claimedCells.has('14,25')).toBe(false);
    tickSandboxEconomy(state, 3, { autonomousDigging: false, autonomousClaiming: false });
    expect(state.claimedCells.has('14,25')).toBe(false);
    const target = nextSandboxClaimTarget(state);
    expect(target).toEqual({ x: 14, z: 25 });
    expect(advanceSandboxClaiming(state, target!, 1.2).completed).toBe(true);
    expect(state.claimedCells.has('14,25')).toBe(true);
  });

  it('reveals authored neutral chambers when their entrance is reached', () => {
    const state = createSandboxState();
    expect(planSandboxDigCell(state, 23, 17).ok).toBe(false);
    for (let x = 14; x <= 23; x += 1) expect(planSandboxDigCell(state, x, 22).ok).toBe(true);
    for (let z = 21; z >= 17; z -= 1) expect(planSandboxDigCell(state, 23, z).ok).toBe(true);
    for (let index = 0; index < 120; index += 1) tickSandboxEconomy(state, 0.5);
    expect(state.discoveredSites.has('fungus-grotto')).toBe(true);
    expect(state.openCells.has('20,10')).toBe(true);
    expect(state.openCells.has('26,16')).toBe(true);
    expect(state.claimedCells.has('20,10')).toBe(false);
  });

  it('credits manually mined resources only after a worker delivers them', () => {
    const state = createSandboxState();
    const deposit = state.deposits.find((candidate) => candidate.kind === 'iron')!;
    const key = `${deposit.x},${deposit.z}`;
    state.openCells.set(key, { x: deposit.x, z: deposit.z, zone: 'corridor' });
    state.claimedCells.add(key);
    const initialOre = state.stock.ore;
    tickSandboxEconomy(state, 0.1, { autonomousMining: false });
    const mined = advanceSandboxMining(state, deposit.id, 1.1);
    expect(mined).toMatchObject({ completed: true, item: 'ore' });
    expect(state.stock.ore).toBe(initialOre);
    expect(deliverSandboxResource(state, mined.item!).ok).toBe(true);
    expect(state.stock.ore).toBe(initialOre + 1);
  });

  it('connects, claims, mines and delivers from a real fungus chamber', () => {
    const state = createSandboxState();
    const route = [
      ...Array.from({ length: 10 }, (_, index) => ({ x: 14 + index, z: 22 })),
      ...Array.from({ length: 5 }, (_, index) => ({ x: 23, z: 21 - index })),
    ];
    route.forEach((cell) => expect(planSandboxDigCell(state, cell.x, cell.z).ok).toBe(true));
    tickSandboxEconomy(state, 0.1, { autonomousDigging: false, autonomousClaiming: false, autonomousMining: false });
    route.forEach((cell) => expect(advanceSandboxDigging(state, cell, 1.3).completed).toBe(true));
    expect(state.discoveredSites.has('fungus-grotto')).toBe(true);
    expect(advanceSandboxCombat(state, 'grotto-crawler', 3).defeated).toBe(true);

    const fungus = state.deposits.find((deposit) => deposit.kind === 'fungus' && deposit.x === 23 && deposit.z === 13)!;
    expect(state.claimedCells.has(`${fungus.x},${fungus.z}`)).toBe(false);
    for (let index = 0; index < 90 && !state.claimedCells.has(`${fungus.x},${fungus.z}`); index += 1) {
      tickSandboxEconomy(state, 0.01, { autonomousDigging: false, autonomousClaiming: false, autonomousMining: false });
      const claimTarget = nextSandboxClaimTarget(state);
      if (claimTarget) advanceSandboxClaiming(state, claimTarget, 1.2);
    }
    expect(state.claimedCells.has(`${fungus.x},${fungus.z}`)).toBe(true);

    tickSandboxEconomy(state, 0.1, { autonomousDigging: false, autonomousClaiming: false, autonomousMining: false });
    const biomassBefore = state.stock.biomass;
    const mined = advanceSandboxMining(state, fungus.id, 1.1);
    expect(mined).toMatchObject({ completed: true, item: 'biomass' });
    expect(state.stock.biomass).toBe(biomassBefore);
    expect(deliverSandboxResource(state, mined.item!).ok).toBe(true);
    expect(state.stock.biomass).toBe(biomassBefore + 1);
  });

  it('completes the discovery, combat, fungus, kitchen and feeding loop with physical handoffs', () => {
    const state = createSandboxState();
    expect(placeSandboxRoom(state, 'kitchen', { x: 9, z: 22 }, { x: 10, z: 24 }).ok).toBe(true);
    const kitchen = state.rooms.find((room) => room.kind === 'kitchen')!;
    kitchen.buildProgress = kitchen.w * kitchen.h;
    const route = [
      ...Array.from({ length: 10 }, (_, index) => ({ x: 14 + index, z: 22 })),
      ...Array.from({ length: 5 }, (_, index) => ({ x: 23, z: 21 - index })),
    ];
    route.forEach((cell) => expect(planSandboxDigCell(state, cell.x, cell.z).ok).toBe(true));
    tickSandboxEconomy(state, 0.1, { autonomousDigging: false, autonomousClaiming: false, autonomousMining: false });
    route.forEach((cell) => expect(advanceSandboxDigging(state, cell, 1.3).completed).toBe(true));
    expect(sandboxLoopProgress(state)).toMatchObject({ discovered: true, cleared: false });

    expect(advanceSandboxCombat(state, 'grotto-crawler', 3).defeated).toBe(true);
    expect(sandboxLoopProgress(state).cleared).toBe(true);
    const fungus = state.deposits.find((deposit) => deposit.kind === 'fungus' && deposit.x === 23 && deposit.z === 13)!;
    for (let index = 0; index < 160 && !state.claimedCells.has(`${fungus.x},${fungus.z}`); index += 1) {
      tickSandboxEconomy(state, 0.01, { autonomousDigging: false, autonomousClaiming: false, autonomousMining: false });
      const claimTarget = nextSandboxClaimTarget(state);
      if (claimTarget) advanceSandboxClaiming(state, claimTarget, 1.2);
    }
    expect(state.claimedCells.has(`${fungus.x},${fungus.z}`)).toBe(true);

    tickSandboxEconomy(state, 0.1, { autonomousDigging: false, autonomousClaiming: false, autonomousMining: false });
    const mined = advanceSandboxMining(state, fungus.id, 1.1);
    expect(mined.item).toBe('biomass');
    expect(deliverSandboxResource(state, 'biomass').ok).toBe(true);
    const minedAgain = advanceSandboxMining(state, fungus.id, 1.1);
    expect(minedAgain.item).toBe('biomass');
    expect(deliverSandboxResource(state, 'biomass').ok).toBe(true);
    expect(pickupSandboxKitchenBiomass(state).ok).toBe(true);
    expect(deliverSandboxKitchenBiomass(state).ok).toBe(true);
    expect(pickupSandboxKitchenBiomass(state).ok).toBe(true);
    expect(deliverSandboxKitchenBiomass(state).ok).toBe(true);
    tickSandboxEconomy(state, 5.1, { autonomousDigging: false, autonomousClaiming: false, autonomousMining: false });
    expect(state.kitchenFlow.outputRations).toBe(2);
    state.creature.hunger = 1;
    expect(pickupSandboxKitchenRation(state).ok).toBe(true);
    expect(feedSandboxCreature(state).ok).toBe(true);
    expect(sandboxLoopProgress(state).completed).toBe(true);
  });

  it('digs connected tunnels and rejects remote rock', () => {
    const state = createSandboxState();
    expect(planSandboxDigCell(state, 14, 25).ok).toBe(true);
    expect(state.openCells.has('14,25')).toBe(false);
    expect(planSandboxDigCell(state, 30, 10).ok).toBe(false);
    tickSandboxEconomy(state, 2);
    expect(state.openCells.has('14,25')).toBe(true);
  });

  it('keeps a marked wall closed until a worker completes work at that exact field', () => {
    const state = createSandboxState();
    expect(planSandboxDigCell(state, 14, 25).ok).toBe(true);
    tickSandboxEconomy(state, 4, { autonomousDigging: false });
    expect(state.openCells.has('14,25')).toBe(false);
    expect(advanceSandboxDigging(state, { x: 14, z: 25 }, 0.8).completed).toBe(false);
    expect(state.openCells.has('14,25')).toBe(false);
    expect(advanceSandboxDigging(state, { x: 14, z: 25 }, 0.5).completed).toBe(true);
    expect(state.openCells.has('14,25')).toBe(true);
  });

  it('excavates attached chambers and builds all six room families on open floor', () => {
    const state = createSandboxState();
    expect(placeSandboxRoom(state, 'bedroom', { x: 6, z: 22 }, { x: 7, z: 23 }).ok).toBe(true);
    expect(placeSandboxRoom(state, 'kitchen', { x: 9, z: 22 }, { x: 10, z: 24 }).ok).toBe(true);
    expect(placeSandboxRoom(state, 'smelter', { x: 11, z: 22 }, { x: 12, z: 24 }).ok).toBe(true);
    expect(placeSandboxRoom(state, 'workshop', { x: 3, z: 25 }, { x: 4, z: 27 }).ok).toBe(true);
    expect(placeSandboxRoom(state, 'prison', { x: 11, z: 25 }, { x: 12, z: 27 }).ok).toBe(true);
    expect(state.rooms.map((room) => room.kind)).toEqual([
      'storage', 'bedroom', 'kitchen', 'smelter', 'workshop', 'prison',
    ]);
    expect(state.rooms.slice(1).every((room) => !sandboxRoomComplete(room))).toBe(true);
    for (let index = 0; index < 80; index += 1) tickSandboxEconomy(state, 0.5);
    expect(state.rooms.every(sandboxRoomComplete)).toBe(true);
    expect(storageCapacity(state)).toBeGreaterThan(80);
    expect(sandboxBedCapacity(state)).toBeGreaterThan(0);
    expect(sandboxPrisonCapacity(state)).toBeGreaterThan(0);
  });

  it('mines more than eight ore and runs the smelter recipe', () => {
    const state = createSandboxState();
    for (let x = 14; x <= 18; x += 1) expect(planSandboxDigCell(state, x, 25).ok).toBe(true);
    expect(excavateSandboxChamber(state, { x: 4, z: 23 }, { x: 7, z: 27 }).ok).toBe(true);
    expect(placeSandboxRoom(state, 'smelter', { x: 11, z: 25 }, { x: 12, z: 27 }).ok).toBe(true);
    const initialMetal = state.stock.metal;
    for (let index = 0; index < 160; index += 1) tickSandboxEconomy(state, 0.5);
    expect(state.minedIron).toBeGreaterThan(8);
    expect(state.stock.metal).toBeGreaterThan(initialMetal - 5);
    expect(state.produced.smelter).toBeGreaterThan(0);
  });

  it('uses old-game capacity rules for a 4 × 5 bedroom instead of one oversized bed', () => {
    const state = createSandboxState();
    expect(placeSandboxRoom(state, 'bedroom', { x: 9, z: 22 }, { x: 12, z: 26 }).ok).toBe(true);
    for (let index = 0; index < 60; index += 1) tickSandboxEconomy(state, 0.5);
    expect(sandboxBedCapacity(state)).toBe(5);
    expect(workerCapacity(state)).toBe(3);
  });

  it('uses the old worker priority lanes when digging and building compete', () => {
    const state = createSandboxState();
    expect(planSandboxDigCell(state, 14, 25).ok).toBe(true);
    expect(placeSandboxRoom(state, 'bedroom', { x: 6, z: 22 }, { x: 7, z: 23 }).ok).toBe(true);
    tickSandboxEconomy(state, 0.1);
    expect(state.workerJobs).toMatchObject({ dig: 1, build: 2 });
    state.workPriorities.build = 2;
    tickSandboxEconomy(state, 0.1);
    expect(state.workerJobs).toMatchObject({ dig: 0, build: 3 });
  });

  it('summons workers only after a kitchen and keeps the old five-worker limit', () => {
    const state = createSandboxState();
    expect(summonSandboxWorker(state).ok).toBe(false);
    expect(placeSandboxRoom(state, 'kitchen', { x: 9, z: 22 }, { x: 10, z: 24 }).ok).toBe(true);
    for (let index = 0; index < 30; index += 1) tickSandboxEconomy(state, 0.5);
    expect(summonSandboxWorker(state).ok).toBe(true);
    expect(summonSandboxWorker(state).ok).toBe(true);
    expect(summonSandboxWorker(state).ok).toBe(false);
    expect(workerCapacity(state)).toBe(5);
  });
});
