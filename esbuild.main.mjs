import * as esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const isWatch = process.argv.includes('--watch');

// Copy assets from renderer/public/assets to dist/assets
const assetsSource = join('renderer', 'public', 'assets');
const assetsDest = join('dist', 'assets');
if (existsSync(assetsSource)) {
  mkdirSync(assetsDest, { recursive: true });
  cpSync(assetsSource, assetsDest, { recursive: true });
  console.log('Assets copied to dist/assets/');
}

const config = {
  entryPoints: ['src/main.ts', 'src/preload.ts'],
  bundle: true,
  platform: 'node',
  target: 'node22',
  outdir: 'dist/main',
  format: 'cjs',
  external: ['electron'],
  sourcemap: true,
};

if (isWatch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('Watching main process...');
} else {
  await esbuild.build(config);
  console.log('Main process built.');
}
