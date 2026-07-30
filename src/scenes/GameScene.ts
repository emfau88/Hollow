import Phaser from 'phaser';
import { AudioController } from '../core/AudioController';
import {
  buildPathTree,
  findPath,
  lineRoute,
  manhattan,
  type GridPoint,
  type PathTree,
} from '../core/Grid';
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
import {
  TerrainRenderer,
  type TerrainFloor,
  type TerrainMaterial,
  type TerrainQuery,
} from '../core/TerrainRenderer';
import { HOLLOW_TERRAIN as TF, HOLLOW_TERRAIN_TILE } from '../config/HollowTerrainFrames';
import {
  DEFAULT_WORK_PRIORITIES,
  workerTaskOrder,
  type RoutineWorkerTask,
  type WorkPriorities,
} from '../core/WorkerPriorities';
import {
  WorkerJobBoard,
  type DeliveryKind,
  type WorkerJob,
  type WorkerJobSpec,
} from '../core/JobSystem';
import {
  bedroomCapacity,
  prisonCapacity,
  productionStations,
  roomCost,
} from '../core/GameRules';

const TILE = BALANCE.tileSize;
const W = BALANCE.mapWidth;
const H = BALANCE.mapHeight;

type JobKind = 'idle' | 'dig' | 'build' | 'claim' | 'mine' | 'pickup' | 'deliver' | 'prisoner-pick' | 'prisoner-deliver';
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
  assignmentCooldown: number;
  jobId?: string;
  delivery?: { kind: DeliveryKind; roomId?: number; trapId?: number };
  idleReason?: string;
  lastProgressX: number;
  lastProgressY: number;
  stuckSeconds: number;
  pathFailures: number;
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
  hungerTimer: number;
  hungry: boolean;
  seekingFood: boolean;
  healing: boolean;
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
  amountText?: Phaser.GameObjects.Text;
  location: 'loose' | 'output' | 'stored';
  sourceRoomId?: number;
  storageRoomId?: number;
  storageSlot?: number;
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
  inputStored: number;
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

type TileGeology = 'solid' | 'excavated';
type TileVisibility = 'hidden' | 'charted' | 'revealed';
type TileControl = 'neutral' | 'claiming' | 'owned' | 'enemy';
type TileConstruction = 'none' | 'planned' | 'building' | 'complete';
type TileRoomKind = RoomKind | 'heart';

interface WorldTile {
  geology: TileGeology;
  visibility: TileVisibility;
  control: TileControl;
  construction: TileConstruction;
  claimable: boolean;
  roomId?: number;
  roomKind?: TileRoomKind;
}

// Claimed floor is painted over the starting cavern around the heart so it reads
// as a deliberately settled space rather than a raw tunnel.
const NORTH_SHIFT = 8;
const sy = (y: number) => y + NORTH_SHIFT;
const HEART_TILE = { x: 32, y: sy(22) };
// Heart floor: the 3×3 around the heart uses the dedicated heart floor frame.
const HEART_FLOOR = { x: 31, y: sy(21), w: 3, h: 3 };
const TERRAIN_MATERIAL_ANCHORS: ReadonlyArray<{
  material: TerrainMaterial;
  x: number;
  y: number;
  seed: number;
}> = [
  { material: 'slate', x: 32, y: sy(22), seed: 3 },
  { material: 'basalt', x: 17, y: sy(19), seed: 11 },
  { material: 'damp', x: 43, y: sy(25), seed: 19 },
  { material: 'roots', x: 50, y: sy(34), seed: 29 },
  { material: 'earth', x: 44, y: sy(8), seed: 37 },
];

export class GameScene extends Phaser.Scene {
  private tiles: WorldTile[][] = [];
  private terrainRenderer!: TerrainRenderer;
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
  private roomGlows: Phaser.GameObjects.GameObject[] = [];
  private roomProps: Phaser.GameObjects.Image[] = [];
  private heartPathTree?: PathTree;
  private bannerAttackPath: GridPoint[] = [];
  private nextHudUpdateAt = 0;
  private nextStatusDrawAt = 0;
  private bannerAttackTween?: Phaser.Tweens.Tween;
  private bannerDefendTween?: Phaser.Tweens.Tween;
  private jobBoard = new WorkerJobBoard();
  private jobsDirty = true;
  private nextJobSyncAt = 0;
  private pathFailureCount = 0;
  private roomInputVisuals = new Map<number, Phaser.GameObjects.Container>();
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
  private bannerDefend: GridPoint = { ...HEART_TILE };
  private bannerAttackSprite?: Phaser.GameObjects.Container;
  private bannerDefendSprite?: Phaser.GameObjects.Container;
  private pulseCooldown = 0;
  private lastHeartLine = -30;
  private finalSpawnAt = 0;
  private finalSpawned = false;
  private waveOneSpawnAt?: number;
  private waveTwoSpawnAt?: number;
  private waveOneStartedAt?: number;
  private waveOneWarned = false;
  private waveTwoWarned = false;
  private workerSummoning = false;
  private ended = false;
  private claimToast = new Set<string>();
  private pointerDistance?: number;
  private pinchMid?: { x: number; y: number };
  private cameraKeys?: Record<string, Phaser.Input.Keyboard.Key>;
  private workPriorities: WorkPriorities = { ...DEFAULT_WORK_PRIORITIES };

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

  preload(): void {
    // Terrain is built as a calm in-engine atlas in makeTextures(). Loading an
    // external pebble sheet here made the entire world shimmer while panning.
    this.load.image('generated-covenant-heart', 'assets/generated/covenant-heart-gameplay-256.png');
    this.load.image('resource-iron-vein', 'assets/generated/resources-v2/iron-vein.png');
    this.load.image('resource-iron-depleted', 'assets/generated/resources-v2/iron-vein-depleted.png');
    this.load.image('resource-fungus-cluster', 'assets/generated/resources-v2/fungus-cluster.png');
    this.load.image('resource-essence-seal', 'assets/generated/resources-v2/essence-seal.png');
    this.load.spritesheet('terrain-v3-rock', 'assets/generated/terrain-v3/rock-top.png?v=3-16c', {
      frameWidth: TILE,
      frameHeight: TILE,
    });
    this.load.spritesheet('terrain-v3-raw-floor', 'assets/generated/terrain-v3/raw-floor.png?v=3-16c', {
      frameWidth: TILE,
      frameHeight: TILE,
    });
    this.load.spritesheet('terrain-v3-claimed-floor', 'assets/generated/terrain-v3/claimed-floor.png?v=3-16c', {
      frameWidth: TILE,
      frameHeight: TILE,
    });
    this.load.spritesheet('terrain-v4-claimed-corridor', 'assets/generated/terrain-v3/claimed-corridor.png?v=4', {
      frameWidth: TILE,
      frameHeight: TILE,
    });
    for (const [key, file] of [
      ['terrain-v4-rock-basalt', 'rock-basalt.png'],
      ['terrain-v4-rock-damp', 'rock-damp.png'],
      ['terrain-v4-rock-roots', 'rock-roots.png'],
      ['terrain-v4-rock-earth', 'rock-earth.png'],
    ] as const) {
      this.load.spritesheet(key, `assets/generated/terrain-v3/${file}?v=4`, {
        frameWidth: TILE,
        frameHeight: TILE,
      });
    }
    this.load.image('terrain-v3-wall-edge', 'assets/generated/terrain-v3/wall-edge.png');
    this.load.image('terrain-v3-wall-corner', 'assets/generated/terrain-v3/wall-corner.png');
    this.load.image('terrain-v3-claimed-border', 'assets/generated/terrain-v3/claimed-border.png');
    this.load.image('terrain-v3-enemy-border', 'assets/generated/terrain-v3/enemy-border.png');
    this.load.image('room-prop-bed', 'assets/generated/room-props-v3/bed.png');
    this.load.image('room-prop-cauldron', 'assets/generated/room-props-v3/cauldron.png');
    this.load.image('room-prop-furnace', 'assets/generated/room-props-v3/furnace.png');
    this.load.image('room-prop-workbench', 'assets/generated/room-props-v3/workbench.png');
    this.load.image('room-prop-prison', 'assets/generated/room-props-v3/prison-gate.png');
    this.load.image('room-prop-storage', 'assets/generated/room-props-v3/storage.png');
    for (const key of [
      'worker',
      'guard',
      'archer',
      'hexbinder',
      'inquisitor',
      'crawler',
      'dwarf',
      'crossbow',
      'adept',
      'captain',
      'scout',
      'warden',
      'item-ore',
      'item-biomass',
      'item-essence',
      'item-metal',
      'item-ration',
      'item-armour',
      'trap',
      'prisoner',
    ]) {
      const textureKey = ['guard', 'archer', 'hexbinder', 'inquisitor'].includes(key)
        ? `unit-${key}`
        : ['crawler', 'dwarf', 'crossbow', 'adept', 'captain', 'scout', 'warden'].includes(key)
          ? `enemy-${key}`
          : key;
      this.load.image(textureKey, `assets/generated/units-v1/${key}.png`);
    }
  }

