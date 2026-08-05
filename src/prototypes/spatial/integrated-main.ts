import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { CanonicalGameState } from '../../core/AutomationBridge';
import type { ItemKind, RoomKind } from '../../data/definitions';
import { VISUAL_TRUTH_SPRITES, type SpritePresentation } from '../geometry/GeometryVisualTruthPresentation';
import { createCampaignEvaluationState } from './CampaignEvaluationState';
import { connectGameSimulation, type GameSimulationBridge } from './GameSimulationBridge';
import {
  CAMPAIGN_EVALUATION_SLICE,
  DWARF_CHAMBER,
  FUNGUS_CHAMBER,
  FUNGUS_TILE,
  HEART_TILE,
  INTEGRATION_SLICE,
  IRON_CHAMBER,
  SHRINE_CHAMBER,
  TUTORIAL_ROUTE,
  knownTileMap,
  insideRect,
  mapToWorld,
  snapshotToSpatialCells,
  terrainSignature,
  tileKey,
  tutorialRouteProgress,
  type IntegratedCell,
  type SpatialProjection,
} from './IntegrationModel';
import { buildBoundaryRuns, type BoundaryRun } from './layout';
import './integrated-style.css';

type ViewPreset = 'overview' | 'heart' | 'west' | 'east';

const rootElement = document.querySelector<HTMLElement>('#spatial-prototype');
const canvasHostElement = document.querySelector<HTMLElement>('#prototype-canvas');
if (!rootElement || !canvasHostElement) throw new Error('Spatial integration host is missing.');
const root: HTMLElement = rootElement;
const canvasHost: HTMLElement = canvasHostElement;
const campaignEvaluationMode = new URLSearchParams(window.location.search).get('campaign-evaluation') === '1';
const activeProjection: SpatialProjection = campaignEvaluationMode ? CAMPAIGN_EVALUATION_SLICE : INTEGRATION_SLICE;
const toWorld = (x: number, y: number): { x: number; z: number } => mapToWorld(x, y, activeProjection);

document.documentElement.dataset.integration = campaignEvaluationMode ? 'campaign-evaluation-v1' : 'spatial-v3';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071427);
scene.fog = new THREE.FogExp2(0x071427, 0.0065);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 1000 ? 1 : 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
canvasHost.append(renderer.domElement);

const camera = new THREE.OrthographicCamera(-16, 16, 9, -9, 0.1, 100);
camera.up.set(0, 1, 0);
// 53 degrees above the horizontal: enough facade to read the walls without
// hiding the floor plan behind them.
const cameraOffset = new THREE.Vector3(0, 15.5, 11.7);
const cameraTarget = new THREE.Vector3(0, 0, 0);

function openingCameraZoom(): number {
  if (campaignEvaluationMode) {
    if (window.innerWidth < 950) return 0.5;
    if (window.innerWidth < 1500) return 0.62;
    return 0.7;
  }
  if (window.innerWidth < 950) return 0.72;
  if (window.innerWidth < 1500) return 0.88;
  return 1.06;
}

function openingViewHeight(): number {
  return window.innerHeight / (32 * openingCameraZoom());
}

let viewHeight = openingViewHeight();
let activePreset: ViewPreset = 'overview';

const world = new THREE.Group();
scene.add(world);

function asset(path: string): string {
  return new URL(path, document.baseURI).href;
}

const textureLoader = new THREE.TextureLoader();
const maxAnisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

function surfaceMaterial(
  path: string,
  roughness = 0.9,
  emissive = 0x000000,
  emissiveIntensity = 0,
  color = 0xffffff,
): THREE.MeshStandardMaterial {
  const map = textureLoader.load(asset(path));
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.anisotropy = maxAnisotropy;
  return new THREE.MeshStandardMaterial({
    color,
    map,
    roughness,
    metalness: 0.01,
    emissive,
    emissiveIntensity,
  });
}

const floorMaterials = {
  built: surfaceMaterial('assets/generated/style-b-v3/terrain/claimed-floor.png', 0.82),
  raw: surfaceMaterial('assets/generated/style-b-v3/terrain/raw-floor.png', 0.96),
  claimed: surfaceMaterial('assets/generated/style-b-v3/terrain/claimed-corridor.png', 0.98),
  natural: surfaceMaterial('assets/generated/geometry-sandbox-v2/visual-truth/grotto-floor-style-b-v1.png', 0.9),
  iron: surfaceMaterial('assets/generated/style-b-v3/terrain/raw-floor.png', 0.98, 0x000000, 0, 0x8d8a80),
  hostile: surfaceMaterial('assets/generated/style-b-v3/terrain/damp-floor.png', 0.96, 0x000000, 0, 0x7d7184),
};
const rockTopMaterial = surfaceMaterial('assets/generated/geometry-sandbox-v2/visual-truth/closed-rock-style-b-v1.png', 0.95);

const material = {
  bedrock: new THREE.MeshStandardMaterial({ color: 0x071426, roughness: 1 }),
  rockBody: new THREE.MeshStandardMaterial({ color: 0x20314e, roughness: 0.98 }),
  wallCore: new THREE.MeshStandardMaterial({ color: 0x222630, roughness: 1 }),
  builtBase: new THREE.MeshStandardMaterial({ color: 0x46535a, roughness: 0.98 }),
  builtFace: surfaceMaterial('assets/generated/geometry-sandbox-v2/walls/wall-side-masonry-v1.png', 0.93),
  builtCap: surfaceMaterial('assets/generated/geometry-sandbox-v2/walls/wall-cap-limestone-v1.png', 0.89),
  corridorFace: new THREE.MeshStandardMaterial({ color: 0x596d76, roughness: 0.98 }),
  corridorCap: new THREE.MeshStandardMaterial({ color: 0xa5b0a9, roughness: 0.92 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xd8a532, metalness: 0.48, roughness: 0.42 }),
  contact: new THREE.MeshBasicMaterial({ color: 0x020714, transparent: true, opacity: 0.18, depthWrite: false }),
  route: new THREE.MeshStandardMaterial({
    color: 0xe2ad35,
    emissive: 0x7c4a09,
    emissiveIntensity: 1.05,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  }),
};

