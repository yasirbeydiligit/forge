import { redirect } from "next/navigation";

import { getProfile } from "@/lib/auth";

/** Entry point: route users to the right experience based on their role. */
export default async function HomePage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role === "coach") redirect("/panel");
  redirect("/bugun");
}
