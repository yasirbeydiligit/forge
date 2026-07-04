"use client";

import { useActionState } from "react";
import { AlertCircle, LogIn } from "lucide-react";

import { signInAction, type AuthState } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm({ redirectTo }: { redirectTo?: string }) {
  const [state, formAction, isPending] = useActionState<AuthState, FormData>(
    signInAction,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4">
      {redirectTo ? (
        <input type="hidden" name="redirectTo" value={redirectTo} />
      ) : null}

      {/* Printed-form fields: tracked mono labels over a bottom hairline that
          inks to the primary green on focus. */}
      <div className="space-y-2">
        <Label htmlFor="email" className="text-[0.6875rem] font-medium tracking-[0.16em] uppercase text-muted-foreground">
          E-posta
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="ornek@eposta.com"
          required
          className="rounded-none border-0 border-b border-input bg-transparent px-0 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password" className="text-[0.6875rem] font-medium tracking-[0.16em] uppercase text-muted-foreground">
          Şifre
        </Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          className="rounded-none border-0 border-b border-input bg-transparent px-0 shadow-none focus-visible:border-b-2 focus-visible:border-primary focus-visible:ring-0"
        />
      </div>

      {state?.error ? (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="size-4" />
          {state.error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" size="lg" disabled={isPending}>
        <LogIn />
        {isPending ? "Giriş yapılıyor…" : "Giriş yap"}
      </Button>
    </form>
  );
}
