import type { Metadata } from "next";

import { LabHeader, LabPage } from "@/components/lab/lab";
import type { MappedCitation } from "@/lib/rag/citations";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { LibraryChat, type ChatMessage } from "./chat";

export const metadata: Metadata = { title: "Kütüphane" };

export default async function LibraryPage() {
  const profile = await requireProfile();

  const supabase = await createSupabaseServerClient();

  // Most recent thread owned by the current user (RLS also scopes this).
  const { data: thread } = await supabase
    .from("library_threads")
    .select("id")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let messages: ChatMessage[] = [];
  if (thread) {
    const { data: rows } = await supabase
      .from("library_messages")
      .select("id, role, content, citations")
      .eq("thread_id", thread.id)
      .order("created_at", { ascending: true });

    messages = (rows ?? []).map((row) => ({
      id: row.id,
      role: row.role === "assistant" ? "assistant" : "user",
      content: row.content,
      citations:
        row.role === "assistant"
          ? ((row.citations as MappedCitation[] | null) ?? [])
          : [],
    }));
  }

  return (
    <LabPage>
      <LabHeader
        metaLeft="Forge"
        metaRight="Araştırma"
        title="Kütüphane"
        subtitle="Araştırma kaynaklarına soru sor; yanıtlar yalnızca kütüphanedeki belgelere dayanır."
      />

      <LibraryChat initialThreadId={thread?.id ?? null} initialMessages={messages} />
    </LabPage>
  );
}
