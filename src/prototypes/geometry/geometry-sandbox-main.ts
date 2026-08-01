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
} from './GeometryProofModel';
import {
  SANDBOX_BOUNDS,
  SANDBOX_HEART,
  SANDBOX_START,
  advanceSandboxDigging,
  canPlanSandboxCell,
  createSandboxState,
  excavateSandboxChamber,
  normalizedRect,
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
scene.background = new THREE.Color(0x06111f);
scene.fog = new THREE.FogExp2(0x06111f, 0.009);

const renderer = new THREE.WebGLRenderer({ antialias: !mobileProfile, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
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
] = await Promise.all([
  loadMap(`${terrainRoot}/claimed-floor.png`),
  loadMap(`${terrainRoot}/claimed-corridor.png`),
  loadMap(`${terrainRoot}/rock-top.png`, { x: 24, y: 16 }),
  loadMap(`${terrainRoot}/rock-basalt.png`, { x: 2.5, y: 2.5 }),
  loadMap(`${terrainRoot}/rock-roots.png`, { x: 2.5, y: 2.5 }),
  loadMap(`${terrainRoot}/rock-damp.png`, { x: 2.5, y: 2.5 }),
  loadMap(`${terrainRoot}/rock-earth.png`, { x: 2.5, y: 2.5 }),
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
]);

const pixelMaps = [
  workerMap, heartBackplateMap, heartCoreMap, heartBezelMap, heartPulpitMap,
  ironMap, fungusMap, storageMap, bedMap, cauldronMap, furnaceMap, workbenchMap, prisonMap,
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
  corridor: standardMaterial({ color: 0xb7cbe0, map: corridorMap, roughness: 0.92 }),
};
const bedrockMaterial = standardMaterial({ color: 0x39566d, map: rockMap, roughness: 0.98 });
const geologyMaterials = {
  basalt: standardMaterial({ color: 0x718092, map: rockBasaltMap, roughness: 1 }),
  roots: standardMaterial({ color: 0x65768a, map: rockRootsMap, roughness: 1 }),
  damp: standardMaterial({ color: 0x6e9a8c, map: rockDampMap, roughness: 1 }),
  earth: standardMaterial({ color: 0x7e6a67, map: rockEarthMap, roughness: 1 }),
};
for (const material of Object.values(geologyMaterials)) {
  material.transparent = true;
  material.opacity = 0.82;
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
};
const resourceMaterials = {
  iron: new THREE.MeshBasicMaterial({ map: ironMap, transparent: true, alphaTest: 0.035, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
  fungus: new THREE.MeshBasicMaterial({ map: fungusMap, transparent: true, alphaTest: 0.035, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
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

const workerMaterial = spriteMaterial(workerMap);
const actor = addSprite(world, workerMaterial, SANDBOX_START.x + 0.5, 0.82, SANDBOX_START.z + 0.5, 1.55, 1.55, 20);
const actorShadow = new THREE.Mesh(actorShadowGeometry, new THREE.MeshBasicMaterial({ color: 0x01050b, transparent: true, opacity: 0.5, depthWrite: false }));
world.add(actorShadow);

const roomFloorMaterials = Object.fromEntries(
  (Object.keys(ROOM_DEFINITIONS) as RoomKind[]).map((kind) => [
    kind,
    new THREE.MeshBasicMaterial({
      color: ROOM_DEFINITIONS[kind].color,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  ]),
) as Record<RoomKind, THREE.MeshBasicMaterial>;

const ambient = new THREE.AmbientLight(0x8290a2, 0.72);
const hemisphere = new THREE.HemisphereLight(0x9fc7df, 0x101725, 1.9);
const keyLight = new THREE.DirectionalLight(0xffd68b, 3.8);
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
let surfaceStyle: SurfaceStyle = 'clean';
let geometryGroup = new THREE.Group();
let resourceGroup = new THREE.Group();
let roomGroup = new THREE.Group();
world.add(geometryGroup, resourceGroup, roomGroup);

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

function rebuildGeometry(): void {
  world.remove(geometryGroup);
  geometryGroup.clear();
  geometryGroup = new THREE.Group();
  const cells = [...state.openCells.values()];
  for (const zone of ['start', 'corridor'] as const) {
    addInstances(
      tileGeometry,
      floorMaterials[zone],
      cells.filter((cell) => cell.zone === zone).map((cell) => matrixAt(cell.x + 0.5, 0.015, cell.z + 0.5)),
      geometryGroup,
    );
  }
  addInstances(
    tileGeometry,
    plannedDigMaterial,
    [...state.plannedDig.values()].map((cell) => matrixAt(cell.x + 0.5, 0.065, cell.z + 0.5)),
    geometryGroup,
  );
  const edges = buildBoundaryEdges(cells);
  const opaqueEdges = edges.filter((edge) => edge.side !== 'south');
  const foregroundEdges = edges.filter((edge) => edge.side === 'south');
  addWallFamily(opaqueEdges, wallFamilies[surfaceStyle], geometryGroup);
  addWallFamily(foregroundEdges, foregroundFamilies[surfaceStyle], geometryGroup, true);
  const vertices = boundaryVertices(edges);
  addInstances(
    unitBox,
    wallFamilies[surfaceStyle].post,
    vertices.map((vertex) => matrixAt(vertex.x, 0.56, vertex.z, 0.36, 0.92, 0.36)),
    geometryGroup,
    true,
  );
  addInstances(unitBox, wallFamilies[surfaceStyle].base, vertices.map((vertex) => matrixAt(vertex.x, 0.1, vertex.z, 0.42, 0.2, 0.42)), geometryGroup);
  addInstances(unitBox, wallFamilies[surfaceStyle].cap, vertices.map((vertex) => matrixAt(vertex.x, 1.04, vertex.z, 0.44, 0.18, 0.44)), geometryGroup);
  world.add(geometryGroup);
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
    const material = spriteMaterials[room.kind];
    const cells = room.w * room.h;
    const count = room.kind === 'bedroom'
      ? bedroomCapacity(cells)
      : room.kind === 'prison'
        ? prisonCapacity(cells)
        : room.kind === 'storage'
          ? Math.max(1, Math.min(6, Math.ceil(cells / 4)))
          : productionStations(cells);
    const width = room.kind === 'bedroom' ? 0.55 : room.kind === 'prison' ? 0.82 : room.kind === 'storage' ? 0.7 : 0.9;
    const height = room.kind === 'bedroom' ? 0.92 : room.kind === 'prison' ? 0.9 : width;
    for (const position of roomPropPositions(room, count)) {
      addSprite(roomGroup, material, position.x, 0.46, position.z + 0.04, width, height, 6);
    }
  }
  world.add(roomGroup);
}

function rebuildResources(): void {
  world.remove(resourceGroup);
  resourceGroup.clear();
  resourceGroup = new THREE.Group();
  for (const kind of ['iron', 'fungus'] as const) {
    const matrices = state.deposits
      .filter((deposit) => deposit.kind === kind && deposit.remaining > 0)
      .map((deposit) => {
        const open = state.openCells.has(proofCellKey(deposit.x, deposit.z));
        const size = open ? 0.86 : 0.64;
        return new THREE.Matrix4().compose(
          new THREE.Vector3(deposit.x + 0.5, open ? 0.58 : 0.34, deposit.z + 0.5),
          resourceFacing,
          new THREE.Vector3(size, size, 1),
        );
      });
    addInstances(resourceGeometry, resourceMaterials[kind], matrices, resourceGroup);
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
  // The source side frame faces left. Flip only while moving right.
  actor.scale.x = (dx > 0 && row === 2 ? -1 : 1) * 1.55;
  return { terrainChanged };
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
    <span><b data-workers>3/5</b><i>Arbeiter</i><em data-worker-jobs>G0 B0 A0</em></span>
  </div>
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
let activeTool: SandboxTool = 'dig';

function showStatus(result: SandboxActionResult): void {
  if (statusTitle) statusTitle.textContent = result.ok ? 'Aktion abgeschlossen' : 'Aktion nicht möglich';
  if (statusCopy) statusCopy.textContent = result.message;
}

function updateUi(): void {
  for (const [kind, amount] of Object.entries(state.stock)) {
    const output = ui.querySelector<HTMLElement>(`[data-stock="${kind}"]`);
    if (output) output.textContent = String(amount);
  }
  const workers = ui.querySelector<HTMLElement>('[data-workers]');
  if (workers) workers.textContent = `${workerCapacity(state)}/5`;
  const jobsOutput = ui.querySelector<HTMLElement>('[data-worker-jobs]');
  if (jobsOutput) jobsOutput.textContent = `G${state.workerJobs.dig} B${state.workerJobs.build} A${state.workerJobs.mine}`;
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
  for (const task of ['dig', 'build', 'mine'] as const) {
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
}

function syncTerrain(): void {
  rebuildGeometry();
  rebuildResources();
  updateActorPath();
  syncActorPosition();
  updateUi();
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
    const task = button.dataset.priority as 'dig' | 'build' | 'mine';
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
  actorDestinationKey = '';
  cameraTarget.set(SANDBOX_START.x, 0, SANDBOX_START.z);
  viewHeight = mobileProfile ? 15 : 20;
  updateCamera();
  syncWorld();
  showStatus({ ok: true, message: 'Große Sandbox mit neuen Erz- und Pilzvorkommen gestartet.' });
});
ui.querySelector<HTMLButtonElement>('[data-action="summon-worker"]')?.addEventListener('click', () => {
  const result = summonSandboxWorker(state);
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
  const tick = tickSandboxEconomy(state, delta, { autonomousDigging: false });
  if (actorTick.terrainChanged) scheduleTerrainSync();
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
  actorShadowGeometry.dispose();
  selectionGeometry.dispose();
  resourceGeometry.dispose();
  digPlane.geometry.dispose();
}, { once: true });
