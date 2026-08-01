import * as THREE from 'three';
import { resolveVisualTheme } from '../../config/VisualTheme';
import {
  HORIZONTAL_DIG,
  PROOF_BOUNDS,
  VERTICAL_DIG,
  boundaryVertices,
  buildBoundaryEdges,
  createGeometryProofLayout,
  digFrontier,
  findOpenPath,
  proofCellKey,
  roomsConnected,
  type BoundaryEdge,
  type GeometryProofLayout,
  type ProofCell,
  type ProofZone,
} from './GeometryProofModel';
import {
  createProceduralWallAssets,
  type ProceduralWallStyle,
} from './ProceduralWallAssets';
import './geometry-proof-style.css';

type SurfaceStyle = ProceduralWallStyle;

const rootElement = document.querySelector<HTMLElement>('#geometry-proof');
const canvasHostElement = document.querySelector<HTMLElement>('#geometry-canvas');
if (!rootElement || !canvasHostElement) throw new Error('Geometry Proof host is missing.');
const root: HTMLElement = rootElement;
const canvasHost: HTMLElement = canvasHostElement;

const theme = resolveVisualTheme('?theme=style-b');
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06111f);
scene.fog = new THREE.FogExp2(0x06111f, 0.018);

const mobileProfile = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ antialias: !mobileProfile, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
renderer.shadowMap.enabled = !mobileProfile;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobileProfile ? 1 : 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
canvasHost.append(renderer.domElement);

const camera = new THREE.OrthographicCamera(-12, 12, 8, -8, 0.1, 80);
camera.up.set(0, 1, 0);
const cameraTarget = new THREE.Vector3(9.7, 0, 7.8);
// Keep the map axes aligned with the screen. The camera is tilted only on the
// vertical plane, so the lower map edge reads as a deliberate horizontal edge.
const cameraOffset = new THREE.Vector3(0, 17.5, 10.5);
let viewHeight = 19.2;

function reservedPanelWidth(): number {
  if (window.innerWidth <= 600) return 0;
  return Math.min(360, window.innerWidth * 0.38);
}

function updateCamera(): void {
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
  claimedFloorMap,
  corridorFloorMap,
  dampFloorMap,
  rockMap,
  workerMap,
  heartBackplateMap,
  heartCoreMap,
  heartBezelMap,
  heartPulpitMap,
  fungusMap,
  storageMap,
  bedMap,
] = await Promise.all([
  loadMap(`${terrainRoot}/claimed-floor.png`),
  loadMap(`${terrainRoot}/claimed-corridor.png`),
  loadMap(`${terrainRoot}/damp-floor.png`),
  loadMap(`${terrainRoot}/rock-top.png`, { x: 10, y: 8 }),
  loadMap(theme.assets.workerAnimation ?? theme.assets.worker),
  loadMap(heartBuilding?.backplate ?? theme.assets.heart),
  loadMap(heartBuilding?.core ?? theme.assets.heart),
  loadMap(heartBuilding?.bezel ?? theme.assets.heart),
  loadMap(heartBuilding?.pulpit ?? theme.assets.heart),
  loadMap(theme.assets.resources.fungus),
  loadMap(theme.assets.props.storage),
  loadMap('assets/generated/room-props-v3/bed.png'),
]);

for (const pixelArtMap of [workerMap, heartBackplateMap, heartCoreMap, heartBezelMap, heartPulpitMap, fungusMap, storageMap, bedMap]) {
  pixelArtMap.magFilter = THREE.NearestFilter;
  pixelArtMap.minFilter = THREE.NearestMipmapLinearFilter;
}

const workerAnimated = Boolean(theme.assets.workerAnimation);
if (workerAnimated) {
  workerMap.repeat.set(1 / 4, 1 / 6);
  workerMap.offset.set(0, 5 / 6);
}

