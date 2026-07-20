export interface GridPoint {
  x: number;
  y: number;
}

const key = (x: number, y: number) => `${x},${y}`;

export function findPath(
  width: number,
  height: number,
  start: GridPoint,
  goal: GridPoint,
  passable: (x: number, y: number) => boolean,
): GridPoint[] {
  const queue: GridPoint[] = [start];
  const parents = new Map<string, GridPoint | null>([[key(start.x, start.y), null]]);
  let cursor = 0;

  while (cursor < queue.length) {
    const current = queue[cursor++];
    if (current.x === goal.x && current.y === goal.y) {
      const result: GridPoint[] = [];
      let step: GridPoint | null = current;
      while (step) {
        result.push(step);
        step = parents.get(key(step.x, step.y)) ?? null;
      }
      return result.reverse().slice(1);
    }

    for (const next of [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ]) {
      const nextKey = key(next.x, next.y);
      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= width ||
        next.y >= height ||
        parents.has(nextKey) ||
        !passable(next.x, next.y)
      ) {
        continue;
      }
      parents.set(nextKey, current);
      queue.push(next);
    }
  }
  return [];
}

export function manhattan(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function lineRoute(start: GridPoint, end: GridPoint, horizontalFirst = true): GridPoint[] {
  const points: GridPoint[] = [];
  const pushAxis = (axis: 'x' | 'y') => {
    const other = axis === 'x' ? 'y' : 'x';
    const fixed = axis === 'x' ? end.x : end.y;
    const from = axis === 'x' ? start.x : start.y;
    const direction = Math.sign(fixed - from);
    if (!direction) return;
    for (let value = from; value !== fixed + direction; value += direction) {
      points.push(
        axis === 'x'
          ? { x: value, y: points.at(-1)?.[other] ?? start.y }
          : { x: points.at(-1)?.[other] ?? start.x, y: value },
      );
    }
  };

  if (horizontalFirst) {
    pushAxis('x');
    const corner = points.at(-1) ?? start;
    const direction = Math.sign(end.y - corner.y);
    for (let y = corner.y + direction; direction && y !== end.y + direction; y += direction) {
      points.push({ x: end.x, y });
    }
  } else {
    pushAxis('y');
    const corner = points.at(-1) ?? start;
    const direction = Math.sign(end.x - corner.x);
    for (let x = corner.x + direction; direction && x !== end.x + direction; x += direction) {
      points.push({ x, y: end.y });
    }
  }
  return points;
}