  create(): void {
    this.createMap();
    this.detail = this.add.graphics().setDepth(4);
    this.preview = this.add.graphics().setDepth(60);
    this.statusLayer = this.add.graphics().setDepth(55);
    this.terrainRenderer = new TerrainRenderer(this, {
      rock: 'terrain-v3-rock',
      rockBasalt: 'terrain-v4-rock-basalt',
      rockDamp: 'terrain-v4-rock-damp',
      rockRoots: 'terrain-v4-rock-roots',
      rockEarth: 'terrain-v4-rock-earth',
      rawFloor: 'terrain-v3-raw-floor',
      claimedCorridor: 'terrain-v4-claimed-corridor',
      claimedFloor: 'terrain-v3-claimed-floor',
      wallEdge: 'terrain-v3-wall-edge',
      wallCorner: 'terrain-v3-wall-corner',
      claimedBorder: 'terrain-v3-claimed-border',
      enemyBorder: 'terrain-v3-enemy-border',
    }, TILE, W, H);
    this.createNodes();
    this.drawWorld();
    this.seedStartingStorage();
    this.createStartingPopulation();
    this.createBanner('defend', this.bannerDefend);
    this.setupHud();
    this.setupDebug();
    this.setupInput();

    this.cameras.main.setBounds(0, 0, W * TILE, H * TILE);
    this.cameras.main.setZoom(1);
    this.cameras.main.centerOn(HEART_TILE.x * TILE, HEART_TILE.y * TILE);
    this.cameras.main.setBackgroundColor(COLORS.void);

    this.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => this.simulationStep(0.1),
    });

    this.scale.on('resize', () => {
      if (window.innerWidth < 950) this.cameras.main.setZoom(0.8);
    });
  }

  private setupHud(): void {
    this.hud = new HudController({
      setTool: (tool) => this.setTool(tool),
      recruit: (kind) => this.recruit(kind),
      summonWorker: () => this.summonWorker(),
      setSpeed: (speed) => this.setSpeed(speed),
      cycleWorkPriority: (task) => this.cycleWorkPriority(task),
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
      this.storeItem('metal', 10);
      this.storeItem('ration', 10);
      this.stock.essence += 10;
      this.storeItem('armour', 10);
      this.updateHud();
    });
    panel.querySelector('[data-debug="reveal"]')?.addEventListener('click', () => {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) this.tiles[y][x].visibility = 'revealed';
      }
      for (const node of this.nodes) {
        node.discovered = true;
        node.sprite?.setVisible(true);
        for (const enemy of this.enemies.filter((candidate) => candidate.origin === node.id)) enemy.sprite.setVisible(true);
      }
      this.drawWorld();
      this.fitKnownMap();
    });
    panel.querySelector('[data-debug="economy"]')?.addEventListener('click', () => {
      this.storeItem('metal', 10);
      this.storeItem('ration', 5);
      this.storeItem('armour', 5);
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
        this.setChamberControl(node, 'owned');
        node.sprite?.setVisible(true);
      }
      for (const enemy of this.enemies.filter((candidate) => candidate.origin)) enemy.sprite.destroy();
      this.enemies = this.enemies.filter((candidate) => !candidate.origin);
      const debugRooms: Array<{ kind: RoomKind; x: number; y: number; w: number; h: number }> = [
        { kind: 'kitchen', x: 26, y: sy(18), w: 2, h: 3 },
        { kind: 'smelter', x: 28, y: sy(18), w: 2, h: 3 },
        { kind: 'workshop', x: 34, y: sy(18), w: 2, h: 3 },
        { kind: 'bedroom', x: 36, y: sy(18), w: 2, h: 4 },
        { kind: 'prison', x: 34, y: sy(23), w: 2, h: 3 },
      ];
      for (const room of debugRooms) {
        if (!this.rooms.some((candidate) => candidate.kind === room.kind)) {
          const builtRoom: Room = { id: this.nextId++, ...room, progress: 0, activeRecipe: false, inputStored: 0 };
          this.rooms.push(builtRoom);
          this.assignRoomTiles(builtRoom, 'complete');
        }
      }
      if (this.units.length < 4) {
        this.createUnit('guard', 31, sy(21), true);
        this.createUnit('archer', 33, sy(21), true);
        this.createUnit('hexbinder', 34, sy(22), true);
      }
      this.phase = 5;
      this.drawWorld();
      this.updateHud();
    });
    panel.querySelector('[data-debug="wave"]')?.addEventListener('click', () => this.spawnWave(Math.min(2, this.currentWave + 1)));
    panel.querySelector('[data-debug="captain"]')?.addEventListener('click', () => {
      if (this.prisoner) this.prisoner.sprite.destroy();
      const prison = this.rooms.find((room) => room.kind === 'prison' && this.isRoomComplete(room));
      if (!prison) {
        this.hud.toast('Debug', 'Zuerst „Wirtschaft bereit“ wählen.', true);
        return;
      }
      const point = this.roomCenter(prison);
      this.prisoner = {
        x: point.x,
        y: point.y,
        status: 'cell',
        sprite: this.add.sprite(this.wx(point.x), this.wy(point.y), 'prisoner').setDisplaySize(34, 34).setDepth(31),
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
        if (value) {
          const count = (states: JobKind[]) => this.workers.filter((worker) => states.includes(worker.state)).length;
          const jobs = this.jobBoard.stats(this.elapsed);
          value.textContent = [
            `Phase ${this.phase}`,
            `${count(['dig'])} graben`,
            `${count(['build'])} bauen`,
            `${count(['claim'])} beanspruchen`,
            `${count(['mine'])} abbauen`,
            `${count(['pickup', 'deliver'])} transportieren`,
            `${this.items.filter((item) => item.location !== 'stored').length} lose Güter`,
            `${this.storedAmount()}/${this.storageCapacity()} Lager`,
            `${jobs.total} Jobs/${jobs.reserved} reserviert`,
            `${Math.round(this.game.loop.actualFps)} FPS`,
            `${this.tweens.getTweens().length} Tweens`,
            `${this.pathFailureCount} Pfadfehler`,
          ].join(' · ');
        }
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

  update(time: number, delta: number): void {
    const camera = this.cameras.main;
    const move = (delta / 1000) * 500 / camera.zoom;
    if (this.cameraKeys) {
      if (this.cameraKeys.W.isDown || this.cameraKeys.UP.isDown) camera.scrollY -= move;
      if (this.cameraKeys.S.isDown || this.cameraKeys.DOWN.isDown) camera.scrollY += move;
      if (this.cameraKeys.A.isDown || this.cameraKeys.LEFT.isDown) camera.scrollX -= move;
      if (this.cameraKeys.D.isDown || this.cameraKeys.RIGHT.isDown) camera.scrollX += move;
    }
    this.handlePinch();
    this.interpolateActors(delta);
    if (time >= this.nextStatusDrawAt) {
      this.nextStatusDrawAt = time + 33;
      this.drawStatus();
    }
  }

  private interpolateActors(delta: number): void {
    const blend = 1 - Math.exp(-Math.min(delta, 100) / 42);
    for (const worker of this.workers) {
      worker.sprite.setPosition(
        Phaser.Math.Linear(worker.sprite.x, this.wx(worker.x), blend),
        Phaser.Math.Linear(worker.sprite.y, this.wy(worker.y), blend),
      );
      worker.carryText.setPosition(worker.sprite.x, worker.sprite.y - 13);
    }
    for (const actor of this.units) {
      actor.sprite.setPosition(
        Phaser.Math.Linear(actor.sprite.x, this.wx(actor.x), blend),
        Phaser.Math.Linear(actor.sprite.y, this.wy(actor.y), blend),
      );
    }
    for (const enemy of this.enemies) {
      enemy.sprite.setPosition(
        Phaser.Math.Linear(enemy.sprite.x, this.wx(enemy.x), blend),
        Phaser.Math.Linear(enemy.sprite.y, this.wy(enemy.y), blend),
      );
    }
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

  /**
   * Creates the complete 28 px terrain atlas in code. The prior pebble texture
   * put high-contrast detail into every tile; this version reserves contrast for
   * edges, cracks, rooms and resources, leaving broad rock and ground readable
   * during camera movement.
   */
  private makeCalmTerrainAtlas(): void {
    const key = 'hollow-terrain';
    if (this.textures.exists(key)) this.textures.remove(key);

    const columns = 11;
    const rows = 4;
    const atlasWidth = columns * TILE;
    const atlasHeight = rows * TILE;
    const g = this.make.graphics({ x: 0, y: 0 });
    const at = (frame: number) => ({ x: (frame % columns) * TILE, y: Math.floor(frame / columns) * TILE });
    const fill = (frame: number, color: number) => {
      const p = at(frame);
      g.fillStyle(color).fillRect(p.x, p.y, TILE, TILE);
      return p;
    };
    const slab = (frame: number, base: number, shade: number, highlight: number, crack = false) => {
      const p = fill(frame, base);
      // Rock must read as one large mass. Per-tile triangles made the terrain
      // vibrate into a checkerboard as soon as the camera moved. The atlas
      // keeps only a whisper of depth; real contrast is applied at edges.
      g.fillStyle(shade, 0.14).fillRect(p.x, p.y, TILE, 2);
      g.fillStyle(highlight, 0.07).fillRect(p.x, p.y + TILE - 2, TILE, 2);
      if (crack) {
        g.lineStyle(1, 0x0a0c10, 0.52)
          .lineBetween(p.x + 6, p.y + 4, p.x + 13, p.y + 11)
          .lineBetween(p.x + 13, p.y + 11, p.x + 11, p.y + 21)
          .lineBetween(p.x + 13, p.y + 11, p.x + 22, p.y + 15);
      }
    };

    // 0–9: quiet solid rock and rare resource hints.
    slab(TF.ROCK_MASSIVE_0, 0x1b2028, 0x11151b, 0x303844);
    slab(TF.ROCK_MASSIVE_1, 0x20252d, 0x141820, 0x35404b);
    slab(TF.ROCK_BRITTLE, 0x252830, 0x171a20, 0x3d424b, true);
    slab(TF.ROCK_DAMP, 0x192127, 0x10171c, 0x2e3a40);
    {
      const p = at(TF.ROCK_DAMP);
      g.fillStyle(0x39535a, 0.26).fillEllipse(p.x + 18, p.y + 19, 15, 7);
    }
    slab(TF.ROCK_MOSS, 0x20251f, 0x141816, 0x3a4032);
    {
      const p = at(TF.ROCK_MOSS);
      g.fillStyle(0x556f3e, 0.62).fillEllipse(p.x + 19, p.y + 18, 9, 5).fillCircle(p.x + 15, p.y + 21, 2);
    }
    const hint = (frame: number, color: number) => {
      slab(frame, 0x1d2229, 0x11161b, 0x333b45);
      const p = at(frame);
      // A short, directional seam reads as a resource vein before the chamber
      // is opened; the richer frame simply carries a wider cluster.
      g.lineStyle(2, color, 0.78)
        .lineBetween(p.x + 2, p.y + 20, p.x + 10, p.y + 15)
        .lineBetween(p.x + 10, p.y + 15, p.x + 17, p.y + 17)
        .lineBetween(p.x + 17, p.y + 17, p.x + 26, p.y + 8);
      g.fillStyle(color, 0.88).fillCircle(p.x + 10, p.y + 15, 3).fillCircle(p.x + 17, p.y + 17, 2.5);
      if (frame === TF.ROCK_IRON_LARGE || frame === TF.ROCK_IRON_RICH) {
        g.fillStyle(color, 0.8).fillCircle(p.x + 21, p.y + 10, 3.5);
      }
      if (frame === TF.ROCK_IRON_RICH) g.fillStyle(0xf0d58d, 0.55).fillCircle(p.x + 15, p.y + 15, 1.5);
    };
    hint(TF.ROCK_IRON_SMALL, 0xa96847);
    hint(TF.ROCK_IRON_LARGE, 0xc07954);
    hint(TF.ROCK_IRON_RICH, 0xe0a06a);
    hint(TF.ROCK_FUNGUS_HINT, 0x779d56);
    hint(TF.ROCK_ESSENCE_HINT, 0x8878c9);

    // 10–15: freshly dug earth; broad, low-contrast strata.
    for (let frame = TF.RAW_GROUND_0; frame <= TF.RAW_GROUND_5; frame++) {
      const p = fill(frame, 0x161b22 + (frame % 2 ? 0x020204 : 0));
      const offset = (frame - TF.RAW_GROUND_0) * 3;
      g.fillStyle(0x222a32, 0.42).fillRect(p.x, p.y + 5 + (offset % 5), TILE, 5);
      g.fillStyle(0x0c1015, 0.33).fillRect(p.x + 3, p.y + 20 - (offset % 4), 20, 2);
      if (frame % 3 === 0) g.fillStyle(0x3a4650, 0.28).fillCircle(p.x + 20, p.y + 9, 2);
    }

    // 16–21: settled dungeon floor with wider slab rhythm.
    for (let frame = TF.CLAIMED_FLOOR_0; frame <= TF.CLAIMED_FLOOR_5; frame++) {
      const p = fill(frame, 0x23232a);
      const shift = (frame - TF.CLAIMED_FLOOR_0) % 3;
      g.fillStyle(0x17181e, 0.72).fillRect(p.x + 2, p.y + 3, 24, 9).fillRect(p.x + 2, p.y + 15, 24, 10);
      g.lineStyle(1, 0x45434b, 0.38).lineBetween(p.x + 3 + shift, p.y + 13, p.x + 25, p.y + 13);
      g.fillStyle(0x6b5a3c, 0.16).fillCircle(p.x + 7 + shift * 4, p.y + 8, 1.5);
    }

    const roomColors: Record<RoomKind, number> = {
      storage: 0x4b4235,
      bedroom: 0x2d455b,
      kitchen: 0x425536,
      smelter: 0x613d31,
      workshop: 0x584531,
      prison: 0x3a3844,
    };
    const roomFrames: Record<RoomKind, number> = {
      storage: TF.ROOM_STORAGE,
      bedroom: TF.ROOM_BEDROOM,
      kitchen: TF.ROOM_KITCHEN,
      smelter: TF.ROOM_SMELTER,
      workshop: TF.ROOM_WORKSHOP,
      prison: TF.ROOM_PRISON,
    };
    for (const [kind, frame] of Object.entries(roomFrames) as [RoomKind, number][]) {
      const p = fill(frame, roomColors[kind]);
      g.fillStyle(0x0b0c10, 0.34).fillRect(p.x + 2, p.y + 2, 24, 24);
      g.lineStyle(1, 0xd2bd85, 0.2).strokeRect(p.x + 3, p.y + 3, 22, 22);
      g.fillStyle(roomColors[kind], 0.8).fillRect(p.x + 6, p.y + 6, 16, 16);
    }
    {
      const p = fill(TF.ROOM_HEART, 0x3c202a);
      g.fillStyle(0x5e2632).fillCircle(p.x + 14, p.y + 14, 10);
      g.fillStyle(0xb95564, 0.45).fillCircle(p.x + 14, p.y + 14, 5);
    }

    // 29–41: wall lips. These make a carved opening read as a thick cave wall
    // instead of a line drawn between individual grid cells.
    const edge = (frame: number, side: 'top' | 'bottom' | 'left' | 'right') => {
      const p = at(frame);
      g.fillStyle(0x07090d, 0.72);
      if (side === 'top') g.fillRect(p.x, p.y, TILE, 6);
      if (side === 'bottom') g.fillRect(p.x, p.y + TILE - 6, TILE, 6);
      if (side === 'left') g.fillRect(p.x, p.y, 6, TILE);
      if (side === 'right') g.fillRect(p.x + TILE - 6, p.y, 6, TILE);
      g.lineStyle(1, 0x4e5863, 0.38);
      if (side === 'top') g.lineBetween(p.x, p.y + 6, p.x + TILE, p.y + 6);
      if (side === 'bottom') g.lineBetween(p.x, p.y + TILE - 6, p.x + TILE, p.y + TILE - 6);
      if (side === 'left') g.lineBetween(p.x + 6, p.y, p.x + 6, p.y + TILE);
      if (side === 'right') g.lineBetween(p.x + TILE - 6, p.y, p.x + TILE - 6, p.y + TILE);
    };
    edge(TF.WALL_EDGE_TOP, 'top');
    edge(TF.WALL_EDGE_BOTTOM, 'bottom');
    edge(TF.WALL_EDGE_LEFT, 'left');
    edge(TF.WALL_EDGE_RIGHT, 'right');
    const wallLip = (frame: number, sides: Array<'top' | 'bottom' | 'left' | 'right'>) => {
      const p = at(frame);
      for (const side of sides) {
        g.fillStyle(0x07090d, 0.78);
        if (side === 'top') g.fillRect(p.x, p.y, TILE, 7);
        if (side === 'bottom') g.fillRect(p.x, p.y + TILE - 7, TILE, 7);
        if (side === 'left') g.fillRect(p.x, p.y, 7, TILE);
        if (side === 'right') g.fillRect(p.x + TILE - 7, p.y, 7, TILE);
        g.lineStyle(1, 0x59636e, 0.42);
        if (side === 'top') g.lineBetween(p.x, p.y + 7, p.x + TILE, p.y + 7);
        if (side === 'bottom') g.lineBetween(p.x, p.y + TILE - 7, p.x + TILE, p.y + TILE - 7);
        if (side === 'left') g.lineBetween(p.x + 7, p.y, p.x + 7, p.y + TILE);
        if (side === 'right') g.lineBetween(p.x + TILE - 7, p.y, p.x + TILE - 7, p.y + TILE);
      }
      // Broken stone teeth make long edges feel organic without adding noise.
      g.fillStyle(0x2d3540, 0.32);
      if (sides.includes('top')) g.fillTriangle(p.x + 5, p.y + 7, p.x + 10, p.y + 7, p.x + 7, p.y + 11);
      if (sides.includes('bottom')) g.fillTriangle(p.x + 18, p.y + TILE - 7, p.x + 23, p.y + TILE - 7, p.x + 21, p.y + TILE - 11);
      if (sides.includes('left')) g.fillTriangle(p.x + 7, p.y + 16, p.x + 7, p.y + 22, p.x + 11, p.y + 19);
      if (sides.includes('right')) g.fillTriangle(p.x + TILE - 7, p.y + 6, p.x + TILE - 7, p.y + 12, p.x + TILE - 11, p.y + 9);
    };
    wallLip(TF.WALL_CORNER_TL, ['top', 'left']);
    wallLip(TF.WALL_CORNER_TR, ['top', 'right']);
    wallLip(TF.WALL_CORNER_BL, ['bottom', 'left']);
    wallLip(TF.WALL_CORNER_BR, ['bottom', 'right']);
    wallLip(TF.WALL_T_N, ['top', 'left', 'right']);
    wallLip(TF.WALL_T_E, ['top', 'right', 'bottom']);
    wallLip(TF.WALL_T_S, ['left', 'bottom', 'right']);
    wallLip(TF.WALL_T_W, ['top', 'left', 'bottom']);
    wallLip(TF.WALL_CROSS, ['top', 'right', 'bottom', 'left']);
    for (const frame of [TF.THRESHOLD_HORIZONTAL, TF.THRESHOLD_VERTICAL]) {
      const p = fill(frame, 0x322717);
      g.fillStyle(0x72552d).fillRect(p.x + 3, p.y + (frame === TF.THRESHOLD_HORIZONTAL ? 10 : 3), frame === TF.THRESHOLD_HORIZONTAL ? 22 : 5, frame === TF.THRESHOLD_HORIZONTAL ? 6 : 22);
    }

    g.generateTexture(key, atlasWidth, atlasHeight);
    g.destroy();
    const texture = this.textures.get(key);
    for (let frame = 0; frame <= TF.THRESHOLD_VERTICAL; frame++) {
      texture.add(frame, 0, (frame % columns) * TILE, Math.floor(frame / columns) * TILE, TILE, TILE);
    }
  }

  private createMap(): void {
    this.tiles = Array.from({ length: H }, () =>
      Array.from({ length: W }, (): WorldTile => ({
        geology: 'solid',
        visibility: 'hidden',
        control: 'neutral',
        construction: 'none',
        claimable: true,
      })));

    const carve = (
      x: number,
      y: number,
      w: number,
      h: number,
      visibility: TileVisibility = 'hidden',
      control: TileControl = 'neutral',
      claimable = true,
    ) => {
      for (let ty = y; ty < y + h; ty++) {
        for (let tx = x; tx < x + w; tx++) {
          if (this.inBounds(tx, ty)) {
            const tile = this.tiles[ty][tx];
            tile.geology = 'excavated';
            tile.visibility = visibility;
            tile.control = control;
            tile.claimable = claimable;
          }
        }
      }
    };

    const chart = (
      x: number,
      y: number,
      w: number,
      h: number,
      shape: 'organic' | 'fortified' | 'ritual',
    ) => {
      for (let ty = y; ty < y + h; ty++) {
        for (let tx = x; tx < x + w; tx++) {
          if (!this.inBounds(tx, ty)) continue;
          const lx = tx - x;
          const ly = ty - y;
          const corner = (lx === 0 || lx === w - 1) && (ly === 0 || ly === h - 1);
          const nearCorner = (lx <= 1 || lx >= w - 2) && (ly <= 1 || ly >= h - 2);
          const edge = lx === 0 || lx === w - 1 || ly === 0 || ly === h - 1;
          const stableNoise = Math.abs((tx * 37 + ty * 61 + w * 11) % 13);
          const keep = shape === 'ritual'
            ? !corner && !(nearCorner && (lx + ly) % 2 === 0)
            : shape === 'fortified'
              ? !corner
              : !corner && !(edge && stableNoise === 0);
          if (!keep) continue;
          this.tiles[ty][tx].geology = 'excavated';
          this.tiles[ty][tx].visibility = 'charted';
        }
      }
    };

    carve(26, sy(18), 13, 9, 'revealed', 'owned');
    carve(31, sy(3), 3, 15, 'revealed', 'neutral', false);
    carve(28, sy(0), 9, 4, 'revealed', 'neutral', false);

    // A longer northern approach keeps the entrance from visually clipping
    // against the map boundary and gives invasion waves a readable runway.
    carve(30, 0, 5, NORTH_SHIFT + 1, 'revealed', 'neutral', false);
    carve(28, 6, 9, 5, 'revealed', 'neutral', false);

    // Strategic targets are pre-existing, disconnected caverns. The player can
    // read their silhouette and only needs to dig a connecting tunnel.
    chart(18, sy(28), 5, 6, 'organic');
    chart(42, sy(26), 7, 7, 'organic');
    chart(13, sy(14), 8, 7, 'fortified');
    chart(40, sy(8), 8, 7, 'ritual');

    const storage: Room = {
      id: this.nextId++,
      kind: 'storage',
      x: 27,
      y: sy(24),
      w: 4,
      h: 2,
      progress: 0,
      activeRecipe: false,
      inputStored: 0,
    };
    this.rooms.push(storage);
    this.assignRoomTiles(storage, 'complete');

    for (let y = HEART_FLOOR.y; y < HEART_FLOOR.y + HEART_FLOOR.h; y++) {
      for (let x = HEART_FLOOR.x; x < HEART_FLOOR.x + HEART_FLOOR.w; x++) {
        const tile = this.tiles[y][x];
        tile.roomKind = 'heart';
        tile.construction = 'complete';
      }
    }
  }

  private createNodes(): void {
    this.nodes = [
      {
        id: 'iron',
        label: 'Kleine Eisenader',
        kind: 'ore',
        x: 20,
        y: sy(31),
        amount: 8,
        initial: 8,
        owner: 'natural',
        discovered: false,
        claimed: false,
        chamber: { x: 18, y: sy(28), w: 5, h: 6 },
        color: COLORS.iron,
        symbol: '◆',
        mineTimer: 0,
      },
      {
        id: 'fungus',
        label: 'Pilzgrotte',
        kind: 'biomass',
        x: 45,
        y: sy(29),
        amount: 16,
        initial: 16,
        owner: 'natural',
        discovered: false,
        claimed: false,
        chamber: { x: 42, y: sy(26), w: 7, h: 7 },
        color: COLORS.fungus,
        symbol: '♣',
        mineTimer: 0,
      },
      {
        id: 'dwarf',
        label: 'Zwergen-Claim',
        kind: 'ore',
        x: 17,
        y: sy(17),
        amount: 36,
        initial: 36,
        owner: 'dwarf',
        discovered: false,
        claimed: false,
        chamber: { x: 13, y: sy(14), w: 8, h: 7 },
        color: COLORS.iron,
        symbol: '⚒',
        mineTimer: 0,
      },
      {
        id: 'shrine',
        label: 'Essenzschrein',
        kind: 'essence',
        x: 44,
        y: sy(11),
        amount: 16,
        initial: 16,
        owner: 'inquisition',
        discovered: false,
        claimed: false,
        chamber: { x: 40, y: sy(8), w: 8, h: 7 },
        color: COLORS.essence,
        symbol: '✦',
        mineTimer: 0,
      },
    ];

    for (const node of this.nodes) {
      this.setChamberControl(node, node.owner === 'natural' ? 'neutral' : 'enemy');
      node.sprite = this.createNodeVisual(node);
      node.sprite.setVisible(false);
    }

    // The first economic objective is intentionally safe. Combat begins only
    // once the player has produced equipment and recruited a second fighter.
    this.spawnEnemy('dwarf', 16, sy(16), { origin: 'dwarf' });
    this.spawnEnemy('dwarf', 18, sy(18), { origin: 'dwarf' });
    this.spawnEnemy('crossbow', 15, sy(18), { origin: 'dwarf' });
    this.spawnEnemy('adept', 42, sy(10), { origin: 'shrine' });
    this.spawnEnemy('adept', 46, sy(12), { origin: 'shrine' });
    this.spawnEnemy('captain', 44, sy(10), { origin: 'shrine' });
  }

  private createNodeVisual(node: ResourceNode): Phaser.GameObjects.Container {
    const assetKey = node.kind === 'biomass'
      ? 'resource-fungus-cluster'
      : node.kind === 'essence'
        ? 'resource-essence-seal'
        : 'resource-iron-vein';
    const size = node.kind === 'ore' ? 54 : node.kind === 'biomass' ? 58 : 62;
    const art = this.add.image(0, 0, assetKey).setDisplaySize(size, size);
    const container = this.add.container(this.wx(node.x), this.wy(node.y), [art]).setDepth(20);
    return container;
  }

  private updateNodeVisual(node: ResourceNode): void {
    const art = node.sprite?.getAt(0) as Phaser.GameObjects.Image | undefined;
    if (!art || node.amount > 0) return;
    if (node.kind === 'ore') art.setTexture('resource-iron-depleted');
    else art.setAlpha(0.28);
  }

  private setChamberControl(node: ResourceNode, control: TileControl): void {
    for (let y = node.chamber.y; y < node.chamber.y + node.chamber.h; y++) {
      for (let x = node.chamber.x; x < node.chamber.x + node.chamber.w; x++) {
        const tile = this.tileAt(x, y);
        if (tile) tile.control = control;
      }
    }
  }

  private createStartingPopulation(): void {
    for (const pos of [{ x: 29, y: sy(22) }, { x: 31, y: sy(23) }, { x: 34, y: sy(23) }]) {
      this.createWorker(pos.x, pos.y);
    }
    this.createUnit('guard', 33, sy(22), false);

    const heartAmbient = this.add.circle(this.wx(HEART_TILE.x), this.wy(HEART_TILE.y), 104, 0x7d3343, 0.045).setDepth(1);
    heartAmbient.setBlendMode(Phaser.BlendModes.ADD);
    const heartGlow = this.add.circle(this.wx(HEART_TILE.x), this.wy(HEART_TILE.y), 46, 0xa5414e, 0.12).setDepth(7);
    this.add.image(this.wx(HEART_TILE.x), this.wy(HEART_TILE.y), 'generated-covenant-heart')
      .setDisplaySize(140, 140)
      .setDepth(8);
    this.tweens.add({ targets: [heartAmbient, heartGlow], scale: 1.16, alpha: '-=0.045', yoyo: true, repeat: -1, duration: 1250 });

    for (const torch of [{ x: 27, y: sy(19) }, { x: 38, y: sy(19) }, { x: 30, y: sy(26) }, { x: 36, y: sy(26) }]) {
      const glow = this.add.circle(this.wx(torch.x), this.wy(torch.y), 34, 0xd59b48, 0.075).setDepth(3);
      const flame = this.add.circle(this.wx(torch.x), this.wy(torch.y), 3, 0xe3b35d, 0.9).setDepth(5);
      this.tweens.add({ targets: [glow, flame], scale: 1.25, alpha: '+=0.08', yoyo: true, repeat: -1, duration: 550 + torch.x * 7 });
    }
  }

  private createWorker(x: number, y: number): Worker {
    const sprite = this.add.sprite(this.wx(x), this.wy(y), 'worker').setDisplaySize(29, 29).setDepth(31);
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
      assignmentCooldown: 0,
      lastProgressX: x,
      lastProgressY: y,
      stuckSeconds: 0,
      pathFailures: 0,
    };
    this.workers.push(worker);
    return worker;
  }

  private createUnit(kind: UnitKind, x: number, y: number, recruited: boolean): Actor {
    const def = UNIT_DEFINITIONS[kind];
    const displaySize: Record<UnitKind, number> = {
      guard: 34,
      archer: 31,
      hexbinder: 33,
      inquisitor: 34,
    };
    const actor: Actor = {
      id: this.nextId++,
      kind,
      x,
      y,
      hp: def.hp,
      maxHp: def.hp,
      cooldown: 0,
      sprite: this.add.sprite(this.wx(x), this.wy(y), `unit-${kind}`).setDisplaySize(displaySize[kind], displaySize[kind]).setDepth(32),
      path: [],
      bed: recruited,
      hungerTimer: BALANCE.hungerSeconds,
      hungry: false,
      seekingFood: false,
      healing: false,
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
    const stats: Record<EnemyKind, { hp: number; damage: number; range: number; attack: number; texture: string; size: number }> = {
      crawler: { hp: 35, damage: 5, range: 1.1, attack: 1.2, texture: 'enemy-crawler', size: 31 },
      dwarf: { hp: 70, damage: 8, range: 1.1, attack: 1.1, texture: 'enemy-dwarf', size: 33 },
      crossbow: { hp: 45, damage: 7, range: 5, attack: 1.4, texture: 'enemy-crossbow', size: 32 },
      adept: { hp: 50, damage: 7, range: 4, attack: 1.35, texture: 'enemy-adept', size: 32 },
      captain: { hp: 120, damage: 12, range: 4, attack: 1.2, texture: 'enemy-captain', size: 37 },
      scout: { hp: 42, damage: 6, range: 1.1, attack: 1, texture: 'enemy-scout', size: 31 },
      warden: { hp: 105, damage: 12, range: 1.1, attack: 1.3, texture: 'enemy-warden', size: 38 },
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
      sprite: this.add.sprite(this.wx(x), this.wy(y), def.texture).setDisplaySize(def.size, def.size).setDepth(32),
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
      this.updateHud(false);
      return;
    }
    this.elapsed += dt;
    this.pulseCooldown = Math.max(0, this.pulseCooldown - dt);
    if (this.heartHp < BALANCE.heartHp && !this.enemies.some((enemy) => enemy.wave)) {
      this.heartHp = Math.min(BALANCE.heartHp, this.heartHp + dt);
    }

    this.discoverAreas();
    this.refreshJobs();
    for (const worker of this.workers) this.updateWorker(worker, dt);
    this.updateProduction(dt);
    this.updateUnitNeeds(dt);
    this.updateCombat(dt);
    this.updateTraps(dt);
    this.updateMission();
    this.updateHud(false);
  }

  private discoverAreas(): void {
    for (const node of this.nodes) {
      if (node.discovered) continue;
      let close = false;
      for (let y = node.chamber.y - 4; y < node.chamber.y + node.chamber.h + 4 && !close; y++) {
        for (let x = node.chamber.x - 4; x < node.chamber.x + node.chamber.w + 4; x++) {
          const tile = this.tileAt(x, y);
          if (tile?.visibility === 'revealed' && tile.geology === 'excavated' && manhattan({ x, y }, node) <= 7) {
            close = true;
            break;
          }
        }
      }
      if (!close) continue;
      node.discovered = true;
      for (let y = node.chamber.y; y < node.chamber.y + node.chamber.h; y++) {
        for (let x = node.chamber.x; x < node.chamber.x + node.chamber.w; x++) {
          this.tiles[y][x].visibility = 'revealed';
        }
      }
      node.sprite?.setVisible(true);
      for (const enemy of this.enemies.filter((candidate) => candidate.origin === node.id)) {
        enemy.sprite.setVisible(true);
        enemy.active = node.id === 'fungus';
      }
      this.audio.tone(node.kind === 'essence' ? 390 : 260, 0.14, 0.03, 'triangle');
      this.hud.toast(node.label, node.owner === 'natural' ? `${node.amount} Einheiten · natürliche Quelle` : 'Feindlich kontrolliert · Angriffsbanner empfohlen');
      this.redrawTerrain(this.rectPoints(
        { x: node.chamber.x, y: node.chamber.y },
        { x: node.chamber.x + node.chamber.w - 1, y: node.chamber.y + node.chamber.h - 1 },
      ));
      this.redrawWorldDetails(false);
    }
  }

  private updateWorker(worker: Worker, dt: number): void {
    if (worker.jobId && worker.state !== 'idle') {
      this.jobBoard.touch(worker.jobId, worker.id, this.elapsed);
    }
    if (worker.path.length) {
      const beforeX = worker.x;
      const beforeY = worker.y;
      this.moveAlongPath(worker, dt, BALANCE.workerSpeed);
      const moved = Phaser.Math.Distance.Between(beforeX, beforeY, worker.x, worker.y);
      if (moved > 0.005) {
        worker.stuckSeconds = 0;
        worker.lastProgressX = worker.x;
        worker.lastProgressY = worker.y;
        this.jobBoard.touch(worker.jobId, worker.id, this.elapsed);
      } else {
        worker.stuckSeconds += dt;
        if (worker.stuckSeconds >= 1.5) {
          worker.pathFailures++;
          this.pathFailureCount++;
          worker.idleReason = 'Weg blockiert – Auftrag wird neu vergeben';
          this.releaseWorkerJob(worker);
        }
      }
      return;
    }

    if (worker.state === 'dig' && worker.target) {
      worker.timer += dt;
      worker.sprite.angle = Math.sin(worker.timer * 18) * 10;
      if (worker.timer >= BALANCE.digSeconds) {
        const { x, y } = worker.target;
        const tile = this.tiles[y][x];
        tile.geology = 'excavated';
        tile.visibility = 'revealed';
        this.digMarks.delete(this.key(x, y));
        this.finishWorkerJob(worker);
        worker.state = 'idle';
        worker.timer = 0;
        worker.sprite.angle = 0;
        this.audio.tone(92, 0.035, 0.012, 'square');
        this.invalidateNavigation();
        this.redrawTerrain([{ x, y }]);
        this.redrawWorldDetails(false);
        this.markJobsDirty();
      }
      return;
    }

    if (worker.state === 'build' && worker.target) {
      const tile = this.tileAt(worker.target.x, worker.target.y);
      if (!tile || tile.construction !== 'building') {
        this.releaseWorkerJob(worker);
        worker.state = 'idle';
        worker.target = undefined;
        worker.timer = 0;
        return;
      }
      worker.timer += dt;
      worker.sprite.angle = Math.sin(worker.timer * 16) * 8;
      if (worker.timer >= BALANCE.buildSeconds) {
        const completedTarget = { ...worker.target };
        tile.construction = 'complete';
        const room = this.rooms.find((candidate) => candidate.id === tile.roomId);
        this.finishWorkerJob(worker);
        worker.state = 'idle';
        worker.target = undefined;
        worker.timer = 0;
        worker.sprite.angle = 0;
        this.audio.tone(188, 0.045, 0.012, 'square');
        const roomComplete = Boolean(room && this.isRoomComplete(room));
        this.redrawTerrain([completedTarget]);
        this.redrawWorldDetails(roomComplete);
        this.wakeIdleWorkers();
        this.markJobsDirty();
        if (room && roomComplete) {
          const def = ROOM_DEFINITIONS[room.kind];
          this.hud.toast(
            `${def.label} fertiggestellt`,
            `${this.roomScaleSummary(room)} verfügbar.`,
          );
        }
      }
      return;
    }

    if (worker.state === 'claim' && worker.target) {
      const tile = this.tileAt(worker.target.x, worker.target.y);
      if (!tile || tile.control !== 'claiming') {
        this.releaseWorkerJob(worker);
        worker.state = 'idle';
        worker.target = undefined;
        worker.timer = 0;
        return;
      }
      worker.timer += dt;
      worker.sprite.angle = Math.sin(worker.timer * 13) * 7;
      if (worker.timer >= BALANCE.claimSeconds) {
        const completedTarget = { ...worker.target };
        tile.control = 'owned';
        this.finishWorkerJob(worker);
        worker.state = 'idle';
        worker.target = undefined;
        worker.timer = 0;
        worker.sprite.angle = 0;
        this.checkClaims();
        this.wakeIdleWorkers();
        this.audio.tone(146, 0.04, 0.012, 'triangle');
        this.redrawTerrain([completedTarget]);
        this.markJobsDirty();
      }
      return;
    }

    if (worker.state === 'mine' && worker.targetId) {
      const node = this.nodes.find((candidate) => candidate.id === worker.targetId);
      if (!node || !this.canMineNode(node)) {
        this.releaseWorkerJob(worker);
        worker.state = 'idle';
        return;
      }
      worker.timer += dt;
      worker.sprite.angle = Math.sin(worker.timer * 15) * 8;
      if (worker.timer >= BALANCE.mineSeconds) {
        node.amount--;
        const amount = Math.min(2, node.amount >= 1 ? 2 : 1);
        if (amount === 2) node.amount--;
        this.updateNodeVisual(node);
        this.createLooseItem(node.kind, amount, node.x + Phaser.Math.FloatBetween(-0.25, 0.25), node.y + Phaser.Math.FloatBetween(-0.25, 0.25));
        if (node.id === 'fungus') this.stats.biomassMined += amount;
        if (node.id === 'dwarf') this.stats.dwarfOreMined += amount;
        this.finishWorkerJob(worker, false);
        worker.state = 'idle';
        worker.timer = 0;
        worker.sprite.angle = 0;
      }
      return;
    }

    if (worker.state === 'pickup' && worker.targetId) {
      const item = this.items.find((candidate) => candidate.id === worker.targetId);
      if (item) {
        const carryLimit = worker.delivery?.kind === 'trap' ? 1 : 2;
        const amount = this.takeFromItem(item, Math.min(carryLimit, item.amount));
        worker.carry = { kind: item.kind, amount };
        worker.carryText.setText(`${symbolForItem[item.kind]}${amount > 1 ? `×${amount}` : ''}`);
        worker.state = 'deliver';
        const destination = this.deliveryPoint(worker.delivery ?? { kind: item.kind === 'essence' ? 'heart' : 'storage' });
        worker.path = this.pathBetween(worker, destination);
        worker.target = destination;
        this.jobBoard.touch(worker.jobId, worker.id, this.elapsed);
      } else {
        this.releaseWorkerJob(worker);
        worker.state = 'idle';
      }
      return;
    }

    if (worker.state === 'deliver' && worker.carry) {
      const { kind, amount } = worker.carry;
      let delivered = amount;
      if (worker.delivery?.kind === 'room' && worker.delivery.roomId !== undefined) {
        const room = this.rooms.find((candidate) => candidate.id === worker.delivery?.roomId);
        if (room) {
          room.inputStored += amount;
          this.syncRoomInputVisual(room);
        } else {
          delivered = 0;
        }
      } else if (worker.delivery?.kind === 'trap' && worker.delivery.trapId !== undefined) {
        const trap = this.traps.find((candidate) => candidate.id === worker.delivery?.trapId);
        if (trap) {
          trap.charges = Math.min(6, trap.charges + amount * 6);
          trap.sprite.clearTint();
        } else {
          delivered = 0;
        }
      } else if (kind === 'essence' || worker.delivery?.kind === 'heart') {
        this.stock[kind] += amount;
      } else {
        const remaining = this.storeItem(kind, amount);
        delivered -= remaining;
        if (remaining) this.createLooseItem(kind, remaining, worker.x, worker.y);
      }
      this.stats.hauled += delivered;
      if (delivered) {
        this.popup(worker.x, worker.y, `+${delivered} ${ITEM_LABELS[kind]}`, kind === 'essence' ? '#a99be9' : '#d8c38e');
      }
      worker.carry = undefined;
      worker.carryText.setText('');
      this.finishWorkerJob(worker);
      worker.state = 'idle';
      this.audio.tone(kind === 'metal' || kind === 'armour' ? 320 : 210, 0.06, 0.015, 'triangle');
      return;
    }

    if (worker.state === 'prisoner-pick' && this.prisoner) {
      this.prisoner.status = 'carried';
      this.prisoner.sprite.setVisible(false);
      worker.carryText.setText('†');
      worker.state = 'prisoner-deliver';
      const prison = this.rooms.find((room) => room.kind === 'prison' && this.isRoomComplete(room));
      if (prison) {
        const point = this.roomCenter(prison);
        worker.path = this.pathBetween(worker, point);
        worker.target = point;
      }
      return;
    }

    if (worker.state === 'prisoner-deliver' && this.prisoner) {
      const prison = this.rooms.find((room) => room.kind === 'prison' && this.isRoomComplete(room));
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

    if (worker.assignmentCooldown > 0) {
      worker.assignmentCooldown = Math.max(0, worker.assignmentCooldown - dt);
      return;
    }
    this.assignWorker(worker);
    if (worker.state === 'idle') {
      worker.assignmentCooldown = 0.5;
      const storageBlocked = this.items.some((item) => item.location !== 'stored')
        && !this.items.some((item) => item.location !== 'stored' && (item.kind === 'essence' || this.canStoreAmount(item.kind, 1)))
      if (storageBlocked) worker.idleReason = 'Lager und Ausgänge voll';
    }
  }

  private assignWorker(worker: Worker): void {
    const routes = this.pathTreeFrom(worker);
    if (this.prisoner?.status === 'downed' && this.hasFunctionalRoom('prison')) {
      const alreadyReserved = this.workers.some((candidate) => candidate.state === 'prisoner-pick' || candidate.state === 'prisoner-deliver');
      if (!alreadyReserved) {
        const target = { x: Math.round(this.prisoner.x), y: Math.round(this.prisoner.y) };
        if (Number.isFinite(routes.distanceTo(target))) {
          worker.state = 'prisoner-pick';
          worker.path = routes.pathTo(target);
          worker.target = target;
          return;
        }
      }
    }

    const foodUrgent = this.phase === 1 || this.stock.ration < 3 || this.stock.biomass < 4;
    const workerIndex = Math.max(0, this.workers.indexOf(worker));
    for (const task of workerTaskOrder(workerIndex, foodUrgent, this.workPriorities)) {
      if (this.tryAssignRoutineTask(worker, task, routes)) return;
    }
    worker.state = 'idle';
    const jobs = this.jobBoard.stats(this.elapsed);
    worker.idleReason = jobs.total === 0
      ? 'Kein offener Auftrag'
      : jobs.reserved >= jobs.total
        ? 'Alle erreichbaren Aufträge reserviert'
        : 'Aufträge vorhanden · Weg durch Fels oder Gegner blockiert';
  }

  private tryAssignRoutineTask(worker: Worker, task: RoutineWorkerTask, routes: PathTree): boolean {
    let selected: { job: WorkerJob; path: GridPoint[] } | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const job of this.jobBoard.available(task, worker.id, this.elapsed)) {
      const approach = job.action === 'dig'
        ? this.neighbors(job.target.x, job.target.y)
          .map((target) => ({ target, distance: routes.distanceTo(target) }))
          .sort((a, b) => a.distance - b.distance)[0]
        : { target: job.target, distance: routes.distanceTo(job.target) };
      if (!approach || !Number.isFinite(approach.distance)) continue;
      const score = job.priority * 1000 - approach.distance;
      if (score > bestScore) {
        bestScore = score;
        selected = { job, path: routes.pathTo(approach.target) };
      }
    }
    if (!selected || !this.jobBoard.reserve(selected.job.id, worker.id, this.elapsed)) return false;
    const { job, path } = selected;
    worker.jobId = job.id;
    worker.idleReason = undefined;
    worker.path = path;
    worker.timer = 0;
    worker.target = job.target;
    worker.targetId = job.targetId;
    worker.delivery = job.destination
      ? {
        kind: job.destination,
        roomId: job.destination === 'room' ? job.destinationId : undefined,
        trapId: job.destination === 'trap' ? job.destinationId : undefined,
      }
      : undefined;
    worker.state = job.action === 'haul' || job.action === 'supply' ? 'pickup' : job.action;
    if (job.action === 'build') {
      const tile = this.tileAt(job.target.x, job.target.y);
      if (tile) tile.construction = 'building';
      this.redrawWorldDetails(false);
    }
    if (job.action === 'claim') {
      const tile = this.tileAt(job.target.x, job.target.y);
      if (tile) tile.control = 'claiming';
      this.redrawTerrain([job.target]);
    }
    return true;
  }

  private markJobsDirty(): void {
    this.jobsDirty = true;
  }

  private refreshJobs(force = false): void {
    if (!force && !this.jobsDirty && this.elapsed < this.nextJobSyncAt) return;
    this.jobBoard.sync(this.buildJobSpecs(), this.elapsed);
    this.jobsDirty = false;
    this.nextJobSyncAt = this.elapsed + 0.5;
  }

  private buildJobSpecs(): WorkerJobSpec[] {
    const jobs: WorkerJobSpec[] = [];
    for (const mark of this.digMarks) {
      const [x, y] = mark.split(',').map(Number);
      jobs.push({
        id: `dig:${mark}`,
        category: 'dig',
        action: 'dig',
        target: { x, y },
        priority: 20,
      });
    }
    for (const room of this.rooms) {
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          const construction = this.tileAt(x, y)?.construction;
          if (construction !== 'planned' && construction !== 'building') continue;
          jobs.push({
            id: `build:${x},${y}`,
            category: 'build',
            action: 'build',
            target: { x, y },
            priority: 24,
          });
        }
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const tile = this.tileAt(x, y);
        if (!tile || (!this.canClaimTile(x, y) && tile.control !== 'claiming')) continue;
        jobs.push({
          id: `claim:${x},${y}`,
          category: 'claim',
          action: 'claim',
          target: { x, y },
          priority: tile.control === 'claiming' ? 30 : 18,
        });
      }
    }

    const foodUrgent = this.phase === 1 || this.stock.ration < 3 || this.stock.biomass < 4;
    if (this.items.filter((item) => item.location !== 'stored').length < 18) {
      for (const node of this.nodes) {
        if (!this.canMineNode(node)) continue;
        jobs.push({
          id: `mine:${node.id}`,
          category: 'mine',
          action: 'mine',
          target: { x: node.x, y: node.y },
          targetId: node.id,
          priority: foodUrgent && node.kind === 'biomass' ? 34 : 12,
          maxWorkers: foodUrgent && node.kind === 'biomass' ? 2 : 1,
        });
      }
    }

    const roomsReceiving = new Set<number>();
    for (const item of this.items.filter((candidate) => candidate.location !== 'stored')) {
      const room = this.roomNeedingInput(item.kind, roomsReceiving);
      if (room) roomsReceiving.add(room.id);
      const destination: DeliveryKind | undefined = room
        ? 'room'
        : item.kind === 'essence'
          ? 'heart'
          : this.canStoreAmount(item.kind, Math.min(2, item.amount))
            ? 'storage'
            : undefined;
      if (!destination) continue;
      jobs.push({
        id: `haul:${item.id}`,
        category: 'haul',
        action: 'haul',
        target: { x: Math.round(item.x), y: Math.round(item.y) },
        targetId: item.id,
        destination,
        destinationId: room?.id,
        priority: item.location === 'output' ? 38 : room ? 30 : 16,
      });
    }

    const usedStacks = new Set<number>();
    for (const room of this.rooms
      .filter((candidate) => this.isRoomComplete(candidate) && candidate.kind in RECIPES)
      .sort((a, b) => a.inputStored - b.inputStored)) {
      if (roomsReceiving.has(room.id)) continue;
      const recipe = RECIPES[room.kind as keyof typeof RECIPES];
      if (room.inputStored >= recipe.inputAmount * productionStations(room.w * room.h) * 2) continue;
      const stack = this.items.find((item) =>
        item.location === 'stored' && item.kind === recipe.input && !usedStacks.has(item.id));
      if (!stack) continue;
      usedStacks.add(stack.id);
      jobs.push({
        id: `supply:room:${room.id}`,
        category: 'haul',
        action: 'supply',
        target: { x: Math.round(stack.x), y: Math.round(stack.y) },
        targetId: stack.id,
        destination: 'room',
        destinationId: room.id,
        priority: room.inputStored < recipe.inputAmount ? 44 : 26,
      });
    }

    for (const trap of this.traps.filter((candidate) => candidate.charges === 0)) {
      const stack = this.items.find((item) =>
        item.location === 'stored' && item.kind === 'armour' && !usedStacks.has(item.id));
      if (!stack) continue;
      usedStacks.add(stack.id);
      jobs.push({
        id: `supply:trap:${trap.id}`,
        category: 'haul',
        action: 'supply',
        target: { x: Math.round(stack.x), y: Math.round(stack.y) },
        targetId: stack.id,
        destination: 'trap',
        destinationId: trap.id,
        priority: 48,
      });
    }
    return jobs;
  }

  private finishWorkerJob(worker: Worker, complete = true): void {
    if (complete) this.jobBoard.complete(worker.jobId);
    else this.jobBoard.releaseWorker(worker.id);
    worker.jobId = undefined;
    worker.delivery = undefined;
    worker.target = undefined;
    worker.targetId = undefined;
    worker.stuckSeconds = 0;
    this.markJobsDirty();
  }

  private releaseWorkerJob(worker: Worker): void {
    this.jobBoard.releaseWorker(worker.id);
    if (worker.carry) {
      this.createLooseItem(worker.carry.kind, worker.carry.amount, worker.x, worker.y);
      worker.carry = undefined;
      worker.carryText.setText('');
    }
    worker.jobId = undefined;
    worker.delivery = undefined;
    worker.target = undefined;
    worker.targetId = undefined;
    worker.path = [];
    worker.timer = 0;
    worker.stuckSeconds = 0;
    worker.state = 'idle';
    worker.assignmentCooldown = 0.2;
    this.markJobsDirty();
  }

  private canClaimTile(x: number, y: number): boolean {
    const tile = this.tileAt(x, y);
    if (!tile || tile.geology !== 'excavated' || tile.visibility !== 'revealed') return false;
    if (!tile.claimable) return false;
    if (tile.control !== 'neutral' && tile.control !== 'enemy') return false;
    if (tile.roomId !== undefined || tile.roomKind === 'heart') return false;
    if (!this.neighbors(x, y).some((neighbor) => this.tileAt(neighbor.x, neighbor.y)?.control === 'owned')) return false;

    if (tile.control === 'enemy') {
      const chamber = this.nodes.find((node) =>
        x >= node.chamber.x
        && y >= node.chamber.y
        && x < node.chamber.x + node.chamber.w
        && y < node.chamber.y + node.chamber.h);
      if (chamber && this.enemies.some((enemy) => enemy.origin === chamber.id)) return false;
    }
    return true;
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
    if (Math.abs(dx) > 0.02) entity.sprite.setFlipX(dx < 0);
  }

  private updateProduction(dt: number): void {
    for (const room of this.rooms) {
      if (!this.isRoomComplete(room)) continue;
      if (!(room.kind in RECIPES)) continue;
      const recipe = RECIPES[room.kind as keyof typeof RECIPES];
      const stations = productionStations(room.w * room.h);
      const cycleSeconds = recipe.seconds / stations;
      if (!room.activeRecipe) {
        const outputBlocked = this.items.some((item) => item.location === 'output' && item.sourceRoomId === room.id);
        if (outputBlocked || room.inputStored < recipe.inputAmount) continue;
        room.inputStored -= recipe.inputAmount;
        this.syncRoomInputVisual(room);
        room.activeRecipe = true;
        room.progress = 0;
        this.markJobsDirty();
        continue;
      }
      room.progress += dt;
      if (room.progress < cycleSeconds) continue;
      room.activeRecipe = false;
      room.progress = 0;
      const center = this.roomCenter(room);
      this.createLooseItem(recipe.output, recipe.outputAmount, center.x, center.y, 'output', room.id);
      if (recipe.output === 'metal') this.stats.metalProduced += recipe.outputAmount;
      if (recipe.output === 'armour') this.stats.armourProduced += recipe.outputAmount;
      if (recipe.output === 'ration') this.stats.rationsProduced += recipe.outputAmount;
      if (recipe.output === 'ration' && this.phase === 1) this.heartSpeak(HEART_LINES.kitchen);
      this.audio.tone(440, 0.09, 0.025, 'triangle');
      this.popup(center.x, center.y, `${ITEM_LABELS[recipe.output]} fertig`, '#e2c77d');
    }
  }

  private updateUnitNeeds(dt: number): void {
    const bedroom = this.rooms.find((room) => room.kind === 'bedroom' && this.isRoomComplete(room));
    const combatActive = this.enemies.some((enemy) => enemy.active && enemy.hp > 0);
    let freeBeds = this.bedCapacity() - this.bedsUsed();
    for (const actor of this.units.filter((unit) => !unit.bed)) {
      if (freeBeds <= 0) break;
      actor.bed = true;
      freeBeds--;
    }
    for (const actor of this.units) {
      actor.hungerTimer -= dt;
      if (actor.hungerTimer <= 0) actor.seekingFood = true;

      const threatened = this.enemies.some((enemy) =>
        enemy.active && enemy.hp > 0 && Phaser.Math.Distance.Between(actor.x, actor.y, enemy.x, enemy.y) < 8);
      if (actor.seekingFood) {
        actor.hungry = true;
        const storage = this.storageRooms()[0];
        if (!combatActive && !this.bannerAttack && storage && this.stock.ration >= 1) {
          const foodPoint = this.roomCenter(storage);
          if (Phaser.Math.Distance.Between(actor.x, actor.y, foodPoint.x, foodPoint.y) > 1.1) {
            this.moveActorToward(actor, foodPoint, dt);
          } else {
            actor.path = [];
            this.consumeStock('ration', 1);
            actor.seekingFood = false;
            actor.hungry = false;
            actor.hungerTimer = BALANCE.hungerSeconds;
            this.popup(actor.x, actor.y, 'Ration', '#d9bd7a', 650);
          }
        }
        actor.healing = false;
        if (!combatActive && !this.bannerAttack) continue;
      }

      actor.healing = false;
      if (!actor.bed || !bedroom || actor.hp >= actor.maxHp) continue;
      if (combatActive || threatened || this.bannerAttack) continue;
      const bed = this.roomCenter(bedroom);
      const distance = Phaser.Math.Distance.Between(actor.x, actor.y, bed.x, bed.y);
      actor.healing = true;
      if (distance > 1.1) {
        this.moveActorToward(actor, bed, dt);
      } else {
        actor.path = [];
        actor.hp = Math.min(actor.maxHp, actor.hp + BALANCE.bedroomHealingPerSecond * dt);
      }
    }
  }

  private updateCombat(dt: number): void {
    for (const actor of this.units) {
      actor.cooldown = Math.max(0, actor.cooldown - dt);
      if (actor.hp <= 0) continue;
      if (actor.healing) continue;
      if (actor.seekingFood && !this.bannerAttack && !this.enemies.some((enemy) => enemy.active && enemy.hp > 0)) continue;
      const target = this.chooseTargetForUnit(actor);
      if (!target) {
        if (actor.hp < actor.maxHp * 0.3) this.moveActorToward(actor, this.bannerDefend, dt);
        continue;
      }
      const distance = Phaser.Math.Distance.Between(actor.x, actor.y, target.x, target.y);
      const def = UNIT_DEFINITIONS[actor.kind];
      if (distance <= def.range) {
        if (actor.cooldown <= 0) {
          actor.cooldown = def.attackSeconds / (actor.hungry ? BALANCE.hungryAttackMultiplier : 1);
          const damage = def.damage * (this.stats.fear >= 30 ? 1.08 : 1);
          target.hp -= damage;
          this.animateAttack(actor.sprite, target.sprite, def.range > 2);
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
            this.animateAttack(enemy.sprite, target.sprite, enemy.range > 2);
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
        const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, HEART_TILE.x, HEART_TILE.y);
        if (distance <= 1.5) {
          if (enemy.cooldown <= 0) {
            enemy.cooldown = enemy.attackSeconds;
            this.heartHp -= enemy.damage;
            this.animateAttack(enemy.sprite, undefined, false);
            this.cameras.main.shake(90, 0.002);
          }
        } else {
          this.moveEnemyToward(enemy, HEART_TILE, dt);
        }
      }
    }

    if (this.heartHp <= 0 && !this.ended) this.endGame(false);
  }

  private animateAttack(
    attacker: Phaser.GameObjects.Sprite,
    target?: Phaser.GameObjects.Sprite,
    ranged = false,
  ): void {
    if (target) attacker.setFlipX(target.x < attacker.x);
    const baseScaleX = attacker.scaleX;
    const baseScaleY = attacker.scaleY;
    this.tweens.add({
      targets: attacker,
      scaleX: baseScaleX * (ranged ? 0.92 : 1.1),
      scaleY: baseScaleY * (ranged ? 1.06 : 0.92),
      duration: 80,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => attacker.setScale(baseScaleX, baseScaleY),
    });
  }

  private chooseTargetForUnit(actor: Actor): Enemy | undefined {
    let urgentExists = false;
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0 || !enemy.sprite.visible) continue;
      if (enemy.wave || Phaser.Math.Distance.Between(enemy.x, enemy.y, HEART_TILE.x, HEART_TILE.y) < 8) {
        urgentExists = true;
        break;
      }
    }
    let nearest: Enemy | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const enemy of this.enemies) {
      if (enemy.hp <= 0 || !enemy.sprite.visible) continue;
      const eligible = urgentExists
        ? enemy.wave || Phaser.Math.Distance.Between(enemy.x, enemy.y, HEART_TILE.x, HEART_TILE.y) < 8
        : Boolean(this.bannerAttack
          && Phaser.Math.Distance.Between(enemy.x, enemy.y, this.bannerAttack.x, this.bannerAttack.y) <= 7);
      if (!eligible) continue;
      const distance = Phaser.Math.Distance.Between(actor.x, actor.y, enemy.x, enemy.y);
      if (distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private chooseTargetForEnemy(enemy: Enemy): Actor | undefined {
    let nearest: Actor | undefined;
    let nearestDistance = enemy.wave ? 14 : 7;
    for (const unit of this.units) {
      if (unit.hp <= 0) continue;
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, unit.x, unit.y);
      if (distance < nearestDistance) {
        nearest = unit;
        nearestDistance = distance;
      }
    }
    return nearest;
  }

  private moveActorToward(actor: Actor, target: GridPoint, dt: number): void {
    if (!actor.path.length || manhattan(actor.path.at(-1) ?? actor, target) > 1) {
      actor.path = this.pathBetween(actor, { x: Math.round(target.x), y: Math.round(target.y) });
    }
    if (actor.path.length) {
      const speed = BALANCE.combatSpeed * (actor.hungry ? BALANCE.hungryMoveMultiplier : 1);
      this.moveAlongPath(actor, dt, speed);
    }
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
        sprite: this.add.sprite(this.wx(enemy.x), this.wy(enemy.y), 'prisoner').setDisplaySize(34, 34).setDepth(31),
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
      if (this.tileAt(node.x, node.y)?.control !== 'owned') continue;
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
      const target = this.enemies
        .filter((enemy) => enemy.hp > 0 && enemy.sprite.visible)
        .sort((a, b) =>
          Phaser.Math.Distance.Between(trap.x, trap.y, a.x, a.y)
          - Phaser.Math.Distance.Between(trap.x, trap.y, b.x, b.y))
        .find((enemy) => Phaser.Math.Distance.Between(trap.x, trap.y, enemy.x, enemy.y) <= BALANCE.trapRange);
      if (!target) continue;
      trap.charges--;
      trap.cooldown = BALANCE.trapCooldown;
      target.hp -= BALANCE.trapDamage;
      this.popup(trap.x, trap.y, `Falle ${trap.charges}/6`, '#d8bb73');
      this.audio.tone(170, 0.06, 0.02, 'square');
      if (!trap.charges) {
        trap.sprite.setTint(0x555158);
        this.markJobsDirty();
        this.wakeIdleWorkers();
      }
    }
  }

  private updateMission(): void {
    const hasRoom = (kind: RoomKind) => this.hasFunctionalRoom(kind);
    const beds = this.bedCapacity();
    if (this.phase === 1 && hasRoom('kitchen') && this.stats.biomassMined >= 4 && this.stats.rationsProduced >= 2) {
      this.advancePhase(2);
    }
    if (this.phase === 2 && hasRoom('smelter') && this.stats.metalProduced >= 2 && beds >= 2) {
      this.advancePhase(3);
    }
    if (this.phase === 3 && hasRoom('workshop') && this.stats.armourProduced >= 2 && this.stats.recruited >= 1) {
      this.advancePhase(4);
    }
    const dwarf = this.nodes.find((node) => node.id === 'dwarf');
    if (this.phase === 4 && dwarf?.claimed && this.stats.dwarfOreMined >= 6) {
      this.advancePhase(5);
    }

    if (this.currentWave < 1 && this.waveOneSpawnAt === undefined
      && (this.stats.recruited >= 1 || this.elapsed >= BALANCE.firstWaveLatest)) {
      this.waveOneSpawnAt = Math.min(
        BALANCE.firstWaveLatest,
        Math.max(BALANCE.firstWaveEarliest, this.elapsed + BALANCE.waveWarningSeconds),
      );
    }
    if (this.waveOneSpawnAt !== undefined && !this.waveOneWarned
      && this.elapsed >= this.waveOneSpawnAt - BALANCE.waveWarningSeconds) {
      this.waveOneWarned = true;
      this.hud.toast('Inquisition gesichtet', `Vermessungstrupp in ${Math.max(1, Math.ceil(this.waveOneSpawnAt - this.elapsed))} Sekunden.`, true, 7000);
    }
    if (this.waveOneSpawnAt !== undefined && this.elapsed >= this.waveOneSpawnAt) this.spawnWave(1);

    if (dwarf?.claimed && this.currentWave >= 1 && this.currentWave < 2 && this.waveTwoSpawnAt === undefined) {
      this.waveTwoSpawnAt = Math.max(
        this.elapsed + BALANCE.waveWarningSeconds,
        (this.waveOneStartedAt ?? this.elapsed) + BALANCE.secondWaveDelay,
      );
    }
    if (this.waveTwoSpawnAt !== undefined && !this.waveTwoWarned
      && this.elapsed >= this.waveTwoSpawnAt - BALANCE.waveWarningSeconds) {
      this.waveTwoWarned = true;
      this.hud.toast('Säuberungstrupp unterwegs', `${Math.max(1, Math.ceil(this.waveTwoSpawnAt - this.elapsed))} Sekunden Vorbereitung.`, true, 7000);
    }
    if (this.waveTwoSpawnAt !== undefined && this.elapsed >= this.waveTwoSpawnAt) this.spawnWave(2);

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
    if (number === 1) this.waveOneStartedAt = this.elapsed;
    const composition = number === 1
      ? ['scout', 'scout', 'scout'] as EnemyKind[]
      : ['scout', 'scout', 'scout', 'scout', 'adept'] as EnemyKind[];
    composition.forEach((kind, index) => this.spawnEnemy(kind, 30 + (index % 4) * 2, 1 + Math.floor(index / 4), { wave: number }));
    this.audio.alarm();
    this.heartSpeak(HEART_LINES.wave);
    this.hud.toast(`Inquisitionswelle ${number}`, `${composition.length} Eindringlinge am Haupteingang. Die Zeit wurde auf 1× gesetzt.`, true);
    this.cameras.main.pan(this.wx(32), this.wy(3), 650, 'Sine.easeInOut');
  }

  private spawnFinalWave(): void {
    this.finalSpawned = true;
    this.currentWave = 3;
    const composition: EnemyKind[] = ['scout', 'scout', 'scout', 'scout', 'scout', 'adept', 'adept', 'warden'];
    if (this.stats.choice === 'Freigelassen') composition.splice(composition.indexOf('scout'), 1);
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
      this.consumeStock('ration', 2);
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
    this.finalSpawnAt = this.elapsed + BALANCE.finalWaveDelay;
    this.hud.toast('Urteil vollstreckt', `Die Finalwelle trifft in ${BALANCE.finalWaveDelay} Sekunden ein.`, true);
  }

  private summonWorker(): void {
    const reason = this.workerSummonBlockReason();
    if (reason) {
      this.hud.toast('Arbeiterbeschwörung blockiert', reason, true);
      return;
    }
    this.consumeStock('essence', BALANCE.workerSummonCost);
    this.workerSummoning = true;
    this.updateHud();
    this.hud.toast('Arbeiter wird gerufen', `${BALANCE.workerSummonSeconds} Sekunden am Covenant-Herz.`);
    this.time.delayedCall(BALANCE.workerSummonSeconds * 1000, () => {
      this.workerSummoning = false;
      if (this.ended) return;
      this.createWorker(HEART_TILE.x - 1, HEART_TILE.y + 1);
      this.markJobsDirty();
      this.wakeIdleWorkers();
      this.popup(HEART_TILE.x, HEART_TILE.y, 'ARBEITER', '#e5c66e', 950);
      this.updateHud();
    });
  }

  private workerSummonBlockReason(): string | undefined {
    if (this.workerSummoning) return 'Das Herz beschwört bereits einen Arbeiter.';
    if (this.workers.length >= BALANCE.maxWorkers) return `Arbeiterlimit erreicht (${BALANCE.maxWorkers}).`;
    if (this.stock.essence < BALANCE.workerSummonCost) {
      return `Benötigt ${BALANCE.workerSummonCost} Essenz.`;
    }
    return undefined;
  }

  private recruit(kind: UnitKind): void {
    if (kind === 'inquisitor') return;
    const def = UNIT_DEFINITIONS[kind];
    const reason = this.recruitBlockReason(kind);
    if (reason) return this.hud.toast('Rekrutierung blockiert', reason, true);
    this.consumeStock('ration', def.ration);
    this.consumeStock('armour', def.armour);
    this.consumeStock('essence', def.essence);
    this.hud.toast(`${def.label} wird gerufen`, `${BALANCE.recruitmentSeconds[kind]} Sekunden am Covenant-Herz.`);
    this.time.delayedCall((BALANCE.recruitmentSeconds[kind] * 1000) / Math.max(this.speed, 1), () => {
      if (this.ended) return;
      this.createUnit(
        kind,
        HEART_TILE.x + Phaser.Math.Between(-1, 1),
        HEART_TILE.y + Phaser.Math.Between(-1, 1),
        true,
      );
      this.stats.recruited++;
      this.audio.tone(360, 0.13, 0.03, 'triangle');
      this.popup(HEART_TILE.x, HEART_TILE.y, def.label, '#dfc36e', 1100);
    });
  }

  private covenantPulse(): void {
    if (this.stock.essence < BALANCE.pulseCost || this.pulseCooldown > 0) return;
    this.consumeStock('essence', BALANCE.pulseCost);
    this.pulseCooldown = BALANCE.pulseCooldown;
    this.heartHp = Math.min(BALANCE.heartHp, this.heartHp + 20);
    for (const enemy of this.enemies.filter((candidate) =>
      Phaser.Math.Distance.Between(candidate.x, candidate.y, HEART_TILE.x, HEART_TILE.y) <= 6)) {
      enemy.hp -= 25;
    }
    const ring = this.add.circle(this.wx(HEART_TILE.x), this.wy(HEART_TILE.y), 12)
      .setStrokeStyle(3, COLORS.essence, 0.9)
      .setDepth(50);
    this.tweens.add({ targets: ring, radius: TILE * 6, alpha: 0, duration: 700, onComplete: () => ring.destroy() });
    this.audio.tone(84, 0.5, 0.04, 'sine');
  }

  private setTool(tool: ToolKind): void {
    const lockReason = this.toolLockReason(tool);
    if (lockReason) {
      this.hud.toast('Noch nicht freigeschaltet', lockReason, true);
      return;
    }
    this.tool = tool;
    const hints: Partial<Record<ToolKind, string>> = {
      pan: 'Ziehen: Kamera bewegen · Mausrad/Pinch: zoomen · Klick: untersuchen',
      dig: 'Ziehe eine L-Route durch Fels · R dreht den Knick · Arbeiter graben automatisch',
      chamber: 'Ziehe eine rechteckige Kammer (max. 10×10)',
      'banner-attack': 'Setze das Banner auf ein feindliches Gebiet. Kämpfer sammeln sich automatisch.',
      'banner-defend': 'Setze den Haltepunkt. Frontkämpfer stehen vor Fernkämpfern.',
      trap: `Klicke auf beanspruchten Boden. Kosten: ${BALANCE.trapBuildMetal} Metall · 1 Rüstung lädt 6 Schüsse.`,
    };
    if (tool.startsWith('room-')) {
      const kind = tool.slice(5) as RoomKind;
      const room = ROOM_DEFINITIONS[kind];
      const minimumCost = roomCost(kind, room.minW * room.minH);
      this.hud.setHint(`${room.label}: ${room.minW}×${room.minH} bis ${room.maxW}×${room.maxH} · ab ${minimumCost} Metall`);
    } else {
      this.hud.setHint(hints[tool]);
    }
    this.updateHud();
  }

  private toolLockReason(tool: ToolKind): string | undefined {
    if (tool === 'room-bedroom' || tool === 'room-smelter') {
      return this.phase < 2 ? 'Wird nach der ersten Nahrungskette in Phase 2 freigeschaltet.' : undefined;
    }
    if (tool === 'room-workshop' || tool === 'trap') {
      return this.phase < 3 ? 'Wird mit Phase 3 nach Metallproduktion und zwei Betten freigeschaltet.' : undefined;
    }
    if (tool === 'banner-attack') {
      return this.phase < 4 ? 'Das Angriffsbanner wird nach dem ersten zusätzlichen Kämpfer freigeschaltet.' : undefined;
    }
    if (tool === 'room-prison') {
      return this.phase < 5 ? 'Das Gefängnis wird für die Schreinmission in Phase 5 freigeschaltet.' : undefined;
    }
    return undefined;
  }

  private setSpeed(speed: 0 | 1 | 2): void {
    this.speed = speed;
    this.updateHud();
  }

  private cycleWorkPriority(task: RoutineWorkerTask): void {
    const current = this.workPriorities[task];
    this.workPriorities[task] = current === 1 ? 2 : current === 2 ? 0 : 1;
    const labels = ['Niedrig', 'Normal', 'Hoch'] as const;
    const taskLabels: Record<RoutineWorkerTask, string> = {
      haul: 'Transport',
      dig: 'Graben',
      build: 'Bauen',
      claim: 'Beanspruchen',
      mine: 'Abbau',
    };
    this.hud.toast('Arbeitspriorität', `${taskLabels[task]}: ${labels[this.workPriorities[task]]}`);
    this.wakeIdleWorkers();
    this.updateHud();
  }

  private commitTool(start: GridPoint, end: GridPoint): void {
    if (this.tool === 'dig' || this.tool === 'chamber') {
      const points = this.tool === 'dig'
        ? lineRoute(start, end, this.horizontalFirst)
        : this.rectPoints(start, end).slice(0, 100);
      let marked = 0;
      for (const point of points) {
        if (this.tileAt(point.x, point.y)?.geology !== 'solid') continue;
        this.digMarks.add(this.key(point.x, point.y));
        marked++;
      }
      this.hud.toast('Grabung markiert', `${marked} Felsfelder · ${Math.min(3, this.workers.length)} Arbeiter verfügbar`);
      this.markJobsDirty();
      this.wakeIdleWorkers();
      this.redrawWorldDetails(false);
      return;
    }
    if (this.tool.startsWith('room-')) {
      this.placeRoom(this.tool.slice(5) as RoomKind, start, end);
      return;
    }
    if (this.tool === 'banner-attack') {
      this.bannerAttack = end;
      this.refreshBannerAttackPath();
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
    const lockReason = this.toolLockReason(`room-${kind}`);
    if (lockReason) return this.hud.toast('Raum noch gesperrt', lockReason, true);
    const orientationValid = (w >= def.minW && h >= def.minH) || (w >= def.minH && h >= def.minW);
    if (!orientationValid) return this.hud.toast('Fläche zu klein', `${def.label} benötigt mindestens ${def.minW}×${def.minH}.`, true);
    if (w > def.maxW || h > def.maxH) {
      return this.hud.toast('Fläche zu groß', `${def.label} ist auf ${def.maxW}×${def.maxH} Felder begrenzt.`, true);
    }
    const cells = this.rectPoints(start, end);
    if (cells.some((point) => {
      const tile = this.tileAt(point.x, point.y);
      return !tile || tile.geology !== 'excavated' || tile.visibility !== 'revealed' || tile.control !== 'owned';
    })) {
      return this.hud.toast('Ungültige Fläche', 'Räume können nur auf bekanntem, beanspruchtem Boden entstehen.', true);
    }
    if (cells.some((point) => this.rooms.some((room) => this.pointInRoom(point, room)))) {
      return this.hud.toast('Fläche belegt', 'Ein bestehender Raum blockiert die Auswahl.', true);
    }
    const cost = roomCost(kind, cells.length);
    if (this.stock.metal < cost) return this.hud.toast('Zu wenig Metall', `${def.label} kostet bei ${cells.length} Feldern ${cost} Metall.`, true);
    this.consumeStock('metal', cost);
    const room: Room = { id: this.nextId++, kind, x, y, w, h, progress: 0, activeRecipe: false, inputStored: 0 };
    this.rooms.push(room);
    this.assignRoomTiles(room, 'planned');
    this.markJobsDirty();
    this.wakeIdleWorkers();
    this.redrawWorldDetails(false);
    this.audio.tone(188, 0.09, 0.02, 'square');
    this.hud.toast(
      `${def.label} geplant`,
      `${w * h} Felder · ${cost} Metall · ${this.roomScaleSummary(room)}`,
    );
  }

  private roomScaleSummary(room: Pick<Room, 'kind' | 'w' | 'h'>): string {
    const cells = room.w * room.h;
    if (room.kind === 'bedroom') return `${bedroomCapacity(cells)} Betten`;
    if (room.kind === 'prison') return `${prisonCapacity(cells)} Zellen`;
    if (room.kind in RECIPES) return `${productionStations(cells)} Produktionsstation(en)`;
    return `${cells * 5} Lagerplätze`;
  }

  private placeTrap(point: GridPoint): void {
    const tile = this.tileAt(point.x, point.y);
    if (this.phase < 3) {
      return this.hud.toast('Falle noch gesperrt', 'Fallen werden mit der Werkstatt in Phase 3 freigeschaltet.', true);
    }
    if (!tile || !this.isPassable(point.x, point.y) || tile.control !== 'owned'
      || tile.roomId !== undefined || tile.roomKind !== undefined) {
      return this.hud.toast('Falle blockiert', 'Wähle freien, beanspruchten Boden.', true);
    }
    if (this.traps.some((trap) => trap.x === point.x && trap.y === point.y)) {
      return this.hud.toast('Feld belegt', 'Hier steht bereits eine Falle.', true);
    }
    if (this.stock.metal < BALANCE.trapBuildMetal) {
      return this.hud.toast('Zu wenig Metall', `Eine Bolzenfalle kostet ${BALANCE.trapBuildMetal} Metall.`, true);
    }
    this.consumeStock('metal', BALANCE.trapBuildMetal);
    this.traps.push({
      id: this.nextId++,
      x: point.x,
      y: point.y,
      charges: 0,
      cooldown: 0,
      sprite: this.add.sprite(this.wx(point.x), this.wy(point.y), 'trap').setDisplaySize(27, 27).setDepth(16).setTint(0x66616a),
    });
    this.markJobsDirty();
    this.wakeIdleWorkers();
    this.hud.toast('Bolzenfalle gebaut', 'Leer · ein Arbeiter liefert automatisch 1 Rüstungsgut für 6 Schüsse.');
  }

  private drawPreview(start: GridPoint, end: GridPoint): void {
    this.preview.clear();
    if (this.tool === 'dig') {
      this.preview.fillStyle(COLORS.gold, 0.36);
      for (const point of lineRoute(start, end, this.horizontalFirst)) {
        this.preview.fillRect(point.x * TILE + 3, point.y * TILE + 3, TILE - 6, TILE - 6);
      }
    } else if (this.tool === 'chamber' || this.tool.startsWith('room-')) {
      const cells = this.rectPoints(start, end);
      const width = Math.abs(end.x - start.x) + 1;
      const height = Math.abs(end.y - start.y) + 1;
      let valid = true;
      if (this.tool.startsWith('room-')) {
        const kind = this.tool.slice(5) as RoomKind;
        const def = ROOM_DEFINITIONS[kind];
        const largeEnough = (width >= def.minW && height >= def.minH) || (width >= def.minH && height >= def.minW);
        valid = largeEnough
          && width <= def.maxW
          && height <= def.maxH
          && cells.every((point) => this.tileAt(point.x, point.y)?.control === 'owned' && this.isPassable(point.x, point.y));
        this.hud.setHint(`${def.label}: ${width}×${height} · ${roomCost(kind, cells.length)} Metall · ${valid ? this.roomScaleSummary({ kind, w: width, h: height }) : 'Fläche ungültig'}`);
      }
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

  /**
   * Assemble the read-only view the TerrainRenderer stamps from. Lookup maps are
   * rebuilt here (only on world changes, not per frame) so the renderer never
   * touches simulation internals directly.
   */
  private buildTerrainQuery(): TerrainQuery {
    return {
      isOpen: (x, y) => this.tileAt(x, y)?.geology === 'excavated',
      visibilityAt: (x, y) => this.tileAt(x, y)?.visibility ?? 'hidden',
      controlAt: (x, y) => this.tileAt(x, y)?.control ?? 'neutral',
      materialAt: (x, y) => this.terrainMaterialAt(x, y),
      floorAt: (x, y) => this.terrainFloorAt(x, y),
    };
  }

  private terrainFloorAt(x: number, y: number): TerrainFloor {
    const tile = this.tileAt(x, y);
    if (!tile) return 'raw';
    if (tile.roomKind === 'heart') return 'room';
    if (tile.roomId !== undefined && tile.construction === 'complete') return 'room';
    return tile.control === 'owned' ? 'claimed' : 'raw';
  }

  private terrainMaterialAt(x: number, y: number): TerrainMaterial {
    let material: TerrainMaterial = 'slate';
    let bestScore = Number.POSITIVE_INFINITY;
    for (const anchor of TERRAIN_MATERIAL_ANCHORS) {
      const dx = x - anchor.x;
      const dy = y - anchor.y;
      const jitter = (((x * 41 + y * 67 + anchor.seed * 23) % 19) - 9) * 1.8;
      const score = dx * dx + dy * dy + jitter;
      if (score < bestScore) {
        material = anchor.material;
        bestScore = score;
      }
    }
    return material;
  }

  private drawWorld(): void {
    if (!this.terrainRenderer) return;
    this.terrainRenderer.render(this.buildTerrainQuery());
    this.redrawWorldDetails(true);
  }

  private redrawTerrain(points: GridPoint[]): void {
    if (!this.terrainRenderer || !points.length) return;
    this.terrainRenderer.renderTiles(this.buildTerrainQuery(), points);
  }

  private redrawWorldDetails(rebuildRoomAssets: boolean): void {
    this.detail.clear();
    this.drawChartedChambers();

    // Dig orders read as one continuous route instead of a ladder of checkboxes.
    this.detail.lineStyle(7, COLORS.gold, 0.24);
    for (const mark of this.digMarks) {
      const [x, y] = mark.split(',').map(Number);
      if (this.digMarks.has(this.key(x + 1, y))) {
        this.detail.lineBetween(this.wx(x), this.wy(y), this.wx(x + 1), this.wy(y));
      }
      if (this.digMarks.has(this.key(x, y + 1))) {
        this.detail.lineBetween(this.wx(x), this.wy(y), this.wx(x), this.wy(y + 1));
      }
    }

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!this.digMarks.has(this.key(x, y))) continue;
        const px = x * TILE;
        const py = y * TILE;
        const degree = this.neighbors(x, y).filter((neighbor) => this.digMarks.has(this.key(neighbor.x, neighbor.y))).length;
        this.detail.fillStyle(COLORS.gold, 0.12).fillRoundedRect(px + 3, py + 3, TILE - 6, TILE - 6, 6);
        if (degree <= 1 || (x * 5 + y * 3) % 7 === 0) {
          this.detail.lineStyle(2, COLORS.gold, 0.9)
            .lineBetween(px + 9, py + TILE - 9, px + TILE - 9, py + 9)
            .lineBetween(px + TILE - 12, py + 9, px + TILE - 9, py + 9)
            .lineBetween(px + TILE - 9, py + 9, px + TILE - 9, py + 12);
        }
      }
    }

    this.drawHeartSanctum();
    this.drawRoomDecor(rebuildRoomAssets);
    if (rebuildRoomAssets) this.rebuildRoomGlows();
  }

  /** Mission-map information: location and resource family, but no exact yield. */
  private drawChartedChambers(): void {
    for (const node of this.nodes) {
      if (node.discovered) continue;
      const chartedOpen = (x: number, y: number) => {
        const tile = this.tileAt(x, y);
        return tile?.geology === 'excavated' && tile.visibility === 'charted';
      };
      this.detail.lineStyle(2, node.color, 0.66);
      for (let ty = node.chamber.y; ty < node.chamber.y + node.chamber.h; ty++) {
        for (let tx = node.chamber.x; tx < node.chamber.x + node.chamber.w; tx++) {
          if (!chartedOpen(tx, ty)) continue;
          const left = tx * TILE;
          const top = ty * TILE;
          this.detail.fillStyle(node.color, 0.025).fillRect(left + 3, top + 3, TILE - 6, TILE - 6);
          if (!chartedOpen(tx, ty - 1)) this.detail.lineBetween(left + 4, top + 3, left + TILE - 4, top + 3);
          if (!chartedOpen(tx + 1, ty)) this.detail.lineBetween(left + TILE - 3, top + 4, left + TILE - 3, top + TILE - 4);
          if (!chartedOpen(tx, ty + 1)) this.detail.lineBetween(left + 4, top + TILE - 3, left + TILE - 4, top + TILE - 3);
          if (!chartedOpen(tx - 1, ty)) this.detail.lineBetween(left + 3, top + 4, left + 3, top + TILE - 4);
        }
      }

      const cx = this.wx(node.x);
      const cy = this.wy(node.y);
      this.detail.fillStyle(0x090a0e, 0.78).fillCircle(cx, cy, 12);
      this.detail.lineStyle(2, node.color, 0.94).strokeCircle(cx, cy, 10);
      if (node.kind === 'ore') {
        this.detail.fillStyle(node.color, 0.9).fillTriangle(cx, cy - 5, cx + 5, cy, cx, cy + 5);
      } else if (node.kind === 'biomass') {
        this.detail.fillStyle(node.color, 0.9).fillCircle(cx - 3, cy, 3).fillCircle(cx + 3, cy - 2, 3);
        this.detail.fillStyle(node.color, 0.65).fillRect(cx - 1, cy, 2, 5);
      } else {
        this.detail.lineStyle(2, node.color, 0.95)
          .lineBetween(cx, cy - 5, cx + 4, cy)
          .lineBetween(cx + 4, cy, cx, cy + 5)
          .lineBetween(cx, cy + 5, cx - 4, cy)
          .lineBetween(cx - 4, cy, cx, cy - 5);
      }
    }
  }

  /** Soft coloured glow per room — rebuilt only on world change, few objects. */
  private rebuildRoomGlows(): void {
    for (const glow of this.roomGlows) {
      this.tweens.killTweensOf(glow);
      glow.destroy();
    }
    this.roomGlows = [];
    const tint: Partial<Record<RoomKind, number>> = {
      kitchen: 0x6f9b62,
      smelter: 0xd0813a,
      workshop: 0xb9c2cc,
      prison: 0x8a7ea6,
      bedroom: 0x5f7fb0,
    };
    for (const room of this.rooms) {
      if (!this.isRoomComplete(room)) continue;
      const color = tint[room.kind];
      if (color === undefined) continue;
      const cx = (room.x + room.w / 2) * TILE;
      const cy = (room.y + room.h / 2) * TILE;
      const radius = Math.min(room.w, room.h) * TILE * 0.65 + 10;
      const glow = this.add.circle(cx, cy, radius, color, room.kind === 'smelter' ? 0.12 : 0.07).setDepth(3);
      glow.setBlendMode(Phaser.BlendModes.ADD);
      this.roomGlows.push(glow);
      if (room.kind === 'smelter' || room.kind === 'workshop') {
        this.tweens.add({ targets: glow, alpha: '-=0.05', yoyo: true, repeat: -1, duration: 900 + room.id * 37 });
      }
    }
  }

  private drawRoomDecor(rebuildProps: boolean): void {
    if (rebuildProps) {
      for (const prop of this.roomProps) prop.destroy();
      this.roomProps = [];
    }

    for (const room of this.rooms) {
      const ox = room.x * TILE;
      const oy = room.y * TILE;
      const rw = room.w * TILE;
      const rh = room.h * TILE;

      // This contour is interaction feedback; the visible room identity comes
      // from the generated floor and prop assets.
      const def = ROOM_DEFINITIONS[room.kind];
      const complete = this.isRoomComplete(room);
      this.detail.lineStyle(2, def.color, complete ? 0.82 : 0.42).strokeRect(ox + 2, oy + 2, rw - 4, rh - 4);
      if (!complete) {
        for (let y = room.y; y < room.y + room.h; y++) {
          for (let x = room.x; x < room.x + room.w; x++) {
            const tile = this.tileAt(x, y);
            if (!tile || tile.construction === 'complete') continue;
            const px = x * TILE;
            const py = y * TILE;
            this.detail.fillStyle(def.color, tile.construction === 'building' ? 0.18 : 0.07)
              .fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
            this.detail.lineStyle(1, def.color, 0.32)
              .lineBetween(px + 8, py + 8, px + TILE - 8, py + TILE - 8)
              .lineBetween(px + TILE - 8, py + 8, px + 8, py + TILE - 8);
          }
        }
        continue;
      }
      if (!rebuildProps) continue;

      switch (room.kind) {
        case 'bedroom': {
          const beds = Math.max(1, Math.floor((room.w * room.h) / 4));
          const columns = Math.min(room.w, beds);
          const rows = Math.ceil(beds / columns);
          for (let index = 0; index < beds; index++) {
            const column = index % columns;
            const row = Math.floor(index / columns);
            const x = ox + ((column + 0.5) / columns) * rw;
            const y = oy + ((row + 0.5) / rows) * rh;
            const prop = this.addRoomProp('room-prop-bed', x, y, rw / columns - 8, rh / rows - 8, 1);
            if (index < this.bedsUsed()) prop.setTint(0xc4c9ce);
          }
          break;
        }
        case 'kitchen':
          this.addRoomProp('room-prop-cauldron', ox + rw / 2, oy + rh / 2, rw - 10, rh - 10, 1.18);
          break;
        case 'smelter':
          this.addRoomProp('room-prop-furnace', ox + rw / 2, oy + rh / 2, rw - 10, rh - 10, 1.14);
          break;
        case 'workshop':
          this.addRoomProp('room-prop-workbench', ox + rw / 2, oy + rh / 2, rw - 10, rh - 10, 1.12);
          break;
        case 'prison':
          this.addRoomProp('room-prop-prison', ox + rw / 2, oy + rh / 2, rw - 10, rh - 10, 1.14);
          break;
        case 'storage':
          this.addRoomProp('room-prop-storage', ox + rw / 2, oy + rh / 2, rw - 8, rh - 8, 1.08);
          break;
      }
    }
  }

  private addRoomProp(
    key: string,
    x: number,
    y: number,
    maxWidth: number,
    maxHeight: number,
    maxScale: number,
  ): Phaser.GameObjects.Image {
    const prop = this.add.image(x, y, key).setDepth(5);
    const scale = Math.min(maxScale, maxWidth / prop.width, maxHeight / prop.height);
    prop.setScale(Math.max(0.5, scale));
    this.roomProps.push(prop);
    return prop;
  }

  /** A distinct starting setpiece: the Covenant Heart is a place, not an icon. */
  private drawHeartSanctum(): void {
    const cx = this.wx(HEART_TILE.x);
    const cy = this.wy(HEART_TILE.y);

    // Quiet ceremonial dais with a readable radial seal under the living heart.
    this.detail.fillStyle(0x140f14, 0.82).fillEllipse(cx, cy, 112, 82);
    this.detail.lineStyle(2, 0x71353f, 0.7).strokeEllipse(cx, cy, 101, 72);
    this.detail.lineStyle(1, 0xc07867, 0.34).strokeEllipse(cx, cy, 72, 49);
    this.detail.lineStyle(1, 0x7c3948, 0.46);
    for (let angle = 0; angle < 360; angle += 45) {
      const rad = Phaser.Math.DegToRad(angle);
      const innerX = cx + Math.cos(rad) * 26;
      const innerY = cy + Math.sin(rad) * 18;
      const outerX = cx + Math.cos(rad) * 45;
      const outerY = cy + Math.sin(rad) * 31;
      this.detail.lineBetween(innerX, innerY, outerX, outerY);
    }

    // Four restrained obelisks frame the altar and lead the eye to the heart.
    for (const [ox, oy] of [[-43, -27], [43, -27], [-43, 27], [43, 27]]) {
      this.detail.fillStyle(0x090a0e, 0.7).fillEllipse(cx + ox, cy + oy + 7, 13, 5);
      this.detail.fillStyle(0x30262d).fillTriangle(cx + ox, cy + oy - 9, cx + ox + 6, cy + oy + 7, cx + ox - 6, cy + oy + 7);
      this.detail.lineStyle(1, 0xb98263, 0.55).lineBetween(cx + ox, cy + oy - 8, cx + ox, cy + oy + 4);
      this.detail.fillStyle(0xd37b65, 0.6).fillCircle(cx + ox, cy + oy - 2, 1.5);
    }
  }

  private drawBedroom(room: Room, ox: number, oy: number): void {
    const beds = Math.floor((room.w * room.h) / 4);
    const cols = Math.max(1, room.w - 1);
    for (let i = 0; i < beds; i++) {
      const bx = ox + 7 + (i % cols) * TILE;
      const by = oy + 7 + Math.floor(i / cols) * TILE;
      const bw = TILE - 8;
      const bh = TILE + 5;
      const occupied = i < this.bedsUsed();
      this.detail.fillStyle(0x0a0b0f, 0.4).fillRect(bx + 2, by + bh - 3, bw, 3); // shadow
      this.detail.fillStyle(0x4a3524).fillRect(bx, by, bw, bh); // dark wood frame
      this.detail.fillStyle(occupied ? 0x3f5f7a : 0x4f7396).fillRect(bx + 2, by + 5, bw - 4, bh - 7); // blanket
      this.detail.fillStyle(0xe4dcc6).fillRect(bx + 2, by + 1, bw - 4, 5); // pillow
      if (occupied) this.detail.fillStyle(0x243746).fillRect(bx + 2, by + 9, bw - 4, 4); // sleeper lump
    }
  }

  private drawKitchen(_room: Room, ox: number, oy: number, rw: number, rh: number): void {
    const cx = ox + rw / 2;
    // Cauldron.
    this.detail.fillStyle(0x0a0b0f, 0.4).fillEllipse(cx, oy + rh - 8, 26, 8);
    this.detail.fillStyle(0x2c322b).fillRect(cx - 11, oy + rh - 22, 22, 15);
    this.detail.fillStyle(0x5f8a4d).fillEllipse(cx, oy + rh - 22, 22, 8); // mushroom broth
    this.detail.fillStyle(0x84b06a).fillEllipse(cx - 3, oy + rh - 24, 8, 3);
    // Shelves with fungus baskets.
    for (let i = 0; i < 3; i++) {
      const sx = ox + 6 + i * 10;
      this.detail.fillStyle(0x4a3a2a).fillRect(sx, oy + 6, 8, 6);
      this.detail.fillStyle(0x6f9b62).fillCircle(sx + 4, oy + 7, 2);
    }
  }

  private drawSmelter(room: Room, ox: number, oy: number, rw: number, rh: number): void {
    const cx = ox + rw / 2;
    // Furnace body.
    this.detail.fillStyle(0x2a211c).fillRect(cx - 14, oy + 6, 28, rh - 12);
    this.detail.fillStyle(0x120d0a).fillRect(cx - 9, oy + 12, 18, 14); // mouth
    // Ember glow (static base; animated glow handled by roomGlows).
    this.detail.fillStyle(0xd8752a, room.activeRecipe ? 0.85 : 0.5).fillRect(cx - 7, oy + 15, 14, 9);
    this.detail.fillStyle(0xf2c25a, room.activeRecipe ? 0.9 : 0.5).fillRect(cx - 4, oy + 18, 8, 5);
    // Anvil / casting slab.
    this.detail.fillStyle(0x3d434d).fillRect(ox + 5, oy + rh - 14, 14, 8);
    this.detail.fillStyle(0x565d68).fillRect(ox + 7, oy + rh - 16, 6, 3);
  }

  private drawWorkshop(room: Room, ox: number, oy: number, rw: number, rh: number): void {
    // Workbench.
    this.detail.fillStyle(0x0a0b0f, 0.35).fillRect(ox + 6, oy + rh - 12, rw - 12, 4);
    this.detail.fillStyle(0x5a4630).fillRect(ox + 6, oy + rh - 18, rw - 12, 8);
    this.detail.fillStyle(0x6d543a).fillRect(ox + 6, oy + rh - 18, rw - 12, 2);
    // Tool rack with metallic highlights.
    for (let i = 0; i < 3; i++) {
      const tx = ox + 10 + i * 9;
      this.detail.lineStyle(2, 0xaeb6c0, 0.85).lineBetween(tx, oy + 6, tx, oy + 16);
      this.detail.fillStyle(0xced4dc).fillRect(tx - 2, oy + 5, 4, 3);
    }
    if (room.activeRecipe) {
      this.detail.fillStyle(0xffd873, 0.9).fillCircle(ox + 10, oy + rh - 18, 1.5);
      this.detail.fillStyle(0xffb347, 0.7).fillCircle(ox + 14, oy + rh - 20, 1);
    }
  }

  private drawPrison(room: Room, ox: number, oy: number, rw: number, rh: number): void {
    // Cell floor darkening handled by ROOM_PRISON tile; add vertical bars + door.
    this.detail.fillStyle(0x0b0c10, 0.3).fillRect(ox + 3, oy + 3, rw - 6, rh - 6);
    this.detail.lineStyle(2, 0x9a8f7c, 0.8);
    for (let gx = ox + 6; gx < ox + rw - 3; gx += 7) {
      this.detail.lineBetween(gx, oy + 4, gx, oy + rh - 4);
    }
    // Horizontal cross rails.
    this.detail.lineStyle(1.5, 0x8a8070, 0.7)
      .lineBetween(ox + 4, oy + 6, ox + rw - 4, oy + 6)
      .lineBetween(ox + 4, oy + rh - 6, ox + rw - 4, oy + rh - 6);
    // Door gap in the middle bar so the prisoner sprite reads as "inside".
    const doorX = ox + rw / 2;
    this.detail.fillStyle(0x0b0c10, 1).fillRect(doorX - 5, oy + rh / 2 - 6, 10, 12);
  }

  private drawStorage(_room: Room, ox: number, oy: number, rw: number, rh: number): void {
    // Crates and barrels tucked to the edges so haul/item sprites stay visible.
    const crate = (x: number, y: number, s: number) => {
      this.detail.fillStyle(0x5b4529).fillRect(x, y, s, s);
      this.detail.lineStyle(1, 0x3a2c19, 0.9).strokeRect(x, y, s, s)
        .lineBetween(x, y + s / 2, x + s, y + s / 2)
        .lineBetween(x + s / 2, y, x + s / 2, y + s);
    };
    crate(ox + 4, oy + 4, 9);
    crate(ox + 4, oy + rh - 13, 9);
    crate(ox + rw - 13, oy + 4, 9);
    // Barrel.
    this.detail.fillStyle(0x4c3a28).fillEllipse(ox + rw - 8, oy + rh - 8, 10, 12);
    this.detail.lineStyle(1, 0x6d543a, 0.9).strokeEllipse(ox + rw - 8, oy + rh - 8, 10, 12);
  }

  private drawStatus(): void {
    this.statusLayer.clear();
    const dangerPulse = 0.35 + (Math.sin(this.elapsed * 4) + 1) * 0.12;
    for (const node of this.nodes.filter((candidate) =>
      candidate.discovered && this.enemies.some((enemy) => enemy.origin === candidate.id))) {
      this.statusLayer.lineStyle(2, COLORS.blood, dangerPulse)
        .strokeRoundedRect(
          node.chamber.x * TILE + 4,
          node.chamber.y * TILE + 4,
          node.chamber.w * TILE - 8,
          node.chamber.h * TILE - 8,
          10,
        );
      this.statusLayer.fillStyle(COLORS.blood, 0.82)
        .fillTriangle(
          this.wx(node.x),
          node.chamber.y * TILE - 2,
          this.wx(node.x) + 6,
          node.chamber.y * TILE + 8,
          this.wx(node.x) - 6,
          node.chamber.y * TILE + 8,
        );
    }
    if (this.bannerAttack) {
      this.statusLayer.lineStyle(3, COLORS.blood, 0.18);
      let previous: GridPoint = HEART_TILE;
      for (const point of this.bannerAttackPath) {
        this.statusLayer.lineBetween(this.wx(previous.x), this.wy(previous.y), this.wx(point.x), this.wy(point.y));
        previous = point;
      }
    }
    for (const worker of this.workers) {
      const endangered = this.enemies.some((enemy) =>
        enemy.active && Phaser.Math.Distance.Between(worker.x, worker.y, enemy.x, enemy.y) < 4);
      if (endangered) {
        this.statusLayer.lineStyle(2, COLORS.blood, dangerPulse)
          .strokeCircle(worker.sprite.x, worker.sprite.y, 12);
      }
    }
    for (const actor of this.units) {
      const ringColor = actor.hungry ? 0xc58a48 : actor.healing ? 0x72c59a : 0x72b58e;
      this.statusLayer.lineStyle(actor.healing || actor.hungry ? 2 : 1, ringColor, 0.72)
        .strokeCircle(actor.sprite.x, actor.sprite.y + 2, 13);
      if (actor.healing) {
        const cx = actor.sprite.x + 10;
        const cy = actor.sprite.y - 10;
        this.statusLayer.fillStyle(0x8bd3aa, 0.95).fillRect(cx - 3, cy - 1, 7, 2).fillRect(cx, cy - 4, 2, 8);
      } else if (actor.hungry) {
        this.statusLayer.fillStyle(0xd39a50, 0.95).fillCircle(actor.sprite.x + 10, actor.sprite.y - 10, 3);
      }
      this.healthBar(actor.sprite.x, actor.sprite.y, actor.hp / actor.maxHp, 0x6da78b);
    }
    for (const enemy of this.enemies.filter((candidate) => candidate.sprite.visible)) {
      if (enemy.active || enemy.wave) {
        this.statusLayer.lineStyle(2, 0xd96065, 0.88)
          .strokeCircle(enemy.sprite.x, enemy.sprite.y + 2, 13);
        this.healthBar(enemy.sprite.x, enemy.sprite.y, enemy.hp / enemy.maxHp, 0xd96065);
      }
    }
    for (const room of this.rooms.filter((candidate) => candidate.activeRecipe)) {
      const recipe = RECIPES[room.kind as keyof typeof RECIPES];
      const center = this.roomCenter(room);
      const progress = room.progress / (recipe.seconds / productionStations(room.w * room.h));
      this.statusLayer.fillStyle(0x090a0d, 0.85).fillRect(this.wx(center.x) - 18, this.wy(room.y) - 18, 36, 4);
      this.statusLayer.fillStyle(COLORS.gold).fillRect(this.wx(center.x) - 17, this.wy(room.y) - 17, 34 * progress, 2);
    }
    for (const room of this.rooms.filter((candidate) => !this.isRoomComplete(candidate))) {
      const total = room.w * room.h;
      let complete = 0;
      for (let y = room.y; y < room.y + room.h; y++) {
        for (let x = room.x; x < room.x + room.w; x++) {
          if (this.tileAt(x, y)?.construction === 'complete') complete++;
        }
      }
      const center = this.roomCenter(room);
      this.statusLayer.fillStyle(0x090a0d, 0.88).fillRect(this.wx(center.x) - 22, this.wy(room.y) - 18, 44, 5);
      this.statusLayer.fillStyle(ROOM_DEFINITIONS[room.kind].color)
        .fillRect(this.wx(center.x) - 21, this.wy(room.y) - 17, 42 * (complete / total), 3);
    }
  }

  private healthBar(x: number, y: number, ratio: number, color: number): void {
    this.statusLayer.fillStyle(0x08090c, 0.85).fillRect(x - 10, y - 16, 20, 3);
    this.statusLayer.fillStyle(color).fillRect(x - 9, y - 15, Math.max(0, 18 * ratio), 1);
  }

  private inspectAt(point: GridPoint): void {
    const node = this.nodes.find((candidate) => candidate.discovered && Phaser.Math.Distance.Between(point.x, point.y, candidate.x, candidate.y) < 2);
    if (node) {
      const enemies = this.enemies.filter((enemy) => enemy.origin === node.id).length;
      const control = node.claimed
        ? 'beansprucht'
        : enemies > 0
          ? `feindlich (${enemies} Wächter)`
          : 'gesichert · Covenant-Boden fehlt';
      this.selectedContext = {
        title: node.label,
        body: `${node.amount}/${node.initial} ${ITEM_LABELS[node.kind]} · ${control}`,
      };
      return;
    }
    const room = this.rooms.find((candidate) => this.pointInRoom(point, candidate));
    if (room) {
      const def = ROOM_DEFINITIONS[room.kind];
      let status = 'Bereit';
      if (!this.isRoomComplete(room)) {
        const complete = this.rectPoints(
          { x: room.x, y: room.y },
          { x: room.x + room.w - 1, y: room.y + room.h - 1 },
        ).filter((cell) => this.tileAt(cell.x, cell.y)?.construction === 'complete').length;
        status = `Baufortschritt ${complete}/${room.w * room.h}`;
      } else if (room.kind in RECIPES) {
        const recipe = RECIPES[room.kind as keyof typeof RECIPES];
        const stations = productionStations(room.w * room.h);
        const cycleSeconds = recipe.seconds / stations;
        const outputBlocked = this.items.some((item) => item.location === 'output' && item.sourceRoomId === room.id);
        status = room.activeRecipe
          ? `Produktion ${Math.floor((room.progress / cycleSeconds) * 100)} % · ${stations} Station(en) · Eingang ${room.inputStored}`
          : outputBlocked
            ? `Ausgang blockiert · Eingang ${room.inputStored}`
            : room.inputStored < recipe.inputAmount
              ? `Wartet auf ${recipe.inputAmount - room.inputStored} ${ITEM_LABELS[recipe.input]} · ${stations} Station(en)`
              : `Eingang ${room.inputStored}/${recipe.inputAmount} ${ITEM_LABELS[recipe.input]} · ${stations} Station(en)`;
      } else if (room.kind === 'storage') {
        const stored = this.items
          .filter((item) => item.location === 'stored' && item.storageRoomId === room.id)
          .reduce((sum, item) => sum + item.amount, 0);
        status = `Lager ${stored}/${room.w * room.h * 5}`;
      }
      this.selectedContext = { title: def.label, body: `${room.w}×${room.h} Felder · ${roomCost(room.kind, room.w * room.h)} Metall · ${status}` };
      return;
    }
    const trap = this.traps.find((candidate) => Phaser.Math.Distance.Between(point.x, point.y, candidate.x, candidate.y) < 1);
    if (trap) {
      this.selectedContext = {
        title: 'Bolzenfalle',
        body: `${trap.charges}/6 Schüsse · ${BALANCE.trapDamage} Schaden · ${BALANCE.trapRange} Felder Reichweite${trap.charges ? '' : ' · Keine Ladung: wartet auf 1 Rüstungsgut'}`,
      };
      return;
    }
    const actor = this.units.find((candidate) => Phaser.Math.Distance.Between(point.x, point.y, candidate.x, candidate.y) < 1);
    if (actor) {
      const need = actor.healing ? 'heilt im Bett' : actor.hungry ? 'hungrig: −20 % Bewegung, −15 % Angriff' : `nächste Ration in ${Math.ceil(actor.hungerTimer)} s`;
      this.selectedContext = {
        title: UNIT_DEFINITIONS[actor.kind].label,
        body: `${Math.ceil(actor.hp)}/${actor.maxHp} HP · ${need}`,
      };
      return;
    }
    const worker = this.workers.find((candidate) => Phaser.Math.Distance.Between(point.x, point.y, candidate.x, candidate.y) < 1);
    if (worker) {
      const labels: Record<JobKind, string> = {
        idle: 'Kein erreichbarer Auftrag',
        dig: 'Gräbt',
        build: 'Errichtet einen Raum',
        claim: 'Verlegt beanspruchten Boden',
        mine: 'Baut Rohstoff ab',
        pickup: 'Holt Gegenstand',
        deliver: 'Transportiert Gut',
        'prisoner-pick': 'Holt Gefangenen',
        'prisoner-deliver': 'Eskortiert Gefangenen',
      };
      const workerStatus = worker.state === 'idle' ? worker.idleReason ?? labels.idle : labels[worker.state];
      this.selectedContext = { title: `Arbeiter ${worker.id}`, body: `${workerStatus}${worker.carry ? ` · trägt ${ITEM_LABELS[worker.carry.kind]}` : ''} · ${worker.pathFailures} Pfadfehler` };
      return;
    }
    const tile = this.tileAt(point.x, point.y);
    if (tile?.geology === 'excavated' && !tile.claimable) {
      this.selectedContext = {
        title: 'Haupteingang',
        body: 'Neutraler Invasionsweg · wird von Arbeitern nicht beansprucht und kann nicht bebaut werden.',
      };
      return;
    }
    this.selectedContext = undefined;
  }

  private updateHud(force = true): void {
    if (!this.hud) return;
    if (!force && this.elapsed < this.nextHudUpdateAt) return;
    this.nextHudUpdateAt = this.elapsed + 0.25;
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
      wave: this.waveStatus(),
      speed: this.speed,
      tool: this.tool,
      phase: this.phase,
      objectiveTitle: objective.title,
      objectiveBody: objective.body,
      elapsed: this.elapsed,
      trust: this.stats.trust,
      fear: this.stats.fear,
      workers: this.workers.length,
      maxWorkers: BALANCE.maxWorkers,
      hungryUnits: this.units.filter((unit) => unit.hungry).length,
      pulseReady: this.stock.essence >= BALANCE.pulseCost && this.pulseCooldown <= 0,
      canSummonWorker: this.workerSummonBlockReason() === undefined,
      workerSummonReason: this.workerSummonBlockReason(),
      canRecruit: {
        guard: this.canRecruit('guard'),
        archer: this.canRecruit('archer'),
        hexbinder: this.canRecruit('hexbinder'),
      },
      recruitReasons: {
        guard: this.recruitBlockReason('guard'),
        archer: this.recruitBlockReason('archer'),
        hexbinder: this.recruitBlockReason('hexbinder'),
      },
      toolLocks: {
        'room-bedroom': this.toolLockReason('room-bedroom'),
        'room-smelter': this.toolLockReason('room-smelter'),
        'room-workshop': this.toolLockReason('room-workshop'),
        'room-prison': this.toolLockReason('room-prison'),
        'banner-attack': this.toolLockReason('banner-attack'),
        trap: this.toolLockReason('trap'),
      },
      objectiveChecklist: this.missionChecklist(),
      workerJobs: {
        haul: this.workers.filter((worker) => worker.state === 'pickup' || worker.state === 'deliver').length,
        dig: this.workers.filter((worker) => worker.state === 'dig').length,
        build: this.workers.filter((worker) => worker.state === 'build').length,
        claim: this.workers.filter((worker) => worker.state === 'claim').length,
        mine: this.workers.filter((worker) => worker.state === 'mine').length,
      },
      workPriorities: { ...this.workPriorities },
      context: this.selectedContext,
    };
    this.hud.update(state);
  }

  private missionChecklist(): Array<{ label: string; done: boolean }> {
    const hasRoom = (kind: RoomKind) => this.hasFunctionalRoom(kind);
    if (this.phase === 1) {
      const fungus = this.nodes.find((node) => node.id === 'fungus');
      return [
        { label: 'Pilzgrotte erreichen', done: Boolean(fungus?.discovered) },
        { label: 'Pilzgrotte beanspruchen', done: Boolean(fungus?.claimed) },
        { label: `4 Biomasse bergen (${Math.min(4, this.stats.biomassMined)}/4)`, done: this.stats.biomassMined >= 4 },
        { label: 'Pilzküche fertigstellen', done: hasRoom('kitchen') },
        { label: `2 Rationen herstellen (${Math.min(2, this.stats.rationsProduced)}/2)`, done: this.stats.rationsProduced >= 2 },
      ];
    }
    if (this.phase === 2) {
      return [
        { label: 'Kleine Eisenader beanspruchen', done: Boolean(this.nodes.find((node) => node.id === 'iron')?.claimed) },
        { label: 'Schmelze fertigstellen', done: hasRoom('smelter') },
        { label: `2 Metall produzieren (${Math.min(2, this.stats.metalProduced)}/2)`, done: this.stats.metalProduced >= 2 },
        { label: `2 Betten bereitstellen (${Math.min(2, this.bedCapacity())}/2)`, done: this.bedCapacity() >= 2 },
      ];
    }
    if (this.phase === 3) {
      return [
        { label: 'Werkstatt fertigstellen', done: hasRoom('workshop') },
        { label: `2 Rüstungsgüter herstellen (${Math.min(2, this.stats.armourProduced)}/2)`, done: this.stats.armourProduced >= 2 },
        { label: `Einen Kämpfer rekrutieren (${Math.min(1, this.stats.recruited)}/1)`, done: this.stats.recruited >= 1 },
      ];
    }
    if (this.phase === 4) {
      return [
        { label: 'Angriffsbanner beim Zwergen-Claim setzen', done: Boolean(this.bannerAttack) },
        { label: 'Zwergen-Claim erobern und beanspruchen', done: Boolean(this.nodes.find((node) => node.id === 'dwarf')?.claimed) },
        { label: `6 Roherz bergen (${Math.min(6, this.stats.dwarfOreMined)}/6)`, done: this.stats.dwarfOreMined >= 6 },
      ];
    }
    return [
      { label: 'Essenzschrein erobern', done: Boolean(this.nodes.find((node) => node.id === 'shrine')?.claimed) },
      { label: 'Gefängnis mit freier Zelle bauen', done: hasRoom('prison') },
      { label: 'Captain in die Zelle bringen', done: this.prisoner?.status === 'cell' || Boolean(this.stats.choice) },
      { label: 'Urteil sprechen', done: Boolean(this.stats.choice) },
      { label: 'Finalwelle überstehen', done: this.ended && this.heartHp > 0 },
    ];
  }

  private waveStatus(): string {
    const active = this.enemies.some((enemy) => enemy.wave && enemy.hp > 0);
    if (active) return `Welle ${this.currentWave}`;
    if (this.stats.choice && !this.finalSpawned) return `Finale ${Math.max(0, Math.ceil(this.finalSpawnAt - this.elapsed))}s`;
    if (this.waveTwoSpawnAt !== undefined && this.currentWave < 2) return `W2 ${Math.max(0, Math.ceil(this.waveTwoSpawnAt - this.elapsed))}s`;
    if (this.waveOneSpawnAt !== undefined && this.currentWave < 1) return `W1 ${Math.max(0, Math.ceil(this.waveOneSpawnAt - this.elapsed))}s`;
    return this.currentWave ? `W${this.currentWave} vorbei` : 'Ruhe';
  }

  private canRecruit(kind: 'guard' | 'archer' | 'hexbinder'): boolean {
    return this.recruitBlockReason(kind) === undefined;
  }

  private recruitBlockReason(kind: 'guard' | 'archer' | 'hexbinder'): string | undefined {
    const def = UNIT_DEFINITIONS[kind];
    if (this.phase < 3 && (kind === 'guard' || kind === 'archer')) return 'Kämpfer werden in Phase 3 freigeschaltet.';
    if (this.phase < 5 && kind === 'hexbinder') return 'Hexbinder werden in Phase 5 freigeschaltet.';
    if (this.bedsUsed() >= this.bedCapacity()) return 'Kein freies Bett · Schlafkammer bauen oder vergrößern.';
    if (!this.hasFunctionalRoom('kitchen')) return 'Keine fertige Pilzküche.';
    if ((kind === 'guard' || kind === 'archer') && !this.hasFunctionalRoom('workshop')) return 'Keine fertige Werkstatt.';
    if (kind === 'hexbinder' && !this.nodes.find((node) => node.id === 'shrine')?.claimed) return 'Essenzschrein noch nicht erobert.';
    const missing: string[] = [];
    if (this.stock.ration < def.ration) missing.push(`${def.ration} Ration`);
    if (this.stock.armour < def.armour) missing.push(`${def.armour} Rüstung`);
    if (this.stock.essence < def.essence) missing.push(`${def.essence} Essenz`);
    return missing.length ? `Fehlt: ${missing.join(', ')}.` : undefined;
  }

  private canMineNode(node: ResourceNode, routes?: PathTree): boolean {
    if (!node.discovered || !node.claimed || node.amount <= 0) return false;
    if (this.enemies.some((enemy) => enemy.origin === node.id)) return false;
    return routes
      ? Number.isFinite(routes.distanceTo(node))
      : this.reachableFromHeart(node.x, node.y);
  }

  private createLooseItem(
    kind: ItemKind,
    amount: number,
    x: number,
    y: number,
    location: LooseItem['location'] = 'loose',
    sourceRoomId?: number,
  ): LooseItem {
    const item: LooseItem = {
      id: this.nextId++,
      kind,
      amount,
      x,
      y,
      sprite: this.add.sprite(this.wx(x), this.wy(y), itemTexture[kind]).setDisplaySize(location === 'stored' ? 20 : 24, location === 'stored' ? 20 : 24).setDepth(25),
      location,
      sourceRoomId,
    };
    item.sprite.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      const locationLabel = item.location === 'stored'
        ? 'eingelagert'
        : item.location === 'output'
          ? 'wartet am Maschinenausgang'
          : 'wartet auf Transport';
      this.selectedContext = { title: ITEM_LABELS[kind], body: `Menge: ${item.amount} · ${locationLabel}` };
    });
    this.items.push(item);
    this.syncItemAmountText(item);
    if (location !== 'stored') {
      this.tweens.add({ targets: item.sprite, y: item.sprite.y - 3, yoyo: true, repeat: -1, duration: 850 + item.id % 300 });
    }
    this.markJobsDirty();
    this.wakeIdleWorkers();
    return item;
  }

  private seedStartingStorage(): void {
    const starting = {
      ore: this.stock.ore,
      biomass: this.stock.biomass,
      metal: this.stock.metal,
      ration: this.stock.ration,
      armour: this.stock.armour,
    };
    this.stock.ore = 0;
    this.stock.biomass = 0;
    this.stock.metal = 0;
    this.stock.ration = 0;
    this.stock.armour = 0;
    for (const [kind, amount] of Object.entries(starting) as Array<[Exclude<ItemKind, 'essence'>, number]>) {
      if (amount) this.storeItem(kind, amount);
    }
  }

  private storageRooms(): Room[] {
    return this.rooms.filter((room) => room.kind === 'storage' && this.isRoomComplete(room));
  }

  private storagePoint(room: Room, slot: number): GridPoint {
    return { x: room.x + (slot % room.w), y: room.y + Math.floor(slot / room.w) };
  }

  private storageCapacity(): number {
    return this.storageRooms().reduce((sum, room) => sum + room.w * room.h * 5, 0);
  }

  private storedAmount(): number {
    return this.items
      .filter((item) => item.location === 'stored')
      .reduce((sum, item) => sum + item.amount, 0);
  }

  private canStoreAmount(kind: ItemKind, amount: number): boolean {
    if (kind === 'essence') return true;
    const matchingSpace = this.items
      .filter((item) => item.location === 'stored' && item.kind === kind)
      .reduce((sum, item) => sum + Math.max(0, 5 - item.amount), 0);
    const freeSlots = this.storageRooms().reduce((sum, room) => {
      const used = this.items.filter((item) => item.location === 'stored' && item.storageRoomId === room.id).length;
      return sum + Math.max(0, room.w * room.h - used);
    }, 0);
    return matchingSpace + freeSlots * 5 >= amount;
  }

  private storeItem(kind: Exclude<ItemKind, 'essence'>, amount: number): number {
    let remaining = amount;
    for (const stack of this.items.filter((item) => item.location === 'stored' && item.kind === kind && item.amount < 5)) {
      const moved = Math.min(remaining, 5 - stack.amount);
      stack.amount += moved;
      remaining -= moved;
      this.syncItemAmountText(stack);
      if (!remaining) break;
    }
    while (remaining > 0) {
      const slot = this.findFreeStorageSlot();
      if (!slot) break;
      const moved = Math.min(5, remaining);
      const point = this.storagePoint(slot.room, slot.index);
      const stack = this.createLooseItem(kind, moved, point.x, point.y, 'stored');
      stack.storageRoomId = slot.room.id;
      stack.storageSlot = slot.index;
      stack.sprite.setDisplaySize(20, 20);
      this.syncItemAmountText(stack);
      remaining -= moved;
    }
    this.recountStoredStock();
    return remaining;
  }

  private findFreeStorageSlot(): { room: Room; index: number } | undefined {
    for (const room of this.storageRooms()) {
      for (let index = 0; index < room.w * room.h; index++) {
        if (!this.items.some((item) =>
          item.location === 'stored' && item.storageRoomId === room.id && item.storageSlot === index)) {
          return { room, index };
        }
      }
    }
    return undefined;
  }

  private recountStoredStock(): void {
    for (const kind of ['ore', 'biomass', 'metal', 'ration', 'armour'] as const) {
      this.stock[kind] = this.items
        .filter((item) => item.location === 'stored' && item.kind === kind)
        .reduce((sum, item) => sum + item.amount, 0);
    }
  }

  private consumeStock(kind: ItemKind, amount: number): boolean {
    if (this.stock[kind] < amount) return false;
    if (kind === 'essence') {
      this.stock.essence -= amount;
      return true;
    }
    let remaining = amount;
    for (const stack of [...this.items].filter((item) => item.location === 'stored' && item.kind === kind)) {
      const taken = Math.min(remaining, stack.amount);
      stack.amount -= taken;
      remaining -= taken;
      if (stack.amount <= 0) this.destroyItem(stack);
      else this.syncItemAmountText(stack);
      if (!remaining) break;
    }
    this.recountStoredStock();
    this.markJobsDirty();
    return remaining === 0;
  }

  private takeFromItem(item: LooseItem, amount: number): number {
    const taken = Math.min(amount, item.amount);
    item.amount -= taken;
    if (item.amount <= 0) this.destroyItem(item);
    else this.syncItemAmountText(item);
    if (item.location === 'stored') this.recountStoredStock();
    this.markJobsDirty();
    return taken;
  }

  private destroyItem(item: LooseItem): void {
    this.tweens.killTweensOf(item.sprite);
    item.amountText?.destroy();
    item.sprite.destroy();
    this.items = this.items.filter((candidate) => candidate.id !== item.id);
  }

  private syncItemAmountText(item: LooseItem): void {
    if (item.amount <= 1) {
      item.amountText?.destroy();
      item.amountText = undefined;
      return;
    }
    item.amountText ??= this.add.text(item.sprite.x + 7, item.sprite.y + 5, '', {
      fontFamily: 'Arial',
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#f4e5b8',
      stroke: '#090a0d',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(27);
    item.amountText.setText(`×${item.amount}`).setPosition(item.sprite.x + 7, item.sprite.y + 5);
  }

  private roomNeedingInput(kind: ItemKind, excluded = new Set<number>()): Room | undefined {
    return this.rooms
      .filter((room) => this.isRoomComplete(room) && room.kind in RECIPES)
      .filter((room) => !excluded.has(room.id))
      .filter((room) => RECIPES[room.kind as keyof typeof RECIPES].input === kind)
      .filter((room) => {
        const recipe = RECIPES[room.kind as keyof typeof RECIPES];
        return room.inputStored < recipe.inputAmount * productionStations(room.w * room.h) * 2;
      })
      .sort((a, b) => a.inputStored - b.inputStored || a.id - b.id)[0];
  }

  private deliveryPoint(delivery: { kind: DeliveryKind; roomId?: number; trapId?: number }): GridPoint {
    if (delivery.kind === 'heart') return { ...HEART_TILE };
    if (delivery.kind === 'room') {
      const room = this.rooms.find((candidate) => candidate.id === delivery.roomId);
      if (room) return this.roomCenter(room);
    }
    if (delivery.kind === 'trap') {
      const trap = this.traps.find((candidate) => candidate.id === delivery.trapId);
      if (trap) return { x: trap.x, y: trap.y };
    }
    const storage = this.storageRooms()[0];
    return storage ? this.roomCenter(storage) : { x: 29, y: sy(24) };
  }

  private syncRoomInputVisual(room: Room): void {
    this.roomInputVisuals.get(room.id)?.destroy(true);
    this.roomInputVisuals.delete(room.id);
    if (!room.inputStored || !(room.kind in RECIPES)) return;
    const recipe = RECIPES[room.kind as keyof typeof RECIPES];
    const x = this.wx(room.x + 0.32);
    const y = this.wy(room.y + 0.35);
    const sprite = this.add.sprite(0, 0, itemTexture[recipe.input]).setDisplaySize(18, 18);
    const label = this.add.text(7, 5, `×${room.inputStored}`, {
      fontFamily: 'Arial',
      fontSize: '8px',
      fontStyle: 'bold',
      color: '#f4e5b8',
      stroke: '#090a0d',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.roomInputVisuals.set(room.id, this.add.container(x, y, [sprite, label]).setDepth(26));
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
    const existingTween = kind === 'attack' ? this.bannerAttackTween : this.bannerDefendTween;
    if (existingTween) this.tweens.remove(existingTween);
    existing?.destroy(true);
    const pole = this.add.rectangle(0, 0, 2, 25, 0xcbb372).setOrigin(0.5, 1);
    const flag = this.add.triangle(0, -24, 0, 0, 15, 6, 0, 12, kind === 'attack' ? 0xa7464e : 0x50779b);
    const glow = this.add.circle(0, -8, kind === 'attack' ? TILE * 6 : TILE * 2, kind === 'attack' ? 0xa7464e : 0x50779b, 0.035);
    const overlapsHeart = kind === 'defend'
      && Math.round(point.x) === HEART_TILE.x
      && Math.round(point.y) === HEART_TILE.y;
    const markerX = overlapsHeart ? point.x + 1.15 : point.x;
    const markerY = overlapsHeart ? point.y + 0.7 : point.y;
    const container = this.add.container(this.wx(markerX), this.wy(markerY), [glow, pole, flag]).setDepth(29);
    const tween = this.tweens.add({ targets: flag, scaleX: 0.78, yoyo: true, repeat: -1, duration: 620 });
    if (kind === 'attack') {
      this.bannerAttackSprite = container;
      this.bannerAttackTween = tween;
    } else {
      this.bannerDefendSprite = container;
      this.bannerDefendTween = tween;
    }
  }

  private fitKnownMap(): void {
    const camera = this.cameras.main;
    if (window.innerWidth < 900) {
      camera.setZoom(0.58);
      camera.centerOn(HEART_TILE.x * TILE, HEART_TILE.y * TILE);
    } else {
      camera.setZoom(0.7);
      camera.centerOn(HEART_TILE.x * TILE, HEART_TILE.y * TILE);
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
    this.heartPathTree ??= this.pathTreeFrom(HEART_TILE);
    return Number.isFinite(this.heartPathTree.distanceTo({ x, y }));
  }

  private pathTreeFrom(from: GridPoint): PathTree {
    const start = {
      x: Phaser.Math.Clamp(Math.round(from.x), 0, W - 1),
      y: Phaser.Math.Clamp(Math.round(from.y), 0, H - 1),
    };
    return buildPathTree(W, H, start, (x, y) => this.isPassable(x, y));
  }

  private pathBetween(from: GridPoint, to: GridPoint): GridPoint[] {
    const start = { x: Phaser.Math.Clamp(Math.round(from.x), 0, W - 1), y: Phaser.Math.Clamp(Math.round(from.y), 0, H - 1) };
    const goal = { x: Phaser.Math.Clamp(Math.round(to.x), 0, W - 1), y: Phaser.Math.Clamp(Math.round(to.y), 0, H - 1) };
    return findPath(W, H, start, goal, (x, y) => this.isPassable(x, y));
  }

  private invalidateNavigation(): void {
    this.heartPathTree = undefined;
    this.refreshBannerAttackPath();
    this.wakeIdleWorkers();
  }

  private refreshBannerAttackPath(): void {
    this.bannerAttackPath = this.bannerAttack
      ? this.pathBetween(HEART_TILE, this.bannerAttack)
      : [];
  }

  private wakeIdleWorkers(): void {
    for (const worker of this.workers) {
      if (worker.state === 'idle') worker.assignmentCooldown = 0;
    }
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
    return this.rooms
      .filter((room) => room.kind === 'bedroom' && this.isRoomComplete(room))
      .reduce((sum, room) => sum + bedroomCapacity(room.w * room.h), 0);
  }

  private hasFunctionalRoom(kind: RoomKind): boolean {
    return this.rooms.some((room) => room.kind === kind && this.isRoomComplete(room));
  }

  private isRoomComplete(room: Room): boolean {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        const tile = this.tileAt(x, y);
        if (tile?.roomId !== room.id || tile.construction !== 'complete') return false;
      }
    }
    return true;
  }

  private bedsUsed(): number {
    return this.units.filter((unit) => unit.bed).length;
  }

  private pointInRoom(point: GridPoint, room: Room): boolean {
    return point.x >= room.x && point.y >= room.y && point.x < room.x + room.w && point.y < room.y + room.h;
  }

  private assignRoomTiles(room: Room, construction: TileConstruction): void {
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) {
        const tile = this.tileAt(x, y);
        if (!tile) continue;
        tile.roomId = room.id;
        tile.roomKind = room.kind;
        tile.construction = construction;
        tile.control = 'owned';
      }
    }
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
    return this.tileAt(x, y)?.geology === 'excavated';
  }

  private tileAt(x: number, y: number): WorldTile | undefined {
    return this.inBounds(x, y) ? this.tiles[y]?.[x] : undefined;
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