const floorMaterials: Record<ProofZone, THREE.MeshStandardMaterial> = {
  start: new THREE.MeshStandardMaterial({ map: claimedFloorMap, color: 0xd7c9bb, roughness: 0.82 }),
  target: new THREE.MeshStandardMaterial({ map: dampFloorMap, color: 0xa4d6c2, roughness: 0.88 }),
  corridor: new THREE.MeshStandardMaterial({ map: corridorFloorMap, color: 0xb7cbe0, roughness: 0.94 }),
};

const proceduralWallAssets = createProceduralWallAssets();

function standardMaterial(options: {
  color: number;
  map?: THREE.Texture;
  roughness?: number;
  metalness?: number;
}): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: options.color,
    map: options.map,
    roughness: options.roughness ?? 0.82,
    metalness: options.metalness ?? 0.02,
  });
}

type WallFamilyMaterials = {
  side: THREE.MeshStandardMaterial;
  cap: THREE.MeshStandardMaterial;
  base: THREE.MeshStandardMaterial;
  post: THREE.MeshStandardMaterial;
};

const wallStyles: Record<SurfaceStyle, WallFamilyMaterials> = {
  clean: {
    side: standardMaterial({ color: 0xffffff, map: proceduralWallAssets.clean.side, roughness: 0.78 }),
    cap: standardMaterial({ color: 0xffffff, map: proceduralWallAssets.clean.cap, roughness: 0.7 }),
    base: standardMaterial({ color: 0x251e29, roughness: 0.92 }),
    post: standardMaterial({ color: 0x665667, roughness: 0.78 }),
  },
  project: {
    side: standardMaterial({ color: 0xffffff, map: proceduralWallAssets.project.side, roughness: 0.8 }),
    cap: standardMaterial({ color: 0xffffff, map: proceduralWallAssets.project.cap, roughness: 0.74 }),
    base: standardMaterial({ color: 0x132235, roughness: 0.9 }),
    post: standardMaterial({ color: 0x586d7c, roughness: 0.72, metalness: 0.05 }),
  },
  natural: {
    side: standardMaterial({ color: 0xffffff, map: proceduralWallAssets.natural.side, roughness: 0.96 }),
    cap: standardMaterial({ color: 0xffffff, map: proceduralWallAssets.natural.cap, roughness: 0.9 }),
    base: standardMaterial({ color: 0x15333e, roughness: 1 }),
    post: standardMaterial({ color: 0x426c69, roughness: 0.96 }),
  },
};

const foregroundWallStyles = Object.fromEntries(
  (Object.keys(wallStyles) as SurfaceStyle[]).map((key) => {
    const side = wallStyles[key].side.clone();
    const cap = wallStyles[key].cap.clone();
    const base = wallStyles[key].base.clone();
    const post = wallStyles[key].post.clone();
    for (const material of [side, cap, base, post]) {
      material.transparent = true;
      material.opacity = 0.68;
      material.depthWrite = false;
    }
    return [key, { side, cap, base, post }];
  }),
) as Record<SurfaceStyle, WallFamilyMaterials>;

const bedrockMaterial = new THREE.MeshStandardMaterial({
  map: rockMap,
  color: 0x39566d,
  roughness: 0.98,
});
const markerMaterial = new THREE.MeshBasicMaterial({
  color: 0xe0ad36,
  transparent: true,
  opacity: 0.9,
  depthWrite: false,
  side: THREE.DoubleSide,
});

const world = new THREE.Group();
scene.add(world);

const bedrock = new THREE.Mesh(
  new THREE.PlaneGeometry(PROOF_BOUNDS.maxX - PROOF_BOUNDS.minX + 1, PROOF_BOUNDS.maxZ - PROOF_BOUNDS.minZ + 1)
    .rotateX(-Math.PI / 2),
  bedrockMaterial,
);
bedrock.position.set(10, -0.055, 8);
bedrock.receiveShadow = true;
world.add(bedrock);

const digPlaneGeometry = new THREE.PlaneGeometry(
  PROOF_BOUNDS.maxX - PROOF_BOUNDS.minX + 1,
  PROOF_BOUNDS.maxZ - PROOF_BOUNDS.minZ + 1,
).rotateX(-Math.PI / 2);
const digPlane = new THREE.Mesh(
  digPlaneGeometry,
  new THREE.MeshBasicMaterial({
    colorWrite: false,
    depthWrite: false,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  }),
);
digPlane.position.set(10, 0.085, 8);
world.add(digPlane);

