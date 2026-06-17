/**
 * Bulk ingestion of the seed Research Library corpus.
 *
 * For each entry in `scripts/library-seed.json`: download the (verified
 * open-access) PDF, upload the bytes to the private `library` storage bucket,
 * then run it through the Phase 1 ingestion pipeline (parse → chunk → embed →
 * store) via `ingestDocument`. Idempotent: `ingestDocument` dedups by
 * content_hash / doi, and storage upload uses upsert, so re-running is safe.
 *
 * Standalone tsx script (like `src/db/seed.ts`) — NO Next.js APIs. We build the
 * service-role Supabase client directly here rather than importing
 * `src/lib/supabase/admin.ts` (that module imports "server-only", which throws
 * outside the Next runtime). The RAG core modules (`ingest`, `embed`, `parse`,
 * `chunk`) deliberately avoid "server-only", so they import cleanly here.
 *
 * Usage: npm run ingest:library
 * Requires in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * VOYAGE_AI_API_KEY.
 */
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/database.types";
import { ingestDocument, type IngestMeta } from "../src/lib/rag/ingest";
import { embedDocuments } from "../src/lib/rag/embed";
import manifest from "./library-seed.json";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const voyageApiKey = process.env.VOYAGE_AI_API_KEY;

if (!url || !serviceKey) {
  console.error(
    "\n✗ Eksik env. .env.local içinde NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı.\n",
  );
  process.exit(1);
}
if (!voyageApiKey) {
  console.error(
    "\n✗ Eksik env. .env.local içinde VOYAGE_AI_API_KEY tanımlı olmalı (Voyage embeddings).\n",
  );
  process.exit(1);
}
// Narrow for the rest of the module (TS can't see process.exit terminates).
const VOYAGE_KEY: string = voyageApiKey;

const STORAGE_BUCKET = "library";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const execFileAsync = promisify(execFile);

// Voyage free-tier limits (no payment method): 3 requests/min and 10K
// tokens/min. The Phase 1 `embedDocuments` batches up to 120K tokens/request
// and won't pace itself, so it trips a hard 429 on the free tier. We wrap the
// injected `embed` callback to (a) split chunk lists into small token-bounded
// batches and (b) pace requests under both caps. This stays entirely in the
// script — the Phase 1 core (`embed.ts`) is untouched.
const VOYAGE_REQUESTS_PER_MIN = 3;
// Stay safely under the 10K tokens/min cap with one batch per request.
const EMBED_BATCH_TOKEN_BUDGET = 8_000;
// One request every ~21s keeps us under 3 RPM with margin.
const EMBED_REQUEST_INTERVAL_MS = Math.ceil(60_000 / VOYAGE_REQUESTS_PER_MIN) + 1_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const estimateTokens = (s: string) => Math.ceil(s.length / 4);

type ManifestEntry = {
  title: string;
  authors: string | null;
  year: number | null;
  doi: string | null;
  source_url: string | null;
  pdf_url: string;
  source_type: "paper" | "book" | "handout";
  license: string | null;
  topic?: string;
};

const entries = manifest as ManifestEntry[];

const admin = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** A filesystem-safe slug derived from the title, capped in length. */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** sha256 hex of bytes — used to disambiguate storage paths deterministically. */
function shortHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

/** True if the bytes begin with the PDF magic header `%PDF-`. */
function isPdf(buffer: Uint8Array): boolean {
  return (
    buffer.length >= 5 &&
    buffer[0] === 0x25 && // %
    buffer[1] === 0x50 && // P
    buffer[2] === 0x44 && // D
    buffer[3] === 0x46 && // F
    buffer[4] === 0x2d // -
  );
}

/**
 * Download a PDF; returns its bytes, or null (with a logged reason) on failure.
 *
 * We download via `curl` rather than Node's `fetch`. Several publishers
 * (BioMed Central / Springer Open) front their PDFs with a bot-detection
 * interstitial that fingerprints undici's TLS/HTTP stack and serves a ~3KB HTML
 * challenge page to `fetch`, while a normal `curl` request (same User-Agent)
 * receives the real PDF. `curl` follows redirects and is available on the
 * platform; this keeps downloads robust without bundling an HTTP client.
 */
