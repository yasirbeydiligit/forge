"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import type { FormAction } from "./types";
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
import { Textarea } from "@/components/ui/textarea";
import type { Workout } from "@/lib/types";

/** Shared workout-day create/edit dialog. */
export function WorkoutDialog({
  create,
  update,
  programId,
  workout,
  trigger,
}: {
  create: FormAction;
  update: FormAction;
  programId: string;
  workout?: Workout;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(workout);
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(
    isEdit ? update : create,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(isEdit ? "Antrenman güncellendi." : "Antrenman eklendi.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, isEdit]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Plus /> Antrenman günü ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Antrenmanı düzenle" : "Yeni antrenman günü"}
          </DialogTitle>
          <DialogDescription>
            Örn. &quot;Gün A — İtiş&quot; veya &quot;Bacak Günü&quot;.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="programId" value={programId} />
          {isEdit ? <input type="hidden" name="id" value={workout!.id} /> : null}

          <div className="space-y-2">
            <Label htmlFor="w-name">Antrenman adı</Label>
            <Input
              id="w-name"
              name="name"
              defaultValue={workout?.name}
              placeholder="Gün A — İtiş"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="w-notes">Not</Label>
            <Textarea
              id="w-notes"
              name="notes"
              defaultValue={workout?.notes ?? ""}
              placeholder="Genel ısınma, tempo notu vb. (opsiyonel)"
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
