"use server";

import Anthropic from "@anthropic-ai/sdk";

import { ragEnv } from "@/lib/rag/env";
import { mapCitations, type MappedCitation } from "@/lib/rag/citations";
import { embedQuery } from "@/lib/rag/embed";
import { searchLibrary } from "@/lib/rag/retrieve";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/database.types";

import { buildAnswerRequest, parseAnswer } from "./request";

export type AskResult = {
  threadId: string;
  answer: string;
  citations: MappedCitation[];
};

/**
 * Answer a library question, grounded in the research corpus via RAG + the
 * Anthropic Citations feature, and persist the turn to `library_threads` /
 * `library_messages`.
 *
 * The Supabase client carries the signed-in user's JWT, so RLS is the source of
 * truth for ownership (threads/messages are owner-only). Anthropic, Supabase and
 * embeddings are the only side effects; the request building / response parsing
 * live in pure helpers (`./request`) that are unit-tested in isolation.
 */
export async function askLibrary(
  query: string,
  threadId?: string,
): Promise<AskResult> {
  const question = query.trim();
  if (!question) throw new Error("Soru boş olamaz.");

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Oturum bulunamadı.");

  // 1) Ensure a thread owned by the current user (RLS enforces ownership).
  let resolvedThreadId = threadId;
  if (resolvedThreadId) {
    const { data: existing, error } = await supabase
      .from("library_threads")
      .select("id")
      .eq("id", resolvedThreadId)
      .single();
    if (error || !existing) throw new Error("Sohbet bulunamadı.");
  } else {
    const { data: created, error } = await supabase
      .from("library_threads")
      .insert({
        user_id: user.id,
        title: question.slice(0, 80),
      })
      .select("id")
      .single();
    if (error || !created) throw new Error("Sohbet oluşturulamadı.");
    resolvedThreadId = created.id;
  }

  // 2) Persist the user message.
  {
    const { error } = await supabase.from("library_messages").insert({
      thread_id: resolvedThreadId,
      role: "user",
      content: question,
    });
    if (error) throw new Error("Mesaj kaydedilemedi.");
  }

  // 3) Retrieve the top-k chunks for the question.
  const chunks = await searchLibrary({
    supabase,
    embedQuery: (q) => embedQuery(q, ragEnv.voyageApiKey),
    query: question,
    k: 8,
  });

  // 4) Ask Sonnet 4.6 with one citable document block per chunk (streaming).
  const anthropic = new Anthropic({ apiKey: ragEnv.anthropicApiKey });
  const stream = anthropic.messages.stream(buildAnswerRequest(question, chunks));
  const message = await stream.finalMessage();

  // 5) Parse the answer + citations and map citations back to source chunks.
  const { answer, citations: citationObjects } = parseAnswer(message.content);
  const citations = mapCitations(citationObjects, chunks);

  // 6) Persist the assistant message with the mapped citations as jsonb.
  {
    const { error } = await supabase.from("library_messages").insert({
      thread_id: resolvedThreadId,
      role: "assistant",
      content: answer,
      citations: citations as unknown as Json,
    });
    if (error) throw new Error("Yanıt kaydedilemedi.");
  }

  return { threadId: resolvedThreadId, answer, citations };
}
