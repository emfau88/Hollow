import * as THREE from 'three';
import { resolveVisualTheme } from '../../config/VisualTheme';
import {
  createWallGauntletLayout,
  topologyDegrees,
  type GauntletLayout,
  type GauntletModule,
  type SpecimenFamily,
  type WallFamily,
} from './WallGauntletModel';
import './wall-gauntlet-style.css';

type AssetSet = 'golden-v1' | 'production-v7';
type ViewPreset = 'overview' | 'specimens' | 'connections' | 'occlusion';
type OcclusionMode = 'exact' | 'hybrid';

const rootElement = document.querySelector<HTMLElement>('#wall-gauntlet');
const canvasHostElement = document.querySelector<HTMLElement>('#gauntlet-canvas');
if (!rootElement || !canvasHostElement) throw new Error('Wall Gauntlet host is missing.');
const root: HTMLElement = rootElement;
const canvasHost: HTMLElement = canvasHostElement;

document.documentElement.dataset.gauntlet = 'wall-topology-v1';

function asset(path: string): string {
  return new URL(path, document.baseURI).href;
}

const productionTheme = resolveVisualTheme('?theme=style-b');
const goldenTheme = resolveVisualTheme('?theme=style-b&wall-prototype=golden-v1');
const wallKits = {
  'production-v7': productionTheme.assets.wallKit!,
  'golden-v1': goldenTheme.assets.wallKit!,
} as const;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06111f);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 1000 ? 1 : 1.25));
renderer.setSize(window.innerWidth, window.innerHeight);
canvasHost.append(renderer.domElement);

const camera = new THREE.OrthographicCamera(-16, 16, 9, -9, 0.1, 100);
camera.up.set(0, 1, 0);
const cameraOffset = new THREE.Vector3(0, 31, 10.5);
const cameraTarget = new THREE.Vector3(13.5, 0, 11.5);
let viewHeight = 24.5;
let activeView: ViewPreset = 'overview';

const presets: Record<ViewPreset, { x: number; z: number; height: number; width: number }> = {
  overview: { x: 13.5, z: 11.5, height: 24.5, width: 29 },
  specimens: { x: 13.5, z: 4.4, height: 10.2, width: 28 },
  connections: { x: 14.5, z: 15.3, height: 13.8, width: 14 },
  occlusion: { x: 3.8, z: 14.2, height: 7.4, width: 8.5 },
};

function reservedPanelWidth(): number {
  if (window.innerWidth <= 760 || window.innerHeight <= 500) return 0;
  return Math.min(364, window.innerWidth * 0.38);
}

function framedHeight(view: ViewPreset): number {
  const preset = presets[view];
  const availableWidth = Math.max(320, window.innerWidth - reservedPanelWidth());
  const availableAspect = availableWidth / Math.max(window.innerHeight, 1);
  return Math.max(preset.height, preset.width / availableAspect);
}

function updateCamera(): void {
  const aspect = Math.max(0.25, window.innerWidth / Math.max(window.innerHeight, 1));
  const width = viewHeight * aspect;
  const projectionShift = (reservedPanelWidth() / Math.max(window.innerWidth, 1)) * width / 2;
  camera.left = -width / 2 + projectionShift;
  camera.right = width / 2 + projectionShift;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.position.copy(cameraTarget).add(cameraOffset);
  camera.lookAt(cameraTarget);
  camera.updateProjectionMatrix();
}

const world = new THREE.Group();
scene.add(world);

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();
const wallMaterialCache = new Map<string, THREE.MeshBasicMaterial>();
const floorMaterialCache = new Map<string, THREE.MeshBasicMaterial>();

async function loadTexture(path: string, atlas = false): Promise<THREE.Texture> {
  const cached = textureCache.get(path);
  if (cached) return cached;
  const texture = await textureLoader.loadAsync(asset(path));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = atlas ? THREE.LinearFilter : THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = !atlas;
  texture.anisotropy = atlas ? 1 : Math.min(4, renderer.capabilities.getMaxAnisotropy());
  texture.needsUpdate = true;
  textureCache.set(path, texture);
  return texture;
}

