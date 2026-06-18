"use client";

import { useActionState } from "react";
import { AlertCircle, UserPlus } from "lucide-react";

import { signUpAction, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function SignupForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    signUpAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      <div className="space-y-2">
        <Label htmlFor="fullName">Ad soyad</Label>
        <Input
          id="fullName"
          name="fullName"
          autoComplete="name"
          placeholder="Adın ve soyadın"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="ornek@eposta.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Şifre</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          placeholder="En az 6 karakter"
          minLength={6}
          required
        />
      </div>

      {state?.error ? (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" size="lg" disabled={isPending}>
        <UserPlus />
        {isPending ? "Hesap oluşturuluyor…" : "Hesabı oluştur ve katıl"}
      </Button>
    </form>
  );
}
