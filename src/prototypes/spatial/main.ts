import * as THREE from 'three';
import { createSpatialPrototypeLayout, type BoundaryRun, type Point2, type SpatialZone } from './layout';
import './style.css';

type PresetName = 'overview' | 'occlusion' | 'grotto';

interface PrototypeApi {
  getState(): { preset: PresetName; zoom: number; motion: boolean; foregroundWall: boolean };
  setPreset(preset: PresetName): void;
  setMotion(enabled: boolean): void;
}

declare global {
  interface Window {
    spatialPrototype?: PrototypeApi;
  }
}

const root = document.querySelector<HTMLElement>('#spatial-prototype');
const canvasHost = document.querySelector<HTMLElement>('#prototype-canvas');

if (!root || !canvasHost) throw new Error('Spatial prototype host is missing.');

const layout = createSpatialPrototypeLayout();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x06111f);
scene.fog = new THREE.FogExp2(0x06111f, 0.018);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
canvasHost.append(renderer.domElement);

const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 80);
camera.up.set(0, 1, 0);
const cameraOffset = new THREE.Vector3(0, 18, 10.4);

const cameraTarget = new THREE.Vector3(3.3, 0, 0);
let viewHeight = 11.2;
let activePreset: PresetName = 'overview';
let motionEnabled = new URLSearchParams(window.location.search).get('motion') !== '0';

const world = new THREE.Group();
scene.add(world);

const wallGroups: Record<SpatialZone, THREE.Group> = {
  built: new THREE.Group(),
  corridor: new THREE.Group(),
  natural: new THREE.Group(),
};
world.add(wallGroups.built, wallGroups.corridor, wallGroups.natural);

const foregroundWalls = new THREE.Group();
wallGroups.built.add(foregroundWalls);

const color = {
  void: 0x071427,
  rock: 0x102c4a,
  roomFloor: 0x3a273d,
  corridorFloor: 0x1b3448,
  builtFace: 0x3d293e,
  builtCap: 0xc2b89d,
  brass: 0xd8a532,
  corridorFace: 0x253b49,
  corridorCap: 0x829498,
  grottoFloor: 0x236c69,
  grottoRock: 0x315f5d,
  grottoRockTop: 0x79a178,
  mint: 0x55e6bd,
  warm: 0xffb84f,
};

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function stoneTexture(base: string, mortar: string, seed: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas 2D context is unavailable.');
  const random = seededRandom(seed);

  context.fillStyle = base;
  context.fillRect(0, 0, 256, 256);
  context.lineWidth = 5;
  context.strokeStyle = mortar;

  for (let row = 0; row < 6; row += 1) {
    const y0 = row * 44 - 5;
    const offset = row % 2 === 0 ? -28 : 4;
    for (let column = 0; column < 7; column += 1) {
      const x0 = offset + column * 48;
      const inset = random() * 6;
      context.fillStyle = `rgba(255,255,255,${0.025 + random() * 0.05})`;
      context.fillRect(x0 + 4 + inset, y0 + 4, 39 - inset, 34 + random() * 5);
      context.strokeRect(x0, y0, 48, 44);
    }
  }

  for (let index = 0; index < 90; index += 1) {
    const shade = random() > 0.5 ? 255 : 0;
    context.fillStyle = `rgba(${shade},${shade},${shade},${0.018 + random() * 0.035})`;
    const size = 1 + random() * 3;
    context.fillRect(random() * 256, random() * 256, size, size);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

const roomFloorTexture = stoneTexture('#39283e', '#201a29', 41);
roomFloorTexture.repeat.set(1.5, 1.5);
const corridorFloorTexture = stoneTexture('#20394a', '#122838', 73);
corridorFloorTexture.repeat.set(1.25, 1.25);
const voidTexture = stoneTexture('#102d4d', '#0a2038', 19);
voidTexture.repeat.set(16, 12);

const roomFloorMaterial = new THREE.MeshStandardMaterial({
  color: color.roomFloor,
  map: roomFloorTexture,
  roughness: 0.88,
  metalness: 0.02,
});
const corridorFloorMaterial = new THREE.MeshStandardMaterial({
  color: color.corridorFloor,
  map: corridorFloorTexture,
  roughness: 0.94,
});

function addMesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material | THREE.Material[],
  position: THREE.Vector3,
  parent: THREE.Object3D = world,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

const underworld = addMesh(
  new THREE.BoxGeometry(60, 0.25, 38),
  new THREE.MeshStandardMaterial({ color: color.rock, map: voidTexture, roughness: 1 }),
  new THREE.Vector3(3.5, -0.28, 0),
);
underworld.castShadow = false;

for (const zone of ['built', 'corridor'] as const) {
  const cells = layout.cells.filter((cell) => cell.zone === zone);
  const material = zone === 'built' ? roomFloorMaterial : corridorFloorMaterial;
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.98, 0.12, 0.98), material, cells.length);
  cells.forEach((cell, index) => {
    tiles.setMatrixAt(index, new THREE.Matrix4().makeTranslation(cell.x, -0.04, cell.z));
  });
  tiles.castShadow = false;
  tiles.receiveShadow = true;
  world.add(tiles);
}

