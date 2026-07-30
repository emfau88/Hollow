import { describe, expect, it } from 'vitest';
import { WorkerJobBoard } from '../src/core/JobSystem';

const digJob = {
  id: 'dig:2,2',
  category: 'dig' as const,
  action: 'dig' as const,
  target: { x: 2, y: 2 },
};

describe('persistent worker job board', () => {
  it('preserves valid reservations across world syncs', () => {
    const board = new WorkerJobBoard();
    board.sync([digJob], 0);
    expect(board.reserve(digJob.id, 7, 0)).toBe(true);

    board.sync([digJob], 1);
    expect(board.available('dig', 8, 1)).toEqual([]);
    expect(board.available('dig', 7, 1)[0]?.id).toBe(digJob.id);
  });

  it('expires a reservation without progress', () => {
    const board = new WorkerJobBoard(5);
    board.sync([digJob], 0);
    board.reserve(digJob.id, 7, 0);

    expect(board.available('dig', 8, 4.9)).toEqual([]);
    expect(board.available('dig', 8, 5)[0]?.id).toBe(digJob.id);
  });

  it('supports bounded multi-worker jobs and explicit completion', () => {
    const board = new WorkerJobBoard();
    board.sync([{ ...digJob, maxWorkers: 2 }], 0);
    expect(board.reserve(digJob.id, 1, 0)).toBe(true);
    expect(board.reserve(digJob.id, 2, 0)).toBe(true);
    expect(board.reserve(digJob.id, 3, 0)).toBe(false);

    board.complete(digJob.id);
    expect(board.stats(0).total).toBe(0);
  });
});
