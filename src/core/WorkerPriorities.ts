export type RoutineWorkerTask = 'haul' | 'dig' | 'claim' | 'mine';

/**
 * Three complementary lanes keep a small workforce useful under mixed load.
 * Every lane still contains every task, so workers immediately cover missing
 * jobs instead of becoming rigid specialists.
 */
export function workerTaskOrder(workerIndex: number, foodUrgent: boolean): RoutineWorkerTask[] {
  const lane = ((workerIndex % 3) + 3) % 3;
  if (lane === 0) return ['haul', 'claim', 'dig', 'mine'];
  if (lane === 1) return ['dig', 'claim', 'haul', 'mine'];
  return foodUrgent
    ? ['mine', 'haul', 'claim', 'dig']
    : ['mine', 'haul', 'dig', 'claim'];
}
