"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { addMeal, type FormState } from "./actions";
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

export function MealDialog({ date }: { date: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    addMeal,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Öğün eklendi.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Öğün ekle
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Öğün ekle</DialogTitle>
          <DialogDescription>
            Yediklerini ve makrolarını gir. Bilmediğin değerleri boş bırakabilirsin.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="date" value={date} />

          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <div className="space-y-2">
              <Label htmlFor="name">Öğün</Label>
              <Input
                id="name"
                name="name"
                placeholder="Kahvaltı"
                required
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eatenAt">Saat</Label>
              <Input id="eatenAt" name="eatenAt" type="time" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Yiyecekler</Label>
            <Textarea
              id="description"
              name="description"
              placeholder="3 yumurta · 80g yulaf · muz · kahve"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-2">
              <Label htmlFor="kcal">kcal</Label>
              <Input id="kcal" name="kcal" type="number" min={0} placeholder="620" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="protein">Pro</Label>
              <Input id="protein" name="protein" type="number" min={0} placeholder="38" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carbs">Karb</Label>
              <Input id="carbs" name="carbs" type="number" min={0} placeholder="62" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fat">Yağ</Label>
              <Input id="fat" name="fat" type="number" min={0} placeholder="18" />
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Ekleniyor…" : "Ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
