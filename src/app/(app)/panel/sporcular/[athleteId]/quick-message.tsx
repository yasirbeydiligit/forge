"use client";

/**
 * "Hızlı dokunuş" slide-over: the coach replies to the athlete's recent feed
 * posts without leaving the detail page. Answering happens through the normal
 * feed machinery (a coach comment auto-marks the question answered via the DB
 * trigger), so the community sees the same conversation.
 */
import { useActionState, useEffect, useRef } from "react";
import { MessageCircle, MessageSquarePlus, Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { formatRelative } from "@/lib/format";

import { sendQuickMessage, type QuickMessageState } from "./quick-message-actions";

export type QuickMessagePost = {
  id: string;
  body: string;
  isQuestion: boolean;
  answered: boolean;
  createdAt: string;
};

function ReplyForm({ postId, athleteId }: { postId: string; athleteId: string }) {
  const [state, formAction, pending] = useActionState<QuickMessageState, FormData>(
    sendQuickMessage,
    {},
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="mt-2 space-y-2">
      <input type="hidden" name="postId" value={postId} />
      <input type="hidden" name="athleteId" value={athleteId} />
      <Textarea
        name="body"
        rows={2}
        required
        placeholder="Yanıtını yaz…"
        className="min-h-16 text-sm"
      />
      <div className="flex items-center justify-between gap-2">
        {state.error ? (
          <p className="text-xs text-destructive">{state.error}</p>
        ) : state.ok ? (
          <p className="text-xs text-lab-green">Gönderildi ✓</p>
        ) : (
          <span />
        )}
        <Button type="submit" size="sm" disabled={pending}>
          <Send className="size-3.5" />
          {pending ? "Gönderiliyor…" : "Gönder"}
        </Button>
      </div>
    </form>
  );
}

export function QuickMessage({
  athleteId,
  athleteName,
  posts,
}: {
  athleteId: string;
  athleteName: string;
  posts: QuickMessagePost[];
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <MessageSquarePlus className="size-4" />
          Mesaj
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Hızlı dokunuş</SheetTitle>
          <SheetDescription>
            {athleteName} ile feed üzerinden iletişim — yorumun topluluk
            feed&apos;inde görünür; soruysa otomatik &quot;cevaplandı&quot; olur.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pb-6">
          {posts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <MessageCircle className="mx-auto size-6 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Feed&apos;de gönderisi yok</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {athleteName} feed&apos;e bir şey yazdığında buradan tek adımda
                yanıt verebilirsin.
              </p>
            </div>
          ) : (
            posts.map((p) => (
              <div key={p.id} className="rounded-xl border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formatRelative(p.createdAt)}
                  </span>
                  {p.isQuestion ? (
                    <Badge
                      variant="secondary"
                      className={
                        p.answered
                          ? "rounded-full text-[10px] text-lab-green"
                          : "rounded-full text-[10px] text-lab-amber"
                      }
                    >
                      {p.answered ? "Cevaplandı" : "Yanıt bekliyor"}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1.5 line-clamp-4 font-serif text-[15px] italic text-foreground">
                  {p.body}
                </p>
                <ReplyForm postId={p.id} athleteId={athleteId} />
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
