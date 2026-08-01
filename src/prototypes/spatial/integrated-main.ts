import * as THREE from 'three';
import type { AutomationState } from '../../core/AutomationBridge';
import { connectGameSimulation, type GameSimulationBridge } from './GameSimulationBridge';
import {
  FUNGUS_CHAMBER,
  FUNGUS_TILE,
  HEART_TILE,
  INTEGRATION_SLICE,
  TUTORIAL_ROUTE,
  knownTileMap,
  mapToWorld,
  snapshotToSpatialCells,
  terrainSignature,
  tileKey,
  tutorialRouteProgress,
  type IntegratedCell,
} from './IntegrationModel';
import { buildBoundaryRuns, type BoundaryRun } from './layout';
import './integrated-style.css';

type ViewPreset = 'overview' | 'heart' | 'grotto' | 'occlusion';

const rootElement = document.querySelector<HTMLElement>('#spatial-prototype');
const canvasHostElement = document.querySelector<HTMLElement>('#prototype-canvas');
if (!rootElement || !canvasHostElement) throw new Error('Spatial integration host is missing.');
const root: HTMLElement = rootElement;
const canvasHost: HTMLElement = canvasHostElement;

document.documentElement.dataset.integration = 'spatial-v2';

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071427);
scene.fog = new THREE.FogExp2(0x071427, 0.0065);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 1000 ? 1 : 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.shadowMap.needsUpdate = true;
canvasHost.append(renderer.domElement);

const camera = new THREE.OrthographicCamera(-16, 16, 9, -9, 0.1, 100);
camera.up.set(0, 1, 0);
const cameraOffset = new THREE.Vector3(0, 29, 7.5);
const cameraTarget = new THREE.Vector3(-2.4, 0, -0.8);

function openingCameraZoom(): number {
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
): THREE.MeshStandardMaterial {
  const map = textureLoader.load(asset(path));
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.LinearFilter;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.anisotropy = maxAnisotropy;
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map,
    roughness,
    metalness: 0.01,
    emissive,
    emissiveIntensity,
  });
}

const floorMaterials = {
  built: surfaceMaterial('assets/generated/style-b-v3/terrain/claimed-floor.png', 0.82),
  raw: surfaceMaterial('assets/generated/style-b-v3/terrain/raw-floor.png', 0.96, 0x122d4d, 0.35),
  claimed: surfaceMaterial('assets/generated/style-b-v3/terrain/claimed-corridor.png', 0.98, 0x18385e, 0.65),
  natural: surfaceMaterial('assets/generated/style-b-v3/terrain/damp-floor.png', 0.88, 0x0b312d, 0.18),
};
const rockTopMaterial = surfaceMaterial('assets/generated/style-b-v3/terrain/rock-top.png', 0.94);

const material = {
  bedrock: new THREE.MeshStandardMaterial({ color: 0x071426, roughness: 1 }),
  rockBody: new THREE.MeshStandardMaterial({ color: 0x0d2d50, roughness: 0.96 }),
  builtFace: new THREE.MeshStandardMaterial({ color: 0x442f47, roughness: 0.78 }),
  builtCap: new THREE.MeshStandardMaterial({ color: 0xbcb49c, roughness: 0.74 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xd8a532, metalness: 0.48, roughness: 0.42 }),
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
    INTEGRATION_SLICE.maxX - INTEGRATION_SLICE.minX + 1 + rockMargin.x * 2,
    0.18,
    INTEGRATION_SLICE.maxY - INTEGRATION_SLICE.minY + 1 + rockMargin.y * 2,
  ),
  material.bedrock,
);
const bedrockCenter = mapToWorld(
  (INTEGRATION_SLICE.minX + INTEGRATION_SLICE.maxX) / 2,
  (INTEGRATION_SLICE.minY + INTEGRATION_SLICE.maxY) / 2,
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
  if (cell.zone === 'natural') return 'natural';
  return cell.control === 'owned' || cell.control === 'claiming' ? 'claimed' : 'raw';
}

function wallMatrices(runs: BoundaryRun[]): {
  body: THREE.Matrix4[];
  cap: THREE.Matrix4[];
  brass: THREE.Matrix4[];
  foregroundBody: THREE.Matrix4[];
  foregroundCap: THREE.Matrix4[];
  foregroundBrass: THREE.Matrix4[];
} {
  const result = {
    body: [] as THREE.Matrix4[],
    cap: [] as THREE.Matrix4[],
    brass: [] as THREE.Matrix4[],
    foregroundBody: [] as THREE.Matrix4[],
    foregroundCap: [] as THREE.Matrix4[],
    foregroundBrass: [] as THREE.Matrix4[],
  };
  const height = 0.76;
  const thickness = 0.28;

  for (const run of runs.filter((candidate) => candidate.zone === 'built')) {
    const alongX = run.axis === 'x';
    const x = alongX ? (run.start + run.end) / 2 : run.constant;
    const z = alongX ? run.constant : (run.start + run.end) / 2;
    const width = alongX ? run.length + 0.035 : thickness;
    const depth = alongX ? thickness : run.length + 0.035;
    const foreground = run.side === 'south';
    const body = foreground ? result.foregroundBody : result.body;
    const cap = foreground ? result.foregroundCap : result.cap;
    const brass = foreground ? result.foregroundBrass : result.brass;

    body.push(matrixAt(x, height / 2, z, width, height, depth));
    cap.push(matrixAt(x, height + 0.035, z, width + 0.08, 0.14, depth + 0.08));

    const clampCount = Math.max(1, Math.floor(run.length / 3.2));
    for (let index = 1; index <= clampCount; index += 1) {
      const along = run.start + (run.length * index) / (clampCount + 1);
      brass.push(matrixAt(
        alongX ? along : x,
        height + 0.055,
        alongX ? z : along,
        alongX ? 0.15 : thickness + 0.1,
        0.23,
        alongX ? thickness + 0.1 : 0.15,
      ));
    }
  }
  return result;
}

