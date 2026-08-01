import { describe, expect, it } from 'vitest';
import type { TerrainArchitecture } from './TerrainArchitecture';
import {
  architecturePriority,
  wallEdgeFrame,
  wallJoint,
  wallJointFrame,
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
      .toEqual({ kind: 'convex', quadrant: 'southEast' });
  });

  it('creates a concave post around a rock intrusion', () => {
    expect(wallJoint({ northWest: true, northEast: true, southEast: false, southWest: true }))
      .toEqual({ kind: 'concave', quadrant: 'southEast' });
  });

  it('does not interrupt a straight boundary', () => {
    expect(wallJoint({ northWest: false, northEast: false, southEast: true, southWest: true }))
      .toBeUndefined();
  });

  it('caps diagonal contact without leaving a pinhole', () => {
    expect(wallJoint({ northWest: true, northEast: false, southEast: true, southWest: false }))
      .toEqual({ kind: 'diagonal', diagonal: 'northWestSouthEast' });
  });

  it('closes all four vertices of a rectangular room', () => {
    const open = (x: number, y: number) => x >= 0 && x < 3 && y >= 0 && y < 2;
    const joints: Array<{ x: number; y: number; frame: number }> = [];
    for (let y = 0; y <= 2; y++) {
      for (let x = 0; x <= 3; x++) {
        const kind = wallJoint({
          northWest: open(x - 1, y - 1),
          northEast: open(x, y - 1),
          southEast: open(x, y),
          southWest: open(x - 1, y),
        });
        if (kind) joints.push({ x, y, frame: wallJointFrame(kind) });
      }
    }
    expect(joints).toEqual([
      { x: 0, y: 0, frame: 6 },
      { x: 3, y: 0, frame: 7 },
      { x: 0, y: 2, frame: 5 },
      { x: 3, y: 2, frame: 4 },
    ]);
  });
});

describe('wall rendering policy', () => {
  it('uses the same four edge slots for every modular wall family', () => {
    expect((['north', 'east', 'south', 'west'] as const).map((side) => wallEdgeFrame(side)))
      .toEqual([0, 1, 2, 3]);
  });

  it('maps every oriented corner family to stable atlas frames', () => {
    expect(wallJointFrame({ kind: 'convex', quadrant: 'northWest' })).toBe(4);
    expect(wallJointFrame({ kind: 'convex', quadrant: 'southWest' })).toBe(7);
    expect(wallJointFrame({ kind: 'concave', quadrant: 'northEast' })).toBe(9);
    expect(wallJointFrame({ kind: 'diagonal', diagonal: 'northEastSouthWest' })).toBe(13);
  });

  it('orders mixed vertices from cut corridor to authored room', () => {
    const architectures: TerrainArchitecture[] = [
      'built-room',
      'fortified-chamber',
      'natural-cavern',
      'corridor',
    ];
    expect(architectures.sort((a, b) => architecturePriority(b) - architecturePriority(a)))
      .toEqual(['built-room', 'fortified-chamber', 'natural-cavern', 'corridor']);
  });
});
