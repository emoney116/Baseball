import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMPTY_BASEBALL_KNOWLEDGE_PROVIDER,
  InMemoryBaseballKnowledgeProvider,
  type BaseballKnowledgeItem,
  type BaseballKnowledgeProvider,
  type BaseballKnowledgeTrust,
} from "./knowledge.ts";

const MAX_DOCUMENTS_PER_REQUEST = 200;
const MAX_CHUNKS_PER_REQUEST = 300;
const TRUSTED_STATUSES: BaseballKnowledgeTrust[] = ["reviewed", "verified"];

interface KnowledgeDocumentRow {
  id: string;
  slug: string;
  title: string;
  category: string;
  subcategory: string | null;
  level: string | null;
  governing_body: string | null;
  version: string | null;
  source_name: string | null;
  source_reference: string | null;
  status: BaseballKnowledgeTrust;
  verified_at: string | null;
  expires_at: string | null;
}

interface KnowledgeChunkRow {
  id: string;
  document_id: string;
  content: string;
  metadata: Record<string, unknown> | null;
}

export interface BaseballKnowledgeDocumentInput {
  slug: string;
  title: string;
  category: string;
  subcategory?: string;
  level?: string;
  governingBody?: string;
  version?: string;
  sourceName?: string;
  sourceReference?: string;
  status?: BaseballKnowledgeTrust;
  verifiedAt?: string;
  expiresAt?: string;
  metadata?: Record<string, unknown>;
}

export interface BaseballKnowledgeChunkInput {
  documentId: string;
  ordinal?: number;
  content: string;
  metadata?: Record<string, unknown>;
}

export async function loadBaseballKnowledgeProvider(
  supabase: SupabaseClient,
  query?: string,
): Promise<BaseballKnowledgeProvider> {
  const documentResult = await supabase
    .from("baseball_knowledge_documents")
    .select("id, slug, title, category, subcategory, level, governing_body, version, source_name, source_reference, status, verified_at, expires_at")
    .in("status", TRUSTED_STATUSES)
    .order("title")
    .limit(MAX_DOCUMENTS_PER_REQUEST);

  if (documentResult.error) {
    if (isMissingKnowledgeStorage(documentResult.error)) return EMPTY_BASEBALL_KNOWLEDGE_PROVIDER;
    throw new Error(`Unable to load Baseball Knowledge Bank documents: ${documentResult.error.message}`);
  }

  const documents = ((documentResult.data ?? []) as KnowledgeDocumentRow[]).filter((document) => (
    !document.expires_at || Number.isNaN(Date.parse(document.expires_at)) || Date.parse(document.expires_at) > Date.now()
  ));
  if (!documents.length) return EMPTY_BASEBALL_KNOWLEDGE_PROVIDER;

  let chunksQuery = supabase
    .from("baseball_knowledge_chunks")
    .select("id, document_id, content, metadata")
    .in("document_id", documents.map((document) => document.id))
    .order("document_id")
    .order("ordinal")
    .limit(MAX_CHUNKS_PER_REQUEST);
  if (query?.trim()) {
    chunksQuery = chunksQuery.textSearch("search_vector", query.trim(), { type: "websearch", config: "english" });
  }
  const chunksResult = await chunksQuery;

  if (chunksResult.error) {
    if (isMissingKnowledgeStorage(chunksResult.error)) return EMPTY_BASEBALL_KNOWLEDGE_PROVIDER;
    throw new Error(`Unable to load Baseball Knowledge Bank chunks: ${chunksResult.error.message}`);
  }

  const documentById = new Map(documents.map((document) => [document.id, document]));
  const items = ((chunksResult.data ?? []) as KnowledgeChunkRow[]).flatMap((chunk): BaseballKnowledgeItem[] => {
    const document = documentById.get(chunk.document_id);
    if (!document || !chunk.content.trim()) return [];
    return [{
      id: chunk.id,
      documentId: document.id,
      chunkId: chunk.id,
      title: document.title,
      content: chunk.content,
      category: document.category,
      subcategory: document.subcategory ?? undefined,
      level: document.level ?? undefined,
      governingBody: document.governing_body ?? undefined,
      version: document.version ?? undefined,
      source: document.source_name ?? undefined,
      sourceReference: document.source_reference ?? undefined,
      verifiedAt: document.verified_at ?? undefined,
      expiresAt: document.expires_at ?? undefined,
      metadata: chunk.metadata ?? undefined,
      status: document.status,
    }];
  });

  return items.length ? new InMemoryBaseballKnowledgeProvider(items) : EMPTY_BASEBALL_KNOWLEDGE_PROVIDER;
}