const builtFaceMaterial = new THREE.MeshStandardMaterial({ color: color.builtFace, roughness: 0.8 });
const builtCapMaterial = new THREE.MeshStandardMaterial({ color: color.builtCap, roughness: 0.72 });
const brassMaterial = new THREE.MeshStandardMaterial({
  color: color.brass,
  roughness: 0.38,
  metalness: 0.58,
});
const corridorFaceMaterial = new THREE.MeshStandardMaterial({ color: color.corridorFace, roughness: 0.94 });
const corridorCapMaterial = new THREE.MeshStandardMaterial({ color: color.corridorCap, roughness: 0.82 });

function addWallRun(run: BoundaryRun): void {
  const built = run.zone === 'built';
  const height = built ? layout.metrics.builtWallHeight : layout.metrics.corridorWallHeight;
  const thickness = built ? 0.34 : layout.metrics.corridorWallThickness;
  const alongX = run.axis === 'x';
  const width = alongX ? run.length + 0.04 : thickness;
  const depth = alongX ? thickness : run.length + 0.04;
  const x = alongX ? (run.start + run.end) / 2 : run.constant;
  const z = alongX ? run.constant : (run.start + run.end) / 2;
  const isForeground = built && run.side === 'south';
  const parent = isForeground ? foregroundWalls : wallGroups[run.zone];
  const faceMaterial = built ? builtFaceMaterial : corridorFaceMaterial;
  const capMaterial = built ? builtCapMaterial : corridorCapMaterial;

  addMesh(new THREE.BoxGeometry(width, height, depth), faceMaterial, new THREE.Vector3(x, height / 2, z), parent);
  addMesh(
    new THREE.BoxGeometry(width + 0.08, built ? 0.18 : 0.12, depth + 0.08),
    capMaterial,
    new THREE.Vector3(x, height + (built ? 0.035 : 0.025), z),
    parent,
  );

  if (!built) return;
  const clampCount = Math.max(1, Math.floor(run.length / 2.5));
  for (let index = 1; index <= clampCount; index += 1) {
    const along = run.start + (run.length * index) / (clampCount + 1);
    const clampX = alongX ? along : x;
    const clampZ = alongX ? z : along;
    addMesh(
      new THREE.BoxGeometry(alongX ? 0.16 : thickness + 0.11, 0.25, alongX ? thickness + 0.11 : 0.16),
      brassMaterial,
      new THREE.Vector3(clampX, height + 0.07, clampZ),
      parent,
    );
  }
}

layout.boundaries.forEach(addWallRun);

// A low, non-blocking architectural threshold between room and corridor.
addMesh(
  new THREE.BoxGeometry(0.18, 0.1, 1.72),
  brassMaterial,
  new THREE.Vector3(0.5, 0.08, 0.48),
);

function shapeFrom(points: Point2[]): THREE.Shape {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    const x = point.x;
    const y = -point.z;
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();
  return shape;
}

