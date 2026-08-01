import { describe, expect, it } from 'vitest';
import {
  createWallGauntletLayout,
  topologyDegrees,
  type JointModule,
  type ThresholdModule,
} from '../src/prototypes/spatial/WallGauntletModel';

describe('wall topology gauntlet', () => {
  it('places the exact requested joint frame at every specimen vertex', () => {
    const layout = createWallGauntletLayout();
    const joints = layout.modules.filter((module): module is JointModule => module.kind === 'joint');

    for (const specimen of layout.specimens) {
      const module = joints.find((candidate) => candidate.x === specimen.x && candidate.z === specimen.z);
      expect(module?.frame, specimen.label).toBe(specimen.expectedFrame);
    }
    expect(new Set(layout.specimens.map((specimen) => specimen.expectedFrame)))
      .toEqual(new Set([4, 5, 6, 7, 8, 9, 10, 11, 12, 13]));
  });

  it('renders all four directional edge frames', () => {
    const frames = createWallGauntletLayout().modules
      .filter((module) => module.kind === 'edge')
      .map((module) => module.frame);

    expect(new Set(frames)).toEqual(new Set([0, 1, 2, 3]));
  });

  it('contains straight, L, T and X cells plus one- and two-tile passages', () => {
    const layout = createWallGauntletLayout();
    const degrees = topologyDegrees(layout.cells);

    expect(degrees.get('8,13')).toBe(2);
    expect(degrees.get('16,18')).toBe(2);
    expect(degrees.get('15,13')).toBe(3);
    expect(degrees.get('11,13')).toBe(4);
    expect(layout.cells.some((cell) => cell.x === 8 && cell.z === 13)).toBe(true);
    expect(layout.cells.filter((cell) => cell.x === 14 && (cell.z === 17 || cell.z === 18))).toHaveLength(2);
  });

  it('exposes built, fortified and natural transitions in both stored directions', () => {
    const thresholds = createWallGauntletLayout().modules
      .filter((module): module is ThresholdModule => module.kind === 'threshold');

    expect(thresholds.some((module) => module.family === 'built' && module.frame === 1)).toBe(true);
    expect(thresholds.some((module) => module.family === 'built' && module.frame === 2)).toBe(true);
    expect(thresholds.some((module) => module.family === 'natural' && module.frame === 1)).toBe(true);
  });

  it('changes the authored T into an X without altering the specimen contract', () => {
    const tee = createWallGauntletLayout('corridor', false);
    const cross = createWallGauntletLayout('corridor', true);
    const teeDegrees = topologyDegrees(tee.cells);
    const crossDegrees = topologyDegrees(cross.cells);

    expect(teeDegrees.get('15,13')).toBe(3);
    expect(crossDegrees.get('15,13')).toBe(4);
    expect(cross.cells).toHaveLength(tee.cells.length + 1);
    expect(cross.specimens.map((specimen) => specimen.expectedFrame))
      .toEqual(tee.specimens.map((specimen) => specimen.expectedFrame));
  });
});
