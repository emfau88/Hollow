import { describe, expect, it } from 'vitest';
import {
  isNarrowPassage,
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

describe('isNarrowPassage', () => {
  it('keeps a rectangular room corner on the deep room-wall set', () => {
    expect(isNarrowPassage({
      north: false,
      northEast: false,
      east: true,
      southEast: true,
      south: true,
      southWest: false,
      west: false,
      northWest: false,
    })).toBe(false);
  });

  it('uses compact walls for a one-cell horizontal tunnel', () => {
    expect(isNarrowPassage({
      north: false,
      northEast: false,
      east: true,
      southEast: false,
      south: false,
      southWest: false,
      west: true,
      northWest: false,
    })).toBe(true);
  });

  it('uses compact walls for an L-shaped tunnel bend', () => {
    expect(isNarrowPassage({
      north: true,
      northEast: false,
      east: true,
      southEast: false,
      south: false,
      southWest: false,
      west: false,
      northWest: false,
    })).toBe(true);
  });
});

describe('wall rendering policy', () => {
  it('selects shallow atlas frames for every narrow passage direction', () => {
    expect((['north', 'east', 'south', 'west'] as const).map((side) => wallEdgeFrame(side, true)))
      .toEqual([8, 9, 10, 11]);
  });

  it('never places posts at tunnel mouths, diagonals or narrow bends', () => {
    expect(shouldRenderWallPost('concave', false)).toBe(false);
    expect(shouldRenderWallPost('diagonal', false)).toBe(false);
    expect(shouldRenderWallPost('convex', true)).toBe(false);
    expect(shouldRenderWallPost('convex', false)).toBe(true);
  });
});
