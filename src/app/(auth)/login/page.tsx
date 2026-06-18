import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Giriş" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl font-medium tracking-tight">
          Tekrar hoş geldin
        </CardTitle>
        <CardDescription>Devam etmek için giriş yap.</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm redirectTo={redirect} />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Hesabın yok mu? Katılmak için koçundan bir{" "}
          <span className="font-medium text-foreground">davet bağlantısı</span>{" "}
          iste.
        </p>
      </CardContent>
    </Card>
  );
}
