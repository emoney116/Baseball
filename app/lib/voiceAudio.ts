export const VOICE_MAX_SECONDS = 12;
export const VOICE_SAMPLE_RATE = 16000;
export const VOICE_MAX_BYTES = 44 + VOICE_SAMPLE_RATE * 2 * VOICE_MAX_SECONDS;

export function validateVoiceWav(bytes: Uint8Array): number {
  if (bytes.length < 46 || bytes.length > VOICE_MAX_BYTES)
    throw new Error("Audio must be at most 12 seconds.");
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (offset: number, length: number) =>
    new TextDecoder().decode(bytes.subarray(offset, offset + length));
  if (
    tag(0, 4) !== "RIFF" ||
    tag(8, 4) !== "WAVE" ||
    tag(12, 4) !== "fmt " ||
    tag(36, 4) !== "data" ||
    v.getUint32(16, true) !== 16 ||
    v.getUint16(20, true) !== 1 ||
    v.getUint16(22, true) !== 1 ||
    v.getUint32(24, true) !== VOICE_SAMPLE_RATE ||
    v.getUint32(28, true) !== VOICE_SAMPLE_RATE * 2 ||
    v.getUint16(32, true) !== 2 ||
    v.getUint16(34, true) !== 16 ||
    v.getUint32(40, true) !== bytes.length - 44 ||
    v.getUint32(4, true) !== bytes.length - 8 ||
    (bytes.length - 44) % 2
  )
    throw new Error("Unsupported audio format.");
  return (bytes.length - 44) / (VOICE_SAMPLE_RATE * 2);
}

export function encodeVoiceWav(
  samples: Float32Array,
  sampleRate: number,
): ArrayBuffer {
  const count = Math.min(
    Math.floor((samples.length * VOICE_SAMPLE_RATE) / sampleRate),
    VOICE_SAMPLE_RATE * VOICE_MAX_SECONDS,
  );
  const buffer = new ArrayBuffer(44 + count * 2),
    view = new DataView(buffer);
  const tag = (offset: number, value: string) =>
    [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  tag(0, "RIFF");
  view.setUint32(4, buffer.byteLength - 8, true);
  tag(8, "WAVE");
  tag(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, VOICE_SAMPLE_RATE, true);
  view.setUint32(28, VOICE_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  tag(36, "data");
  view.setUint32(40, count * 2, true);
  for (let i = 0; i < count; i++) {
    const index = (i * sampleRate) / VOICE_SAMPLE_RATE,
      lo = Math.floor(index),
      fraction = index - lo;
    const value = Math.max(
      -1,
      Math.min(
        1,
        (samples[lo] ?? 0) * (1 - fraction) +
          (samples[lo + 1] ?? samples[lo] ?? 0) * fraction,
      ),
    );
    view.setInt16(44 + i * 2, value < 0 ? value * 32768 : value * 32767, true);
  }
  return buffer;
}
