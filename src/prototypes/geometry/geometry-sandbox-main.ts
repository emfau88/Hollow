import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
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
  activeSandboxEnemy,
  advanceSandboxCombat,
  advanceSandboxClaiming,
  advanceSandboxDigging,
  advanceSandboxMining,
  canDigSandboxCell,
  canPlanSandboxCell,
  createSandboxState,
  deliverSandboxResource,
  deliverSandboxKitchenBiomass,
  excavateSandboxChamber,
  normalizedRect,
  nextSandboxClaimTarget,
  feedSandboxCreature,
  planSandboxDigCell,
  placeSandboxRoom,
  pickupSandboxKitchenBiomass,
  pickupSandboxKitchenRation,
  remainingDepositUnits,
  sandboxBedCapacity,
  sandboxPrisonCapacity,
  storageCapacity,
  sandboxRoomComplete,
  sandboxCreatureHungry,
  sandboxLoopProgress,
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
import { createGeometryVisualTruthState, VISUAL_TRUTH_GROTTO } from './GeometryVisualTruthState';
import {
  VISUAL_TRUTH_SPRITES,
  type SpritePresentation,
  type VisualTruthSpriteKey,
} from './GeometryVisualTruthPresentation';
import {
  classifyWallCorners,
  findPassageThresholds,
  type PassageThreshold,
  type WallCorner,
} from './GeometryWallArchitecture';
import './geometry-proof-style.css';

type SurfaceStyle = ProceduralWallStyle;
type SandboxTool = 'pan' | 'dig' | 'chamber' | `room-${RoomKind}`;

const rootElement = document.querySelector<HTMLElement>('#geometry-proof');
const canvasHostElement = document.querySelector<HTMLElement>('#geometry-canvas');
if (!rootElement || !canvasHostElement) throw new Error('Geometry sandbox host is missing.');
const root = rootElement;
const canvasHost = canvasHostElement;
const visualTruthMode = new URLSearchParams(window.location.search).get('visual-truth') === '1';
root.dataset.visualTruth = String(visualTruthMode);
const discoverySites = visualTruthMode ? [VISUAL_TRUTH_GROTTO] : SANDBOX_DISCOVERY_SITES;

const theme = resolveVisualTheme('?theme=style-b');
const mobileProfile = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x071427);
scene.fog = new THREE.FogExp2(0x071427, 0.0045);

