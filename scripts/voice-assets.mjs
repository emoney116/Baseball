import { mkdir, copyFile, readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const vad = path.dirname(require.resolve('@ricky0123/vad-web'));
const ort = path.dirname(require.resolve('onnxruntime-web/wasm'));
const target = new URL('../public/voice-assets/', import.meta.url);
await mkdir(target, { recursive: true });
for (const name of ['vad.worklet.bundle.min.js', 'silero_vad_v5.onnx'])
  await copyFile(path.join(vad, name), new URL(name, target));
for (const name of await readdir(ort))
  if (/^ort-wasm.*\.(wasm|mjs)$/.test(name))
    await copyFile(path.join(ort, name), new URL(name, target));