async function downloadPdf(entry: ManifestEntry): Promise<Uint8Array | null> {
  const dir = await mkdtemp(join(tmpdir(), "library-ingest-"));
  const outPath = join(dir, "download.pdf");
  try {
    await execFileAsync(
      "curl",
      [
        "-sL", // silent, follow redirects
        "--fail", // non-zero exit on HTTP >= 400
        "--max-time",
        "120",
        "-A",
        USER_AGENT,
        "-H",
        "Accept: application/pdf,*/*",
        "-o",
        outPath,
        entry.pdf_url,
      ],
      { maxBuffer: 64 * 1024 * 1024 },
    );

    const buffer = new Uint8Array(await readFile(outPath));
    if (!isPdf(buffer)) {
      console.warn(
        `   ⚠ PDF değil (${buffer.length} bayt, muhtemelen HTML interstitial) — atlanıyor`,
      );
      return null;
    }
    return buffer;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`   ⚠ indirme başarısız (curl): ${msg}`);
    return null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Rate-limited document embedder for the Voyage free tier. Splits `texts` into
 * batches whose estimated token total stays under {@link EMBED_BATCH_TOKEN_BUDGET},
 * delegates each batch to the Phase 1 `embedDocuments`, and paces requests to
 * respect the 3 RPM / 10K TPM free-tier caps. Returns one vector per input, in
 * order.
 */
async function embedRateLimited(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  // Build token-bounded batches. A single oversized chunk still goes alone
  // (Voyage will reject it only if it exceeds the per-minute cap, which our
  // chunker's ~800-token ceiling keeps us well under).
  const batches: string[][] = [];
  let current: string[] = [];
  let currentTokens = 0;
  for (const text of texts) {
    const tokens = estimateTokens(text);
    if (current.length > 0 && currentTokens + tokens > EMBED_BATCH_TOKEN_BUDGET) {
      batches.push(current);
      current = [];
      currentTokens = 0;
    }
    current.push(text);
    currentTokens += tokens;
  }
  if (current.length > 0) batches.push(current);

  const out: number[][] = [];
  for (let i = 0; i < batches.length; i++) {
    if (i > 0) await sleep(EMBED_REQUEST_INTERVAL_MS);
    const vectors = await embedDocuments(batches[i], VOYAGE_KEY);
    out.push(...vectors);
  }
  return out;
}

/** Upload PDF bytes to the private `library` bucket; returns the storage path. */
async function uploadToStorage(
  pdfBuffer: Uint8Array,
  entry: ManifestEntry,
): Promise<string | null> {
  const path = `papers/${slugify(entry.title)}-${shortHash(pdfBuffer)}.pdf`;
  const { error } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true, // idempotent re-runs
    });
  if (error) {
    console.warn(`   ⚠ depolama yükleme hatası: ${error.message}`);
    return null;
  }
  return path;
}

type Outcome = "ready" | "skipped" | "failed";

async function ingestEntry(entry: ManifestEntry): Promise<Outcome> {
  console.log(`\n• ${entry.title}`);

  const pdfBuffer = await downloadPdf(entry);
  if (!pdfBuffer) return "skipped";
  console.log(`   ↓ indirildi (${(pdfBuffer.length / 1024).toFixed(0)} KB)`);

  const storagePath = await uploadToStorage(pdfBuffer, entry);
  if (!storagePath) return "skipped";
  console.log(`   ↑ depolandı: ${STORAGE_BUCKET}/${storagePath}`);

  const meta: IngestMeta = {
    title: entry.title,
    authors: entry.authors,
    source_type: "paper",
    source_url: entry.source_url,
    doi: entry.doi,
    year: entry.year,
    license: entry.license,
    storage_path: storagePath,
  };

  try {
    const doc = await ingestDocument({
      adminClient: admin as never,
      meta,
      pdfBuffer,
      embed: embedRateLimited,
    });
    console.log(
      `   ✓ ${doc.status}${
        doc.page_count != null ? ` (${doc.page_count} sayfa)` : ""
      }`,
    );
    return doc.status === "ready" ? "ready" : "failed";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`   ✗ ingest başarısız: ${msg}`);
    return "failed";
  }
}

async function main() {
  console.log(`\n📚 Kütüphane tohumlama başlıyor — ${entries.length} belge.\n`);

  const counts: Record<Outcome, number> = { ready: 0, skipped: 0, failed: 0 };
  for (const entry of entries) {
    let outcome: Outcome;
    try {
      outcome = await ingestEntry(entry);
    } catch (err) {
      // Last-resort guard so one bad paper never aborts the whole run.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`   ✗ beklenmeyen hata: ${msg}`);
      outcome = "failed";
    }
    counts[outcome]++;
  }

  console.log("\n──────────────────────────────────────────────");
  console.log("✅ Tohumlama tamamlandı.");
  console.log(
    `   ready: ${counts.ready}  •  skipped: ${counts.skipped}  •  failed: ${counts.failed}`,
  );
  console.log("──────────────────────────────────────────────\n");
}

main().catch((err) => {
  console.error("\n✗ Tohumlama hatası:", err?.message ?? err, "\n");
  process.exit(1);
});
