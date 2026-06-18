# Research Library RAG — Design

Date: 2026-06-17
Status: Approved (brainstorming complete; implementation plan to follow)

## Goal

Give Forge the ability to answer questions from the user's own library of
scientific papers, books, and coach handouts, and **weave those answers back
into the rest of the app**. A coach uploads documents; a background step parses,
chunks, and embeds them. A chat interface answers questions with citations that
deep-link to the exact source passage. Crucially, the library is not a separate
screen: when an athlete's own logged data crosses a meaningful threshold, an
inline margin note appears citing the relevant paper. The integration across the
app is the product's signature.

## Approved decisions

- **Embeddings:** Voyage AI (`voyage-3.5`, 1024-dim), stored in Postgres via
  `pgvector`. Anthropic has no embeddings API, so retrieval and generation are
  two separate planes.
- **Generation:** Claude **Sonnet 4.6** (`claude-sonnet-4-6`) via
  `@anthropic-ai/sdk` (already a dependency), with the **Citations** feature for
  passage-level attribution. Adaptive thinking, streaming.
- **Library ownership:** Coach-curated **shared** library. All authenticated
  users (coach + athletes) can query it and see citations. Inline insights are
  driven by **each athlete's own** logged data.
- **New keys (server-only):** `VOYAGE_API_KEY`, `ANTHROPIC_API_KEY` — added to
  `.env.example` and server-side env validation; pasted by the user into
  `.env.local` like the existing Supabase secrets.

## Architecture — two planes

```
CURATION (coach)                 QUERY (any user)              WOVEN-IN (every page)
  │ upload PDF / add URL           │ ask a question             │ weekly protein, load progression…
  ▼                                ▼                            ▼
[Ingestion]                    [Retrieval]                  [Insight engine]
unpdf → chunk → Voyage embed   hybrid search (pgvector +    rule fires →
  → document_chunks (vector)     full-text) → top-k chunks    relevant chunk fetched
                                 → Sonnet 4.6 + Citations      → margin note + citation + deep-link
                                   → cited answer
```

- **Ingestion** is one core library (`src/lib/rag/`) with two entry points: a
  bulk seeding script (papers fetched from the internet) and a coach upload
  server action. Both embed with Voyage and insert with the service-role client.
- **Retrieval** is a single Postgres RPC `match_chunks` doing **hybrid** search
  (vector cosine + `tsvector` full-text, fused) so recall stays high even when a
  pure-vector match is weak.
- **Chat** passes the selected chunks to Sonnet 4.6 as `document` content blocks
  with `citations: {enabled: true}`; returned citation blocks map back to our
  chunks and become deep-links.
- **Insight engine** is rule-based and LLM-free at render time (no per-pageview
  model call) — cheap and deterministic.

## Data model (Drizzle schema + RLS)

New migrations on top of the existing `0006`. Enable the `vector` extension.

- **`library_documents`** — `id, title, authors, source_type (paper|book|handout),
  source_url, doi, year, license, storage_path, page_count,
  status (pending|processing|ready|failed), error, content_hash, uploaded_by,
  created_at`.
- **`document_chunks`** — `id, document_id (fk, cascade), chunk_index,
  page_number, char_start, char_end, section_title, content, token_count,
  embedding vector(1024)`. Indexes: **HNSW** on `embedding`
  (`vector_cosine_ops`) + **GIN** on `to_tsvector('english', content)`.
- **`library_threads`** — `id, user_id, title, created_at`.
- **`library_messages`** — `id, thread_id, role (user|assistant), content,
  citations jsonb, created_at`. `citations` stores `{document_id, chunk_id,
  page_number, char_start, char_end, quoted_text}` so deep-links survive reloads.
- **`insight_rules`** — `id, key, metric, comparator, threshold, scope,
  retrieval_query, pinned_chunk_id, note_template, enabled, created_by`.
  Coach-authored.

### RLS

- `library_documents`, `document_chunks`: SELECT for all authenticated users;
  INSERT/UPDATE/DELETE only for `coach` (and the service-role ingestion path).
- `library_threads`, `library_messages`: owner-only (the asking user).
- `insight_rules`: SELECT for all; write for `coach`.
- Storage: private **`library`** bucket for PDFs; viewing via signed URLs.

`storage_path` + `page_number` + `char_start/end` are the basis of the
deep-link: the document viewer highlights the passage and can link to the
original PDF page.

## Ingestion pipeline (`src/lib/rag/`)

- **`parse.ts`** — `unpdf` extracts text page by page (page boundaries preserved
  → `page_number`).
- **`chunk.ts`** — ~500–800 token chunks respecting paragraph/sentence
  boundaries, ~100 token overlap; records `page_number` + `char_start/end`.
