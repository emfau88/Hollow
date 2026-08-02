import * as THREE from 'three';
import { resolveVisualTheme } from '../../config/VisualTheme';
import { ROOM_DEFINITIONS, type RoomKind } from '../../data/definitions';
import { bedroomCapacity, prisonCapacity, productionStations } from '../../core/GameRules';
import {
  boundaryVertices,
  buildBoundaryEdges,
  findOpenPath,
  proofCellKey,
  type BoundaryEdge,
  type ProofCell,
} from './GeometryProofModel';
import {
  SANDBOX_BOUNDS,
  SANDBOX_DISCOVERY_SITES,
  SANDBOX_HEART,
  SANDBOX_START,
  advanceSandboxClaiming,
  advanceSandboxDigging,
  advanceSandboxMining,
  canDigSandboxCell,
  canPlanSandboxCell,
  createSandboxState,
  deliverSandboxResource,
  excavateSandboxChamber,
  normalizedRect,
  nextSandboxClaimTarget,
  planSandboxDigCell,
  placeSandboxRoom,
  remainingDepositUnits,
  sandboxBedCapacity,
  sandboxPrisonCapacity,
  storageCapacity,
  sandboxRoomComplete,
  summonSandboxWorker,
  tickSandboxEconomy,
  validateSandboxRoom,
  workerCapacity,
  type SandboxActionResult,
  type SandboxDiscoverySite,
  type SandboxRoom,
} from './GeometrySandboxModel';
import {
  createProceduralWallAssets,
  type ProceduralWallStyle,
} from './ProceduralWallAssets';
import './geometry-proof-style.css';

type SurfaceStyle = ProceduralWallStyle;
type SandboxTool = 'pan' | 'dig' | 'chamber' | `room-${RoomKind}`;

const rootElement = document.querySelector<HTMLElement>('#geometry-proof');
const canvasHostElement = document.querySelector<HTMLElement>('#geometry-canvas');
if (!rootElement || !canvasHostElement) throw new Error('Geometry sandbox host is missing.');
const root = rootElement;
const canvasHost = canvasHostElement;

const theme = resolveVisualTheme('?theme=style-b');
const mobileProfile = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10283a);
scene.fog = new THREE.FogExp2(0x10283a, 0.006);

const renderer = new THREE.WebGLRenderer({ antialias: !mobileProfile, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.shadowMap.enabled = !mobileProfile;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobileProfile ? 1 : 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
canvasHost.append(renderer.domElement);

const camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 100);
const cameraTarget = new THREE.Vector3(SANDBOX_START.x, 0, SANDBOX_START.z);
const cameraOffset = new THREE.Vector3(0, 17.5, 10.5);
let viewHeight = mobileProfile ? 15 : 20;

function reservedPanelWidth(): number {
  return 0;
}

function clampCameraTarget(): void {
  cameraTarget.x = THREE.MathUtils.clamp(cameraTarget.x, SANDBOX_BOUNDS.minX, SANDBOX_BOUNDS.maxX + 1);
  cameraTarget.z = THREE.MathUtils.clamp(cameraTarget.z, SANDBOX_BOUNDS.minZ, SANDBOX_BOUNDS.maxZ + 1);
}

function updateCamera(): void {
  clampCameraTarget();
  const aspect = Math.max(0.25, window.innerWidth / Math.max(1, window.innerHeight));
  const width = viewHeight * aspect;
  const shift = (reservedPanelWidth() / Math.max(1, window.innerWidth)) * width / 2;
  camera.left = -width / 2 + shift;
  camera.right = width / 2 + shift;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.position.copy(cameraTarget).add(cameraOffset);
  camera.lookAt(cameraTarget);
  camera.updateProjectionMatrix();
}

function asset(path: string): string {
  return new URL(path, document.baseURI).href;
}

const loader = new THREE.TextureLoader();
async function loadMap(path: string, repeat = { x: 1, y: 1 }): Promise<THREE.Texture> {
  const texture = await loader.loadAsync(asset(path));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeat.x, repeat.y);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

const terrainRoot = theme.assets.terrain;
const heartBuilding = theme.assets.heartBuilding;
const [
  floorMap,
  corridorMap,
  rawFloorMap,
  dampFloorMap,
  rockMap,
  rockBasaltMap,
  rockRootsMap,
  rockDampMap,
  rockEarthMap,
  workerMap,
  heartBackplateMap,
  heartCoreMap,
  heartBezelMap,
  heartPulpitMap,
  ironMap,
  fungusMap,
  storageMap,
  bedMap,
  cauldronMap,
  furnaceMap,
  workbenchMap,
  prisonMap,
  generatedWallSideMap,
  generatedWallCapMap,
  fungusGrottoMap,
  ironMineHeroMap,
  fungusMediumMap,
  fungusSmallMap,
  grottoStationMap,
  suppliesMap,
  cartMap,
  rackMap,
  lampMap,
  bannerMap,
  mossMap,
  sporesMap,
  puddleMap,
  rubbleMap,
] = await Promise.all([
  loadMap(`${terrainRoot}/claimed-floor.png`),
  loadMap(`${terrainRoot}/claimed-corridor.png`),
  loadMap(`${terrainRoot}/raw-floor.png`),
  loadMap(theme.assets.dampFloor ?? `${terrainRoot}/raw-floor.png`),
  loadMap(`${terrainRoot}/rock-top.png`, { x: 24, y: 16 }),
  loadMap(`${terrainRoot}/rock-basalt.png`, { x: 1.25, y: 1.25 }),
  loadMap(`${terrainRoot}/rock-roots.png`, { x: 1.25, y: 1.25 }),
  loadMap(`${terrainRoot}/rock-damp.png`, { x: 1.25, y: 1.25 }),
  loadMap(`${terrainRoot}/rock-earth.png`, { x: 1.25, y: 1.25 }),
  loadMap(theme.assets.workerAnimation ?? theme.assets.worker),
  loadMap(heartBuilding?.backplate ?? theme.assets.heart),
  loadMap(heartBuilding?.core ?? theme.assets.heart),
  loadMap(heartBuilding?.bezel ?? theme.assets.heart),
  loadMap(heartBuilding?.pulpit ?? theme.assets.heart),
  loadMap(theme.assets.resources.iron),
  loadMap(theme.assets.resources.fungus),
  loadMap(theme.assets.props.storage),
  loadMap('assets/generated/room-props-v3/bed.png'),
  loadMap(theme.assets.props.cauldron),
  loadMap('assets/generated/room-props-v3/furnace.png'),
  loadMap(theme.assets.props.workbench),
  loadMap('assets/generated/room-props-v3/prison-gate.png'),
  loadMap('assets/generated/geometry-sandbox-v2/walls/wall-side-masonry-v1.png', { x: 0.5, y: 0.5 }),
  loadMap('assets/generated/geometry-sandbox-v2/walls/wall-cap-limestone-v1.png', { x: 0.42, y: 0.42 }),
  loadMap('assets/generated/fungus-grotto.png'),
  loadMap('assets/generated/geometry-sandbox-v2/environment/iron-mine-hero-v1.png'),
  loadMap('assets/generated/style-b-v2/decor/fungus-medium.png'),
  loadMap('assets/generated/style-b-v2/decor/fungus-small.png'),
  loadMap('assets/generated/style-b-v2/decor/grotto-station.png'),
  loadMap('assets/generated/style-b-v2/decor/supplies.png'),
  loadMap('assets/generated/style-b-v2/decor/cart.png'),
  loadMap('assets/generated/style-b-v2/decor/rack.png'),
  loadMap('assets/generated/style-b-v2/decor/lamp.png'),
  loadMap('assets/generated/style-b-v2/decor/banner.png'),
  loadMap('assets/generated/style-b-v3/decals/moss.png'),
  loadMap('assets/generated/style-b-v3/decals/spores.png'),
  loadMap('assets/generated/style-b-v3/decals/puddle.png'),
  loadMap('assets/generated/style-b-v3/decals/rubble.png'),
]);

const pixelMaps = [
  workerMap, heartBackplateMap, heartCoreMap, heartBezelMap, heartPulpitMap,
  ironMap, fungusMap, storageMap, bedMap, cauldronMap, furnaceMap, workbenchMap, prisonMap,
  fungusGrottoMap, ironMineHeroMap, fungusMediumMap, fungusSmallMap, grottoStationMap, suppliesMap,
  cartMap, rackMap, lampMap, bannerMap, mossMap, sporesMap, puddleMap, rubbleMap,
];
for (const map of pixelMaps) {
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.NearestMipmapLinearFilter;
}
const workerAnimated = Boolean(theme.assets.workerAnimation);
if (workerAnimated) {
  workerMap.repeat.set(1 / 4, 1 / 6);
  workerMap.offset.set(0, 5 / 6);
}

function standardMaterial(options: { color: number; map?: THREE.Texture; roughness?: number; metalness?: number }): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: options.color,
    map: options.map,
    roughness: options.roughness ?? 0.82,
    metalness: options.metalness ?? 0.02,
  });
}

const floorMaterials = {
  start: standardMaterial({ color: 0xd7c9bb, map: floorMap, roughness: 0.84 }),
  claimed: standardMaterial({ color: 0xd0c4b8, map: corridorMap, roughness: 0.9 }),
  raw: standardMaterial({ color: 0x829aaa, map: rawFloorMap, roughness: 0.98 }),
  cavern: standardMaterial({ color: 0x70a18c, map: dampFloorMap, roughness: 0.98 }),
};
const bedrockMaterial = standardMaterial({ color: 0x56778d, map: rockMap, roughness: 0.98 });
const geologyMaterials = {
  basalt: standardMaterial({ color: 0x8da4b6, map: rockBasaltMap, roughness: 1 }),
  roots: standardMaterial({ color: 0x8f887c, map: rockRootsMap, roughness: 1 }),
  damp: standardMaterial({ color: 0x83b6a0, map: rockDampMap, roughness: 1 }),
  earth: standardMaterial({ color: 0xaa8975, map: rockEarthMap, roughness: 1 }),
};
const closedRockMaterials = [
  standardMaterial({ color: 0x91aabd, map: rockBasaltMap, roughness: 1 }),
  standardMaterial({ color: 0x789b8c, map: rockDampMap, roughness: 1 }),
  standardMaterial({ color: 0xa17f70, map: rockEarthMap, roughness: 1 }),
  standardMaterial({ color: 0x8a9088, map: rockRootsMap, roughness: 1 }),
];
bedrockMaterial.emissive.setHex(0x243946);
bedrockMaterial.emissiveIntensity = 0.42;
const closedRockGlow = [0x354954, 0x2f4a3f, 0x513a31, 0x3d433d];
closedRockMaterials.forEach((material, index) => {
  material.emissive.setHex(closedRockGlow[index]);
  material.emissiveIntensity = 0.46;
});
for (const material of Object.values(geologyMaterials)) {
  material.transparent = true;
  material.opacity = 0.72;
  material.depthWrite = false;
}
const wallAssets = createProceduralWallAssets();
type WallFamily = { side: THREE.MeshStandardMaterial; cap: THREE.MeshStandardMaterial; base: THREE.MeshStandardMaterial; post: THREE.MeshStandardMaterial };
const wallFamilies: Record<SurfaceStyle, WallFamily> = {
  clean: {
    side: standardMaterial({ color: 0xffffff, map: generatedWallSideMap, roughness: 0.86 }),
    cap: standardMaterial({ color: 0xffffff, map: generatedWallCapMap, roughness: 0.78 }),
    base: standardMaterial({ color: 0xb8aa99, map: generatedWallCapMap, roughness: 0.9 }),
    post: standardMaterial({ color: 0xd1c4b2, map: generatedWallCapMap, roughness: 0.82 }),
  },
  project: {
    side: standardMaterial({ color: 0x90a6c1, map: generatedWallSideMap, roughness: 0.88 }),
    cap: standardMaterial({ color: 0xc6b487, map: generatedWallCapMap, roughness: 0.8 }),
    base: standardMaterial({ color: 0x8a734d, map: generatedWallCapMap, roughness: 0.94 }),
    post: standardMaterial({ color: 0xc39a43, map: generatedWallCapMap, roughness: 0.72, metalness: 0.08 }),
  },
  natural: {
    side: standardMaterial({ color: 0xffffff, map: wallAssets.natural.side, roughness: 0.98 }),
    cap: standardMaterial({ color: 0xffffff, map: wallAssets.natural.cap, roughness: 0.92 }),
    base: standardMaterial({ color: 0x15333e, roughness: 1 }),
    post: standardMaterial({ color: 0x426c69, roughness: 0.98 }),
  },
};
const foregroundFamilies = Object.fromEntries(
  (Object.keys(wallFamilies) as SurfaceStyle[]).map((key) => {
    const family = Object.fromEntries(
      (Object.keys(wallFamilies[key]) as Array<keyof WallFamily>).map((part) => {
        const material = wallFamilies[key][part].clone();
        material.transparent = true;
        material.opacity = 0.68;
        material.depthWrite = false;
        return [part, material];
      }),
    ) as WallFamily;
    return [key, family];
  }),
) as Record<SurfaceStyle, WallFamily>;