function wallAtlasPath(assetSet: AssetSet, family: WallFamily): string {
  const kit = wallKits[assetSet];
  if (family === 'built') return kit.atlas!;
  if (family === 'fortified') return kit.neutralAtlas!;
  if (family === 'natural') return kit.naturalAtlas!;
  return kit.corridorAtlas!;
}

function thresholdAtlasPath(assetSet: AssetSet, family: 'built' | 'natural'): string {
  const kit = wallKits[assetSet];
  return family === 'natural' ? kit.naturalThresholdAtlas! : kit.builtThresholdAtlas!;
}

function frameGeometry(frame: number, rows: 1 | 4): THREE.BufferGeometry {
  const columns = 4;
  const column = frame % columns;
  const row = rows === 1 ? 0 : Math.floor(frame / columns);
  const imageWidth = 384;
  const imageHeight = rows === 1 ? 96 : 384;
  const frameWidth = 96;
  const frameHeight = 96;
  const inset = 0.55;
  const u0 = (column * frameWidth + inset) / imageWidth;
  const u1 = ((column + 1) * frameWidth - inset) / imageWidth;
  const vTop = 1 - ((row * frameHeight + inset) / imageHeight);
  const vBottom = 1 - (((row + 1) * frameHeight - inset) / imageHeight);
  const half = 1.5;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -half, half, 0,
    half, half, 0,
    -half, -half, 0,
    half, -half, 0,
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    u0, vTop,
    u1, vTop,
    u0, vBottom,
    u1, vBottom,
  ], 2));
  geometry.setIndex([0, 2, 1, 2, 3, 1]);
  geometry.computeBoundingSphere();
  return geometry;
}

const wallFrameGeometries = Array.from({ length: 16 }, (_, frame) => frameGeometry(frame, 4));
const thresholdFrameGeometries = Array.from({ length: 4 }, (_, frame) => frameGeometry(frame, 1));
const tileGeometry = new THREE.PlaneGeometry(1.015, 1.015).rotateX(-Math.PI / 2);
const rockGeometry = new THREE.PlaneGeometry(1.02, 1.02).rotateX(-Math.PI / 2);
const occluderGeometry = new THREE.BoxGeometry(1.06, 1.52, 0.18);

async function wallMaterial(path: string): Promise<THREE.MeshBasicMaterial> {
  const cached = wallMaterialCache.get(path);
  if (cached) return cached;
  const map = await loadTexture(path, true);
  const material = new THREE.MeshBasicMaterial({
    map,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.025,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
    fog: false,
  });
  wallMaterialCache.set(path, material);
  return material;
}

async function floorMaterial(path: string, color = 0xffffff): Promise<THREE.MeshBasicMaterial> {
  const key = `${path}:${color}`;
  const cached = floorMaterialCache.get(key);
  if (cached) return cached;
  const map = await loadTexture(path);
  const material = new THREE.MeshBasicMaterial({ map, color, toneMapped: false });
  floorMaterialCache.set(key, material);
  return material;
}

function instancedMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  positions: Array<{ x: number; y: number; z: number }>,
  quaternion = new THREE.Quaternion(),
): THREE.InstancedMesh | undefined {
  if (positions.length === 0) return undefined;
  const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
  const matrix = new THREE.Matrix4();
  const scale = new THREE.Vector3(1, 1, 1);
  positions.forEach((position, index) => {
    matrix.compose(new THREE.Vector3(position.x, position.y, position.z), quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function cellKey(x: number, z: number): string {
  return `${x},${z}`;
}

let activeAssetSet: AssetSet = 'golden-v1';
let activeFamily: SpecimenFamily = 'built';
let dynamicCrossOpen = false;
let occlusionMode: OcclusionMode = 'exact';
let actorRunning = true;
let layout: GauntletLayout = createWallGauntletLayout(activeFamily, dynamicCrossOpen);
let terrainGroup = new THREE.Group();
let wallGroup = new THREE.Group();
let labelGroup = new THREE.Group();
let occluderGroup = new THREE.Group();
world.add(terrainGroup, wallGroup, labelGroup, occluderGroup);

const depthMaskMaterial = new THREE.MeshBasicMaterial({
  colorWrite: false,
  depthWrite: true,
  depthTest: true,
  side: THREE.DoubleSide,
});

function removeGroup(group: THREE.Group): THREE.Group {
  world.remove(group);
  group.clear();
  return new THREE.Group();
}

function familyFloorPath(family: WallFamily): string {
  if (family === 'built') return 'assets/generated/style-b-v3/terrain/claimed-floor.png';
  if (family === 'natural') return 'assets/generated/style-b-v3/terrain/damp-floor.png';
  if (family === 'fortified') return 'assets/generated/style-b-v3/terrain/raw-floor.png';
  return 'assets/generated/style-b-v3/terrain/claimed-corridor.png';
}

function familyColor(family: WallFamily): number {
  if (family === 'built') return 0xffffff;
  if (family === 'fortified') return 0xb4c1c8;
  if (family === 'natural') return 0xb5f0dc;
  return 0xc2d8f3;
}

function specimenLabelTexture(text: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 54;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable.');
  context.fillStyle = 'rgba(4, 14, 28, 0.90)';
  context.strokeStyle = 'rgba(216, 165, 50, 0.75)';
  context.lineWidth = 2;
  context.beginPath();
  context.roundRect(2, 2, 316, 50, 7);
  context.fill();
  context.stroke();
  context.fillStyle = '#f2ddb0';
  context.font = '700 25px Arial Narrow, Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 160, 28);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function addWorldLabel(
  text: string,
  x: number,
  z: number,
  width: number,
  kind: 'specimen' | 'connection',
): void {
  const material = new THREE.SpriteMaterial({
    map: specimenLabelTexture(text),
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.position.set(x, 0.22, z);
  sprite.scale.set(width, 0.68, 1);
  sprite.renderOrder = 310;
  sprite.userData.labelKind = kind;
  labelGroup.add(sprite);
}

function syncLabelVisibility(): void {
  for (const child of labelGroup.children) {
    child.visible = child.userData.labelKind === 'specimen'
      ? activeView === 'overview' || activeView === 'specimens'
      : activeView === 'connections';
  }
}

function buildLabels(): void {
  labelGroup = removeGroup(labelGroup);
  for (const specimen of layout.specimens) {
    addWorldLabel(`${specimen.label} · F${specimen.expectedFrame}`, specimen.x, specimen.z + 1.72, 3.45, 'specimen');
  }
  addWorldLabel('X · 4 Wege', 11.5, 11.55, 2.2, 'connection');
  addWorldLabel(dynamicCrossOpen ? 'X · dynamisch' : 'T · dynamisch', 15.5, 11.55, 2.55, 'connection');
  addWorldLabel('1 Feld breit', 8.5, 12.05, 2.45, 'connection');
  addWorldLabel('2 Felder breit', 14, 16.05, 2.7, 'connection');
  addWorldLabel('Schwelle Natur', 18.55, 12.05, 2.65, 'connection');
  addWorldLabel('Schwelle Built', 11.5, 18.45, 2.6, 'connection');
  syncLabelVisibility();
  world.add(labelGroup);
}

async function buildTerrain(): Promise<void> {
  terrainGroup = removeGroup(terrainGroup);
  const open = new Set(layout.cells.map((cell) => cellKey(cell.x, cell.z)));
  const rockPositions: Array<{ x: number; y: number; z: number }> = [];
  for (let z = layout.bounds.minZ; z <= layout.bounds.maxZ; z += 1) {
    for (let x = layout.bounds.minX; x <= layout.bounds.maxX; x += 1) {
      if (!open.has(cellKey(x, z))) rockPositions.push({ x: x + 0.5, y: -0.025, z: z + 0.5 });
    }
  }
  const rock = instancedMesh(
    rockGeometry,
    await floorMaterial('assets/generated/style-b-v3/terrain/rock-top.png', 0x7390a5),
    rockPositions,
  );
  if (rock) terrainGroup.add(rock);

  const byFamily = new Map<WallFamily, Array<{ x: number; y: number; z: number }>>();
  for (const cell of layout.cells) {
    const family: WallFamily = cell.architecture === 'built-room'
      ? 'built'
      : cell.architecture === 'fortified-chamber'
        ? 'fortified'
        : cell.architecture === 'natural-cavern'
          ? 'natural'
          : 'corridor';
    const positions = byFamily.get(family) ?? [];
    positions.push({ x: cell.x + 0.5, y: 0.015, z: cell.z + 0.5 });
    byFamily.set(family, positions);
  }
  for (const [family, positions] of byFamily) {
    const mesh = instancedMesh(
      tileGeometry,
      await floorMaterial(familyFloorPath(family), familyColor(family)),
      positions,
    );
    if (mesh) terrainGroup.add(mesh);
  }
  world.add(terrainGroup);
}

function modulePath(module: GauntletModule): string {
  return module.kind === 'threshold'
    ? thresholdAtlasPath(activeAssetSet, module.family)
    : wallAtlasPath(activeAssetSet, module.family);
}

async function buildWalls(): Promise<void> {
  wallGroup = removeGroup(wallGroup);
  const grouped = new Map<string, { module: GauntletModule; positions: Array<{ x: number; y: number; z: number }> }>();
  for (const module of layout.modules) {
    const path = modulePath(module);
    const key = `${module.kind}:${path}:${module.frame}`;
    const group = grouped.get(key) ?? { module, positions: [] };
    group.positions.push({ x: module.x, y: 0.08, z: module.z });
    grouped.set(key, group);
  }

  for (const group of grouped.values()) {
    const module = group.module;
    const mesh = instancedMesh(
      module.kind === 'threshold'
        ? thresholdFrameGeometries[module.frame]
        : wallFrameGeometries[module.frame],
      await wallMaterial(modulePath(module)),
      group.positions,
      camera.quaternion,
    );
    if (!mesh) continue;
    mesh.renderOrder = module.kind === 'threshold' ? 190 : module.kind === 'edge' ? 200 : 210;
    wallGroup.add(mesh);
  }
  world.add(wallGroup);
}

function buildOccluders(): void {
  occluderGroup = removeGroup(occluderGroup);
  const positions = layout.modules
    .filter((module) => module.kind === 'edge' && module.frame === 2)
    .map((module) => ({ x: module.x, y: 0.76, z: module.z + 0.03 }));
  const mesh = instancedMesh(occluderGeometry, depthMaskMaterial, positions);
  if (mesh) {
    // The mask must populate depth after the opaque floor has written color,
    // but before the transparent worker sprite is tested against that depth.
    mesh.renderOrder = 180;
    occluderGroup.add(mesh);
  }
  occluderGroup.visible = occlusionMode === 'hybrid';
  world.add(occluderGroup);
}

const actorTexture = await loadTexture(productionTheme.assets.worker);
actorTexture.generateMipmaps = false;
actorTexture.minFilter = THREE.LinearFilter;
const actorMaterial = new THREE.SpriteMaterial({
  map: actorTexture,
  color: 0xffffff,
  transparent: true,
  alphaTest: 0.025,
  depthTest: true,
  depthWrite: false,
  toneMapped: false,
});
const actor = new THREE.Sprite(actorMaterial);
actor.scale.set(1.65, 1.65, 1);
actor.renderOrder = 220;
world.add(actor);

const actorShadow = new THREE.Mesh(
  new THREE.CircleGeometry(0.43, 24).rotateX(-Math.PI / 2),
  new THREE.MeshBasicMaterial({
    color: 0x020710,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  }),
);
actorShadow.renderOrder = 100;
world.add(actorShadow);

let actorSegment = 0;
let actorSegmentProgress = 0;

function syncActorPosition(): void {
  const from = layout.actorPath[actorSegment % layout.actorPath.length];
  const to = layout.actorPath[(actorSegment + 1) % layout.actorPath.length];
  actor.position.set(
    THREE.MathUtils.lerp(from.x, to.x, actorSegmentProgress),
    0.82,
    THREE.MathUtils.lerp(from.z, to.z, actorSegmentProgress),
  );
  actorShadow.position.set(actor.position.x, 0.035, actor.position.z + 0.05);
  root.dataset.actorX = actor.position.x.toFixed(2);
  root.dataset.actorZ = actor.position.z.toFixed(2);
}

function updateActor(delta: number): void {
  if (!actorRunning) return;
  let remaining = delta * 2.15;
  while (remaining > 0) {
    const from = layout.actorPath[actorSegment % layout.actorPath.length];
    const to = layout.actorPath[(actorSegment + 1) % layout.actorPath.length];
    const length = Math.max(0.001, Math.hypot(to.x - from.x, to.z - from.z));
    const available = (1 - actorSegmentProgress) * length;
    if (remaining < available) {
      actorSegmentProgress += remaining / length;
      remaining = 0;
    } else {
      remaining -= available;
      actorSegment = (actorSegment + 1) % layout.actorPath.length;
      actorSegmentProgress = 0;
    }
  }
  syncActorPosition();
}

const ui = document.createElement('div');
ui.className = 'gauntlet-ui';
ui.innerHTML = `
  <div class="gauntlet-badge">Topologievertrag: 5/5 automatisierte Tests</div>
  <section class="gauntlet-panel" aria-labelledby="gauntlet-title">
    <header>
      <span>Isolierter Beweisstand</span>
      <h1 id="gauntlet-title">Wall Topology Gauntlet</h1>
      <p>Dieselbe Topologie wird ohne Spielsysteme mit dem Mockup-Kandidaten und dem aktuellen Produktionskit gerendert.</p>
    </header>

    <h3>Assetvertrag</h3>
    <div class="gauntlet-controls" data-columns="2" aria-label="Assetvertrag">
      <button type="button" data-asset="golden-v1" aria-pressed="true">Golden-v1<br>Kandidat</button>
      <button type="button" data-asset="production-v7" aria-pressed="false">V7<br>Kontrolle</button>
    </div>

    <h3>Prüfansicht</h3>
    <div class="gauntlet-controls" data-columns="2" aria-label="Prüfansicht">
      <button type="button" data-view="overview" aria-pressed="true">Gesamt</button>
      <button type="button" data-view="specimens">10 Knoten</button>
      <button type="button" data-view="connections">L / T / X</button>
      <button type="button" data-view="occlusion">Verdeckung</button>
    </div>

    <h3>Knotenfamilie</h3>
    <div class="gauntlet-family-controls" aria-label="Knotenfamilie">
      <button type="button" data-family="built" aria-pressed="true">Built</button>
      <button type="button" data-family="corridor">Gang</button>
      <button type="button" data-family="natural">Natur</button>
      <button type="button" data-family="fortified">Fort</button>
    </div>

    <h3>Dynamik und Verdeckung</h3>
    <div class="gauntlet-controls" data-columns="3">
      <button type="button" data-action="cross" aria-pressed="false">T → X</button>
      <button type="button" data-action="actor" aria-pressed="true">Arbeiter läuft</button>
      <button type="button" data-action="occlusion" aria-pressed="false">Exakt: Sprite</button>
    </div>

    <h3>Abdeckung</h3>
    <ul class="gauntlet-checklist" data-checklist></ul>
    <div class="gauntlet-caveat" data-gauntlet-caveat></div>

    <div class="gauntlet-metrics">
      <div><dt>Zellen</dt><dd data-cells>–</dd></div>
      <div><dt>Module</dt><dd data-modules>–</dd></div>
      <div><dt>Renderer</dt><dd data-performance>–</dd></div>
    </div>
    <footer><span>Quelle: VisualTheme.wallKit</span><span data-contract>–</span></footer>
  </section>
  <div class="gauntlet-legend">
    <span><i style="background:#e7b94c"></i>Gold = Wandkarte</span>
    <span><i style="background:#62cba8"></i>Grün = geprüft</span>
    <span>Ziehen: Kamera · Mausrad: Zoom</span>
  </div>
`;
root.append(ui);

const checklist = ui.querySelector<HTMLElement>('[data-checklist]');
const caveat = ui.querySelector<HTMLElement>('[data-gauntlet-caveat]');
const cellsOutput = ui.querySelector<HTMLElement>('[data-cells]');
const modulesOutput = ui.querySelector<HTMLElement>('[data-modules]');
const performanceOutput = ui.querySelector<HTMLElement>('[data-performance]');
const contractOutput = ui.querySelector<HTMLElement>('[data-contract]');

function setPressed(selector: string, value: string): void {
  ui.querySelectorAll<HTMLButtonElement>(selector).forEach((button) => {
    const selected = button.dataset.asset === value
      || button.dataset.view === value
      || button.dataset.family === value;
    button.setAttribute('aria-pressed', String(selected));
  });
}

function setView(view: ViewPreset): void {
  activeView = view;
  const preset = presets[view];
  cameraTarget.set(preset.x, 0, preset.z);
  viewHeight = framedHeight(view);
  if (view === 'occlusion') {
    actorSegment = 0;
    actorSegmentProgress = 0.112;
    actorRunning = false;
    syncActorPosition();
    const actorButton = ui.querySelector<HTMLButtonElement>('[data-action="actor"]');
    if (actorButton) {
      actorButton.setAttribute('aria-pressed', 'false');
      actorButton.textContent = 'Arbeiter pausiert';
    }
    root.dataset.actor = 'paused';
  }
  updateCamera();
  syncLabelVisibility();
  setPressed('[data-view]', view);
  root.dataset.view = view;
}

function updateDiagnostics(): void {
  const edgeFrames = new Set(layout.modules.filter((module) => module.kind === 'edge').map((module) => module.frame));
  const jointFrames = new Set(layout.specimens.map((specimen) => specimen.expectedFrame));
  const thresholdKinds = new Set(layout.modules
    .filter((module) => module.kind === 'threshold')
    .map((module) => `${module.family}:${module.frame}`));
  const degrees = topologyDegrees(layout.cells);
  const checks = [
    { key: 'edges', label: `Kantenframes 0–3: ${edgeFrames.size}/4`, pass: edgeFrames.size === 4 },
    { key: 'joints', label: `Außen/Innen/Diagonal: ${jointFrames.size}/10`, pass: jointFrames.size === 10 },
    { key: 'ltx', label: 'Gerade, L, T und X vorhanden', pass: [...degrees.values()].some((value) => value === 4) && [...degrees.values()].some((value) => value === 3) },
    { key: 'widths', label: 'Ein- und zweibreite Gänge vorhanden', pass: layout.cells.some((cell) => cell.x === 14 && cell.z === 17) && layout.cells.some((cell) => cell.x === 14 && cell.z === 18) },
    { key: 'thresholds', label: 'Built- und Natur-Schwellen vorhanden', pass: thresholdKinds.has('built:1') && thresholdKinds.has('natural:1') },
  ];
  if (checklist) checklist.innerHTML = checks.map((check) => `
    <li data-check="${check.key}" data-state="${check.pass ? 'pass' : 'fail'}">${check.label}</li>
  `).join('');
  if (cellsOutput) cellsOutput.textContent = String(layout.cells.length);
  if (modulesOutput) modulesOutput.textContent = String(layout.modules.length);
  if (contractOutput) contractOutput.textContent = wallKits[activeAssetSet].id;
  root.dataset.contractPass = String(checks.every((check) => check.pass));
  root.dataset.edgeFrames = String(edgeFrames.size);
  root.dataset.jointFrames = String(jointFrames.size);
  root.dataset.thresholdFamilies = String(new Set([...thresholdKinds].map((value) => value.split(':')[0])).size);

  if (caveat) {
    caveat.innerHTML = activeAssetSet === 'golden-v1'
      ? '<strong>Bewusste Restlücke:</strong> Golden-v1 enthält derzeit nur zwei tatsächlich unterschiedliche Familien (Built=Fortified, Natur=Gang). Seine Occlusion-Atlanten sind leer. „Hybrid“ zeigt deshalb nur, ob eine echte Tiefenmaske das Prinzip löst – nicht fertige Maskenkunst.'
      : '<strong>Kontrollgruppe:</strong> V7 besitzt vier getrennte Familien und denselben Framevertrag. Seine dünnen, generischen Knoten zeigen die aktuelle Assetgrenze; der Renderer darf sie nicht künstlich aufwerten.';
  }
}

async function rebuild(): Promise<void> {
  root.dataset.ready = 'building';
  layout = createWallGauntletLayout(activeFamily, dynamicCrossOpen);
  await Promise.all([buildTerrain(), buildWalls()]);
  buildLabels();
  buildOccluders();
  syncActorPosition();
  updateDiagnostics();
  root.dataset.assetSet = activeAssetSet;
  root.dataset.family = activeFamily;
  root.dataset.cross = dynamicCrossOpen ? 'x' : 't';
  root.dataset.occlusion = occlusionMode;
  root.dataset.ready = 'true';
}

ui.querySelectorAll<HTMLButtonElement>('[data-asset]').forEach((button) => {
  button.addEventListener('click', async () => {
    activeAssetSet = button.dataset.asset as AssetSet;
    setPressed('[data-asset]', activeAssetSet);
    await rebuild();
  });
});

ui.querySelectorAll<HTMLButtonElement>('[data-family]').forEach((button) => {
  button.addEventListener('click', async () => {
    activeFamily = button.dataset.family as SpecimenFamily;
    setPressed('[data-family]', activeFamily);
    await rebuild();
  });
});

ui.querySelectorAll<HTMLButtonElement>('[data-view]').forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view as ViewPreset));
});

ui.querySelector<HTMLButtonElement>('[data-action="cross"]')?.addEventListener('click', async (event) => {
  dynamicCrossOpen = !dynamicCrossOpen;
  const button = event.currentTarget as HTMLButtonElement;
  button.setAttribute('aria-pressed', String(dynamicCrossOpen));
  button.textContent = dynamicCrossOpen ? 'X aktiv' : 'T → X';
  await rebuild();
});

ui.querySelector<HTMLButtonElement>('[data-action="actor"]')?.addEventListener('click', (event) => {
  actorRunning = !actorRunning;
  const button = event.currentTarget as HTMLButtonElement;
  button.setAttribute('aria-pressed', String(actorRunning));
  button.textContent = actorRunning ? 'Arbeiter läuft' : 'Arbeiter pausiert';
  root.dataset.actor = actorRunning ? 'running' : 'paused';
});

ui.querySelector<HTMLButtonElement>('[data-action="occlusion"]')?.addEventListener('click', (event) => {
  occlusionMode = occlusionMode === 'exact' ? 'hybrid' : 'exact';
  occluderGroup.visible = occlusionMode === 'hybrid';
  const button = event.currentTarget as HTMLButtonElement;
  button.setAttribute('aria-pressed', String(occlusionMode === 'hybrid'));
  button.textContent = occlusionMode === 'hybrid' ? 'Hybrid: Tiefe' : 'Exakt: Sprite';
  root.dataset.occlusion = occlusionMode;
});

let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

renderer.domElement.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  renderer.domElement.classList.add('dragging');
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const scale = viewHeight / Math.max(window.innerHeight, 320);
  cameraTarget.x -= (event.clientX - lastPointerX) * scale;
  cameraTarget.z -= (event.clientY - lastPointerY) * scale * 1.08;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  updateCamera();
});
renderer.domElement.addEventListener('pointerup', (event) => {
  dragging = false;
  renderer.domElement.classList.remove('dragging');
  renderer.domElement.releasePointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('wheel', (event) => {
  event.preventDefault();
  viewHeight = THREE.MathUtils.clamp(viewHeight * Math.exp(event.deltaY * 0.001), 6, 36);
  updateCamera();
}, { passive: false });

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 1000 ? 1 : 1.25));
  viewHeight = framedHeight(activeView);
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
  renderer.render(scene, camera);
  diagnosticTime += delta;
  diagnosticFrames += 1;
  if (diagnosticTime >= 1) {
    const fps = Math.round(diagnosticFrames / diagnosticTime);
    if (performanceOutput) performanceOutput.textContent = `${renderer.info.render.calls}D · ${fps}FPS`;
    root.dataset.drawCalls = String(renderer.info.render.calls);
    root.dataset.fps = String(fps);
    diagnosticTime = 0;
    diagnosticFrames = 0;
  }
}

async function initialize(): Promise<void> {
  try {
    updateCamera();
    await rebuild();
    setView('overview');
    root.dataset.actor = 'running';
    document.documentElement.dataset.gauntletReady = 'true';
    document.querySelector('.gauntlet-loading')?.remove();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unbekannter Aufbaufehler.';
    root.dataset.ready = 'error';
    const loading = document.querySelector<HTMLElement>('.gauntlet-loading');
    if (loading) loading.textContent = `Gauntlet konnte nicht geladen werden: ${message}`;
    throw error;
  }
}

window.addEventListener('beforeunload', () => {
  timer.dispose();
  renderer.dispose();
  for (const geometry of wallFrameGeometries) geometry.dispose();
  for (const geometry of thresholdFrameGeometries) geometry.dispose();
  tileGeometry.dispose();
  rockGeometry.dispose();
  occluderGeometry.dispose();
}, { once: true });

requestAnimationFrame(animate);
void initialize();
