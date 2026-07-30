import type { GridPoint } from './Grid';
import type { RoutineWorkerTask } from './WorkerPriorities';

export type WorkerJobAction = 'dig' | 'build' | 'claim' | 'mine' | 'haul' | 'supply';
export type DeliveryKind = 'storage' | 'heart' | 'room' | 'trap';

export interface WorkerJobSpec {
  id: string;
  category: RoutineWorkerTask;
  action: WorkerJobAction;
  target: GridPoint;
  targetId?: string | number;
  destination?: DeliveryKind;
  destinationId?: number;
  priority?: number;
  maxWorkers?: number;
}

export interface WorkerJob extends WorkerJobSpec {
  priority: number;
  maxWorkers: number;
  reservations: Map<number, number>;
  updatedAt: number;
}

export interface JobBoardStats {
  total: number;
  reserved: number;
  byCategory: Record<RoutineWorkerTask, number>;
}

const categories: RoutineWorkerTask[] = ['haul', 'dig', 'build', 'claim', 'mine'];

/**
 * Persistent simulation-side job registry. Syncing updates the current world
 * offers while keeping valid reservations and their progress timestamps.
 */
export class WorkerJobBoard {
  private jobs = new Map<string, WorkerJob>();

  constructor(private reservationTimeout = 5) {}

  sync(specs: WorkerJobSpec[], now: number): void {
    const activeIds = new Set<string>();
    for (const spec of specs) {
      activeIds.add(spec.id);
      const existing = this.jobs.get(spec.id);
      if (existing) {
        existing.category = spec.category;
        existing.action = spec.action;
        existing.target = spec.target;
        existing.targetId = spec.targetId;
        existing.destination = spec.destination;
        existing.destinationId = spec.destinationId;
        existing.priority = spec.priority ?? 0;
        existing.maxWorkers = spec.maxWorkers ?? 1;
        existing.updatedAt = now;
        continue;
      }
      this.jobs.set(spec.id, {
        ...spec,
        priority: spec.priority ?? 0,
        maxWorkers: spec.maxWorkers ?? 1,
        reservations: new Map(),
        updatedAt: now,
      });
    }
    for (const id of this.jobs.keys()) {
      if (!activeIds.has(id)) this.jobs.delete(id);
    }
    this.expireReservations(now);
  }

  available(category: RoutineWorkerTask, workerId: number, now: number): WorkerJob[] {
    this.expireReservations(now);
    return [...this.jobs.values()]
      .filter((job) =>
        job.category === category
        && (job.reservations.has(workerId) || job.reservations.size < job.maxWorkers))
      .sort((a, b) => b.priority - a.priority || a.updatedAt - b.updatedAt);
  }

  reserve(jobId: string, workerId: number, now: number): boolean {
    const job = this.jobs.get(jobId);
    if (!job) return false;
    this.expireReservations(now);
    if (!job.reservations.has(workerId) && job.reservations.size >= job.maxWorkers) return false;
    job.reservations.set(workerId, now);
    return true;
  }

  touch(jobId: string | undefined, workerId: number, now: number): void {
    if (!jobId) return;
    const job = this.jobs.get(jobId);
    if (job?.reservations.has(workerId)) job.reservations.set(workerId, now);
  }

  releaseWorker(workerId: number): void {
    for (const job of this.jobs.values()) job.reservations.delete(workerId);
  }

  complete(jobId: string | undefined): void {
    if (jobId) this.jobs.delete(jobId);
  }

  get(jobId: string | undefined): WorkerJob | undefined {
    return jobId ? this.jobs.get(jobId) : undefined;
  }

  stats(now: number): JobBoardStats {
    this.expireReservations(now);
    const byCategory = Object.fromEntries(categories.map((category) => [category, 0])) as Record<RoutineWorkerTask, number>;
    let reserved = 0;
    for (const job of this.jobs.values()) {
      byCategory[job.category]++;
      reserved += job.reservations.size;
    }
    return { total: this.jobs.size, reserved, byCategory };
  }

  private expireReservations(now: number): void {
    for (const job of this.jobs.values()) {
      for (const [workerId, lastProgress] of job.reservations) {
        if (now - lastProgress >= this.reservationTimeout) job.reservations.delete(workerId);
      }
    }
  }
}