const unitBox = new THREE.BoxGeometry(1, 1, 1);
const wallStoneGeometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.055);
const markerTile = new THREE.PlaneGeometry(0.68, 0.68).rotateX(-Math.PI / 2);
const rockMargin = { x: 10, y: 7 } as const;

interface SurfaceTile {
  x: number;
  z: number;
  mapX: number;
  mapY: number;
}

function matrixAt(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion(),
    new THREE.Vector3(sx, sy, sz),
  );
}

function addInstances(
  geometry: THREE.BufferGeometry,
  meshMaterial: THREE.Material,
  matrices: THREE.Matrix4[],
  parent: THREE.Object3D,
  options: { cast?: boolean; receive?: boolean } = {},
): THREE.InstancedMesh | undefined {
  if (matrices.length === 0) return undefined;
  const mesh = new THREE.InstancedMesh(geometry, meshMaterial, matrices.length);
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.castShadow = options.cast ?? false;
  mesh.receiveShadow = options.receive ?? true;
  parent.add(mesh);
  return mesh;
}

function addTiledSurface(
  tiles: SurfaceTile[],
  meshMaterial: THREE.Material,
  y: number,
  parent: THREE.Object3D,
): THREE.Mesh | undefined {
  if (tiles.length === 0) return undefined;
  const positions = new Float32Array(tiles.length * 4 * 3);
  const normals = new Float32Array(tiles.length * 4 * 3);
  const uvs = new Float32Array(tiles.length * 4 * 2);
  const indices = new Uint32Array(tiles.length * 6);
  const half = 0.5075;
  const atlasSize = 16;

  tiles.forEach((tile, tileIndex) => {
    const vertex = tileIndex * 4;
    const positionOffset = vertex * 3;
    positions.set([
      tile.x - half, 0, tile.z - half,
      tile.x + half, 0, tile.z - half,
      tile.x + half, 0, tile.z + half,
      tile.x - half, 0, tile.z + half,
    ], positionOffset);
    for (let corner = 0; corner < 4; corner += 1) {
      normals.set([0, 1, 0], positionOffset + corner * 3);
    }

    const atlasX = ((tile.mapX % atlasSize) + atlasSize) % atlasSize;
    const atlasY = ((tile.mapY % atlasSize) + atlasSize) % atlasSize;
    const u0 = atlasX / atlasSize;
    const u1 = (atlasX + 1) / atlasSize;
    const v0 = atlasY / atlasSize;
    const v1 = (atlasY + 1) / atlasSize;
    uvs.set([u0, v1, u1, v1, u1, v0, u0, v0], vertex * 2);
    indices.set([
      vertex, vertex + 2, vertex + 1,
      vertex, vertex + 3, vertex + 2,
    ], tileIndex * 6);
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeBoundingSphere();

  const mesh = new THREE.Mesh(geometry, meshMaterial);
  mesh.position.y = y;
  mesh.receiveShadow = true;
  mesh.userData.disposeGeometry = true;
  parent.add(mesh);
  return mesh;
}

const bedrock = new THREE.Mesh(
  new THREE.BoxGeometry(
    activeProjection.maxX - activeProjection.minX + 1 + rockMargin.x * 2,
    0.18,
    activeProjection.maxY - activeProjection.minY + 1 + rockMargin.y * 2,
  ),
  material.bedrock,
);
const bedrockCenter = toWorld(
  (activeProjection.minX + activeProjection.maxX) / 2,
  (activeProjection.minY + activeProjection.maxY) / 2,
);
bedrock.position.set(bedrockCenter.x, -0.18, bedrockCenter.z);
bedrock.receiveShadow = true;
world.add(bedrock);

let dynamicTerrain = new THREE.Group();
let foregroundWalls = new THREE.Group();
let foregroundWallsVisible = true;
world.add(dynamicTerrain);

function classifyFloor(cell: IntegratedCell): keyof typeof floorMaterials {
  if (cell.zone === 'built') return 'built';
  if (cell.zone === 'natural') {
    if (insideRect(cell.mapX, cell.mapY, FUNGUS_CHAMBER)) return 'natural';
    if (insideRect(cell.mapX, cell.mapY, IRON_CHAMBER)) return 'iron';
    if ([DWARF_CHAMBER, SHRINE_CHAMBER].some((rect) => insideRect(cell.mapX, cell.mapY, rect))) return 'hostile';
    return 'raw';
  }
  return cell.control === 'owned' || cell.control === 'claiming' ? 'claimed' : 'raw';
}

type WallLayer = 'core' | 'base' | 'face' | 'cap' | 'highlight' | 'brass' | 'contact';
type WallMatrixBuckets = Record<WallLayer, THREE.Matrix4[]> & { foreground: Record<WallLayer, THREE.Matrix4[]> };

function newWallBuckets(): WallMatrixBuckets {
  const layers = (): Record<WallLayer, THREE.Matrix4[]> => ({
    core: [], base: [], face: [], cap: [], highlight: [], brass: [], contact: [],
  });
  return { ...layers(), foreground: layers() };
}

function wallMatrices(runs: BoundaryRun[]): WallMatrixBuckets {
  const result = newWallBuckets();
  const addCourse = (
    bucket: Record<WallLayer, THREE.Matrix4[]>,
    run: BoundaryRun,
    layer: WallLayer,
    y: number,
    height: number,
    thickness: number,
    outward = 0.055,
    gap = 0.055,
  ): void => {
    const alongX = run.axis === 'x';
    const sideOffset = run.side === 'north' ? { x: 0, z: -outward }
      : run.side === 'south' ? { x: 0, z: outward }
        : run.side === 'east' ? { x: outward, z: 0 }
          : { x: -outward, z: 0 };
    for (let cursor = run.start; cursor < run.end - 0.001; cursor += 1) {
      const length = Math.min(1, run.end - cursor);
      const along = cursor + length / 2;
      bucket[layer].push(matrixAt(
        (alongX ? along : run.constant) + sideOffset.x,
        y,
        (alongX ? run.constant : along) + sideOffset.z,
        alongX ? Math.max(0.12, length - gap) : thickness,
        height,
        alongX ? thickness : Math.max(0.12, length - gap),
      ));
    }
  };

  for (const run of runs) {
    if (run.zone === 'natural') continue;
    const bucket = run.side === 'south' ? result.foreground : result;
    if (run.zone === 'built') {
      addCourse(bucket, run, 'core', 0.65, 1.22, 0.33, 0.04, 0);
      addCourse(bucket, run, 'base', 0.16, 0.28, 0.42);
      addCourse(bucket, run, 'face', 0.5, 0.38, 0.37);
      addCourse(bucket, run, 'face', 0.86, 0.32, 0.37, 0.055, 0.085);
      addCourse(bucket, run, 'cap', 1.11, 0.2, 0.48);
      addCourse(bucket, run, 'highlight', 1.225, 0.045, 0.35, 0.055, 0.1);
      const clampCount = Math.floor(run.length / 4);
      for (let index = 1; index <= clampCount; index += 1) {
        const along = run.start + (run.length * index) / (clampCount + 1);
        bucket.brass.push(matrixAt(
          run.axis === 'x' ? along : run.constant,
          1.26,
          run.axis === 'x' ? run.constant : along,
          run.axis === 'x' ? 0.13 : 0.46,
          0.055,
          run.axis === 'x' ? 0.46 : 0.13,
        ));
      }
    } else {
      const rear = run.side === 'north';
      const front = run.side === 'south';
      const sideHeight = rear ? 0.86 : front ? 0.36 : 0.62;
      const capY = rear ? 0.91 : front ? 0.43 : 0.68;
      addCourse(bucket, run, 'core', sideHeight / 2 + 0.04, sideHeight, 0.12, 0.055, 0);
      addCourse(bucket, run, 'face', sideHeight / 2 + 0.04, sideHeight - 0.04, 0.16, 0.065);
      addCourse(bucket, run, 'cap', capY, 0.1, 0.22, 0.08, 0.095);
    }
    addCourse(bucket, run, 'contact', 0.025, 0.018, 0.1, -0.08, 0);
  }
  return result;
}

function rebuildTerrain(state: CanonicalGameState): void {
  const previous = dynamicTerrain;
  dynamicTerrain = new THREE.Group();
  foregroundWalls = new THREE.Group();
  foregroundWalls.visible = foregroundWallsVisible;
  dynamicTerrain.add(foregroundWalls);
  world.add(dynamicTerrain);
  world.remove(previous);
  previous.traverse((child) => {
    if (child instanceof THREE.InstancedMesh) child.dispose();
    if (child instanceof THREE.Mesh && child.userData.disposeGeometry) child.geometry.dispose();
  });
  previous.clear();

  const cells = snapshotToSpatialCells(state, activeProjection);
  const openMap = new Map(cells.map((cell) => [tileKey(cell.mapX, cell.mapY), cell]));
  const rockBodies: THREE.Matrix4[] = [];
  const rockTops: SurfaceTile[] = [];
  const floorBuckets: Record<keyof typeof floorMaterials, SurfaceTile[]> = {
    built: [],
    raw: [],
    claimed: [],
    natural: [],
    iron: [],
    hostile: [],
  };

  for (let mapY = activeProjection.minY - rockMargin.y; mapY <= activeProjection.maxY + rockMargin.y; mapY += 1) {
    for (let mapX = activeProjection.minX - rockMargin.x; mapX <= activeProjection.maxX + rockMargin.x; mapX += 1) {
      const worldPosition = toWorld(mapX, mapY);
      const openCell = openMap.get(tileKey(mapX, mapY));
      const surface = { ...worldPosition, mapX, mapY };
      if (!openCell) {
        rockBodies.push(matrixAt(worldPosition.x, 0.36, worldPosition.z, 1.025, 0.76, 1.025));
        rockTops.push(surface);
        continue;
      }
      const floorKind = classifyFloor(openCell);
      floorBuckets[floorKind].push(surface);
    }
  }

  addInstances(unitBox, material.rockBody, rockBodies, dynamicTerrain, { cast: true, receive: true });
  addTiledSurface(rockTops, rockTopMaterial, 0.745, dynamicTerrain);

  (Object.keys(floorBuckets) as Array<keyof typeof floorBuckets>).forEach((kind) => {
    addTiledSurface(floorBuckets[kind], floorMaterials[kind], 0.015, dynamicTerrain);
  });

  const runs = buildBoundaryRuns(cells);
  const walls = wallMatrices(runs);
  const addWallLayers = (layers: Record<WallLayer, THREE.Matrix4[]>, parent: THREE.Object3D): void => {
    addInstances(unitBox, material.wallCore, layers.core, parent, { cast: true });
    addInstances(wallStoneGeometry, material.builtBase, layers.base, parent, { cast: true });
    addInstances(wallStoneGeometry, material.builtFace, layers.face, parent, { cast: true });
    addInstances(wallStoneGeometry, material.builtCap, layers.cap, parent, { cast: true });
    addInstances(wallStoneGeometry, material.corridorCap, layers.highlight, parent, { cast: true });
    addInstances(unitBox, material.brass, layers.brass, parent, { cast: true });
    addInstances(unitBox, material.contact, layers.contact, parent, { receive: false });
  };
  addWallLayers(walls, dynamicTerrain);
  addWallLayers(walls.foreground, foregroundWalls);

  const tileMap = knownTileMap(state);
  const thresholdOpen = tileMap.get(tileKey(40, 34))?.geology === 'excavated';
  if (thresholdOpen) {
    const doorway = toWorld(39.5, 34);
    addInstances(unitBox, material.brass, [matrixAt(doorway.x, 0.07, doorway.z, 0.13, 0.1, 0.82)], dynamicTerrain);
  }

  const closedRoute = TUTORIAL_ROUTE.solidCells.filter(
    (point) => tileMap.get(tileKey(point.x, point.y))?.geology !== 'excavated',
  );
  addInstances(
    markerTile,
    material.route,
    closedRoute.map((point) => {
      const position = toWorld(point.x, point.y);
      return matrixAt(position.x, 0.757, position.z);
    }),
    dynamicTerrain,
    { receive: false },
  );
  renderer.shadowMap.needsUpdate = true;
}

const billboardMeshes: THREE.Mesh[] = [];
const billboardTextureCache = new Map<string, THREE.Texture>();

function billboardTexture(path: string): THREE.Texture {
  const cached = billboardTextureCache.get(path);
  if (cached) return cached;
  const texture = textureLoader.load(asset(path));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = maxAnisotropy;
  billboardTextureCache.set(path, texture);
  return texture;
}

interface BillboardOptions {
  mapX: number;
  mapY: number;
  width: number;
  height: number;
  lift?: number;
  depthOffset?: number;
  emissive?: number;
  renderOrder?: number;
  shadow?: boolean;
  anchorY?: number;
  shadowWidth?: number;
  shadowDepth?: number;
  depthWrite?: boolean;
}

function createBillboard(path: string, options: BillboardOptions): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(options.width, options.height);
  if (typeof options.anchorY === 'number') {
    geometry.translate(0, options.height * (0.5 - options.anchorY), 0);
  }
  const meshMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: billboardTexture(path),
    transparent: true,
    alphaTest: 0.13,
    depthTest: true,
    depthWrite: options.depthWrite ?? true,
    side: THREE.DoubleSide,
    roughness: 0.78,
    emissive: options.emissive ?? 0x101010,
    emissiveIntensity: 0.18,
  });
  const mesh = new THREE.Mesh(geometry, meshMaterial);
  const position = toWorld(options.mapX, options.mapY);
  mesh.position.set(
    position.x,
    options.lift ?? (typeof options.anchorY === 'number' ? 0.055 : Math.min(0.72, options.height * 0.12)),
    position.z + (options.depthOffset ?? 0),
  );
  mesh.quaternion.copy(camera.quaternion);
  mesh.renderOrder = options.renderOrder ?? 10;
  mesh.userData.baseMapX = options.mapX;
  mesh.userData.baseMapY = options.mapY;
  mesh.userData.baseLift = mesh.position.y;
  world.add(mesh);
  billboardMeshes.push(mesh);

  if (options.shadow) {
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 22),
      new THREE.MeshBasicMaterial({ color: 0x020714, transparent: true, opacity: 0.2, depthWrite: false }),
    );
    shadow.position.set(position.x, 0.04, position.z + 0.055);
    shadow.scale.set(options.shadowWidth ?? options.width * 0.56, options.shadowDepth ?? options.width * 0.27, 1);
    shadow.rotation.x = -Math.PI / 2;
    world.add(shadow);
    mesh.userData.shadow = shadow;
  }
  return mesh;
}

