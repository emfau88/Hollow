import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import './styles.css';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0b0c11',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  render: {
    pixelArt: true,
    antialias: false,
    roundPixels: true,
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  fps: {
    target: 60,
    forceSetTimeOut: true,
  },
  scene: [GameScene],
};

const game = new Phaser.Game(config);

// Diagnostic hook: expose the game only when the debug flag is set.
if (new URLSearchParams(window.location.search).has('debug')) {
  (window as unknown as { game: Phaser.Game }).game = game;
}