- **`embed.ts`** — Voyage `voyage-3.5` (1024-dim), `input_type:"document"`,
  batched, with 429/backoff retry.
- **`ingest.ts`** — orchestrates: create `library_documents` row `processing`
  → parse → chunk → embed → bulk-insert `document_chunks` → `ready`; on error
  `failed` + `error`. Idempotent via `content_hash` / `doi` (no double-insert).

Entry points:
1. `scripts/ingest-library.ts` (tsx, service-role) — bulk seed from a manifest.
2. Coach upload server action (`src/app/(app)/panel/kutuphane/actions.ts`) —
   uploads the PDF to the `library` bucket, then runs `ingest()`.

No job queue (closed community, infrequent uploads); processing runs inline and
the UI shows a `status` badge. Indexes created in the migration.

## Retrieval & chat

- **`match_chunks(query_embedding vector, query_text text, k int)` RPC** —
  hybrid: cosine similarity + `ts_rank`, fused with Reciprocal Rank Fusion;
  filters to `status='ready'` documents; returns chunk + document metadata +
  page/offset.
- **Chat flow** (`/kutuphane`): question → query embedding
  (`input_type:"query"`) → top-k (≈8) chunks → each chunk sent to Sonnet 4.6 as
  a `document` block with `citations:{enabled:true}` → cited, streamed answer.
  System prompt: answer only from the sources, cite, and say "kütüphanede
  bulamadım" when unsupported. Returned citation blocks are mapped to our chunks
  and persisted in `library_messages.citations`.
- Citations is incompatible with structured outputs — not needed here.
- **UI**: chat in the existing editorial/paper style; source cards under each
  answer → click → document viewer.
- **Viewer** (`/kutuphane/[docId]`): chunk text by page, `#chunk-<id>` anchor +
  highlight; "PDF'i aç" via signed URL.

## Woven-in inline insights (the signature)

Rule-based, LLM-free at render (cheap and robust). `insight_rules` are evaluated
against an athlete's computed metrics — reusing `src/lib/logbook-stats.ts`,
nutrition aggregates, and `daily_metrics`. When a rule fires, a margin note is
rendered from a pinned or pre-retrieved passage.

Placement (existing `src/components/lab/lab.tsx` primitives + the established
margin-note pattern):
- **Protein** rule → `/beslenme` + `/bugun` nutrition card.
- **Load progression** rule → `/antrenman/[date]` (next to est-1RM / volume).
- **Sleep/recovery** rule → `/takip`.

Each note: a short claim + "— [Paper title], p.X" deep-link. Seed 3–4 starter
rules tied to seeded papers (protein ~1.6 g/kg, progressive overload,
sleep ≥7h, RPE autoregulation). Evaluated server-side and cached.

## Internet corpus

Fetched via WebSearch/WebFetch, **open-access / CC-licensed full texts only**
(copyright-respecting; `source_url` + `license` stored). Sources: PubMed Central
OA, JISSN, Sports Medicine (OA), Frontiers, MDPI (Nutrients/Sports). Topics
aligned to Forge's data: protein & muscle protein synthesis, resistance-training
volume/frequency/intensity, progressive overload, RPE/RIR autoregulation,
creatine, sleep & recovery, energy balance & body composition, hydration. A
`scripts/library-seed.json` manifest (~10–15 starter papers) is downloaded and
ingested by the seed script. Books/handouts are uploaded manually by the coach.

## Phasing

0. **Infra** — `vector` extension, migrations, env vars + validation,
   `src/lib/rag` scaffolding, `library` storage bucket + RLS.
1. **Ingestion + seed corpus** — `parse`/`chunk`/`embed`/`ingest`, seed manifest,
   seed script run.
2. **Retrieval RPC + chat UI** — `match_chunks`, `/kutuphane`, chat server action.
3. **Viewer + deep-link** — `/kutuphane/[docId]`, passage highlight, signed URLs.
4. **Insight engine + seed rules + inline placement** — evaluator, seed rules,
   margin notes on `/beslenme`, `/bugun`, `/antrenman/[date]`, `/takip`.

## Verification

- `npm run build`, `npm run typecheck`, `npm run lint`.
- Ingest a couple of seed papers and confirm chunks + embeddings land.
- Retrieval smoke test (`match_chunks` returns relevant chunks).
- Headless-Chrome render screenshots of `/kutuphane`, the viewer, and at least
  one inline margin note (temporary public sample route pattern for authed
  screens).

## Notes / constraints

- Anthropic has no embeddings endpoint — embeddings are Voyage; only generation
  is Claude.
- Citations cannot be combined with structured outputs (`output_config.format`).
- Drizzle owns the schema and generates SQL; RLS + the `vector` extension +
  `match_chunks` live in companion custom SQL migrations, consistent with the
  existing architecture.
- Only open-access/CC content is auto-ingested from the internet.