const renderer = new THREE.WebGLRenderer({ antialias: !mobileProfile, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobileProfile ? 1 : 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
canvasHost.append(renderer.domElement);

const camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 100);
const cameraTarget = visualTruthMode
  ? new THREE.Vector3(12.7, 0, 24)
  : new THREE.Vector3(SANDBOX_START.x, 0, SANDBOX_START.z);
// Keep enough pitch to read the floor plan, but expose the inner wall facades
// instead of reducing the room to a mostly top-down ring of wall caps.
const cameraOffset = visualTruthMode
  ? new THREE.Vector3(0, 15.5, 11.5)
  : new THREE.Vector3(0, 17.5, 10.5);
let viewHeight = visualTruthMode ? (mobileProfile ? 16.5 : 15) : (mobileProfile ? 15 : 20);

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
  truthClosedRockMap,
  truthGrottoFloorMap,
  workerMap,
  guardMap,
  crawlerMap,
  adeptMap,
  rationMap,
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
  loadMap('assets/generated/geometry-sandbox-v2/visual-truth/closed-rock-style-b-v1.png'),
  loadMap('assets/generated/geometry-sandbox-v2/visual-truth/grotto-floor-style-b-v1.png'),
  loadMap(theme.assets.workerAnimation ?? theme.assets.worker),
  loadMap(theme.assets.guard),
  loadMap('assets/generated/units-v1/crawler.png'),
  loadMap('assets/generated/units-v1/adept.png'),
  loadMap('assets/generated/units-v1/item-ration.png'),
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
  workerMap, guardMap, crawlerMap, adeptMap, rationMap, heartBackplateMap, heartCoreMap, heartBezelMap, heartPulpitMap,
  ironMap, fungusMap, storageMap, bedMap, cauldronMap, furnaceMap, workbenchMap, prisonMap,
  fungusMediumMap, fungusSmallMap, grottoStationMap, suppliesMap,
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
  start: standardMaterial({ color: 0xd2c4c8, map: floorMap, roughness: 0.88 }),
  claimed: visualTruthMode
    ? new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: corridorMap,
      emissive: 0x172638,
      emissiveIntensity: 0.18,
      roughness: 0.94,
    })
    : standardMaterial({ color: 0xa9b4c5, map: corridorMap, roughness: 0.94 }),
  raw: standardMaterial({ color: 0x667e9d, map: rawFloorMap, roughness: 1 }),
  cavern: standardMaterial({ color: visualTruthMode ? 0xb8d5c7 : 0x78a995, map: visualTruthMode ? truthGrottoFloorMap : dampFloorMap, roughness: 1 }),
};
const bedrockMaterial = standardMaterial({ color: 0x20314e, map: rockMap, roughness: 1 });
const geologyMaterials = {
  basalt: standardMaterial({ color: 0x455e7f, map: rockBasaltMap, roughness: 1 }),
  roots: standardMaterial({ color: 0x58605f, map: rockRootsMap, roughness: 1 }),
  damp: standardMaterial({ color: 0x48786e, map: rockDampMap, roughness: 1 }),
  earth: standardMaterial({ color: 0x765d52, map: rockEarthMap, roughness: 1 }),
};
const closedRockMaterials = [
  standardMaterial({ color: 0x91a9c7, map: visualTruthMode ? undefined : rockBasaltMap, roughness: 1 }),
  standardMaterial({ color: 0x78a695, map: visualTruthMode ? undefined : rockDampMap, roughness: 1 }),
  standardMaterial({ color: 0xa08372, map: visualTruthMode ? undefined : rockEarthMap, roughness: 1 }),
  standardMaterial({ color: 0x858e8c, map: visualTruthMode ? undefined : rockRootsMap, roughness: 1 }),
];
const truthClosedRockMaterial = standardMaterial({ color: 0xffffff, map: truthClosedRockMap, roughness: 1 });
bedrockMaterial.emissive.setHex(0x000000);
bedrockMaterial.emissiveIntensity = 0;
closedRockMaterials.forEach((material) => {
  material.emissive.setHex(0x000000);
  material.emissiveIntensity = 0;
});
for (const material of Object.values(geologyMaterials)) {
  material.transparent = false;
  material.opacity = 1;
  material.depthWrite = true;
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
    side: standardMaterial({ color: visualTruthMode ? 0xd0a6b8 : 0xa7bdd2, map: generatedWallSideMap, roughness: visualTruthMode ? 0.92 : 0.9 }),
    cap: standardMaterial({ color: visualTruthMode ? 0xd9e2e5 : 0xeee2c9, map: generatedWallCapMap, roughness: visualTruthMode ? 0.84 : 0.82 }),
    base: standardMaterial({ color: visualTruthMode ? 0x2d3446 : 0x73849a, map: visualTruthMode ? generatedWallSideMap : generatedWallCapMap, roughness: visualTruthMode ? 0.98 : 0.96 }),
    post: standardMaterial({ color: visualTruthMode ? 0xb8aa93 : 0xd8a532, map: generatedWallCapMap, roughness: visualTruthMode ? 0.88 : 0.76, metalness: visualTruthMode ? 0.02 : 0.08 }),
  },
  natural: {
    side: standardMaterial({ color: 0xffffff, map: wallAssets.natural.side, roughness: 0.98 }),
    cap: standardMaterial({ color: 0xffffff, map: wallAssets.natural.cap, roughness: 0.92 }),
    base: standardMaterial({ color: 0x15333e, roughness: 1 }),
    post: standardMaterial({ color: 0x426c69, roughness: 0.98 }),
  },
};
if (visualTruthMode) {
  wallFamilies.project.side.emissive.setHex(0x251629);
  wallFamilies.project.side.emissiveIntensity = 0.22;
  wallFamilies.project.cap.emissive.setHex(0x27313a);
  wallFamilies.project.cap.emissiveIntensity = 0.16;
}
const foregroundFamilies = Object.fromEntries(
  (Object.keys(wallFamilies) as SurfaceStyle[]).map((key) => {
    const family = Object.fromEntries(
      (Object.keys(wallFamilies[key]) as Array<keyof WallFamily>).map((part) => {
        const material = wallFamilies[key][part].clone();
        material.transparent = false;
        material.opacity = 1;
        material.depthWrite = true;
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
const wallStoneGeometry = new RoundedBoxGeometry(1, 1, 1, 2, 0.055);
const closedRockMassGeometry = new THREE.BoxGeometry(1, 1, 1);
const naturalRockGeometry = new THREE.DodecahedronGeometry(0.5, 0);
const closedRockGeometries = [
  naturalRockGeometry,
  new THREE.IcosahedronGeometry(0.5, 0),
  new THREE.OctahedronGeometry(0.5, 1),
];
const lightOrbGeometry = new THREE.SphereGeometry(0.11, 10, 8);
const actorShadowGeometry = new THREE.CircleGeometry(0.5, 24).rotateX(-Math.PI / 2);
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
const visualTruthWallMaterials = {
  capHighlight: standardMaterial({ color: 0xffffff, map: generatedWallCapMap, roughness: 0.78 }),
  shadowJoint: standardMaterial({ color: 0x171725, roughness: 1 }),
  corridorSide: standardMaterial({ color: 0x596d76, map: generatedWallSideMap, roughness: 0.98 }),
  corridorCap: standardMaterial({ color: 0xa5b0a9, map: generatedWallCapMap, roughness: 0.92 }),
  brassInset: standardMaterial({ color: 0x6b3e0c, roughness: 0.62, metalness: 0.18 }),
  brassHighlight: standardMaterial({ color: 0xffdc7a, roughness: 0.4, metalness: 0.22 }),
  naturalSill: standardMaterial({ color: 0x527d72, map: truthGrottoFloorMap, roughness: 1 }),
  naturalMarker: new THREE.MeshStandardMaterial({
    color: 0x55c9a2,
    emissive: 0x174f4b,
    emissiveIntensity: 0.55,
    roughness: 0.72,
  }),
};
const visualTruthCorridorFloorMaterial = new THREE.MeshStandardMaterial({
  color: 0xc8d1d4,
  map: corridorMap,
  emissive: 0x718698,
  emissiveIntensity: 0.48,
  roughness: 0.9,
  metalness: 0.01,
});
visualTruthWallMaterials.corridorSide.emissive.setHex(0x4e5d63);
visualTruthWallMaterials.corridorSide.emissiveIntensity = 0.42;
const wallContactShadowMaterial = new THREE.MeshBasicMaterial({
  color: 0x020710,
  transparent: true,
  opacity: 0.2,
  depthWrite: false,
});
const spriteContactShadowMaterial = new THREE.MeshBasicMaterial({
  color: 0x01050b,
  transparent: true,
  opacity: 0.2,
  depthWrite: false,
});
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

function cellSurfaceGeometry(cells: Array<{ x: number; z: number }>, y: number, textureSpan = 8): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  cells.forEach((cell, index) => {
    const base = index * 4;
    positions.push(
      cell.x, y, cell.z,
      cell.x + 1, y, cell.z,
      cell.x + 1, y, cell.z + 1,
      cell.x, y, cell.z + 1,
    );
    uvs.push(
      cell.x / textureSpan, cell.z / textureSpan,
      (cell.x + 1) / textureSpan, cell.z / textureSpan,
      (cell.x + 1) / textureSpan, (cell.z + 1) / textureSpan,
      cell.x / textureSpan, (cell.z + 1) / textureSpan,
    );
    indices.push(base, base + 2, base + 1, base, base + 3, base + 2);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
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

function createContactShadow(
  parent: THREE.Object3D,
  x: number,
  z: number,
  width: number,
  depth: number,
  material = spriteContactShadowMaterial,
): THREE.Mesh {
  const shadow = new THREE.Mesh(actorShadowGeometry, material);
  shadow.position.set(x, 0.04, z + 0.055);
  shadow.scale.set(width, 1, depth);
  shadow.renderOrder = 2;
  parent.add(shadow);
  return shadow;
}

function addGroundedSprite(
  parent: THREE.Object3D,
  material: THREE.SpriteMaterial,
  x: number,
  z: number,
  presentation: SpritePresentation,
  renderOrder: number,
  scale = 1,
): { sprite: THREE.Sprite; shadow: THREE.Mesh } {
  const sprite = addSprite(
    parent,
    material,
    x,
    0.055,
    z,
    presentation.width * scale,
    presentation.height * scale,
    renderOrder,
  );
  sprite.center.set(0.5, presentation.anchorY);
  const shadow = createContactShadow(
    parent,
    x,
    z,
    presentation.shadowWidth * scale,
    presentation.shadowDepth * scale,
  );
  return { sprite, shadow };
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
  guard: spriteMaterial(guardMap),
  enemy: spriteMaterial(crawlerMap),
  creature: spriteMaterial(adeptMap),
  ration: spriteMaterial(rationMap),
  iron: spriteMaterial(ironMap),
  fungusMedium: spriteMaterial(fungusMediumMap),
  fungusSmall: spriteMaterial(fungusSmallMap),
  grottoStation: spriteMaterial(grottoStationMap),
  supplies: spriteMaterial(suppliesMap),
  cart: spriteMaterial(cartMap),
  rack: spriteMaterial(rackMap),
  lamp: spriteMaterial(lampMap),
  banner: spriteMaterial(bannerMap),
};

function addVisualTruthSprite(
  parent: THREE.Object3D,
  key: VisualTruthSpriteKey,
  material: THREE.SpriteMaterial,
  x: number,
  z: number,
  renderOrder: number,
  scale = 1,
): { sprite: THREE.Sprite; shadow: THREE.Mesh } {
  return addGroundedSprite(parent, material, x, z, VISUAL_TRUTH_SPRITES[key], renderOrder, scale);
}
const resourceMaterials = {
  iron: new THREE.MeshBasicMaterial({ map: ironMap, transparent: true, alphaTest: 0.035, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  fungus: new THREE.MeshBasicMaterial({ map: fungusMap, transparent: true, alphaTest: 0.035, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
};
const hintMaterials = {
  iron: new THREE.SpriteMaterial({ map: ironMap, color: 0xffd47a, transparent: true, opacity: 0.78, alphaTest: 0.02, depthWrite: false, toneMapped: false }),
  fungus: new THREE.SpriteMaterial({ map: fungusMap, color: 0x8fffd7, transparent: true, opacity: 0.82, alphaTest: 0.02, depthWrite: false, toneMapped: false }),
};
const cargoMaterials = {
  ore: new THREE.SpriteMaterial({ map: ironMap, transparent: true, alphaTest: 0.035, depthWrite: false, toneMapped: false }),
  biomass: new THREE.SpriteMaterial({ map: fungusMap, transparent: true, alphaTest: 0.035, depthWrite: false, toneMapped: false }),
  ration: new THREE.SpriteMaterial({ map: rationMap, transparent: true, alphaTest: 0.035, depthWrite: false, toneMapped: false }),
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
heartPlinth.castShadow = !visualTruthMode;
heartPlinth.receiveShadow = true;
world.add(heartPlinth);
// Match the source setpiece ratios. The baked room-base image is intentionally
// omitted because the reserved heart floor is real geometry in this renderer.
addSprite(world, spriteMaterials.heartBackplate, heartX, 1.16, heartZ - 0.08, 2.65, 2.65, 10);
addSprite(world, spriteMaterials.heartCore, heartX, 1.16, heartZ, 1.06, 1.06, 11);
addSprite(world, spriteMaterials.heartBezel, heartX, 1.16, heartZ + 0.03, 1.4, 1.4, 12);
addSprite(world, spriteMaterials.heartPulpit, heartX, 0.47, heartZ + 0.24, 1.86, 1.27, 13);
if (visualTruthMode) {
  addSprite(world, spriteMaterials.lamp, 4.6, 0.54, 22.62, VISUAL_TRUTH_SPRITES.lamp.width, VISUAL_TRUTH_SPRITES.lamp.height, 9);
  addSprite(world, spriteMaterials.lamp, 10.9, 0.54, 22.62, VISUAL_TRUTH_SPRITES.lamp.width, VISUAL_TRUTH_SPRITES.lamp.height, 9);
  addSprite(world, spriteMaterials.banner, 7.5, 0.67, 22.48, VISUAL_TRUTH_SPRITES.banner.width, VISUAL_TRUTH_SPRITES.banner.height, 9);
  addVisualTruthSprite(world, 'rack', spriteMaterials.rack, 4.15, 27.15, 9);
  addVisualTruthSprite(world, 'cart', spriteMaterials.cart, 10.75, 27.15, 9);
  addVisualTruthSprite(world, 'supplies', spriteMaterials.supplies, 9.75, 27.18, 9);
}

interface WorkerVisual {
  sprite: THREE.Sprite;
  shadow: THREE.Mesh;
  cargo: THREE.Sprite;
  map: THREE.Texture;
}
const workerVisuals: WorkerVisual[] = [];
const workerGroundY = visualTruthMode ? 0.055 : 0.82;
function ensureWorkerVisuals(targetCount: number): void {
  while (workerVisuals.length < targetCount) {
    const index = workerVisuals.length;
    const map = index === 0 ? workerMap : workerMap.clone();
    map.needsUpdate = true;
    if (workerAnimated) {
      map.repeat.set(1 / 4, 1 / 6);
      map.offset.set(0, 5 / 6);
    }
    const x = SANDBOX_START.x + 0.5 - index * 0.65;
    const z = SANDBOX_START.z + 0.5 + (index % 2) * 0.55;
    const material = spriteMaterial(map);
    let sprite: THREE.Sprite;
    let shadow: THREE.Mesh;
    if (visualTruthMode) {
      ({ sprite, shadow } = addGroundedSprite(world, material, x, z, VISUAL_TRUTH_SPRITES.worker, 20 + index));
    } else {
      sprite = addSprite(world, material, x, workerGroundY, z, 1.55, 1.55, 20 + index);
      shadow = new THREE.Mesh(
        actorShadowGeometry,
        new THREE.MeshBasicMaterial({ color: 0x01050b, transparent: true, opacity: 0.46, depthWrite: false }),
      );
      shadow.position.set(x, 0.045, z + 0.06);
      shadow.scale.set(0.84, 1, 0.84);
      world.add(shadow);
    }
    const cargo = addSprite(world, cargoMaterials.ore, sprite.position.x, 1.46, sprite.position.z, 0.38, 0.38, 30 + index);
    cargo.visible = false;
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
      transparent: false,
      opacity: 1,
      depthWrite: true,
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

const ambient = new THREE.AmbientLight(0x8ca4bd, 0.22);
const hemisphere = new THREE.HemisphereLight(0xa9c5db, 0x07101f, 0.72);
const keyLight = new THREE.DirectionalLight(0xffd99b, 3.25);
keyLight.position.set(-8, 22, 15);
keyLight.target.position.set(18, 0, 18);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(mobileProfile ? 512 : 1024, mobileProfile ? 512 : 1024);
keyLight.shadow.camera.left = -20;
keyLight.shadow.camera.right = 20;
keyLight.shadow.camera.top = 20;
keyLight.shadow.camera.bottom = -20;
scene.add(ambient, hemisphere, keyLight, keyLight.target);
const heartLight = new THREE.PointLight(0xff765f, 6.5, 7, 1.8);
heartLight.position.set(heartX, 3.2, heartZ);
scene.add(heartLight);

let state = visualTruthMode ? createGeometryVisualTruthState() : createSandboxState();
let knownDiscoveryCount = state.discoveredSites.size;
let knownRationsProduced = 0;
let surfaceStyle: SurfaceStyle = 'project';
let geometryGroup = new THREE.Group();
let resourceGroup = new THREE.Group();
let roomGroup = new THREE.Group();
let lightingGroup = new THREE.Group();
let closedRockGroup = new THREE.Group();
let lastRockOpenCount = -1;
world.add(closedRockGroup, geometryGroup, resourceGroup, roomGroup, lightingGroup);

const guardianGroundY = visualTruthMode ? 0.055 : 0.88;
const guardianBaseWidth = visualTruthMode ? VISUAL_TRUTH_SPRITES.guard.width : 1.62;
const guardianBaseHeight = visualTruthMode ? VISUAL_TRUTH_SPRITES.guard.height : 1.62;
const guardian = addSprite(
  world,
  spriteMaterials.guard,
  SANDBOX_START.x + 0.5,
  guardianGroundY,
  SANDBOX_START.z - 2.5,
  guardianBaseWidth,
  guardianBaseHeight,
  24,
);
if (visualTruthMode) guardian.center.set(0.5, VISUAL_TRUTH_SPRITES.guard.anchorY);
const guardianShadow = visualTruthMode
  ? createContactShadow(
    world,
    guardian.position.x,
    guardian.position.z,
    VISUAL_TRUTH_SPRITES.guard.shadowWidth,
    VISUAL_TRUTH_SPRITES.guard.shadowDepth,
  )
  : new THREE.Mesh(
    actorShadowGeometry,
    new THREE.MeshBasicMaterial({ color: 0x01050b, transparent: true, opacity: 0.5, depthWrite: false }),
  );
if (!visualTruthMode) {
  guardianShadow.position.set(guardian.position.x, 0.045, guardian.position.z + 0.06);
  guardianShadow.scale.set(0.84, 1, 0.84);
  world.add(guardianShadow);
}
const grottoEnemy = addSprite(world, spriteMaterials.enemy, 24.5, 0.9, 15.5, 1.72, 1.72, 25);
grottoEnemy.visible = false;
const enemyHealthBack = new THREE.Mesh(
  new THREE.PlaneGeometry(1.05, 0.11),
  new THREE.MeshBasicMaterial({ color: 0x230b14, transparent: true, opacity: 0.92, depthTest: false }),
);
const enemyHealthFill = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 0.07),
  new THREE.MeshBasicMaterial({ color: 0xe75d61, depthTest: false }),
);
enemyHealthBack.renderOrder = 40;
enemyHealthFill.renderOrder = 41;
world.add(enemyHealthBack, enemyHealthFill);
const covenantCreature = addSprite(
  world,
  spriteMaterials.creature,
  state.creature.x + 0.5,
  0.88,
  state.creature.z + 0.5,
  1.58,
  1.58,
  23,
);
covenantCreature.visible = !visualTruthMode;
const creatureNeedIcon = addSprite(
  world,
  spriteMaterials.ration,
  state.creature.x + 0.95,
  1.55,
  state.creature.z + 0.15,
  0.44,
  0.44,
  35,
);

function rockMaterialIndex(x: number, z: number): number {
  const fungal = discoverySites.some((site) => site.kind === 'fungus' && Math.hypot(x - (site.x + site.w / 2), z - (site.z + site.h / 2)) < 6.5);
  if (fungal) return 1;
  const iron = state.deposits.some((deposit) => deposit.kind === 'iron' && Math.hypot(x - deposit.x, z - deposit.z) < 3.2);
  if (iron) return 2;
  if (x < 18 && z < 16) return 3;
  if ((x > 32 && z < 16) || (x > 31 && z > 24)) return 2;
  return 0;
}

function rebuildClosedRockField(): void {
  if (lastRockOpenCount === state.openCells.size) return;
  lastRockOpenCount = state.openCells.size;
  world.remove(closedRockGroup);
  closedRockGroup.clear();
  closedRockGroup = new THREE.Group();
  const massMatrices: THREE.Matrix4[][] = closedRockMaterials.map(() => []);
  const accentMatrices: THREE.Matrix4[][][] = closedRockMaterials.map(() => closedRockGeometries.map(() => []));
  const closedCells: Array<{ x: number; z: number }> = [];
  for (let z = SANDBOX_BOUNDS.minZ; z <= SANDBOX_BOUNDS.maxZ; z += 1) {
    for (let x = SANDBOX_BOUNDS.minX; x <= SANDBOX_BOUNDS.maxX; x += 1) {
      if (state.openCells.has(proofCellKey(x, z)) || (!visualTruthMode && discoverySites.some((site) => siteContains(site, x, z)))) continue;
      closedCells.push({ x, z });
      const seed = x * 92821 + z * 68917;
      const materialIndex = rockMaterialIndex(x, z);
      // The closed map is a single high bedrock body. Sparse larger stones break
      // its silhouette without turning every cell into an isolated pebble.
      massMatrices[materialIndex].push(matrixAt(x + 0.5, 0.38, z + 0.5, 1.025, 0.76, 1.025));
      if (visualTruthMode || edgeHash({ key: `${x}:${z}`, x, z, axis: 'horizontal', side: 'north', start: { x, z }, end: { x: x + 1, z } }, 73) % 5 !== 0) continue;
      const shapeIndex = Math.min(closedRockGeometries.length - 1, Math.floor(seededUnit(seed + 17) * closedRockGeometries.length));
      accentMatrices[materialIndex][shapeIndex].push(new THREE.Matrix4().compose(
        new THREE.Vector3(x + 0.5 + (seededUnit(seed + 3) - 0.5) * 0.24, 0.78, z + 0.5 + (seededUnit(seed + 5) - 0.5) * 0.24),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, seededUnit(seed + 11) * Math.PI, 0)),
        new THREE.Vector3(0.62 + seededUnit(seed + 7) * 0.22, 0.28 + seededUnit(seed + 13) * 0.14, 0.62 + seededUnit(seed + 9) * 0.22),
      ));
    }
  }
  massMatrices.forEach((entries, materialIndex) => (
    addInstances(closedRockMassGeometry, closedRockMaterials[materialIndex], entries, closedRockGroup, true)
  ));
  accentMatrices.forEach((forms, materialIndex) => forms.forEach((entries, shapeIndex) => (
    addInstances(closedRockGeometries[shapeIndex], closedRockMaterials[materialIndex], entries, closedRockGroup, true)
  )));
  if (visualTruthMode) {
    const top = new THREE.Mesh(cellSurfaceGeometry(closedCells, 0.765, 8), truthClosedRockMaterial);
    top.receiveShadow = true;
    top.castShadow = true;
    closedRockGroup.add(top);
  }
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

function edgeCourseMatrices(
  edges: BoundaryEdge[],
  y: number,
  height: number,
  thickness: number,
  segments: number,
  stagger = 0,
  outward = 0,
  segmentGap = 0.025,
): THREE.Matrix4[] {
  const matrices: THREE.Matrix4[] = [];
  const segmentLength = 0.96 / segments;
  for (const edge of edges) {
    const offset = edge.side === 'north' ? { x: 0, z: -outward }
      : edge.side === 'south' ? { x: 0, z: outward }
        : edge.side === 'east' ? { x: outward, z: 0 }
          : { x: -outward, z: 0 };
    for (let segment = 0; segment < segments; segment += 1) {
      const along = -0.48 + segmentLength * (segment + 0.5) + stagger;
      const clamped = THREE.MathUtils.clamp(along, -0.48 + segmentLength / 2, 0.48 - segmentLength / 2);
      matrices.push(matrixAt(
        edge.x + offset.x + (edge.axis === 'horizontal' ? clamped : 0),
        y,
        edge.z + offset.z + (edge.axis === 'vertical' ? clamped : 0),
        edge.axis === 'horizontal' ? segmentLength - segmentGap : thickness,
        height,
        edge.axis === 'vertical' ? segmentLength - segmentGap : thickness,
      ));
    }
  }
  return matrices;
}

function wallContactMatrices(edges: BoundaryEdge[], depth: number): THREE.Matrix4[] {
  return edges.map((edge) => {
    const offset = depth * 0.62;
    const inward = edge.side === 'north' ? { x: 0, z: offset }
      : edge.side === 'south' ? { x: 0, z: -offset }
        : edge.side === 'east' ? { x: -offset, z: 0 }
          : { x: offset, z: 0 };
    return matrixAt(
      edge.x + inward.x,
      0.035,
      edge.z + inward.z,
      edge.axis === 'horizontal' ? 1.02 : depth,
      0.018,
      edge.axis === 'vertical' ? 1.02 : depth,
    );
  });
}

function cornerMatrices(corners: WallCorner[], kind: WallCorner['kind'], y: number, height: number, width: number): THREE.Matrix4[] {
  return corners
    .filter((corner) => corner.kind === kind)
    .map((corner) => matrixAt(corner.x, y, corner.z, width, height, width));
}

function thresholdBarMatrices(thresholds: PassageThreshold[], y: number, height: number, width: number): THREE.Matrix4[] {
  return thresholds.map((threshold) => matrixAt(
    threshold.x,
    y,
    threshold.z,
    threshold.vertical ? width : 0.92,
    height,
    threshold.vertical ? 0.92 : width,
  ));
}

function thresholdEndMatrices(thresholds: PassageThreshold[], y: number, height: number, size: number): THREE.Matrix4[] {
  const matrices: THREE.Matrix4[] = [];
  for (const threshold of thresholds) {
    for (const offset of [-0.39, 0.39]) {
      matrices.push(matrixAt(
        threshold.x + (threshold.vertical ? 0 : offset),
        y,
        threshold.z + (threshold.vertical ? offset : 0),
        size,
        height,
        size,
      ));
    }
  }
  return matrices;
}

function addVisualTruthWallFamily(
  edges: BoundaryEdge[],
  family: WallFamily,
  corners: WallCorner[],
  parent: THREE.Object3D,
): void {
  // A dark structural core prevents hairline gaps while separately modelled
  // courses and caps provide the chunky Style-B silhouette.
  addInstances(unitBox, visualTruthWallMaterials.shadowJoint, edges.map((edge) => edgeMatrix(edge, 0.68, 1.26, 0.34, 1.04)), parent);
  addInstances(wallStoneGeometry, family.base, edgeCourseMatrices(edges, 0.18, 0.28, 0.42, 1), parent);
  addInstances(wallStoneGeometry, family.side, edgeCourseMatrices(edges, 0.53, 0.4, 0.37, 1), parent);
  addInstances(wallStoneGeometry, family.side, edgeCourseMatrices(edges, 0.91, 0.34, 0.37, 1), parent);
  addInstances(wallStoneGeometry, family.cap, edgeCourseMatrices(edges, 1.2, 0.22, 0.48, 1), parent);
  addInstances(wallStoneGeometry, visualTruthWallMaterials.capHighlight, edgeCourseMatrices(edges, 1.325, 0.055, 0.36, 1), parent);
  addInstances(unitBox, wallContactShadowMaterial, wallContactMatrices(edges, 0.18), parent);

  // Exterior corners carry the Covenant brass identity; inset corners remain
  // compact pale masonry so narrow passages stay visually open.
  addInstances(wallStoneGeometry, family.side, cornerMatrices(corners, 'outer', 0.68, 1.2, 0.5), parent);
  addInstances(wallStoneGeometry, family.base, cornerMatrices(corners, 'outer', 0.16, 0.3, 0.58), parent);
  addInstances(wallStoneGeometry, family.cap, cornerMatrices(corners, 'outer', 1.2, 0.25, 0.58), parent);
  addInstances(wallStoneGeometry, brassDetailMaterial, cornerMatrices(corners, 'outer', 1.34, 0.075, 0.32), parent);
  addInstances(unitBox, visualTruthWallMaterials.brassInset, cornerMatrices(corners, 'outer', 1.382, 0.025, 0.19), parent);
  addInstances(unitBox, visualTruthWallMaterials.brassHighlight, cornerMatrices(corners, 'outer', 1.399, 0.018, 0.07), parent);
  addInstances(unitBox, brassDetailMaterial, cornerMatrices(corners, 'outer', 0.7, 0.11, 0.52), parent);

  addInstances(wallStoneGeometry, family.post, cornerMatrices(corners, 'inner', 0.65, 1.08, 0.34), parent);
  addInstances(wallStoneGeometry, family.cap, cornerMatrices(corners, 'inner', 1.18, 0.2, 0.42), parent);
  addInstances(wallStoneGeometry, brassDetailMaterial, cornerMatrices(corners, 'junction', 0.68, 1.18, 0.42), parent);

}

function addVisualTruthCorridorFamily(edges: BoundaryEdge[], parent: THREE.Object3D): void {
  const rearEdges = edges.filter((edge) => edge.side === 'north');
  const foregroundEdges = edges.filter((edge) => edge.side === 'south');
  const lateralEdges = edges.filter((edge) => edge.side === 'east' || edge.side === 'west');

  // A one-cell passage must retain a full cell of visible walking surface.
  // These liners sit almost entirely in the closed-rock side of the boundary;
  // only a tiny overlap avoids z-fighting with the bedrock face.
  const addCourse = (
    courseEdges: BoundaryEdge[],
    sideY: number,
    sideHeight: number,
    capY: number,
  ): void => {
    addInstances(
      unitBox,
      visualTruthWallMaterials.shadowJoint,
      edgeCourseMatrices(courseEdges, sideY, sideHeight, 0.12, 1, 0, 0.045),
      parent,
    );
    addInstances(
      wallStoneGeometry,
      visualTruthWallMaterials.corridorSide,
      edgeCourseMatrices(courseEdges, sideY, sideHeight - 0.04, 0.16, 1, 0, 0.06),
      parent,
    );
    addInstances(
      wallStoneGeometry,
      visualTruthWallMaterials.corridorCap,
      edgeCourseMatrices(courseEdges, capY, 0.1, 0.22, 1, 0, 0.09, 0.065),
      parent,
    );
  };

  // Fixed-camera cutaway: the rear facade supplies architectural height while
  // the foreground curb stays low enough to reveal the full walking surface.
  addCourse(rearEdges, 0.5, 0.9, 0.995);
  addCourse(foregroundEdges, 0.23, 0.4, 0.48);
  addCourse(lateralEdges, 0.39, 0.68, 0.77);
  addInstances(unitBox, wallContactShadowMaterial, wallContactMatrices(edges, 0.055), parent);
}

function addVisualTruthThresholds(thresholds: PassageThreshold[], parent: THREE.Object3D): void {
  const builtThresholds = thresholds.filter((threshold) => threshold.kind === 'built');
  const naturalThresholds = thresholds.filter((threshold) => threshold.kind === 'natural');
  addInstances(wallStoneGeometry, wallFamilies.project.cap, thresholdBarMatrices(builtThresholds, 0.075, 0.15, 0.24), parent);
  addInstances(unitBox, brassDetailMaterial, thresholdBarMatrices(builtThresholds, 0.165, 0.045, 0.09), parent);
  addInstances(wallStoneGeometry, wallFamilies.project.side, thresholdEndMatrices(builtThresholds, 0.48, 0.72, 0.28), parent);
  addInstances(wallStoneGeometry, wallFamilies.project.cap, thresholdEndMatrices(builtThresholds, 0.88, 0.16, 0.36), parent);
  addInstances(wallStoneGeometry, brassDetailMaterial, thresholdEndMatrices(builtThresholds, 0.98, 0.055, 0.22), parent);
  addInstances(wallStoneGeometry, visualTruthWallMaterials.naturalSill, thresholdBarMatrices(naturalThresholds, 0.085, 0.17, 0.3), parent);
  addInstances(unitBox, visualTruthWallMaterials.naturalMarker, thresholdEndMatrices(naturalThresholds, 0.19, 0.16, 0.14), parent);
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
  const rows = [0.25, 0.66, 1.04];
  for (const edge of edges) {
    const base = edgeHash(edge);
    for (let row = 0; row < rows.length; row += 1) {
      for (let column = 0; column < along.length; column += 1) {
        const seed = base + row * 31 + column * 97;
        const jitter = (seededUnit(seed) - 0.5) * 0.08;
        const lateral = along[column] + (row % 2 === 1 ? 0.08 : 0) + jitter;
        const x = edge.x + (edge.axis === 'horizontal' ? lateral : jitter * 0.35);
        const z = edge.z + (edge.axis === 'vertical' ? lateral : jitter * 0.35);
        const sx = (edge.axis === 'horizontal' ? 0.49 : 0.4) * (0.88 + seededUnit(seed + 1) * 0.24);
        const sz = (edge.axis === 'vertical' ? 0.49 : 0.4) * (0.88 + seededUnit(seed + 2) * 0.24);
        const sy = 0.52 * (0.86 + seededUnit(seed + 3) * 0.28);
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

function corridorFloorInsetMatrix(cell: ProofCell, corridorKeys: ReadonlySet<string>): THREE.Matrix4 {
  const horizontal = corridorKeys.has(proofCellKey(cell.x - 1, cell.z))
    || corridorKeys.has(proofCellKey(cell.x + 1, cell.z));
  const vertical = corridorKeys.has(proofCellKey(cell.x, cell.z - 1))
    || corridorKeys.has(proofCellKey(cell.x, cell.z + 1));
  const widthX = horizontal && !vertical ? 0.96 : 0.84;
  const widthZ = vertical && !horizontal ? 0.96 : 0.84;
  return matrixAt(cell.x + 0.5, 0.028, cell.z + 0.5, widthX, 1, widthZ);
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
    const light = new THREE.PointLight(natural ? 0x42e7be : 0xffa62f, natural ? 1.5 : 1.9, natural ? 3.8 : 4.2, 2);
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
  if (visualTruthMode || surfaceStyle === 'project') {
    const corridorCells = cells.filter((cell) => (
      cell.zone === 'corridor' && state.claimedCells.has(proofCellKey(cell.x, cell.z))
    ));
    const corridorKeys = new Set(corridorCells.map((cell) => proofCellKey(cell.x, cell.z)));
    addInstances(
      tileGeometry,
      visualTruthCorridorFloorMaterial,
      corridorCells.map((cell) => corridorFloorInsetMatrix(cell, corridorKeys)),
      geometryGroup,
    );
  }
  addInstances(
    tileGeometry,
    floorMaterials.raw,
    cells.filter((cell) => cell.zone === 'corridor' && !state.claimedCells.has(proofCellKey(cell.x, cell.z))).map(tileMatrix),
    geometryGroup,
  );
  const naturalFloorCells = cells.filter((cell) => cell.zone === 'target' && !state.claimedCells.has(proofCellKey(cell.x, cell.z)));
  if (visualTruthMode) {
    const naturalFloor = new THREE.Mesh(cellSurfaceGeometry(naturalFloorCells, 0.018, 7), floorMaterials.cavern);
    naturalFloor.receiveShadow = true;
    geometryGroup.add(naturalFloor);
  } else {
    addInstances(tileGeometry, floorMaterials.cavern, naturalFloorCells.map(tileMatrix), geometryGroup);
  }
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
  const cellsByKey = new Map(cells.map((cell) => [proofCellKey(cell.x, cell.z), cell]));
  const roomEdges = builtEdges.filter((edge) => cellsByKey.get(proofCellKey(adjacentOpenCell(edge).x, adjacentOpenCell(edge).z))?.zone !== 'corridor');
  const corridorEdges = builtEdges.filter((edge) => cellsByKey.get(proofCellKey(adjacentOpenCell(edge).x, adjacentOpenCell(edge).z))?.zone === 'corridor');
  if (visualTruthMode) {
    const corners = classifyWallCorners(roomEdges, constructed);
    const thresholds = findPassageThresholds(cells);
    addVisualTruthWallFamily(roomEdges, wallFamilies.project, corners, geometryGroup);
    addVisualTruthCorridorFamily(corridorEdges, geometryGroup);
    addVisualTruthThresholds(thresholds, geometryGroup);
  } else if (surfaceStyle === 'project') {
    addWallFamily(roomEdges.filter((edge) => edge.side !== 'south'), wallFamilies.project, geometryGroup);
    addWallFamily(roomEdges.filter((edge) => edge.side === 'south'), foregroundFamilies.project, geometryGroup);
    addVisualTruthCorridorFamily(corridorEdges, geometryGroup);
  } else {
    addWallFamily(opaqueBuilt, wallFamilies[surfaceStyle], geometryGroup);
    addWallFamily(foregroundBuilt, foregroundFamilies[surfaceStyle], geometryGroup);
  }
  addInstances(naturalRockGeometry, wallFamilies.natural.side, naturalRockMatrices(naturalEdges.filter((edge) => edge.side !== 'south')), geometryGroup, true);
  addInstances(naturalRockGeometry, foregroundFamilies.natural.side, naturalRockMatrices(naturalEdges.filter((edge) => edge.side === 'south')), geometryGroup, true);
  if (!visualTruthMode) {
    const detailedEdges = surfaceStyle === 'project' ? roomEdges : builtEdges;
    const vertices = boundaryVertices(detailedEdges);
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
    addInstances(unitBox, brassDetailMaterial, detailedEdges.filter((edge) => edgeHash(edge) % 4 === 0).map((edge) => edgeMatrix(edge, 0.58, 0.66, 0.34, 0.1)), geometryGroup);
    addInstances(unitBox, brassDetailMaterial, thresholdMatrices(cells, constructed), geometryGroup);
  }
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
  const site = discoverySites.find((candidate) => siteContains(candidate, deposit.x, deposit.z));
  return !site || state.discoveredSites.has(site.id);
}

function addDiscoveredSiteDressing(site: SandboxDiscoverySite): void {
  const cx = site.x + site.w / 2;
  const cz = site.z + site.h / 2;
  if (site.kind === 'fungus') {
    if (visualTruthMode) {
      addFloorDecal(resourceGroup, decalMaterials.moss, cx - 1.6, cz + 1.15, 1.45, 0.82, -0.18);
      addFloorDecal(resourceGroup, decalMaterials.spores, cx + 1.55, cz - 1.25, 1.2, 0.72, 0.22);
      addFloorDecal(resourceGroup, decalMaterials.puddle, cx + 0.4, cz + 1.55, 1.15, 0.72, -0.24);
    } else {
      addFloorDecal(resourceGroup, decalMaterials.moss, cx, cz, site.w * 0.84, site.h * 0.82, site.id === 'spore-garden' ? 0.28 : -0.16);
      addFloorDecal(resourceGroup, decalMaterials.spores, cx - 0.8, cz + 0.65, site.w * 0.48, site.h * 0.44, 0.2);
      addFloorDecal(resourceGroup, decalMaterials.puddle, cx + 1.25, cz - 1.1, 1.7, 1.25, -0.24);
    }
    const clusters = [
      { x: 0.9, z: 1.05, size: 0.54, medium: true },
      { x: 2.45, z: 0.7, size: 0.34, medium: false },
      { x: 5.6, z: 1.1, size: 0.5, medium: true },
      { x: 1.25, z: 3.75, size: 0.32, medium: false },
      { x: 3.5, z: 2.55, size: 0.62, medium: true },
      { x: 5.65, z: 3.9, size: 0.34, medium: false },
      { x: 2.25, z: 5.65, size: 0.48, medium: true },
      { x: 4.9, z: 5.55, size: 0.3, medium: false },
    ];
    clusters.forEach((cluster, index) => {
      if (visualTruthMode) {
        const key = cluster.medium ? 'fungusMedium' : 'fungusSmall';
        const sourceSize = cluster.medium ? 0.54 : 0.34;
        addVisualTruthSprite(
          resourceGroup,
          key,
          cluster.medium ? spriteMaterials.fungusMedium : spriteMaterials.fungusSmall,
          site.x + cluster.x,
          site.z + cluster.z,
          9 + index,
          cluster.size / sourceSize,
        );
      } else {
        addSprite(
          resourceGroup,
          cluster.medium ? spriteMaterials.fungusMedium : spriteMaterials.fungusSmall,
          site.x + cluster.x,
          cluster.medium ? 0.46 : 0.31,
          site.z + cluster.z,
          cluster.size,
          cluster.size,
          9 + index,
        );
      }
    });
    if (visualTruthMode) {
      addVisualTruthSprite(
        resourceGroup,
        'grottoStation',
        spriteMaterials.grottoStation,
        site.x + site.w - 1.15,
        site.z + site.h - 1.08,
        10,
      );
    } else {
      addSprite(resourceGroup, spriteMaterials.grottoStation, site.x + site.w - 1.15, 0.5, site.z + site.h - 1.08, 1.02, 1.02, 10);
    }
    const glow = new THREE.PointLight(0x5be9bd, mobileProfile ? 1.8 : 2.6, 6.2, 2);
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
  addFloorDecal(resourceGroup, decalMaterials.rubble, cx, cz, site.w * 0.72, site.h * 0.66, -0.12);
  [
    { x: 0.8, z: 0.8, size: 0.86 },
    { x: 2.1, z: 0.65, size: 0.68 },
    { x: site.w - 1.05, z: 0.9, size: 0.82 },
    { x: site.w - 0.85, z: 2.4, size: 0.62 },
    { x: 1.0, z: site.h - 1.1, size: 0.66 },
  ].forEach((vein, index) => addSprite(resourceGroup, spriteMaterials.iron, site.x + vein.x, 0.48, site.z + vein.z, vein.size, vein.size, 9 + index));
  addSprite(resourceGroup, spriteMaterials.cart, cx - 0.45, 0.45, cz + 0.75, 0.96, 0.96, 12);
  addSprite(resourceGroup, spriteMaterials.rack, site.x + 0.75, 0.58, cz - 0.45, 0.78, 0.88, 11);
  addSprite(resourceGroup, spriteMaterials.supplies, site.x + site.w - 1.25, 0.42, site.z + site.h - 1.05, 0.76, 0.68, 11);
  addSprite(resourceGroup, spriteMaterials.lamp, site.x + 1.1, 0.58, site.z + 1.7, 0.58, 0.74, 13);
  addSprite(resourceGroup, spriteMaterials.lamp, site.x + site.w - 1.1, 0.58, site.z + 1.7, 0.58, 0.74, 13);
  const glow = new THREE.PointLight(0xffae38, mobileProfile ? 1.7 : 2.7, 6.2, 2);
  glow.position.set(cx + 0.8, 1.65, cz - 0.25);
  resourceGroup.add(glow);
}

function addUndiscoveredSitePreview(site: SandboxDiscoverySite): void {
  const cx = site.x + site.w / 2;
  const cz = site.z + site.h / 2;
  if (site.kind === 'fungus') {
    addFloorDecal(resourceGroup, decalMaterials.moss, cx, cz, site.w * 0.82, site.h * 0.8, site.id === 'spore-garden' ? 0.3 : -0.14);
    addFloorDecal(resourceGroup, decalMaterials.spores, cx + 0.75, cz - 0.55, site.w * 0.42, site.h * 0.38, 0.22);
    addSprite(resourceGroup, hintMaterials.fungus, cx, 0.78, cz, 1.22, 1.22, 8);
    addSprite(resourceGroup, spriteMaterials.fungusSmall, site.entry.x + 0.5, 0.34, site.entry.z + 0.25, 0.54, 0.54, 10);
    const glow = new THREE.PointLight(0x43d8b1, mobileProfile ? 1.2 : 2.6, 5.5, 2);
    glow.position.set(cx, 1.4, cz);
    resourceGroup.add(glow);
    return;
  }
  if (site.kind === 'iron') {
    addFloorDecal(resourceGroup, decalMaterials.rubble, cx, cz, site.w * 0.72, site.h * 0.62, -0.1);
    addSprite(resourceGroup, hintMaterials.iron, cx, 0.72, cz, 1.28, 1.28, 8);
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
  discoverySites
    .filter((site) => !state.discoveredSites.has(site.id))
    .forEach(addUndiscoveredSitePreview);
  discoverySites
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
  const kitchen = state.rooms.find((room) => room.kind === 'kitchen' && sandboxRoomComplete(room));
  if (kitchen) {
    const cx = kitchen.x + kitchen.w / 2;
    const cz = kitchen.z + kitchen.h / 2;
    for (let index = 0; index < Math.min(4, state.kitchenFlow.inputBiomass); index += 1) {
      addSprite(resourceGroup, spriteMaterials.fungusSmall, cx - 0.52 + index * 0.24, 0.28, cz + 0.62, 0.34, 0.34, 15 + index);
    }
    for (let index = 0; index < Math.min(4, state.kitchenFlow.outputRations); index += 1) {
      addSprite(resourceGroup, spriteMaterials.ration, cx + 0.36 + index * 0.2, 0.3, cz - 0.55, 0.34, 0.34, 15 + index);
    }
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
  actor.position.set(THREE.MathUtils.lerp(from.x, to.x, actorProgress), workerGroundY, THREE.MathUtils.lerp(from.z, to.z, actorProgress));
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

let guardianPath = [{ x: guardian.position.x, z: guardian.position.z }];
let guardianSegment = 0;
let guardianProgress = 0;
let guardianDestinationKey = '';
let enemyDefeatAnnounced = false;

function updateGuardian(delta: number): void {
  const enemy = activeSandboxEnemy(state);
  const discovered = Boolean(enemy && state.discoveredSites.has(enemy.siteId));
  const targetCell = discovered && enemy
    ? [
        { x: enemy.x, z: enemy.z + 1 },
        { x: enemy.x - 1, z: enemy.z },
        { x: enemy.x + 1, z: enemy.z },
        { x: enemy.x, z: enemy.z - 1 },
      ].find((cell) => state.openCells.has(proofCellKey(cell.x, cell.z))) ?? { x: enemy.x, z: enemy.z }
    : { x: SANDBOX_START.x + 1, z: SANDBOX_START.z };
  const destinationKey = discovered && enemy ? `fight:${enemy.id}` : 'home';
  if (destinationKey !== guardianDestinationKey) {
    guardianDestinationKey = destinationKey;
    const current = { x: Math.floor(guardian.position.x), z: Math.floor(guardian.position.z) };
    const routeStart = state.openCells.has(proofCellKey(current.x, current.z)) ? current : SANDBOX_START;
    const route = findOpenPath([...state.openCells.values()], routeStart, targetCell);
    guardianPath = route.length > 0
      ? route.map((cell) => ({ x: cell.x + 0.5, z: cell.z + 0.5 }))
      : [{ x: guardian.position.x, z: guardian.position.z }];
    guardianSegment = 0;
    guardianProgress = 0;
  }
  let remaining = delta * 2.35;
  while (remaining > 0 && guardianSegment < guardianPath.length - 1) {
    const from = guardianPath[guardianSegment];
    const to = guardianPath[guardianSegment + 1];
    const length = Math.max(0.001, Math.hypot(to.x - from.x, to.z - from.z));
    const available = (1 - guardianProgress) * length;
    if (remaining < available) {
      guardianProgress += remaining / length;
      remaining = 0;
    } else {
      remaining -= available;
      guardianSegment += 1;
      guardianProgress = 0;
    }
  }
  const from = guardianPath[Math.min(guardianSegment, guardianPath.length - 1)];
  const to = guardianPath[Math.min(guardianSegment + 1, guardianPath.length - 1)];
  guardian.position.set(
    THREE.MathUtils.lerp(from.x, to.x, guardianProgress),
    guardianGroundY,
    THREE.MathUtils.lerp(from.z, to.z, guardianProgress),
  );
  guardianShadow.position.set(guardian.position.x, 0.045, guardian.position.z + 0.06);
  const moving = guardianSegment < guardianPath.length - 1;
  if (discovered && enemy && !moving) {
    const result = advanceSandboxCombat(state, enemy.id, delta);
    const pulse = 1 + Math.sin(workerAnimationTime * 9) * 0.043;
    guardian.scale.set(guardianBaseWidth * pulse, guardianBaseHeight * pulse, 1);
    grottoEnemy.scale.setScalar(1.72 + Math.sin(workerAnimationTime * 11) * 0.08);
    if (result.defeated && !enemyDefeatAnnounced) {
      enemyDefeatAnnounced = true;
      showLoopPopup('⚔', 'Pilzgrotte gesichert');
      showStatus({ ok: true, message: 'Der Höhlenkriecher ist besiegt. Arbeiter können die Pilzgrotte jetzt claimen.' });
      guardianDestinationKey = '';
      updateUi();
    }
  } else {
    guardian.scale.set(guardianBaseWidth, guardianBaseHeight, 1);
  }

  const visibleEnemy = state.enemies.find((candidate) => candidate.siteId === 'fungus-grotto');
  const showEnemy = Boolean(visibleEnemy && state.discoveredSites.has('fungus-grotto') && !visibleEnemy.defeated);
  grottoEnemy.visible = showEnemy;
  enemyHealthBack.visible = showEnemy;
  enemyHealthFill.visible = showEnemy;
  if (visibleEnemy) {
    grottoEnemy.position.set(visibleEnemy.x + 0.5, 0.9, visibleEnemy.z + 0.5);
    const ratio = THREE.MathUtils.clamp(visibleEnemy.hp / visibleEnemy.maxHp, 0, 1);
    enemyHealthBack.position.set(visibleEnemy.x + 0.5, 1.73, visibleEnemy.z + 0.35);
    enemyHealthFill.position.set(visibleEnemy.x + 0.5 - (1 - ratio) * 0.5, 1.73, visibleEnemy.z + 0.34);
    enemyHealthBack.quaternion.copy(camera.quaternion);
    enemyHealthFill.quaternion.copy(camera.quaternion);
    enemyHealthFill.scale.x = ratio;
  }
  creatureNeedIcon.visible = !visualTruthMode && sandboxCreatureHungry(state);
  creatureNeedIcon.position.y = 1.55 + Math.sin(workerAnimationTime * 4) * 0.08;
}

type SupportTaskKind = 'claim' | 'dig' | 'build' | 'mine' | 'haul' | 'supply-pickup' | 'supply-deliver' | 'ration-pickup' | 'feed' | 'maintain';
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
type SupportCargo = {
  item: 'ore' | 'biomass' | 'ration';
  destination: 'storage' | 'kitchen' | 'creature';
};
const supportCargo = new Map<number, SupportCargo>();

function supportTask(index: number): SupportTask {
  const cargo = supportCargo.get(index);
  if (cargo) {
    if (cargo.destination === 'kitchen') {
      const kitchen = state.rooms.find((room) => room.kind === 'kitchen' && sandboxRoomComplete(room));
      const stand = kitchen
        ? { x: kitchen.x + Math.floor(kitchen.w / 2), z: kitchen.z + Math.floor(kitchen.h / 2) }
        : { x: SANDBOX_HEART.x + 2, z: SANDBOX_HEART.z };
      return { kind: 'supply-deliver', key: `supply-deliver:${proofCellKey(stand.x, stand.z)}`, target: stand, stand };
    }
    if (cargo.destination === 'creature') {
      const stand = { x: state.creature.x, z: state.creature.z };
      return { kind: 'feed', key: `feed:${state.creature.id}`, target: stand, stand };
    }
    const storage = state.rooms.find((room) => room.kind === 'storage' && sandboxRoomComplete(room));
    const stand = storage
      ? { x: storage.x + Math.floor(storage.w / 2), z: storage.z + Math.floor(storage.h / 2) }
      : { x: SANDBOX_HEART.x + 2, z: SANDBOX_HEART.z };
    return { kind: 'haul', key: `haul:${cargo.item}:${proofCellKey(stand.x, stand.z)}`, target: stand, stand };
  }
  const taskReserved = (prefix: string): boolean => [...supportMotions.entries()]
    .some(([otherIndex, motion]) => otherIndex !== index && motion.taskKey.startsWith(prefix));
  const kitchen = state.rooms.find((room) => room.kind === 'kitchen' && sandboxRoomComplete(room));
  const storage = state.rooms.find((room) => room.kind === 'storage' && sandboxRoomComplete(room));
  const storageStand = storage
    ? { x: storage.x + Math.floor(storage.w / 2), z: storage.z + Math.floor(storage.h / 2) }
    : { x: SANDBOX_HEART.x + 2, z: SANDBOX_HEART.z };
  const kitchenStand = kitchen
    ? { x: kitchen.x + Math.floor(kitchen.w / 2), z: kitchen.z + Math.floor(kitchen.h / 2) }
    : undefined;
  const rationPickupTask = kitchenStand && sandboxCreatureHungry(state) && state.kitchenFlow.outputRations > 0 && !taskReserved('ration-pickup:')
    ? { kind: 'ration-pickup' as const, key: `ration-pickup:${proofCellKey(kitchenStand.x, kitchenStand.z)}`, target: kitchenStand, stand: kitchenStand }
    : undefined;
  const supplyPickupTask = kitchenStand
    && state.kitchenFlow.inputBiomass < 2
    && state.stock.biomass > 0
    && !taskReserved('supply-pickup:')
    ? { kind: 'supply-pickup' as const, key: `supply-pickup:${proofCellKey(storageStand.x, storageStand.z)}`, target: storageStand, stand: storageStand }
    : undefined;
  const claim = state.workerJobs.claim > 0 ? nextSandboxClaimTarget(state) : undefined;
  const unfinishedRoom = state.workerJobs.build > 0 ? state.rooms.find((room) => !sandboxRoomComplete(room)) : undefined;
  const mine = state.workerJobs.mine > 0
    ? state.deposits
        .filter((deposit) => deposit.remaining > 0 && state.claimedCells.has(proofCellKey(deposit.x, deposit.z)))
        .sort((a, b) => Number(b.kind === 'fungus') - Number(a.kind === 'fungus'))[0]
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
    ? rationPickupTask ?? supplyPickupTask ?? claimTask ?? digTask ?? buildTask ?? mineTask
    : rationPickupTask ?? supplyPickupTask ?? buildTask ?? mineTask ?? digTask ?? (state.workerJobs.claim > 1 ? claimTask : undefined);
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
    visual.sprite.position.set(x, workerGroundY, z);
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
        supportCargo.set(index, { item: result.item, destination: 'storage' });
        rebuildResources();
      }
    }
    if (working && task.kind === 'haul') {
      const cargo = supportCargo.get(index);
      if (cargo) {
        const delivered = cargo.item === 'ore' || cargo.item === 'biomass'
          ? deliverSandboxResource(state, cargo.item)
          : { ok: false, message: 'Diese Fracht gehört nicht ins Lager.' };
        if (delivered.ok) {
          showStoragePopup(cargo.item as 'ore' | 'biomass');
          supportCargo.delete(index);
          updateUi();
        }
      }
    }
    if (working && task.kind === 'supply-pickup') {
      const pickedUp = pickupSandboxKitchenBiomass(state);
      if (pickedUp.ok) {
        supportCargo.set(index, { item: 'biomass', destination: 'kitchen' });
        rebuildResources();
        updateUi();
      }
    }
    if (working && task.kind === 'supply-deliver') {
      const delivered = deliverSandboxKitchenBiomass(state);
      if (delivered.ok) {
        supportCargo.delete(index);
        showLoopPopup('✦', 'Biomasse an Küche geliefert');
        rebuildResources();
        updateUi();
      }
    }
    if (working && task.kind === 'ration-pickup') {
      const pickedUp = pickupSandboxKitchenRation(state);
      if (pickedUp.ok) {
        supportCargo.set(index, { item: 'ration', destination: 'creature' });
        rebuildResources();
        updateUi();
      }
    }
    if (working && task.kind === 'feed') {
      const fed = feedSandboxCreature(state);
      if (fed.ok) {
        supportCargo.delete(index);
        showLoopPopup('♥', 'Kreatur gefüttert');
        showStatus(fed);
        rebuildResources();
        updateUi();
      }
    }
    const cargo = supportCargo.get(index);
    visual.cargo.visible = Boolean(cargo);
    if (cargo) {
      visual.cargo.material = cargoMaterials[cargo.item];
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
  <div class="geometry-loop-card" aria-live="polite">
    <small>VERTIKALER SPIELLOOP</small>
    <strong data-loop-title>Pilzgrotte erschließen</strong>
    <span data-loop-copy>Grabe vom Startraum zur leuchtenden Grotte im Norden.</span>
    <i data-loop-progress>○ ○ ○ ○ ○ ○ ○</i>
  </div>
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

if (visualTruthMode) {
  const badge = ui.querySelector<HTMLElement>('.geometry-badge');
  const kicker = ui.querySelector<HTMLElement>('.geometry-loop-card small');
  const title = ui.querySelector<HTMLElement>('[data-loop-title]');
  const copy = ui.querySelector<HTMLElement>('[data-loop-copy]');
  const meter = ui.querySelector<HTMLElement>('[data-loop-progress]');
  if (badge) badge.textContent = 'Style-B Visual-Truth';
  if (kicker) kicker.textContent = 'VERBINDLICHER MOCKUP-ABGLEICH';
  if (title) title.textContent = 'Herzraum · Gang · Pilzgrotte';
  if (copy) copy.textContent = 'Feste Kamera, echte Geometrie und modulare Bestandsassets in einer reproduzierbaren Szene.';
  if (meter) meter.textContent = 'KAMERA · LICHT · MATERIAL · MASSSTAB';
  ui.querySelector<HTMLElement>('[data-surface="clean"]')?.setAttribute('aria-pressed', 'false');
  ui.querySelector<HTMLElement>('[data-surface="project"]')?.setAttribute('aria-pressed', 'true');
}

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

function showLoopPopup(icon: string, label: string): void {
  if (!resourcePopups) return;
  const popup = document.createElement('div');
  popup.className = 'geometry-resource-popup is-loop';
  popup.innerHTML = `<b>${icon}</b><span>${label}</span>`;
  popup.addEventListener('animationend', () => popup.remove(), { once: true });
  resourcePopups.append(popup);
}

function updateLoopUi(): void {
  if (visualTruthMode) {
    root.dataset.loopComplete = 'true';
    root.dataset.loopStep = 'visual-truth';
    return;
  }
  const progress = sandboxLoopProgress(state);
  const steps = [
    progress.discovered,
    progress.cleared,
    progress.claimed,
    progress.biomassStored,
    progress.kitchenReady,
    progress.rationProduced,
    progress.creatureFed,
  ];
  const title = ui.querySelector<HTMLElement>('[data-loop-title]');
  const copy = ui.querySelector<HTMLElement>('[data-loop-copy]');
  const meter = ui.querySelector<HTMLElement>('[data-loop-progress]');
  const current = !progress.discovered
    ? ['Pilzgrotte erschließen', 'Grabe vom Startraum zur leuchtenden Grotte im Norden.']
    : !progress.cleared
      ? ['Grotte sichern', 'Der Covenant-Wächter läuft selbst zum Höhlenkriecher und bekämpft ihn.']
      : !progress.claimed
        ? ['Pilzboden claimen', 'Ein Arbeiter beansprucht die gesicherte Grotte Feld für Feld.']
        : !progress.biomassStored
          ? ['Pilze ernten', 'Ein Arbeiter hackt Biomasse ab und trägt sie sichtbar ins Lager.']
          : !progress.kitchenReady
            ? ['Pilzküche bauen', 'Baue in der Startkammer eine Pilzküche, mindestens 2 × 3 Felder.']
            : !progress.rationProduced
              ? ['Küche versorgen', 'Ein Arbeiter holt Biomasse aus dem Lager; die Küche kocht daraus Rationen.']
              : !progress.creatureFed
                ? ['Kreatur versorgen', 'Ein Arbeiter holt die fertige Ration und bringt sie zur hungrigen Kreatur.']
                : ['Gameplay-Loop bestanden', 'Entdecken, Kampf, Claiming, Abbau, Transport, Produktion und Versorgung funktionieren.'];
  if (title) title.textContent = current[0];
  if (copy) copy.textContent = current[1];
  if (meter) meter.textContent = steps.map((done) => done ? '●' : '○').join(' ');
  root.dataset.loopComplete = String(progress.completed);
  root.dataset.loopStep = String(steps.filter(Boolean).length);
}

function updateUi(): void {
  for (const [kind, amount] of Object.entries(state.stock)) {
    const output = ui.querySelector<HTMLElement>(`[data-stock="${kind}"]`);
    if (output) output.textContent = String(kind === 'ration' ? amount + state.kitchenFlow.outputRations : amount);
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
  updateLoopUi();
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
    const newest = discoverySites.find((site) => state.discoveredSites.has(site.id) && ![...state.discoveredSites].slice(0, knownDiscoveryCount).includes(site.id));
    if (newest) showStatus({
      ok: true,
      message: newest.id === 'fungus-grotto'
        ? `${newest.label} entdeckt. Ein Höhlenkriecher blockiert das Gebiet; der Covenant-Wächter ist unterwegs.`
        : `${newest.label} entdeckt. Der neutrale Boden wird nun Feld für Feld beansprucht.`,
    });
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
  state = visualTruthMode ? createGeometryVisualTruthState() : createSandboxState();
  supportCargo.clear();
  supportMotions.clear();
  workerVisuals.forEach((visual) => { visual.cargo.visible = false; });
  ensureWorkerVisuals(state.workerCount);
  actorDestinationKey = '';
  guardianDestinationKey = '';
  guardianSegment = 0;
  guardianProgress = 0;
  enemyDefeatAnnounced = false;
  knownRationsProduced = 0;
  guardian.position.set(SANDBOX_START.x + 0.5, guardianGroundY, SANDBOX_START.z - 2.5);
  covenantCreature.position.set(state.creature.x + 0.5, 0.88, state.creature.z + 0.5);
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
  const tick = visualTruthMode
    ? { terrainChanged: false, roomsChanged: false, resourcesChanged: false }
    : tickSandboxEconomy(state, delta, { autonomousDigging: false, autonomousClaiming: false, autonomousMining: false });
  const supportTick = updateSupportWorkers(delta);
  updateGuardian(delta);
  updateClaimFx();
  if (actorTick.terrainChanged) scheduleTerrainSync();
  if (supportTick.terrainChanged) scheduleTerrainSync();
  if (tick.terrainChanged) scheduleTerrainSync();
  if (tick.roomsChanged) {
    rebuildRooms();
    updateUi();
  }
  if (tick.resourcesChanged) {
    rebuildResources();
    if (state.kitchenFlow.rationsProduced > knownRationsProduced) {
      showLoopPopup('♨', `+${state.kitchenFlow.rationsProduced - knownRationsProduced} Rationen gekocht`);
      knownRationsProduced = state.kitchenFlow.rationsProduced;
    }
  }
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
  closedRockMassGeometry.dispose();
  closedRockGeometries.forEach((geometry) => geometry.dispose());
  actorShadowGeometry.dispose();
  selectionGeometry.dispose();
  resourceGeometry.dispose();
  digPlane.geometry.dispose();
}, { once: true });
