import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { ACTIVE_VISUAL_THEME } from './config/VisualTheme';
import './styles.css';

document.documentElement.dataset.theme = ACTIVE_VISUAL_THEME.id;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: `#${ACTIVE_VISUAL_THEME.palette.void.toString(16).padStart(6, '0')}`,
  pixelArt: false,
  roundPixels: false,
  antialias: true,
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: false,
    mipmapFilter: 'LINEAR_MIPMAP_LINEAR',
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: Math.max(320, window.innerWidth),
    height: Math.max(180, window.innerHeight),
    min: {
      width: 320,
      height: 180,
    },
  },
  fps: {
    target: 60,
  },
  scene: [GameScene],
};

const game = new Phaser.Game(config);

// Diagnostic hook: expose the game only when the debug flag is set.
if (new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
