export type VisualThemeId = 'legacy' | 'style-b';

interface ThemeAssetPaths {
  terrain: string;
  heart: string;
  worker: string;
  guard: string;
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
  display: { heart: 140, worker: 29, guard: 34 },
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
    terrain: 'assets/generated/style-b-v1/terrain',
    heart: 'assets/generated/style-b-v1/characters/heart.png',
    worker: 'assets/generated/style-b-v1/characters/worker.png',
    guard: 'assets/generated/style-b-v1/characters/guard.png',
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
  display: { heart: 154, worker: 38, guard: 42 },
  palette: {
    void: 0x071427,
    heartAmbient: 0xe75a52,
    heartGlow: 0xff765f,
    torch: 0xd8a532,
    torchCore: 0xffdc7a,
  },
  preDiscoveryResourceAlpha: 0.74,
};

export function resolveVisualTheme(search: string): VisualTheme {
  const requested = new URLSearchParams(search).get('theme')?.toLowerCase();
  return requested === 'comedy' || requested === 'style-b' ? STYLE_B_THEME : LEGACY_THEME;
}

export const ACTIVE_VISUAL_THEME = resolveVisualTheme(
  typeof window === 'undefined' ? '' : window.location.search,
);