const tileGeometry = new THREE.PlaneGeometry(1.01, 1.01).rotateX(-Math.PI / 2);
const markerGeometry = new THREE.RingGeometry(0.25, 0.34, 24).rotateX(-Math.PI / 2);
const unitBox = new THREE.BoxGeometry(1, 1, 1);
const actorShadowGeometry = new THREE.CircleGeometry(0.42, 24).rotateX(-Math.PI / 2);

const digHover = new THREE.Mesh(markerGeometry, markerMaterial);
digHover.position.y = 0.07;
digHover.visible = false;
world.add(digHover);

function matrixAt(x: number, y: number, z: number, sx = 1, sy = 1, sz = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion(),
    new THREE.Vector3(sx, sy, sz),
  );
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

let surfaceStyle: SurfaceStyle = 'clean';
let dugCells = 0;
let openCells = new Map(
  createGeometryProofLayout(0).cells.map((cell) => [proofCellKey(cell.x, cell.z), cell]),
);

function interactiveLayout(): GeometryProofLayout {
  const cells = [...openCells.values()];
  const edges = buildBoundaryEdges(cells);
  const route = findOpenPath(cells).map((cell) => ({ x: cell.x + 0.5, z: cell.z + 0.5 }));
  const fallback = createGeometryProofLayout(0).actorPath;
  return {
    stage: 0,
    cells,
    edges,
    vertices: boundaryVertices(edges),
    nextDig: digFrontier(cells),
    actorPath: route.length > 0
      ? [...route, ...route.slice(1, -1).reverse()]
      : fallback,
    connected: roomsConnected(cells),
  };
}

let layout: GeometryProofLayout = interactiveLayout();
let geometryGroup = new THREE.Group();
world.add(geometryGroup);

function wallMaterialArray(style: SurfaceStyle): THREE.Material[] {
  const selected = wallStyles[style];
  return [selected.side, selected.side, selected.side, selected.side, selected.side, selected.side];
}

function foregroundMaterialArray(style: SurfaceStyle): THREE.Material[] {
  const selected = foregroundWallStyles[style];
  return [selected.side, selected.side, selected.side, selected.side, selected.side, selected.side];
}

function edgeMatrix(
  edge: BoundaryEdge,
  y: number,
  height: number,
  thickness: number,
  length = 1.045,
): THREE.Matrix4 {
  const horizontal = edge.axis === 'horizontal';
  return matrixAt(
    edge.x,
    y,
    edge.z,
    horizontal ? length : thickness,
    height,
    horizontal ? thickness : length,
  );
}

