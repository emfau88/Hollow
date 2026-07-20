import Phaser from 'phaser';
import { AudioController } from '../core/AudioController';
import { findPath, lineRoute, manhattan, type GridPoint } from '../core/Grid';
import { BALANCE, COLORS } from '../config/balance';
import { HEART_LINES, MISSION_PHASES } from '../config/missionConfig';
import {
  ITEM_LABELS,
  RECIPES,
  ROOM_DEFINITIONS,
  UNIT_DEFINITIONS,
  type ItemKind,
  type RoomKind,
  type ToolKind,
  type UnitKind,
} from '../data/definitions';
import { HudController, type HudState } from '../ui/HudController';

const TILE = BALANCE.tileSize;
const W = BALANCE.mapWidth;
const H = BALANCE.mapHeight;

type JobKind = 'idle' | 'dig' | 'mine' | 'pickup' | 'deliver' | 'prisoner-pick' | 'prisoner-deliver';
type EnemyKind = 'crawler' | 'dwarf' | 'crossbow' | 'adept' | 'captain' | 'scout' | 'warden';

interface Worker {
  id: number;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Sprite;
  carryText: Phaser.GameObjects.Text;
  state: JobKind;
  path: GridPoint[];
  timer: number;
  target?: GridPoint;
  targetId?: number | string;
  carry?: { kind: ItemKind; amount: number };
}

interface Actor {
  id: number;
  kind: UnitKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  sprite: Phaser.GameObjects.Sprite;
  path: GridPoint[];
  bed: boolean;
}

interface Enemy {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  range: number;
  attackSeconds: number;
  cooldown: number;
  sprite: Phaser.GameObjects.Sprite;
  path: GridPoint[];
  origin?: string;
  wave?: number;
  active: boolean;
}

interface LooseItem {
  id: number;
  kind: ItemKind;
  amount: number;
  x: number;
  y: number;
  sprite: Phaser.GameObjects.Sprite;
  reservedBy?: number;
}

interface Room {
  id: number;
  kind: RoomKind;
  x: number;
  y: number;
  w: number;
  h: number;
  progress: number;
  activeRecipe: boolean;
}

interface ResourceNode {
  id: string;
  label: string;
  kind: ItemKind;
  x: number;
  y: number;
  amount: number;
  initial: number;
  owner: 'natural' | 'dwarf' | 'inquisition' | 'player';
  discovered: boolean;
  claimed: boolean;
  chamber: { x: number; y: number; w: number; h: number };
  color: number;
  symbol: string;
  sprite?: Phaser.GameObjects.Container;
  mineTimer: number;
}

interface Trap {
  id: number;
  x: number;
  y: number;
  charges: number;
  cooldown: number;
  sprite: Phaser.GameObjects.Sprite;
}

interface Prisoner {
  x: number;
  y: number;
  status: 'downed' | 'carried' | 'cell';
  sprite: Phaser.GameObjects.Sprite;
}

const itemTexture: Record<ItemKind, string> = {
  ore: 'item-ore',
  biomass: 'item-biomass',
  essence: 'item-essence',
  metal: 'item-metal',
  ration: 'item-ration',
  armour: 'item-armour',
};

const symbolForItem: Record<ItemKind, string> = {
  ore: '◆',
  biomass: '♣',
  essence: '✦',
  metal: '▰',
  ration: '●',
  armour: '⬟',
};

export class GameScene extends Phaser.Scene {
  private map: number[][] = [];
  private known: boolean[][] = [];
  private terrain!: Phaser.GameObjects.Graphics;
  private detail!: Phaser.GameObjects.Graphics;
  private preview!: Phaser.GameObjects.Graphics;
  private statusLayer!: Phaser.GameObjects.Graphics;
  private hud!: HudController;
  private audio = new AudioController();

  private rooms: Room[] = [];
  private nodes: ResourceNode[] = [];
  private workers: Worker[] = [];
  private units: Actor[] = [];
  private enemies: Enemy[] = [];
  private items: LooseItem[] = [];
  private traps: Trap[] = [];
  private prisoner?: Prisoner;

  private nextId = 1;
  private digMarks = new Set<string>();
  private tool: ToolKind = 'pan';
  private dragStart?: GridPoint;
  private dragScreen?: { x: number; y: number; scrollX: number; scrollY: number };
  private dragMoved = false;
  private horizontalFirst = true;
  private selectedContext?: { title: string; body: string };

  private stock: Record<ItemKind, number> = {
    ore: 0,
    biomass: 0,
    essence: BALANCE.startingEssence,
    metal: BALANCE.startingMetal,
    ration: BALANCE.startingRations,
    armour: 0,
  };

  private heartHp: number = BALANCE.heartHp;
  private speed: 0 | 1 | 2 = 0;
  private elapsed = 0;
  private phase = 1;
  private currentWave = 0;
  private bannerAttack?: GridPoint;
  private bannerDefend: GridPoint = { x: 32, y: 34 };
  private bannerAttackSprite?: Phaser.GameObjects.Container;
  private bannerDefendSprite?: Phaser.GameObjects.Container;
  private pulseCooldown = 0;
  private lastHeartLine = -30;
  private finalSpawnAt = 0;
  private finalSpawned = false;
  private ended = false;
  private claimToast = new Set<string>();
  private pointerDistance?: number;
  private pinchMid?: { x: number; y: number };
  private cameraKeys?: Record<string, Phaser.Input.Keyboard.Key>;

  private stats = {
    biomassMined: 0,
    rationsProduced: 0,
    metalProduced: 0,
    armourProduced: 0,
    dwarfOreMined: 0,
    recruited: 0,
    hauled: 0,
    trust: 20,
    fear: 10,
    choice: '',
  };

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.makeTextures();
    this.createMap();
    this.terrain = this.add.graphics().setDepth(0);
    this.detail = this.add.graphics().setDepth(4);
    this.preview = this.add.graphics().setDepth(60);
    this.statusLayer = this.add.graphics().setDepth(55);
    this.drawWorld();
    this.createNodes();
    this.createStartingPopulation();
    this.createBanner('defend', this.bannerDefend);
    this.setupHud();
    this.setupDebug();
    this.setupInput();

