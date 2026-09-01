export type BaseballKnowledgeTrust = "verified" | "reviewed" | "draft" | "candidate" | "expired" | "stale";

export interface BaseballKnowledgeQuery {
  query: string;
  category?: string;
  level?: string;
  governingBody?: string;
  version?: string;
  limit: number;
}

export interface BaseballKnowledgeItem {
  id: string;
  documentId?: string;
  chunkId?: string;
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  level?: string;
  governingBody?: string;
  version?: string;
  source?: string;
  sourceReference?: string;
  verifiedAt?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
  status: BaseballKnowledgeTrust;
}

export interface BaseballKnowledgeProvider {
  searchKnowledge(query: BaseballKnowledgeQuery): BaseballKnowledgeItem[];
  getKnowledgeItem(id: string): BaseballKnowledgeItem | undefined;
}

export type BaseballKnowledgeMatchStatus = "not_needed" | "trusted_match" | "knowledge_miss";

export const TRUSTED_BASEBALL_KNOWLEDGE_STATUSES: ReadonlySet<BaseballKnowledgeTrust> = new Set(["verified", "reviewed"]);
const MAX_KNOWLEDGE_CONTENT_CHARACTERS = 2400;
const SEARCH_STOP_WORDS = new Set([
  "about", "and", "are", "can", "does", "for", "from", "how", "is", "my", "the", "this", "what", "when", "with",
]);
const SHORT_BASEBALL_TOKENS = new Set(["ab", "avg", "bb", "babip", "csw", "era", "ev", "k", "obp", "ops", "slg", "whip"]);

export class InMemoryBaseballKnowledgeProvider implements BaseballKnowledgeProvider {
  private readonly items: BaseballKnowledgeItem[];

  constructor(items: BaseballKnowledgeItem[] = []) {
    this.items = items.map((item) => ({ ...item, content: item.content.trim() }));
  }

  searchKnowledge(query: BaseballKnowledgeQuery): BaseballKnowledgeItem[] {
    const queryTokens = tokenize(query.query);
    const candidates = this.items
      .filter((item) => isTrustedKnowledgeItem(item))
      .filter((item) => matchesMetadata(item, query))
      .map((item) => ({ item, score: scoreKnowledgeItem(item, queryTokens, query) }))
      .filter((match) => match.score > 0)
      .sort((left, right) => right.score - left.score || left.item.title.localeCompare(right.item.title));

    return candidates.slice(0, Math.max(0, Math.min(query.limit, 20))).map(({ item }) => ({ ...item }));
  }

  getKnowledgeItem(id: string): BaseballKnowledgeItem | undefined {
    return this.items.find((item) => item.id === id || item.chunkId === id || item.documentId === id);
  }
}

export class EmptyBaseballKnowledgeProvider implements BaseballKnowledgeProvider {
  searchKnowledge(query: BaseballKnowledgeQuery): BaseballKnowledgeItem[] {
    void query;
    return [];
  }

  getKnowledgeItem(id: string): BaseballKnowledgeItem | undefined {
    void id;
    return undefined;
  }
}

export const EMPTY_BASEBALL_KNOWLEDGE_PROVIDER = new EmptyBaseballKnowledgeProvider();

export function findTrustedKnowledge(
  provider: BaseballKnowledgeProvider,
  query: BaseballKnowledgeQuery,
): BaseballKnowledgeItem[] {
  return provider.searchKnowledge(query)
    .filter(isTrustedKnowledgeItem)
    .map((item) => ({ ...item, content: item.content.trim().slice(0, MAX_KNOWLEDGE_CONTENT_CHARACTERS) }))
    .slice(0, Math.max(0, query.limit));
}

export function baseballKnowledgeVocabulary(items: BaseballKnowledgeItem[]): Set<string> {
  const values = items.flatMap((item) => [
    item.title,
    item.category,
    item.subcategory,
    ...metadataTerms(item.metadata?.aliases),
    ...metadataTerms(item.metadata?.keywords),
  ]);
  return new Set(values.flatMap((value) => tokenize(value)));
}

function isTrustedKnowledgeItem(item: BaseballKnowledgeItem): boolean {
  return TRUSTED_BASEBALL_KNOWLEDGE_STATUSES.has(item.status)
    && (!item.expiresAt || Number.isNaN(Date.parse(item.expiresAt)) || Date.parse(item.expiresAt) > Date.now());
}

function matchesMetadata(item: BaseballKnowledgeItem, query: BaseballKnowledgeQuery): boolean {
  return (!query.category || normalize(item.category) === normalize(query.category))
    && (!query.level || normalize(item.level) === normalize(query.level))
    && (!query.governingBody || normalize(item.governingBody) === normalize(query.governingBody))
    && (!query.version || normalize(item.version) === normalize(query.version));
}

function scoreKnowledgeItem(item: BaseballKnowledgeItem, queryTokens: string[], query: BaseballKnowledgeQuery): number {
  const titleTokens = new Set(tokenize(item.title));
  const bodyTokens = new Set(tokenize(item.content));
  const metadataTokens = new Set(tokenize([item.category, item.subcategory, item.level, item.governingBody, item.version].filter(Boolean).join(" ")));
  const score = queryTokens.reduce((total, token) => total + (titleTokens.has(token) ? 6 : 0) + (bodyTokens.has(token) ? 1 : 0) + (metadataTokens.has(token) ? 2 : 0), 0);
  const genericScopeBonus = !query.governingBody && !query.level && !query.version && !item.governingBody && !item.level && !item.version ? 2 : 0;
  return score + genericScopeBonus;
}

function tokenize(value: string | undefined): string[] {
  return [...new Set((value ?? "")
    .toLowerCase()
    .split(/[^a-z0-9%]+/)
    .filter((token) => !SEARCH_STOP_WORDS.has(token) && (token.length >= 3 || SHORT_BASEBALL_TOKENS.has(token))))];
}

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function metadataTerms(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  return [];
}
