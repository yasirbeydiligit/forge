"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { updateMealTemplate, type FormState } from "../actions";
import { MealFields } from "../meal-form";
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
import type { MealTemplate } from "@/lib/types";

export function TemplateEditDialog({ template }: { template: MealTemplate }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    updateMealTemplate,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Hazır öğün güncellendi.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="text-paper-muted transition-colors hover:text-paper-foreground"
          aria-label="Hazır öğünü düzenle"
        >
          <Pencil className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Hazır öğünü düzenle</DialogTitle>
          <DialogDescription>
            Ad ve makroları güncelle. kcal makrolardan otomatik hesaplanır,
            istersen elle düzeltebilirsin.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="id" value={template.id} />
          <MealFields initial={template} showTime={false} />
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
