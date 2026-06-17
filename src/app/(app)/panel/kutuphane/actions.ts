"use server";

import { createHash } from "node:crypto";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCoach } from "@/lib/auth";
import { embedDocuments } from "@/lib/rag/embed";
import { ragEnv } from "@/lib/rag/env";
import {
  ingestDocument,
  type IngestAdminClient,
  type IngestMeta,
} from "@/lib/rag/ingest";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type UploadResult = { ok: boolean; error?: string };

const STORAGE_BUCKET = "library";
const MAX_PDF_BYTES = 50 * 1024 * 1024; // 50 MB — generous cap for a single paper/book.

const metaSchema = z.object({
  title: z.string().trim().min(2, "Başlık en az 2 karakter olmalı."),
  authors: z.string().trim().optional().nullable(),
  year: z.coerce.number().int().min(1000).max(3000).optional().nullable(),
  source_url: z
    .string()
    .trim()
    .url("Geçerli bir bağlantı girin.")
    .optional()
    .or(z.literal("")),
  doi: z.string().trim().optional().nullable(),
  source_type: z.enum(["paper", "book", "handout"]),
  license: z.string().trim().optional().nullable(),
});

/** A filesystem-safe slug derived from the title, capped in length. */
function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "") // strip combining diacritics
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "belge"
  );
}

/** sha256 hex of bytes (first 12 chars) — deterministic storage-path suffix. */
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
 * Coach-only: upload a research PDF and run it through the ingestion pipeline.
 *
 * Defense in depth: the page already gates on `requireCoach`, and this action
 * re-checks it (server actions are independently invokable endpoints). The
 * actual ingest writes go through the SERVICE-ROLE admin client, which bypasses
 * RLS — the coach check above is what gates access.
 *
 * CAVEAT: ingestion runs INLINE in this request (PDF parse + chunk + embed), so
 * a very large PDF can exceed a serverless function timeout. This is acceptable
 * for the closed-community v1 (the plan deliberately defers a job queue); keep
 * it inline.
 */
export async function uploadLibraryDocument(
  formData: FormData,
): Promise<UploadResult> {
  const coach = await requireCoach();

  const parsed = metaSchema.safeParse({
    title: formData.get("title"),
    authors: formData.get("authors") || null,
    year: formData.get("year") || null,
    source_url: formData.get("source_url") || "",
    doi: formData.get("doi") || null,
    source_type: formData.get("source_type"),
    license: formData.get("license") || null,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "PDF dosyası gerekli." };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: "PDF 50MB'tan küçük olmalı." };
  }

  const pdfBuffer = new Uint8Array(await file.arrayBuffer());
  if (!isPdf(pdfBuffer)) {
    return { ok: false, error: "Dosya geçerli bir PDF değil." };
  }

  const admin = createSupabaseAdminClient();

  // 1) Upload the bytes to the private `library` bucket at a sanitized path.
  const storagePath = `papers/${slugify(parsed.data.title)}-${shortHash(pdfBuffer)}.pdf`;
  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true, // idempotent re-uploads of the same file
    });
  if (uploadError) {
    return { ok: false, error: "PDF depolanamadı. Tekrar deneyin." };
  }

  // 2) Run the ingestion pipeline (parse → chunk → embed → store). Writes via
  //    the service-role client; embeddings via Voyage (server-only key).
  const meta: IngestMeta = {
    title: parsed.data.title,
    authors: parsed.data.authors || null,
    source_type: parsed.data.source_type,
    source_url: parsed.data.source_url || null,
    doi: parsed.data.doi || null,
    year: parsed.data.year ?? null,
    license: parsed.data.license || null,
    storage_path: storagePath,
    uploaded_by: coach.id,
  };

  try {
    await ingestDocument({
      // `ingestDocument` accepts a minimal structural `IngestAdminClient`; the
      // real service-role `SupabaseClient` is a superset whose deeply-generic
      // builder types don't structurally unify, so cast through `unknown`
      // (the same approach the seed script and the orchestrator's own tests use).
      adminClient: admin as unknown as IngestAdminClient,
      meta,
      pdfBuffer,
      embed: (texts) => embedDocuments(texts, ragEnv.voyageApiKey),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // `ingestDocument` already flags the document `failed` on error; surface a
    // readable message to the coach.
    return { ok: false, error: `Belge işlenemedi: ${message}` };
  }

  revalidatePath("/panel/kutuphane");
  return { ok: true };
}
