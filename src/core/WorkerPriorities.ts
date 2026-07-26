export type RoutineWorkerTask = 'haul' | 'dig' | 'build' | 'claim' | 'mine';
export type WorkPriorityLevel = 0 | 1 | 2;
export type WorkPriorities = Record<RoutineWorkerTask, WorkPriorityLevel>;

export const DEFAULT_WORK_PRIORITIES: WorkPriorities = {
  haul: 1,
  dig: 1,
  build: 1,
  claim: 1,
  mine: 1,
};

/**
 * Three complementary lanes keep a small workforce useful under mixed load.
 * Every lane still contains every task, so workers immediately cover missing
 * jobs instead of becoming rigid specialists.
 */
export function workerTaskOrder(
  workerIndex: number,
  foodUrgent: boolean,
  priorities: WorkPriorities = DEFAULT_WORK_PRIORITIES,
): RoutineWorkerTask[] {
  const lane = ((workerIndex % 3) + 3) % 3;
  const base: RoutineWorkerTask[] = lane === 0
    ? ['haul', 'build', 'claim', 'dig', 'mine']
    : lane === 1
      ? ['dig', 'build', 'claim', 'haul', 'mine']
      : foodUrgent
        ? ['mine', 'haul', 'build', 'claim', 'dig']
        : ['mine', 'haul', 'build', 'dig', 'claim'];
  return [...base].sort((a, b) => priorities[b] - priorities[a] || base.indexOf(a) - base.indexOf(b));
}