function createGroundedBillboard(
  path: string,
  mapX: number,
  mapY: number,
  presentation: SpritePresentation,
  renderOrder: number,
  scale = 1,
): THREE.Mesh {
  return createBillboard(path, {
    mapX,
    mapY,
    width: presentation.width * scale,
    height: presentation.height * scale,
    anchorY: presentation.anchorY,
    shadowWidth: presentation.shadowWidth * scale,
    shadowDepth: presentation.shadowDepth * scale,
    renderOrder,
    shadow: true,
  });
}

function addHeartHeadquarters(): void {
  const cx = HEART_TILE.x;
  const cy = HEART_TILE.y;
  const shadowPosition = toWorld(cx, cy + 1.55);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.85, 32),
    new THREE.MeshBasicMaterial({ color: 0x020511, transparent: true, opacity: 0.2, depthWrite: false }),
  );
  shadow.position.set(shadowPosition.x, 0.035, shadowPosition.z);
  shadow.scale.z = 0.32;
  shadow.rotation.x = -Math.PI / 2;
  world.add(shadow);

  createBillboard('assets/generated/style-b-v2/heart/base.png', {
    mapX: cx, mapY: cy + 0.06, width: 220 / 32, height: 165 / 32, lift: 0.67, renderOrder: 11, depthWrite: false,
  });
  createBillboard('assets/generated/style-b-v3/heart/backplate.png', {
    mapX: cx, mapY: cy - 0.44, width: 170 / 32, height: 170 / 32, lift: 0.76, depthOffset: -0.025, renderOrder: 12, depthWrite: false,
  });
  createBillboard('assets/generated/style-b-v2/heart/core.png', {
    mapX: cx, mapY: cy - 0.44, width: 68 / 32, height: 68 / 32, lift: 0.56, depthOffset: 0.015, emissive: 0x5b1218, renderOrder: 13, depthWrite: false,
  });
  createBillboard('assets/generated/style-b-v3/heart/bezel.png', {
    mapX: cx, mapY: cy - 0.44, width: 90 / 32, height: 90 / 32, lift: 0.58, depthOffset: 0.03, renderOrder: 14, depthWrite: false,
  });
  createBillboard('assets/generated/style-b-v2/heart/pulpit.png', {
    mapX: cx, mapY: cy + 1.66, width: 120 / 32, height: 82 / 32, lift: 0.41, depthOffset: 0.055, renderOrder: 15, depthWrite: false,
  });
}