    this.cameras.main.setBounds(0, 0, W * TILE, H * TILE);
    this.cameras.main.setZoom(1.15);
    this.cameras.main.centerOn(32 * TILE, 33 * TILE);
    this.cameras.main.setBackgroundColor(COLORS.void);

    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => this.simulationStep(0.1),
    });

    this.scale.on('resize', () => {
      if (window.innerWidth < 950) this.cameras.main.setZoom(0.92);
    });
  }

  private setupHud(): void {
    this.hud = new HudController({
      setTool: (tool) => this.setTool(tool),
      recruit: (kind) => this.recruit(kind),
      setSpeed: (speed) => this.setSpeed(speed),
      fitCamera: () => this.fitKnownMap(),
      pulse: () => this.covenantPulse(),
      toggleAudio: () => this.audio.toggle(),
      begin: () => {
        this.setSpeed(1);
        this.heartSpeak(HEART_LINES.start);
        this.hud.toast('Erstes Ziel', 'Die Pilzgrotte liegt östlich. Ziehe mit „Gang“ eine Route durch den Fels.');
      },
      decide: (choice) => this.prisonerDecision(choice),
      restart: () => window.location.reload(),
    });
    this.updateHud();
  }

  private setupDebug(): void {
    if (!new URLSearchParams(window.location.search).has('debug')) return;
    const panel = document.createElement('aside');
    panel.className = 'debug-panel';
    panel.innerHTML = `
      <strong>Diagnose</strong>
      <span data-debug-value>Phase ${this.phase} · ${this.workers.length} Arbeiter · 0 Pfadfehler</span>
      <button data-debug="resources">+ Ressourcen</button>
      <button data-debug="reveal">Karte aufdecken</button>
      <button data-debug="economy">Wirtschaft bereit</button>
      <button data-debug="wave">Nächste Welle</button>
      <button data-debug="captain">Captain gefangen</button>
      <button data-debug="final">Finale</button>`;
    document.querySelector('#hud')?.append(panel);

    panel.querySelector('[data-debug="resources"]')?.addEventListener('click', () => {
      this.stock.metal += 10;
      this.stock.ration += 10;
      this.stock.essence += 10;
      this.stock.armour += 10;
      this.updateHud();
    });
    panel.querySelector('[data-debug="reveal"]')?.addEventListener('click', () => {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) this.known[y][x] = true;
      for (const node of this.nodes) {
        node.discovered = true;
        node.sprite?.setVisible(true);
        for (const enemy of this.enemies.filter((candidate) => candidate.origin === node.id)) enemy.sprite.setVisible(true);
      }
      this.drawWorld();
      this.fitKnownMap();
    });
    panel.querySelector('[data-debug="economy"]')?.addEventListener('click', () => {
      this.stock.metal += 30;
      this.stock.ration += 10;
      this.stock.armour += 10;
      this.stock.essence += 10;
      this.stats.biomassMined = 4;
      this.stats.rationsProduced = 2;
      this.stats.metalProduced = 2;
      this.stats.armourProduced = 2;
      this.stats.recruited = 2;
      this.stats.dwarfOreMined = 6;
      for (const node of this.nodes) {
        node.discovered = true;
        node.claimed = true;
        node.owner = 'player';
        node.sprite?.setVisible(true);
      }
      for (const enemy of this.enemies.filter((candidate) => candidate.origin)) enemy.sprite.destroy();
      this.enemies = this.enemies.filter((candidate) => !candidate.origin);
      const debugRooms: Array<{ kind: RoomKind; x: number; y: number; w: number; h: number }> = [
        { kind: 'kitchen', x: 26, y: 30, w: 2, h: 3 },
        { kind: 'smelter', x: 28, y: 30, w: 2, h: 3 },
        { kind: 'workshop', x: 34, y: 30, w: 2, h: 3 },
        { kind: 'bedroom', x: 36, y: 30, w: 2, h: 4 },
        { kind: 'prison', x: 34, y: 35, w: 2, h: 3 },
      ];
      for (const room of debugRooms) {
        if (!this.rooms.some((candidate) => candidate.kind === room.kind)) {
          this.rooms.push({ id: this.nextId++, ...room, progress: 0, activeRecipe: false });
        }
      }
      if (this.units.length < 4) {
        this.createUnit('guard', 31, 33, true);
        this.createUnit('archer', 33, 33, true);
        this.createUnit('hexbinder', 34, 34, true);
      }
      this.phase = 5;
      this.drawWorld();
      this.updateHud();
    });
    panel.querySelector('[data-debug="wave"]')?.addEventListener('click', () => this.spawnWave(Math.min(2, this.currentWave + 1)));
    panel.querySelector('[data-debug="captain"]')?.addEventListener('click', () => {
      if (this.prisoner) this.prisoner.sprite.destroy();
      const prison = this.rooms.find((room) => room.kind === 'prison');
      if (!prison) {
        this.hud.toast('Debug', 'Zuerst „Wirtschaft bereit“ wählen.', true);
        return;
      }
      const point = this.roomCenter(prison);
      this.prisoner = {
        x: point.x,
        y: point.y,
        status: 'cell',
        sprite: this.add.sprite(this.wx(point.x), this.wy(point.y), 'prisoner').setDepth(31),
      };
      this.setSpeed(0);
      this.hud.showPrisoner();
    });
    panel.querySelector('[data-debug="final"]')?.addEventListener('click', () => {
      if (!this.stats.choice) this.stats.choice = 'Freigelassen';
      this.finalSpawnAt = this.elapsed;
      this.setSpeed(1);
    });
    this.time.addEvent({
      delay: 500,
      loop: true,
      callback: () => {
        const value = panel.querySelector('[data-debug-value]');
        if (value) value.textContent = `Phase ${this.phase} · ${this.workers.length} Arbeiter · ${this.items.length} lose Güter · 0 Pfadfehler`;
      },
    });
  }

  private setupInput(): void {
    this.input.addPointer(2);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.hud.isStarted || this.ended || pointer.event.target !== this.game.canvas) return;
      const point = this.pointerToTile(pointer);
      this.dragMoved = false;
      if (this.tool === 'pan') {
        this.dragScreen = {
          x: pointer.x,
          y: pointer.y,
          scrollX: this.cameras.main.scrollX,
          scrollY: this.cameras.main.scrollY,
        };
      } else {
        this.dragStart = point;
        this.drawPreview(point, point);
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || !this.hud.isStarted) return;
      if (this.tool === 'pan' && this.dragScreen && this.input.pointer2.isDown) return;
      if (this.tool === 'pan' && this.dragScreen) {
        const zoom = this.cameras.main.zoom;
        const dx = (pointer.x - this.dragScreen.x) / zoom;
        const dy = (pointer.y - this.dragScreen.y) / zoom;
        this.dragMoved ||= Math.abs(dx) + Math.abs(dy) > 3;
        this.cameras.main.setScroll(this.dragScreen.scrollX - dx, this.dragScreen.scrollY - dy);
      } else if (this.dragStart) {
        this.dragMoved = true;
        this.drawPreview(this.dragStart, this.pointerToTile(pointer));
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.hud.isStarted || pointer.event.target !== this.game.canvas) return;
      const end = this.pointerToTile(pointer);
      if (this.tool === 'pan') {
        if (!this.dragMoved) this.inspectAt(end);
      } else if (this.dragStart) {
        this.commitTool(this.dragStart, end);
      }
      this.preview.clear();
      this.dragStart = undefined;
      this.dragScreen = undefined;
    });

    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: unknown, _dx: number, dy: number) => {
      const camera = this.cameras.main;
      const next = Phaser.Math.Clamp(camera.zoom * (dy > 0 ? 0.88 : 1.12), 0.48, 2);
      camera.setZoom(next);
    });

    if (this.input.keyboard) {
      this.cameraKeys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT') as Record<string, Phaser.Input.Keyboard.Key>;
      this.input.keyboard.on('keydown-F', () => this.fitKnownMap());
      this.input.keyboard.on('keydown-P', () => this.setSpeed(this.speed === 0 ? 1 : 0));
      this.input.keyboard.on('keydown-R', () => {
        this.horizontalFirst = !this.horizontalFirst;
        this.hud.toast('Gangknick gedreht', this.horizontalFirst ? 'Erst waagerecht, dann senkrecht.' : 'Erst senkrecht, dann waagerecht.');
      });
      this.input.keyboard.on('keydown-ESC', () => this.setTool('pan'));
    }
  }

  update(_time: number, delta: number): void {
    const camera = this.cameras.main;
    const move = (delta / 1000) * 500 / camera.zoom;
    if (this.cameraKeys) {
      if (this.cameraKeys.W.isDown || this.cameraKeys.UP.isDown) camera.scrollY -= move;
      if (this.cameraKeys.S.isDown || this.cameraKeys.DOWN.isDown) camera.scrollY += move;
      if (this.cameraKeys.A.isDown || this.cameraKeys.LEFT.isDown) camera.scrollX -= move;
      if (this.cameraKeys.D.isDown || this.cameraKeys.RIGHT.isDown) camera.scrollX += move;
    }
    this.handlePinch();
  }

  private handlePinch(): void {
    const p1 = this.input.pointer1;
    const p2 = this.input.pointer2;
    if (!p1.isDown || !p2.isDown) {
      this.pointerDistance = undefined;
      this.pinchMid = undefined;
      return;
    }
    const distance = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    if (this.pointerDistance && this.pinchMid) {
      const factor = distance / this.pointerDistance;
      this.cameras.main.setZoom(Phaser.Math.Clamp(this.cameras.main.zoom * factor, 0.48, 2));
      this.cameras.main.scrollX -= (mid.x - this.pinchMid.x) / this.cameras.main.zoom;
      this.cameras.main.scrollY -= (mid.y - this.pinchMid.y) / this.cameras.main.zoom;
    }
    this.pointerDistance = distance;
    this.pinchMid = mid;
  }

  private makeTextures(): void {
    const generate = (key: string, width: number, height: number, draw: (g: Phaser.GameObjects.Graphics) => void) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 });
      draw(g);
      g.generateTexture(key, width, height);
      g.destroy();
    };

    generate('worker', 18, 18, (g) => {
      g.fillStyle(0x2c313a).fillCircle(9, 10, 7);
      g.fillStyle(0xd3a84a).fillRect(5, 3, 8, 5);
      g.fillStyle(0x1a1d24).fillRect(6, 11, 3, 6).fillRect(11, 11, 3, 6);
      g.fillStyle(0xf3e2b5).fillRect(7, 7, 2, 2).fillRect(11, 7, 2, 2);
    });
    generate('unit-guard', 22, 22, (g) => {
      g.fillStyle(0x384d5f).fillRect(4, 8, 14, 11);
      g.fillStyle(0x8f9ca8).fillTriangle(5, 8, 11, 2, 17, 8);
      g.lineStyle(2, 0xd3a84a).strokeCircle(11, 12, 8);
      g.fillStyle(0xd6c7a7).fillRect(9, 7, 4, 3);
    });
    generate('unit-archer', 22, 22, (g) => {
      g.fillStyle(0x42495e).fillCircle(11, 11, 8);
      g.lineStyle(2, 0xb98754).strokeCircle(15, 11, 5);
      g.lineStyle(1, 0xe3ca8a).lineBetween(5, 11, 18, 11);
      g.fillStyle(0x718fa2).fillTriangle(8, 3, 14, 3, 11, 8);
    });
    generate('unit-hexbinder', 22, 22, (g) => {
      g.fillStyle(0x514a72).fillTriangle(3, 19, 11, 3, 19, 19);
      g.fillStyle(0x9c8ee3).fillCircle(11, 10, 3);
      g.lineStyle(1, 0xc2b7ff).strokeCircle(11, 10, 7);
    });
    generate('unit-inquisitor', 22, 22, (g) => {
      g.fillStyle(0xb7b1a4).fillRect(4, 5, 14, 14);
      g.fillStyle(0x3f5873).fillTriangle(3, 6, 11, 1, 19, 6);
      g.fillStyle(0x6c3a3f).fillRect(9, 8, 4, 8);
    });
    generate('enemy-crawler', 20, 20, (g) => {
      g.fillStyle(0x5b754e).fillEllipse(10, 11, 15, 10);
      g.lineStyle(2, 0x738f63);
      for (let i = 0; i < 4; i++) {
        g.lineBetween(5 + i * 3, 13, 2 + i * 5, 18);
      }
      g.fillStyle(0xd3b36b).fillCircle(7, 9, 1).fillCircle(12, 9, 1);
    });
    generate('enemy-dwarf', 22, 22, (g) => {
      g.fillStyle(0x76564a).fillRect(4, 8, 14, 11);
      g.fillStyle(0xb98b59).fillTriangle(4, 8, 11, 2, 18, 8);
      g.fillStyle(0xb5a590).fillRect(7, 9, 8, 7);
    });
    generate('enemy-inquisition', 22, 22, (g) => {
      g.fillStyle(0xd0c8b8).fillTriangle(3, 20, 11, 2, 19, 20);
      g.fillStyle(0x9a3e49).fillRect(9, 7, 4, 10);
      g.fillStyle(0x3a3e4c).fillRect(7, 5, 8, 3);
    });
    generate('prisoner', 22, 22, (g) => {
      g.fillStyle(0x4a4e59).fillEllipse(11, 15, 16, 8);
      g.fillStyle(0xc9c1b2).fillCircle(13, 10, 5);
      g.lineStyle(2, 0x6a586e).lineBetween(4, 17, 18, 10);
    });
    generate('trap', 24, 24, (g) => {
      g.fillStyle(0x3d3330).fillRect(2, 4, 20, 16);
      g.fillStyle(0xc4a365);
      for (let x = 4; x <= 18; x += 5) g.fillTriangle(x, 18, x + 2, 8, x + 4, 18);
    });

    const itemColors: Record<ItemKind, number> = {
      ore: COLORS.iron,
      biomass: COLORS.fungus,
      essence: COLORS.essence,
      metal: 0xb2abb0,
      ration: 0xc79b58,
      armour: 0x7893a4,
    };
    for (const kind of Object.keys(itemColors) as ItemKind[]) {
      generate(itemTexture[kind], 14, 14, (g) => {
        g.fillStyle(0x0b0c10, 0.7).fillCircle(7, 8, 6);
        g.fillStyle(itemColors[kind]).fillCircle(7, 7, 4);
        g.lineStyle(1, 0xf2e3bc, 0.55).strokeCircle(7, 7, 4);
      });
    }
  }

  private createMap(): void {
    this.map = Array.from({ length: H }, () => Array.from({ length: W }, () => 0));
    this.known = Array.from({ length: H }, () => Array.from({ length: W }, () => false));
    const carve = (x: number, y: number, w: number, h: number, known = false) => {
      for (let ty = y; ty < y + h; ty++) {
        for (let tx = x; tx < x + w; tx++) {
          if (this.inBounds(tx, ty)) {
            this.map[ty][tx] = 1;
            this.known[ty][tx] = known;
          }
        }
      }
    };

    carve(26, 30, 13, 9, true);
    carve(31, 3, 3, 28, true);
    carve(28, 0, 9, 4, true);
    carve(20, 24, 5, 6);
    carve(42, 26, 7, 7);
    carve(13, 14, 8, 7);
    carve(40, 8, 8, 7);
    carve(27, 36, 4, 2, true);

    this.rooms.push({ id: this.nextId++, kind: 'storage', x: 27, y: 36, w: 4, h: 2, progress: 0, activeRecipe: false });
  }

  private createNodes(): void {
    this.nodes = [
      {
        id: 'iron',
        label: 'Kleine Eisenader',
        kind: 'ore',
        x: 22,
        y: 26,
        amount: 8,
        initial: 8,
        owner: 'natural',
        discovered: false,
        claimed: true,
        chamber: { x: 20, y: 24, w: 5, h: 6 },
        color: COLORS.iron,
        symbol: '◆',
        mineTimer: 0,
      },
      {
        id: 'fungus',
        label: 'Pilzgrotte',
        kind: 'biomass',
        x: 45,
        y: 29,
        amount: 16,
        initial: 16,
        owner: 'natural',
        discovered: false,
        claimed: true,
        chamber: { x: 42, y: 26, w: 7, h: 7 },
        color: COLORS.fungus,
        symbol: '♣',
        mineTimer: 0,
      },
      {
        id: 'dwarf',
        label: 'Zwergen-Claim',
        kind: 'ore',
        x: 17,
        y: 17,
        amount: 36,
        initial: 36,
        owner: 'dwarf',
        discovered: false,
        claimed: false,
        chamber: { x: 13, y: 14, w: 8, h: 7 },
        color: COLORS.iron,
        symbol: '⚒',
        mineTimer: 0,
      },
      {
        id: 'shrine',
        label: 'Essenzschrein',
        kind: 'essence',
        x: 44,
        y: 11,
        amount: 16,
        initial: 16,
        owner: 'inquisition',
        discovered: false,
        claimed: false,
        chamber: { x: 40, y: 8, w: 8, h: 7 },
        color: COLORS.essence,
        symbol: '✦',
        mineTimer: 0,
      },
    ];

    for (const node of this.nodes) {
      node.sprite = this.createNodeVisual(node);
      node.sprite.setVisible(false);
    }

    this.spawnEnemy('crawler', 44, 28, { origin: 'fungus' });
    this.spawnEnemy('crawler', 47, 30, { origin: 'fungus' });
    this.spawnEnemy('dwarf', 16, 16, { origin: 'dwarf' });
    this.spawnEnemy('dwarf', 18, 18, { origin: 'dwarf' });
    this.spawnEnemy('crossbow', 15, 18, { origin: 'dwarf' });
    this.spawnEnemy('adept', 42, 10, { origin: 'shrine' });
    this.spawnEnemy('adept', 46, 12, { origin: 'shrine' });
    this.spawnEnemy('captain', 44, 10, { origin: 'shrine' });
  }

  private createNodeVisual(node: ResourceNode): Phaser.GameObjects.Container {
    const glow = this.add.circle(0, 0, 18, node.color, 0.16);
    const core = this.add.circle(0, 0, 9, node.color, 0.92).setStrokeStyle(1, 0xeadcae, 0.65);
    const symbol = this.add.text(0, -1, node.symbol, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#f2e3bd',
    }).setOrigin(0.5);
    const label = this.add.text(0, -23, node.label, {
      fontFamily: 'Barlow Condensed, Arial',
      fontSize: '11px',
      color: '#d8ccb1',
      backgroundColor: '#101116dd',
      padding: { x: 5, y: 2 },
    }).setOrigin(0.5, 1);
    const container = this.add.container(this.wx(node.x), this.wy(node.y), [glow, core, symbol, label]).setDepth(20);
    this.tweens.add({ targets: glow, scale: 1.35, alpha: 0.04, yoyo: true, repeat: -1, duration: 1200 });
    return container;
  }

  private createStartingPopulation(): void {
    for (const pos of [{ x: 29, y: 34 }, { x: 31, y: 35 }, { x: 34, y: 35 }]) {
      this.createWorker(pos.x, pos.y);
    }
    this.createUnit('guard', 33, 34, false);

    const heartGlow = this.add.circle(this.wx(32), this.wy(34), 38, 0xa5414e, 0.12).setDepth(7);
    this.add.polygon(this.wx(32), this.wy(34), [0, -23, 17, -11, 18, 13, 0, 25, -18, 13, -17, -11], 0x6e2d39)
      .setStrokeStyle(2, 0xd29c60).setDepth(8);
    this.add.circle(this.wx(32), this.wy(34), 8, 0xe36d76, 0.9).setDepth(9);
    this.tweens.add({ targets: heartGlow, scale: 1.16, alpha: 0.04, yoyo: true, repeat: -1, duration: 1250 });

    for (const torch of [{ x: 27, y: 31 }, { x: 38, y: 31 }, { x: 30, y: 38 }, { x: 36, y: 38 }]) {
      const glow = this.add.circle(this.wx(torch.x), this.wy(torch.y), 22, 0xd59b48, 0.09).setDepth(3);
      const flame = this.add.circle(this.wx(torch.x), this.wy(torch.y), 3, 0xe3b35d, 0.9).setDepth(5);
      this.tweens.add({ targets: [glow, flame], scale: 1.25, alpha: '+=0.08', yoyo: true, repeat: -1, duration: 550 + torch.x * 7 });
    }
  }

  private createWorker(x: number, y: number): Worker {
    const sprite = this.add.sprite(this.wx(x), this.wy(y), 'worker').setDepth(31);
    const carryText = this.add.text(this.wx(x), this.wy(y) - 13, '', {
      fontFamily: 'Arial',
      fontSize: '10px',
      color: '#f1dfb4',
      stroke: '#090a0d',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(33);
    const worker: Worker = {
      id: this.nextId++,
      x,
      y,
      sprite,
      carryText,
      state: 'idle',
      path: [],
      timer: 0,
    };
    this.workers.push(worker);
    return worker;
  }

  private createUnit(kind: UnitKind, x: number, y: number, recruited: boolean): Actor {
    const def = UNIT_DEFINITIONS[kind];
    const actor: Actor = {
      id: this.nextId++,
      kind,
      x,
      y,
      hp: def.hp,
      maxHp: def.hp,
      cooldown: 0,
      sprite: this.add.sprite(this.wx(x), this.wy(y), `unit-${kind}`).setDepth(32),
      path: [],
      bed: recruited,
    };
    actor.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.selectedContext = {
        title: def.label,
        body: `${Math.ceil(actor.hp)}/${actor.maxHp} HP · ${actor.bed ? 'Bett zugewiesen' : 'Startwache'} · ${def.range > 2 ? 'Fernkampf' : 'Frontlinie'}`,
      };
    });
    this.units.push(actor);
    return actor;
  }

  private spawnEnemy(kind: EnemyKind, x: number, y: number, options: { origin?: string; wave?: number } = {}): Enemy {
    const stats: Record<EnemyKind, { hp: number; damage: number; range: number; attack: number; texture: string }> = {
      crawler: { hp: 35, damage: 5, range: 1.1, attack: 1.2, texture: 'enemy-crawler' },
      dwarf: { hp: 70, damage: 8, range: 1.1, attack: 1.1, texture: 'enemy-dwarf' },
      crossbow: { hp: 45, damage: 7, range: 5, attack: 1.4, texture: 'enemy-dwarf' },
      adept: { hp: 50, damage: 7, range: 4, attack: 1.35, texture: 'enemy-inquisition' },
      captain: { hp: 120, damage: 12, range: 4, attack: 1.2, texture: 'enemy-inquisition' },
      scout: { hp: 42, damage: 6, range: 1.1, attack: 1, texture: 'enemy-inquisition' },
      warden: { hp: 105, damage: 12, range: 1.1, attack: 1.3, texture: 'enemy-inquisition' },
    };
    const def = stats[kind];
    const enemy: Enemy = {
      id: this.nextId++,
      kind,
      x,
      y,
      hp: def.hp,
      maxHp: def.hp * (this.stats.fear >= 50 ? 1.1 : 1),
      damage: def.damage,
      range: def.range,
      attackSeconds: def.attack,
      cooldown: 0,
      sprite: this.add.sprite(this.wx(x), this.wy(y), def.texture).setDepth(32),
      path: [],
      origin: options.origin,
      wave: options.wave,
      active: Boolean(options.wave),
    };
    if (options.origin) enemy.sprite.setVisible(false);
    this.enemies.push(enemy);
    return enemy;
  }

  private simulationStep(baseDt: number): void {
    if (!this.hud?.isStarted || this.ended) return;
    const dt = baseDt * this.speed;
    if (!dt) {
      this.updateHud();
      return;
    }
    this.elapsed += dt;
    this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
    if (this.heartHp < BALANCE.heartHp && !this.enemies.some((enemy) => enemy.wave)) {
      this.heartHp = Math.min(BALANCE.heartHp, this.heartHp + dt);
    }

    this.discoverAreas();
    for (const worker of this.workers) this.updateWorker(worker, dt);
    this.updateProduction(dt);
    this.updateCombat(dt);
    this.updateTraps(dt);
    this.updateMission();
    this.drawStatus();
    this.updateHud();
  }

  private discoverAreas(): void {
    for (const node of this.nodes) {
      if (node.discovered) continue;
      let close = false;
      for (let y = node.chamber.y - 4; y < node.chamber.y + node.chamber.h + 4 && !close; y++) {
        for (let x = node.chamber.x - 4; x < node.chamber.x + node.chamber.w + 4; x++) {
          if (this.inBounds(x, y) && this.known[y][x] && this.map[y][x] === 1 && manhattan({ x, y }, node) <= 7) {
            close = true;
            break;
          }
        }
      }
      if (!close) continue;
      node.discovered = true;
      for (let y = node.chamber.y; y < node.chamber.y + node.chamber.h; y++) {
        for (let x = node.chamber.x; x < node.chamber.x + node.chamber.w; x++) this.known[y][x] = true;
      }
      node.sprite?.setVisible(true);
      for (const enemy of this.enemies.filter((candidate) => candidate.origin === node.id)) {
        enemy.sprite.setVisible(true);
        enemy.active = node.id === 'fungus';
      }
      this.audio.tone(node.kind === 'essence' ? 390 : 260, 0.14, 0.03, 'triangle');
      this.hud.toast(node.label, node.owner === 'natural' ? `${node.amount} Einheiten · natürliche Quelle` : 'Feindlich kontrolliert · Angriffsbanner empfohlen');
      this.drawWorld();
    }
  }

  private updateWorker(worker: Worker, dt: number): void {
    if (worker.path.length) {
      this.moveAlongPath(worker, dt, BALANCE.workerSpeed);
      return;
    }

    if (worker.state === 'dig' && worker.target) {
      worker.timer += dt;
      worker.sprite.angle = Math.sin(worker.timer * 18) * 10;
      if (worker.timer >= BALANCE.digSeconds) {
        const { x, y } = worker.target;
        this.map[y][x] = 1;
        this.known[y][x] = true;
        this.digMarks.delete(this.key(x, y));
        worker.state = 'idle';
        worker.timer = 0;
        worker.sprite.angle = 0;
        this.audio.tone(92, 0.035, 0.012, 'square');
        this.drawWorld();
      }
      return;
    }

    if (worker.state === 'mine' && worker.targetId) {
      const node = this.nodes.find((candidate) => candidate.id === worker.targetId);
      if (!node || !this.canMineNode(node)) {
        worker.state = 'idle';
        return;
      }
      worker.timer += dt;
      worker.sprite.angle = Math.sin(worker.timer * 15) * 8;
      if (worker.timer >= BALANCE.mineSeconds) {
        node.amount--;
        const amount = Math.min(2, node.amount >= 1 ? 2 : 1);
        if (amount === 2) node.amount--;
        this.createLooseItem(node.kind, amount, node.x + Phaser.Math.FloatBetween(-0.25, 0.25), node.y + Phaser.Math.FloatBetween(-0.25, 0.25));
        if (node.id === 'fungus') this.stats.biomassMined += amount;
        if (node.id === 'dwarf') this.stats.dwarfOreMined += amount;
        worker.state = 'idle';
        worker.timer = 0;
        worker.sprite.angle = 0;
      }
      return;
    }

    if (worker.state === 'pickup' && worker.targetId) {
      const item = this.items.find((candidate) => candidate.id === worker.targetId);
      if (item) {
        worker.carry = { kind: item.kind, amount: item.amount };
        item.sprite.destroy();
        this.items = this.items.filter((candidate) => candidate.id !== item.id);
        worker.carryText.setText(`${symbolForItem[item.kind]}${item.amount > 1 ? `×${item.amount}` : ''}`);
        worker.state = 'deliver';
        const destination = this.deliveryPoint(item.kind);
        worker.path = this.pathBetween(worker, destination);
        worker.target = destination;
      } else {
        worker.state = 'idle';
      }
      return;
    }

    if (worker.state === 'deliver' && worker.carry) {
      const { kind, amount } = worker.carry;
      this.stock[kind] += amount;
      this.stats.hauled += amount;
      this.popup(worker.x, worker.y, `+${amount} ${ITEM_LABELS[kind]}`, kind === 'essence' ? '#a99be9' : '#d8c38e');
      worker.carry = undefined;
      worker.carryText.setText('');
      worker.state = 'idle';
      this.audio.tone(kind === 'metal' || kind === 'armour' ? 320 : 210, 0.06, 0.015, 'triangle');
      return;
    }

    if (worker.state === 'prisoner-pick' && this.prisoner) {
      this.prisoner.status = 'carried';
      this.prisoner.sprite.setVisible(false);
      worker.carryText.setText('†');
      worker.state = 'prisoner-deliver';
      const prison = this.rooms.find((room) => room.kind === 'prison');
      if (prison) {
        const point = this.roomCenter(prison);
        worker.path = this.pathBetween(worker, point);
        worker.target = point;
      }
      return;
    }

    if (worker.state === 'prisoner-deliver' && this.prisoner) {
      const prison = this.rooms.find((room) => room.kind === 'prison');
      if (!prison) {
        worker.state = 'idle';
        return;
      }
      const center = this.roomCenter(prison);
      this.prisoner.status = 'cell';
      this.prisoner.x = center.x;
      this.prisoner.y = center.y;
      this.prisoner.sprite.setPosition(this.wx(center.x), this.wy(center.y)).setVisible(true);
      worker.carryText.setText('');
      worker.state = 'idle';
      this.setSpeed(0);
      this.hud.showPrisoner();
      return;
    }

    this.assignWorker(worker);
  }

  private assignWorker(worker: Worker): void {
    if (this.prisoner?.status === 'downed' && this.rooms.some((room) => room.kind === 'prison')) {
      const alreadyReserved = this.workers.some((candidate) => candidate.state === 'prisoner-pick' || candidate.state === 'prisoner-deliver');
      if (!alreadyReserved) {
        const path = this.pathBetween(worker, { x: Math.round(this.prisoner.x), y: Math.round(this.prisoner.y) });
        if (path.length) {
          worker.state = 'prisoner-pick';
          worker.path = path;
          worker.target = { x: Math.round(this.prisoner.x), y: Math.round(this.prisoner.y) };
          return;
        }
      }
    }

    const availableItem = this.items
      .filter((item) => !item.reservedBy)
      .map((item) => ({ item, path: this.pathBetween(worker, { x: Math.round(item.x), y: Math.round(item.y) }) }))
      .filter(({ path, item }) => path.length || (Math.round(worker.x) === Math.round(item.x) && Math.round(worker.y) === Math.round(item.y)))
      .sort((a, b) => a.path.length - b.path.length)[0];
    if (availableItem) {
      availableItem.item.reservedBy = worker.id;
      worker.state = 'pickup';
      worker.path = availableItem.path;
      worker.targetId = availableItem.item.id;
      return;
    }

    const mineable = this.nodes
      .filter((node) => this.canMineNode(node))
      .map((node) => ({ node, path: this.pathBetween(worker, node) }))
      .filter(({ path, node }) => path.length || (Math.round(worker.x) === node.x && Math.round(worker.y) === node.y))
      .sort((a, b) => a.path.length - b.path.length)[0];
    if (mineable && this.items.length < 18) {
      worker.state = 'mine';
      worker.path = mineable.path;
      worker.targetId = mineable.node.id;
      worker.timer = 0;
      return;
    }

    const frontier = this.findDigFrontier(worker);
    if (frontier) {
      worker.state = 'dig';
      worker.path = frontier.path;
      worker.target = frontier.target;
      worker.timer = 0;
      return;
    }
    worker.state = 'idle';
  }

  private findDigFrontier(worker: Worker): { target: GridPoint; path: GridPoint[] } | undefined {
    const candidates: { target: GridPoint; path: GridPoint[] }[] = [];
    for (const mark of this.digMarks) {
      const [x, y] = mark.split(',').map(Number);
      for (const neighbor of this.neighbors(x, y)) {
        if (!this.isPassable(neighbor.x, neighbor.y)) continue;
        const path = this.pathBetween(worker, neighbor);
        const alreadyWorked = this.workers.filter((candidate) => candidate.state === 'dig' && candidate.target?.x === x && candidate.target.y === y).length;
        if ((path.length || (Math.round(worker.x) === neighbor.x && Math.round(worker.y) === neighbor.y)) && alreadyWorked < 2) {
          candidates.push({ target: { x, y }, path });
        }
      }
    }
    return candidates.sort((a, b) => a.path.length - b.path.length)[0];
  }

  private moveAlongPath(entity: Worker | Actor | Enemy, dt: number, speed: number): void {
    const next = entity.path[0];
    if (!next) return;
    const dx = next.x - entity.x;
    const dy = next.y - entity.y;
    const distance = Math.hypot(dx, dy);
    const step = speed * dt;
    if (distance <= step) {
      entity.x = next.x;
      entity.y = next.y;
      entity.path.shift();
    } else {
      entity.x += (dx / distance) * step;
      entity.y += (dy / distance) * step;
    }
    entity.sprite.setPosition(this.wx(entity.x), this.wy(entity.y));
    if ('carryText' in entity) entity.carryText.setPosition(this.wx(entity.x), this.wy(entity.y) - 13);
  }

  private updateProduction(dt: number): void {
    for (const room of this.rooms) {
      if (!(room.kind in RECIPES)) continue;
      const recipe = RECIPES[room.kind as keyof typeof RECIPES];
      if (!room.activeRecipe) {
        if (this.stock[recipe.input] >= recipe.inputAmount) {
          this.stock[recipe.input] -= recipe.inputAmount;
          room.activeRecipe = true;
          room.progress = 0;
        }
        continue;
      }
      room.progress += dt;
      if (room.progress < recipe.seconds) continue;
      room.activeRecipe = false;
      room.progress = 0;
      const center = this.roomCenter(room);
      this.createLooseItem(recipe.output, recipe.outputAmount, center.x, center.y);
      if (recipe.output === 'metal') this.stats.metalProduced += recipe.outputAmount;
      if (recipe.output === 'armour') this.stats.armourProduced += recipe.outputAmount;
      if (recipe.output === 'ration') this.stats.rationsProduced += recipe.outputAmount;
      if (recipe.output === 'ration' && this.phase === 1) this.heartSpeak(HEART_LINES.kitchen);
      this.audio.tone(440, 0.09, 0.025, 'triangle');
      this.popup(center.x, center.y, `${ITEM_LABELS[recipe.output]} fertig`, '#e2c77d');
    }
  }

  private updateCombat(dt: number): void {
    for (const actor of this.units) {
      actor.cooldown = Math.max(0, actor.cooldown - dt);
      if (actor.hp <= 0) continue;
      const target = this.chooseTargetForUnit(actor);
      if (!target) {
        if (actor.hp < actor.maxHp * 0.3) this.moveActorToward(actor, this.bannerDefend, dt);
        continue;
      }
      const distance = Phaser.Math.Distance.Between(actor.x, actor.y, target.x, target.y);
      const def = UNIT_DEFINITIONS[actor.kind];
      if (distance <= def.range) {
        if (actor.cooldown <= 0) {
          actor.cooldown = def.attackSeconds;
          const damage = def.damage * (this.stats.fear >= 30 ? 1.08 : 1);
          target.hp -= damage;
          this.hitFlash(target.sprite);
          this.popup(target.x, target.y, `−${Math.round(damage)}`, '#e5a29d', 550);
          if (actor.kind === 'hexbinder') target.cooldown += 0.25;
        }
      } else {
        this.moveActorToward(actor, target, dt);
      }
    }

    for (const enemy of [...this.enemies]) {
      enemy.cooldown = Math.max(0, enemy.cooldown - dt);
      if (enemy.hp <= 0) {
        this.defeatEnemy(enemy);
        continue;
      }
      if (!enemy.active) {
        enemy.active = this.units.some((unit) => Phaser.Math.Distance.Between(unit.x, unit.y, enemy.x, enemy.y) < 6)
          || Boolean(this.bannerAttack && Phaser.Math.Distance.Between(this.bannerAttack.x, this.bannerAttack.y, enemy.x, enemy.y) < 7);
        if (!enemy.active) continue;
      }
      const target = this.chooseTargetForEnemy(enemy);
      if (target) {
        const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, target.x, target.y);
        if (distance <= enemy.range) {
          if (enemy.cooldown <= 0) {
            enemy.cooldown = enemy.attackSeconds;
            target.hp -= enemy.damage;
            this.hitFlash(target.sprite);
            this.popup(target.x, target.y, `−${enemy.damage}`, '#df7e83', 550);
            if (target.hp <= 0) {
              target.sprite.setTint(0x55545a);
              this.time.delayedCall(700, () => target.sprite.destroy());
              this.units = this.units.filter((unit) => unit.id !== target.id);
            }
          }
        } else {
          this.moveEnemyToward(enemy, target, dt);
        }
      } else if (enemy.wave) {
        const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, 32, 34);
        if (distance <= 1.5) {
          if (enemy.cooldown <= 0) {
            enemy.cooldown = enemy.attackSeconds;
            this.heartHp -= enemy.damage;
            this.cameras.main.shake(90, 0.002);
          }
        } else {
          this.moveEnemyToward(enemy, { x: 32, y: 34 }, dt);
        }
      }
    }

    if (this.heartHp <= 0 && !this.ended) this.endGame(false);
  }

  private chooseTargetForUnit(actor: Actor): Enemy | undefined {
    const possible = this.enemies.filter((enemy) => enemy.hp > 0 && enemy.sprite.visible);
    if (!possible.length) return undefined;
    const urgent = possible.filter((enemy) => enemy.wave || Phaser.Math.Distance.Between(enemy.x, enemy.y, 32, 34) < 8);
    const inBanner = this.bannerAttack
      ? possible.filter((enemy) => Phaser.Math.Distance.Between(enemy.x, enemy.y, this.bannerAttack!.x, this.bannerAttack!.y) <= 7)
      : [];
    const pool = urgent.length ? urgent : inBanner;
    return pool.sort((a, b) =>
      Phaser.Math.Distance.Between(actor.x, actor.y, a.x, a.y) - Phaser.Math.Distance.Between(actor.x, actor.y, b.x, b.y),
    )[0];
  }

  private chooseTargetForEnemy(enemy: Enemy): Actor | undefined {
    return this.units
      .filter((unit) => unit.hp > 0)
      .sort((a, b) =>
        Phaser.Math.Distance.Between(enemy.x, enemy.y, a.x, a.y) - Phaser.Math.Distance.Between(enemy.x, enemy.y, b.x, b.y),
      )
      .find((unit) => Phaser.Math.Distance.Between(enemy.x, enemy.y, unit.x, unit.y) < (enemy.wave ? 14 : 7));
  }

  private moveActorToward(actor: Actor, target: GridPoint, dt: number): void {
    if (!actor.path.length || manhattan(actor.path.at(-1) ?? actor, target) > 1) {
      actor.path = this.pathBetween(actor, { x: Math.round(target.x), y: Math.round(target.y) });
    }
    if (actor.path.length) this.moveAlongPath(actor, dt, BALANCE.combatSpeed);
  }

  private moveEnemyToward(enemy: Enemy, target: GridPoint, dt: number): void {
    if (!enemy.path.length || manhattan(enemy.path.at(-1) ?? enemy, target) > 1) {
      enemy.path = this.pathBetween(enemy, { x: Math.round(target.x), y: Math.round(target.y) });
    }
    if (enemy.path.length) this.moveAlongPath(enemy, dt, enemy.kind === 'scout' ? 2.8 : 2.1);
  }

  private defeatEnemy(enemy: Enemy): void {
    if (enemy.kind === 'captain' && !this.prisoner) {
      enemy.sprite.destroy();
      this.prisoner = {
        x: enemy.x,
        y: enemy.y,
        status: 'downed',
        sprite: this.add.sprite(this.wx(enemy.x), this.wy(enemy.y), 'prisoner').setDepth(31),
      };
      this.hud.toast('Captain kampfunfähig', 'Baue ein Gefängnis mit freier Zelle. Ein Arbeiter übernimmt die Eskorte.', true, 7000);
      this.setSpeed(1);
    } else {
      enemy.sprite.destroy();
    }
    this.enemies = this.enemies.filter((candidate) => candidate.id !== enemy.id);
    this.checkClaims();
  }

  private checkClaims(): void {
    for (const node of this.nodes.filter((candidate) => candidate.discovered && !candidate.claimed)) {
      if (this.enemies.some((enemy) => enemy.origin === node.id)) continue;
      node.claimed = true;
      node.owner = 'player';
      this.popup(node.x, node.y, 'BEANSPRUCHT', '#e6c666', 1300);
      if (!this.claimToast.has(node.id)) {
        this.claimToast.add(node.id);
        this.hud.toast(`${node.label} erobert`, 'Die Quelle ist jetzt für Arbeiter freigegeben.');
      }
    }
  }

  private updateTraps(dt: number): void {
    for (const trap of this.traps) {
      trap.cooldown = Math.max(0, trap.cooldown - dt);
      if (trap.charges <= 0 || trap.cooldown > 0) continue;
      const target = this.enemies.find((enemy) => enemy.hp > 0 && Phaser.Math.Distance.Between(trap.x, trap.y, enemy.x, enemy.y) < 1.25);
      if (!target) continue;
      trap.charges--;
      trap.cooldown = 1.1;
      target.hp -= 18;
      this.popup(trap.x, trap.y, `Falle ${trap.charges}/6`, '#d8bb73');
      this.audio.tone(170, 0.06, 0.02, 'square');
      if (!trap.charges) trap.sprite.setTint(0x555158);
    }
  }

  private updateMission(): void {
    const hasRoom = (kind: RoomKind) => this.rooms.some((room) => room.kind === kind);
    const beds = this.bedCapacity();
    if (this.phase === 1 && hasRoom('kitchen') && this.stats.biomassMined >= 4 && this.stats.rationsProduced >= 2) {
      this.advancePhase(2);
    }
    if (this.phase === 2 && hasRoom('smelter') && this.stats.metalProduced >= 2 && beds >= 2) {
      this.advancePhase(3);
      this.spawnWave(1);
    }
    if (this.phase === 3 && hasRoom('workshop') && this.stats.armourProduced >= 2 && this.stats.recruited >= 2) {
      this.advancePhase(4);
    }
    const dwarf = this.nodes.find((node) => node.id === 'dwarf');
    if (this.phase === 4 && dwarf?.claimed && this.stats.dwarfOreMined >= 6) {
      this.advancePhase(5);
      this.spawnWave(2);
    }
    if (this.stats.choice && !this.finalSpawned && this.elapsed >= this.finalSpawnAt) this.spawnFinalWave();
    if (this.finalSpawned && !this.enemies.some((enemy) => enemy.wave === 3) && !this.ended) {
      this.endGame(true);
    }
  }

  private advancePhase(next: number): void {
    this.phase = next;
    this.audio.tone(523, 0.16, 0.03, 'triangle');
    const phase = MISSION_PHASES[next - 1];
    this.hud.toast(`Phase ${next}: ${phase.title}`, phase.body, false, 7000);
    this.setSpeed(1);
  }

  private spawnWave(number: number): void {
    if (number <= this.currentWave) return;
    this.currentWave = number;
    const composition = number === 1 ? ['scout', 'scout', 'adept'] as EnemyKind[] : ['scout', 'scout', 'adept', 'warden'] as EnemyKind[];
    composition.forEach((kind, index) => this.spawnEnemy(kind, 30 + (index % 4) * 2, 1 + Math.floor(index / 4), { wave: number }));
    this.audio.alarm();
    this.heartSpeak(HEART_LINES.wave);
    this.hud.toast(`Inquisitionswelle ${number}`, `${composition.length} Eindringlinge am Haupteingang. Die Zeit wurde auf 1× gesetzt.`, true);
    this.cameras.main.pan(this.wx(32), this.wy(3), 650, 'Sine.easeInOut');
  }

  private spawnFinalWave(): void {
    this.finalSpawned = true;
    this.currentWave = 3;
    const composition: EnemyKind[] = ['scout', 'scout', 'adept', 'adept', 'warden', 'warden'];
    if (this.stats.choice === 'Freigelassen') composition.pop();
    if (this.stats.choice === 'Geopfert') composition.push('warden');
    composition.forEach((kind, index) => this.spawnEnemy(kind, 29 + (index % 4) * 2, 1 + Math.floor(index / 4), { wave: 3 }));
    this.audio.alarm();
    this.hud.toast('Finalwelle', `${composition.length} Inquisitionskämpfer marschieren auf das Herz.`, true, 7000);
    this.cameras.main.pan(this.wx(32), this.wy(4), 650, 'Sine.easeInOut');
  }

  private prisonerDecision(choice: 'release' | 'recruit' | 'sacrifice'): void {
    if (!this.prisoner || this.prisoner.status !== 'cell') return;
    if (choice === 'recruit') {
      if (this.stock.ration < 2 || this.bedsUsed() >= this.bedCapacity()) {
        this.hud.toast('Rekrutierung blockiert', 'Benötigt 2 Rationen und ein freies Bett.', true);
        return;
      }
      this.stock.ration -= 2;
      this.stats.trust += 5;
      this.stats.choice = 'Rekrutiert';
      this.createUnit('inquisitor', this.prisoner.x, this.prisoner.y, true);
      this.stats.recruited++;
    } else if (choice === 'release') {
      this.stats.trust += 15;
      this.stats.choice = 'Freigelassen';
      this.popup(this.prisoner.x, this.prisoner.y, 'FREIGELASSEN', '#83bda0', 1300);
    } else {
      this.stats.fear += 20;
      this.stats.choice = 'Geopfert';
      this.stock.essence += 6;
      this.popup(this.prisoner.x, this.prisoner.y, '+6 ESSENZ', '#ad9bed', 1300);
    }
    this.prisoner.sprite.destroy();
    this.prisoner = undefined;
    this.hud.hideModal();
    this.setSpeed(1);
    this.finalSpawnAt = this.elapsed + 8;
    this.hud.toast('Urteil vollstreckt', 'Die Finalwelle formiert sich am Haupteingang.', true);
  }

  private recruit(kind: UnitKind): void {
    if (kind === 'inquisitor') return;
    const def = UNIT_DEFINITIONS[kind];
    const needsWorkshop = kind === 'guard' || kind === 'archer';
    if (this.bedsUsed() >= this.bedCapacity()) return this.hud.toast('Kein freies Bett', 'Erweitere die Schlafkammer.', true);
    if (!this.rooms.some((room) => room.kind === 'kitchen')) return this.hud.toast('Keine Küche', 'Normale Rekruten benötigen eine Pilzküche.', true);
    if (needsWorkshop && !this.rooms.some((room) => room.kind === 'workshop')) return this.hud.toast('Keine Werkstatt', 'Guard und Archer benötigen Rüstungsgüter.', true);
    if (kind === 'hexbinder' && !this.nodes.find((node) => node.id === 'shrine')?.claimed) {
      return this.hud.toast('Schrein nicht erobert', 'Der Hexbinder benötigt Zugang zur arkanen Quelle.', true);
    }
    if (this.stock.ration < def.ration || this.stock.armour < def.armour || this.stock.essence < def.essence) {
      return this.hud.toast('Voraussetzungen fehlen', `Benötigt ${def.ration} Ration, ${def.armour} Rüstung und ${def.essence} Essenz.`, true);
    }
    this.stock.ration -= def.ration;
    this.stock.armour -= def.armour;
    this.stock.essence -= def.essence;
    this.hud.toast(`${def.label} wird gerufen`, `${BALANCE.recruitmentSeconds[kind]} Sekunden am Covenant-Herz.`);
    this.time.delayedCall((BALANCE.recruitmentSeconds[kind] * 1000) / Math.max(this.speed, 1), () => {
      if (this.ended) return;
      this.createUnit(kind, 32 + Phaser.Math.Between(-1, 1), 34 + Phaser.Math.Between(-1, 1), true);
      this.stats.recruited++;
      this.audio.tone(360, 0.13, 0.03, 'triangle');
      this.popup(32, 34, def.label, '#dfc36e', 1100);
    });
  }

  private covenantPulse(): void {
    if (this.stock.essence < BALANCE.pulseCost || this.pulseCooldown > 0) return;
    this.stock.essence -= BALANCE.pulseCost;
    this.pulseCooldown = BALANCE.pulseCooldown;
    this.heartHp = Math.min(BALANCE.heartHp, this.heartHp + 20);
    for (const enemy of this.enemies.filter((candidate) => Phaser.Math.Distance.Between(candidate.x, candidate.y, 32, 34) <= 6)) {
      enemy.hp -= 25;
    }
    const ring = this.add.circle(this.wx(32), this.wy(34), 12).setStrokeStyle(3, COLORS.essence, 0.9).setDepth(50);
    this.tweens.add({ targets: ring, radius: TILE * 6, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
    this.audio.tone(84, 0.5, 0.04, 'sine');
  }

  private setTool(tool: ToolKind): void {
    this.tool = tool;
    const hints: Partial<Record<ToolKind, string>> = {
      pan: 'Ziehen: Kamera bewegen · Mausrad/Pinch: zoomen · Klick: untersuchen',
      dig: 'Ziehe eine L-Route durch Fels · R dreht den Knick · Arbeiter graben automatisch',
      chamber: 'Ziehe eine rechteckige Kammer (max. 10×10)',
      'banner-attack': 'Setze das Banner auf ein feindliches Gebiet. Kämpfer sammeln sich automatisch.',
      'banner-defend': 'Setze den Haltepunkt. Frontkämpfer stehen vor Fernkämpfern.',
      trap: 'Klicke auf begehbaren Boden. Kosten: 2 Rüstungsgüter · 6 Ladungen.',
    };
    if (tool.startsWith('room-')) {
      const kind = tool.slice(5) as RoomKind;
      const room = ROOM_DEFINITIONS[kind];
      this.hud.setHint(`${room.label}: mindestens ${room.minW}×${room.minH} auf beanspruchtem Boden · ${room.baseCost} Metall`);
    } else {
      this.hud.setHint(hints[tool]);
    }
    this.updateHud();
  }

  private setSpeed(speed: 0 | 1 | 2): void {
    this.speed = speed;
    this.updateHud();
  }

  private commitTool(start: GridPoint, end: GridPoint): void {
    if (this.tool === 'dig' || this.tool === 'chamber') {
      const points = this.tool === 'dig'
        ? lineRoute(start, end, this.horizontalFirst)
        : this.rectPoints(start, end).slice(0, 100);
      let marked = 0;
      for (const point of points) {
        if (!this.inBounds(point.x, point.y) || this.map[point.y][point.x] !== 0) continue;
        this.digMarks.add(this.key(point.x, point.y));
        marked++;
      }
      this.hud.toast('Grabung markiert', `${marked} Felsfelder · ${Math.min(3, this.workers.length)} Arbeiter verfügbar`);
      this.drawWorld();
      return;
    }
    if (this.tool.startsWith('room-')) {
      this.placeRoom(this.tool.slice(5) as RoomKind, start, end);
      return;
    }
    if (this.tool === 'banner-attack') {
      this.bannerAttack = end;
      this.createBanner('attack', end);
      this.audio.tone(235, 0.1, 0.025, 'square');
      return;
    }
    if (this.tool === 'banner-defend') {
      this.bannerDefend = end;
      this.createBanner('defend', end);
      return;
    }
    if (this.tool === 'trap') this.placeTrap(end);
  }

  private placeRoom(kind: RoomKind, start: GridPoint, end: GridPoint): void {
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const w = Math.abs(end.x - start.x) + 1;
    const h = Math.abs(end.y - start.y) + 1;
    const def = ROOM_DEFINITIONS[kind];
    const orientationValid = (w >= def.minW && h >= def.minH) || (w >= def.minH && h >= def.minW);
    if (!orientationValid) return this.hud.toast('Fläche zu klein', `${def.label} benötigt mindestens ${def.minW}×${def.minH}.`, true);
    const cells = this.rectPoints(start, end);
    if (cells.some((point) => !this.isPassable(point.x, point.y) || !this.known[point.y][point.x])) {
      return this.hud.toast('Ungültige Fläche', 'Räume können nur auf bekanntem, beanspruchtem Boden entstehen.', true);
    }
    if (cells.some((point) => this.rooms.some((room) => this.pointInRoom(point, room)))) {
      return this.hud.toast('Fläche belegt', 'Ein bestehender Raum blockiert die Auswahl.', true);
    }
    if (this.stock.metal < def.baseCost) return this.hud.toast('Zu wenig Metall', `${def.label} kostet ${def.baseCost} Metall.`, true);
    this.stock.metal -= def.baseCost;
    this.rooms.push({ id: this.nextId++, kind, x, y, w, h, progress: 0, activeRecipe: false });
    this.drawWorld();
    this.audio.tone(188, 0.09, 0.02, 'square');
    this.hud.toast(`${def.label} errichtet`, kind === 'bedroom' ? `${Math.floor((w * h) / 4)} Betten verfügbar.` : `${w * h} Felder funktionsbereit.`);
  }

  private placeTrap(point: GridPoint): void {
    if (!this.isPassable(point.x, point.y) || this.stock.armour < 2) {
      return this.hud.toast('Falle blockiert', 'Benötigt begehbaren Boden und 2 Rüstungsgüter.', true);
    }
    this.stock.armour -= 2;
    this.traps.push({
      id: this.nextId++,
      x: point.x,
      y: point.y,
      charges: 6,
      cooldown: 0,
      sprite: this.add.sprite(this.wx(point.x), this.wy(point.y), 'trap').setDepth(16),
    });
    this.hud.toast('Bolzenfalle geladen', '6 Ladungen · Arbeiter liefern automatisch nach, sobald Rüstung verfügbar ist.');
  }

  private drawPreview(start: GridPoint, end: GridPoint): void {
    this.preview.clear();
    if (this.tool === 'dig') {
      this.preview.fillStyle(COLORS.gold, 0.36);
      for (const point of lineRoute(start, end, this.horizontalFirst)) {
        this.preview.fillRect(point.x * TILE + 3, point.y * TILE + 3, TILE - 6, TILE - 6);
      }
    } else if (this.tool === 'chamber' || this.tool.startsWith('room-')) {
      const valid = !this.tool.startsWith('room-') || this.rectPoints(start, end).every((point) => this.isPassable(point.x, point.y));
      this.preview.fillStyle(valid ? 0x68ac82 : 0xbd5d62, 0.34);
      const x = Math.min(start.x, end.x) * TILE;
      const y = Math.min(start.y, end.y) * TILE;
      const w = (Math.abs(end.x - start.x) + 1) * TILE;
      const h = (Math.abs(end.y - start.y) + 1) * TILE;
      this.preview.fillRect(x + 2, y + 2, w - 4, h - 4);
      this.preview.lineStyle(2, valid ? 0x9dd6ad : 0xe17c80, 0.8).strokeRect(x + 2, y + 2, w - 4, h - 4);
    } else {
      this.preview.lineStyle(2, COLORS.gold, 0.9).strokeCircle(this.wx(end.x), this.wy(end.y), TILE * (this.tool === 'banner-attack' ? 6 : 1));
    }
  }

  private drawWorld(): void {
    if (!this.terrain) return;
    this.terrain.clear();
    this.detail.clear();
    this.terrain.fillStyle(COLORS.void).fillRect(0, 0, W * TILE, H * TILE);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x * TILE;
        const py = y * TILE;
        if (this.map[y][x] === 1 && this.known[y][x]) {
          const checker = (x + y) % 2 ? COLORS.floor : COLORS.floorHi;
          this.terrain.fillStyle(checker).fillRect(px, py, TILE, TILE);
          this.terrain.lineStyle(1, 0x2c313d, 0.22).strokeRect(px, py, TILE, TILE);
          if ((x * 13 + y * 7) % 11 === 0) this.detail.fillStyle(0x4b4d53, 0.25).fillRect(px + 5, py + 8, 3, 2);
        } else {
          const checker = (x * 5 + y * 3) % 4 ? COLORS.rock : COLORS.rockHi;
          this.terrain.fillStyle(checker).fillRect(px, py, TILE, TILE);
          this.terrain.lineStyle(1, 0x12141c, 0.38).strokeRect(px, py, TILE, TILE);
          this.detail.fillStyle(0x4a4d5c, 0.26).fillRect(px + 4 + ((x * 7) % 9), py + 5 + ((y * 5) % 11), 6, 2);
        }
        if (this.digMarks.has(this.key(x, y))) {
          this.detail.fillStyle(COLORS.gold, 0.24).fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
          this.detail.lineStyle(1, COLORS.gold, 0.7).lineBetween(px + 7, py + 7, px + TILE - 7, py + TILE - 7);
        }
      }
    }

    for (const node of this.nodes.filter((candidate) => !candidate.discovered)) {
      for (let y = node.chamber.y - 4; y <= node.chamber.y + node.chamber.h + 3; y++) {
        for (let x = node.chamber.x - 4; x <= node.chamber.x + node.chamber.w + 3; x++) {
          if (!this.inBounds(x, y) || this.map[y][x] !== 0) continue;
          const distance = Math.max(Math.abs(x - node.x), Math.abs(y - node.y));
          if (distance > 6 || (x * 3 + y * 5) % 5) continue;
          this.detail.lineStyle(1, node.color, 0.48).lineBetween(x * TILE + 8, y * TILE + 6, x * TILE + 15, y * TILE + 14);
        }
      }
    }

    for (const room of this.rooms) {
      const def = ROOM_DEFINITIONS[room.kind];
      this.detail.fillStyle(def.color, 0.48).fillRect(room.x * TILE + 2, room.y * TILE + 2, room.w * TILE - 4, room.h * TILE - 4);
      this.detail.lineStyle(2, def.color, 0.9).strokeRect(room.x * TILE + 2, room.y * TILE + 2, room.w * TILE - 4, room.h * TILE - 4);
      this.detail.fillStyle(0x090a0e, 0.68).fillRect(room.x * TILE + 5, room.y * TILE + 5, 18, 18);
      this.detail.fillStyle(0xd9c897, 0.5).fillCircle(room.x * TILE + 14, room.y * TILE + 14, 5);
      if (room.kind === 'bedroom') {
        const beds = Math.floor((room.w * room.h) / 4);
        for (let i = 0; i < beds; i++) {
          const bx = room.x * TILE + 8 + (i % Math.max(1, room.w - 1)) * TILE;
          const by = room.y * TILE + 8 + Math.floor(i / Math.max(1, room.w - 1)) * TILE;
          this.detail.fillStyle(0x6b7890, 0.8).fillRect(bx, by, TILE - 7, TILE - 11);
        }
      }
      if (room.kind === 'prison') {
        this.detail.lineStyle(2, 0xa69aa9, 0.6);
        for (let gx = room.x * TILE + 9; gx < (room.x + room.w) * TILE; gx += 9) {
          this.detail.lineBetween(gx, room.y * TILE + 5, gx, (room.y + room.h) * TILE - 5);
        }
      }
    }
  }

  private drawStatus(): void {
    this.statusLayer.clear();
    for (const actor of this.units) this.healthBar(actor.x, actor.y, actor.hp / actor.maxHp, 0x6da78b);
    for (const enemy of this.enemies.filter((candidate) => candidate.sprite.visible)) {
      if (enemy.hp < enemy.maxHp) this.healthBar(enemy.x, enemy.y, enemy.hp / enemy.maxHp, COLORS.blood);
    }
    for (const room of this.rooms.filter((candidate) => candidate.activeRecipe)) {
      const recipe = RECIPES[room.kind as keyof typeof RECIPES];
      const center = this.roomCenter(room);
      const progress = room.progress / recipe.seconds;
      this.statusLayer.fillStyle(0x090a0d, 0.85).fillRect(this.wx(center.x) - 18, this.wy(room.y) - 18, 36, 4);
      this.statusLayer.fillStyle(COLORS.gold).fillRect(this.wx(center.x) - 17, this.wy(room.y) - 17, 34 * progress, 2);
    }
  }

  private healthBar(x: number, y: number, ratio: number, color: number): void {
    this.statusLayer.fillStyle(0x08090c, 0.85).fillRect(this.wx(x) - 10, this.wy(y) - 16, 20, 3);
    this.statusLayer.fillStyle(color).fillRect(this.wx(x) - 9, this.wy(y) - 15, Math.max(0, 18 * ratio), 1);
  }

  private inspectAt(point: GridPoint): void {
    const node = this.nodes.find((candidate) => candidate.discovered && Phaser.Math.Distance.Between(point.x, point.y, candidate.x, candidate.y) < 2);
    if (node) {
      const enemies = this.enemies.filter((enemy) => enemy.origin === node.id).length;
      this.selectedContext = {
        title: node.label,
        body: `${node.amount}/${node.initial} ${ITEM_LABELS[node.kind]} · ${node.claimed ? 'beansprucht' : `feindlich (${enemies} Wächter)`}`,
      };
      return;
    }
    const room = this.rooms.find((candidate) => this.pointInRoom(point, candidate));
    if (room) {
      const def = ROOM_DEFINITIONS[room.kind];
      let status = 'Bereit';
      if (room.kind in RECIPES) {
        const recipe = RECIPES[room.kind as keyof typeof RECIPES];
        status = room.activeRecipe ? `Produktion ${Math.floor((room.progress / recipe.seconds) * 100)} %` : `Wartet auf ${ITEM_LABELS[recipe.input]}`;
      }
      this.selectedContext = { title: def.label, body: `${room.w}×${room.h} Felder · ${status}` };
      return;
    }
    const worker = this.workers.find((candidate) => Phaser.Math.Distance.Between(point.x, point.y, candidate.x, candidate.y) < 1);
    if (worker) {
      const labels: Record<JobKind, string> = {
        idle: 'Kein erreichbarer Auftrag',
        dig: 'Gräbt',
        mine: 'Baut Rohstoff ab',
        pickup: 'Holt Gegenstand',
        deliver: 'Transportiert Gut',
        'prisoner-pick': 'Holt Gefangenen',
        'prisoner-deliver': 'Eskortiert Gefangenen',
      };
      this.selectedContext = { title: `Arbeiter ${worker.id}`, body: `${labels[worker.state]}${worker.carry ? ` · trägt ${ITEM_LABELS[worker.carry.kind]}` : ''}` };
      return;
    }
    this.selectedContext = undefined;
  }

  private updateHud(): void {
    if (!this.hud) return;
    const objective = MISSION_PHASES[Math.min(this.phase - 1, MISSION_PHASES.length - 1)];
    const state: HudState = {
      hp: this.heartHp,
      maxHp: BALANCE.heartHp,
      ore: this.stock.ore,
      biomass: this.stock.biomass,
      metal: this.stock.metal,
      rations: this.stock.ration,
      essence: this.stock.essence,
      armour: this.stock.armour,
      beds: this.bedCapacity(),
      bedsUsed: this.bedsUsed(),
      wave: String(this.currentWave),
      speed: this.speed,
      tool: this.tool,
      phase: this.phase,
      objectiveTitle: objective.title,
      objectiveBody: objective.body,
      elapsed: this.elapsed,
      trust: this.stats.trust,
      fear: this.stats.fear,
      pulseReady: this.stock.essence >= BALANCE.pulseCost && this.pulseCooldown <= 0,
      canRecruit: {
        guard: this.canRecruit('guard'),
        archer: this.canRecruit('archer'),
        hexbinder: this.canRecruit('hexbinder'),
      },
      context: this.selectedContext,
    };
    this.hud.update(state);
  }

  private canRecruit(kind: 'guard' | 'archer' | 'hexbinder'): boolean {
    const def = UNIT_DEFINITIONS[kind];
    if (this.bedsUsed() >= this.bedCapacity() || this.stock.ration < def.ration) return false;
    if (!this.rooms.some((room) => room.kind === 'kitchen')) return false;
    if ((kind === 'guard' || kind === 'archer') && (!this.rooms.some((room) => room.kind === 'workshop') || this.stock.armour < def.armour)) return false;
    if (kind === 'hexbinder' && (!this.nodes.find((node) => node.id === 'shrine')?.claimed || this.stock.essence < def.essence)) return false;
    return true;
  }

  private canMineNode(node: ResourceNode): boolean {
    if (!node.discovered || !node.claimed || node.amount <= 0) return false;
    if (this.enemies.some((enemy) => enemy.origin === node.id)) return false;
    return this.reachableFromHeart(node.x, node.y);
  }

  private createLooseItem(kind: ItemKind, amount: number, x: number, y: number): LooseItem {
    const item: LooseItem = {
      id: this.nextId++,
      kind,
      amount,
      x,
      y,
      sprite: this.add.sprite(this.wx(x), this.wy(y), itemTexture[kind]).setDepth(25),
    };
    item.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.selectedContext = { title: ITEM_LABELS[kind], body: `Lose Menge: ${amount} · wartet auf Transport` };
    });
    this.items.push(item);
    this.tweens.add({ targets: item.sprite, y: item.sprite.y - 3, yoyo: true, repeat: -1, duration: 850 + item.id % 300 });
    return item;
  }

  private deliveryPoint(kind: ItemKind): GridPoint {
    if (kind === 'essence') return { x: 32, y: 34 };
    const storage = this.rooms.find((room) => room.kind === 'storage');
    return storage ? this.roomCenter(storage) : { x: 29, y: 36 };
  }

  private endGame(victory: boolean): void {
    this.ended = true;
    this.speed = 0;
    if (victory) this.heartSpeak(HEART_LINES.victory);
    this.hud.showEnd(victory, {
      time: this.elapsed,
      recruited: this.stats.recruited,
      hauled: this.stats.hauled,
      trust: this.stats.trust,
      fear: this.stats.fear,
      choice: this.stats.choice,
    });
  }

  private heartSpeak(line: string): void {
    if (this.elapsed - this.lastHeartLine < 12 && this.elapsed > 1) return;
    this.lastHeartLine = this.elapsed;
    this.hud.toast('Das Herz', line);
    this.audio.tone(72, 0.11, 0.018, 'sine');
  }

  private createBanner(kind: 'attack' | 'defend', point: GridPoint): void {
    const existing = kind === 'attack' ? this.bannerAttackSprite : this.bannerDefendSprite;
    existing?.destroy(true);
    const pole = this.add.rectangle(0, 0, 2, 25, 0xcbb372).setOrigin(0.5, 1);
    const flag = this.add.triangle(0, -24, 0, 0, 15, 6, 0, 12, kind === 'attack' ? 0xa7464e : 0x50779b);
    const glow = this.add.circle(0, -8, kind === 'attack' ? TILE * 6 : TILE * 2, kind === 'attack' ? 0xa7464e : 0x50779b, 0.035);
    const container = this.add.container(this.wx(point.x), this.wy(point.y), [glow, pole, flag]).setDepth(29);
    this.tweens.add({ targets: flag, scaleX: 0.78, yoyo: true, repeat: -1, duration: 620 });
    if (kind === 'attack') this.bannerAttackSprite = container;
    else this.bannerDefendSprite = container;
  }

  private fitKnownMap(): void {
    const camera = this.cameras.main;
    if (window.innerWidth < 900) {
      camera.setZoom(0.58);
      camera.centerOn(32 * TILE, 20 * TILE);
    } else {
      camera.setZoom(0.7);
      camera.centerOn(32 * TILE, 20 * TILE);
    }
  }

  private popup(x: number, y: number, text: string, color: string, duration = 850): void {
    const label = this.add.text(this.wx(x), this.wy(y) - 16, text, {
      fontFamily: 'Barlow Condensed, Arial',
      fontSize: '11px',
      fontStyle: 'bold',
      color,
      stroke: '#090a0d',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(70);
    this.tweens.add({
      targets: label,
      y: label.y - 24,
      alpha: 0,
      duration,
      ease: 'Sine.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  private hitFlash(sprite: Phaser.GameObjects.Sprite): void {
    sprite.setTintFill(0xffffff);
    this.time.delayedCall(70, () => sprite.clearTint());
  }

  private reachableFromHeart(x: number, y: number): boolean {
    if (!this.isPassable(x, y)) return false;
    return findPath(W, H, { x: 32, y: 34 }, { x, y }, (px, py) => this.isPassable(px, py)).length > 0
      || (x === 32 && y === 34);
  }

  private pathBetween(from: GridPoint, to: GridPoint): GridPoint[] {
    const start = { x: Phaser.Math.Clamp(Math.round(from.x), 0, W - 1), y: Phaser.Math.Clamp(Math.round(from.y), 0, H - 1) };
    const goal = { x: Phaser.Math.Clamp(Math.round(to.x), 0, W - 1), y: Phaser.Math.Clamp(Math.round(to.y), 0, H - 1) };
    return findPath(W, H, start, goal, (x, y) => this.isPassable(x, y));
  }

  private pointerToTile(pointer: Phaser.Input.Pointer): GridPoint {
    const world = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    return {
      x: Phaser.Math.Clamp(Math.floor(world.x / TILE), 0, W - 1),
      y: Phaser.Math.Clamp(Math.floor(world.y / TILE), 0, H - 1),
    };
  }

  private roomCenter(room: Room): GridPoint {
    return { x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) };
  }

  private bedCapacity(): number {
    return this.rooms.filter((room) => room.kind === 'bedroom').reduce((sum, room) => sum + Math.floor((room.w * room.h) / 4), 0);
  }

  private bedsUsed(): number {
    return this.units.filter((unit) => unit.bed).length;
  }

  private pointInRoom(point: GridPoint, room: Room): boolean {
    return point.x >= room.x && point.y >= room.y && point.x < room.x + room.w && point.y < room.y + room.h;
  }

  private rectPoints(a: GridPoint, b: GridPoint): GridPoint[] {
    const x1 = Math.min(a.x, b.x);
    const y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x, b.x);
    const y2 = Math.max(a.y, b.y);
    const points: GridPoint[] = [];
    for (let y = y1; y <= y2; y++) for (let x = x1; x <= x2; x++) points.push({ x, y });
    return points;
  }

  private neighbors(x: number, y: number): GridPoint[] {
    return [
      { x: x + 1, y },
      { x: x - 1, y },
      { x, y: y + 1 },
      { x, y: y - 1 },
    ].filter((point) => this.inBounds(point.x, point.y));
  }

  private isPassable(x: number, y: number): boolean {
    return this.inBounds(x, y) && this.map[y][x] === 1;
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < W && y < H;
  }

  private key(x: number, y: number): string {
    return `${x},${y}`;
  }

  private wx(tile: number): number {
    return tile * TILE + TILE / 2;
  }

  private wy(tile: number): number {
    return tile * TILE + TILE / 2;
  }
}
