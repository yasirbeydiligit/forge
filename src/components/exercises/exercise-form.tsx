"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import {
  MuscleTargetPicker,
  type PickerFunction,
  type PickerMuscle,
} from "./muscle-target-picker";
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
import type { ExerciseTargetInput } from "@/lib/exercise-targets";
import {
  EQUIPMENT_TYPES,
  EQUIPMENT_TYPE_LABELS_TR,
  MOVEMENT_PATTERNS,
  MOVEMENT_PATTERN_LABELS_TR,
} from "@/lib/taxonomy";
import type { Exercise } from "@/lib/types";

/** Structurally matches the FormState exported by the create/update actions. */
export type ExerciseFormState = { ok?: boolean; error?: string };
type Action = (
  prev: ExerciseFormState,
  formData: FormData,
) => Promise<ExerciseFormState>;

const NONE = "__none__";

/**
 * Shared rich exercise form (taxonomy + muscle/function targets), used by both
 * the coach library (/panel/egzersizler) and the athlete library
 * (/egzersizlerim). The owning page supplies role-appropriate create/update
 * actions; the action decides is_system / created_by and writes the targets.
 */
export function ExerciseForm({
  create,
  update,
  muscles,
  functions,
  exercise,
  initialTargets = [],
  trigger,
}: {
  create: Action;
  update: Action;
  muscles: PickerMuscle[];
  functions: PickerFunction[];
  exercise?: Exercise;
  initialTargets?: ExerciseTargetInput[];
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(exercise);
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState(exercise?.category ?? NONE);
  const [pattern, setPattern] = useState(exercise?.movement_pattern ?? NONE);
  const [equipment, setEquipment] = useState(exercise?.equipment_type ?? NONE);
  const [state, formAction, isPending] = useActionState<
    ExerciseFormState,
    FormData
  >(isEdit ? update : create, {});

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Egzersizi düzenle" : "Yeni egzersiz"}
          </DialogTitle>
          <DialogDescription>
            Hareket paterni, ekipman ve hedef kasları seç; raporlar ve muadil
            önerisi bu bilgilere göre çalışır.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {isEdit ? <input type="hidden" name="id" value={exercise!.id} /> : null}
          <input
            type="hidden"
            name="category"
            value={category === NONE ? "" : category}
          />
          <input
            type="hidden"
            name="movementPattern"
            value={pattern === NONE ? "" : pattern}
          />
          <input
            type="hidden"
            name="equipmentType"
            value={equipment === NONE ? "" : equipment}
          />

          <div className="space-y-2">
            <Label htmlFor="name">Egzersiz adı</Label>
            <Input
              id="name"
              name="name"
              defaultValue={exercise?.name}
              placeholder="Örn. Eğimli Dumbbell Press"
              required
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Hareket paterni</Label>
              <Select value={pattern} onValueChange={setPattern}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seç" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Belirtilmedi</SelectItem>
                  {MOVEMENT_PATTERNS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {MOVEMENT_PATTERN_LABELS_TR[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ekipman</Label>
              <Select value={equipment} onValueChange={setEquipment}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seç" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Belirtilmedi</SelectItem>
                  {EQUIPMENT_TYPES.map((e) => (
                    <SelectItem key={e} value={e}>
                      {EQUIPMENT_TYPE_LABELS_TR[e]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
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
              <Label htmlFor="region">Bölge (opsiyonel)</Label>
              <Input
                id="region"
                name="region"
                defaultValue={exercise?.region ?? ""}
                placeholder="Örn. Üst Göğüs"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Hedef kaslar</Label>
            <MuscleTargetPicker
              muscles={muscles}
              functions={functions}
              initialTargets={initialTargets}
            />
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
