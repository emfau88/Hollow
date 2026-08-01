import Phaser from 'phaser';
import { wallJoint, wallSides, type WallJoint, type WallSide } from './WallLayout';

export type TerrainControl = 'neutral' | 'claiming' | 'owned' | 'enemy';
export type TerrainVisibility = 'hidden' | 'charted' | 'revealed';
export type TerrainMaterial = 'slate' | 'basalt' | 'damp' | 'roots' | 'earth';
export type TerrainFloor = 'raw' | 'claimed' | 'room';

export interface TerrainQuery {
  isOpen(x: number, y: number): boolean;
  visibilityAt(x: number, y: number): TerrainVisibility;
  controlAt(x: number, y: number): TerrainControl;
  materialAt(x: number, y: number): TerrainMaterial;
  floorAt(x: number, y: number): TerrainFloor;
}

interface TerrainPoint {
  x: number;
  y: number;
}

export interface TerrainAssetKeys {
  rock: string;
  rockBasalt: string;
  rockDamp: string;
  rockRoots: string;
  rockEarth: string;
  rawFloor: string;
  dampFloor: string;
  claimedCorridor: string;
  claimedFloor: string;
  wallEdge: string;
  wallCorner: string;
  claimedBorder: string;
  enemyBorder: string;
  wallAtlas?: string;
  wallNorth?: string;
  wallEast?: string;
  wallSouth?: string;
  wallWest?: string;
  wallNorthEast?: string;
  wallEastSouth?: string;
  wallSouthWest?: string;
  wallWestNorth?: string;
}

const SURFACE_SHEET_TILES = 16;
const WALL_ATLAS_FRAMES: Record<WallSide | WallJoint, number> = {
  north: 0,
  east: 1,
  south: 2,
  west: 3,
  convex: 4,
  concave: 5,
  diagonal: 6,
};

/**
 * Asset-backed terrain renderer. Every visible world surface and edge comes
 * from a PNG source; code only selects frames and rotates modular overlays.
 */
export class TerrainRenderer {
  private rt: Phaser.GameObjects.RenderTexture;
  private stamp: Phaser.GameObjects.Image;
  private overlayStamp: Phaser.GameObjects.Image;
  private wallEdgeSprites = new Map<string, Phaser.GameObjects.Image>();
  private wallJointSprites = new Map<string, Phaser.GameObjects.Image>();
  private wallSpritePool: Phaser.GameObjects.Image[] = [];

  constructor(
    private scene: Phaser.Scene,
    private assets: TerrainAssetKeys,
    private tile: number,
    private width: number,
    private height: number,
  ) {
    this.rt = scene.add
      .renderTexture(0, 0, width * tile, height * tile)
      .setOrigin(0, 0)
      .setDepth(0);
    if (assets.wallAtlas) this.rt.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
    this.stamp = scene.make.image({ key: assets.rock }, false).setOrigin(0, 0);
    this.overlayStamp = scene.make.image({ key: assets.wallEdge }, false).setOrigin(0.5, 0.5);
  }

  /** The material sheets are continuous 16x16 grids of final-size 32px frames. */
  private drawSurface(key: string, x: number, y: number, alpha = 1): void {
    const frame = (y % SURFACE_SHEET_TILES) * SURFACE_SHEET_TILES + (x % SURFACE_SHEET_TILES);
    this.stamp.setTexture(key, frame).setScale(1).setAlpha(alpha);
    this.rt.draw(this.stamp, x * this.tile, y * this.tile);
  }

  private rockKey(material: TerrainMaterial): string {
    if (material === 'basalt') return this.assets.rockBasalt;
    if (material === 'damp') return this.assets.rockDamp;
    if (material === 'roots') return this.assets.rockRoots;
    if (material === 'earth') return this.assets.rockEarth;
    return this.assets.rock;
  }

  private isWall(q: TerrainQuery, x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return true;
    return !q.isOpen(x, y) || q.visibilityAt(x, y) === 'hidden';
  }