const grottoFloorMaterial = new THREE.MeshStandardMaterial({
  color: color.grottoFloor,
  roughness: 0.86,
  metalness: 0.04,
});
const grottoFloor = addMesh(
  new THREE.ShapeGeometry(shapeFrom(layout.grotto)),
  grottoFloorMaterial,
  new THREE.Vector3(0, 0.03, 0),
);
grottoFloor.rotation.x = -Math.PI / 2;
grottoFloor.castShadow = false;

const naturalRockMaterials = [
  new THREE.MeshStandardMaterial({ color: color.grottoRock, roughness: 1 }),
  new THREE.MeshStandardMaterial({ color: color.grottoRockTop, roughness: 0.92 }),
  new THREE.MeshStandardMaterial({ color: 0x244b55, roughness: 1 }),
];
const naturalWalls = new THREE.Group();
world.add(naturalWalls);
const caveRandom = seededRandom(233);
const rockMatrices: THREE.Matrix4[][] = naturalRockMaterials.map(() => []);

for (let edgeIndex = 0; edgeIndex < layout.grotto.length - 1; edgeIndex += 1) {
  const start = layout.grotto[edgeIndex];
  const end = layout.grotto[edgeIndex + 1];
  const length = Math.hypot(end.x - start.x, end.z - start.z);
  const count = Math.max(2, Math.ceil(length / 0.58));

  for (let index = 0; index <= count; index += 1) {
    const progress = index / count;
    const x = THREE.MathUtils.lerp(start.x, end.x, progress);
    const z = THREE.MathUtils.lerp(start.z, end.z, progress);
    const radius = 0.3 + caveRandom() * 0.18;
    const materialIndex = Math.floor(caveRandom() * naturalRockMaterials.length);
    const position = new THREE.Vector3(x, radius * (0.82 + caveRandom() * 0.35), z);
    const scale = new THREE.Vector3(
      radius * (0.85 + caveRandom() * 0.45),
      radius * (1.1 + caveRandom() * 0.55),
      radius * (0.82 + caveRandom() * 0.42),
    );
    const rotation = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(caveRandom() * 0.4, caveRandom() * Math.PI, caveRandom() * 0.35),
    );
    rockMatrices[materialIndex].push(new THREE.Matrix4().compose(position, rotation, scale));
  }
}

rockMatrices.forEach((matrices, materialIndex) => {
  const rocks = new THREE.InstancedMesh(
    new THREE.DodecahedronGeometry(1, 0),
    naturalRockMaterials[materialIndex],
    matrices.length,
  );
  matrices.forEach((matrix, index) => rocks.setMatrixAt(index, matrix));
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  naturalWalls.add(rocks);
});

const mushroomPlacements: Array<[number, number, number]> = [
  [9.1, -1.2, 1], [10.4, -2, 0.75], [11.8, -1.25, 1.18], [12.1, 0.8, 0.82],
  [10.5, 1.55, 1.25], [8.8, 1.25, 0.7], [11.4, 0.15, 0.55],
];
const mushroomStems = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.06, 0.09, 0.3, 8),
  new THREE.MeshStandardMaterial({ color: 0xb9d7b6, roughness: 0.8 }),
  mushroomPlacements.length,
);
const mushroomCaps = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.19, 12, 7),
  new THREE.MeshStandardMaterial({
    color: 0x51d9b6,
    emissive: 0x1ea88e,
    emissiveIntensity: 1.35,
    roughness: 0.55,
  }),
  mushroomPlacements.length,
);

mushroomPlacements.forEach(([x, z, scale], index) => {
  const identity = new THREE.Quaternion();
  mushroomStems.setMatrixAt(
    index,
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, 0.18 * scale, z),
      identity,
      new THREE.Vector3(scale, scale, scale),
    ),
  );
  mushroomCaps.setMatrixAt(
    index,
    new THREE.Matrix4().compose(
      new THREE.Vector3(x, 0.36 * scale, z),
      identity,
      new THREE.Vector3(scale, scale * 0.45, scale),
    ),
  );
});

