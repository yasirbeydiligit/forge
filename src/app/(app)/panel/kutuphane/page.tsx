import type { Metadata } from "next";
import { Library } from "lucide-react";

import { UploadDialog } from "./upload-dialog";
import { EmptyState } from "@/components/empty-state";
import { PaperCard } from "@/components/lab/lab";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { requireCoach } from "@/lib/auth";
import type { Database } from "@/lib/database.types";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Kütüphane Yönetimi" };

type DocumentRow = Pick<
  Database["public"]["Tables"]["library_documents"]["Row"],
  | "id"
  | "title"
  | "authors"
  | "source_type"
  | "year"
  | "status"
  | "page_count"
  | "created_at"
>;

type DocStatus = Database["public"]["Enums"]["document_status"];

const SOURCE_TYPE_LABELS: Record<
  Database["public"]["Enums"]["library_source_type"],
  string
> = {
  paper: "Makale",
  book: "Kitap",
  handout: "Ders notu",
};

const STATUS_LABELS: Record<DocStatus, string> = {
  pending: "Bekliyor",
  processing: "İşleniyor",
  ready: "Hazır",
  failed: "Başarısız",
};

/** Editorial status pill colours, drawn from the lab token palette. */
const STATUS_CLASSES: Record<DocStatus, string> = {
  pending: "border-paper-border bg-paper-foreground/[0.05] text-paper-muted",
  processing: "border-lab-amber/30 bg-lab-amber/10 text-lab-amber",
  ready: "border-lab-green/30 bg-lab-green/10 text-lab-green",
  failed: "border-destructive/30 bg-destructive/10 text-destructive",
};

function StatusBadge({ status }: { status: DocStatus }) {
  return (
    <Badge variant="outline" className={cn("shrink-0", STATUS_CLASSES[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export default async function LibraryManagementPage() {
  await requireCoach();
  const supabase = await createSupabaseServerClient();

  const [{ data: docData }, { data: chunkData }] = await Promise.all([
    supabase
      .from("library_documents")
      .select("id, title, authors, source_type, year, status, page_count, created_at")
      .order("created_at", { ascending: false }),
    supabase.from("document_chunks").select("document_id"),
  ]);

  const documents = (docData ?? []) as DocumentRow[];

  // Tally chunk counts per document (small corpus; an in-memory tally avoids a
  // per-row aggregate query).
  const chunkCounts = new Map<string, number>();
  for (const row of (chunkData ?? []) as { document_id: string }[]) {
    chunkCounts.set(row.document_id, (chunkCounts.get(row.document_id) ?? 0) + 1);
  }

  return (
    <div>
      <PageHeader
        title="Kütüphane Yönetimi"
        description="Araştırma kaynaklarını yükle; sporcular Kütüphane'de bunlara soru sorabilir."
      >
        <UploadDialog />
      </PageHeader>

      {documents.length === 0 ? (
        <EmptyState
          icon={Library}
          title="Henüz belge yok"
          description="İlk PDF'i yükleyerek araştırma kütüphaneni oluşturmaya başla."
          action={<UploadDialog />}
        />
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => {
            const chunkCount = chunkCounts.get(doc.id) ?? 0;
            const meta = [
              SOURCE_TYPE_LABELS[doc.source_type],
              doc.year != null ? String(doc.year) : null,
              doc.page_count != null ? `${doc.page_count} sayfa` : null,
              `${chunkCount} parça`,
            ].filter(Boolean) as string[];

            return (
              <PaperCard key={doc.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-serif text-lg text-paper-foreground">
                      {doc.title}
                    </p>
                    {doc.authors ? (
                      <p className="truncate text-sm text-paper-muted">
                        {doc.authors}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={doc.status} />
                </div>
                <div className="flex items-center justify-between gap-3 text-xs text-paper-muted">
                  <span className="truncate">{meta.join(" · ")}</span>
                  <span className="shrink-0">{formatRelative(doc.created_at)}</span>
                </div>
              </PaperCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
