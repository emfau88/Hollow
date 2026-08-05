import { proofCellKey } from './GeometryProofModel';
import {
  SANDBOX_DISCOVERY_SITES,
  createSandboxState,
  type SandboxDiscoverySite,
  type SandboxState,
} from './GeometrySandboxModel';

export const VISUAL_TRUTH_GROTTO: SandboxDiscoverySite = {
  id: 'visual-truth-grotto',
  label: 'Leuchtende Pilzgrotte',
  kind: 'fungus',
  x: 15,
  z: 19,
  w: 7,
  h: 7,
  entry: { x: 14, z: 24 },
};

/**
 * A deterministic presentation state for comparing the geometry renderer with
 * the approved Style-B production frame. It deliberately adds no new rules:
 * the state only arranges existing cells, rooms and discoveries for visual QA.
 */
export function createGeometryVisualTruthState(): SandboxState {
  const state = createSandboxState();

  // Tighten the wide gameplay start hall into the compact, readable chamber
  // composition used by the target frames. The real sandbox remains untouched.
  for (let z = 22; z <= 28; z += 1) {
    for (let x = 12; x <= 13; x += 1) {
      const key = proofCellKey(x, z);
      state.openCells.delete(key);
      state.claimedCells.delete(key);
    }
  }

  // Remove the distant gameplay sites from this deliberately compact art test.
  for (const site of SANDBOX_DISCOVERY_SITES) {
    for (let z = site.z; z < site.z + site.h; z += 1) {
      for (let x = site.x; x < site.x + site.w; x += 1) {
        const key = proofCellKey(x, z);
        state.openCells.delete(key);
        state.claimedCells.delete(key);
      }
    }
  }

  const openAndClaim = (x: number, z: number): void => {
    const key = proofCellKey(x, z);
    state.openCells.set(key, { x, z, zone: 'corridor' });
    state.claimedCells.add(key);
  };

  for (let x = 12; x <= VISUAL_TRUTH_GROTTO.entry.x; x += 1) {
    openAndClaim(x, VISUAL_TRUTH_GROTTO.entry.z);
  }
  for (let z = VISUAL_TRUTH_GROTTO.z; z < VISUAL_TRUTH_GROTTO.z + VISUAL_TRUTH_GROTTO.h; z += 1) {
    for (let x = VISUAL_TRUTH_GROTTO.x; x < VISUAL_TRUTH_GROTTO.x + VISUAL_TRUTH_GROTTO.w; x += 1) {
      const dx = x - (VISUAL_TRUTH_GROTTO.x + 3);
      const dz = z - (VISUAL_TRUTH_GROTTO.z + 3);
      if (dx * dx + dz * dz > 12.5) continue;
      state.openCells.set(proofCellKey(x, z), { x, z, zone: 'target' });
    }
  }
  // Give the organic outline a deliberate one-cell neck at the corridor end.
  // This creates a real biome transition instead of a diagonal visual overlap.
  state.openCells.set(
    proofCellKey(VISUAL_TRUTH_GROTTO.x, VISUAL_TRUTH_GROTTO.entry.z),
    { x: VISUAL_TRUTH_GROTTO.x, z: VISUAL_TRUTH_GROTTO.entry.z, zone: 'target' },
  );
  state.discoveredSites.clear();
  state.clearedSites.clear();
  state.discoveredSites.add(VISUAL_TRUTH_GROTTO.id);
  state.clearedSites.add(VISUAL_TRUTH_GROTTO.id);

  // Reuse the real harvestable fungus deposits, only repositioned into the
  // compact comparison grotto.
  state.deposits
    .filter((deposit) => deposit.id >= 100 && deposit.id < 120)
    .forEach((deposit) => {
      deposit.x -= 5;
      deposit.z += 9;
    });
  const crawler = state.enemies.find((enemy) => enemy.siteId === 'fungus-grotto');
  if (crawler) {
    crawler.siteId = VISUAL_TRUTH_GROTTO.id;
    crawler.hp = 0;
    crawler.defeated = true;
  }

  state.plannedDig.clear();
  state.workerJobs = { dig: 0, build: 0, claim: 0, mine: 0, idle: state.workerCount };
  return state;
}
