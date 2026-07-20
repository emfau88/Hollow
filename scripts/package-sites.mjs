import { copyFile, mkdir, writeFile } from 'node:fs/promises';

await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await copyFile('.openai/hosting.json', 'dist/.openai/hosting.json');

const worker = `export default {
  async fetch(request, env) {
    if (env?.ASSETS?.fetch) {
      return env.ASSETS.fetch(request);
    }
    return new Response("Hollow Covenant deployment assets are unavailable.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8" }
    });
  }
};
`;

await writeFile('dist/server/index.js', worker, 'utf8');
