// Renders stills (posters used by the site) and optional MP4 promo clips from the SAME Remotion compositions.
//   npm run render:clips            -> stills only (public/images/posters/*.webp)
//   npm run render:clips -- --video -> also MP4s into dist/clips (or public/clips)
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const video = process.argv.includes('--video');
const browserExecutable = process.env.REMOTION_BROWSER ?? (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const chromiumOptions = { gl: 'swangle', disableWebSecurity: false };

const serveUrl = await bundle({ entryPoint: resolve(root, 'src/remotion/index.ts'), publicDir: resolve(root, 'public') });

const stills = [
  { id: 'HeroReel', frame: 100, out: 'public/images/posters/hero.webp' },
  { id: 'ReceptionistWave', frame: 10, inputProps: { state: 'idle' }, out: 'public/images/posters/wave.webp' },
];
mkdirSync(resolve(root, 'public/images/posters'), { recursive: true });
for (const s of stills) {
  const composition = await selectComposition({ serveUrl, id: s.id, inputProps: s.inputProps ?? {}, browserExecutable, chromiumOptions });
  await renderStill({ composition, serveUrl, frame: s.frame, output: resolve(root, s.out), imageFormat: 'webp', inputProps: s.inputProps ?? {}, browserExecutable, chromiumOptions });
  console.log('still', s.out);
}

if (video) {
  const outDir = resolve(root, 'public/clips');
  mkdirSync(outDir, { recursive: true });
  for (const id of ['HeroReel', 'HeroReelVertical', 'ServicesShowcase', 'BookingSteps']) {
    const composition = await selectComposition({ serveUrl, id, browserExecutable, chromiumOptions });
    await renderMedia({ composition, serveUrl, codec: 'h264', outputLocation: resolve(outDir, `${id}.mp4`), browserExecutable, chromiumOptions });
    console.log('video', id);
  }
}
