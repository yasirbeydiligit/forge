import type { Metadata } from "next";
import { Send, Trash2 } from "lucide-react";

import { deleteInvite } from "./actions";
import { CopyInviteButton, InviteCreateDialog } from "./invite-actions";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { PaperCard } from "@/components/lab/lab";
import { PageHeader } from "@/components/shell/page-header";
import { requireCoach } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Invite } from "@/lib/types";

export const metadata: Metadata = { title: "Davetler" };

function inviteStatus(invite: Invite) {
  if (invite.uses >= invite.max_uses)
    return { label: "Kullanıldı", active: false };
  if (invite.expires_at && new Date(invite.expires_at) < new Date())
    return { label: "Süresi doldu", active: false };
  return { label: "Aktif", active: true };
}

export default async function InvitesPage() {
  await requireCoach();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("invites")
    .select("*")
    .order("created_at", { ascending: false });

  const invites = (data ?? []) as Invite[];

  return (
    <div>
      <PageHeader
        title="Davetler"
        description="Bu platform yalnızca davetle açıktır. Davet bağlantısı üret ve paylaş."
      >
        <InviteCreateDialog />
      </PageHeader>

      {invites.length === 0 ? (
        <EmptyState
          icon={Send}
          title="Henüz davet yok"
          description="Yeni bir sporcuyu katmak için davet bağlantısı oluştur."
          action={<InviteCreateDialog />}
        />
      ) : (
        <div className="space-y-3">
          {invites.map((invite) => {
            const status = inviteStatus(invite);
            return (
              <PaperCard
                key={invite.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-serif text-lg text-paper-foreground">
                      {invite.note || "Davet bağlantısı"}
                    </p>
                    <span
                      className={`text-[11px] font-medium uppercase tracking-[0.14em] ${
                        status.active ? "text-lab-green" : "text-paper-muted"
                      }`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="font-mono text-xs tabular-nums text-paper-muted">
                    {invite.uses}/{invite.max_uses} kullanıldı ·{" "}
                    {invite.expires_at
                      ? `Son: ${formatDate(invite.expires_at)}`
                      : "Süresiz"}{" "}
                    · {formatDate(invite.created_at)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {status.active ? (
                    <CopyInviteButton token={invite.token} />
                  ) : null}
                  <ConfirmButton
                    action={deleteInvite}
                    fields={{ id: invite.id }}
                    title="Daveti sil"
                    description="Bu davet bağlantısı geçersiz olacak. Devam edilsin mi?"
                    triggerClassName="text-paper-muted hover:bg-paper-foreground/[0.06]"
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </ConfirmButton>
                </div>
              </PaperCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