  private drawOverlay(key: string, x: number, y: number, quarterTurns: number, alpha = 1): void {
    this.overlayStamp
      .setTexture(key)
      .setRotation(quarterTurns * Math.PI / 2)
      .setScale(1)
      .setAlpha(alpha);
    this.rt.draw(this.overlayStamp, x * this.tile + this.tile / 2, y * this.tile + this.tile / 2);
  }

  private drawWallEdges(q: TerrainQuery, x: number, y: number, alpha = 1): void {
    if (this.assets.wallAtlas) return;
    const n = this.isWall(q, x, y - 1);
    const e = this.isWall(q, x + 1, y);
    const s = this.isWall(q, x, y + 1);
    const w = this.isWall(q, x - 1, y);
    const directional = this.assets.wallNorth
      && this.assets.wallEast
      && this.assets.wallSouth
      && this.assets.wallWest;

    if (directional) {
      const keys: Record<WallSide, string> = {
        north: this.assets.wallNorth!,
        east: this.assets.wallEast!,
        south: this.assets.wallSouth!,
        west: this.assets.wallWest!,
      };
      for (const part of wallSides({ north: n, east: e, south: s, west: w })) {
        this.drawOverlay(keys[part], x, y, 0, alpha);
      }
      return;
    }

    const count = Number(n) + Number(e) + Number(s) + Number(w);

    // The authored L-piece prevents the darkest wall faces from doubling in
    // the most common two-edge corners.
    if (count === 2 && n && e) {
      this.drawOverlay(this.assets.wallCorner, x, y, 0, alpha);
      return;
    }
    if (count === 2 && e && s) {
      this.drawOverlay(this.assets.wallCorner, x, y, 1, alpha);
      return;
    }
    if (count === 2 && s && w) {
      this.drawOverlay(this.assets.wallCorner, x, y, 2, alpha);
      return;
    }
    if (count === 2 && w && n) {
      this.drawOverlay(this.assets.wallCorner, x, y, 3, alpha);
      return;
    }

    if (n) this.drawOverlay(this.assets.wallEdge, x, y, 0, alpha);
    if (e) this.drawOverlay(this.assets.wallEdge, x, y, 1, alpha);
    if (s) this.drawOverlay(this.assets.wallEdge, x, y, 2, alpha);
    if (w) this.drawOverlay(this.assets.wallEdge, x, y, 3, alpha);
  }

  private sidesAt(q: TerrainQuery, x: number, y: number): WallSide[] {
    return wallSides({
      north: this.isWall(q, x, y - 1),
      east: this.isWall(q, x + 1, y),
      south: this.isWall(q, x, y + 1),
      west: this.isWall(q, x - 1, y),
    });
  }

  private isVisibleOpen(q: TerrainQuery, x: number, y: number): boolean {
    return x >= 0
      && y >= 0
      && x < this.width
      && y < this.height
      && q.isOpen(x, y)
      && q.visibilityAt(x, y) !== 'hidden';
  }

  private releaseSprite(map: Map<string, Phaser.GameObjects.Image>, key: string): void {
    const sprite = map.get(key);
    if (!sprite) return;
    sprite.setActive(false).setVisible(false);
    this.wallSpritePool.push(sprite);
    map.delete(key);
  }

  private acquireWallSprite(frame: number, x: number, y: number, alpha: number, depth: number): Phaser.GameObjects.Image {
    const sprite = this.wallSpritePool.pop()
      ?? this.scene.add.image(0, 0, this.assets.wallAtlas!, frame).setOrigin(0.5);
    return sprite
      .setTexture(this.assets.wallAtlas!, frame)
      .setPosition(x, y)
      .setAlpha(alpha)
      .setDepth(depth)
      .setActive(true)
      .setVisible(true);
  }

  private edgeKey(x: number, y: number, side: WallSide): string {
    return `${x},${y}:${side}`;
  }

