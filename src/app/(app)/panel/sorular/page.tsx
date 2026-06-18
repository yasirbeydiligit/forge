import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { PostCard, type FeedPostView } from "@/app/(app)/feed/feed-components";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { requireCoach } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Cevaplanmamış Sorular" };

const POST_SELECT = `
  id, body, image_url, is_question, answered, created_at,
  author:profiles!feed_posts_author_id_profiles_id_fk(id, full_name, avatar_url, role),
  feed_likes(user_id),
  feed_comments(id, body, created_at, author:profiles!feed_comments_author_id_profiles_id_fk(id, full_name, avatar_url, role))
`;

export default async function UnansweredQuestionsPage() {
  const profile = await requireCoach();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("feed_posts")
    .select(POST_SELECT)
    .eq("is_question", true)
    .eq("answered", false)
    .order("created_at", { ascending: false });

  const posts = (data ?? []) as unknown as FeedPostView[];

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Cevaplanmamış sorular"
        description="Bir yorum yazdığında soru otomatik olarak cevaplandı sayılır."
      >
        <Button asChild variant="outline">
          <Link href="/feed">Feed&apos;e git</Link>
        </Button>
      </PageHeader>

      {posts.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Tüm sorular cevaplandı 🎉"
          description="Cevap bekleyen soru kalmadı. Harika iş!"
        />
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={profile.id}
              isCoach
            />
          ))}
        </div>
      )}
    </div>
  );
}
