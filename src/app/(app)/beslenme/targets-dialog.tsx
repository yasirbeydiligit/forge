"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { saveTargets, type FormState } from "./actions";
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
import type { NutritionTarget } from "@/lib/types";

export function TargetsDialog({ target }: { target: NutritionTarget | null }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    saveTargets,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Hedefler güncellendi.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Pencil className="size-4" /> Hedefler
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Günlük hedefler</DialogTitle>
          <DialogDescription>
            Günlük kalori ve makro hedeflerini belirle.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="t-kcal">Kalori (kcal)</Label>
            <Input
              id="t-kcal"
              name="kcal"
              type="number"
              min={0}
              defaultValue={target?.kcal ?? ""}
              placeholder="2400"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="t-protein">Protein (g)</Label>
              <Input
                id="t-protein"
                name="protein"
                type="number"
                min={0}
                defaultValue={target?.protein ?? ""}
                placeholder="150"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-carbs">Karb (g)</Label>
              <Input
                id="t-carbs"
                name="carbs"
                type="number"
                min={0}
                defaultValue={target?.carbs ?? ""}
                placeholder="280"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="t-fat">Yağ (g)</Label>
              <Input
                id="t-fat"
                name="fat"
                type="number"
                min={0}
                defaultValue={target?.fat ?? ""}
                placeholder="75"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="t-water">Su hedefi (ml)</Label>
            <Input
              id="t-water"
              name="waterMl"
              type="number"
              min={0}
              step={250}
              defaultValue={target?.water_ml ?? ""}
              placeholder="3000"
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
