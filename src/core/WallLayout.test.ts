import { describe, expect, it } from 'vitest';
import { wallParts } from './WallLayout';

describe('wallParts', () => {
  it('keeps a vertical corridor open with symmetric side walls', () => {
    expect(wallParts({ north: false, east: true, south: false, west: true }))
      .toEqual(['east', 'west']);
  });

  it('uses exactly one L-piece for a simple room corner', () => {
    expect(wallParts({ north: true, east: true, south: false, west: false }))
      .toEqual(['north-east']);
    expect(wallParts({ north: false, east: true, south: true, west: false }))
      .toEqual(['east-south']);
    expect(wallParts({ north: false, east: false, south: true, west: true }))
      .toEqual(['south-west']);
    expect(wallParts({ north: true, east: false, south: false, west: true }))
      .toEqual(['west-north']);
  });

  it('does not stack corner sprites across a dead-end opening', () => {
    expect(wallParts({ north: true, east: true, south: true, west: false }))
      .toEqual(['north', 'east', 'south']);
  });

  it('uses four straight sides only for an isolated open tile', () => {
    expect(wallParts({ north: true, east: true, south: true, west: true }))
      .toEqual(['north', 'east', 'south', 'west']);
  });
});
