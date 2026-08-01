import { describe, expect, it } from 'vitest';
import { buildBoundaryRuns, createSpatialPrototypeLayout } from '../src/prototypes/spatial/layout';

describe('spatial rendering prototype layout', () => {
  it('keeps room, corridor and T branch in one deterministic open-floor graph', () => {
    const layout = createSpatialPrototypeLayout();
    const cells = new Set(layout.cells.map((cell) => `${cell.x},${cell.z}`));

    expect(cells.has('0,0')).toBe(true);
    expect(cells.has('1,0')).toBe(true);
    expect(cells.has('4,-1')).toBe(true);
    expect(cells.has('4,0')).toBe(true);
    expect(cells.has('5,0')).toBe(true);
  });

  it('leaves the corridor-to-grotto portal physically open', () => {
    const layout = createSpatialPrototypeLayout();
    const blockingPortal = layout.boundaries.find(
      (run) => run.axis === 'z' && run.constant === 7.5 && run.start <= -0.5 && run.end >= 0.5,
    );

    expect(blockingPortal).toBeUndefined();
    expect(layout.grotto.at(0)?.x).toBe(layout.grotto.at(-1)?.x);
    expect(Math.abs((layout.grotto.at(0)?.z ?? 0) - (layout.grotto.at(-1)?.z ?? 0))).toBeGreaterThan(1);
  });

  it('removes only explicitly declared portals from generic boundary geometry', () => {
    const cell = [{ x: 7, z: 0, zone: 'corridor' as const }];
    const closed = buildBoundaryRuns(cell);
    const open = buildBoundaryRuns(cell, [{ x: 7, z: 0, side: 'east' }]);

    expect(closed.some((run) => run.side === 'east')).toBe(true);
    expect(open.some((run) => run.side === 'east')).toBe(false);
    expect(open).toHaveLength(closed.length - 1);
  });

  it('reserves more clear corridor width than the actor footprint', () => {
    const { metrics } = createSpatialPrototypeLayout();
    const clearWidth = metrics.tileSize - metrics.corridorWallThickness;

    expect(clearWidth).toBeGreaterThan(metrics.actorWidth);
    expect(metrics.builtWallHeight).toBeGreaterThan(metrics.corridorWallHeight * 2);
  });

  it('uses separate boundary roles for built rooms and corridors', () => {
    const zones = new Set(createSpatialPrototypeLayout().boundaries.map((run) => run.zone));
    expect(zones).toEqual(new Set(['built', 'corridor']));
  });
});
