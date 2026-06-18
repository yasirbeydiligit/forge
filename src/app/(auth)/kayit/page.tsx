import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { checkInviteToken } from "@/lib/invites";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Davetle Kayıt" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const check = token
    ? await checkInviteToken(token)
    : ({ valid: false, reason: "Davet kodu eksik." } as const);

  if (!check.valid) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-2xl font-medium tracking-tight">
            <AlertCircle className="size-5 text-destructive" />
            Davet geçersiz
          </CardTitle>
          <CardDescription>{check.reason}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Bu platform yalnızca davetle açıktır. Geçerli bir davet bağlantısı
            için koçunla iletişime geç.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Giriş ekranına dön</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-serif text-2xl font-medium tracking-tight">
          Topluluğa katıl
        </CardTitle>
        <CardDescription className="flex items-center gap-2 text-primary">
          <CheckCircle2 className="size-4" />
          Davetin geçerli{check.note ? ` · ${check.note}` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm token={token!} />
        <p className="mt-6 text-center text-sm text-muted-foreground">
          Zaten hesabın var mı?{" "}
          <Link href="/login" className="font-medium text-foreground underline-offset-4 hover:underline">
            Giriş yap
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
