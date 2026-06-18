# Research Library RAG — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a coach-curated scientific library to Forge with RAG-powered, citation-deep-linked chat and inline data-driven margin notes woven across the app.

**Architecture:** Two planes. Retrieval = Voyage `voyage-3.5` embeddings (1024-dim) stored in Postgres `pgvector`, searched by a hybrid (vector + full-text) `match_chunks` RPC. Generation = Claude Sonnet 4.6 (`@anthropic-ai/sdk`) with the Citations feature over the retrieved chunks. A rule-based, LLM-free insight engine renders margin notes from athletes' own logged metrics. Drizzle owns the schema; RLS, the `vector` extension, and `match_chunks` live in companion SQL migrations; app queries go through `@supabase/ssr` so RLS is authoritative.

**Tech Stack:** Next.js 15 (App Router, PWA), TypeScript, Drizzle, Supabase (Postgres + pgvector + Storage + RLS), Voyage AI, `@anthropic-ai/sdk` (Sonnet 4.6 + Citations), `unpdf`, vitest (new, for pure-logic unit tests).

**Companion design:** `docs/plans/2026-06-17-research-library-rag-design.md`.

---

## Conventions & ground rules (read before any task)

- **Read the bundled Next.js guide first.** Per `AGENTS.md`, this is a modified Next.js — before writing any route handler, server action, or page, read the relevant file under `node_modules/next/dist/docs/`. Heed deprecation notices.
- **DB access pattern:** Drizzle defines schema + generates SQL migrations only. App reads/writes go through the `@supabase/ssr` client (carries the user JWT → RLS authoritative). The ingestion path (script + the embedding insert) uses the **service-role** admin client (`src/lib/supabase/admin.ts`).
- **Migrations:** `npm run db:generate` to generate from `src/db/schema.ts`; hand-author the companion security/extension/RPC SQL (the repo already does this — see `drizzle/0001_security.sql`, `0002_security_hardening.sql`, `0004_*_rls.sql`, `0006_nutrition_rls.sql`). Apply with `npm run db:migrate` (needs `DATABASE_URL`, now set).
- **Env:** `VOYAGE_AI_API_KEY` and `ANTHROPIC_API_KEY` are server-only (both already present in `.env.local`). Never import them from client code. Add to `.env.example` and a server-only env module. Note the Voyage var name is `VOYAGE_AI_API_KEY` (not `VOYAGE_API_KEY`).
- **Verification:** `npm run build`, `npm run typecheck`, `npm run lint` must stay green. Unit tests via `npm run test` (vitest, added in Task 1). UI verified via `next dev` + headless-Chrome screenshot (see design doc; for authed screens use a temporary public sample route added to PUBLIC_PATHS, screenshot, then delete).
- **Commit frequently** — one commit per task (or per red→green cycle). Commit messages end with the Co-Authored-By trailer.
- **YAGNI:** no job queue, no multi-provider abstraction, no per-user libraries. Coach-curated shared library only.
- **API shapes to verify at implementation time (do not guess):**
  - Voyage embeddings: `POST https://api.voyageai.com/v1/embeddings` — confirm body (`{model, input: string[], input_type: "document"|"query"}`), response (`data[].embedding`), batch limits, and rate limits against current Voyage docs.
  - Anthropic Citations: confirm the `document` content-block shape and returned `citations` block shape against the claude-api skill's Citations doc (`shared/live-sources.md` → Citations) before wiring the mapping.

---

## Phase 0 — Infrastructure

### Task 1: Add vitest for pure-logic unit tests

**Files:**
- Modify: `package.json` (devDeps + `test` script)
- Create: `vitest.config.ts`
- Create: `src/lib/rag/__tests__/smoke.test.ts`

**Step 1:** Install vitest: `npm i -D vitest`.

