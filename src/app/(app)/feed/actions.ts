"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireProfile } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { ok?: boolean; error?: string };

function revalidateFeed() {
  revalidatePath("/feed");
  revalidatePath("/panel");
  revalidatePath("/panel/sorular");
}

const postSchema = z.object({
  body: z.string().trim().min(1, "Bir şeyler yaz."),
  imageUrl: z.string().trim().optional().nullable(),
  isQuestion: z.boolean().optional(),
});

export async function createPost(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireProfile();
  const parsed = postSchema.safeParse({
    body: formData.get("body"),
    imageUrl: formData.get("imageUrl") || null,
    isQuestion: formData.get("isQuestion") === "true",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("feed_posts").insert({
    author_id: profile.id,
    body: parsed.data.body,
    image_url: parsed.data.imageUrl || null,
    is_question: parsed.data.isQuestion ?? false,
  });
  if (error) return { error: "Gönderi paylaşılamadı." };

  revalidateFeed();
  return { ok: true };
}

export async function deletePost(formData: FormData): Promise<void> {
  await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("feed_posts").delete().eq("id", id);
  revalidateFeed();
}

export async function addComment(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const postId = String(formData.get("postId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!postId || !body) return;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("feed_comments")
    .insert({ post_id: postId, author_id: profile.id, body });
  revalidateFeed();
}

export async function deleteComment(formData: FormData): Promise<void> {
  await requireProfile();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("feed_comments").delete().eq("id", id);
  revalidateFeed();
}

export async function toggleLike(formData: FormData): Promise<void> {
  const profile = await requireProfile();
  const postId = String(formData.get("postId") ?? "");
  if (!postId) return;

  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("feed_likes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", profile.id)
    .maybeSingle();

  if (existing) {
    await supabase.from("feed_likes").delete().eq("id", existing.id);
  } else {
    await supabase
      .from("feed_likes")
      .insert({ post_id: postId, user_id: profile.id });
  }
  revalidatePath("/feed");
}
