export interface SpritePresentation {
  width: number;
  height: number;
  anchorY: number;
  contentHeight: number;
  frameHeight: number;
  shadowWidth: number;
  shadowDepth: number;
}

export const VISUAL_TRUTH_SPRITES = {
  worker: {
    width: 1.55,
    height: 1.55,
    anchorY: 18 / 96,
    contentHeight: 58,
    frameHeight: 96,
    shadowWidth: 0.64,
    shadowDepth: 0.3,
  },
  guard: {
    width: 1.1,
    height: 1.1,
    anchorY: 2 / 96,
    contentHeight: 86,
    frameHeight: 96,
    shadowWidth: 0.7,
    shadowDepth: 0.34,
  },
  archer: {
    width: 1.08,
    height: 1.08,
    anchorY: 2 / 96,
    contentHeight: 84,
    frameHeight: 96,
    shadowWidth: 0.66,
    shadowDepth: 0.31,
  },
  hexbinder: {
    width: 1.06,
    height: 1.06,
    anchorY: 2 / 64,
    contentHeight: 59,
    frameHeight: 64,
    shadowWidth: 0.65,
    shadowDepth: 0.31,
  },
  inquisitor: {
    width: 1.12,
    height: 1.12,
    anchorY: 2 / 64,
    contentHeight: 60,
    frameHeight: 64,
    shadowWidth: 0.7,
    shadowDepth: 0.34,
  },
  enemy: {
    width: 1.04,
    height: 1.04,
    anchorY: 2 / 64,
    contentHeight: 58,
    frameHeight: 64,
    shadowWidth: 0.64,
    shadowDepth: 0.3,
  },
  enemyLarge: {
    width: 1.18,
    height: 1.18,
    anchorY: 2 / 64,
    contentHeight: 60,
    frameHeight: 64,
    shadowWidth: 0.74,
    shadowDepth: 0.35,
  },
  roomProp: {
    width: 0.98,
    height: 0.98,
    anchorY: 0.04,
    contentHeight: 60,
    frameHeight: 64,
    shadowWidth: 0.68,
    shadowDepth: 0.31,
  },
  resource: {
    width: 0.52,
    height: 0.52,
    anchorY: 0.04,
    contentHeight: 54,
    frameHeight: 64,
    shadowWidth: 0.34,
    shadowDepth: 0.16,
  },
  lamp: {
    width: 0.58,
    height: 0.72,
    anchorY: 4 / 96,
    contentHeight: 88,
    frameHeight: 96,
    shadowWidth: 0.32,
    shadowDepth: 0.16,
  },
  banner: {
    width: 0.66,
    height: 0.78,
    anchorY: 3 / 96,
    contentHeight: 90,
    frameHeight: 96,
    shadowWidth: 0.38,
    shadowDepth: 0.17,
  },
  cart: {
    width: 0.78,
    height: 0.66,
    anchorY: 3 / 96,
    contentHeight: 73,
    frameHeight: 96,
    shadowWidth: 0.62,
    shadowDepth: 0.28,
  },
  rack: {
    width: 0.76,
    height: 0.72,
    anchorY: 3 / 96,
    contentHeight: 74,
    frameHeight: 96,
    shadowWidth: 0.58,
    shadowDepth: 0.25,
  },
  supplies: {
    width: 0.78,
    height: 0.72,
    anchorY: 3 / 96,
    contentHeight: 85,
    frameHeight: 96,
    shadowWidth: 0.58,
    shadowDepth: 0.26,
  },
  fungusMedium: {
    width: 0.62,
    height: 0.56,
    anchorY: 4 / 96,
    contentHeight: 80,
    frameHeight: 96,
    shadowWidth: 0.42,
    shadowDepth: 0.2,
  },
  fungusSmall: {
    width: 0.42,
    height: 0.42,
    anchorY: 3 / 96,
    contentHeight: 47,
    frameHeight: 96,
    shadowWidth: 0.3,
    shadowDepth: 0.14,
  },
  grottoStation: {
    width: 0.92,
    height: 0.86,
    anchorY: 3 / 96,
    contentHeight: 90,
    frameHeight: 96,
    shadowWidth: 0.7,
    shadowDepth: 0.32,
  },
} as const satisfies Record<string, SpritePresentation>;

export type VisualTruthSpriteKey = keyof typeof VISUAL_TRUTH_SPRITES;

export function visibleSpriteHeight(key: VisualTruthSpriteKey): number {
  const presentation = VISUAL_TRUTH_SPRITES[key];
  return presentation.height * presentation.contentHeight / presentation.frameHeight;
}
