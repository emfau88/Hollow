import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        game: `${projectRoot}index.html`,
        spatialPrototype: `${projectRoot}spatial-prototype.html`,
        wallGauntlet: `${projectRoot}wall-gauntlet.html`,
        geometryProof: `${projectRoot}geometry-proof.html`,
        geometrySandbox: `${projectRoot}geometry-sandbox.html`,
      },
    },
  },
  server: {
    port: 5188,
    strictPort: true,
  },
  preview: {
    port: 4188,
    strictPort: true,
  },
});
