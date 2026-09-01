export interface AIModelPricing {
  inputPerMillion: number;
  cachedInputPerMillion: number;
  cacheWritePerMillion: number;
  outputPerMillion: number;
}

export interface AIRequestCostInput {
  model: string;
  inputTokens?: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
  outputTokens?: number;
  webSearchCount?: number;
}

export interface AIRequestCost {
  model: string;
  pricedModel: string;
  pricingVersion: string;
  pricingFound: boolean;
  inputCost: number;
  cachedInputCost: number;
  cacheWriteCost: number;
  outputCost: number;
  modelTokenCost: number;
  webSearchCost: number;
  estimatedTotalCost: number;
}

// OpenAI API pricing verified 2026-09-01.
// https://developers.openai.com/api/docs/pricing
// https://developers.openai.com/api/docs/models/gpt-5-mini
export const AI_PRICING_VERSION = "openai-2026-09-01";
export const AI_WEB_SEARCH_COST_PER_CALL_USD = 0.01;

export const AI_MODEL_PRICING: Readonly<Record<string, AIModelPricing>> = Object.freeze({
  "gpt-5-mini": {
    inputPerMillion: 0.25,
    cachedInputPerMillion: 0.025,
    cacheWritePerMillion: 0.25,
    outputPerMillion: 2,
  },
  "gpt-5.6-luna": {
    inputPerMillion: 0.2,
    cachedInputPerMillion: 0.02,
    cacheWritePerMillion: 0.25,
    outputPerMillion: 1.2,
  },
  "gpt-5.6-terra": {
    inputPerMillion: 2,
    cachedInputPerMillion: 0.2,
    cacheWritePerMillion: 2.5,
    outputPerMillion: 12,
  },
  "gpt-5.6-sol": {
    inputPerMillion: 4,
    cachedInputPerMillion: 0.4,
    cacheWritePerMillion: 5,
    outputPerMillion: 20,
  },
});

const CONSERVATIVE_UNKNOWN_MODEL_PRICING: AIModelPricing = {
  inputPerMillion: 4,
  cachedInputPerMillion: 0.4,
  cacheWritePerMillion: 5,
  outputPerMillion: 20,
};

export function calculateAIRequestCost(input: AIRequestCostInput): AIRequestCost {
  const resolved = resolveAIModelPricing(input.model);
  const inputTokens = nonNegativeInteger(input.inputTokens);
  const cachedInputTokens = Math.min(inputTokens, nonNegativeInteger(input.cachedInputTokens));
  const cacheWriteTokens = Math.min(inputTokens - cachedInputTokens, nonNegativeInteger(input.cacheWriteTokens));
  const uncachedInputTokens = inputTokens - cachedInputTokens - cacheWriteTokens;
  const outputTokens = nonNegativeInteger(input.outputTokens);
  const webSearchCount = nonNegativeInteger(input.webSearchCount);

  const inputCost = perMillionCost(uncachedInputTokens, resolved.pricing.inputPerMillion);
  const cachedInputCost = perMillionCost(cachedInputTokens, resolved.pricing.cachedInputPerMillion);
  const cacheWriteCost = perMillionCost(cacheWriteTokens, resolved.pricing.cacheWritePerMillion);
  const outputCost = perMillionCost(outputTokens, resolved.pricing.outputPerMillion);
  const modelTokenCost = inputCost + cachedInputCost + cacheWriteCost + outputCost;
  const webSearchCost = webSearchCount * AI_WEB_SEARCH_COST_PER_CALL_USD;

  return {
    model: input.model,
    pricedModel: resolved.model,
    pricingVersion: AI_PRICING_VERSION,
    pricingFound: resolved.found,
    inputCost: roundUsd(inputCost),
    cachedInputCost: roundUsd(cachedInputCost),
    cacheWriteCost: roundUsd(cacheWriteCost),
    outputCost: roundUsd(outputCost),
    modelTokenCost: roundUsd(modelTokenCost),
    webSearchCost: roundUsd(webSearchCost),
    estimatedTotalCost: roundUsd(modelTokenCost + webSearchCost),
  };
}

export function resolveAIModelPricing(model: string): { model: string; pricing: AIModelPricing; found: boolean } {
  const normalized = model.trim().toLowerCase();
  const aliases: Array<[string, string]> = [
    ["gpt-5.6-luna", "gpt-5.6-luna"],
    ["gpt-5.6-terra", "gpt-5.6-terra"],
    ["gpt-5.6-sol", "gpt-5.6-sol"],
    ["gpt-5-mini", "gpt-5-mini"],
    ["gpt-5.6", "gpt-5.6-sol"],
  ];
  const match = aliases.find(([alias]) => normalized === alias || normalized.startsWith(`${alias}-`));
  if (match) {
    return { model: match[1], pricing: AI_MODEL_PRICING[match[1]]!, found: true };
  }
  return {
    model: "conservative-unknown-model",
    pricing: CONSERVATIVE_UNKNOWN_MODEL_PRICING,
    found: false,
  };
}

function perMillionCost(tokens: number, rate: number): number {
  return (tokens / 1_000_000) * rate;
}

function nonNegativeInteger(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(value ?? 0));
}

function roundUsd(value: number): number {
  return Math.round(value * 1_000_000_000_000) / 1_000_000_000_000;
}
