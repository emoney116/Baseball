export type VoiceMetrics = {
  interpretation_ms?: number;
  save_latency_ms?: number;
  confidence_band?: "low" | "review" | "high";
  manual_correction?: true;
  auto_saved?: true;
  undo_requested?: true;
};

export function validateVoiceMetrics(value: unknown): value is VoiceMetrics {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, v]) => {
    if (key === "interpretation_ms" || key === "save_latency_ms")
      return (
        Number.isInteger(v) &&
        v >= 0 &&
        v <= (key === "interpretation_ms" ? 30000 : 120000)
      );
    if (key === "confidence_band") return ["low", "review", "high"].includes(v);
    return (
      ["manual_correction", "auto_saved", "undo_requested"].includes(key) &&
      v === true
    );
  });
}

export function reportVoiceMetrics(requestId: string, metrics: VoiceMetrics) {
  void fetch("/api/voice/metrics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requestId, metrics }),
    keepalive: true,
  }).catch(() => undefined);
}