function rebuildGeometry(): void {
  world.remove(geometryGroup);
  geometryGroup.clear();
  geometryGroup = new THREE.Group();

  for (const zone of ['start', 'target', 'corridor'] as const) {
    const matrices = layout.cells
      .filter((cell) => cell.zone === zone)
      .map((cell) => matrixAt(cell.x + 0.5, 0.015, cell.z + 0.5));
    addInstances(tileGeometry, floorMaterials[zone], matrices, geometryGroup);
  }

  const opaqueEdges = layout.edges.filter((edge) => edge.side !== 'south');
  const foregroundEdges = layout.edges.filter((edge) => edge.side === 'south');

  const opaqueWalls = addInstances(
    unitBox,
    wallMaterialArray(surfaceStyle),
    opaqueEdges.map((edge) => edgeMatrix(edge, 0.55, 0.9, 0.25)),
    geometryGroup,
    true,
  );
  if (opaqueWalls) opaqueWalls.name = 'boundary-walls';
  addInstances(
    unitBox,
    wallStyles[surfaceStyle].base,
    opaqueEdges.map((edge) => edgeMatrix(edge, 0.1, 0.2, 0.32, 1.06)),
    geometryGroup,
  );
  addInstances(
    unitBox,
    wallStyles[surfaceStyle].cap,
    opaqueEdges.map((edge) => edgeMatrix(edge, 1.04, 0.18, 0.32, 1.08)),
    geometryGroup,
  );

  const foregroundWalls = addInstances(
    unitBox,
    foregroundMaterialArray(surfaceStyle),
    foregroundEdges.map((edge) => edgeMatrix(edge, 0.55, 0.9, 0.25)),
    geometryGroup,
  );
  if (foregroundWalls) foregroundWalls.name = 'readability-walls';
  addInstances(
    unitBox,
    foregroundWallStyles[surfaceStyle].base,
    foregroundEdges.map((edge) => edgeMatrix(edge, 0.1, 0.2, 0.32, 1.06)),
    geometryGroup,
  );
  addInstances(
    unitBox,
    foregroundWallStyles[surfaceStyle].cap,
    foregroundEdges.map((edge) => edgeMatrix(edge, 1.04, 0.18, 0.32, 1.08)),
    geometryGroup,
  );

  const posts = addInstances(
    unitBox,
    wallStyles[surfaceStyle].post,
    layout.vertices.map((vertex) => matrixAt(vertex.x, 0.56, vertex.z, 0.36, 0.92, 0.36)),
    geometryGroup,
    true,
  );
  if (posts) posts.name = 'wall-junction-posts';
  addInstances(
    unitBox,
    wallStyles[surfaceStyle].base,
    layout.vertices.map((vertex) => matrixAt(vertex.x, 0.1, vertex.z, 0.42, 0.2, 0.42)),
    geometryGroup,
  );
  addInstances(
    unitBox,
    wallStyles[surfaceStyle].cap,
    layout.vertices.map((vertex) => matrixAt(vertex.x, 1.04, vertex.z, 0.44, 0.18, 0.44)),
    geometryGroup,
  );

  world.add(geometryGroup);
  renderer.shadowMap.needsUpdate = true;
  root.dataset.surface = surfaceStyle;
  root.dataset.dugCells = String(dugCells);
  root.dataset.openCells = String(layout.cells.length);
  root.dataset.boundaryEdges = String(layout.edges.length);
  root.dataset.connected = String(layout.connected);
}

