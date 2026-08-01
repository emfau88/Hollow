import * as THREE from 'three';

export type ProceduralWallStyle = 'clean' | 'project' | 'natural';

export interface ProceduralWallAsset {
  side: THREE.CanvasTexture;
  cap: THREE.CanvasTexture;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function textureFromCanvas(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.anisotropy = 2;
  return texture;
}

function masonryCanvas(base: string, mortar: string, highlight: string, seed: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const random = seededRandom(seed);
  context.fillStyle = mortar;
  context.fillRect(0, 0, 256, 256);
  const rowHeight = 42;
  for (let row = -1; row < 7; row += 1) {
    const offset = row % 2 === 0 ? -34 : 0;
    for (let column = -1; column < 6; column += 1) {
      const x = offset + column * 68 + 3;
      const y = row * rowHeight + 3;
      const lightness = Math.floor(random() * 24);
      context.fillStyle = base;
      context.fillRect(x, y, 62, rowHeight - 6);
      context.fillStyle = `${highlight}${Math.max(22, 54 - lightness).toString(16).padStart(2, '0')}`;
      context.fillRect(x + 3, y + 3, 56, 3);
      context.fillStyle = 'rgba(0,0,0,0.16)';
      context.fillRect(x + 3, y + rowHeight - 11, 56, 4);
      if (random() > 0.62) {
        context.strokeStyle = 'rgba(8, 13, 20, 0.28)';
        context.lineWidth = 2;
        context.beginPath();
        context.moveTo(x + 16 + random() * 18, y + 8);
        context.lineTo(x + 24 + random() * 18, y + 20);
        context.lineTo(x + 19 + random() * 18, y + 30);
        context.stroke();
      }
    }
  }
  return canvas;
}

function capCanvas(base: string, grout: string, accent: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  context.fillStyle = grout;
  context.fillRect(0, 0, 256, 256);
  for (let y = 3; y < 256; y += 64) {
    for (let x = 3; x < 256; x += 64) {
      context.fillStyle = base;
      context.fillRect(x, y, 58, 58);
      context.strokeStyle = accent;
      context.lineWidth = 3;
      context.strokeRect(x + 3, y + 3, 52, 52);
      context.fillStyle = 'rgba(255,255,255,0.08)';
      context.fillRect(x + 7, y + 7, 44, 4);
    }
  }
  return canvas;
}

function naturalCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d')!;
  const random = seededRandom(9147);
  context.fillStyle = '#183e50';
  context.fillRect(0, 0, 256, 256);
  for (let index = 0; index < 95; index += 1) {
    const x = random() * 256;
    const y = random() * 256;
    const radius = 10 + random() * 22;
    context.fillStyle = random() > 0.55 ? '#2e6672' : '#244f67';
    context.beginPath();
    context.ellipse(x, y, radius, radius * (0.55 + random() * 0.35), random() * Math.PI, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(5,18,28,0.34)';
    context.lineWidth = 3;
    context.stroke();
  }
  return canvas;
}

export function createProceduralWallAssets(): Record<ProceduralWallStyle, ProceduralWallAsset> {
  return {
    clean: {
      side: textureFromCanvas(masonryCanvas('#49394e', '#241e2b', '#f1d3a0', 101)),
      cap: textureFromCanvas(capCanvas('#665d68', '#29232e', '#958796')),
    },
    project: {
      side: textureFromCanvas(masonryCanvas('#273f59', '#101e31', '#d9aa3a', 707)),
      cap: textureFromCanvas(capCanvas('#536b7a', '#192a3a', '#a98538')),
    },
    natural: {
      side: textureFromCanvas(naturalCanvas()),
      cap: textureFromCanvas(capCanvas('#426e69', '#17353f', '#68968a')),
    },
  };
}
