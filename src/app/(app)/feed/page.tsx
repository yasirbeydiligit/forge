import type { Metadata } from "next";
import { MessagesSquare } from "lucide-react";

import { CreatePost, PostCard, type FeedPostView } from "./feed-components";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/shell/page-header";
import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Feed" };

const POST_SELECT = `
  id, body, image_url, is_question, answered, created_at,
  author:profiles!feed_posts_author_id_profiles_id_fk(id, full_name, avatar_url, role),
  feed_likes(user_id),
  feed_comments(id, body, created_at, author:profiles!feed_comments_author_id_profiles_id_fk(id, full_name, avatar_url, role))
`;

export default async function FeedPage() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from("feed_posts")
    .select(POST_SELECT)
    .order("created_at", { ascending: false })
    .limit(50);

  const posts = (data ?? []) as unknown as FeedPostView[];
  const isCoach = profile.role === "coach";

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        title="Topluluk Feed"
        description="Soru sor, antrenmanını paylaş, birbirinize destek olun."
      />

      <CreatePost profile={profile} />

      {posts.length === 0 ? (
        <EmptyState
          icon={MessagesSquare}
          title="Feed henüz boş"
          description="İlk gönderiyi sen paylaş ya da koçuna bir soru sor."
        />
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              currentUserId={profile.id}
              isCoach={isCoach}
            />
          ))}
        </div>
      )}
    </div>
  );
}
