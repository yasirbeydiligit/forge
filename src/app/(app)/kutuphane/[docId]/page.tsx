import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";

import { ChunkHighlight } from "./highlight";
import {
  LabHeader,
  LabLink,
  LabPage,
  PaperCard,
  SectionLabel,
} from "@/components/lab/lab";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export const metadata: Metadata = { title: "Belge" };

type DocumentRow = Database["public"]["Tables"]["library_documents"]["Row"];
type ChunkRow = Pick<
  Database["public"]["Tables"]["document_chunks"]["Row"],
  "id" | "chunk_index" | "page_number" | "section_title" | "content"
>;

const SOURCE_TYPE_LABELS: Record<
  Database["public"]["Enums"]["library_source_type"],
  string
> = {
  paper: "Makale",
  book: "Kitap",
  handout: "Ders notu",
};

/** Build the header meta line: source type · year · page count. */
function metaParts(doc: DocumentRow): string {
  const parts = [SOURCE_TYPE_LABELS[doc.source_type]];
  if (doc.year != null) parts.push(String(doc.year));
  if (doc.page_count != null) parts.push(`${doc.page_count} sayfa`);
  return parts.join(" · ");
}

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}) {
  await requireProfile();
  const { docId } = await params;

  const supabase = await createSupabaseServerClient();

  const { data: docData } = await supabase
    .from("library_documents")
    .select(
      "id, title, authors, source_type, source_url, doi, year, license, storage_path, page_count, status",
    )
    .eq("id", docId)
    .maybeSingle();

  if (!docData) notFound();
  const doc = docData as DocumentRow;

  const { data: chunkData } = await supabase
    .from("document_chunks")
    .select("id, chunk_index, page_number, section_title, content")
    .eq("document_id", doc.id)
    .order("chunk_index", { ascending: true });

  const chunks = (chunkData ?? []) as ChunkRow[];

  // Create a short-lived signed URL for the private PDF if one is stored.
  let pdfUrl: string | null = null;
  if (doc.storage_path) {
    const { data: signed } = await supabase.storage
      .from("library")
      .createSignedUrl(doc.storage_path, 3600);
    pdfUrl = signed?.signedUrl ?? null;
  }

  return (
    <LabPage>
      <ChunkHighlight />

      <Link
        href="/kutuphane"
        className="mb-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Kütüphane
      </Link>

      <LabHeader
        metaLeft="Forge"
        metaRight={metaParts(doc)}
        title={doc.title}
        subtitle={doc.authors ?? undefined}
      />

      <div className="mb-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border pb-6 text-sm text-muted-foreground">
        {doc.source_url ? (
          <LabLink href={doc.source_url} external>
            Kaynak
          </LabLink>
        ) : null}
        {doc.doi ? (
          <LabLink href={`https://doi.org/${doc.doi}`} external>
            DOI: {doc.doi}
          </LabLink>
        ) : null}
        {doc.license ? <span>Lisans: {doc.license}</span> : null}
        {pdfUrl ? (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-medium text-lab-link hover:underline"
          >
            <FileText className="size-4" />
            PDF&apos;i aç
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>

      {chunks.length === 0 ? (
        <PaperCard className="flex flex-col items-center gap-2 p-8 text-center">
          <FileText className="size-6 text-paper-muted" />
          <p className="font-serif text-lg italic text-paper-muted">
            Bu belge için henüz çıkarılmış metin yok.
          </p>
        </PaperCard>
      ) : (
        <div className="space-y-6">
          {chunks.map((chunk, i) => {
            const prev = chunks[i - 1];
            const showPageDivider =
              chunk.page_number != null &&
              (i === 0 || prev?.page_number !== chunk.page_number);

            return (
              <div key={chunk.id} className="space-y-3">
                {showPageDivider ? (
                  <div className="flex items-center gap-3 pt-2">
                    <SectionLabel>Sayfa {chunk.page_number}</SectionLabel>
                    <span className="h-px flex-1 bg-border" aria-hidden />
                  </div>
                ) : null}

                <div
                  id={`chunk-${chunk.id}`}
                  className="scroll-mt-24 rounded-xl border border-paper-border bg-paper p-5 text-paper-foreground paper-shadow"
                >
                  {chunk.section_title ? (
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-paper-muted">
                      {chunk.section_title}
                    </p>
                  ) : null}
                  <p className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-paper-foreground">
                    {chunk.content}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </LabPage>
  );
}
