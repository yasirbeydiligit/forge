"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { createExercise, updateExercise, type FormState } from "./actions";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { EXERCISE_CATEGORIES } from "@/lib/constants";
import type { Exercise } from "@/lib/types";

const NONE = "__none__";

export function ExerciseDialog({
  exercise,
  trigger,
}: {
  exercise?: Exercise;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(exercise);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(exercise?.category ?? NONE);
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    isEdit ? updateExercise : createExercise,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(isEdit ? "Egzersiz güncellendi." : "Egzersiz eklendi.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, isEdit]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> Yeni egzersiz
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Egzersizi düzenle" : "Yeni egzersiz"}</DialogTitle>
          <DialogDescription>
            Kütüphanedeki egzersizleri programlarında tekrar kullanabilirsin.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {isEdit ? <input type="hidden" name="id" value={exercise!.id} /> : null}
          <input
            type="hidden"
            name="category"
            value={category === NONE ? "" : category}
          />

          <div className="space-y-2">
            <Label htmlFor="name">Egzersiz adı</Label>
            <Input
              id="name"
              name="name"
              defaultValue={exercise?.name}
              placeholder="Örn. Barbell Squat"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Kategori</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Kategori seç" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Kategori yok</SelectItem>
                {EXERCISE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Açıklama / teknik notu</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={exercise?.description ?? ""}
              placeholder="Kısa teknik açıklaması (opsiyonel)"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="videoUrl">Video bağlantısı</Label>
            <Input
              id="videoUrl"
              name="videoUrl"
              type="url"
              defaultValue={exercise?.video_url ?? ""}
              placeholder="https://… (opsiyonel)"
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
