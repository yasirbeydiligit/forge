import type { Metadata } from "next";

import { LoginCard } from "./login-card";

export const metadata: Metadata = { title: "Giriş" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  return <LoginCard redirectTo={redirect} />;
}
