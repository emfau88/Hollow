import { describe, expect, it } from 'vitest';
import { workerTaskOrder } from '../src/core/WorkerPriorities';

describe('worker task lanes', () => {
  it('covers logistics, excavation and mining with the three starting workers', () => {
    expect(workerTaskOrder(0, true)[0]).toBe('haul');
    expect(workerTaskOrder(1, true)[0]).toBe('dig');
    expect(workerTaskOrder(2, true)[0]).toBe('mine');
  });

  it('keeps claiming as a fallback in every lane', () => {
    for (let index = 0; index < 6; index++) {
      expect(workerTaskOrder(index, false)).toContain('claim');
    }
  });

  it('prioritizes mining for the resource lane when food is urgent', () => {
    expect(workerTaskOrder(2, true)).toEqual(['mine', 'haul', 'build', 'claim', 'dig']);
  });

  it('moves a player-prioritized task to the front without removing other work', () => {
    const priorities = { haul: 1, dig: 1, build: 2, claim: 0, mine: 1 } as const;
    const order = workerTaskOrder(2, false, priorities);
    expect(order[0]).toBe('build');
    expect(order).toContain('claim');
  });
});
