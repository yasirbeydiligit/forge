-- Research library fixes (hand-authored; companion to the generated 0010).
-- Adds a CHECK constraint that drizzle-kit cannot express and redefines the
-- hybrid retrieval RPC with a deterministic tiebreaker. No table-structure
-- changes here, so the Drizzle snapshot is unchanged from 0010.

-- ---------------------------------------------------------------------------
-- 1. Constrain library_messages.role to the design-doc values (user|assistant).
--    The table is empty, so this is safe to add unconditionally.
-- ---------------------------------------------------------------------------
alter table library_messages
  add constraint library_messages_role_check check (role in ('user', 'assistant'));

-- ---------------------------------------------------------------------------
-- 2. match_chunks: identical to 0008 except the final ORDER BY gains a
--    deterministic tiebreaker (c.id) so equal-score results are stable and
--    reproducible for tests.
-- ---------------------------------------------------------------------------
create or replace function public.match_chunks(
  query_embedding vector(1024),
  query_text text,
  match_count int default 8
)
returns table (
  chunk_id uuid, document_id uuid, chunk_index int, page_number int,
  char_start int, char_end int, section_title text, content text,
  document_title text, document_authors text, document_source_url text,
  document_year int, score double precision
)
language sql stable security invoker set search_path = public
as $$
  with semantic as (
    select c.id, row_number() over (order by c.embedding <=> query_embedding) as rank
    from document_chunks c join library_documents d on d.id = c.document_id
    where d.status = 'ready'
    order by c.embedding <=> query_embedding
    limit greatest(match_count * 5, 40)
  ),
  lexical as (
    select c.id, row_number() over (
      order by ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', query_text)) desc
    ) as rank
    from document_chunks c join library_documents d on d.id = c.document_id
    where d.status = 'ready'
      and to_tsvector('english', c.content) @@ plainto_tsquery('english', query_text)
    order by ts_rank(to_tsvector('english', c.content), plainto_tsquery('english', query_text)) desc
    limit greatest(match_count * 5, 40)
  ),
  fused as (
    select coalesce(s.id, l.id) as id,
           coalesce(1.0/(60 + s.rank),0.0) + coalesce(1.0/(60 + l.rank),0.0) as score
    from semantic s full outer join lexical l on s.id = l.id
  )
  select c.id, c.document_id, c.chunk_index, c.page_number, c.char_start, c.char_end,
         c.section_title, c.content, d.title, d.authors, d.source_url, d.year, f.score
  from fused f
  join document_chunks c on c.id = f.id
  join library_documents d on d.id = c.document_id
  order by f.score desc, c.id
  limit match_count;
$$;