function rebuildTerrain(state: AutomationState): void {
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

  const cells = snapshotToSpatialCells(state);
  const openMap = new Map(cells.map((cell) => [tileKey(cell.mapX, cell.mapY), cell]));
  const rockBodies: THREE.Matrix4[] = [];
  const rockTops: SurfaceTile[] = [];
  const floorBuckets: Record<keyof typeof floorMaterials, SurfaceTile[]> = {
    built: [],
    raw: [],
    claimed: [],
    natural: [],
  };

  for (let mapY = INTEGRATION_SLICE.minY - rockMargin.y; mapY <= INTEGRATION_SLICE.maxY + rockMargin.y; mapY += 1) {
    for (let mapX = INTEGRATION_SLICE.minX - rockMargin.x; mapX <= INTEGRATION_SLICE.maxX + rockMargin.x; mapX += 1) {
      const worldPosition = mapToWorld(mapX, mapY);
      const openCell = openMap.get(tileKey(mapX, mapY));
      const surface = { ...worldPosition, mapX, mapY };
      if (!openCell) {
        rockBodies.push(matrixAt(worldPosition.x, 0.13, worldPosition.z, 1.025, 0.38, 1.025));
        rockTops.push(surface);
        continue;
      }
      const floorKind = classifyFloor(openCell);
      floorBuckets[floorKind].push(surface);
    }
  }

  addInstances(unitBox, material.rockBody, rockBodies, dynamicTerrain, { cast: true, receive: true });
  addTiledSurface(rockTops, rockTopMaterial, 0.325, dynamicTerrain);

  (Object.keys(floorBuckets) as Array<keyof typeof floorBuckets>).forEach((kind) => {
    addTiledSurface(floorBuckets[kind], floorMaterials[kind], 0.015, dynamicTerrain);
  });

  const runs = buildBoundaryRuns(cells);
  const walls = wallMatrices(runs);
  addInstances(unitBox, material.builtFace, walls.body, dynamicTerrain, { cast: true });
  addInstances(unitBox, material.builtCap, walls.cap, dynamicTerrain, { cast: true });
  addInstances(unitBox, material.brass, walls.brass, dynamicTerrain, { cast: true });
  addInstances(unitBox, material.builtFace, walls.foregroundBody, foregroundWalls, { cast: true });
  addInstances(unitBox, material.builtCap, walls.foregroundCap, foregroundWalls, { cast: true });
  addInstances(unitBox, material.brass, walls.foregroundBrass, foregroundWalls, { cast: true });

  const tileMap = knownTileMap(state);
  const thresholdOpen = tileMap.get(tileKey(40, 34))?.geology === 'excavated';
  if (thresholdOpen) {
    const doorway = mapToWorld(39.5, 34);
    addInstances(unitBox, material.brass, [matrixAt(doorway.x, 0.07, doorway.z, 0.13, 0.1, 0.82)], dynamicTerrain);
  }

  const closedRoute = TUTORIAL_ROUTE.solidCells.filter(
    (point) => tileMap.get(tileKey(point.x, point.y))?.geology !== 'excavated',
  );
  addInstances(
    markerTile,
    material.route,
    closedRoute.map((point) => {
      const position = mapToWorld(point.x, point.y);
      return matrixAt(position.x, 0.337, position.z);
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
  depthWrite?: boolean;
}

function createBillboard(path: string, options: BillboardOptions): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(options.width, options.height);
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
  const position = mapToWorld(options.mapX, options.mapY);
  mesh.position.set(position.x, options.lift ?? Math.min(0.72, options.height * 0.12), position.z + (options.depthOffset ?? 0));
  mesh.quaternion.copy(camera.quaternion);
  mesh.renderOrder = options.renderOrder ?? 10;
  mesh.userData.baseMapX = options.mapX;
  mesh.userData.baseMapY = options.mapY;
  mesh.userData.baseLift = mesh.position.y;
  world.add(mesh);
  billboardMeshes.push(mesh);

  if (options.shadow) {
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(Math.max(0.18, options.width * 0.28), 22),
      new THREE.MeshBasicMaterial({ color: 0x020714, transparent: true, opacity: 0.42, depthWrite: false }),
    );
    shadow.position.set(position.x, 0.04, position.z + 0.12);
    shadow.rotation.x = -Math.PI / 2;
    world.add(shadow);
    mesh.userData.shadow = shadow;
  }
  return mesh;
}

function addHeartHeadquarters(): void {
  const cx = HEART_TILE.x;
  const cy = HEART_TILE.y;
  const shadowPosition = mapToWorld(cx, cy + 1.55);
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(2.85, 32),
    new THREE.MeshBasicMaterial({ color: 0x020511, transparent: true, opacity: 0.36, depthWrite: false }),
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

function actorAsset(kind: string): string {
  if (kind === 'guard') return 'assets/generated/style-b-v2/characters/guard.png';
  if (kind === 'archer') return 'assets/generated/style-b-v2/characters/archer.png';
  return 'assets/generated/style-b-v2/characters/worker.png';
}

function syncActors(state: AutomationState): void {
  const actors = [
    ...state.workers.map((worker) => ({ key: `worker:${worker.id}`, kind: 'worker', ...worker })),
    ...state.units.map((unit) => ({ key: `unit:${unit.id}`, state: 'unit', ...unit })),
  ];
  const active = new Set<string>();

  for (const actor of actors) {
    active.add(actor.key);
    let mesh = actorMeshes.get(actor.key);
    if (!mesh) {
      const size = actor.kind === 'worker' ? 58 / 32 : actor.kind === 'guard' ? 46 / 32 : 45 / 32;
      mesh = createBillboard(actorAsset(actor.kind), {
        mapX: actor.x,
        mapY: actor.y,
        width: size,
        height: size,
        lift: 0.23,
        renderOrder: 25,
        shadow: true,
      });
      actorMeshes.set(actor.key, mesh);
    }
    const position = mapToWorld(actor.x, actor.y);
    mesh.userData.targetX = position.x;
    mesh.userData.targetZ = position.z;
    mesh.userData.actorState = actor.state;
  }

  for (const [key, mesh] of actorMeshes) mesh.visible = active.has(key);
}

scene.add(new THREE.HemisphereLight(0x91b2ce, 0x07101c, 1.45));
scene.add(new THREE.AmbientLight(0x26354b, 1.05));

const keyLight = new THREE.DirectionalLight(0xffe0ae, 2.1);
keyLight.position.set(-13, 22, 11);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -23;
keyLight.shadow.camera.right = 23;
keyLight.shadow.camera.top = 15;
keyLight.shadow.camera.bottom = -15;
keyLight.shadow.bias = -0.0004;
scene.add(keyLight, keyLight.target);

const heartWorld = mapToWorld(HEART_TILE.x, HEART_TILE.y);
const heartLight = new THREE.PointLight(0xffaa45, 40, 13, 1.65);
heartLight.position.set(heartWorld.x, 4.1, heartWorld.z);
scene.add(heartLight);

const grottoWorld = mapToWorld(FUNGUS_TILE.x, FUNGUS_TILE.y);
const grottoLight = new THREE.PointLight(0x58e3bf, 46, 13, 1.62);
grottoLight.position.set(grottoWorld.x, 4.2, grottoWorld.z);
scene.add(grottoLight);

const ui = document.createElement('div');
ui.className = 'integration-ui';
ui.innerHTML = `
  <div class="integration-badge"><i></i> Spatial Renderer V2 · echte Simulation</div>
  <section class="integration-panel" aria-labelledby="integration-title">
    <span class="integration-kicker">Nächster Integrationsschritt</span>
    <h2 id="integration-title">Realer Grottendurchbruch</h2>
    <p>Der sichtbare Renderer liest Karte, Arbeiter, Jobs und Grabungsfortschritt aus dem echten laufenden Spiel.</p>
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
      <button type="button" data-view="grotto">Grotte</button>
      <button type="button" data-view="occlusion">Verdeckung</button>
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

const presets: Record<ViewPreset, { x: number; z: number; height: number }> = {
  overview: { x: -2.4, z: -0.8, height: openingViewHeight() },
  heart: { x: -7.7, z: -0.8, height: 13.4 },
  grotto: { x: 10.8, z: 1.1, height: 11.8 },
  occlusion: { x: -7.7, z: 2.3, height: 10.8 },
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

function syncState(state: AutomationState): void {
  const signature = terrainSignature(state);
  if (signature !== latestTerrainSignature) {
    latestTerrainSignature = signature;
    rebuildTerrain(state);
  }
  syncActors(state);

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
  viewHeight = THREE.MathUtils.clamp(viewHeight * Math.exp(event.deltaY * 0.001), 9.4, 24);
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
        shadow.position.z = mesh.position.z + 0.12;
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
    const state = bridge.state();
    root.dataset.phaserFrameLoop = state.frameLoopRunning ? 'running' : 'sleeping';
    syncState(state);
    if (startButton) startButton.disabled = false;
    setStatus('Echte Simulation verbunden', 'Starte den markierten Durchbruch zur Pilzgrotte.', 'ready');
    root.dataset.ready = 'true';
    document.documentElement.dataset.prototypeReady = '2';
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

setPreset('overview');
requestAnimationFrame(animate);
void initialize();