const world = new THREE.Group();
scene.add(world);
const mapWidth = SANDBOX_BOUNDS.maxX - SANDBOX_BOUNDS.minX + 1;
const mapHeight = SANDBOX_BOUNDS.maxZ - SANDBOX_BOUNDS.minZ + 1;
const mapCenterX = SANDBOX_BOUNDS.minX + mapWidth / 2;
const mapCenterZ = SANDBOX_BOUNDS.minZ + mapHeight / 2;
const bedrock = new THREE.Mesh(new THREE.PlaneGeometry(mapWidth, mapHeight).rotateX(-Math.PI / 2), bedrockMaterial);
bedrock.position.set(mapCenterX, -0.055, mapCenterZ);
bedrock.receiveShadow = true;
world.add(bedrock);

function irregularPatchGeometry(radius: number, seed: number): THREE.ShapeGeometry {
  let value = seed >>> 0;
  const random = (): number => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
  const shape = new THREE.Shape();
  const points = Array.from({ length: 14 }, (_, index) => {
    const angle = (index / 14) * Math.PI * 2;
    const localRadius = radius * (0.76 + random() * 0.3);
    return new THREE.Vector2(Math.cos(angle) * localRadius, Math.sin(angle) * localRadius);
  });
  shape.moveTo(points[0].x, points[0].y);
  points.slice(1).forEach((point) => shape.lineTo(point.x, point.y));
  shape.closePath();
  return new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
}

const geologyGroup = new THREE.Group();
for (const patch of [
  { x: 18, z: 25, r: 4.2, material: geologyMaterials.basalt, seed: 11 },
  { x: 30, z: 20, r: 5.2, material: geologyMaterials.basalt, seed: 21 },
  { x: 40, z: 10, r: 5.4, material: geologyMaterials.basalt, seed: 31 },
  { x: 15, z: 8, r: 4.4, material: geologyMaterials.earth, seed: 41 },
  { x: 35, z: 28, r: 4.6, material: geologyMaterials.earth, seed: 51 },
  { x: 23, z: 13, r: 6.1, material: geologyMaterials.damp, seed: 61 },
  { x: 42, z: 24, r: 5.3, material: geologyMaterials.damp, seed: 71 },
  { x: 9, z: 13, r: 5.2, material: geologyMaterials.roots, seed: 81 },
] as const) {
  const mesh = new THREE.Mesh(irregularPatchGeometry(patch.r, patch.seed), patch.material);
  mesh.position.set(patch.x + 0.5, -0.045, patch.z + 0.5);
  mesh.receiveShadow = true;
  geologyGroup.add(mesh);
}
world.add(geologyGroup);

const digPlane = new THREE.Mesh(
  new THREE.PlaneGeometry(mapWidth, mapHeight).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true, opacity: 0, side: THREE.DoubleSide }),
);
digPlane.position.set(mapCenterX, 0.09, mapCenterZ);
world.add(digPlane);

