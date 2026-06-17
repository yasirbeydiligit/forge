-- Research library vector layer: pgvector extension, ANN + FTS indexes, and the
-- hybrid retrieval RPC. The table DDL (document_chunks et al.) is in 0007; this
-- companion migration adds everything drizzle-kit cannot express.

-- ---------------------------------------------------------------------------
-- 1. pgvector extension (must exist before the vector(1024) column is created)
-- ---------------------------------------------------------------------------
create extension if not exists vector;

-- ---------------------------------------------------------------------------
-- 2. Ensure the embedding column is vector(1024) (no-op if 0007 already set it)
-- ---------------------------------------------------------------------------
alter table public.document_chunks
  alter column embedding type vector(1024);

-- ---------------------------------------------------------------------------
-- 3. Indexes: HNSW for cosine ANN search, GIN for English full-text search
-- ---------------------------------------------------------------------------
create index if not exists document_chunks_embedding_idx
  on public.document_chunks using hnsw (embedding vector_cosine_ops);

create index if not exists document_chunks_fts_idx
  on public.document_chunks using gin (to_tsvector('english', content));

-- ---------------------------------------------------------------------------
-- 4. Hybrid retrieval: reciprocal-rank fusion of semantic + lexical results.
--    Column names/types mirror public.document_chunks / public.library_documents
--    exactly (authors text, year integer, chunk metadata integer).
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
  order by f.score desc
  limit match_count;
$$;