**Step 2:** Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
```

**Step 3:** Add to `package.json` scripts: `"test": "vitest run"`, `"test:watch": "vitest"`.

**Step 4:** Write a smoke test in `src/lib/rag/__tests__/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("vitest", () => {
  it("runs", () => expect(1 + 1).toBe(2));
});
```

**Step 5:** Run `npm run test` → expect 1 passing test.

**Step 6:** Commit: `chore: add vitest for unit tests`.

---

### Task 2: Add server-only env vars

**Files:**
- Modify: `.env.example`
- Create: `src/lib/rag/env.ts` (server-only)

**Step 1:** Append to `.env.example` a documented section for `VOYAGE_AI_API_KEY` and `ANTHROPIC_API_KEY` (mirror the existing comment style; note both are server-only secrets).

**Step 2:** Create `src/lib/rag/env.ts` with `import "server-only";` at top, reading and validating `process.env.VOYAGE_AI_API_KEY` and `process.env.ANTHROPIC_API_KEY`; throw a clear Turkish error if missing (mirror `src/lib/env.ts` style). Export `ragEnv = { voyageApiKey, anthropicApiKey }`. (The `@anthropic-ai/sdk` auto-reads `ANTHROPIC_API_KEY`; pass the Voyage key explicitly to the embed client.)

**Step 3:** Verify: `npm run typecheck`.

**Step 4:** Commit: `feat: add Voyage + Anthropic env config`.

> The user must paste real values into `.env.local`. Phases 1+ that hit Voyage/Anthropic cannot run until then.

---

### Task 3: Drizzle schema — library tables

**Files:**
- Modify: `src/db/schema.ts`

**Step 1:** Add a `librarySourceType` enum (`paper|book|handout`), `documentStatus` enum (`pending|processing|ready|failed`), `libraryRole` enum if needed (reuse existing role).

**Step 2:** Add tables exactly as in the design doc:
- `library_documents`
- `document_chunks` — note: Drizzle's pg-core may not have a native `vector` type; use `customType` for `vector(1024)` (define a small `vector` custom type), or declare the column in the companion SQL migration and keep Drizzle's representation as `text`/custom. Prefer a `customType<{ data: number[] }>` named `vector` with `dataType() => "vector(1024)"`.
- `library_threads`, `library_messages`, `insight_rules`

**Step 3:** Add indexes that Drizzle can express (btree on FKs, unique on `content_hash`/`doi`). The HNSW + GIN indexes go in the companion SQL migration (Task 5).

**Step 4:** `npm run db:generate` → inspect the generated SQL migration; verify table DDL is correct. Do **not** apply yet.

**Step 5:** Commit: `feat: add library schema (documents, chunks, threads, messages, rules)`.

---

### Task 4: Companion SQL — vector extension + indexes + match_chunks RPC

**Files:**
- Create: `drizzle/00NN_library_vector.sql` (next number after generated migration)

**Step 1:** `create extension if not exists vector;`

**Step 2:** Ensure `document_chunks.embedding` is `vector(1024)` (alter if Drizzle emitted something else).

**Step 3:** Create indexes:
```sql
create index if not exists document_chunks_embedding_idx
  on document_chunks using hnsw (embedding vector_cosine_ops);
create index if not exists document_chunks_fts_idx
  on document_chunks using gin (to_tsvector('english', content));
