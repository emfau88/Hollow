import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Textures: {
      FilterMode: { LINEAR: 'linear' },
    },
  },
}));

import {
  TerrainRenderer,
  type TerrainAssetKeys,
  type TerrainControl,
  type TerrainFloor,
  type TerrainMaterial,
  type TerrainQuery,
  type TerrainVisibility,
} from '../src/core/TerrainRenderer';
import type { TerrainArchitecture } from '../src/core/TerrainArchitecture';

class MockImage {
  textureKey: string;
  frame: number;
  x = 0;
  y = 0;
  alpha = 1;
  depth = 0;
  active = true;
  visible = true;

  constructor(textureKey = '', frame = 0) {
    this.textureKey = textureKey;
    this.frame = frame;
  }

  setOrigin(): this { return this; }
  setRotation(): this { return this; }
  setScale(): this { return this; }
  setTexture(textureKey: string, frame = 0): this {
    this.textureKey = textureKey;
    this.frame = frame;
    return this;
  }
  setPosition(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }
  setAlpha(alpha: number): this {
    this.alpha = alpha;
    return this;
  }
  setDepth(depth: number): this {
    this.depth = depth;
    return this;
  }
  setActive(active: boolean): this {
    this.active = active;
    return this;
  }
  setVisible(visible: boolean): this {
    this.visible = visible;
    return this;
  }
}

class MockRenderTexture {
  texture = { setFilter: vi.fn() };
  setOrigin(): this { return this; }
  setDepth(): this { return this; }
  clear(): this { return this; }
  draw(): this { return this; }
}

function mockScene(): object {
  return {
    add: {
      renderTexture: () => new MockRenderTexture(),
      image: (_x: number, _y: number, textureKey: string, frame = 0) => new MockImage(textureKey, frame),
    },
    make: {
      image: ({ key }: { key: string }) => new MockImage(key),
    },
  };
}

const ASSETS: TerrainAssetKeys = {
  rock: 'rock',
  rockBasalt: 'rock-basalt',
  rockDamp: 'rock-damp',
  rockRoots: 'rock-roots',
  rockEarth: 'rock-earth',
  rawFloor: 'raw-floor',
  dampFloor: 'damp-floor',
  claimedCorridor: 'claimed-corridor',
  claimedFloor: 'claimed-floor',
  wallEdge: 'wall-edge',
  wallCorner: 'wall-corner',
  claimedBorder: 'claimed-border',
  enemyBorder: 'enemy-border',
  wallAtlas: 'walls-built',
  neutralWallAtlas: 'walls-fortified',
  naturalWallAtlas: 'walls-natural',
  corridorWallAtlas: 'walls-corridor',
  builtThresholdAtlas: 'threshold-built',
  naturalThresholdAtlas: 'threshold-natural',
  wallOcclusionAtlas: 'occlusion-built',
  neutralWallOcclusionAtlas: 'occlusion-fortified',
  naturalWallOcclusionAtlas: 'occlusion-natural',
  corridorWallOcclusionAtlas: 'occlusion-corridor',
  wallOcclusionDepth: 34,
};

interface CellState {
  open: boolean;
  visibility: TerrainVisibility;
  control: TerrainControl;
  material: TerrainMaterial;
  floor: TerrainFloor;
  architecture: TerrainArchitecture;
}

const DEFAULT_CELL: CellState = {
  open: false,
  visibility: 'revealed',
  control: 'neutral',
  material: 'slate',
  floor: 'raw',
  architecture: 'corridor',
};

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

class MutableTerrainQuery implements TerrainQuery {
  private cells = new Map<string, CellState>();

  setCell(x: number, y: number, update: Partial<CellState>): void {
    const previous = this.cells.get(cellKey(x, y)) ?? DEFAULT_CELL;
    this.cells.set(cellKey(x, y), { ...previous, ...update });
  }

  private at(x: number, y: number): CellState {
    return this.cells.get(cellKey(x, y)) ?? DEFAULT_CELL;
  }

  isOpen(x: number, y: number): boolean { return this.at(x, y).open; }
  visibilityAt(x: number, y: number): TerrainVisibility { return this.at(x, y).visibility; }
  controlAt(x: number, y: number): TerrainControl { return this.at(x, y).control; }
  materialAt(x: number, y: number): TerrainMaterial { return this.at(x, y).material; }
  floorAt(x: number, y: number): TerrainFloor { return this.at(x, y).floor; }
  architectureAt(x: number, y: number): TerrainArchitecture { return this.at(x, y).architecture; }
}

interface RendererInternals {
  wallEdgeSprites: Map<string, MockImage>;
  wallJointSprites: Map<string, MockImage>;
  wallOcclusionEdgeSprites: Map<string, MockImage>;
  wallOcclusionJointSprites: Map<string, MockImage>;
  transitionSprites: Map<string, MockImage>;
}

