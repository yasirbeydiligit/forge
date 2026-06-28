"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireCoach } from "@/lib/auth";
import { PROTOCOL_TIMING_ORDER } from "@/lib/nutrition/protocols";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { ok?: boolean; error?: string };

const timingEnum = z.enum(
  PROTOCOL_TIMING_ORDER as unknown as [string, ...string[]],
);

const protocolSchema = z.object({
  name: z.string().trim().min(1, "Protokol adı gerekli."),
  timing: timingEnum,
  instructions: z.string().trim().max(500).optional().nullable(),
  orderIndex: z.preprocess(
    (v) => (v === "" || v == null ? 0 : Number(v)),
    z.number().int().min(0).max(999).catch(0),
  ),
});

function revalidate() {
  revalidatePath("/panel/protokoller");
}

export async function createProtocol(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const profile = await requireCoach();
  const parsed = protocolSchema.safeParse({
    name: formData.get("name"),
    timing: formData.get("timing"),
    instructions: formData.get("instructions") || null,
    orderIndex: formData.get("orderIndex"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("protocol_templates").insert({
    name: d.name,
    timing: d.timing as never,
    instructions: d.instructions || null,
    order_index: d.orderIndex,
    created_by: profile.id,
  });
  if (error) return { error: "Protokol oluşturulamadı." };

  revalidate();
  return { ok: true };
}

export async function updateProtocol(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  await requireCoach();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Protokol bulunamadı." };

  const parsed = protocolSchema.safeParse({
    name: formData.get("name"),
    timing: formData.get("timing"),
    instructions: formData.get("instructions") || null,
    orderIndex: formData.get("orderIndex"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Form geçersiz." };
  }
  const d = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("protocol_templates")
    .update({
      name: d.name,
      timing: d.timing as never,
      instructions: d.instructions || null,
      order_index: d.orderIndex,
    })
    .eq("id", id);
  if (error) return { error: "Protokol güncellenemedi." };

  revalidate();
  return { ok: true };
}

const setActiveSchema = z.object({
  id: z.string().uuid(),
  active: z.enum(["0", "1"]),
});

export async function setProtocolActive(formData: FormData): Promise<void> {
  await requireCoach();
  const parsed = setActiveSchema.safeParse({
    id: formData.get("id"),
    active: formData.get("active"),
  });
  if (!parsed.success) return;
  const supabase = await createSupabaseServerClient();
  await supabase
    .from("protocol_templates")
    .update({ is_active: parsed.data.active === "1" })
    .eq("id", parsed.data.id);
  revalidate();
}

export async function deleteProtocol(formData: FormData): Promise<void> {
  await requireCoach();
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = await createSupabaseServerClient();
  await supabase.from("protocol_templates").delete().eq("id", id);
  revalidate();
}

/* ------------------------------- Assignment ------------------------------- */

const assignSchema = z.object({
  protocolId: z.string().uuid(),
  athleteId: z.string().uuid(),
  assigned: z.enum(["0", "1"]),
});

/** Assign or unassign a protocol to one athlete (toggle from the athlete page). */
export async function toggleAssignment(formData: FormData): Promise<void> {
  const profile = await requireCoach();
  const parsed = assignSchema.safeParse({
    protocolId: formData.get("protocolId"),
    athleteId: formData.get("athleteId"),
    assigned: formData.get("assigned"),
  });
  if (!parsed.success) return;
  const { protocolId, athleteId, assigned } = parsed.data;

  const supabase = await createSupabaseServerClient();
  if (assigned === "1") {
    await supabase.from("protocol_assignments").upsert(
      {
        protocol_id: protocolId,
        athlete_id: athleteId,
        assigned_by: profile.id,
      },
      { onConflict: "protocol_id,athlete_id" },
    );
  } else {
    await supabase
      .from("protocol_assignments")
      .delete()
      .eq("protocol_id", protocolId)
      .eq("athlete_id", athleteId);
  }

  revalidatePath(`/panel/sporcular/${athleteId}`);
  revalidatePath("/beslenme");
}
