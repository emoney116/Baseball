export function voiceTranscriptionModel(configured?: string): "gpt-4o-transcribe" {
  const model = configured?.trim() || "gpt-4o-transcribe";
  if (model !== "gpt-4o-transcribe") throw new Error("Unvalidated Voice model configuration.");
  return model;
}
