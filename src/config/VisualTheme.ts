export type VisualThemeId = 'legacy' | 'style-b';

export type WallKitId = 'production-v7' | 'golden-v1';

export interface WallKitGeometry {
  frameWidth: number;
  frameHeight: number;
  originX: number;
  originY: number;
  thresholdDepth: number;
  edgeDepth: number;
  jointDepth: number;
  occlusionDepth?: number;
}

interface ThemeWallKit {
  id: WallKitId;
  geometry: WallKitGeometry;
  atlas?: string;
  neutralAtlas?: string;
  naturalAtlas?: string;
  corridorAtlas?: string;
  builtThresholdAtlas?: string;
  naturalThresholdAtlas?: string;
  /** Optional second copy of the topology atlas for authored front faces. */
  occlusionAtlas?: string;
  neutralOcclusionAtlas?: string;
  naturalOcclusionAtlas?: string;
  corridorOcclusionAtlas?: string;
  north: string;
  east: string;
  south: string;
  west: string;
  northEast: string;
  eastSouth: string;
  southWest: string;
  westNorth: string;
}

interface ThemeAssetPaths {
  terrain: string;
  dampFloor?: string;
  heart: string;
  worker: string;
  workerAnimation?: string;
  guard: string;
  archer: string;
  heartBuilding?: {
    base: string;
    backplate: string;
    core: string;
    pulpit: string;
    bezel?: string;
  };
  wallKit?: ThemeWallKit;
  groundDecals?: {
    rubble: string;
    excavation: string;
    covenantInlay: string;
    moss: string;
    spores: string;
    puddle: string;
  };
  startDecor?: {
    lamp: string;
    banner: string;
    rack: string;
    cart: string;
    supplies: string;
    noticeBoard: string;
    fungusSmall: string;
    fungusMedium: string;
    grottoStation: string;
  };
  resources: {
    iron: string;
    ironDepleted: string;
    fungus: string;
    essence: string;
  };
  props: {
    storage: string;
    cauldron: string;
    workbench: string;
  };
}

export interface VisualTheme {
  id: VisualThemeId;
  label: string;
  assets: ThemeAssetPaths;
  display: {
    heart: number;
    worker: number;
    guard: number;
    archer: number;
  };
  palette: {
    void: number;
    heartAmbient: number;
    heartGlow: number;
    torch: number;
    torchCore: number;
  };
  preDiscoveryResourceAlpha: number;
}

const LEGACY_THEME: VisualTheme = {
  id: 'legacy',
  label: 'Original',
  assets: {
    terrain: 'assets/generated/terrain-v3',
    heart: 'assets/generated/covenant-heart-gameplay-256.png',
    worker: 'assets/generated/units-v1/worker.png',
    guard: 'assets/generated/units-v1/guard.png',
    archer: 'assets/generated/units-v1/archer.png',
    resources: {
      iron: 'assets/generated/resources-v2/iron-vein.png',
      ironDepleted: 'assets/generated/resources-v2/iron-vein-depleted.png',
      fungus: 'assets/generated/resources-v2/fungus-cluster.png',
      essence: 'assets/generated/resources-v2/essence-seal.png',
    },
    props: {
      storage: 'assets/generated/room-props-v3/storage.png',
      cauldron: 'assets/generated/room-props-v3/cauldron.png',
      workbench: 'assets/generated/room-props-v3/workbench.png',
    },
  },
  display: { heart: 140, worker: 29, guard: 34, archer: 31 },
  palette: {
    void: 0x090a0e,
    heartAmbient: 0x7d3343,
    heartGlow: 0xa5414e,
    torch: 0xd59b48,
    torchCore: 0xe3b35d,
  },
  preDiscoveryResourceAlpha: 0.38,
};

