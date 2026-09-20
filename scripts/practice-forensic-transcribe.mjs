import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { parseEnv } from 'node:util';

// Private evidence is always external to the checkout; never overwrite the source.
const [source, output, ffmpeg, envFile] = process.argv.slice(2);
if (!source || !output || !ffmpeg || !envFile) throw new Error('Expected source, external output directory, ffmpeg, env file');
if (resolve(output).startsWith(resolve(process.cwd()))) throw new Error('Evidence output must be outside the checkout');
const env = parseEnv(readFileSync(envFile, 'utf8'));
const key = env.OPENAI_VOICE_API_KEY || env.OPENAI_API_KEY;
if (!key) throw new Error('Approved provider credential unavailable');
mkdirSync(output, { recursive: true });
const bytes = readFileSync(source);
const probe = spawnSync(ffmpeg, ['-i', source], { encoding: 'utf8' }).stderr;
const durationMatch = probe.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
if (!durationMatch) throw new Error('Cannot determine source duration');
const duration = Number(durationMatch[1]) * 3600 + Number(durationMatch[2]) * 60 + Number(durationMatch[3]);
const manifest = { source, sha256: createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length, durationSeconds: duration, model: 'gpt-4o-transcribe', timestampPrecision: '30-second contiguous source chunks; not word timestamps', holdoutChunkIndices: [7, 19, 31, 43, 55, 67], metadata: probe };
writeFileSync(join(output, 'source-manifest.json'), JSON.stringify(manifest, null, 2));
for (let start = 0, index = 0; start < duration; start += 30, index++) {
  const path = join(output, `raw-${String(index).padStart(3, '0')}.json`);
  if (existsSync(path)) continue;
  const wav = join(output, 'current-chunk.wav');
  const length = Math.min(30, duration - start);
  const decoded = spawnSync(ffmpeg, ['-y', '-ss', String(start), '-i', source, '-t', String(length), '-ar', '16000', '-ac', '1', wav], { encoding: 'utf8' });
  if (decoded.status !== 0) throw new Error('Chunk decode failed');
  const form = new FormData();
  form.append('file', new Blob([readFileSync(wav)], { type: 'audio/wav' }), 'segment.wav');
  form.append('model', manifest.model);
  form.append('response_format', 'json');
  form.append('include[]', 'logprobs');
  form.append('prompt', 'Baseball practice vocabulary: hitting, pitching, at-bat, ball, ball outside, ball away, fastball, four-seam, slider, changeup, curveball, cutter, swing and miss, whiff, called strike, foul, exit velo, left center, right field.');
  const began = Date.now();
  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!response.ok) throw new Error(`Provider returned ${response.status}; stopped without logging credentials or provider body`);
  const rawProviderResponse = await response.json();
  writeFileSync(path, JSON.stringify({ index, startSeconds: start, endSeconds: start + length, latencyMs: Date.now() - began, rawProviderResponse }, null, 2));
  console.log(`Preserved chunk ${index}: ${start}-${start + length}s`);
}
