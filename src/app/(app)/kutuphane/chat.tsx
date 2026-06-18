"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { askLibrary } from "./actions";
import { PaperCard, SectionLabel } from "@/components/lab/lab";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { MappedCitation } from "@/lib/rag/citations";
import { cn } from "@/lib/utils";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: MappedCitation[];
};

const MAX_QUOTE = 180;

/** Starter prompts shown on the empty state; clicking fills the composer. */
const SUGGESTIONS = [
  "Haftalık antrenman hacmi ne kadar olmalı?",
  "Günlük protein alımını nasıl planlamalıyım?",
  "Toparlanmayı en çok ne etkiler?",
];

/** A unique key per citation target — de-dupes citations pointing at one chunk. */
function citationKey(c: MappedCitation) {
  return `${c.documentId}#${c.chunkId}`;
}

function dedupeCitations(citations: MappedCitation[]): MappedCitation[] {
  const seen = new Set<string>();
  const out: MappedCitation[] = [];
  for (const c of citations) {
    const key = citationKey(c);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

function truncate(text: string, max: number) {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max).trimEnd()}…` : trimmed;
}

export function LibraryChat({
  initialThreadId,
  initialMessages,
}: {
  initialThreadId: string | null;
  initialMessages: ChatMessage[];
}) {
  const [threadId, setThreadId] = useState<string | null>(initialThreadId);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  function applySuggestion(question: string) {
    setDraft(question);
    document.getElementById("library-composer")?.focus();
  }

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, isPending]);

  function submit() {
    const question = draft.trim();
    if (!question || isPending) return;

    // Optimistically append the user message and clear the composer.
    const optimisticId = `optimistic-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticId, role: "user", content: question, citations: [] },
    ]);
    setDraft("");

    startTransition(async () => {
      try {
        const result = await askLibrary(question, threadId ?? undefined);
        setThreadId(result.threadId);
        setMessages((prev) => [
          ...prev,
          {
            id: `${result.threadId}-${prev.length}`,
            role: "assistant",
            content: result.answer,
            citations: result.citations,
          },
        ]);
      } catch (error) {
        // Roll back the optimistic user message and surface the error.
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setDraft(question);
        toast.error(
          error instanceof Error ? error.message : "Bir hata oluştu.",
        );
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="space-y-6">
      {isEmpty ? (
        <PaperCard className="flex flex-col items-center gap-5 p-10 text-center">
          <LibraryEmptyArt />
          <div className="space-y-1.5">
            <h2 className="font-serif text-xl text-paper-foreground">
              Kütüphaneye sor
            </h2>
            <p className="mx-auto max-w-sm font-serif text-[15px] italic text-paper-muted">
              Yanıtlar yalnızca kütüphanedeki kaynaklara dayanır ve her zaman
              alıntıyla gelir.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => applySuggestion(q)}
                className="rounded-full border border-paper-border bg-paper px-3 py-1.5 text-sm text-paper-foreground transition-colors duration-[var(--dur-fast)] hover:border-lab-link/40 hover:text-lab-link"
              >
                {q}
              </button>
            ))}
          </div>
        </PaperCard>
      ) : (
        <div className="space-y-5">
          {messages.map((message) =>
            message.role === "user" ? (
              <UserBubble key={message.id} content={message.content} />
            ) : (
              <AssistantAnswer
                key={message.id}
                content={message.content}
                citations={message.citations}
              />
            ),
          )}

          {isPending ? (
            <p className="font-serif text-sm italic text-paper-muted">
              Kaynaklar taranıyor…
            </p>
          ) : null}
        </div>
      )}

      <div ref={bottomRef} />

      <div className="sticky bottom-4 z-10">
        <PaperCard className="flex items-end gap-2 p-2">
          <Textarea
            id="library-composer"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Kütüphaneye bir soru sor…"
            rows={1}
            disabled={isPending}
            aria-label="Soru"
            className="min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button
            type="button"
            size="icon"
            onClick={submit}
            disabled={isPending || draft.trim().length === 0}
            aria-label="Gönder"
          >
            <Send className="size-4" />
          </Button>
        </PaperCard>
      </div>
    </div>
  );
}

/**
 * Editorial empty-state mark: three stacked "cited note" rows in the signature
 * green / amber / blue stripe language. Placeholder for a future Higgsfield
 * illustration — swap this component's body when the asset lands.
 */
function LibraryEmptyArt() {
  const stripes = ["bg-lab-green", "bg-lab-amber", "bg-lab-blue"];
  return (
    <div className="flex w-full max-w-[208px] flex-col gap-1.5" aria-hidden>
      {stripes.map((stripe, i) => (
        <div
          key={i}
          className="flex items-center gap-2.5 rounded-md border border-paper-border bg-paper px-2.5 py-2 paper-shadow"
        >
          <span className={cn("h-7 w-[3px] shrink-0 rounded-full", stripe)} />
          <span className="flex-1 space-y-1.5">
            <span className="block h-1.5 w-3/4 rounded-full bg-paper-foreground/10" />
            <span className="block h-1.5 w-1/2 rounded-full bg-paper-foreground/10" />
          </span>
        </div>
      ))}
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] whitespace-pre-wrap rounded-xl bg-primary/10 px-4 py-2.5 text-sm text-foreground">
        {content}
      </div>
    </div>
  );
}

function AssistantAnswer({
  content,
  citations,
}: {
  content: string;
  citations: MappedCitation[];
}) {
  const sources = dedupeCitations(citations);

  return (
    <div className="space-y-3">
      <div className="whitespace-pre-wrap font-serif text-[15px] leading-relaxed text-paper-foreground">
        {content}
      </div>

      {sources.length > 0 ? (
        <div className="space-y-2">
          <SectionLabel>Kaynaklar</SectionLabel>
          <div className="grid gap-2 sm:grid-cols-2">
            {sources.map((c) => (
              <SourceCard key={citationKey(c)} citation={c} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SourceCard({ citation }: { citation: MappedCitation }) {
  return (
    <Link
      href={`/kutuphane/${citation.documentId}#chunk-${citation.chunkId}`}
      className={cn(
        "block rounded-lg border border-paper-border bg-paper p-3",
        "paper-shadow transition-colors hover:border-lab-link/40",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium text-paper-foreground">
          {citation.title}
        </p>
        {citation.pageNumber != null ? (
          <span className="shrink-0 font-mono text-xs tabular-nums text-paper-muted">
            s.{citation.pageNumber}
          </span>
        ) : null}
      </div>
      {citation.quotedText ? (
        <p className="mt-1 font-serif text-xs italic leading-snug text-paper-muted">
          “{truncate(citation.quotedText, MAX_QUOTE)}”
        </p>
      ) : null}
    </Link>
  );
}