function addStaticDressing(): void {
  const prop = (path: string, mapX: number, mapY: number, width: number, height: number, shadow = true) => createBillboard(path, {
    mapX, mapY, width: width / 32, height: height / 32, shadow, renderOrder: 18,
  });

  prop('assets/generated/style-b-v2/decor/lamp.png', 26.2, 26.2, 42, 42, false);
  prop('assets/generated/style-b-v2/decor/lamp.png', 38.8, 26.2, 42, 42, false);
  prop('assets/generated/style-b-v2/decor/banner.png', 26.2, 28.6, 45, 56, false);
  prop('assets/generated/style-b-v2/decor/notice-board.png', 38.6, 28.6, 58, 58, false);
  prop('assets/generated/style-b-v2/decor/rack.png', 38.2, 31.2, 68, 55);
  prop('assets/generated/style-b-v2/decor/cart.png', 37.8, 36.1, 62, 52);
  prop('assets/generated/style-b-v2/decor/supplies.png', 26.3, 36.1, 60, 54);

  prop('assets/generated/style-b-v2/decor/fungus-small.png', FUNGUS_TILE.x - 1.9, FUNGUS_TILE.y - 1.8, 50, 42, false);
  prop('assets/generated/style-b-v2/decor/fungus-small.png', FUNGUS_TILE.x + 2.2, FUNGUS_TILE.y - 1.9, 44, 38, false);
  prop('assets/generated/style-b-v2/decor/fungus-medium.png', FUNGUS_TILE.x - 1.9, FUNGUS_TILE.y + 1.2, 60, 60, false);
  prop('assets/generated/style-b-v2/decor/fungus-medium.png', FUNGUS_TILE.x + 2.4, FUNGUS_TILE.y + 1.4, 66, 66, false);
  prop('assets/generated/style-b-v2/decor/grotto-station.png', FUNGUS_TILE.x + 2.2, FUNGUS_TILE.y + 2.7, 58, 58);
}

