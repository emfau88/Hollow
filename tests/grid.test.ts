import { describe, expect, it } from 'vitest';
import { buildPathTree, findPath, lineRoute } from '../src/core/Grid';

describe('Grid und Grabplanung', () => {
  it('findet einen Weg um blockierten Fels', () => {
    const blocked = new Set(['2,1', '2,2', '2,3']);
    const path = findPath(5, 5, { x: 0, y: 2 }, { x: 4, y: 2 }, (x, y) => !blocked.has(`${x},${y}`));
    expect(path.at(-1)).toEqual({ x: 4, y: 2 });
    expect(path).not.toContainEqual({ x: 2, y: 2 });
  });

  it('verwendet einen Suchbaum für mehrere Ziele und markiert Unerreichbares', () => {
    const blocked = new Set(['2,0', '2,1', '2,2', '2,3', '2,4']);
    const tree = buildPathTree(5, 5, { x: 0, y: 2 }, (x, y) => !blocked.has(`${x},${y}`));

    expect(tree.distanceTo({ x: 1, y: 4 })).toBe(3);
    expect(tree.pathTo({ x: 1, y: 4 }).at(-1)).toEqual({ x: 1, y: 4 });
    expect(tree.distanceTo({ x: 4, y: 2 })).toBe(Number.POSITIVE_INFINITY);
    expect(tree.pathTo({ x: 4, y: 2 })).toEqual([]);
  });

  it('erzeugt eine orthogonale L-Route mit veränderbarem Knick', () => {
    const horizontal = lineRoute({ x: 1, y: 1 }, { x: 4, y: 3 }, true);
    const vertical = lineRoute({ x: 1, y: 1 }, { x: 4, y: 3 }, false);
    expect(horizontal.at(-1)).toEqual({ x: 4, y: 3 });
    expect(vertical.at(-1)).toEqual({ x: 4, y: 3 });
    expect(horizontal).not.toEqual(vertical);
  });
});
