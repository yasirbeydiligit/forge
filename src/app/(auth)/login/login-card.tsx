import { MemberCard } from "@/app/(auth)/member-card";

import { LoginForm } from "./login-form";

/** Login as the journal's membership card. */
export function LoginCard({ redirectTo }: { redirectTo?: string }) {
  return (
    <MemberCard
      label="Üye girişi"
      title="Tekrar hoş geldin."
      deck="Defterin seni bekliyor."
      footer={
        <>
          Hesabın yok mu? Katılmak için koçundan bir{" "}
          <span className="font-medium text-foreground">davet bağlantısı</span>{" "}
          iste.
        </>
      }
    >
      <LoginForm redirectTo={redirectTo} />
    </MemberCard>
  );
}