addHeartHeadquarters();
addStaticDressing();

const actorMeshes = new Map<string, THREE.Mesh>();
const roomMeshes = new Map<number, THREE.Mesh>();
const itemMeshes = new Map<number, THREE.Mesh>();
const targetMeshes = new Map<string, THREE.Mesh>();

function actorAsset(kind: string): string {
  if (kind === 'guard') return 'assets/generated/style-b-v2/characters/guard.png';
  if (kind === 'archer') return 'assets/generated/style-b-v2/characters/archer.png';
  if (kind === 'worker') return 'assets/generated/style-b-v2/characters/worker.png';
  return `assets/generated/units-v1/${kind}.png`;
}

function actorPresentation(kind: string): SpritePresentation {
  if (kind === 'worker') return VISUAL_TRUTH_SPRITES.worker;
  if (kind === 'guard') return VISUAL_TRUTH_SPRITES.guard;
  if (kind === 'archer') return VISUAL_TRUTH_SPRITES.archer;
  if (kind === 'hexbinder') return VISUAL_TRUTH_SPRITES.hexbinder;
  if (kind === 'inquisitor') return VISUAL_TRUTH_SPRITES.inquisitor;
  if (kind === 'captain' || kind === 'warden') return VISUAL_TRUTH_SPRITES.enemyLarge;
  return VISUAL_TRUTH_SPRITES.enemy;
}

function syncActors(state: CanonicalGameState): void {
  const actors = [
    ...state.workers.map((worker) => ({ key: `worker:${worker.id}`, kind: 'worker', x: worker.x, y: worker.y, state: worker.state })),
    ...state.units.map((unit) => ({ key: `unit:${unit.id}`, kind: unit.kind, x: unit.x, y: unit.y, state: 'unit' })),
    ...state.enemies.filter((enemy) => enemy.active).map((enemy) => ({
      key: `enemy:${enemy.id}`, kind: enemy.kind, x: enemy.x, y: enemy.y, state: 'enemy',
    })),
  ];
  const active = new Set<string>();

  for (const actor of actors) {
    active.add(actor.key);
    let mesh = actorMeshes.get(actor.key);
    if (!mesh) {
      mesh = createGroundedBillboard(actorAsset(actor.kind), actor.x, actor.y, actorPresentation(actor.kind), 25);
      actorMeshes.set(actor.key, mesh);
    }
    const position = toWorld(actor.x, actor.y);
    mesh.userData.targetX = position.x;
    mesh.userData.targetZ = position.z;
    mesh.userData.actorState = actor.state;
  }

  for (const [key, mesh] of actorMeshes) mesh.visible = active.has(key);
}

const roomPropAssets: Record<RoomKind, string> = {
  storage: 'assets/generated/room-props-v3/storage.png',
  bedroom: 'assets/generated/room-props-v3/bed.png',
  kitchen: 'assets/generated/room-props-v3/cauldron.png',
  smelter: 'assets/generated/room-props-v3/furnace.png',
  workshop: 'assets/generated/room-props-v3/workbench.png',
  prison: 'assets/generated/room-props-v3/prison-gate.png',
};

const itemAssets: Record<ItemKind, string> = {
  ore: 'assets/generated/units-v1/item-ore.png',
  biomass: 'assets/generated/units-v1/item-biomass.png',
  essence: 'assets/generated/units-v1/item-essence.png',
  metal: 'assets/generated/units-v1/item-metal.png',
  ration: 'assets/generated/units-v1/item-ration.png',
  armour: 'assets/generated/units-v1/item-armour.png',
};