const tileGeometry = new THREE.PlaneGeometry(1.01, 1.01).rotateX(-Math.PI / 2);
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const naturalRockGeometry = new THREE.DodecahedronGeometry(0.5, 0);
const closedRockGeometries = [
  naturalRockGeometry,
  new THREE.IcosahedronGeometry(0.5, 0),
  new THREE.OctahedronGeometry(0.5, 1),
];
const lightOrbGeometry = new THREE.SphereGeometry(0.11, 10, 8);
const actorShadowGeometry = new THREE.CircleGeometry(0.42, 24).rotateX(-Math.PI / 2);
const selectionGeometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const resourceGeometry = new THREE.PlaneGeometry(1, 1);
const resourceFacing = new THREE.Quaternion().setFromUnitVectors(
  new THREE.Vector3(0, 0, 1),
  cameraOffset.clone().normalize(),
);
const selectionMaterial = new THREE.MeshBasicMaterial({ color: 0x63d9ad, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
const plannedDigMaterial = new THREE.MeshBasicMaterial({ color: 0xd9aa3a, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide });
const plannedRoomMaterial = new THREE.MeshBasicMaterial({ color: 0xb58b3d, transparent: true, opacity: 0.24, depthWrite: false, side: THREE.DoubleSide });
const selectionPreview = new THREE.Mesh(selectionGeometry, selectionMaterial);
selectionPreview.visible = false;
world.add(selectionPreview);

const brassDetailMaterial = standardMaterial({ color: 0xc79838, roughness: 0.48, metalness: 0.34 });
const warmLightMaterial = new THREE.MeshStandardMaterial({
  color: 0xffc44d,
  emissive: 0xff8a18,
  emissiveIntensity: 4.2,
  roughness: 0.32,
  metalness: 0.04,
});
const fungusLightMaterial = new THREE.MeshStandardMaterial({
  color: 0x72e6c6,
  emissive: 0x21d7ad,
  emissiveIntensity: 3.4,
  roughness: 0.5,
});

function matrixAt(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
}

function addInstances(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  matrices: THREE.Matrix4[],
  parent: THREE.Object3D,
  castShadow = false,
): THREE.InstancedMesh | undefined {
  if (matrices.length === 0) return undefined;
  const mesh = new THREE.InstancedMesh(geometry, material, matrices.length);
  matrices.forEach((matrix, index) => mesh.setMatrixAt(index, matrix));
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function spriteMaterial(map: THREE.Texture): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({ map, transparent: true, alphaTest: 0.035, depthTest: true, depthWrite: false, toneMapped: false });
}

function addSprite(
  parent: THREE.Object3D,
  material: THREE.SpriteMaterial,
  x: number,
  y: number,
  z: number,
  width: number,
  height = width,
  renderOrder = 0,
): THREE.Sprite {
  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, y, z);
  sprite.scale.set(width, height, 1);
  sprite.renderOrder = renderOrder;
  parent.add(sprite);
  return sprite;
}

const spriteMaterials = {
  heartBackplate: spriteMaterial(heartBackplateMap),
  heartCore: spriteMaterial(heartCoreMap),
  heartBezel: spriteMaterial(heartBezelMap),
  heartPulpit: spriteMaterial(heartPulpitMap),
  storage: spriteMaterial(storageMap),
  bedroom: spriteMaterial(bedMap),
  kitchen: spriteMaterial(cauldronMap),
  smelter: spriteMaterial(furnaceMap),
  workshop: spriteMaterial(workbenchMap),
  prison: spriteMaterial(prisonMap),
  fungusGrotto: spriteMaterial(fungusGrottoMap),
  ironMineHero: spriteMaterial(ironMineHeroMap),
  fungusMedium: spriteMaterial(fungusMediumMap),
  fungusSmall: spriteMaterial(fungusSmallMap),
  grottoStation: spriteMaterial(grottoStationMap),
  supplies: spriteMaterial(suppliesMap),
  cart: spriteMaterial(cartMap),
  rack: spriteMaterial(rackMap),
  lamp: spriteMaterial(lampMap),
  banner: spriteMaterial(bannerMap),
};
const resourceMaterials = {
  iron: new THREE.MeshBasicMaterial({ map: ironMap, transparent: true, alphaTest: 0.035, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  fungus: new THREE.MeshBasicMaterial({ map: fungusMap, transparent: true, alphaTest: 0.035, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
};
const hintMaterials = {
  iron: new THREE.SpriteMaterial({ map: ironMap, color: 0xffd47a, transparent: true, opacity: 0.78, alphaTest: 0.02, depthWrite: false, toneMapped: false }),
  fungus: new THREE.SpriteMaterial({ map: fungusMap, color: 0x8fffd7, transparent: true, opacity: 0.82, alphaTest: 0.02, depthWrite: false, toneMapped: false }),
  ironMine: new THREE.SpriteMaterial({ map: ironMineHeroMap, color: 0xb8c7d6, transparent: true, opacity: 0.82, alphaTest: 0.02, depthWrite: false, toneMapped: false }),
  fungusGrotto: new THREE.SpriteMaterial({ map: fungusGrottoMap, color: 0xa8e4b2, transparent: true, opacity: 0.86, alphaTest: 0.02, depthWrite: false, toneMapped: false }),
};
const cargoMaterials = {
  ore: new THREE.SpriteMaterial({ map: ironMap, transparent: true, alphaTest: 0.035, depthWrite: false, toneMapped: false }),
  biomass: new THREE.SpriteMaterial({ map: fungusMap, transparent: true, alphaTest: 0.035, depthWrite: false, toneMapped: false }),
};
const decalMaterials = {
  moss: new THREE.MeshBasicMaterial({ map: mossMap, transparent: true, alphaTest: 0.035, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  spores: new THREE.MeshBasicMaterial({ map: sporesMap, transparent: true, alphaTest: 0.035, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  puddle: new THREE.MeshBasicMaterial({ map: puddleMap, transparent: true, alphaTest: 0.035, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  rubble: new THREE.MeshBasicMaterial({ map: rubbleMap, transparent: true, alphaTest: 0.035, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
};

const heartX = SANDBOX_HEART.x + 0.5;
const heartZ = SANDBOX_HEART.z + 0.5;
const heartPlinth = new THREE.Mesh(
  new THREE.CylinderGeometry(1, 1.18, 0.2, 12),
  standardMaterial({ color: 0x283246, roughness: 0.78, metalness: 0.08 }),
);
heartPlinth.position.set(heartX, 0.11, heartZ);
heartPlinth.scale.set(1.35, 1, 0.95);
heartPlinth.castShadow = !mobileProfile;
heartPlinth.receiveShadow = true;
world.add(heartPlinth);
// Match the source setpiece ratios. The baked room-base image is intentionally
// omitted because the reserved heart floor is real geometry in this renderer.
addSprite(world, spriteMaterials.heartBackplate, heartX, 1.16, heartZ - 0.08, 2.65, 2.65, 10);
addSprite(world, spriteMaterials.heartCore, heartX, 1.16, heartZ, 1.06, 1.06, 11);
addSprite(world, spriteMaterials.heartBezel, heartX, 1.16, heartZ + 0.03, 1.4, 1.4, 12);
addSprite(world, spriteMaterials.heartPulpit, heartX, 0.47, heartZ + 0.24, 1.86, 1.27, 13);

interface WorkerVisual {
  sprite: THREE.Sprite;
  shadow: THREE.Mesh;
  cargo: THREE.Sprite;
  map: THREE.Texture;
}
const workerVisuals: WorkerVisual[] = [];
function ensureWorkerVisuals(targetCount: number): void {
  while (workerVisuals.length < targetCount) {
    const index = workerVisuals.length;
    const map = index === 0 ? workerMap : workerMap.clone();
    map.needsUpdate = true;
    if (workerAnimated) {
      map.repeat.set(1 / 4, 1 / 6);
      map.offset.set(0, 5 / 6);
    }
    const sprite = addSprite(
      world,
      spriteMaterial(map),
      SANDBOX_START.x + 0.5 - index * 0.65,
      0.82,
      SANDBOX_START.z + 0.5 + (index % 2) * 0.55,
      1.55,
      1.55,
      20 + index,
    );
    const shadow = new THREE.Mesh(
      actorShadowGeometry,
      new THREE.MeshBasicMaterial({ color: 0x01050b, transparent: true, opacity: 0.46, depthWrite: false }),
    );
    const cargo = addSprite(world, cargoMaterials.ore, sprite.position.x, 1.46, sprite.position.z, 0.38, 0.38, 30 + index);
    cargo.visible = false;
    world.add(shadow);
    workerVisuals.push({ sprite, shadow, cargo, map });
  }
  workerVisuals.forEach((visual, index) => {
    const visible = index < targetCount;
    visual.sprite.visible = visible;
    visual.shadow.visible = visible;
    visual.cargo.visible = visible && visual.cargo.visible;
  });
}
ensureWorkerVisuals(3);
const actor = workerVisuals[0].sprite;
const actorShadow = workerVisuals[0].shadow;

const roomFloorMaterials = Object.fromEntries(
  (Object.keys(ROOM_DEFINITIONS) as RoomKind[]).map((kind) => [
    kind,
    new THREE.MeshStandardMaterial({
      color: ROOM_DEFINITIONS[kind].color,
      map: floorMap,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      side: THREE.DoubleSide,
      roughness: 0.78,
      metalness: 0.03,
    }),
  ]),
) as Record<RoomKind, THREE.MeshStandardMaterial>;
const roomAccentMaterials = Object.fromEntries(
  (Object.keys(ROOM_DEFINITIONS) as RoomKind[]).map((kind) => {
    const color = new THREE.Color(ROOM_DEFINITIONS[kind].color).offsetHSL(0, 0.12, 0.18);
    return [kind, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.72, depthWrite: false })];
  }),
) as Record<RoomKind, THREE.MeshBasicMaterial>;

const ambient = new THREE.AmbientLight(0xaabeca, 1.02);
const hemisphere = new THREE.HemisphereLight(0xc3e0e9, 0x263746, 2.15);
const keyLight = new THREE.DirectionalLight(0xffe1a3, 4.25);
keyLight.position.set(-8, 22, 15);
keyLight.target.position.set(18, 0, 18);
keyLight.castShadow = !mobileProfile;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -20;
keyLight.shadow.camera.right = 20;
keyLight.shadow.camera.top = 20;
keyLight.shadow.camera.bottom = -20;
scene.add(ambient, hemisphere, keyLight, keyLight.target);
const heartLight = new THREE.PointLight(0xff7c5f, 18, 8, 1.8);
heartLight.position.set(heartX, 3.2, heartZ);
scene.add(heartLight);

let state = createSandboxState();
let knownDiscoveryCount = 0;
let surfaceStyle: SurfaceStyle = 'clean';
let geometryGroup = new THREE.Group();
let resourceGroup = new THREE.Group();
let roomGroup = new THREE.Group();
let lightingGroup = new THREE.Group();
let closedRockGroup = new THREE.Group();
let lastRockOpenCount = -1;
world.add(closedRockGroup, geometryGroup, resourceGroup, roomGroup, lightingGroup);

function rockMaterialIndex(x: number, z: number): number {
  const fungal = SANDBOX_DISCOVERY_SITES.some((site) => site.kind === 'fungus' && Math.hypot(x - (site.x + site.w / 2), z - (site.z + site.h / 2)) < 6.5);
  if (fungal) return 1;
  const iron = state.deposits.some((deposit) => deposit.kind === 'iron' && Math.hypot(x - deposit.x, z - deposit.z) < 3.2);
  if (iron) return 2;
  return edgeHash({ key: `${x}:${z}`, x, z, axis: 'horizontal', side: 'north', start: { x, z }, end: { x: x + 1, z } }) % 4;
}

function rebuildClosedRockField(): void {
  if (lastRockOpenCount === state.openCells.size) return;
  lastRockOpenCount = state.openCells.size;
  world.remove(closedRockGroup);
  closedRockGroup.clear();
  closedRockGroup = new THREE.Group();
  const matrices: THREE.Matrix4[][][] = closedRockMaterials.map(() => closedRockGeometries.map(() => []));
  for (let z = SANDBOX_BOUNDS.minZ; z <= SANDBOX_BOUNDS.maxZ; z += 1) {
    for (let x = SANDBOX_BOUNDS.minX; x <= SANDBOX_BOUNDS.maxX; x += 1) {
      if (state.openCells.has(proofCellKey(x, z)) || SANDBOX_DISCOVERY_SITES.some((site) => siteContains(site, x, z))) continue;
      const seed = x * 92821 + z * 68917;
      const scaleX = 0.82 + seededUnit(seed + 7) * 0.23;
      const scaleZ = 0.82 + seededUnit(seed + 9) * 0.23;
      const shapeIndex = Math.min(closedRockGeometries.length - 1, Math.floor(seededUnit(seed + 17) * closedRockGeometries.length));
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(x + 0.5 + (seededUnit(seed + 3) - 0.5) * 0.16, 0.13, z + 0.5 + (seededUnit(seed + 5) - 0.5) * 0.16),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, seededUnit(seed + 11) * Math.PI, 0)),
        new THREE.Vector3(scaleX, 0.34 + seededUnit(seed + 13) * 0.18, scaleZ),
      );
      matrices[rockMaterialIndex(x, z)][shapeIndex].push(matrix);
    }
  }
  matrices.forEach((forms, materialIndex) => forms.forEach((entries, shapeIndex) => (
    addInstances(closedRockGeometries[shapeIndex], closedRockMaterials[materialIndex], entries, closedRockGroup)
  )));
  world.add(closedRockGroup);
}

function edgeMatrix(edge: BoundaryEdge, y: number, height: number, thickness: number, length = 1.045): THREE.Matrix4 {
  const horizontal = edge.axis === 'horizontal';
  return matrixAt(edge.x, y, edge.z, horizontal ? length : thickness, height, horizontal ? thickness : length);
}

function coreMaterials(family: WallFamily): THREE.Material[] {
  return [family.side, family.side, family.side, family.side, family.side, family.side];
}

function addWallFamily(edges: BoundaryEdge[], family: WallFamily, parent: THREE.Object3D, transparent = false): void {
  addInstances(unitBox, coreMaterials(family), edges.map((edge) => edgeMatrix(edge, 0.55, 0.9, 0.25)), parent, !transparent);
  addInstances(unitBox, family.base, edges.map((edge) => edgeMatrix(edge, 0.1, 0.2, 0.32, 1.06)), parent);
  addInstances(unitBox, family.cap, edges.map((edge) => edgeMatrix(edge, 1.04, 0.18, 0.32, 1.08)), parent);
}

function edgeHash(edge: BoundaryEdge, salt = 0): number {
  let hash = 2166136261 ^ salt;
  for (let index = 0; index < edge.key.length; index += 1) {
    hash ^= edge.key.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededUnit(seed: number): number {
  const value = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return value - Math.floor(value);
}

function naturalRockMatrices(edges: BoundaryEdge[]): THREE.Matrix4[] {
  const matrices: THREE.Matrix4[] = [];
  const along = [-0.34, 0, 0.34];
  const rows = [0.24, 0.59, 0.92];
  for (const edge of edges) {
    const base = edgeHash(edge);
    for (let row = 0; row < rows.length; row += 1) {
      for (let column = 0; column < along.length; column += 1) {
        const seed = base + row * 31 + column * 97;
        const jitter = (seededUnit(seed) - 0.5) * 0.08;
        const lateral = along[column] + (row % 2 === 1 ? 0.08 : 0) + jitter;
        const x = edge.x + (edge.axis === 'horizontal' ? lateral : jitter * 0.35);
        const z = edge.z + (edge.axis === 'vertical' ? lateral : jitter * 0.35);
        const sx = (edge.axis === 'horizontal' ? 0.39 : 0.3) * (0.88 + seededUnit(seed + 1) * 0.24);
        const sz = (edge.axis === 'vertical' ? 0.39 : 0.3) * (0.88 + seededUnit(seed + 2) * 0.24);
        const sy = 0.43 * (0.86 + seededUnit(seed + 3) * 0.28);
        matrices.push(new THREE.Matrix4().compose(
          new THREE.Vector3(x, rows[row] + jitter * 0.3, z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(
            seededUnit(seed + 4) * 0.35,
            seededUnit(seed + 5) * Math.PI,
            seededUnit(seed + 6) * 0.28,
          )),
          new THREE.Vector3(sx, sy, sz),
        ));
      }
    }
  }
  return matrices;
}

function adjacentOpenCell(edge: BoundaryEdge): { x: number; z: number } {
  if (edge.side === 'north') return { x: Math.floor(edge.x), z: edge.z };
  if (edge.side === 'south') return { x: Math.floor(edge.x), z: edge.z - 1 };
  if (edge.side === 'east') return { x: edge.x - 1, z: Math.floor(edge.z) };
  return { x: edge.x, z: Math.floor(edge.z) };
}

function builtCellKeys(cells: ProofCell[]): Set<string> {
  const keys = new Set(state.claimedCells);
  for (const room of state.rooms.filter(sandboxRoomComplete)) {
    for (let z = room.z; z < room.z + room.h; z += 1) {
      for (let x = room.x; x < room.x + room.w; x += 1) keys.add(proofCellKey(x, z));
    }
  }
  return keys;
}

function thresholdMatrices(cells: ProofCell[], constructed: Set<string>): THREE.Matrix4[] {
  const open = new Set(cells.map((cell) => proofCellKey(cell.x, cell.z)));
  const matrices: THREE.Matrix4[] = [];
  for (const cell of cells) {
    for (const neighbour of [{ x: cell.x + 1, z: cell.z, vertical: true }, { x: cell.x, z: cell.z + 1, vertical: false }]) {
      const currentKey = proofCellKey(cell.x, cell.z);
      const neighbourKey = proofCellKey(neighbour.x, neighbour.z);
      if (!open.has(neighbourKey) || constructed.has(currentKey) === constructed.has(neighbourKey)) continue;
      matrices.push(matrixAt(
        neighbour.vertical ? cell.x + 1 : cell.x + 0.5,
        0.09,
        neighbour.vertical ? cell.z + 0.5 : cell.z + 1,
        neighbour.vertical ? 0.13 : 0.9,
        0.12,
        neighbour.vertical ? 0.9 : 0.13,
      ));
    }
  }
  return matrices;
}

function selectLightEdges(edges: BoundaryEdge[], maximum: number): BoundaryEdge[] {
  const selected: BoundaryEdge[] = [];
  for (const edge of [...edges].sort((a, b) => edgeHash(a) - edgeHash(b))) {
    if (edge.side === 'south') continue;
    if (selected.some((candidate) => Math.hypot(candidate.x - edge.x, candidate.z - edge.z) < 4.5)) continue;
    selected.push(edge);
    if (selected.length >= maximum) break;
  }
  return selected;
}

function rebuildLighting(builtEdges: BoundaryEdge[], naturalEdges: BoundaryEdge[]): void {
  world.remove(lightingGroup);
  lightingGroup.clear();
  lightingGroup = new THREE.Group();
  const addFixture = (edge: BoundaryEdge, natural: boolean): void => {
    const inward = edge.side === 'north' ? { x: 0, z: 0.16 }
      : edge.side === 'south' ? { x: 0, z: -0.16 }
        : edge.side === 'east' ? { x: -0.16, z: 0 }
          : { x: 0.16, z: 0 };
    const fixture = new THREE.Group();
    fixture.position.set(edge.x + inward.x, natural ? 0.58 : 0.67, edge.z + inward.z);
    if (!natural) {
      const bracket = new THREE.Mesh(unitBox, brassDetailMaterial);
      bracket.scale.set(0.18, 0.38, 0.18);
      fixture.add(bracket);
    }
    const orb = new THREE.Mesh(lightOrbGeometry, natural ? fungusLightMaterial : warmLightMaterial);
    orb.position.y = natural ? 0 : 0.17;
    orb.scale.set(natural ? 1.25 : 1, natural ? 0.8 : 1.18, natural ? 1.25 : 1);
    fixture.add(orb);
    const light = new THREE.PointLight(natural ? 0x42e7be : 0xffa62f, natural ? 3.2 : 4.4, natural ? 4.2 : 4.8, 2);
    light.position.y = natural ? 0.18 : 0.3;
    fixture.add(light);
    lightingGroup.add(fixture);
  };
  selectLightEdges(builtEdges, mobileProfile ? 3 : 5).forEach((edge) => addFixture(edge, false));
  selectLightEdges(naturalEdges, mobileProfile ? 2 : 3).forEach((edge) => addFixture(edge, true));
  world.add(lightingGroup);
}

function rebuildGeometry(): void {
  rebuildClosedRockField();
  world.remove(geometryGroup);
  geometryGroup.clear();
  geometryGroup = new THREE.Group();
  const cells = [...state.openCells.values()];
  const tileMatrix = (cell: ProofCell): THREE.Matrix4 => matrixAt(cell.x + 0.5, 0.015, cell.z + 0.5);
  addInstances(tileGeometry, floorMaterials.start, cells.filter((cell) => cell.zone === 'start').map(tileMatrix), geometryGroup);
  addInstances(
    tileGeometry,
    floorMaterials.claimed,
    cells.filter((cell) => cell.zone !== 'start' && state.claimedCells.has(proofCellKey(cell.x, cell.z))).map(tileMatrix),
    geometryGroup,
  );
  addInstances(
    tileGeometry,
    floorMaterials.raw,
    cells.filter((cell) => cell.zone === 'corridor' && !state.claimedCells.has(proofCellKey(cell.x, cell.z))).map(tileMatrix),
    geometryGroup,
  );
  addInstances(
    tileGeometry,
    floorMaterials.cavern,
    cells.filter((cell) => cell.zone === 'target' && !state.claimedCells.has(proofCellKey(cell.x, cell.z))).map(tileMatrix),
    geometryGroup,
  );
  addInstances(
    tileGeometry,
    plannedDigMaterial,
    [...state.plannedDig.values()].map((cell) => matrixAt(cell.x + 0.5, 0.065, cell.z + 0.5)),
    geometryGroup,
  );
  const edges = buildBoundaryEdges(cells);
  const constructed = builtCellKeys(cells);
  const builtEdges = edges.filter((edge) => constructed.has(proofCellKey(adjacentOpenCell(edge).x, adjacentOpenCell(edge).z)));
  const naturalEdges = edges.filter((edge) => !builtEdges.includes(edge));
  const opaqueBuilt = builtEdges.filter((edge) => edge.side !== 'south');
  const foregroundBuilt = builtEdges.filter((edge) => edge.side === 'south');
  addWallFamily(opaqueBuilt, wallFamilies[surfaceStyle], geometryGroup);
  addWallFamily(foregroundBuilt, foregroundFamilies[surfaceStyle], geometryGroup, true);
  addInstances(naturalRockGeometry, wallFamilies.natural.side, naturalRockMatrices(naturalEdges.filter((edge) => edge.side !== 'south')), geometryGroup, !mobileProfile);
  addInstances(naturalRockGeometry, foregroundFamilies.natural.side, naturalRockMatrices(naturalEdges.filter((edge) => edge.side === 'south')), geometryGroup);
  const vertices = boundaryVertices(builtEdges);
  addInstances(
    unitBox,
    wallFamilies[surfaceStyle].post,
    vertices.map((vertex) => matrixAt(vertex.x, 0.56, vertex.z, 0.36, 0.92, 0.36)),
    geometryGroup,
    true,
  );
  addInstances(unitBox, wallFamilies[surfaceStyle].base, vertices.map((vertex) => matrixAt(vertex.x, 0.1, vertex.z, 0.42, 0.2, 0.42)), geometryGroup);
  addInstances(unitBox, wallFamilies[surfaceStyle].cap, vertices.map((vertex) => matrixAt(vertex.x, 1.04, vertex.z, 0.44, 0.18, 0.44)), geometryGroup);
  addInstances(unitBox, brassDetailMaterial, vertices.map((vertex) => matrixAt(vertex.x, 0.57, vertex.z, 0.41, 0.12, 0.41)), geometryGroup);
  addInstances(unitBox, brassDetailMaterial, builtEdges.filter((edge) => edgeHash(edge) % 4 === 0).map((edge) => edgeMatrix(edge, 0.58, 0.66, 0.34, 0.1)), geometryGroup);
  addInstances(unitBox, brassDetailMaterial, thresholdMatrices(cells, constructed), geometryGroup);
  world.add(geometryGroup);
  rebuildLighting(builtEdges, naturalEdges);
  root.dataset.openCells = String(cells.length);
  root.dataset.boundaryEdges = String(edges.length);
  renderer.shadowMap.needsUpdate = true;
}

function roomPropPositions(room: SandboxRoom, count: number): Array<{ x: number; z: number }> {
  if (count <= 0) return [];
  const columns = Math.min(room.w, Math.max(1, Math.ceil(Math.sqrt(count * room.w / Math.max(1, room.h)))));
  const rows = Math.ceil(count / columns);
  const positions: Array<{ x: number; z: number }> = [];
  for (let index = 0; index < count; index += 1) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    positions.push({
      x: room.x + ((column + 1) / (columns + 1)) * room.w,
      z: room.z + ((row + 1) / (rows + 1)) * room.h,
    });
  }
  return positions;
}

function roomPerimeterPositions(room: SandboxRoom, count: number): Array<{ x: number; z: number }> {
  if (count <= 0) return [];
  const positions: Array<{ x: number; z: number }> = [];
  const perSide = Math.ceil(count / 2);
  for (let index = 0; index < count; index += 1) {
    const north = index % 2 === 0;
    const slot = Math.floor(index / 2);
    positions.push({
      x: room.x + 0.7 + ((slot + 0.5) / perSide) * Math.max(0.6, room.w - 1.4),
      z: north ? room.z + 0.72 : room.z + room.h - 0.72,
    });
  }
  return positions;
}

function addFloorDecal(
  parent: THREE.Object3D,
  material: THREE.Material,
  x: number,
  z: number,
  width: number,
  depth: number,
  rotation = 0,
): void {
  const mesh = new THREE.Mesh(tileGeometry, material);
  mesh.position.set(x, 0.084, z);
  mesh.scale.set(width, 1, depth);
  mesh.rotation.y = rotation;
  mesh.renderOrder = 3;
  parent.add(mesh);
}

function addRoomArchitecture(room: SandboxRoom): void {
  const cx = room.x + room.w / 2;
  const cz = room.z + room.h / 2;
  addInstances(unitBox, roomAccentMaterials[room.kind], [
    matrixAt(cx, 0.092, room.z + 0.11, room.w - 0.44, 0.025, 0.035),
    matrixAt(cx, 0.092, room.z + room.h - 0.11, room.w - 0.44, 0.025, 0.035),
    matrixAt(room.x + 0.11, 0.092, cz, 0.035, 0.025, room.h - 0.44),
    matrixAt(room.x + room.w - 0.11, 0.092, cz, 0.035, 0.025, room.h - 0.44),
  ], roomGroup);
  if (room.kind === 'kitchen') addFloorDecal(roomGroup, decalMaterials.moss, cx, cz, Math.max(1.4, room.w * 0.68), Math.max(1.5, room.h * 0.66), 0.17);
  if (room.kind === 'smelter') addFloorDecal(roomGroup, decalMaterials.rubble, cx, cz, Math.max(1.2, room.w * 0.56), Math.max(1.1, room.h * 0.5), -0.12);
  if (room.kind === 'workshop') addFloorDecal(roomGroup, decalMaterials.rubble, cx, cz, Math.max(1.1, room.w * 0.48), Math.max(0.9, room.h * 0.42), 0.08);
  addSprite(roomGroup, spriteMaterials.banner, cx, 0.7, room.z + 0.26, 0.62, 0.82, 7);
  if (room.w * room.h >= 8) addSprite(roomGroup, spriteMaterials.lamp, room.x + 0.52, 0.55, room.z + 0.52, 0.58, 0.74, 8);
}

function addCompletedRoomDressing(room: SandboxRoom): void {
  addRoomArchitecture(room);
  const cells = room.w * room.h;
  if (room.kind === 'bedroom') {
    const count = bedroomCapacity(cells);
    roomPerimeterPositions(room, count).forEach((position, index) => {
      addSprite(roomGroup, spriteMaterials.bedroom, position.x, 0.44, position.z, 0.58, 0.92, 6 + index);
    });
    if (count > 2) addSprite(roomGroup, spriteMaterials.supplies, room.x + room.w / 2, 0.42, room.z + room.h / 2, 0.66, 0.66, 6);
    return;
  }
  if (room.kind === 'storage') {
    const positions = roomPropPositions(room, Math.max(2, Math.min(5, Math.ceil(cells / 4))));
    positions.forEach((position, index) => {
      const material = index % 3 === 0 ? spriteMaterials.storage : index % 3 === 1 ? spriteMaterials.supplies : spriteMaterials.cart;
      addSprite(roomGroup, material, position.x, 0.46, position.z, index % 3 === 1 ? 0.82 : 0.7, index % 3 === 1 ? 0.7 : 0.72, 6 + index);
    });
    addSprite(roomGroup, spriteMaterials.rack, room.x + room.w - 0.5, 0.54, room.z + 0.5, 0.72, 0.78, 7);
    return;
  }
  if (room.kind === 'kitchen') {
    const positions = roomPropPositions(room, productionStations(cells));
    positions.forEach((position, index) => addSprite(roomGroup, spriteMaterials.kitchen, position.x, 0.5, position.z, 0.88, 0.88, 7 + index));
    addSprite(roomGroup, spriteMaterials.grottoStation, room.x + room.w - 0.7, 0.5, room.z + room.h - 0.7, 0.92, 0.92, 8);
    addSprite(roomGroup, spriteMaterials.fungusSmall, room.x + 0.62, 0.34, room.z + room.h - 0.62, 0.48, 0.48, 8);
    return;
  }
  if (room.kind === 'smelter') {
    roomPropPositions(room, productionStations(cells)).forEach((position, index) => addSprite(roomGroup, spriteMaterials.smelter, position.x, 0.52, position.z, 0.94, 0.94, 7 + index));
    addSprite(roomGroup, spriteMaterials.supplies, room.x + room.w - 0.65, 0.42, room.z + room.h - 0.62, 0.68, 0.62, 7);
    return;
  }
  if (room.kind === 'workshop') {
    roomPropPositions(room, productionStations(cells)).forEach((position, index) => addSprite(roomGroup, spriteMaterials.workshop, position.x, 0.46, position.z, 0.9, 0.74, 7 + index));
    addSprite(roomGroup, spriteMaterials.rack, room.x + 0.55, 0.54, room.z + room.h - 0.55, 0.72, 0.78, 7);
    addSprite(roomGroup, spriteMaterials.cart, room.x + room.w - 0.58, 0.42, room.z + room.h - 0.58, 0.66, 0.66, 7);
    return;
  }
  roomPerimeterPositions(room, prisonCapacity(cells)).forEach((position, index) => {
    addSprite(roomGroup, spriteMaterials.prison, position.x, 0.48, position.z, 0.78, 0.88, 7 + index);
  });
}

function rebuildRooms(): void {
  world.remove(roomGroup);
  roomGroup.clear();
  roomGroup = new THREE.Group();
  for (const kind of Object.keys(ROOM_DEFINITIONS) as RoomKind[]) {
    const matrices = state.rooms
      .filter((room) => room.kind === kind)
      .flatMap((room) => Array.from({ length: room.w * room.h }, (_, index) => {
        const x = room.x + (index % room.w);
        const z = room.z + Math.floor(index / room.w);
        return index < room.buildProgress ? matrixAt(x + 0.5, 0.06, z + 0.5) : undefined;
      }));
    addInstances(tileGeometry, roomFloorMaterials[kind], matrices.filter((matrix): matrix is THREE.Matrix4 => Boolean(matrix)), roomGroup);
  }
  const plannedMatrices = state.rooms.flatMap((room) => Array.from({ length: room.w * room.h }, (_, index) => {
    if (index < room.buildProgress) return undefined;
    const x = room.x + (index % room.w);
    const z = room.z + Math.floor(index / room.w);
    return matrixAt(x + 0.5, 0.055, z + 0.5);
  })).filter((matrix): matrix is THREE.Matrix4 => Boolean(matrix));
  addInstances(tileGeometry, plannedRoomMaterial, plannedMatrices, roomGroup);
  for (const room of state.rooms) {
    if (!sandboxRoomComplete(room)) continue;
    addCompletedRoomDressing(room);
  }
  world.add(roomGroup);
}

function siteContains(site: SandboxDiscoverySite, x: number, z: number): boolean {
  return x >= site.x && x < site.x + site.w && z >= site.z && z < site.z + site.h;
}

function depositIsVisible(deposit: { x: number; z: number }): boolean {
  const site = SANDBOX_DISCOVERY_SITES.find((candidate) => siteContains(candidate, deposit.x, deposit.z));
  return !site || state.discoveredSites.has(site.id);
}

function addDiscoveredSiteDressing(site: SandboxDiscoverySite): void {
  const cx = site.x + site.w / 2;
  const cz = site.z + site.h / 2;
  if (site.kind === 'fungus') {
    addFloorDecal(resourceGroup, decalMaterials.moss, cx, cz, site.w * 0.84, site.h * 0.82, site.id === 'spore-garden' ? 0.28 : -0.16);
    addFloorDecal(resourceGroup, decalMaterials.spores, cx - 0.8, cz + 0.65, site.w * 0.48, site.h * 0.44, 0.2);
    addFloorDecal(resourceGroup, decalMaterials.puddle, cx + 1.25, cz - 1.1, 1.7, 1.25, -0.24);
    addSprite(resourceGroup, spriteMaterials.fungusGrotto, cx, 1.02, cz, site.w * 0.56, site.h * 0.56, 9);
    addSprite(resourceGroup, spriteMaterials.fungusMedium, site.x + 1.05, 0.5, site.z + site.h - 1.05, 0.9, 0.9, 10);
    addSprite(resourceGroup, spriteMaterials.fungusSmall, site.x + site.w - 1.1, 0.35, site.z + 1.08, 0.58, 0.58, 10);
    addSprite(resourceGroup, spriteMaterials.grottoStation, site.x + site.w - 1.15, 0.5, site.z + site.h - 1.08, 1.02, 1.02, 10);
    const glow = new THREE.PointLight(0x5be9bd, mobileProfile ? 2.4 : 4.2, 6.5, 2);
    glow.position.set(cx, 1.55, cz);
    resourceGroup.add(glow);
    return;
  }
  if (site.kind === 'cache') {
    addFloorDecal(resourceGroup, decalMaterials.rubble, cx, cz, site.w * 0.7, site.h * 0.62, 0.15);
    addSprite(resourceGroup, spriteMaterials.supplies, cx - 1.2, 0.48, cz - 0.65, 1.02, 0.9, 9);
    addSprite(resourceGroup, spriteMaterials.cart, cx + 1.25, 0.46, cz + 0.7, 0.88, 0.88, 9);
    addSprite(resourceGroup, spriteMaterials.rack, site.x + 0.8, 0.58, site.z + 0.82, 0.86, 0.92, 9);
    addSprite(resourceGroup, spriteMaterials.banner, site.x + site.w - 0.75, 0.7, site.z + 0.55, 0.72, 0.94, 9);
    return;
  }
  addFloorDecal(resourceGroup, decalMaterials.rubble, cx, cz, site.w * 0.6, site.h * 0.55, -0.12);
  addSprite(resourceGroup, spriteMaterials.ironMineHero, cx, 1.08, cz, site.w * 0.72, site.h * 0.62, 9);
  const glow = new THREE.PointLight(0xffae38, mobileProfile ? 2.2 : 4.8, 6.8, 2);
  glow.position.set(cx + 0.8, 1.65, cz - 0.25);
  resourceGroup.add(glow);
}

function addUndiscoveredSitePreview(site: SandboxDiscoverySite): void {
  const cx = site.x + site.w / 2;
  const cz = site.z + site.h / 2;
  if (site.kind === 'fungus') {
    addFloorDecal(resourceGroup, decalMaterials.moss, cx, cz, site.w * 0.82, site.h * 0.8, site.id === 'spore-garden' ? 0.3 : -0.14);
    addFloorDecal(resourceGroup, decalMaterials.spores, cx + 0.75, cz - 0.55, site.w * 0.42, site.h * 0.38, 0.22);
    addSprite(resourceGroup, hintMaterials.fungusGrotto, cx, 1.02, cz, site.w * 0.55, site.h * 0.55, 8);
    addSprite(resourceGroup, spriteMaterials.fungusSmall, site.entry.x + 0.5, 0.34, site.entry.z + 0.25, 0.54, 0.54, 10);
    const glow = new THREE.PointLight(0x43d8b1, mobileProfile ? 1.2 : 2.6, 5.5, 2);
    glow.position.set(cx, 1.4, cz);
    resourceGroup.add(glow);
    return;
  }
  if (site.kind === 'iron') {
    addFloorDecal(resourceGroup, decalMaterials.rubble, cx, cz, site.w * 0.72, site.h * 0.62, -0.1);
    addSprite(resourceGroup, hintMaterials.ironMine, cx, 1.04, cz, site.w * 0.7, site.h * 0.6, 8);
    addSprite(resourceGroup, hintMaterials.iron, site.entry.x + 0.5, 0.5, site.entry.z + 0.35, 0.76, 0.76, 10);
    const glow = new THREE.PointLight(0xe9a13b, mobileProfile ? 1.1 : 2.5, 5.4, 2);
    glow.position.set(cx + 0.8, 1.4, cz - 0.25);
    resourceGroup.add(glow);
    return;
  }
  addFloorDecal(resourceGroup, decalMaterials.rubble, cx, cz, site.w * 0.68, site.h * 0.58, 0.14);
  addSprite(resourceGroup, spriteMaterials.supplies, cx - 0.9, 0.48, cz, 0.92, 0.82, 8);
  addSprite(resourceGroup, spriteMaterials.cart, cx + 0.85, 0.45, cz + 0.45, 0.78, 0.78, 8);
  addSprite(resourceGroup, spriteMaterials.banner, site.entry.x + 0.5, 0.68, site.entry.z + 0.25, 0.66, 0.86, 10);
}

function rebuildResources(): void {
  world.remove(resourceGroup);
  resourceGroup.clear();
  resourceGroup = new THREE.Group();
  SANDBOX_DISCOVERY_SITES
    .filter((site) => !state.discoveredSites.has(site.id))
    .forEach(addUndiscoveredSitePreview);
  SANDBOX_DISCOVERY_SITES
    .filter((site) => state.discoveredSites.has(site.id))
    .forEach(addDiscoveredSiteDressing);
  for (const kind of ['iron', 'fungus'] as const) {
    const matrices = state.deposits
      .filter((deposit) => deposit.kind === kind && deposit.remaining > 0 && state.openCells.has(proofCellKey(deposit.x, deposit.z)))
      .filter(depositIsVisible)
      .filter((deposit) => deposit.id % 3 === 0)
      .map((deposit, index) => {
        const size = kind === 'iron' ? 0.58 + seededUnit(deposit.id + 17) * 0.22 : 0.66 + seededUnit(deposit.id + 31) * 0.18;
        const jitterX = (seededUnit(deposit.id + 43) - 0.5) * 0.24;
        const jitterZ = (seededUnit(deposit.id + 59) - 0.5) * 0.24;
        return new THREE.Matrix4().compose(
          new THREE.Vector3(deposit.x + 0.5 + jitterX, 0.48 + (index % 2) * 0.07, deposit.z + 0.5 + jitterZ),
          resourceFacing,
          new THREE.Vector3(size, size, 1),
        );
      });
    addInstances(resourceGeometry, resourceMaterials[kind], matrices, resourceGroup);
  }
  const depositGroups = new Map<string, typeof state.deposits>();
  for (const deposit of state.deposits.filter((candidate) => candidate.remaining > 0)) {
    const key = `${deposit.kind}:${Math.floor(deposit.id / 20)}`;
    const group = depositGroups.get(key) ?? [];
    group.push(deposit);
    depositGroups.set(key, group);
  }
  for (const deposits of depositGroups.values()) {
    if (deposits.some((deposit) => state.openCells.has(proofCellKey(deposit.x, deposit.z)))) continue;
    const cx = deposits.reduce((sum, deposit) => sum + deposit.x + 0.5, 0) / deposits.length;
    const cz = deposits.reduce((sum, deposit) => sum + deposit.z + 0.5, 0) / deposits.length;
    const kind = deposits[0].kind;
    addSprite(resourceGroup, hintMaterials[kind], cx, kind === 'fungus' ? 0.58 : 0.52, cz, kind === 'fungus' ? 1.18 : 1.06, kind === 'fungus' ? 1.18 : 1.06, 11);
  }
  world.add(resourceGroup);
}

let actorPath = [
  { x: SANDBOX_START.x + 0.5, z: SANDBOX_START.z + 0.5 },
  { x: SANDBOX_START.x + 2.5, z: SANDBOX_START.z + 0.5 },
];
let actorDestinationKey = '';
let actorSegment = 0;
let actorProgress = 0;
let workerAnimationTime = 0;
let actorDigTarget: { x: number; z: number } | undefined;
let actorMoving = false;

const digFx = new THREE.Group();
const digProgressMaterial = new THREE.MeshBasicMaterial({ color: 0xf2c95f, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
const digProgressRing = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.4, 24, 1, 0, Math.PI * 2), digProgressMaterial);
digProgressRing.rotation.x = -Math.PI / 2;
digProgressRing.position.y = 0.12;
digFx.add(digProgressRing);
for (let index = 0; index < 4; index += 1) {
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.11, 0.11), wallFamilies.natural.side);
  chip.position.set((index - 1.5) * 0.13, 0.28 + (index % 2) * 0.12, 0);
  digFx.add(chip);
}
digFx.visible = false;
world.add(digFx);

const claimFx = new THREE.Group();
const claimRing = new THREE.Mesh(
  new THREE.RingGeometry(0.24, 0.42, 24),
  new THREE.MeshBasicMaterial({ color: 0xe5b94f, transparent: true, opacity: 0.82, depthWrite: false, side: THREE.DoubleSide }),
);
claimRing.rotation.x = -Math.PI / 2;
claimRing.position.y = 0.13;
claimFx.add(claimRing);
for (const offset of [-0.23, 0, 0.23]) {
  const marker = new THREE.Mesh(unitBox, brassDetailMaterial);
  marker.position.set(offset, 0.1, 0);
  marker.scale.set(0.13, 0.16, 0.13);
  claimFx.add(marker);
}
claimFx.visible = false;
world.add(claimFx);

function updateActorPath(): void {
  const planned = [...state.plannedDig.values()].find((cell) => [
    { x: cell.x, z: cell.z - 1 },
    { x: cell.x + 1, z: cell.z },
    { x: cell.x, z: cell.z + 1 },
    { x: cell.x - 1, z: cell.z },
  ].some((neighbour) => state.openCells.has(proofCellKey(neighbour.x, neighbour.z))));
  const excavationApproach = planned
    ? [
        { x: planned.x, z: planned.z - 1 },
        { x: planned.x + 1, z: planned.z },
        { x: planned.x, z: planned.z + 1 },
        { x: planned.x - 1, z: planned.z },
      ].find((cell) => state.openCells.has(proofCellKey(cell.x, cell.z)))
    : undefined;
  const destination = excavationApproach;
  const destinationKey = planned && destination ? `${proofCellKey(planned.x, planned.z)}@${proofCellKey(destination.x, destination.z)}` : 'idle';
  if (destinationKey === actorDestinationKey) return;
  actorDestinationKey = destinationKey;
  actorDigTarget = planned && destination ? { x: planned.x, z: planned.z } : undefined;
  digFx.visible = false;
  const actorCell = { x: Math.floor(actor.position.x), z: Math.floor(actor.position.z) };
  const routeStart = state.openCells.has(proofCellKey(actorCell.x, actorCell.z)) ? actorCell : SANDBOX_START;
  const route = destination
    ? findOpenPath([...state.openCells.values()], routeStart, destination)
    : [];
  actorPath = route.length > 0
    ? route.map((cell) => ({ x: cell.x + 0.5, z: cell.z + 0.5 }))
    : [{ x: actor.position.x, z: actor.position.z }];
  actorSegment = 0;
  actorProgress = 0;
}

function syncActorPosition(): void {
  const from = actorPath[Math.min(actorSegment, actorPath.length - 1)];
  const to = actorPath[Math.min(actorSegment + 1, actorPath.length - 1)];
  actor.position.set(THREE.MathUtils.lerp(from.x, to.x, actorProgress), 0.82, THREE.MathUtils.lerp(from.z, to.z, actorProgress));
  actorShadow.position.set(actor.position.x, 0.045, actor.position.z + 0.06);
}

function updateActor(delta: number): { terrainChanged: boolean } {
  let remaining = delta * 1.7;
  actorMoving = actorSegment < actorPath.length - 1;
  while (remaining > 0 && actorSegment < actorPath.length - 1) {
    const from = actorPath[actorSegment];
    const to = actorPath[actorSegment + 1];
    const length = Math.max(0.001, Math.hypot(to.x - from.x, to.z - from.z));
    const available = (1 - actorProgress) * length;
    if (remaining < available) {
      actorProgress += remaining / length;
      remaining = 0;
    } else {
      remaining -= available;
      actorSegment += 1;
      actorProgress = 0;
    }
  }
  actorMoving = actorSegment < actorPath.length - 1;
  syncActorPosition();
  const working = !actorMoving && Boolean(actorDigTarget) && state.workerJobs.dig > 0;
  let terrainChanged = false;
  if (working && actorDigTarget) {
    const result = advanceSandboxDigging(state, actorDigTarget, delta);
    digFx.visible = true;
    digFx.position.set(actorDigTarget.x + 0.5, 0.02, actorDigTarget.z + 0.5);
    digProgressRing.scale.setScalar(Math.max(0.08, result.progress));
    digProgressRing.rotation.z = workerAnimationTime * 1.6;
    for (let index = 1; index < digFx.children.length; index += 1) {
      const chip = digFx.children[index];
      chip.position.y = 0.2 + ((workerAnimationTime * 1.8 + index * 0.19) % 0.55);
      chip.rotation.x += delta * (2 + index);
      chip.rotation.z += delta * (1.5 + index * 0.4);
    }
    terrainChanged = result.completed;
  } else {
    digFx.visible = false;
  }
  if (!workerAnimated) return { terrainChanged };
  workerAnimationTime += delta;
  const from = actorPath[Math.min(actorSegment, actorPath.length - 1)];
  const to = actorMoving ? actorPath[Math.min(actorSegment + 1, actorPath.length - 1)] : actorDigTarget ?? from;
  const targetX = actorMoving ? to.x : actorDigTarget ? actorDigTarget.x + 0.5 : from.x;
  const targetZ = actorMoving ? to.z : actorDigTarget ? actorDigTarget.z + 0.5 : from.z;
  const dx = targetX - from.x;
  const dz = targetZ - from.z;
  const row = Math.abs(dx) > Math.abs(dz) ? 2 : dz < 0 ? 1 : 0;
  const animationRow = (working ? 3 : 0) + row;
  const frame = working || actorMoving ? Math.floor(workerAnimationTime * (working ? 9 : 8)) % 4 : 1;
  workerMap.offset.set(frame / 4, 1 - (animationRow + 1) / 6);
  // The source side frame faces right. Mirror it only for leftward movement.
  actor.scale.x = (dx < 0 && row === 2 ? -1 : 1) * 1.55;
  return { terrainChanged };
}

type SupportTaskKind = 'claim' | 'dig' | 'build' | 'mine' | 'haul' | 'maintain';
interface SupportTask {
  kind: SupportTaskKind;
  key: string;
  target: { x: number; z: number };
  stand: { x: number; z: number };
}
interface SupportMotion {
  taskKey: string;
  task?: SupportTask;
  path: Array<{ x: number; z: number }>;
  segment: number;
  progress: number;
}
const supportMotions = new Map<number, SupportMotion>();
const supportCargo = new Map<number, 'ore' | 'biomass'>();

function supportTask(index: number): SupportTask {
  const cargo = supportCargo.get(index);
  if (cargo) {
    const storage = state.rooms.find((room) => room.kind === 'storage' && sandboxRoomComplete(room));
    const stand = storage
      ? { x: storage.x + Math.floor(storage.w / 2), z: storage.z + Math.floor(storage.h / 2) }
      : { x: SANDBOX_HEART.x + 2, z: SANDBOX_HEART.z };
    return { kind: 'haul', key: `haul:${cargo}:${proofCellKey(stand.x, stand.z)}`, target: stand, stand };
  }
  const claim = state.workerJobs.claim > 0 ? nextSandboxClaimTarget(state) : undefined;
  const unfinishedRoom = state.workerJobs.build > 0 ? state.rooms.find((room) => !sandboxRoomComplete(room)) : undefined;
  const mine = state.workerJobs.mine > 0
    ? state.deposits.find((deposit) => deposit.remaining > 0 && state.claimedCells.has(proofCellKey(deposit.x, deposit.z)))
    : undefined;
  const dig = actorDigTarget && state.workerJobs.dig > index ? actorDigTarget : undefined;
  const claimTask = claim ? { kind: 'claim' as const, key: `claim:${proofCellKey(claim.x, claim.z)}`, target: claim, stand: claim } : undefined;
  const buildTask = unfinishedRoom ? {
    kind: 'build' as const,
    key: `build:${unfinishedRoom.id}`,
    target: { x: unfinishedRoom.x + Math.floor(unfinishedRoom.w / 2), z: unfinishedRoom.z + Math.floor(unfinishedRoom.h / 2) },
    stand: { x: unfinishedRoom.x + Math.floor(unfinishedRoom.w / 2), z: unfinishedRoom.z + Math.floor(unfinishedRoom.h / 2) },
  } : undefined;
  const mineTask = mine ? { kind: 'mine' as const, key: `mine:${mine.id}`, target: { x: mine.x, z: mine.z }, stand: { x: mine.x, z: mine.z } } : undefined;
  const digApproach = dig ? [
    { x: dig.x, z: dig.z - 1 }, { x: dig.x + 1, z: dig.z },
    { x: dig.x, z: dig.z + 1 }, { x: dig.x - 1, z: dig.z },
  ].find((cell) => state.openCells.has(proofCellKey(cell.x, cell.z))) : undefined;
  const digTask = dig && digApproach ? { kind: 'dig' as const, key: `dig:${proofCellKey(dig.x, dig.z)}`, target: dig, stand: digApproach } : undefined;
  const selected = index === 1
    ? claimTask ?? digTask ?? buildTask ?? mineTask
    : buildTask ?? mineTask ?? digTask ?? (state.workerJobs.claim > 1 ? claimTask : undefined);
  if (selected) return selected;
  const stand = index === 1 ? { x: SANDBOX_HEART.x + 2, z: SANDBOX_HEART.z - 1 } : { x: SANDBOX_HEART.x - 2, z: SANDBOX_HEART.z + 1 };
  return { kind: 'maintain', key: `maintain:${index}`, target: { ...stand }, stand };
}

function resetSupportMotion(index: number, task: SupportTask): SupportMotion {
  const visual = workerVisuals[index];
  const current = { x: Math.floor(visual.sprite.position.x), z: Math.floor(visual.sprite.position.z) };
  const routeStart = state.openCells.has(proofCellKey(current.x, current.z)) ? current : SANDBOX_START;
  const route = findOpenPath([...state.openCells.values()], routeStart, task.stand);
  const path = route.length > 0
    ? route.map((cell) => ({ x: cell.x + 0.5, z: cell.z + 0.5 }))
    : [{ x: visual.sprite.position.x, z: visual.sprite.position.z }];
  const motion = { taskKey: task.key, task, path, segment: 0, progress: 0 };
  supportMotions.set(index, motion);
  return motion;
}

function updateSupportWorkers(delta: number): { terrainChanged: boolean } {
  let terrainChanged = false;
  for (let index = 1; index < workerVisuals.length; index += 1) {
    const visual = workerVisuals[index];
    if (!visual.sprite.visible) continue;
    const task = supportTask(index);
    let motion = supportMotions.get(index);
    if (!motion || motion.taskKey !== task.key) motion = resetSupportMotion(index, task);
    let remaining = delta * 2.05;
    const previousX = visual.sprite.position.x;
    const previousZ = visual.sprite.position.z;
    while (remaining > 0 && motion.segment < motion.path.length - 1) {
      const from = motion.path[motion.segment];
      const to = motion.path[motion.segment + 1];
      const length = Math.max(0.001, Math.hypot(to.x - from.x, to.z - from.z));
      const available = (1 - motion.progress) * length;
      if (remaining < available) {
        motion.progress += remaining / length;
        remaining = 0;
      } else {
        remaining -= available;
        motion.segment += 1;
        motion.progress = 0;
      }
    }
    const from = motion.path[Math.min(motion.segment, motion.path.length - 1)];
    const to = motion.path[Math.min(motion.segment + 1, motion.path.length - 1)];
    const x = THREE.MathUtils.lerp(from.x, to.x, motion.progress);
    const z = THREE.MathUtils.lerp(from.z, to.z, motion.progress);
    visual.sprite.position.set(x, 0.82, z);
    visual.shadow.position.set(x, 0.045, z + 0.06);
    const moving = motion.segment < motion.path.length - 1;
    const working = !moving;
    if (working && task.kind === 'claim') {
      const result = advanceSandboxClaiming(state, task.target, delta);
      terrainChanged ||= result.completed;
    }
    if (working && task.kind === 'dig') {
      const result = advanceSandboxDigging(state, task.target, delta * 0.65);
      terrainChanged ||= result.completed;
    }
    if (working && task.kind === 'mine') {
      const depositId = Number(task.key.slice('mine:'.length));
      const result = advanceSandboxMining(state, depositId, delta);
      if (result.completed && result.item) {
        supportCargo.set(index, result.item);
        rebuildResources();
      }
    }
    if (working && task.kind === 'haul') {
      const cargo = supportCargo.get(index);
      if (cargo) {
        const delivered = deliverSandboxResource(state, cargo);
        if (delivered.ok) {
          showStoragePopup(cargo);
          supportCargo.delete(index);
          updateUi();
        }
      }
    }
    const cargo = supportCargo.get(index);
    visual.cargo.visible = Boolean(cargo);
    if (cargo) {
      visual.cargo.material = cargoMaterials[cargo];
      visual.cargo.position.set(x, 1.42, z + 0.02);
    }
    if (workerAnimated) {
      const dx = moving ? x - previousX : task.target.x + 0.5 - x;
      const dz = moving ? z - previousZ : task.target.z + 0.5 - z;
      const row = Math.abs(dx) > Math.abs(dz) ? 2 : dz < 0 ? 1 : 0;
      const animationRow = (working ? 3 : 0) + row;
      const frame = Math.floor(workerAnimationTime * (working ? 9 : 8) + index * 1.7) % 4;
      visual.map.offset.set(frame / 4, 1 - (animationRow + 1) / 6);
      visual.sprite.scale.x = (dx < 0 && row === 2 ? -1 : 1) * 1.55;
    }
  }
  return { terrainChanged };
}

function updateClaimFx(): void {
  const active = state.activeClaim;
  claimFx.visible = Boolean(active);
  if (!active) return;
  claimFx.position.set(active.x + 0.5, 0, active.z + 0.5);
  claimRing.scale.setScalar(0.7 + active.progress * 0.45);
  claimRing.rotation.z = workerAnimationTime * 1.2;
  (claimRing.material as THREE.MeshBasicMaterial).opacity = 0.45 + active.progress * 0.42;
}

const ui = document.createElement('div');
ui.className = 'geometry-ui';
ui.innerHTML = `
  <div class="geometry-badge">Spielbare 2.5D-Sandbox</div>
  <div class="geometry-resource-bar" aria-label="Ressourcen">
    <span><b data-stock="ore">0</b><i>Erz</i></span>
    <span><b data-stock="metal">0</b><i>Metall</i></span>
    <span><b data-stock="biomass">0</b><i>Biomasse</i></span>
    <span><b data-stock="ration">0</b><i>Rationen</i></span>
    <span><b data-stock="essence">0</b><i>Essenz</i></span>
    <span><b data-workers>3/5</b><i>Arbeiter</i><em data-worker-jobs>G0 K0 B0 A0</em></span>
  </div>
  <div class="geometry-resource-popups" aria-live="polite" aria-atomic="false"></div>
  <div class="geometry-view-actions" aria-label="Ansicht">
    <button type="button" data-action="fit" title="Karte einpassen">⌖</button>
    <button type="button" data-action="orientation" title="Querformat anfordern">↻</button>
    <button type="button" data-action="fullscreen" title="Vollbild umschalten">⛶</button>
  </div>
  <div class="geometry-bottom-area">
    <div class="geometry-status" role="status" aria-live="polite">
      <strong data-status-title>Gang-Werkzeug aktiv</strong>
      <span data-status-copy>Auftrag markieren; der Arbeiter läuft hin und gräbt das Feld sichtbar aus.</span>
    </div>
    <section class="geometry-popover" data-popover="build" hidden>
      <strong>Raum bauen</strong>
      <div class="geometry-room-tools">
        ${(Object.keys(ROOM_DEFINITIONS) as RoomKind[]).map((kind) => `<button type="button" data-tool="room-${kind}">${ROOM_DEFINITIONS[kind].label}<small>ab ${ROOM_DEFINITIONS[kind].minW}×${ROOM_DEFINITIONS[kind].minH}</small></button>`).join('')}
      </div>
    </section>
    <section class="geometry-popover" data-popover="work" hidden>
      <strong>Arbeitsprioritäten</strong>
      <div class="geometry-priorities">
        <button type="button" data-priority="dig">Graben <small data-priority-label="dig">Normal</small></button>
        <button type="button" data-priority="claim">Claimen <small data-priority-label="claim">Normal</small></button>
        <button type="button" data-priority="build">Bauen <small data-priority-label="build">Normal</small></button>
        <button type="button" data-priority="mine">Abbau <small data-priority-label="mine">Normal</small></button>
      </div>
    </section>
    <section class="geometry-popover" data-popover="more" hidden>
      <strong>Verwaltung</strong>
      <div class="geometry-more-grid">
        <button type="button" data-action="summon-worker">Arbeiter<small>2 Essenz</small></button>
        <button type="button" data-action="zoom-in">Zoom +</button>
        <button type="button" data-action="zoom-out">Zoom −</button>
        <button type="button" data-surface="clean" aria-pressed="true">Mauer</button>
        <button type="button" data-surface="project">Zwerg</button>
        <button type="button" data-surface="natural">Natur</button>
        <button type="button" data-action="reset">Neue Sandbox</button>
      </div>
      <div class="geometry-sandbox-summary">
        <span><b data-summary="rooms">0</b> Räume</span>
        <span><b data-summary="iron">0</b> Erz</span>
        <span><b data-summary="storage">80</b> Lager</span>
        <span><b data-summary="beds">0</b> Betten</span>
        <span><b data-summary="prison">0</b> Zellen</span>
      </div>
    </section>
    <nav class="geometry-toolbar" aria-label="Werkzeugleiste">
      <button type="button" data-tool="pan"><b>✥</b>Ansicht<small>Verschieben</small></button>
      <button type="button" data-tool="dig" aria-pressed="true"><b>⌁</b>Gang<small>Route ziehen</small></button>
      <button type="button" data-tool="chamber"><b>▣</b>Kammer<small>Fläche ziehen</small></button>
      <button type="button" data-menu="build"><b>▦</b>Bauen<small>6 Räume</small></button>
      <button type="button" data-menu="work"><b>☷</b>Arbeit<small>Prioritäten</small></button>
      <button type="button" data-menu="more"><b>•••</b>Mehr<small>Ansicht &amp; Spiel</small></button>
    </nav>
  </div>
`;
root.append(ui);

const statusTitle = ui.querySelector<HTMLElement>('[data-status-title]');
const statusCopy = ui.querySelector<HTMLElement>('[data-status-copy]');
const resourcePopups = ui.querySelector<HTMLElement>('.geometry-resource-popups');
let activeTool: SandboxTool = 'dig';

function showStatus(result: SandboxActionResult): void {
  if (statusTitle) statusTitle.textContent = result.ok ? 'Aktion abgeschlossen' : 'Aktion nicht möglich';
  if (statusCopy) statusCopy.textContent = result.message;
}

function showStoragePopup(item: 'ore' | 'biomass', amount = 1): void {
  if (!resourcePopups) return;
  const popup = document.createElement('div');
  popup.className = `geometry-resource-popup is-${item}`;
  popup.innerHTML = `<b>${item === 'ore' ? '⛏' : '✦'} +${amount}</b><span>${item === 'ore' ? 'Erz' : 'Biomasse'} eingelagert</span>`;
  popup.addEventListener('animationend', () => popup.remove(), { once: true });
  resourcePopups.append(popup);
}

function updateUi(): void {
  for (const [kind, amount] of Object.entries(state.stock)) {
    const output = ui.querySelector<HTMLElement>(`[data-stock="${kind}"]`);
    if (output) output.textContent = String(amount);
  }
  const workers = ui.querySelector<HTMLElement>('[data-workers]');
  if (workers) workers.textContent = `${workerCapacity(state)}/5`;
  const jobsOutput = ui.querySelector<HTMLElement>('[data-worker-jobs]');
  if (jobsOutput) jobsOutput.textContent = `G${state.workerJobs.dig} K${state.workerJobs.claim} B${state.workerJobs.build} A${state.workerJobs.mine}`;
  const summary: Record<string, number> = {
    rooms: state.rooms.filter(sandboxRoomComplete).length,
    iron: remainingDepositUnits(state, 'iron'),
    storage: storageCapacity(state),
    beds: sandboxBedCapacity(state),
    prison: sandboxPrisonCapacity(state),
  };
  for (const [key, value] of Object.entries(summary)) {
    const output = ui.querySelector<HTMLElement>(`[data-summary="${key}"]`);
    if (output) output.textContent = String(value);
  }
  const priorityLabels = ['Niedrig', 'Normal', 'Hoch'] as const;
  for (const task of ['dig', 'claim', 'build', 'mine'] as const) {
    const output = ui.querySelector<HTMLElement>(`[data-priority-label="${task}"]`);
    if (output) output.textContent = priorityLabels[state.workPriorities[task]];
    const button = ui.querySelector<HTMLButtonElement>(`[data-priority="${task}"]`);
    button?.classList.toggle('priority-high', state.workPriorities[task] === 2);
    button?.classList.toggle('priority-low', state.workPriorities[task] === 0);
  }
  root.dataset.rooms = String(state.rooms.length);
  root.dataset.ironRemaining = String(summary.iron);
}

function syncWorld(): void {
  rebuildGeometry();
  rebuildRooms();
  rebuildResources();
  updateActorPath();
  syncActorPosition();
  updateUi();
  knownDiscoveryCount = state.discoveredSites.size;
}

function syncTerrain(): void {
  rebuildGeometry();
  rebuildResources();
  updateActorPath();
  syncActorPosition();
  updateUi();
  if (state.discoveredSites.size > knownDiscoveryCount) {
    const newest = SANDBOX_DISCOVERY_SITES.find((site) => state.discoveredSites.has(site.id) && ![...state.discoveredSites].slice(0, knownDiscoveryCount).includes(site.id));
    if (newest) showStatus({ ok: true, message: `${newest.label} entdeckt. Der neutrale Boden wird nun Feld für Feld beansprucht.` });
    knownDiscoveryCount = state.discoveredSites.size;
  }
}

let terrainSyncQueued = false;
function scheduleTerrainSync(): void {
  if (terrainSyncQueued) return;
  terrainSyncQueued = true;
  requestAnimationFrame(() => {
    terrainSyncQueued = false;
    syncTerrain();
  });
}

function setTool(tool: SandboxTool): void {
  activeTool = tool;
  selectionPreview.visible = false;
  ui.querySelectorAll<HTMLElement>('[data-popover]').forEach((popover) => { popover.hidden = true; });
  ui.querySelectorAll<HTMLButtonElement>('[data-menu]').forEach((button) => button.setAttribute('aria-expanded', 'false'));
  ui.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.tool === tool));
  });
  const roomKind = tool.startsWith('room-') ? tool.slice(5) as RoomKind : undefined;
  if (statusTitle) statusTitle.textContent = roomKind
    ? `${ROOM_DEFINITIONS[roomKind].label} ausgewählt`
    : tool === 'pan' ? 'Ansicht verschieben' : tool === 'chamber' ? 'Kammer aufziehen' : 'Gang-Werkzeug aktiv';
  if (statusCopy) statusCopy.textContent = roomKind
    ? 'Ziehe einen passenden Bereich auf vollständig offenem Boden auf.'
    : tool === 'pan' ? 'Ziehe die Karte mit einem Finger oder der Maus.' : tool === 'chamber' ? 'Ziehe eine angeschlossene Kammer bis maximal 8 × 8 Felder auf.' : 'Tippe oder ziehe von offenem Boden in den Fels.';
  renderer.domElement.style.cursor = tool === 'pan' ? 'grab' : 'crosshair';
}

ui.querySelectorAll<HTMLButtonElement>('[data-tool]').forEach((button) => {
  button.addEventListener('click', () => setTool(button.dataset.tool as SandboxTool));
});
ui.querySelectorAll<HTMLButtonElement>('[data-menu]').forEach((button) => {
  button.addEventListener('click', () => {
    const name = button.dataset.menu;
    const target = ui.querySelector<HTMLElement>(`[data-popover="${name}"]`);
    if (!target) return;
    const open = target.hidden;
    ui.querySelectorAll<HTMLElement>('[data-popover]').forEach((popover) => { popover.hidden = true; });
    ui.querySelectorAll<HTMLButtonElement>('[data-menu]').forEach((candidate) => candidate.setAttribute('aria-expanded', 'false'));
    target.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  });
});
ui.querySelectorAll<HTMLButtonElement>('[data-surface]').forEach((button) => {
  button.addEventListener('click', () => {
    surfaceStyle = button.dataset.surface as SurfaceStyle;
    ui.querySelectorAll<HTMLButtonElement>('[data-surface]').forEach((candidate) => candidate.setAttribute('aria-pressed', String(candidate === button)));
    rebuildGeometry();
  });
});
ui.querySelectorAll<HTMLButtonElement>('[data-priority]').forEach((button) => {
  button.addEventListener('click', () => {
    const task = button.dataset.priority as 'dig' | 'claim' | 'build' | 'mine';
    state.workPriorities[task] = ((state.workPriorities[task] + 1) % 3) as 0 | 1 | 2;
    updateUi();
    showStatus({ ok: true, message: `${button.textContent?.trim() ?? task}: Priorität angepasst.` });
  });
});
ui.querySelector<HTMLButtonElement>('[data-action="fit"]')?.addEventListener('click', () => {
  cameraTarget.set(mapCenterX, 0, mapCenterZ);
  viewHeight = 38;
  updateCamera();
});
ui.querySelector<HTMLButtonElement>('[data-action="zoom-in"]')?.addEventListener('click', () => {
  viewHeight = THREE.MathUtils.clamp(viewHeight * 0.82, 9, 42);
  updateCamera();
});
ui.querySelector<HTMLButtonElement>('[data-action="zoom-out"]')?.addEventListener('click', () => {
  viewHeight = THREE.MathUtils.clamp(viewHeight * 1.18, 9, 42);
  updateCamera();
});
ui.querySelector<HTMLButtonElement>('[data-action="reset"]')?.addEventListener('click', () => {
  state = createSandboxState();
  supportCargo.clear();
  supportMotions.clear();
  workerVisuals.forEach((visual) => { visual.cargo.visible = false; });
  ensureWorkerVisuals(state.workerCount);
  actorDestinationKey = '';
  cameraTarget.set(SANDBOX_START.x, 0, SANDBOX_START.z);
  viewHeight = mobileProfile ? 15 : 20;
  updateCamera();
  syncWorld();
  showStatus({ ok: true, message: 'Große Sandbox mit neuen Erz- und Pilzvorkommen gestartet.' });
});
ui.querySelector<HTMLButtonElement>('[data-action="summon-worker"]')?.addEventListener('click', () => {
  const result = summonSandboxWorker(state);
  ensureWorkerVisuals(state.workerCount);
  showStatus(result);
  updateUi();
});

async function enterFullscreen(): Promise<boolean> {
  if (document.fullscreenElement) return true;
  try {
    await root.requestFullscreen({ navigationUI: 'hide' });
    return true;
  } catch {
    showStatus({ ok: false, message: 'Der Browser hat Vollbild blockiert. Bitte Vollbild in den Browseroptionen erlauben.' });
    return false;
  }
}

ui.querySelector<HTMLButtonElement>('[data-action="fullscreen"]')?.addEventListener('click', async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await enterFullscreen();
});

ui.querySelector<HTMLButtonElement>('[data-action="orientation"]')?.addEventListener('click', async () => {
  if (!await enterFullscreen()) return;
  const orientation = screen.orientation as ScreenOrientation & { lock?: (value: 'landscape') => Promise<void> };
  try {
    if (!orientation.lock) throw new Error('unsupported');
    await orientation.lock('landscape');
    showStatus({ ok: true, message: 'Querformat aktiv. Erneut drehen oder Vollbild verlassen, um zurückzukehren.' });
  } catch {
    showStatus({ ok: false, message: 'Dieses Gerät erlaubt keine erzwungene Drehung. Vollbild ist aktiv; bitte das Gerät quer halten.' });
  }
});

document.addEventListener('fullscreenchange', () => {
  const button = ui.querySelector<HTMLButtonElement>('[data-action="fullscreen"]');
  if (button) button.textContent = document.fullscreenElement ? '×' : '⛶';
  updateCamera();
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
function mapCellAt(clientX: number, clientY: number): { x: number; z: number } | undefined {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(digPlane, false)[0];
  if (!hit) return undefined;
  const cell = { x: Math.floor(hit.point.x), z: Math.floor(hit.point.z) };
  if (cell.x < SANDBOX_BOUNDS.minX || cell.x > SANDBOX_BOUNDS.maxX || cell.z < SANDBOX_BOUNDS.minZ || cell.z > SANDBOX_BOUNDS.maxZ) return undefined;
  return cell;
}

function updateSelection(start: { x: number; z: number }, end: { x: number; z: number }): void {
  const rect = normalizedRect(start, end);
  selectionPreview.position.set(rect.x + rect.w / 2, 0.1, rect.z + rect.h / 2);
  selectionPreview.scale.set(rect.w, 1, rect.h);
  selectionPreview.visible = true;
  if (activeTool.startsWith('room-')) {
    const validation = validateSandboxRoom(state, activeTool.slice(5) as RoomKind, start, end);
    selectionMaterial.color.set(validation.ok ? 0x63d9ad : 0xe66554);
  } else {
    selectionMaterial.color.set(rect.w <= 8 && rect.h <= 8 ? 0x63d9ad : 0xe66554);
  }
}

function digLine(from: { x: number; z: number }, to: { x: number; z: number }): boolean {
  let changed = false;
  let x = from.x;
  let z = from.z;
  const visit = (): void => {
    const result = planSandboxDigCell(state, x, z);
    changed = result.ok || changed;
  };
  while (x !== to.x) {
    x += Math.sign(to.x - x);
    visit();
  }
  while (z !== to.z) {
    z += Math.sign(to.z - z);
    visit();
  }
  return changed;
}

let dragging = false;
let pointerStart = { x: 0, y: 0 };
let lastPointer = { x: 0, y: 0 };
let selectionStart: { x: number; z: number } | undefined;
let lastDigCell: { x: number; z: number } | undefined;
let pendingTouchDig: { x: number; z: number } | undefined;
const activePointers = new Map<number, { x: number; y: number }>();
let pinching = false;
let pinchStartDistance = 0;
let pinchStartViewHeight = viewHeight;

function pointerDistance(): number {
  const points = [...activePointers.values()];
  return points.length < 2 ? 0 : Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (event.pointerType === 'touch' && activePointers.size >= 2) {
    pinching = true;
    pinchStartDistance = Math.max(1, pointerDistance());
    pinchStartViewHeight = viewHeight;
    pendingTouchDig = undefined;
    selectionStart = undefined;
    lastDigCell = undefined;
    selectionPreview.visible = false;
    return;
  }
  dragging = true;
  pointerStart = { x: event.clientX, y: event.clientY };
  lastPointer = { ...pointerStart };
  renderer.domElement.setPointerCapture(event.pointerId);
  renderer.domElement.classList.add('dragging');
  const cell = mapCellAt(event.clientX, event.clientY);
  if (!cell || activeTool === 'pan') return;
  if (activeTool === 'dig') {
    if (event.pointerType === 'touch') {
      pendingTouchDig = cell;
      lastDigCell = cell;
      return;
    }
    const result = planSandboxDigCell(state, cell.x, cell.z);
    lastDigCell = cell;
    if (result.ok) scheduleTerrainSync();
    else showStatus(result);
    return;
  }
  selectionStart = cell;
  updateSelection(cell, cell);
});

renderer.domElement.addEventListener('pointermove', (event) => {
  if (activePointers.has(event.pointerId)) activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pinching && activePointers.size >= 2) {
    const distance = Math.max(1, pointerDistance());
    viewHeight = THREE.MathUtils.clamp(pinchStartViewHeight * pinchStartDistance / distance, 9, 42);
    updateCamera();
    return;
  }
  const cell = mapCellAt(event.clientX, event.clientY);
  if (!dragging) {
    renderer.domElement.style.cursor = activeTool === 'pan' ? 'grab' : cell && canPlanSandboxCell(state, cell.x, cell.z) ? 'crosshair' : 'default';
    return;
  }
  if (activeTool === 'pan') {
    const scale = viewHeight / Math.max(320, window.innerHeight);
    cameraTarget.x -= (event.clientX - lastPointer.x) * scale;
    cameraTarget.z -= (event.clientY - lastPointer.y) * scale;
    lastPointer = { x: event.clientX, y: event.clientY };
    updateCamera();
    return;
  }
  if (activeTool === 'dig' && cell && lastDigCell && (cell.x !== lastDigCell.x || cell.z !== lastDigCell.z)) {
    if (pendingTouchDig) {
      const initial = planSandboxDigCell(state, pendingTouchDig.x, pendingTouchDig.z);
      if (initial.ok) scheduleTerrainSync();
      pendingTouchDig = undefined;
    }
    const changed = digLine(lastDigCell, cell);
    lastDigCell = cell;
    if (changed) scheduleTerrainSync();
    return;
  }
  if (selectionStart && cell) updateSelection(selectionStart, cell);
});

function finishPointer(event: PointerEvent): void {
  activePointers.delete(event.pointerId);
  if (pinching) {
    if (activePointers.size < 2) pinching = false;
    dragging = false;
    pendingTouchDig = undefined;
    selectionStart = undefined;
    lastDigCell = undefined;
    selectionPreview.visible = false;
    if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
    return;
  }
  if (!dragging) return;
  const cell = mapCellAt(event.clientX, event.clientY);
  if (pendingTouchDig && activeTool === 'dig') {
    const result = planSandboxDigCell(state, pendingTouchDig.x, pendingTouchDig.z);
    showStatus(result);
    if (result.ok) scheduleTerrainSync();
  }
  if (selectionStart && cell) {
    const result = activeTool === 'chamber'
      ? excavateSandboxChamber(state, selectionStart, cell)
      : activeTool.startsWith('room-')
        ? placeSandboxRoom(state, activeTool.slice(5) as RoomKind, selectionStart, cell)
        : undefined;
    if (result) {
      showStatus(result);
      if (result.ok) {
        if (activeTool === 'chamber') scheduleTerrainSync();
        else {
          rebuildRooms();
          updateUi();
        }
      }
    }
  }
  dragging = false;
  selectionStart = undefined;
  lastDigCell = undefined;
  pendingTouchDig = undefined;
  selectionPreview.visible = false;
  renderer.domElement.classList.remove('dragging');
  if (renderer.domElement.hasPointerCapture(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
}
renderer.domElement.addEventListener('pointerup', finishPointer);
renderer.domElement.addEventListener('pointercancel', finishPointer);
renderer.domElement.addEventListener('wheel', (event) => {
  event.preventDefault();
  viewHeight = THREE.MathUtils.clamp(viewHeight * Math.exp(event.deltaY * 0.001), 9, 42);
  updateCamera();
}, { passive: false });

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobileProfile ? 1 : 1.25));
  updateCamera();
});

