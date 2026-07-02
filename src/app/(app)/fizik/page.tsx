import type { Metadata } from "next";

import { PhotoUploadDialog } from "@/components/physique/photo-upload-dialog";
import { PhotoTimeline } from "@/components/physique/photo-timeline";
import type { ComparablePhoto } from "@/components/physique/compare-view";
import { LabHeader, LabPage, MarginNote } from "@/components/lab/lab";
import { requireProfile } from "@/lib/auth";
import { toDateKey } from "@/lib/format";
import { signPhysiquePaths } from "@/lib/physique";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PhysiquePhoto } from "@/lib/types";

export const metadata: Metadata = { title: "Fizik" };

export default async function PhysiquePage() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const todayKey = toDateKey(new Date());

  const [{ data: photosData }, { data: todayMetric }] = await Promise.all([
    supabase
      .from("physique_photos")
      .select("*")
      .eq("athlete_id", profile.id)
      .order("photo_date", { ascending: false })
      .order("created_at", { ascending: false }),
    supabase
      .from("daily_metrics")
      .select("weight")
      .eq("athlete_id", profile.id)
      .eq("metric_date", todayKey)
      .maybeSingle(),
  ]);

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

  const todayWeight =
    todayMetric?.weight != null ? Number(todayMetric.weight) : null;

  return (
    <LabPage>
      <LabHeader
        metaLeft="Fizik takip"
        metaRight={photos.length ? `${photos.length} kayıt` : "Yeni defter"}
        title="Fizik"
        subtitle="Aynı ışık, aynı poz — değişimi zaman konuşsun."
      />

      <div className="mb-6 flex items-center justify-end">
        <PhotoUploadDialog todayWeight={todayWeight} />
      </div>

      {signed.length === 0 ? (
        <MarginNote label="Başlangıç · Fizik" accent="green">
          İlk fotoğrafını ekle. Fotoğraflar yalnız sana ve koçuna görünür;
          düzenli aralıklarla (ör. iki haftada bir) aynı poz, ilerlemeyi en net
          gösteren şeydir.
        </MarginNote>
      ) : (
        <PhotoTimeline photos={signed} canDelete />
      )}
    </LabPage>
  );
}