function syncDressing(state: CanonicalGameState): void {
  const activeRooms = new Set<number>();
  for (const room of state.rooms.filter((candidate) => candidate.complete)) {
    activeRooms.add(room.id);
    if (!roomMeshes.has(room.id)) {
      roomMeshes.set(room.id, createGroundedBillboard(
        roomPropAssets[room.kind],
        room.x + room.w / 2 - 0.5,
        room.y + room.h / 2 - 0.5,
        VISUAL_TRUTH_SPRITES.roomProp,
        19,
        room.kind === 'bedroom' ? 0.88 : 1,
      ));
    }
  }
  for (const [id, mesh] of roomMeshes) mesh.visible = activeRooms.has(id);

  const activeItems = new Set<number>();
  for (const itemState of state.items) {
    activeItems.add(itemState.id);
    let mesh = itemMeshes.get(itemState.id);
    if (!mesh) {
      mesh = createGroundedBillboard(
        itemAssets[itemState.kind], itemState.x, itemState.y, VISUAL_TRUTH_SPRITES.resource, 22,
        THREE.MathUtils.clamp(0.84 + itemState.amount * 0.045, 0.86, 1.08),
      );
      itemMeshes.set(itemState.id, mesh);
    }
    const position = toWorld(itemState.x, itemState.y);
    mesh.position.x = position.x;
    mesh.position.z = position.z;
  }
  for (const [id, mesh] of itemMeshes) mesh.visible = activeItems.has(id);

  const activeTargets = new Set<string>();
  for (const target of state.targets.filter((candidate) => candidate.discovered && ['iron', 'fungus'].includes(candidate.id))) {
    activeTargets.add(target.id);
    if (targetMeshes.has(target.id)) continue;
    const iron = target.id === 'iron';
    targetMeshes.set(target.id, createGroundedBillboard(
      iron ? 'assets/generated/resources-v2/iron-vein.png' : 'assets/generated/resources-v2/fungus-cluster.png',
      target.x,
      target.y,
      iron ? VISUAL_TRUTH_SPRITES.roomProp : VISUAL_TRUTH_SPRITES.fungusMedium,
      16,
      iron ? 1.2 : 1.45,
    ));
  }
  for (const [id, mesh] of targetMeshes) mesh.visible = activeTargets.has(id);
}

scene.add(new THREE.HemisphereLight(0x91b2ce, 0x07101c, 0.72));
scene.add(new THREE.AmbientLight(0x26354b, 0.22));

const keyLight = new THREE.DirectionalLight(0xffe0ae, 3.25);
keyLight.position.set(-10, 28, 12);
keyLight.castShadow = true;
const shadowMapSize = window.innerWidth < 900 ? 512 : 1024;
keyLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
const shadowExtent = campaignEvaluationMode ? 34 : 23;
keyLight.shadow.camera.left = -shadowExtent;
keyLight.shadow.camera.right = shadowExtent;
keyLight.shadow.camera.top = shadowExtent * 0.72;
keyLight.shadow.camera.bottom = -shadowExtent * 0.72;
keyLight.shadow.bias = -0.0004;
scene.add(keyLight, keyLight.target);

const heartWorld = toWorld(HEART_TILE.x, HEART_TILE.y);
const heartLight = new THREE.PointLight(0xffaa45, 28, 12, 1.7);
heartLight.position.set(heartWorld.x, 4.1, heartWorld.z);
scene.add(heartLight);

const grottoWorld = toWorld(FUNGUS_TILE.x, FUNGUS_TILE.y);
const grottoLight = new THREE.PointLight(0x58e3bf, 30, 12, 1.7);
grottoLight.position.set(grottoWorld.x, 4.2, grottoWorld.z);
scene.add(grottoLight);

const ui = document.createElement('div');
ui.className = `integration-ui${campaignEvaluationMode ? ' is-campaign-evaluation' : ''}`;
ui.innerHTML = campaignEvaluationMode ? `
  <div class="integration-badge"><i></i> Spatial Renderer V3 · kanonisches GameScene-State</div>
  <section class="integration-panel" aria-labelledby="integration-title">
    <span class="integration-kicker">Kampagnen-Renderprobe</span>
    <h2 id="integration-title">Großer Kampagnenstand</h2>
    <p>Eine schreibgeschützte Großszene im kanonischen Zustandsformat: sechs Räume, Kreuzungen, Ressourcen, Einheiten und Gegner.</p>
    <div class="integration-status" role="status" aria-live="polite">
      <span data-status-dot></span>
      <strong data-status-title>Kanonischen Zustand laden …</strong>
      <small data-status-detail>Der echte GameScene-Vertrag wird geprüft.</small>
    </div>
    <div class="integration-actions">
      <button type="button" data-action="wall" aria-pressed="true">Südwand an</button>
    </div>
    <div class="integration-views" aria-label="Kameraansicht">
      <button type="button" data-view="overview" aria-pressed="true">Gesamt</button>
      <button type="button" data-view="heart">Herz</button>
      <button type="button" data-view="west">Westflügel</button>
      <button type="button" data-view="east">Ostflügel</button>
    </div>
    <footer><span data-draws>– Three-Draws</span><span>Renderfixture · keine zweite Simulation</span></footer>
  </section>
` : `
  <div class="integration-badge"><i></i> Spatial Renderer V3 · echte Simulation</div>
  <section class="integration-panel" aria-labelledby="integration-title">
    <span class="integration-kicker">Live-Integration</span>
    <h2 id="integration-title">Realer Grottendurchbruch</h2>
    <p>Der Renderer liest Karte, Arbeiter, Jobs und Grabungsfortschritt direkt aus dem echten laufenden Spiel.</p>
    <div class="integration-status" role="status" aria-live="polite">
      <span data-status-dot></span>
      <strong data-status-title>Simulation verbinden …</strong>
      <small data-status-detail>Der Eröffnungsausschnitt wird geladen.</small>
    </div>
    <div class="integration-progress" aria-label="Grabungsfortschritt"><i data-progress></i></div>
    <div class="integration-actions">
      <button type="button" class="integration-primary" data-action="start" disabled>Durchbruch starten</button>
      <button type="button" data-action="reset">Zurücksetzen</button>
      <button type="button" data-action="wall" aria-pressed="true">Südwand an</button>
    </div>
    <div class="integration-views" aria-label="Kameraansicht">
      <button type="button" data-view="overview" aria-pressed="true">Gesamt</button>
      <button type="button" data-view="heart">Herz</button>
      <button type="button" data-view="west">West</button>
      <button type="button" data-view="east">Grotte</button>
    </div>
    <footer><span data-draws>– Three-Draws</span><span>HUD und Mission stammen aus Phaser</span></footer>
  </section>
`;
root.append(ui);

