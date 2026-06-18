"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Copy, Link2, Plus } from "lucide-react";
import { toast } from "sonner";

import { createInvite, type InviteFormState } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function inviteUrl(token: string) {
  const origin =
    typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/kayit?token=${token}`;
}

export function CopyInviteButton({
  token,
  variant = "outline",
  size = "sm",
  label = "Bağlantıyı kopyala",
}: {
  token: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl(token));
      setCopied(true);
      toast.success("Davet bağlantısı kopyalandı.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Kopyalanamadı.");
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={copy}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {label}
    </Button>
  );
}

export function InviteCreateDialog() {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<InviteFormState, FormData>(
    createInvite,
    {},
  );

  useEffect(() => {
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus /> Davet oluştur
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni davet</DialogTitle>
          <DialogDescription>
            Tek kullanımlık ya da süreli bir davet bağlantısı üret.
          </DialogDescription>
        </DialogHeader>

        {state.ok && state.token ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-primary">
                <Link2 className="size-4" /> Davet hazır
              </p>
              <p className="mt-1 break-all text-xs text-muted-foreground">
                {inviteUrl(state.token)}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <CopyInviteButton token={state.token} size="default" />
              <Button variant="outline" onClick={() => setOpen(false)}>
                Kapat
              </Button>
            </div>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="note">Etiket / not</Label>
              <Input
                id="note"
                name="note"
                placeholder="Örn. Ahmet için (opsiyonel)"
                maxLength={80}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="maxUses">Kullanım hakkı</Label>
                <Input
                  id="maxUses"
                  name="maxUses"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={1}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="expiresInDays">Süre (gün)</Label>
                <Input
                  id="expiresInDays"
                  name="expiresInDays"
                  type="number"
                  min={1}
                  max={365}
                  placeholder="Süresiz"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Oluşturuluyor…" : "Oluştur"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
