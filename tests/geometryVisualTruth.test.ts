import { describe, expect, it } from 'vitest';
import {
  VISUAL_TRUTH_GROTTO,
  createGeometryVisualTruthState,
} from '../src/prototypes/geometry/GeometryVisualTruthState';
import { proofCellKey } from '../src/prototypes/geometry/GeometryProofModel';
import { buildBoundaryEdges } from '../src/prototypes/geometry/GeometryProofModel';
import {
  classifyWallCorners,
  findPassageThresholds,
} from '../src/prototypes/geometry/GeometryWallArchitecture';
import { visibleSpriteHeight } from '../src/prototypes/geometry/GeometryVisualTruthPresentation';

describe('geometry visual-truth presentation state', () => {
  it('keeps the comparison scene compact, connected and organic', () => {
    const state = createGeometryVisualTruthState();
    const corridorCells = [...state.openCells.values()].filter((cell) => cell.zone === 'corridor');

    expect(state.discoveredSites.has(VISUAL_TRUTH_GROTTO.id)).toBe(true);
    expect(state.clearedSites.has(VISUAL_TRUTH_GROTTO.id)).toBe(true);
    expect(state.claimedCells.has(proofCellKey(VISUAL_TRUTH_GROTTO.entry.x, VISUAL_TRUTH_GROTTO.entry.z))).toBe(true);
    expect(state.openCells.has(proofCellKey(VISUAL_TRUTH_GROTTO.x, VISUAL_TRUTH_GROTTO.entry.z))).toBe(true);
    expect(state.claimedCells.has(proofCellKey(12, VISUAL_TRUTH_GROTTO.entry.z))).toBe(true);
    expect(state.openCells.has(proofCellKey(13, 22))).toBe(false);
    expect(state.openCells.has(proofCellKey(18, 22))).toBe(true);
    expect(state.openCells.has(proofCellKey(15, 19))).toBe(false);
    expect(corridorCells).toHaveLength(3);
    expect(new Set(corridorCells.map((cell) => cell.z)).size).toBe(1);
    expect(state.workerJobs).toEqual({ dig: 0, build: 0, claim: 0, mine: 0, idle: state.workerCount });
  });

  it('provides modelled corners and both semantic doorway families', () => {
    const state = createGeometryVisualTruthState();
    const cells = [...state.openCells.values()];
    const constructed = new Set(state.claimedCells);
    const edges = buildBoundaryEdges(cells).filter((edge) => {
      const adjacent = edge.side === 'north' ? { x: Math.floor(edge.x), z: edge.z }
        : edge.side === 'south' ? { x: Math.floor(edge.x), z: edge.z - 1 }
          : edge.side === 'east' ? { x: edge.x - 1, z: Math.floor(edge.z) }
            : { x: edge.x, z: Math.floor(edge.z) };
      return constructed.has(proofCellKey(adjacent.x, adjacent.z));
    });
    const corners = classifyWallCorners(edges, constructed);
    const thresholds = findPassageThresholds(cells);

    expect(corners.some((corner) => corner.kind === 'outer')).toBe(true);
    expect(corners.some((corner) => corner.kind === 'inner')).toBe(true);
    expect(thresholds.some((threshold) => threshold.kind === 'built')).toBe(true);
    expect(thresholds.some((threshold) => threshold.kind === 'natural')).toBe(true);
  });

  it('normalizes the visible worker and guard silhouettes', () => {
    const workerHeight = visibleSpriteHeight('worker');
    const guardHeight = visibleSpriteHeight('guard');

    expect(guardHeight).toBeGreaterThan(workerHeight);
    expect(guardHeight / workerHeight).toBeLessThan(1.08);
  });
});