const startButton = ui.querySelector<HTMLButtonElement>('[data-action="start"]');
const statusTitle = ui.querySelector<HTMLElement>('[data-status-title]');
const statusDetail = ui.querySelector<HTMLElement>('[data-status-detail]');
const statusDot = ui.querySelector<HTMLElement>('[data-status-dot]');
const progressBar = ui.querySelector<HTMLElement>('[data-progress]');
const drawOutput = ui.querySelector<HTMLElement>('[data-draws]');

function setStatus(title: string, detail: string, state: 'loading' | 'ready' | 'active' | 'complete' | 'error'): void {
  if (statusTitle) statusTitle.textContent = title;
  if (statusDetail) statusDetail.textContent = detail;
  if (statusDot) statusDot.dataset.state = state;
}

const heartPreset = toWorld(HEART_TILE.x, HEART_TILE.y);
const westPreset = toWorld(campaignEvaluationMode ? 17 : 29, campaignEvaluationMode ? 31 : 34);
const eastPreset = toWorld(campaignEvaluationMode ? 48 : FUNGUS_TILE.x, campaignEvaluationMode ? 27 : FUNGUS_TILE.y);
const presets: Record<ViewPreset, { x: number; z: number; height: number }> = {
  overview: { x: bedrockCenter.x, z: bedrockCenter.z, height: openingViewHeight() },
  heart: { x: heartPreset.x, z: heartPreset.z, height: campaignEvaluationMode ? 15.5 : 13.4 },
  west: { x: westPreset.x, z: westPreset.z, height: campaignEvaluationMode ? 18.5 : 13.2 },
  east: { x: eastPreset.x, z: eastPreset.z, height: campaignEvaluationMode ? 18.5 : 11.8 },
};

function updateCamera(): void {
  const aspect = Math.max(0.25, window.innerWidth / Math.max(1, window.innerHeight));
  camera.left = (-viewHeight * aspect) / 2;
  camera.right = (viewHeight * aspect) / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.position.copy(cameraTarget).add(cameraOffset);
  camera.lookAt(cameraTarget);
  camera.updateProjectionMatrix();
}

function setPreset(preset: ViewPreset): void {
  activePreset = preset;
  const view = presets[preset];
  cameraTarget.set(view.x, 0, view.z);
  viewHeight = preset === 'overview' ? openingViewHeight() : view.height;
  updateCamera();
  ui.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.view === preset));
  });
}

ui.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
  button.addEventListener('click', () => setPreset(button.dataset.view as ViewPreset));
});

ui.querySelector<HTMLButtonElement>('[data-action="wall"]')?.addEventListener('click', (event) => {
  foregroundWallsVisible = !foregroundWallsVisible;
  foregroundWalls.visible = foregroundWallsVisible;
  renderer.shadowMap.needsUpdate = true;
  const button = event.currentTarget as HTMLButtonElement;
  button.setAttribute('aria-pressed', String(foregroundWallsVisible));
  button.textContent = `Südwand ${foregroundWallsVisible ? 'an' : 'aus'}`;
});

ui.querySelector<HTMLButtonElement>('[data-action="reset"]')?.addEventListener('click', () => window.location.reload());

let bridge: GameSimulationBridge | undefined;
let latestTerrainSignature = '';
let simulationRunning = false;
let simulationAccumulator = 0;
let connectedFollowupTicks = 0;

function syncState(state: CanonicalGameState): void {
  const signature = terrainSignature(state, activeProjection);
  if (signature !== latestTerrainSignature) {
    latestTerrainSignature = signature;
    rebuildTerrain(state);
  }
  syncActors(state);
  syncDressing(state);

  const progress = tutorialRouteProgress(state);
  if (progressBar) progressBar.style.width = `${(progress.opened / progress.total) * 100}%`;
  root.dataset.openedCells = String(progress.opened);
  root.dataset.connected = String(progress.connected);

  if (!simulationRunning) return;
  const digging = state.workers.filter((worker) => worker.state === 'dig').length;
  if (!progress.connected) {
    setStatus(
      `${progress.opened}/${progress.total} Felsfelder geöffnet`,
      digging > 0 ? `${digging} Arbeiter graben mit echten Jobs und echter Wegsuche.` : 'Arbeiter bewegen sich zum nächsten erreichbaren Grabfeld.',
      'active',
    );
    return;
  }

  connectedFollowupTicks += 5;
  if (progress.workerInGrotto) {
    simulationRunning = false;
    setStatus('Integration bestanden', 'Ein Arbeiter hat die Grotte über den neu berechneten Weg erreicht.', 'complete');
    if (startButton) startButton.textContent = 'Durchbruch abgeschlossen';
  } else if (connectedFollowupTicks >= 300) {
    simulationRunning = false;
    setStatus('Wegtest nicht bestätigt', 'Der Fels ist offen, aber kein Arbeiter hat die Grotte erreicht. Das gilt nicht als bestandene Integration.', 'error');
    if (startButton) startButton.textContent = 'Weg nicht bestätigt';
  } else {
    setStatus('Durchbruch offen', 'Die Simulation beansprucht den Gang und führt Arbeiter durch die neue Verbindung.', 'active');
  }
}

startButton?.addEventListener('click', () => {
  if (!bridge || simulationRunning) return;
  const initialState = bridge.state();
  if (!initialState.started) {
    const startResult = bridge.api.start();
    if (!startResult.ok) {
      setStatus('Simulation konnte nicht starten', startResult.reason ?? 'Unbekannter Simulationsfehler.', 'error');
      return;
    }
  }
  const speedResult = bridge.api.setSpeed(0);
  if (!speedResult.ok) {
    setStatus('Simulation konnte nicht pausieren', speedResult.reason ?? 'Unbekannter Simulationsfehler.', 'error');
    return;
  }
  const result = bridge.api.planDig(TUTORIAL_ROUTE.start, TUTORIAL_ROUTE.end, true);
  if (!result.ok) {
    const progress = tutorialRouteProgress(result.state);
    if (progress.connected) {
      setStatus('Durchbruch bereits offen', 'Die echte Simulation meldet keine weiteren grabbaren Felsfelder.', 'complete');
    } else {
      setStatus('Route konnte nicht geplant werden', result.reason ?? 'Unbekannter Simulationsfehler.', 'error');
    }
    return;
  }
  simulationRunning = true;
  connectedFollowupTicks = 0;
  startButton.disabled = true;
  startButton.textContent = 'Simulation läuft …';
  setStatus('Grabungsroute geplant', 'Die realen Arbeiter wählen Jobs und erreichbare Felsnachbarn; der Ablauf läuft mit 2×.', 'active');
  syncState(result.state);
});