for (const mushrooms of [mushroomStems, mushroomCaps]) {
  mushrooms.castShadow = true;
  mushrooms.receiveShadow = true;
  world.add(mushrooms);
}

const lampPositions: Array<[number, number]> = [[-4.25, -1.25], [-0.75, -1.25]];
const lampStands = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.09, 0.13, 0.65, 10),
  brassMaterial,
  lampPositions.length,
);
const lampGlows = new THREE.InstancedMesh(
  new THREE.SphereGeometry(0.16, 14, 10),
  new THREE.MeshStandardMaterial({ color: 0xffd98b, emissive: 0xff9e31, emissiveIntensity: 2.8 }),
  lampPositions.length,
);
lampPositions.forEach(([x, z], index) => {
  lampStands.setMatrixAt(index, new THREE.Matrix4().makeTranslation(x, 0.36, z));
  lampGlows.setMatrixAt(index, new THREE.Matrix4().makeTranslation(x, 0.76, z));
});
lampStands.castShadow = true;
lampStands.receiveShadow = true;
lampGlows.castShadow = false;
world.add(lampStands, lampGlows);

const textureLoader = new THREE.TextureLoader();

function asset(path: string): string {
  return new URL(path, document.baseURI).href;
}

function billboard(path: string, x: number, z: number, width: number, height: number): THREE.Sprite {
  const texture = textureLoader.load(asset(path));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.12,
    depthTest: true,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.center.set(0.5, 0);
  sprite.position.set(x, 0.04, z);
  sprite.scale.set(width, height, 1);
  world.add(sprite);

  const shadow = addMesh(
    new THREE.CircleGeometry(width * 0.31, 20),
    new THREE.MeshBasicMaterial({ color: 0x020713, transparent: true, opacity: 0.42, depthWrite: false }),
    new THREE.Vector3(x, 0.075, z),
  );
  shadow.rotation.x = -Math.PI / 2;
  sprite.userData.shadow = shadow;
  return sprite;
}

const foregroundWorker = billboard('assets/generated/style-b-v2/characters/worker.png', -3.6, 2.02, 0.9, 1.25);
const corridorWorker = billboard('assets/generated/style-b-v2/characters/guard.png', 2.5, 0, 0.82, 1.15);
billboard('assets/generated/style-b-v2/characters/worker.png', 10.8, 0.65, 0.86, 1.2);
billboard('assets/generated/style-b-v2/heart/core.png', -2.15, -0.15, 2.15, 2.25);

function moveSprite(sprite: THREE.Sprite, x: number, z: number): void {
  sprite.position.x = x;
  sprite.position.z = z;
  const shadow = sprite.userData.shadow as THREE.Mesh | undefined;
  if (shadow) {
    shadow.position.x = x;
    shadow.position.z = z;
  }
}

scene.add(new THREE.AmbientLight(0x172d48, 1.5));
const hemisphere = new THREE.HemisphereLight(0x86a8cb, 0x07101b, 1.35);
scene.add(hemisphere);

const keyLight = new THREE.DirectionalLight(0xffe3b0, 2.4);
keyLight.position.set(-7, 13, 8);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.left = -18;
keyLight.shadow.camera.right = 18;
keyLight.shadow.camera.top = 12;
keyLight.shadow.camera.bottom = -12;
keyLight.shadow.bias = -0.00045;
scene.add(keyLight, keyLight.target);
keyLight.target.position.set(3, 0, 0);

const roomLight = new THREE.PointLight(color.warm, 32, 8.5, 1.65);
roomLight.position.set(-2.2, 3.2, 0);
scene.add(roomLight);

const grottoLight = new THREE.PointLight(color.mint, 42, 9.5, 1.55);
grottoLight.position.set(10.5, 3.4, 0);
scene.add(grottoLight);

