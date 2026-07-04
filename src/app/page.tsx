import { redirect } from "next/navigation";

import { LandingPage } from "@/components/landing/landing-page";
import { getProfile } from "@/lib/auth";

/** Entry point: signed-in users go to their home; visitors see the landing. */
export default async function HomePage() {
  const profile = await getProfile();
  if (profile?.role === "coach") redirect("/panel");
  if (profile) redirect("/bugun");
  return <LandingPage />;
}
