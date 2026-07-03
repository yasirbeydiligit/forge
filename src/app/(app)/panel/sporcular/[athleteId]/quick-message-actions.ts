"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCoach } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type QuickMessageState = { ok?: boolean; error?: string };

const schema = z.object({
  postId: z.string().uuid(),
  athleteId: z.string().uuid(),
  body: z.string().trim().min(1, "Bir şeyler yaz."),
});

/**
 * The "hızlı dokunuş": reply to an athlete's feed post without leaving their
 * detail page. Inserting the comment is enough — the on_feed_comment_created
 * trigger marks the post answered when the author is a coach.
 */
export async function sendQuickMessage(
  _prev: QuickMessageState,
  formData: FormData,
): Promise<QuickMessageState> {
  const coach = await requireCoach();
  const parsed = schema.safeParse({
    postId: formData.get("postId"),
    athleteId: formData.get("athleteId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("feed_comments").insert({
    post_id: parsed.data.postId,
    author_id: coach.id,
    body: parsed.data.body,
  });
  if (error) return { error: "Mesaj gönderilemedi." };

  revalidatePath("/feed");
  revalidatePath("/panel");
  revalidatePath("/panel/sorular");
  revalidatePath(`/panel/sporcular/${parsed.data.athleteId}`);
  return { ok: true };
}
