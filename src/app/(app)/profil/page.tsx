import type { Metadata } from "next";
import { LogOut } from "lucide-react";

import { signOutAction } from "@/app/(auth)/actions";
import { ProfileForm } from "./profile-form";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Profilim" };

export default async function ProfilePage() {
  const profile = await requireProfile();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <PageHeader title="Profilim">
        <Badge variant="secondary" className="self-start">
          {profile.role === "coach" ? "Koç" : "Sporcu"}
        </Badge>
      </PageHeader>

      <Card className="p-5">
        <ProfileForm profile={profile} />
      </Card>

      <form action={signOutAction}>
        <Button type="submit" variant="outline" className="w-full">
          <LogOut className="size-4" /> Çıkış yap
        </Button>
      </form>
    </div>
  );
}