export async function createBaseballKnowledgeDocument(
  supabase: SupabaseClient,
  input: BaseballKnowledgeDocumentInput,
) {
  const { data, error } = await supabase
    .from("baseball_knowledge_documents")
    .insert(toDocumentRow(input))
    .select("*")
    .single();
  if (error) throw new Error(`Unable to create Baseball Knowledge Bank document: ${error.message}`);
  return data as KnowledgeDocumentRow;
}

export async function createBaseballKnowledgeChunk(
  supabase: SupabaseClient,
  input: BaseballKnowledgeChunkInput,
) {
  const { data, error } = await supabase
    .from("baseball_knowledge_chunks")
    .insert({
      document_id: input.documentId,
      ordinal: input.ordinal ?? 1,
      content: input.content,
      metadata: input.metadata ?? {},
    })
    .select("*")
    .single();
  if (error) throw new Error(`Unable to create Baseball Knowledge Bank chunk: ${error.message}`);
  return data as KnowledgeChunkRow;
}

export async function updateBaseballKnowledgeDocument(
  supabase: SupabaseClient,
  documentId: string,
  input: Partial<BaseballKnowledgeDocumentInput>,
) {
  const { data, error } = await supabase
    .from("baseball_knowledge_documents")
    .update(toDocumentRow(input))
    .eq("id", documentId)
    .select("*")
    .single();
  if (error) throw new Error(`Unable to update Baseball Knowledge Bank document: ${error.message}`);
  return data as KnowledgeDocumentRow;
}

export async function setBaseballKnowledgeStatus(
  supabase: SupabaseClient,
  documentId: string,
  status: BaseballKnowledgeTrust,
  verifiedAt = new Date().toISOString(),
) {
  return updateBaseballKnowledgeDocument(supabase, documentId, { status, verifiedAt });
}

export async function updateBaseballKnowledgeChunk(
  supabase: SupabaseClient,
  chunkId: string,
  input: Partial<Omit<BaseballKnowledgeChunkInput, "documentId">>,
) {
  const { data, error } = await supabase
    .from("baseball_knowledge_chunks")
    .update({
      ...(input.ordinal === undefined ? {} : { ordinal: input.ordinal }),
      ...(input.content === undefined ? {} : { content: input.content }),
      ...(input.metadata === undefined ? {} : { metadata: input.metadata }),
    })
    .eq("id", chunkId)
    .select("*")
    .single();
  if (error) throw new Error(`Unable to update Baseball Knowledge Bank chunk: ${error.message}`);
  return data as KnowledgeChunkRow;
}

function toDocumentRow(input: Partial<BaseballKnowledgeDocumentInput>) {
  return {
    ...(input.slug === undefined ? {} : { slug: input.slug }),
    ...(input.title === undefined ? {} : { title: input.title }),
    ...(input.category === undefined ? {} : { category: input.category }),
    ...(input.subcategory === undefined ? {} : { subcategory: input.subcategory ?? null }),
    ...(input.level === undefined ? {} : { level: input.level ?? null }),
    ...(input.governingBody === undefined ? {} : { governing_body: input.governingBody ?? null }),
    ...(input.version === undefined ? {} : { version: input.version ?? null }),
    ...(input.sourceName === undefined ? {} : { source_name: input.sourceName ?? null }),
    ...(input.sourceReference === undefined ? {} : { source_reference: input.sourceReference ?? null }),
    ...(input.status === undefined ? {} : { status: input.status }),
    ...(input.verifiedAt === undefined ? {} : { verified_at: input.verifiedAt ?? null }),
    ...(input.expiresAt === undefined ? {} : { expires_at: input.expiresAt ?? null }),
    ...(input.metadata === undefined ? {} : { metadata: input.metadata ?? {} }),
  };
}

function isMissingKnowledgeStorage(error: { code?: string; message?: string }): boolean {
  return error.code === "42P01"
    || error.code === "PGRST205"
    || /baseball_knowledge_(documents|chunks)|schema cache/i.test(error.message ?? "");
}