  private jointKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  private updateWallEdges(q: TerrainQuery, x: number, y: number): void {
    if (!this.assets.wallAtlas) return;
    for (const side of ['north', 'east', 'south', 'west'] as const) {
      this.releaseSprite(this.wallEdgeSprites, this.edgeKey(x, y, side));
    }
    const visibility = q.visibilityAt(x, y);
    if (!q.isOpen(x, y) || visibility === 'hidden') return;

    const alpha = visibility === 'charted' ? 0.66 : 1;
    for (const side of this.sidesAt(q, x, y)) {
      let worldX = x * this.tile + this.tile / 2;
      let worldY = y * this.tile + this.tile / 2;
      if (side === 'north') worldY = y * this.tile;
      if (side === 'east') worldX = (x + 1) * this.tile;
      if (side === 'south') worldY = (y + 1) * this.tile;
      if (side === 'west') worldX = x * this.tile;
      const key = this.edgeKey(x, y, side);
      this.wallEdgeSprites.set(
        key,
        this.acquireWallSprite(WALL_ATLAS_FRAMES[side], worldX, worldY, alpha, 2),
      );
    }
  }

  private updateWallJoint(q: TerrainQuery, x: number, y: number): void {
    if (!this.assets.wallAtlas) return;
    const key = this.jointKey(x, y);
    this.releaseSprite(this.wallJointSprites, key);
    const cells = {
      northWest: this.isVisibleOpen(q, x - 1, y - 1),
      northEast: this.isVisibleOpen(q, x, y - 1),
      southEast: this.isVisibleOpen(q, x, y),
      southWest: this.isVisibleOpen(q, x - 1, y),
    };
    const kind = wallJoint(cells);
    if (!kind) return;

    const visibleCells = [
      [x - 1, y - 1, cells.northWest],
      [x, y - 1, cells.northEast],
      [x, y, cells.southEast],
      [x - 1, y, cells.southWest],
    ] as const;
    const revealed = visibleCells.some(([cellX, cellY, open]) => open && q.visibilityAt(cellX, cellY) === 'revealed');
    this.wallJointSprites.set(
      key,
      this.acquireWallSprite(WALL_ATLAS_FRAMES[kind], x * this.tile, y * this.tile, revealed ? 1 : 0.66, 2.1),
    );
  }

  private clearWallSprites(): void {
    for (const key of [...this.wallEdgeSprites.keys()]) this.releaseSprite(this.wallEdgeSprites, key);
    for (const key of [...this.wallJointSprites.keys()]) this.releaseSprite(this.wallJointSprites, key);
  }

  private hasSameControl(q: TerrainQuery, x: number, y: number, control: TerrainControl): boolean {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return false;
    return q.isOpen(x, y) && q.visibilityAt(x, y) === 'revealed' && q.controlAt(x, y) === control;
  }

  /**
   * Ownership is a continuous perimeter, never a grid around every tile.
   * The thin image-generated trim stays legible without competing with walls.
   */
  private drawControlEdges(q: TerrainQuery, x: number, y: number): void {
    const control = q.controlAt(x, y);
    if (control !== 'owned' && control !== 'enemy' && control !== 'claiming') return;
    // Style B communicates ownership through its plum room floor. Keeping the
    // old orange dashed perimeter on top of the architectural walls made the
    // starting chamber look like a debug overlay; enemy borders stay visible.
    if (control !== 'enemy' && this.assets.wallNorth) return;
    const key = control === 'enemy' ? this.assets.enemyBorder : this.assets.claimedBorder;
    const alpha = control === 'claiming' ? 0.55 : 1;

    if (!this.hasSameControl(q, x, y - 1, control)) this.drawOverlay(key, x, y, 0, alpha);
    if (!this.hasSameControl(q, x + 1, y, control)) this.drawOverlay(key, x, y, 1, alpha);
    if (!this.hasSameControl(q, x, y + 1, control)) this.drawOverlay(key, x, y, 2, alpha);
    if (!this.hasSameControl(q, x - 1, y, control)) this.drawOverlay(key, x, y, 3, alpha);
  }