interface SpriteSnapshot {
  key: string;
  texture: string;
  frame: number;
  x: number;
  y: number;
  alpha: number;
  depth: number;
}

function mapSnapshot(map: Map<string, MockImage>): SpriteSnapshot[] {
  return [...map.entries()]
    .map(([key, sprite]) => ({
      key,
      texture: sprite.textureKey,
      frame: sprite.frame,
      x: sprite.x,
      y: sprite.y,
      alpha: sprite.alpha,
      depth: sprite.depth,
    }))
    .sort((first, second) => first.key.localeCompare(second.key));
}

function wallLayoutSnapshot(renderer: TerrainRenderer): Record<string, SpriteSnapshot[]> {
  const internals = renderer as unknown as RendererInternals;
  return {
    edges: mapSnapshot(internals.wallEdgeSprites),
    joints: mapSnapshot(internals.wallJointSprites),
    occlusionEdges: mapSnapshot(internals.wallOcclusionEdgeSprites),
    occlusionJoints: mapSnapshot(internals.wallOcclusionJointSprites),
    thresholds: mapSnapshot(internals.transitionSprites),
  };
}

function createRenderer(width = 7, height = 7): TerrainRenderer {
  return new TerrainRenderer(mockScene() as never, ASSETS, 32, width, height);
}

function parsePoint(point: string): { x: number; y: number } {
  const [x, y] = point.split(',').map(Number);
  return { x, y };
}

function setOpenShape(query: MutableTerrainQuery, points: readonly string[]): void {
  for (const point of points) {
    const { x, y } = parsePoint(point);
    query.setCell(x, y, { open: true, architecture: 'corridor' });
  }
}

describe('TerrainRenderer incremental modular wall layout', () => {
  it.each([
    ['L bend', ['2,2', '3,2'], ['2,2', '3,2', '3,3']],
    ['T junction', ['2,3', '3,3', '4,3'], ['2,3', '3,3', '4,3', '3,4']],
    ['diagonal contact', ['2,2'], ['2,2', '3,3']],
    ['split corridor', ['2,3', '3,3', '4,3'], ['2,3', '4,3']],
  ] as const)('matches a full render after changing a %s', (_label, before, after) => {
    const beforePoints: readonly string[] = before;
    const afterPoints: readonly string[] = after;
    const query = new MutableTerrainQuery();
    setOpenShape(query, beforePoints);
    const incremental = createRenderer();
    incremental.render(query);

    const changed = new Set(
      [...beforePoints, ...afterPoints]
        .filter((point) => beforePoints.includes(point) !== afterPoints.includes(point)),
    );
    for (const point of changed) {
      const { x, y } = parsePoint(point);
      query.setCell(x, y, { open: afterPoints.includes(point), architecture: 'corridor' });
    }
    incremental.renderTiles(query, [...changed].map(parsePoint));

    const complete = createRenderer();
    complete.render(query);
    expect(wallLayoutSnapshot(incremental)).toEqual(wallLayoutSnapshot(complete));
  });

  it('makes built, fortified, and natural corridor thresholds reachable and updates them locally', () => {
    const query = new MutableTerrainQuery();
    for (const [x, y, architecture, control] of [
      [1, 1, 'corridor', 'neutral'],
      [2, 1, 'built-room', 'owned'],
      [4, 1, 'corridor', 'neutral'],
      [4, 2, 'natural-cavern', 'neutral'],
      [1, 4, 'corridor', 'neutral'],
      [2, 4, 'fortified-chamber', 'enemy'],
    ] as const) {
      query.setCell(x, y, { open: true, architecture, control });
    }

    const incremental = createRenderer();
    incremental.render(query);
    const initialThresholds = wallLayoutSnapshot(incremental).thresholds;
    expect(initialThresholds.map(({ key, texture, frame }) => ({ key, texture, frame }))).toEqual([
      { key: '1,1:east', texture: 'threshold-built', frame: 1 },
      { key: '1,4:east', texture: 'threshold-built', frame: 1 },
      { key: '4,1:south', texture: 'threshold-natural', frame: 2 },
    ]);

    query.setCell(4, 2, { architecture: 'built-room', control: 'owned' });
    incremental.renderTiles(query, [{ x: 4, y: 2 }]);
    const complete = createRenderer();
    complete.render(query);

    expect(wallLayoutSnapshot(incremental)).toEqual(wallLayoutSnapshot(complete));
    expect(wallLayoutSnapshot(incremental).thresholds.map(({ texture }) => texture))
      .toEqual(['threshold-built', 'threshold-built', 'threshold-built']);
  });
});
