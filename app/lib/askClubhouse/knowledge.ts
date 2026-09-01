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
  title: string;
  content: string;
  category: string;
  subcategory?: string;
  level?: string;
  governingBody?: string;
  version?: string;
  source?: string;
  verifiedAt?: string;
  status: BaseballKnowledgeTrust;
}

export interface BaseballKnowledgeProvider {
  searchKnowledge(query: BaseballKnowledgeQuery): BaseballKnowledgeItem[];
  getKnowledgeItem(id: string): BaseballKnowledgeItem | undefined;
}

export type BaseballKnowledgeMatchStatus = "not_needed" | "trusted_match" | "knowledge_miss";

export const TRUSTED_BASEBALL_KNOWLEDGE_STATUSES: ReadonlySet<BaseballKnowledgeTrust> = new Set(["verified", "reviewed"]);
const MAX_KNOWLEDGE_CONTENT_CHARACTERS = 2400;

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
    .filter((item) => TRUSTED_BASEBALL_KNOWLEDGE_STATUSES.has(item.status))
    .map((item) => ({ ...item, content: item.content.trim().slice(0, MAX_KNOWLEDGE_CONTENT_CHARACTERS) }))
    .slice(0, Math.max(0, query.limit));
}
