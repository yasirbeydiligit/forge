"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import {
  Check,
  Heart,
  HelpCircle,
  MessageCircle,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import {
  addComment,
  createPost,
  deleteComment,
  deletePost,
  toggleLike,
  type FormState,
} from "./actions";
import { ImageUpload } from "@/components/image-upload";
import { SubmitButton } from "@/components/submit-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/lib/auth";
import { formatRelative, getInitials } from "@/lib/format";
import { cn } from "@/lib/utils";

export type FeedAuthor = {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: "coach" | "athlete";
};
export type FeedCommentView = {
  id: string;
  body: string;
  created_at: string;
  author: FeedAuthor | null;
};
export type FeedPostView = {
  id: string;
  body: string;
  image_url: string | null;
  is_question: boolean;
  answered: boolean;
  created_at: string;
  author: FeedAuthor | null;
  feed_likes: { user_id: string }[];
  feed_comments: FeedCommentView[];
};

function CoachBadge() {
  return (
    <Badge className="h-5 gap-1 px-1.5 text-[11px]">
      <span className="size-1.5 rounded-full bg-primary-foreground" /> Koç
    </Badge>
  );
}

function UserAvatar({ author, className }: { author: FeedAuthor | null; className?: string }) {
  return (
    <Avatar className={cn("size-9 border border-paper-border", className)}>
      {author?.avatar_url ? (
        <AvatarImage src={author.avatar_url} alt={author.full_name} />
      ) : null}
      <AvatarFallback className="bg-secondary text-xs font-semibold">
        {author ? getInitials(author.full_name) : "?"}
      </AvatarFallback>
    </Avatar>
  );
}

export function CreatePost({ profile }: { profile: Profile }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isQuestion, setIsQuestion] = useState(false);
  const [resetKey, setResetKey] = useState(0);
  const [state, formAction] = useActionState<FormState, FormData>(
    createPost,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(isQuestion ? "Sorun paylaşıldı." : "Gönderi paylaşıldı.");
      formRef.current?.reset();
      setIsQuestion(false);
      setResetKey((k) => k + 1);
    } else if (state.error) {
      toast.error(state.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-paper-border bg-paper p-4 paper-shadow"
    >
      <div className="flex gap-3">
        <UserAvatar
          author={{
            id: profile.id,
            full_name: profile.full_name,
            avatar_url: profile.avatar_url,
            role: profile.role,
          }}
        />
        <div className="flex-1 space-y-3">
          <input type="hidden" name="isQuestion" value={isQuestion ? "true" : "false"} />
          <Textarea
            name="body"
            placeholder={
              isQuestion
                ? "Koçuna bir soru sor…"
                : "Toplulukla bir şey paylaş…"
            }
            rows={2}
            required
            className="resize-none border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
          <ImageUpload key={resetKey} name="imageUrl" label="Görsel ekle" />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <Switch checked={isQuestion} onCheckedChange={setIsQuestion} />
              <span className="inline-flex items-center gap-1">
                <HelpCircle className="size-3.5" /> Soru olarak
              </span>
            </label>
            <SubmitButton size="sm">
              <Send className="size-4" /> Paylaş
            </SubmitButton>
          </div>
        </div>
      </div>
    </form>
  );
}

