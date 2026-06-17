/**
 * Seed the starter `insight_rules` that drive the woven-in, cited margin notes
 * across the athlete screens (Phase 4 of the Research Library RAG feature).
 *
 * Each rule pairs a metric threshold (evaluated against the athlete's OWN logged
 * data by the LLM-free engine in `src/lib/rag/insights-server.ts`) with a pinned
 * library chunk that becomes the note's citation. The metric keys / scopes here
 * MUST match the metric vocabulary in `insights-server.ts` and the per-page
 * scopes wired in `src/components/library/insight-note.tsx`.
 *
 * `pinned_chunk_id` is resolved AT RUN TIME (not hard-coded) so the script stays
 * portable across environments: for each rule we look up the relevant seeded
 * paper by a distinctive title keyword (status='ready'), then pick a chunk whose
 * content matches a relevant phrase — falling back to the first chunk by
 * `chunk_index`. If no ready document/chunk is found, the rule is still upserted
 * with `pinned_chunk_id = null` (a warning is logged): the note text still shows,
 * just without a citation, and a later run picks up the pin once the corpus is
 * seeded.
 *
 * Idempotent: upserts on the unique `key` column, so re-running updates in place.
 *
 * Standalone tsx script (like `src/db/seed.ts` / `scripts/ingest-library.ts`) —
 * NO Next.js APIs. We build the service-role Supabase client directly (it
 * bypasses RLS), rather than importing `src/lib/supabase/admin.ts` (that module
 * imports "server-only", which throws outside the Next runtime).
 *
 * Usage: npm run seed:insight-rules
 * Requires in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "../src/lib/database.types";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "\n✗ Eksik env. .env.local içinde NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY tanımlı olmalı.\n",
  );
  process.exit(1);
}

const admin = createClient<Database>(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type RuleInsert = Database["public"]["Tables"]["insight_rules"]["Insert"];

/**
 * A starter rule spec. `titleKeyword` locates the seeded paper (ILIKE
 * '%keyword%' against `library_documents.title`); `chunkPhrase` (optional) picks
 * a representative chunk by content (ILIKE '%phrase%'), falling back to the
 * first chunk by `chunk_index`.
 */
type RuleSpec = Omit<RuleInsert, "pinned_chunk_id"> & {
  /** Distinctive title keyword(s) to find the source paper (any may match). */
  titleKeywords: string[];
  /** Optional phrase to prefer a relevant chunk within that paper. */
  chunkPhrase?: string;
};

const RULES: RuleSpec[] = [
  {
    key: "protein_target",
    metric: "protein_per_bw_7d",
    comparator: ">=",
    threshold: 1.6,
    scope: "nutrition",
    retrieval_query: "protein intake per body weight for muscle protein synthesis",
    note_template:
      "Haftalık protein ortalaman {value} g/kg — kas protein sentezini desteklemek için önerilen aralıkta.",
    enabled: true,
    // ISSN protein & exercise position stand.
    titleKeywords: ["protein"],
    chunkPhrase: "g/kg",
  },
  {
    key: "sleep_low",
    metric: "sleep_hours_7d",
    comparator: "<",
    threshold: 7,
    scope: "recovery",
    retrieval_query: "sleep duration recovery and athletic performance",
    note_template:
      "Son 7 günde ortalama uykun {value} saat — toparlanma ve performans için en az 7 saat öneriliyor.",
    enabled: true,
    // "The Impact of Sleep Interventions on Athletic Performance" (title is English).
    titleKeywords: ["sleep", "uyku"],
    chunkPhrase: "sleep",
  },
  {
    key: "volume_progressing",
    metric: "volume_wow_pct",
    comparator: ">",
    threshold: 0,
    scope: "training",
    retrieval_query: "progressive overload training volume for muscle hypertrophy",
    note_template:
      "Antrenman hacmin geçen haftaya göre %{value} arttı — progresif yüklenme ilkesiyle uyumlu.",
    enabled: true,
    // Hypertrophy umbrella review / training-frequency paper.
    titleKeywords: ["hypertrophy", "frequency"],
    chunkPhrase: "volume",
  },
  {
    key: "rpe_high",
    metric: "rpe_7d",
    comparator: ">=",
    threshold: 8,
    scope: "training",
    retrieval_query: "rating of perceived effort RPE autoregulation training intensity",
    note_template:
      "Son 7 günün ortalama RPE'si {value} — oldukça yüksek; RPE'ye dayalı oto-regülasyonla yükü ayarlamayı düşünebilirsin.",
    enabled: true,
    // "Prescribing Intensity in Resistance Training Using Rating of Perceived Effort".
    titleKeywords: ["perceived effort", "RPE"],
    chunkPhrase: "perceived effort",
  },
];

/**
 * Resolve a representative chunk id for a rule by locating a ready source paper
 * via title keyword(s), then picking a chunk by content phrase (else the first
 * chunk by index). Returns null if nothing matches (rule is still seeded).
 */
async function resolvePinnedChunkId(spec: RuleSpec): Promise<string | null> {
  // 1) Find a ready document whose title matches any of the keywords.
  let documentId: string | null = null;
  for (const keyword of spec.titleKeywords) {
    const { data: docs } = await admin
      .from("library_documents")
      .select("id, title")
      .eq("status", "ready")
      .ilike("title", `%${keyword}%`)
      .limit(1);
    if (docs && docs.length > 0) {
      documentId = docs[0].id;
      break;
    }
  }
  if (!documentId) return null;

  // 2) Prefer a chunk whose content matches the phrase; else the first chunk.
  if (spec.chunkPhrase) {
    const { data: phraseChunks } = await admin
      .from("document_chunks")
      .select("id")
      .eq("document_id", documentId)
      .ilike("content", `%${spec.chunkPhrase}%`)
      .order("chunk_index", { ascending: true })
      .limit(1);
    if (phraseChunks && phraseChunks.length > 0) return phraseChunks[0].id;
  }

  const { data: firstChunks } = await admin
    .from("document_chunks")
    .select("id")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true })
    .limit(1);

  return firstChunks && firstChunks.length > 0 ? firstChunks[0].id : null;
}

async function main() {
  console.log("\n🌱 Insight kuralları seed ediliyor…\n");

  const rows: RuleInsert[] = [];
  for (const spec of RULES) {
    const pinnedChunkId = await resolvePinnedChunkId(spec);
    if (!pinnedChunkId) {
      console.warn(
        `⚠︎ ${spec.key}: pinli kaynak chunk bulunamadı (korpus henüz seed edilmemiş olabilir) — pinned_chunk_id=null ile ekleniyor.`,
      );
    } else {
      console.log(`✓ ${spec.key}: pinli chunk çözüldü (${pinnedChunkId}).`);
    }

    // Build the insert row explicitly (the resolver-only `titleKeywords` /
    // `chunkPhrase` fields are not columns and must not be persisted).
    rows.push({
      key: spec.key,
      metric: spec.metric,
      comparator: spec.comparator,
      threshold: spec.threshold,
      scope: spec.scope,
      retrieval_query: spec.retrieval_query,
      note_template: spec.note_template,
      enabled: spec.enabled,
      pinned_chunk_id: pinnedChunkId,
      created_by: null,
    });
  }

  const { error } = await admin
    .from("insight_rules")
    .upsert(rows, { onConflict: "key" });
  if (error) throw error;

  console.log(`\n✅ ${rows.length} insight kuralı upsert edildi.\n`);
}

main().catch((err) => {
  console.error("\n✗ Insight kuralı seed hatası:", err.message ?? err, "\n");
  process.exit(1);
});