let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

renderer.domElement.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const scale = viewHeight / Math.max(320, window.innerHeight);
  cameraTarget.x -= (event.clientX - lastPointerX) * scale;
  cameraTarget.z -= (event.clientY - lastPointerY) * scale * 1.08;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  updateCamera();
});
renderer.domElement.addEventListener('pointerup', (event) => {
  dragging = false;
  renderer.domElement.releasePointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('wheel', (event) => {
  event.preventDefault();
  viewHeight = THREE.MathUtils.clamp(
    viewHeight * Math.exp(event.deltaY * 0.001),
    9.4,
    campaignEvaluationMode ? 50 : 24,
  );
  updateCamera();
}, { passive: false });

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 1000 ? 1 : 1.25));
  if (activePreset === 'overview') viewHeight = openingViewHeight();
  updateCamera();
});

const timer = new THREE.Timer();
timer.connect(document);
let elapsed = 0;
let diagnosticsElapsed = 0;
let diagnosticFrames = 0;
let diagnosticStateReads = 0;
let lastRenderedAt = 0;

function updateBillboards(delta: number): void {
  const follow = 1 - Math.exp(-delta * 13);
  for (const mesh of billboardMeshes) {
    mesh.quaternion.copy(camera.quaternion);
    if (typeof mesh.userData.targetX === 'number') {
      mesh.position.x = THREE.MathUtils.lerp(mesh.position.x, mesh.userData.targetX, follow);
      mesh.position.z = THREE.MathUtils.lerp(mesh.position.z, mesh.userData.targetZ, follow);
      const shadow = mesh.userData.shadow as THREE.Mesh | undefined;
      if (shadow) {
        shadow.position.x = mesh.position.x;
        shadow.position.z = mesh.position.z + 0.055;
      }
    }
    if (mesh.userData.actorState === 'dig') mesh.rotateZ(Math.sin(elapsed * 16) * 0.09);
  }
}

function animate(timestamp: number): void {
  requestAnimationFrame(animate);
  if (document.hidden) return;
  const renderInterval = 1000 / (simulationRunning || dragging ? 60 : 30);
  const sinceLastRender = timestamp - lastRenderedAt;
  if (sinceLastRender < renderInterval) return;
  lastRenderedAt = timestamp - (sinceLastRender % renderInterval);
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.05);
  elapsed += delta;
  diagnosticsElapsed += delta;

  if (simulationRunning && bridge) {
    simulationAccumulator += delta;
    while (simulationAccumulator >= 0.25) {
      simulationAccumulator -= 0.25;
      const result = bridge.api.step(5);
      if (!result.ok) {
        simulationRunning = false;
        setStatus('Simulationsschritt fehlgeschlagen', result.reason ?? 'Unbekannter Simulationsfehler.', 'error');
        break;
      }
      diagnosticStateReads += 1;
      syncState(result.state);
      if (!simulationRunning) break;
    }
  }

  updateBillboards(delta);
  renderer.render(scene, camera);
  diagnosticFrames += 1;
  if (diagnosticsElapsed >= 1) {
    if (drawOutput) {
      const fps = Math.round(diagnosticFrames / diagnosticsElapsed);
      const stateRate = (diagnosticStateReads / diagnosticsElapsed).toFixed(1);
      drawOutput.textContent = `${renderer.info.render.calls} Draws · ${fps} FPS · ${stateRate}/s State`;
    }
    diagnosticsElapsed = 0;
    diagnosticFrames = 0;
    diagnosticStateReads = 0;
  }
}

async function initialize(): Promise<void> {
  try {
    bridge = await connectGameSimulation(root);
    const canonicalState = bridge.state();
    const renderState = campaignEvaluationMode
      ? createCampaignEvaluationState(canonicalState)
      : canonicalState;
    root.dataset.phaserFrameLoop = canonicalState.frameLoopRunning ? 'running' : 'sleeping';
    root.dataset.stateContract = `AutomationState-v${canonicalState.version}`;
    syncState(renderState);
    if (campaignEvaluationMode) {
      bridge.frame.classList.add('is-contract-only');
      root.dataset.rooms = String(renderState.rooms.length);
      root.dataset.actors = String(renderState.workers.length + renderState.units.length + renderState.enemies.length);
      setStatus(
        'Großszene renderbereit',
        `${renderState.rooms.length} Räume · ${renderState.workers.length} Arbeiter · ${renderState.units.length} Truppen · ${renderState.enemies.length} Gegner`,
        'ready',
      );
    } else {
      if (startButton) startButton.disabled = false;
      setStatus('Echte Simulation verbunden', 'Starte den markierten Durchbruch zur Pilzgrotte.', 'ready');
    }
    root.dataset.ready = 'true';
    document.documentElement.dataset.prototypeReady = '3';
    document.querySelector('.prototype-loading')?.remove();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Verbindungsfehler.';
    setStatus('Simulation nicht verfügbar', message, 'error');
    root.dataset.ready = 'error';
    document.querySelector('.prototype-loading')?.remove();
  }
}

window.addEventListener('beforeunload', () => {
  bridge?.dispose();
  timer.dispose();
  renderer.dispose();
}, { once: true });

const requestedView = new URLSearchParams(window.location.search).get('view');
setPreset(requestedView && requestedView in presets ? requestedView as ViewPreset : 'overview');
requestAnimationFrame(animate);
void initialize();
