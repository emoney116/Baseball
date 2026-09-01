-- CLU9-3: knowledge content is read-only to authenticated clients.
-- Server-side repository writes use the service role and stay outside the
-- client-facing Data API contract.

revoke all privileges on table public.baseball_knowledge_documents from authenticated;
revoke all privileges on table public.baseball_knowledge_chunks from authenticated;

grant select on table public.baseball_knowledge_documents to authenticated;
grant select on table public.baseball_knowledge_chunks to authenticated;