const STYLE_B_THEME: VisualTheme = {
  id: 'style-b',
  label: 'Dungeon Administration',
  assets: {
    terrain: 'assets/generated/style-b-v3/terrain',
    dampFloor: 'assets/generated/style-b-v3/terrain/damp-floor.png',
    heart: 'assets/generated/style-b-v2/heart/core.png',
    worker: 'assets/generated/style-b-v2/characters/worker.png',
    workerAnimation: 'assets/generated/style-b-worker-v1/worker-animation.png',
    guard: 'assets/generated/style-b-v2/characters/guard.png',
    archer: 'assets/generated/style-b-v2/characters/archer.png',
    heartBuilding: {
      base: 'assets/generated/style-b-v2/heart/base.png',
      backplate: 'assets/generated/style-b-v3/heart/backplate.png',
      core: 'assets/generated/style-b-v2/heart/core.png',
      pulpit: 'assets/generated/style-b-v2/heart/pulpit.png',
      bezel: 'assets/generated/style-b-v3/heart/bezel.png',
    },
    wallKit: {
      id: 'production-v7',
      geometry: {
        frameWidth: 96,
        frameHeight: 96,
        originX: 0.5,
        originY: 0.5,
        thresholdDepth: 1.9,
        edgeDepth: 2,
        jointDepth: 2.1,
      },
      atlas: 'assets/generated/style-b-v3/walls/wall-atlas-built-v7.png',
      neutralAtlas: 'assets/generated/style-b-v3/walls/wall-atlas-fortified-v7.png',
      naturalAtlas: 'assets/generated/style-b-v3/walls/wall-atlas-natural-v7.png',
      corridorAtlas: 'assets/generated/style-b-v3/walls/wall-atlas-corridor-v7.png',
      builtThresholdAtlas: 'assets/generated/style-b-v3/walls/threshold-built-v7.png',
      naturalThresholdAtlas: 'assets/generated/style-b-v3/walls/threshold-natural-v7.png',
      north: 'assets/generated/style-b-v3/walls/north.png',
      east: 'assets/generated/style-b-v3/walls/east.png',
      south: 'assets/generated/style-b-v3/walls/south.png',
      west: 'assets/generated/style-b-v3/walls/west.png',
      northEast: 'assets/generated/style-b-v3/walls/north-east.png',
      eastSouth: 'assets/generated/style-b-v3/walls/east-south.png',
      southWest: 'assets/generated/style-b-v3/walls/south-west.png',
      westNorth: 'assets/generated/style-b-v3/walls/west-north.png',
    },
    groundDecals: {
      rubble: 'assets/generated/style-b-v3/decals/rubble.png',
      excavation: 'assets/generated/style-b-v3/decals/excavation.png',
      covenantInlay: 'assets/generated/style-b-v3/decals/covenant-inlay.png',
      moss: 'assets/generated/style-b-v3/decals/moss.png',
      spores: 'assets/generated/style-b-v3/decals/spores.png',
      puddle: 'assets/generated/style-b-v3/decals/puddle.png',
    },
    startDecor: {
      lamp: 'assets/generated/style-b-v2/decor/lamp.png',
      banner: 'assets/generated/style-b-v2/decor/banner.png',
      rack: 'assets/generated/style-b-v2/decor/rack.png',
      cart: 'assets/generated/style-b-v2/decor/cart.png',
      supplies: 'assets/generated/style-b-v2/decor/supplies.png',
      noticeBoard: 'assets/generated/style-b-v2/decor/notice-board.png',
      fungusSmall: 'assets/generated/style-b-v2/decor/fungus-small.png',
      fungusMedium: 'assets/generated/style-b-v2/decor/fungus-medium.png',
      grottoStation: 'assets/generated/style-b-v2/decor/grotto-station.png',
    },
    resources: {
      iron: 'assets/generated/style-b-v1/resources/iron-vein.png',
      ironDepleted: 'assets/generated/style-b-v1/resources/iron-vein-depleted.png',
      fungus: 'assets/generated/style-b-v1/resources/fungus-cluster.png',
      essence: 'assets/generated/style-b-v1/resources/essence-seal.png',
    },
    props: {
      storage: 'assets/generated/style-b-v1/props/storage.png',
      cauldron: 'assets/generated/style-b-v1/props/cauldron.png',
      workbench: 'assets/generated/style-b-v1/props/workbench.png',
    },
  },
  display: { heart: 76, worker: 58, guard: 46, archer: 45 },
  palette: {
    void: 0x071427,
    heartAmbient: 0xe75a52,
    heartGlow: 0xff765f,
    torch: 0xd8a532,
    torchCore: 0xffdc7a,
  },
  preDiscoveryResourceAlpha: 0.74,
};

const GOLDEN_V1_ROOT = 'assets/generated/style-b-wall-prototypes/golden-v1';

/**
 * Opt-in asset contract for evaluating a new wall family without replacing V7.
 * Every atlas keeps the established frames 0-13 and 96 px boundary pivot. The
 * optional occlusion atlases mirror those frames and may contain only the
 * authored pixels that must sit in front of props and actors.
 */
const GOLDEN_V1_WALL_KIT: ThemeWallKit = {
  ...STYLE_B_THEME.assets.wallKit!,
  id: 'golden-v1',
  geometry: {
    frameWidth: 96,
    frameHeight: 96,
    originX: 0.5,
    originY: 0.5,
    thresholdDepth: 1.9,
    edgeDepth: 2,
    jointDepth: 2.1,
    occlusionDepth: 34,
  },
  atlas: `${GOLDEN_V1_ROOT}/wall-atlas-built.png`,
  neutralAtlas: `${GOLDEN_V1_ROOT}/wall-atlas-fortified.png`,
  naturalAtlas: `${GOLDEN_V1_ROOT}/wall-atlas-natural.png`,
  corridorAtlas: `${GOLDEN_V1_ROOT}/wall-atlas-corridor.png`,
  builtThresholdAtlas: `${GOLDEN_V1_ROOT}/threshold-built.png`,
  naturalThresholdAtlas: `${GOLDEN_V1_ROOT}/threshold-natural.png`,
  // The renderer supports a second, high-depth topology layer, but Golden-v1
  // keeps it inactive until a front-facing mask is hand-authored and visually
  // accepted. Directional outward wall envelopes currently avoid actor overlap
  // without allocating an empty occlusion sprite for every edge and joint.
};

export function resolveVisualTheme(search: string): VisualTheme {
  const params = new URLSearchParams(search);
  const requested = params.get('theme')?.toLowerCase();
  if (requested !== 'comedy' && requested !== 'style-b') return LEGACY_THEME;
  if (params.get('wall-prototype')?.toLowerCase() !== 'golden-v1') return STYLE_B_THEME;
  return {
    ...STYLE_B_THEME,
    assets: {
      ...STYLE_B_THEME.assets,
      wallKit: GOLDEN_V1_WALL_KIT,
    },
  };
}

export const ACTIVE_VISUAL_THEME = resolveVisualTheme(
  typeof window === 'undefined' ? '' : window.location.search,
);
