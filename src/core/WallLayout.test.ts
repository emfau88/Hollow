import { describe, expect, it } from 'vitest';
import {
  shouldRenderWallPost,
  wallEdgeFrame,
  wallJoint,
  wallSides,
} from './WallLayout';

describe('wallSides', () => {
  it('keeps a vertical corridor open with symmetric side walls', () => {
    expect(wallSides({ north: false, east: true, south: false, west: true }))
      .toEqual(['east', 'west']);
  });

  it('keeps both boundary edges at a simple room corner', () => {
    expect(wallSides({ north: true, east: true, south: false, west: false }))
      .toEqual(['north', 'east']);
  });

  it('keeps three independent edges at a dead end', () => {
    expect(wallSides({ north: true, east: true, south: true, west: false }))
      .toEqual(['north', 'east', 'south']);
  });

  it('uses four boundary edges for an isolated open tile', () => {
    expect(wallSides({ north: true, east: true, south: true, west: true }))
      .toEqual(['north', 'east', 'south', 'west']);
  });
});

describe('wallJoint', () => {
  it('creates a convex post for a rectangular room corner', () => {
    expect(wallJoint({ northWest: false, northEast: false, southEast: true, southWest: false }))
      .toBe('convex');
  });

  it('creates a concave post around a rock intrusion', () => {
    expect(wallJoint({ northWest: true, northEast: true, southEast: false, southWest: true }))
      .toBe('concave');
  });

  it('does not interrupt a straight boundary', () => {
    expect(wallJoint({ northWest: false, northEast: false, southEast: true, southWest: true }))
      .toBeUndefined();
  });

  it('caps diagonal contact without leaving a pinhole', () => {
    expect(wallJoint({ northWest: true, northEast: false, southEast: true, southWest: false }))
      .toBe('diagonal');
  });

  it('closes all four vertices of a rectangular room', () => {
    const open = (x: number, y: number) => x >= 0 && x < 3 && y >= 0 && y < 2;
    const joints: Array<{ x: number; y: number; kind: string }> = [];
    for (let y = 0; y <= 2; y++) {
      for (let x = 0; x <= 3; x++) {
        const kind = wallJoint({
          northWest: open(x - 1, y - 1),
          northEast: open(x, y - 1),
          southEast: open(x, y),
          southWest: open(x - 1, y),
        });
        if (kind) joints.push({ x, y, kind });
      }
    }
    expect(joints).toEqual([
      { x: 0, y: 0, kind: 'convex' },
      { x: 3, y: 0, kind: 'convex' },
      { x: 0, y: 2, kind: 'convex' },
      { x: 3, y: 2, kind: 'convex' },
    ]);
  });
});

describe('wall rendering policy', () => {
  it('uses the same four edge slots for every modular wall family', () => {
    expect((['north', 'east', 'south', 'west'] as const).map((side) => wallEdgeFrame(side)))
      .toEqual([0, 1, 2, 3]);
  });

  it('never places posts at tunnel mouths, diagonals or corridor bends', () => {
    expect(shouldRenderWallPost('concave', 'room')).toBe(false);
    expect(shouldRenderWallPost('diagonal', 'chamber')).toBe(false);
    expect(shouldRenderWallPost('convex', 'corridor')).toBe(false);
    expect(shouldRenderWallPost('convex', 'room')).toBe(true);
    expect(shouldRenderWallPost('convex', 'chamber')).toBe(true);
  });
});