function spriteMaterial(map: THREE.Texture): THREE.SpriteMaterial {
  return new THREE.SpriteMaterial({
    map,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.035,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
}

function addSprite(
  map: THREE.Texture,
  x: number,
  y: number,
  z: number,
  width: number,
  height = width,
  renderOrder = 0,
): THREE.Sprite {
  const sprite = new THREE.Sprite(spriteMaterial(map));
  sprite.position.set(x, y, z);
  sprite.scale.set(width, height, 1);
  sprite.renderOrder = renderOrder;
  world.add(sprite);
  return sprite;
}

// The original heart is reusable as a layered 2D setpiece. Its old baked room
// base is deliberately omitted because the room is now genuine 3D geometry.
addSprite(heartBackplateMap, 4.5, 1.18, 11.72, 2.85, 2.85, 10);
addSprite(heartCoreMap, 4.5, 1.23, 11.78, 1.22, 1.22, 11);
addSprite(heartBezelMap, 4.5, 1.23, 11.8, 1.43, 1.43, 12);
addSprite(heartPulpitMap, 4.5, 0.54, 11.92, 1.62, 1.2, 13);

// Existing room props remain cheap 2D assets. They participate in the depth
// buffer, so real walls can hide them without authored occlusion sprites.
addSprite(storageMap, 2.95, 0.47, 12.7, 1.28, 1.05, 4);
addSprite(bedMap, 6.15, 0.48, 12.55, 0.78, 1.35, 4);

const fungus = new THREE.Sprite(spriteMaterial(fungusMap));
fungus.position.set(14.7, 0.72, 4.55);
fungus.scale.set(1.7, 1.7, 1);
world.add(fungus);

const actor = new THREE.Sprite(spriteMaterial(workerMap));
actor.scale.set(1.55, 1.55, 1);
world.add(actor);
let workerAnimationTime = 0;

const actorShadow = new THREE.Mesh(
  actorShadowGeometry,
  new THREE.MeshBasicMaterial({ color: 0x01050b, transparent: true, opacity: 0.5, depthWrite: false }),
);
world.add(actorShadow);

const ambient = new THREE.AmbientLight(0x8290a2, 0.72);
scene.add(ambient);
const hemisphere = new THREE.HemisphereLight(0x9fc7df, 0x101725, 1.9);
scene.add(hemisphere);

const keyLight = new THREE.DirectionalLight(0xffd68b, 3.8);
keyLight.position.set(-6, 18, 11);
keyLight.target.position.set(10, 0, 8);
keyLight.castShadow = !mobileProfile;
keyLight.shadow.mapSize.set(1024, 1024);
keyLight.shadow.camera.left = -13;
keyLight.shadow.camera.right = 13;
keyLight.shadow.camera.top = 11;
keyLight.shadow.camera.bottom = -11;
keyLight.shadow.bias = -0.0005;
scene.add(keyLight, keyLight.target);

const heartLight = new THREE.PointLight(0xff7c5f, 18, 7, 1.8);
heartLight.position.set(4.5, 3.2, 11.5);
scene.add(heartLight);
const fungusLight = new THREE.PointLight(0x56dfb8, 15, 6, 1.8);
fungusLight.position.set(14.7, 2.8, 4.5);
scene.add(fungusLight);

const ui = document.createElement('div');
ui.className = 'geometry-ui';
ui.innerHTML = `
  <div class="geometry-badge">Echte Geometrie · keine Eckensprites</div>
  <section class="geometry-panel" aria-labelledby="geometry-title">
    <header>
      <span class="geometry-kicker">Isolierter Machbarkeitstest</span>
      <h1 id="geometry-title">Orthografisches 3D</h1>
      <p>Grabe deinen eigenen Weg per Tippen oder Ziehen. Form und Ecken entstehen ausschließlich aus echter Geometrie.</p>
    </header>

    <div class="geometry-status" role="status" aria-live="polite">
      <strong data-status-title>Freies Graben aktiv</strong>
      <span data-status-copy>Fahre über angrenzenden Fels und tippe oder ziehe.</span>
    </div>

    <h2>Graben und Ansicht</h2>
    <div class="geometry-actions">
      <button type="button" data-action="demo">Beispiel-L bauen</button>
      <button type="button" data-action="reset">Zurücksetzen</button>
      <button type="button" data-action="mode" aria-pressed="true">Modus: Graben</button>
      <button type="button" data-action="actor" aria-pressed="true">Arbeiter läuft</button>
      <button type="button" data-action="zoom-in">Ansicht +</button>
      <button type="button" data-action="zoom-out">Ansicht −</button>
    </div>

    <h2>Oberfläche austauschen</h2>
    <div class="geometry-materials" aria-label="Wandoberfläche">
      <button type="button" data-surface="clean" aria-pressed="true">Mauer</button>
      <button type="button" data-surface="project">Zwerg</button>
      <button type="button" data-surface="natural">Natur</button>
    </div>

    <h2>Was hier geprüft wird</h2>
    <ul class="geometry-proof-list">
      <li>Wände entstehen nur an offen/geschlossen-Grenzen</li>
      <li>Ecken werden von Geometrie und Pfeilern geschlossen</li>
      <li>Gangkurve entsteht ohne separates Eckbild</li>
      <li>Niedrige Vorderwände bleiben automatisch lesbar</li>
      <li>Materialwechsel verändert die Topologie nicht</li>
    </ul>

    <div class="geometry-note"><strong>Absicht:</strong> Die Form kommt vollständig aus der Geometrie. Bilder liefern nur Oberfläche, Boden, Figuren und Dekoration.</div>

    <div class="geometry-metrics">
      <div><span>Offen</span><strong data-open>–</strong></div>
      <div><span>Wände</span><strong data-walls>–</strong></div>
      <div><span>Renderer</span><strong data-performance>–</strong></div>
    </div>
  </section>
  <div class="geometry-legend"><b>Graben</b> tippen/ziehen · Modus wechseln: Kamera verschieben</div>
`;
root.append(ui);

const statusTitle = ui.querySelector<HTMLElement>('[data-status-title]');
const statusCopy = ui.querySelector<HTMLElement>('[data-status-copy]');
const openOutput = ui.querySelector<HTMLElement>('[data-open]');
const wallOutput = ui.querySelector<HTMLElement>('[data-walls]');
const performanceOutput = ui.querySelector<HTMLElement>('[data-performance]');
let actorRunning = true;
let interactionMode: 'dig' | 'pan' = 'dig';
let actorSegment = 0;
let actorProgress = 0;

function updateUi(): void {
  const demo = ui.querySelector<HTMLButtonElement>('[data-action="demo"]');
  if (demo) demo.disabled = layout.connected;
  if (statusTitle) statusTitle.textContent = layout.connected
    ? 'Verbindung hergestellt'
    : 'Freies Graben aktiv';
  if (statusCopy) statusCopy.textContent = layout.connected
    ? `Der Arbeiter hat jetzt einen echten Weg zur grünen Kammer. ${dugCells} Felder wurden gegraben.`
    : `${dugCells} Felder gegraben. Nur direkt angrenzender Fels ist auswählbar.`;
  if (openOutput) openOutput.textContent = String(layout.cells.length);
  if (wallOutput) wallOutput.textContent = String(layout.edges.length);
}

function syncLayout(): void {
  layout = interactiveLayout();
  digHover.visible = false;
  actorSegment = 0;
  actorProgress = 0;
  rebuildGeometry();
  updateUi();
  syncActorPosition();
}

function resetDigging(): void {
  openCells = new Map(
    createGeometryProofLayout(0).cells.map((cell) => [proofCellKey(cell.x, cell.z), cell]),
  );
  dugCells = 0;
  syncLayout();
}

function addDemoRoute(): void {
  for (const position of [...VERTICAL_DIG, ...HORIZONTAL_DIG]) {
    const key = proofCellKey(position.x, position.z);
    if (openCells.has(key)) continue;
    openCells.set(key, { ...position, zone: 'corridor' });
    dugCells += 1;
  }
  syncLayout();
}

ui.querySelector<HTMLButtonElement>('[data-action="demo"]')?.addEventListener('click', addDemoRoute);
ui.querySelector<HTMLButtonElement>('[data-action="reset"]')?.addEventListener('click', resetDigging);
ui.querySelector<HTMLButtonElement>('[data-action="mode"]')?.addEventListener('click', (event) => {
  interactionMode = interactionMode === 'dig' ? 'pan' : 'dig';
  const button = event.currentTarget as HTMLButtonElement;
  const digging = interactionMode === 'dig';
  button.setAttribute('aria-pressed', String(digging));
  button.textContent = digging ? 'Modus: Graben' : 'Modus: Kamera';
  renderer.domElement.style.cursor = digging ? 'crosshair' : 'grab';
  digHover.visible = false;
  if (statusTitle) statusTitle.textContent = digging ? 'Freies Graben aktiv' : 'Kamera-Modus aktiv';
  if (statusCopy) statusCopy.textContent = digging
    ? 'Tippe oder ziehe über erreichbaren Fels.'
    : 'Ziehe die Karte an die gewünschte Position.';
});
ui.querySelector<HTMLButtonElement>('[data-action="zoom-in"]')?.addEventListener('click', () => {
  viewHeight = THREE.MathUtils.clamp(viewHeight * 0.84, 9.5, 23);
  updateCamera();
});
ui.querySelector<HTMLButtonElement>('[data-action="zoom-out"]')?.addEventListener('click', () => {
  viewHeight = THREE.MathUtils.clamp(viewHeight * 1.18, 9.5, 23);
  updateCamera();
});

ui.querySelector<HTMLButtonElement>('[data-action="actor"]')?.addEventListener('click', (event) => {
  actorRunning = !actorRunning;
  const button = event.currentTarget as HTMLButtonElement;
  button.setAttribute('aria-pressed', String(actorRunning));
  button.textContent = actorRunning ? 'Arbeiter läuft' : 'Arbeiter pausiert';
  root.dataset.actor = actorRunning ? 'running' : 'paused';
});

ui.querySelectorAll<HTMLButtonElement>('[data-surface]').forEach((button) => {
  button.addEventListener('click', () => {
    surfaceStyle = button.dataset.surface as SurfaceStyle;
    ui.querySelectorAll<HTMLButtonElement>('[data-surface]').forEach((candidate) => {
      candidate.setAttribute('aria-pressed', String(candidate === button));
    });
    rebuildGeometry();
  });
});

function syncActorPosition(): void {
  const from = layout.actorPath[actorSegment % layout.actorPath.length];
  const to = layout.actorPath[(actorSegment + 1) % layout.actorPath.length];
  actor.position.set(
    THREE.MathUtils.lerp(from.x, to.x, actorProgress),
    0.82,
    THREE.MathUtils.lerp(from.z, to.z, actorProgress),
  );
  actorShadow.position.set(actor.position.x, 0.045, actor.position.z + 0.06);
  root.dataset.actorX = actor.position.x.toFixed(2);
  root.dataset.actorZ = actor.position.z.toFixed(2);
}

function updateWorkerAnimation(delta: number): void {
  if (!workerAnimated) return;
  workerAnimationTime += delta;
  const from = layout.actorPath[actorSegment % layout.actorPath.length];
  const to = layout.actorPath[(actorSegment + 1) % layout.actorPath.length];
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const row = Math.abs(dx) > Math.abs(dz) ? 2 : dz < 0 ? 1 : 0;
  const frame = actorRunning ? Math.floor(workerAnimationTime * 8) % 4 : 1;
  workerMap.offset.set(frame / 4, 1 - (row + 1) / 6);
  actor.scale.x = (dx < 0 && row === 2 ? -1 : 1) * 1.55;
}

function updateActor(delta: number): void {
  if (!actorRunning) return;
  let remaining = delta * 1.8;
  while (remaining > 0) {
    const from = layout.actorPath[actorSegment % layout.actorPath.length];
    const to = layout.actorPath[(actorSegment + 1) % layout.actorPath.length];
    const length = Math.max(0.001, Math.hypot(to.x - from.x, to.z - from.z));
    const available = (1 - actorProgress) * length;
    if (remaining < available) {
      actorProgress += remaining / length;
      remaining = 0;
    } else {
      remaining -= available;
      actorSegment = (actorSegment + 1) % layout.actorPath.length;
      actorProgress = 0;
    }
  }
  syncActorPosition();
}

let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;
let pointerStartX = 0;
let pointerStartY = 0;
let pointerMoved = false;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

function pointedCell(clientX: number, clientY: number): { x: number; z: number } | undefined {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(
    ((clientX - rect.left) / rect.width) * 2 - 1,
    -((clientY - rect.top) / rect.height) * 2 + 1,
  );
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(digPlane, false)[0];
  if (!hit) return undefined;
  return { x: Math.floor(hit.point.x), z: Math.floor(hit.point.z) };
}

function updateDigHover(clientX: number, clientY: number): void {
  if (interactionMode !== 'dig') {
    digHover.visible = false;
    return;
  }
  const cell = pointedCell(clientX, clientY);
  if (!cell) {
    digHover.visible = false;
    return;
  }
  const frontier = new Set(layout.nextDig.map((candidate) => proofCellKey(candidate.x, candidate.z)));
  digHover.visible = frontier.has(proofCellKey(cell.x, cell.z));
  if (digHover.visible) digHover.position.set(cell.x + 0.5, 0.07, cell.z + 0.5);
}

function tryDig(clientX: number, clientY: number): void {
  const cellAtPointer = pointedCell(clientX, clientY);
  if (!cellAtPointer) return;
  const { x, z } = cellAtPointer;
  const key = proofCellKey(x, z);
  const frontier = new Set(layout.nextDig.map((cell) => proofCellKey(cell.x, cell.z)));
  if (!frontier.has(key)) {
    if (statusTitle) statusTitle.textContent = openCells.has(key) ? 'Dieses Feld ist bereits offen' : 'Fels ist noch nicht erreichbar';
    if (statusCopy) statusCopy.textContent = 'Grabe zunächst ein direkt angrenzendes Feld.';
    return;
  }
  const cell: ProofCell = { x, z, zone: 'corridor' };
  openCells.set(key, cell);
  dugCells += 1;
  syncLayout();
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  pointerStartX = event.clientX;
  pointerStartY = event.clientY;
  pointerMoved = false;
  renderer.domElement.classList.add('dragging');
  renderer.domElement.setPointerCapture(event.pointerId);
  if (interactionMode === 'dig') tryDig(event.clientX, event.clientY);
});
renderer.domElement.addEventListener('pointermove', (event) => {
  updateDigHover(event.clientX, event.clientY);
  if (!dragging) return;
  if (interactionMode === 'dig') {
    tryDig(event.clientX, event.clientY);
    return;
  }
  if (Math.hypot(event.clientX - pointerStartX, event.clientY - pointerStartY) > 7) pointerMoved = true;
  if (!pointerMoved) return;
  const scale = viewHeight / Math.max(320, window.innerHeight);
  cameraTarget.x -= (event.clientX - lastPointerX) * scale;
  cameraTarget.z -= (event.clientY - lastPointerY) * scale;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  updateCamera();
});
renderer.domElement.addEventListener('pointerleave', () => {
  if (!dragging) digHover.visible = false;
});
renderer.domElement.addEventListener('pointerup', (event) => {
  const wasTap = interactionMode === 'pan' && !pointerMoved;
  dragging = false;
  renderer.domElement.classList.remove('dragging');
  renderer.domElement.releasePointerCapture(event.pointerId);
  if (wasTap) tryDig(event.clientX, event.clientY);
});
renderer.domElement.addEventListener('wheel', (event) => {
  event.preventDefault();
  viewHeight = THREE.MathUtils.clamp(viewHeight * Math.exp(event.deltaY * 0.001), 9.5, 23);
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
let diagnosticTime = 0;
let diagnosticFrames = 0;

function animate(timestamp: number): void {
  requestAnimationFrame(animate);
  if (document.hidden) return;
  const targetFps = actorRunning || dragging ? 60 : 30;
  const interval = 1000 / targetFps;
  const sinceLast = timestamp - lastRenderedAt;
  if (sinceLast < interval) return;
  lastRenderedAt = timestamp - (sinceLast % interval);
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.05);
  updateActor(delta);
  updateWorkerAnimation(delta);
  renderer.render(scene, camera);
  diagnosticTime += delta;
  diagnosticFrames += 1;
  if (diagnosticTime >= 1) {
    const fps = Math.round(diagnosticFrames / diagnosticTime);
    if (performanceOutput) performanceOutput.textContent = `${renderer.info.render.calls}D · ${fps}FPS`;
    root.dataset.fps = String(fps);
    root.dataset.drawCalls = String(renderer.info.render.calls);
    diagnosticTime = 0;
    diagnosticFrames = 0;
  }
}

updateCamera();
rebuildGeometry();
updateUi();
syncActorPosition();
root.dataset.ready = 'true';
root.dataset.actor = 'running';
renderer.domElement.style.cursor = 'crosshair';
document.documentElement.dataset.geometryProofReady = 'true';
document.querySelector('.geometry-loading')?.remove();
renderer.shadowMap.needsUpdate = true;
requestAnimationFrame(animate);

window.addEventListener('beforeunload', () => {
  timer.dispose();
  renderer.dispose();
  tileGeometry.dispose();
  markerGeometry.dispose();
  unitBox.dispose();
  actorShadowGeometry.dispose();
  digPlaneGeometry.dispose();
}, { once: true });