const timer = new THREE.Timer();
timer.connect(document);
let lastRenderedAt = 0;
let uiClock = 0;
function animate(timestamp: number): void {
  requestAnimationFrame(animate);
  if (document.hidden) return;
  const interval = 1000 / (dragging ? 60 : 30);
  const elapsed = timestamp - lastRenderedAt;
  if (elapsed < interval) return;
  lastRenderedAt = timestamp - (elapsed % interval);
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.05);
  const actorTick = updateActor(delta);
  const tick = tickSandboxEconomy(state, delta, { autonomousDigging: false, autonomousClaiming: false, autonomousMining: false });
  const supportTick = updateSupportWorkers(delta);
  updateClaimFx();
  if (actorTick.terrainChanged) scheduleTerrainSync();
  if (supportTick.terrainChanged) scheduleTerrainSync();
  if (tick.terrainChanged) scheduleTerrainSync();
  if (tick.roomsChanged) {
    rebuildRooms();
    updateUi();
  }
  if (tick.resourcesChanged) rebuildResources();
  uiClock += delta;
  if (uiClock >= 0.25) {
    updateUi();
    uiClock = 0;
  }
  renderer.render(scene, camera);
}

updateCamera();
syncWorld();
setTool('dig');
root.dataset.ready = 'true';
document.documentElement.dataset.geometryProofReady = 'true';
document.querySelector('.geometry-loading')?.remove();
requestAnimationFrame(animate);

window.addEventListener('beforeunload', () => {
  timer.dispose();
  renderer.dispose();
  tileGeometry.dispose();
  unitBox.dispose();
  closedRockGeometries.forEach((geometry) => geometry.dispose());
  actorShadowGeometry.dispose();
  selectionGeometry.dispose();
  resourceGeometry.dispose();
  digPlane.geometry.dispose();
}, { once: true });
