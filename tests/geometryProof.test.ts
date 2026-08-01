import { describe, expect, it } from 'vitest';
import {
  boundaryDifference,
  createGeometryProofLayout,
  digFrontier,
  findOpenPath,
  proofCellKey,
} from '../src/prototypes/geometry/GeometryProofModel';

describe('orthographic geometry proof', () => {
  it('starts with two sealed, disconnected rooms', () => {
    const layout = createGeometryProofLayout(0);
    expect(layout.connected).toBe(false);
    expect(layout.cells.filter((cell) => cell.zone === 'start')).toHaveLength(30);
    expect(layout.cells.filter((cell) => cell.zone === 'target')).toHaveLength(30);
    expect(layout.vertices).toHaveLength(8);
  });

  it('opens a vertical corridor without leaving internal walls', () => {
    const layout = createGeometryProofLayout(1);
    const edgeKeys = new Set(layout.edges.map((edge) => edge.key));
    expect(layout.cells.some((cell) => cell.x === 5 && cell.z === 4)).toBe(true);
    expect(edgeKeys.has('h:5:9')).toBe(false);
    expect(edgeKeys.has('v:5:7')).toBe(true);
    expect(layout.connected).toBe(false);
  });

  it('connects both rooms after the horizontal branch', () => {
    const layout = createGeometryProofLayout(2);
    expect(layout.connected).toBe(true);
    expect(layout.cells.some((cell) => cell.x === 11 && cell.z === 4)).toBe(true);
    expect(layout.edges.some((edge) => edge.key === 'v:12:4')).toBe(false);
  });

  it('emits one unique boundary segment per open-to-solid border', () => {
    const layout = createGeometryProofLayout(2);
    const keys = layout.edges.map((edge) => edge.key);
    expect(new Set(keys).size).toBe(keys.length);
    const open = new Set(layout.cells.map((cell) => proofCellKey(cell.x, cell.z)));
    for (const edge of layout.edges) {
      const neighbours = edge.axis === 'horizontal'
        ? [proofCellKey(Math.floor(edge.x), edge.z - 1), proofCellKey(Math.floor(edge.x), edge.z)]
        : [proofCellKey(edge.x - 1, Math.floor(edge.z)), proofCellKey(edge.x, Math.floor(edge.z))];
      expect(neighbours.filter((key) => open.has(key))).toHaveLength(1);
    }
  });

  it('changes only the local route boundary when a branch is dug', () => {
    const sealed = createGeometryProofLayout(0);
    const vertical = createGeometryProofLayout(1);
    const complete = createGeometryProofLayout(2);
    expect(boundaryDifference(sealed.edges, vertical.edges).size).toBeLessThanOrEqual(22);
    expect(boundaryDifference(vertical.edges, complete.edges).size).toBeLessThanOrEqual(26);
  });

  it('offers only reachable neighbouring rock for manual digging', () => {
    const sealed = createGeometryProofLayout(0);
    const frontier = digFrontier(sealed.cells);
    expect(frontier).toContainEqual({ x: 5, z: 8 });
    expect(frontier).not.toContainEqual({ x: 11, z: 4 });
  });

  it('finds a traversable route after manual branches connect', () => {
    const complete = createGeometryProofLayout(2);
    const path = findOpenPath(complete.cells);
    expect(path[0]).toEqual({ x: 4, z: 11 });
    expect(path.at(-1)).toEqual({ x: 14, z: 4 });
    expect(path.length).toBeGreaterThan(10);
  });
});
