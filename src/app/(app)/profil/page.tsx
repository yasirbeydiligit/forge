import type { Metadata } from "next";
import { LogOut } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { DetailsForm } from "./details-form";
import { ProfileForm } from "./profile-form";
import {
  LabHeader,
  LabPage,
  PaperCard,
  SectionLabel,
} from "@/components/lab/lab";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { getInitials } from "@/lib/format";
import { GOAL_LABEL_TR, SEX_LABEL_TR, ageFrom } from "@/lib/profile";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProfileDetails } from "@/lib/types";

export const metadata: Metadata = { title: "Profilim" };

export default async function ProfilePage() {
  const profile = await requireProfile();
  const supabase = await createSupabaseServerClient();
  const { data: detailsData } = await supabase
    .from("profile_details")
    .select("*")
    .eq("user_id", profile.id)
    .maybeSingle();
  const details = detailsData as ProfileDetails | null;

  const age = ageFrom(details?.birth_date);
  // Künye meta line: only the parts that are actually filled in.
  const metaParts = [
    age != null ? `${age} yaş` : null,
    details?.height_cm ? `${details.height_cm} cm` : null,
    details?.sex ? SEX_LABEL_TR[details.sex] : null,
  ].filter(Boolean);

  return (
    <LabPage className="max-w-xl">
      <LabHeader
        metaLeft="Profil · Künye"
        metaRight={profile.role === "coach" ? "Koç" : "Sporcu"}
        title="Profilim"
      />

      <PaperCard className="flex items-center gap-4 p-5">
        <Avatar className="size-16 border border-paper-border">
          {profile.avatar_url ? (
            <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
          ) : null}
          <AvatarFallback className="bg-secondary text-lg font-semibold">
            {getInitials(profile.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <h2 className="truncate font-serif text-2xl text-paper-foreground">
            {profile.full_name}
          </h2>
          {profile.username ? (
            <p className="font-mono text-sm text-muted-foreground">
              @{profile.username}
            </p>
          ) : null}
          {metaParts.length ? (
            <p className="mt-1 font-mono text-xs tabular-nums text-muted-foreground">
              {metaParts.join(" · ")}
            </p>
          ) : null}
          {details?.goal ? (
            <p className="mt-1.5 text-xs font-medium uppercase tracking-[0.14em] text-lab-green">
              {GOAL_LABEL_TR[details.goal]}
              {details.weekly_target_days
                ? ` · ${details.weekly_target_days} gün/hafta`
                : null}
            </p>
          ) : null}
        </div>
      </PaperCard>

      <section className="mt-8 space-y-3">
        <SectionLabel>Kimlik</SectionLabel>
        <PaperCard className="p-5">
          <ProfileForm profile={profile} />
        </PaperCard>
      </section>

      <section className="mt-8 space-y-3">
        <SectionLabel>Ölçüler ve tercihler</SectionLabel>
        <PaperCard className="p-5">
          <DetailsForm details={details} />
        </PaperCard>
      </section>

      <form action={signOutAction} className="mt-8">
        <Button type="submit" variant="outline" className="w-full">
          <LogOut className="size-4" /> Çıkış yap
        </Button>
      </form>
    </LabPage>
  );
}