export function LikeButton({
  postId,
  initialCount,
  initialLiked,
}: {
  postId: string;
  initialCount: number;
  initialLiked: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [, startTransition] = useTransition();

  // Keep in sync if the server data changes after revalidation.
  useEffect(() => setLiked(initialLiked), [initialLiked]);
  useEffect(() => setCount(initialCount), [initialCount]);

  function onClick() {
    setLiked((v) => !v);
    setCount((c) => c + (liked ? -1 : 1));
    const fd = new FormData();
    fd.set("postId", postId);
    startTransition(async () => {
      await toggleLike(fd);
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm transition-colors",
        liked ? "text-primary" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Heart className={cn("size-4", liked && "fill-current")} />
      {count > 0 ? count : null}
    </button>
  );
}

function CommentComposer({ postId }: { postId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await addComment(formData);
        formRef.current?.reset();
      }}
      className="flex items-center gap-2"
    >
      <input type="hidden" name="postId" value={postId} />
      <Input
        name="body"
        placeholder="Yorum yaz…"
        className="h-9"
        required
        autoComplete="off"
      />
      <SubmitButton size="icon" variant="ghost" className="h-9" aria-label="Gönder">
        <Send className="size-4" />
      </SubmitButton>
    </form>
  );
}

export function PostCard({
  post,
  currentUserId,
  isCoach,
}: {
  post: FeedPostView;
  currentUserId: string;
  isCoach: boolean;
}) {
  const likeCount = post.feed_likes.length;
  const likedByMe = post.feed_likes.some((l) => l.user_id === currentUserId);
  const comments = [...post.feed_comments].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  const canDelete = isCoach || post.author?.id === currentUserId;
  const openQuestion = post.is_question && !post.answered;
  const answeredQuestion = post.is_question && post.answered;

  return (
    <article
      className={cn(
        "overflow-hidden rounded-xl border border-paper-border bg-paper paper-shadow",
        openQuestion && "border-l-2 border-l-lab-amber",
        answeredQuestion && "border-l-2 border-l-lab-green",
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <UserAvatar author={post.author} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">
              {post.author?.full_name ?? "Bilinmeyen"}
            </span>
            {post.author?.role === "coach" ? <CoachBadge /> : null}
            <span className="text-xs text-muted-foreground">
              · {formatRelative(post.created_at)}
            </span>
            {post.is_question ? (
              <span
                className={cn(
                  "text-label ml-auto inline-flex items-center gap-1 rounded-full px-2 py-1",
                  post.answered
                    ? "bg-lab-green/10 text-lab-green"
                    : "bg-lab-amber/10 text-lab-amber",
                )}
              >
                {post.answered ? (
                  <Check className="size-3" strokeWidth={3} />
                ) : (
                  <HelpCircle className="size-3" />
                )}
                {post.answered ? "Cevaplandı" : "Yanıt bekliyor"}
              </span>
            ) : null}
          </div>

          <p className="mt-1 whitespace-pre-wrap text-sm">{post.body}</p>

          {post.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.image_url}
              alt=""
              className="mt-3 max-h-96 w-full rounded-lg border border-paper-border object-cover"
            />
          ) : null}

          <div className="mt-3 flex items-center gap-4">
            <LikeButton
              postId={post.id}
              initialCount={likeCount}
              initialLiked={likedByMe}
            />
            <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
              <MessageCircle className="size-4" />
              {comments.length > 0 ? comments.length : null}
            </span>
            {canDelete ? (
              <form action={deletePost} className="ml-auto">
                <input type="hidden" name="id" value={post.id} />
                <button
                  type="submit"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Gönderiyi sil"
                >
                  <Trash2 className="size-4" />
                </button>
              </form>
            ) : null}
          </div>
        </div>
      </div>

      {comments.length > 0 ? (
        <ul className="space-y-3 border-t border-paper-border p-4">
          {comments.map((c) => {
            const coachComment = c.author?.role === "coach";
            const canDeleteComment = isCoach || c.author?.id === currentUserId;
            return (
              <li key={c.id} className="flex gap-2.5">
                <UserAvatar author={c.author} className="size-7" />
                <div
                  className={cn(
                    "min-w-0 flex-1 rounded-lg px-3 py-2",
                    coachComment
                      ? "border border-primary/30 bg-primary/10"
                      : "bg-secondary",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {c.author?.full_name ?? "Bilinmeyen"}
                    </span>
                    {coachComment ? <CoachBadge /> : null}
                    <span className="text-xs text-muted-foreground">
                      {formatRelative(c.created_at)}
                    </span>
                    {canDeleteComment ? (
                      <form action={deleteComment} className="ml-auto">
                        <input type="hidden" name="id" value={c.id} />
                        <button
                          type="submit"
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Yorumu sil"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </form>
                    ) : null}
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap text-sm">{c.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      <div className="border-t border-paper-border p-3">
        <CommentComposer postId={post.id} />
      </div>
    </article>
  );
}