```

**Step 4:** Create the hybrid RPC `match_chunks(query_embedding vector(1024), query_text text, match_count int)` returning chunk rows joined to document metadata, fusing vector rank and `ts_rank` via Reciprocal Rank Fusion (RRF, k=60). Filter to documents with `status='ready'`. Mark `security invoker` so RLS applies. Include exact SQL in this file.

**Step 5:** Apply: `npm run db:migrate`. Verify with `mcp__supabase__list_tables` / a quick `execute_sql` that the extension, tables, and function exist.

**Step 6:** Commit: `feat: vector extension, hybrid match_chunks RPC, indexes`.

---

### Task 5: RLS policies + storage bucket

**Files:**
- Create: `drizzle/00NN_library_rls.sql`

**Step 1:** Enable RLS on all new tables. Policies (mirror existing helper patterns in `0001_security.sql`, e.g. an `is_coach()` check):
- `library_documents`, `document_chunks`: SELECT to all authenticated; write to coach only.
- `library_threads`, `library_messages`: owner-only (`user_id = auth.uid()` / thread ownership).
- `insight_rules`: SELECT all; write coach.

**Step 2:** Create a private storage bucket `library` and storage policies: coach can insert/update; authenticated can read via signed URLs only. (Follow the `media` bucket precedent.)

**Step 3:** Apply: `npm run db:migrate`. Verify policies via `mcp__supabase__get_advisors` (security) — expect no new RLS-disabled warnings.

**Step 4:** Commit: `feat: library RLS + storage bucket`.

---

### Task 6: Regenerate Supabase TS types

**Files:**
- Modify: `src/lib/database.types.ts`

**Step 1:** Regenerate via `mcp__supabase__generate_typescript_types` and write the result.

**Step 2:** `npm run typecheck`.

**Step 3:** Commit: `chore: regenerate database types for library tables`.

---

## Phase 1 — Ingestion + seed corpus

### Task 7: Chunking (TDD)

**Files:**
- Create: `src/lib/rag/chunk.ts`
- Create: `src/lib/rag/chunk.test.ts`

**Step 1 (red):** Write tests for `chunkPages(pages: {pageNumber:number; text:string}[]): Chunk[]`:
- splits into ~500–800 token chunks (approx by chars: ~4 chars/token) with ~100-token overlap,
- never splits mid-sentence when avoidable,
- each chunk carries `pageNumber`, `charStart`, `charEnd`, `chunkIndex` (monotonic across the doc),
- empty/whitespace pages produce no chunks.

**Step 2:** Run `npm run test` → fail.

**Step 3 (green):** Implement `chunk.ts` (pure, no I/O). Include a `estimateTokens(s)` helper.

**Step 4:** Run tests → pass.

**Step 5:** Commit: `feat: rag chunking with page + offset tracking`.

---

### Task 8: PDF parsing

**Files:**
- Create: `src/lib/rag/parse.ts`

**Step 1:** Implement `parsePdf(buffer): Promise<{pageNumber:number; text:string}[]>` using `unpdf` (already a dependency) — extract text per page, preserving page boundaries. Read `unpdf` usage from its package before writing.

**Step 2:** Manual check: a tiny script or vitest using a small fixture PDF (commit a 1–2 page public-domain fixture under `src/lib/rag/__fixtures__/`). Assert page count and non-empty text.

**Step 3:** Run `npm run test` → pass.

**Step 4:** Commit: `feat: per-page PDF parsing via unpdf`.

---

### Task 9: Voyage embedding client

**Files:**
- Create: `src/lib/rag/embed.ts`

**Step 1:** Verify Voyage embeddings request/response shape against current Voyage docs (WebFetch). Implement `embedDocuments(texts: string[])` and `embedQuery(text: string)` calling `voyage-3.5` with the correct `input_type`, batched (respect batch + token limits), with 429/backoff retry. Return `number[][]` / `number[]` (1024-dim). `import "server-only"`.

**Step 2:** Add a guard test (no network): a unit test that mocks `fetch` and asserts the request body shape (`model`, `input`, `input_type`) and that batching splits oversized inputs. `src/lib/rag/embed.test.ts`.

**Step 3:** Run `npm run test` → pass.

**Step 4:** Commit: `feat: Voyage embedding client (document + query)`.

---

### Task 10: Ingestion orchestrator

**Files:**
- Create: `src/lib/rag/ingest.ts`

**Step 1:** Implement `ingestDocument({ adminClient, meta, pdfBuffer })`:
- compute `content_hash`; if a `ready` doc with same hash/doi exists, skip (idempotent),
- insert `library_documents` row `processing`,
- `parsePdf` → `chunkPages` → `embedDocuments` (batched) → bulk insert `document_chunks` (embedding as the `vector` literal),
- set `ready`; on any error set `failed` + `error` and rethrow.
- Uses the service-role admin client (bypasses RLS for the write path).

**Step 2:** Type-check + a unit test with mocked client/embed verifying the state transitions (`processing → ready`, and `→ failed` on parse error).

**Step 3:** Run `npm run test` + `npm run typecheck` → pass.

**Step 4:** Commit: `feat: ingestion orchestrator (parse→chunk→embed→store)`.

---

### Task 11: Seed manifest + bulk ingest script

**Files:**
- Create: `scripts/library-seed.json`
- Create: `scripts/ingest-library.ts`

**Step 1:** Curate ~10–15 **open-access / CC-licensed** papers (PMC OA, JISSN, Sports Medicine OA, Frontiers, MDPI) across Forge's topics (protein/MPS, RT volume/frequency/intensity, progressive overload, RPE/RIR, creatine, sleep/recovery, energy balance, hydration). For each: `{title, authors, year, doi, source_url, source_type, license, topic, pdf_url}`. **Use WebSearch/WebFetch to find and verify each is genuinely open-access**; record the license. Write `scripts/library-seed.json`.

**Step 2:** Write `scripts/ingest-library.ts` (tsx, loads `.env.local` via dotenv like `seed.ts`): for each manifest entry, download the PDF, upload to the `library` bucket, then call `ingestDocument`. Idempotent re-runs. Log progress per doc.

**Step 3:** Add `"ingest:library": "tsx scripts/ingest-library.ts"` to `package.json`.

**Step 4:** Run it (requires `VOYAGE_API_KEY` + service-role key). Verify rows via `mcp__supabase__execute_sql` (`select status, count(*) from library_documents group by status;` and a chunk count).

**Step 5:** Commit: `feat: seed manifest + bulk library ingestion script` (do not commit downloaded PDFs).

---

## Phase 2 — Retrieval + chat

### Task 12: Retrieval helper (RRF fusion unit-tested)

**Files:**
- Create: `src/lib/rag/retrieve.ts`
- Create: `src/lib/rag/retrieve.test.ts`

**Step 1 (red):** If any ranking/fusion or citation-window math is done app-side (e.g. trimming/merging adjacent chunks, mapping char offsets), unit-test those pure functions here. Test `searchLibrary(query, k)` wiring with a mocked Supabase RPC + mocked `embedQuery`, asserting it embeds the query and calls `match_chunks` with the right args.

**Step 2:** Implement `searchLibrary`: `embedQuery` → call `match_chunks` RPC via the (request-scoped) Supabase client → return typed chunk+document results.

**Step 3:** Run tests → pass.

**Step 4:** Commit: `feat: library retrieval helper over match_chunks`.

---

### Task 13: Citation mapping (TDD)

**Files:**
- Create: `src/lib/rag/citations.ts`
- Create: `src/lib/rag/citations.test.ts`

**Step 1 (red):** Test `mapCitations(anthropicCitations, retrievedChunks)` → array of `{document_id, chunk_id, page_number, char_start, char_end, quoted_text, title}` suitable for `library_messages.citations`. Cover: citation referencing the Nth document block maps to the right chunk; multiple citations; no-citation answer → empty array.

**Step 2:** Run `npm run test` → fail.

**Step 3 (green):** Implement `citations.ts` after confirming the Anthropic citations block shape from the docs.

**Step 4:** Run tests → pass.

**Step 5:** Commit: `feat: map Anthropic citations to library chunks`.

---

### Task 14: Chat server action (Sonnet 4.6 + Citations, streaming)

**Files:**
- Read first: `node_modules/next/dist/docs/` (server actions / route handlers, streaming)
- Create: `src/app/(app)/kutuphane/actions.ts`

**Step 1:** Implement the answer flow: given `{threadId?, question}` →
- ensure a `library_threads` row (owner = current user via `@supabase/ssr`),
- persist the user `library_messages` row,
- `searchLibrary(question, 8)`,
- build the Anthropic request: each chunk as a `document` content block with `citations:{enabled:true}`, `title` = doc title; system prompt = answer only from sources, cite, say "kütüphanede bulamadım" if unsupported; model `claude-sonnet-4-6`, `thinking:{type:"adaptive"}`, **streaming** (`max_tokens` ~16000),
- collect the streamed text + citation blocks, `mapCitations`, persist the assistant message.

**Step 2:** `npm run typecheck` + `npm run lint`.

**Step 3:** A unit test with a mocked Anthropic client asserting the request includes document blocks with citations enabled and the model is `claude-sonnet-4-6`.

**Step 4:** Run `npm run test` → pass.

**Step 5:** Commit: `feat: library chat server action (Sonnet 4.6 + Citations)`.

---

### Task 15: Chat UI `/kutuphane`

**Files:**
- Create: `src/app/(app)/kutuphane/page.tsx`
- Create: `src/app/(app)/kutuphane/chat.tsx` (client island)
- Modify: nav (athlete + coach) to add "Kütüphane" (follow the existing nav pattern in `src/components/shell/app-shell.tsx`)

**Step 1:** Build the chat in the established editorial/paper style (reuse `ui/*`, `lab.tsx`). Stream the answer; render source cards under each answer (title, authors, "s.X"), each linking to `/kutuphane/[docId]#chunk-<id>`.

**Step 2:** `npm run build` + `npm run typecheck` + `npm run lint`.

**Step 3:** Render-verify via `next dev` + headless Chrome (temporary public sample route with mock messages if needed; remove after).

**Step 4:** Commit: `feat: library chat UI at /kutuphane`.

---

## Phase 3 — Viewer + deep-link

### Task 16: Document viewer `/kutuphane/[docId]`

**Files:**
- Create: `src/app/(app)/kutuphane/[docId]/page.tsx`
- Create: `src/app/(app)/kutuphane/[docId]/viewer.tsx`

**Step 1:** Load document + chunks (RLS-scoped). Render chunk text grouped by page, each with `id="chunk-<id>"`. On hash navigation, scroll to and **highlight** the target chunk. Add a "PDF'i aç" button → signed URL from the `library` bucket (server action or route handler creating the signed URL).

**Step 2:** `npm run build` + `typecheck` + `lint`.

**Step 3:** Render-verify (deep-link to a real `#chunk-<id>` shows the highlight).

**Step 4:** Commit: `feat: document viewer with passage deep-link + highlight`.

---

### Task 17: Coach upload UI + action

**Files:**
- Create: `src/app/(app)/panel/kutuphane/page.tsx`
- Create: `src/app/(app)/panel/kutuphane/actions.ts`
- Create: `src/app/(app)/panel/kutuphane/upload-dialog.tsx`

**Step 1:** Coach-only page listing documents with `status` badges. Upload dialog: title/authors/year/type + PDF file → action uploads to `library` bucket and calls `ingestDocument` inline (show processing → ready). Reuse `image-upload.tsx` lazy-import pattern for the client-side upload if helpful.

**Step 2:** Build/typecheck/lint + render-verify.

**Step 3:** Commit: `feat: coach library upload + management`.

---

## Phase 4 — Woven-in insights

### Task 18: Insight rule evaluator (TDD)

**Files:**
- Create: `src/lib/rag/insights.ts`
- Create: `src/lib/rag/insights.test.ts`

**Step 1 (red):** Test `evaluateRules(rules, metrics)` → fired rules with the metric value substituted into `note_template`. Cover comparators (`>=`, `<`, etc.), disabled rules skipped, missing metric → no fire. `metrics` is a plain record computed from existing sources.

**Step 2:** Run `npm run test` → fail.

**Step 3 (green):** Implement pure `evaluateRules`. Separately, a thin `getAthleteInsights(client, athleteId, scope)` that loads enabled rules, computes the needed metrics (reuse `src/lib/logbook-stats.ts`, nutrition aggregates, `daily_metrics`), evaluates, and attaches the citation (pinned `pinned_chunk_id`, or one cached retrieval via `retrieval_query`). No LLM call.

**Step 4:** Run tests → pass.

**Step 5:** Commit: `feat: rule-based insight evaluator`.

---

### Task 19: Seed insight rules

**Files:**
- Create: `scripts/seed-insight-rules.ts` (or extend `src/db/seed.ts`)

**Step 1:** Seed 3–4 rules tied to seeded papers, each with `pinned_chunk_id` resolved from an ingested doc (look up by doi/title):
- protein weekly avg ≥ ~1.6 g/kg,
- progressive overload (load trend),
- sleep ≥ 7h,
- RPE autoregulation.
Each with a Turkish `note_template` (e.g. "Haftalık protein ortalaman {value} g/kg — hedef aralıkta. {citation}").

**Step 2:** Run it; verify rows.

**Step 3:** Commit: `feat: seed starter insight rules`.

---

### Task 20: Inline margin notes across the app

**Files:**
- Create: `src/components/library/insight-note.tsx`
- Modify: `src/app/(app)/beslenme/page.tsx`, `src/app/(app)/bugun/page.tsx`, `src/app/(app)/antrenman/[date]/page.tsx`, `src/app/(app)/takip/page.tsx`

**Step 1:** Build `<InsightNote>` (paper margin-note style via `lab.tsx`): short claim + "— [Title], s.X" deep-link to `/kutuphane/[docId]#chunk-<id>`.

**Step 2:** On each target page, call `getAthleteInsights` for the relevant `scope` and render any fired notes inline (protein → beslenme/bugün; load → antrenman/[date]; sleep → takip). Server-rendered + cached; no LLM at render.

**Step 3:** Build/typecheck/lint + render-verify at least one fired note end-to-end (deep-link lands on the highlighted passage).

**Step 4:** Commit: `feat: inline cited insight notes across nutrition, logbook, wellness`.

---

## Final verification (after Phase 4)

- `npm run build && npm run typecheck && npm run lint && npm run test` all green.
- End-to-end manual: upload/seed a paper → ask a question in `/kutuphane` → click a citation → land on highlighted passage; trigger a metric threshold → see the inline note citing the same library.
- `mcp__supabase__get_advisors` (security + performance) clean of new criticals.
- Use superpowers:requesting-code-review before merge.

## Out of scope (YAGNI)

Job queue; per-user/private libraries; non-open-access ingestion; OCR for scanned PDFs (note as a follow-up if a seed paper is image-only); multi-language embeddings tuning.
