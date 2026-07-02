import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Camera } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import type { ComparablePhoto } from "@/components/physique/compare-view";
import { PhotoTimeline } from "@/components/physique/photo-timeline";
import { requireCoach } from "@/lib/auth";
import { signPhysiquePaths } from "@/lib/physique";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PhysiquePhoto } from "@/lib/types";

export const metadata: Metadata = { title: "Fizik takip" };

/** Coach's read-only view of an athlete's physique timeline (RLS-gated). */
export default async function CoachPhysiquePage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  await requireCoach();
  const { athleteId } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: athlete }, { data: photosData }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", athleteId)
      .maybeSingle(),
    supabase
      .from("physique_photos")
      .select("*")
      .eq("athlete_id", athleteId)
      .order("photo_date", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);
  if (!athlete) notFound();

  const photos = (photosData ?? []) as PhysiquePhoto[];
  const urls = await signPhysiquePaths(
    supabase,
    photos.map((p) => p.storage_path),
  );
  const signed: ComparablePhoto[] = photos
    .filter((p) => urls.has(p.storage_path))
    .map((p) => ({
      id: p.id,
      photo_date: p.photo_date,
      note: p.note,
      weight_kg: p.weight_kg,
      url: urls.get(p.storage_path)!,
    }));

  return (
    <div className="space-y-6">
      <Link
        href={`/panel/sporcular/${athleteId}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> {athlete.full_name}
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fizik takip</h1>
        <p className="text-sm text-muted-foreground">
          {athlete.full_name} · {photos.length} fotoğraf · salt-okunur
        </p>
      </div>

      {signed.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="Henüz fotoğraf yok"
          description="Bu sporcu henüz fizik fotoğrafı yüklememiş."
        />
      ) : (
        <PhotoTimeline photos={signed} canDelete={false} />
      )}
    </div>
  );
}