  private drawBase(q: TerrainQuery, x: number, y: number): void {
    const visibility = q.visibilityAt(x, y);
    const open = q.isOpen(x, y);
    const rock = this.rockKey(q.materialAt(x, y));
    if (!open || visibility === 'hidden') {
      this.drawSurface(rock, x, y);
      return;
    }

    const damp = q.materialAt(x, y) === 'damp';
    if (visibility === 'charted') {
      this.drawSurface(rock, x, y);
      this.drawSurface(damp ? this.assets.dampFloor : this.assets.rawFloor, x, y, damp ? 0.9 : 0.72);
      return;
    }

    const floor = q.floorAt(x, y);
    const floorKey = floor === 'room'
      ? this.assets.claimedFloor
      : damp
        ? this.assets.dampFloor
      : floor === 'claimed'
        ? this.assets.claimedCorridor
        : this.assets.rawFloor;
    this.drawSurface(floorKey, x, y);
  }

  private drawEdges(q: TerrainQuery, x: number, y: number): void {
    const visibility = q.visibilityAt(x, y);
    if (!q.isOpen(x, y) || visibility === 'hidden') return;
    this.drawWallEdges(q, x, y, visibility === 'charted' ? 0.58 : 1);
    if (visibility === 'revealed') this.drawControlEdges(q, x, y);
  }

  render(q: TerrainQuery): void {
    this.rt.clear();
    this.clearWallSprites();

    // Pass 1: a single continuous rock mass, replaced only by revealed floors.
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.drawBase(q, x, y);
      }
    }

    // Pass 2: authored cliff lips make the traversable silhouette immediate.
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const visibility = q.visibilityAt(x, y);
        if (q.isOpen(x, y) && visibility !== 'hidden') {
          if (this.assets.wallAtlas) this.updateWallEdges(q, x, y);
          else this.drawWallEdges(q, x, y, visibility === 'charted' ? 0.58 : 1);
        }
      }
    }

    // Pass 2b: corners live on shared grid vertices. This is the important
    // distinction from the old tile-centred L-sprites and guarantees closed
    // rectangle corners, passage necks and freshly excavated connections.
    if (this.assets.wallAtlas) {
      for (let y = 0; y <= this.height; y++) {
        for (let x = 0; x <= this.width; x++) this.updateWallJoint(q, x, y);
      }
    }

    // Pass 3: faction trims communicate ownership independently of floor hue.
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        if (q.isOpen(x, y) && q.visibilityAt(x, y) === 'revealed') this.drawControlEdges(q, x, y);
      }
    }
  }

  /**
   * Repaints a changed tile and its direct neighbours. Surfaces are opaque, so
   * the base pass also removes obsolete edge overlays before fresh edges are
   * stamped. A single claim/build/dig update therefore touches at most 9 tiles
   * plus the 16 shared vertices around that local patch.
   */
  renderTiles(q: TerrainQuery, changed: TerrainPoint[]): void {
    const dirty = new Set<number>();
    for (const point of changed) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const x = point.x + dx;
          const y = point.y + dy;
          if (x >= 0 && y >= 0 && x < this.width && y < this.height) dirty.add(y * this.width + x);
        }
      }
    }
    for (const index of dirty) this.drawBase(q, index % this.width, Math.floor(index / this.width));
    for (const index of dirty) this.drawEdges(q, index % this.width, Math.floor(index / this.width));
    if (this.assets.wallAtlas) {
      const dirtyVertices = new Set<string>();
      for (const index of dirty) {
        const x = index % this.width;
        const y = Math.floor(index / this.width);
        this.updateWallEdges(q, x, y);
        dirtyVertices.add(this.jointKey(x, y));
        dirtyVertices.add(this.jointKey(x + 1, y));
        dirtyVertices.add(this.jointKey(x, y + 1));
        dirtyVertices.add(this.jointKey(x + 1, y + 1));
      }
      for (const key of dirtyVertices) {
        const [x, y] = key.split(',').map(Number);
        this.updateWallJoint(q, x, y);
      }
    }
  }
}