const prototypeUi = document.createElement('div');
prototypeUi.className = 'prototype-ui';
prototypeUi.innerHTML = `
  <section class="prototype-title" aria-labelledby="prototype-heading">
    <span class="prototype-kicker">Render-Spike 01 · isoliert</span>
    <h1 id="prototype-heading">Räumliche Dungeonprobe</h1>
    <p>Echte Wandkörper, Tiefenverdeckung und gemeinsames Licht auf demselben logischen Raster.</p>
    <div class="prototype-proof">
      <span><i class="proof-depth"></i>Echte Tiefe</span>
      <span><i class="proof-light"></i>Lokales Licht</span>
      <span><i class="proof-cave"></i>Naturkontur</span>
    </div>
  </section>
  <section class="prototype-diagnostics" aria-label="Prüfkriterien">
    <strong>Was diese Szene beweisen soll</strong>
    <ol>
      <li><span>01</span> Figuren verschwinden korrekt hinter der Südwand.</li>
      <li><span>02</span> Gang und T-Abzweig bestehen aus Volumen, nicht Sprites.</li>
      <li><span>03</span> Bernstein und Mint beleuchten ganze Bereiche konsistent.</li>
      <li><span>04</span> Die Grotte besitzt eine eigene organische Geometrie.</li>
    </ol>
  </section>
  <nav class="prototype-controls" aria-label="Prototyp steuern">
    <div class="control-group view-controls">
      <span>Ansicht</span>
      <button type="button" data-preset="overview" aria-pressed="true">Gesamt</button>
      <button type="button" data-preset="occlusion" aria-pressed="false">Verdeckung</button>
      <button type="button" data-preset="grotto" aria-pressed="false">Grotte</button>
    </div>
    <div class="control-divider"></div>
    <div class="control-group zoom-controls">
      <span>Zoom</span>
      <button type="button" data-zoom="0.72">72%</button>
      <button type="button" data-zoom="0.88" aria-pressed="true">88%</button>
      <button type="button" data-zoom="1.06">106%</button>
    </div>
    <div class="control-divider"></div>
    <button type="button" class="toggle-button" data-action="motion" aria-pressed="${motionEnabled}">
      <span>Figurenlauf</span><b>${motionEnabled ? 'AN' : 'AUS'}</b>
    </button>
    <button type="button" class="toggle-button" data-action="wall" aria-pressed="true">
      <span>Südwand</span><b>AN</b>
    </button>
  </nav>
  <div class="prototype-hint">Ziehen: Kamera · Mausrad: Zoom · Südwand ausblenden, um die verdeckte Figur zu kontrollieren</div>
  <a class="prototype-back" href="./?theme=style-b">Zum spielbaren Stand</a>
  <output class="prototype-performance" aria-label="Renderaufrufe">– Draws</output>
`;
root.append(prototypeUi);
document.querySelector('.prototype-loading')?.remove();

function updateCamera(): void {
  const aspect = Math.max(0.2, window.innerWidth / Math.max(1, window.innerHeight));
  camera.left = (-viewHeight * aspect) / 2;
  camera.right = (viewHeight * aspect) / 2;
  camera.top = viewHeight / 2;
  camera.bottom = -viewHeight / 2;
  camera.position.copy(cameraTarget).add(cameraOffset);
  camera.lookAt(cameraTarget);
  camera.updateProjectionMatrix();
}

function setZoom(multiplier: number): void {
  viewHeight = 9.85 / multiplier;
  updateCamera();
  document.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((button) => {
    button.setAttribute('aria-pressed', String(Number(button.dataset.zoom) === multiplier));
  });
}

const presets: Record<PresetName, { x: number; z: number; zoom: number }> = {
  overview: { x: 3.25, z: 0, zoom: 0.88 },
  occlusion: { x: -2.25, z: 1.1, zoom: 1.06 },
  grotto: { x: 10.35, z: 0, zoom: 1.06 },
};

function setPreset(preset: PresetName): void {
  activePreset = preset;
  const target = presets[preset];
  cameraTarget.set(target.x, 0, target.z);
  setZoom(target.zoom);
  document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
    button.setAttribute('aria-pressed', String(button.dataset.preset === preset));
  });
}

