import Phaser from 'phaser';

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

/**
 * Asset-backed terrain renderer. Every visible world surface and edge comes
 * from a PNG source; code only selects frames and rotates modular overlays.
 */
export class TerrainRenderer {
  private rt: Phaser.GameObjects.RenderTexture;
  private stamp: Phaser.GameObjects.Image;
  private overlayStamp: Phaser.GameObjects.Image;

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
    const n = this.isWall(q, x, y - 1);
    const e = this.isWall(q, x + 1, y);
    const s = this.isWall(q, x, y + 1);
    const w = this.isWall(q, x - 1, y);
    const count = Number(n) + Number(e) + Number(s) + Number(w);
    const directional = this.assets.wallNorth
      && this.assets.wallEast
      && this.assets.wallSouth
      && this.assets.wallWest
      && this.assets.wallNorthEast
      && this.assets.wallEastSouth
      && this.assets.wallSouthWest
      && this.assets.wallWestNorth;

    if (directional) {
      // Every adjacent pair gets a complete authored L. This also closes the
      // two joints at dead ends (three walls) and all four joints of an
      // isolated open tile instead of leaving a transparent square at them.
      let cornerCount = 0;
      if (n && e) {
        this.drawOverlay(this.assets.wallNorthEast!, x, y, 0, alpha);
        cornerCount += 1;
      }
      if (e && s) {
        this.drawOverlay(this.assets.wallEastSouth!, x, y, 0, alpha);
        cornerCount += 1;
      }
      if (s && w) {
        this.drawOverlay(this.assets.wallSouthWest!, x, y, 0, alpha);
        cornerCount += 1;
      }
      if (w && n) {
        this.drawOverlay(this.assets.wallWestNorth!, x, y, 0, alpha);
        cornerCount += 1;
      }
      if (cornerCount > 0) return;

      // Single edges and opposing pairs have no corner joint.
      if (n) this.drawOverlay(this.assets.wallNorth!, x, y, 0, alpha);
      if (e) this.drawOverlay(this.assets.wallEast!, x, y, 0, alpha);
      if (s) this.drawOverlay(this.assets.wallSouth!, x, y, 0, alpha);
      if (w) this.drawOverlay(this.assets.wallWest!, x, y, 0, alpha);
      return;
    }

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
          this.drawWallEdges(q, x, y, visibility === 'charted' ? 0.58 : 1);
        }
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
   * stamped. A single claim/build/dig update therefore touches at most 9 tiles.
   */
  renderTiles(q: TerrainQuery, changed: TerrainPoint[]): void {
    if (this.assets.wallNorth) {
      // The dimensional wall sprites overlap neighbouring cells. A full pass
      // avoids clipped remnants during digging while changes remain infrequent.
      this.render(q);
      return;
    }
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
  }
}
