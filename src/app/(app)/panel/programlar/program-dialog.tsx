"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createProgram, updateProgram, type FormState } from "./actions";
import { ImageUpload } from "@/components/image-upload";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { Program } from "@/lib/types";

export function ProgramDialog({
  program,
  trigger,
}: {
  program?: Program;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(program);
  const [open, setOpen] = useState(false);
  const [published, setPublished] = useState(program?.is_published ?? true);
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    isEdit ? updateProgram : createProgram,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Program güncellendi.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Yeni program
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Programı düzenle" : "Yeni program"}</DialogTitle>
          <DialogDescription>
            Programın temel bilgilerini gir. Antrenman günlerini sonra
            ekleyeceksin.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {isEdit ? <input type="hidden" name="id" value={program!.id} /> : null}
          <input
            type="hidden"
            name="isPublished"
            value={published ? "true" : "false"}
          />

          <div className="space-y-2">
            <Label htmlFor="name">Program adı</Label>
            <Input
              id="name"
              name="name"
              defaultValue={program?.name}
              placeholder="Örn. 12 Haftalık Güç"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Açıklama</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={program?.description ?? ""}
              placeholder="Programın amacı ve kime uygun olduğu"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Kapak görseli</Label>
            <ImageUpload name="coverUrl" defaultValue={program?.cover_url ?? ""} />
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="published">Yayında</Label>
              <p className="text-xs text-muted-foreground">
                Sporcular yalnızca yayındaki programlara kaydolabilir.
              </p>
            </div>
            <Switch
              id="published"
              checked={published}
              onCheckedChange={setPublished}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Kaydediliyor…" : isEdit ? "Kaydet" : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