function setMotion(enabled: boolean): void {
  motionEnabled = enabled;
  const button = document.querySelector<HTMLButtonElement>('[data-action="motion"]');
  button?.setAttribute('aria-pressed', String(enabled));
  const label = button?.querySelector('b');
  if (label) label.textContent = enabled ? 'AN' : 'AUS';
}

document.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) => {
  button.addEventListener('click', () => setPreset(button.dataset.preset as PresetName));
});
document.querySelectorAll<HTMLButtonElement>('[data-zoom]').forEach((button) => {
  button.addEventListener('click', () => setZoom(Number(button.dataset.zoom)));
});
document.querySelector<HTMLButtonElement>('[data-action="motion"]')?.addEventListener('click', () => {
  setMotion(!motionEnabled);
});
document.querySelector<HTMLButtonElement>('[data-action="wall"]')?.addEventListener('click', (event) => {
  foregroundWalls.visible = !foregroundWalls.visible;
  const button = event.currentTarget as HTMLButtonElement;
  button.setAttribute('aria-pressed', String(foregroundWalls.visible));
  const label = button.querySelector('b');
  if (label) label.textContent = foregroundWalls.visible ? 'AN' : 'AUS';
});

let dragging = false;
let lastPointerX = 0;
let lastPointerY = 0;

renderer.domElement.addEventListener('pointerdown', (event) => {
  dragging = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  renderer.domElement.setPointerCapture(event.pointerId);
  renderer.domElement.classList.add('dragging');
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const scale = viewHeight / Math.max(320, window.innerHeight);
  cameraTarget.x -= (event.clientX - lastPointerX) * scale;
  cameraTarget.z -= (event.clientY - lastPointerY) * scale * 1.28;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  updateCamera();
});
renderer.domElement.addEventListener('pointerup', (event) => {
  dragging = false;
  renderer.domElement.releasePointerCapture(event.pointerId);
  renderer.domElement.classList.remove('dragging');
});
renderer.domElement.addEventListener('wheel', (event) => {
  event.preventDefault();
  viewHeight = THREE.MathUtils.clamp(viewHeight * Math.exp(event.deltaY * 0.001), 6.6, 16.5);
  updateCamera();
}, { passive: false });

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  updateCamera();
});

const requestedPreset = new URLSearchParams(window.location.search).get('preset');
setPreset(requestedPreset === 'occlusion' || requestedPreset === 'grotto' ? requestedPreset : 'overview');

window.spatialPrototype = {
  getState: () => ({
    preset: activePreset,
    zoom: 9.85 / viewHeight,
    motion: motionEnabled,
    foregroundWall: foregroundWalls.visible,
  }),
  setPreset,
  setMotion,
};

document.documentElement.dataset.prototypeReady = '1';
root.dataset.ready = 'true';

const timer = new THREE.Timer();
timer.connect(document);
let elapsed = 0;
let diagnosticsWindow = 0;
const fpsOutput = document.querySelector<HTMLOutputElement>('.prototype-performance');

function animate(timestamp: number): void {
  timer.update(timestamp);
  const delta = Math.min(timer.getDelta(), 0.05);
  elapsed += delta;
  diagnosticsWindow += delta;

  if (motionEnabled) {
    const roomProgress = (Math.sin(elapsed * 0.72) + 1) / 2;
    moveSprite(foregroundWorker, THREE.MathUtils.lerp(-4.25, -0.85, roomProgress), 2.02);
    const corridorProgress = (Math.sin(elapsed * 0.58 + 1.4) + 1) / 2;
    moveSprite(corridorWorker, THREE.MathUtils.lerp(1.25, 6.25, corridorProgress), 0);
  }

  renderer.render(scene, camera);
  if (diagnosticsWindow >= 0.75) {
    if (fpsOutput) fpsOutput.textContent = `${renderer.info.render.calls} Draws`;
    diagnosticsWindow = 0;
  }
  requestAnimationFrame(animate);
}

updateCamera();
requestAnimationFrame(animate);
