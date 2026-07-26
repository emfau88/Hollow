export interface GridPoint {
  x: number;
  y: number;
}

export interface PathTree {
  distanceTo(point: GridPoint): number;
  pathTo(point: GridPoint): GridPoint[];
}

const reconstructPath = (
  parents: Int32Array,
  width: number,
  goalIndex: number,
): GridPoint[] => {
  if (goalIndex < 0 || parents[goalIndex] === -2) return [];
  const path: GridPoint[] = [];
  let index = goalIndex;
  while (parents[index] !== -1) {
    path.push({ x: index % width, y: Math.floor(index / width) });
    index = parents[index];
  }
  path.reverse();
  return path;
};

/**
 * Builds one breadth-first search tree that can answer many distance and path
 * queries without repeating the map traversal.
 */
export function buildPathTree(
  width: number,
  height: number,
  start: GridPoint,
  passable: (x: number, y: number) => boolean,
): PathTree {
  const size = width * height;
  const parents = new Int32Array(size);
  const distances = new Int32Array(size);
  const queue = new Int32Array(size);
  parents.fill(-2);
  distances.fill(-1);

  if (start.x < 0 || start.y < 0 || start.x >= width || start.y >= height) {
    return {
      distanceTo: () => Number.POSITIVE_INFINITY,
      pathTo: () => [],
    };
  }

  const startIndex = start.y * width + start.x;
  parents[startIndex] = -1;
  distances[startIndex] = 0;
  queue[0] = startIndex;
  let head = 0;
  let tail = 1;

  while (head < tail) {
    const currentIndex = queue[head++];
    const x = currentIndex % width;
    const y = Math.floor(currentIndex / width);
    for (let direction = 0; direction < 4; direction++) {
      const nextX = x + (direction === 0 ? 1 : direction === 1 ? -1 : 0);
      const nextY = y + (direction === 2 ? 1 : direction === 3 ? -1 : 0);
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
      const nextIndex = nextY * width + nextX;
      if (parents[nextIndex] !== -2 || !passable(nextX, nextY)) continue;
      parents[nextIndex] = currentIndex;
      distances[nextIndex] = distances[currentIndex] + 1;
      queue[tail++] = nextIndex;
    }
  }

  const indexOf = (point: GridPoint) => {
    if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) return -1;
    return point.y * width + point.x;
  };

  return {
    distanceTo(point) {
      const index = indexOf(point);
      return index < 0 || distances[index] < 0 ? Number.POSITIVE_INFINITY : distances[index];
    },
    pathTo(point) {
      return reconstructPath(parents, width, indexOf(point));
    },
  };
}

export function findPath(
  width: number,
  height: number,
  start: GridPoint,
  goal: GridPoint,
  passable: (x: number, y: number) => boolean,
): GridPoint[] {
  if (
    start.x < 0 || start.y < 0 || start.x >= width || start.y >= height
    || goal.x < 0 || goal.y < 0 || goal.x >= width || goal.y >= height
  ) return [];
  const size = width * height;
  const parents = new Int32Array(size);
  const queue = new Int32Array(size);
  parents.fill(-2);
  const startIndex = start.y * width + start.x;
  const goalIndex = goal.y * width + goal.x;
  parents[startIndex] = -1;
  queue[0] = startIndex;
  let head = 0;
  let tail = 1;

  while (head < tail) {
    const currentIndex = queue[head++];
    if (currentIndex === goalIndex) return reconstructPath(parents, width, goalIndex);
    const x = currentIndex % width;
    const y = Math.floor(currentIndex / width);
    for (let direction = 0; direction < 4; direction++) {
      const nextX = x + (direction === 0 ? 1 : direction === 1 ? -1 : 0);
      const nextY = y + (direction === 2 ? 1 : direction === 3 ? -1 : 0);
      if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) continue;
      const nextIndex = nextY * width + nextX;
      if (parents[nextIndex] !== -2 || !passable(nextX, nextY)) continue;
      parents[nextIndex] = currentIndex;
      queue[tail++] = nextIndex;
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
