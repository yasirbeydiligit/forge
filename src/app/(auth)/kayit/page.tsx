import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { MemberCard } from "@/app/(auth)/member-card";
import { Button } from "@/components/ui/button";
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
      <MemberCard
        label="Davetle kayıt"
        title="Davet geçersiz."
        deck={check.reason}
        footer={
          <>
            Zaten hesabın var mı?{" "}
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Giriş yap
            </Link>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Bu platform yalnızca davetle açıktır. Geçerli bir davet bağlantısı
            için koçunla iletişime geç.
          </p>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Giriş ekranına dön</Link>
          </Button>
        </div>
      </MemberCard>
    );
  }

  return (
    <MemberCard
      label="Yeni üye kaydı"
      title="Aramıza katıl."
      deck="Defterin hazırlanıyor."
      footer={
        <>
          Zaten hesabın var mı?{" "}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Giriş yap
          </Link>
        </>
      }
    >
      <p className="flex items-center gap-2 text-sm text-primary">
        <CheckCircle2 className="size-4" />
        Davetin geçerli{check.note ? ` · ${check.note}` : ""}
      </p>
      <div className="mt-4">
        <SignupForm token={token!} />
      </div>
    </MemberCard>
  );
}
