"use client";

import { useActionState, useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";

import { assignToCalendar, type FormState } from "./actions";
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

/**
 * Athlete-only: schedule one of this program's workout days onto their own
 * calendar. Writes a personal calendar_assignment (athlete_id = created_by =
 * self) which the existing bugun/takvim/antrenman pipeline picks up unchanged.
 */
export function AssignCalendarDialog({
  programId,
  workouts,
}: {
  programId: string;
  workouts: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [workoutId, setWorkoutId] = useState("");
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    assignToCalendar,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Antrenman takvimine eklendi.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={workouts.length === 0}>
          <CalendarPlus className="size-4" /> Takvime ata
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Takvime ata</DialogTitle>
          <DialogDescription>
            Bir antrenman gününü seç ve takvimine ekle.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="programId" value={programId} />
          <input type="hidden" name="workoutId" value={workoutId} />

          <div className="space-y-2">
            <Label>Antrenman günü</Label>
            <Select value={workoutId} onValueChange={setWorkoutId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Antrenman seç" />
              </SelectTrigger>
              <SelectContent>
                {workouts.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scheduledDate">Tarih</Label>
            <Input id="scheduledDate" name="scheduledDate" type="date" required />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending || !workoutId}>
              {isPending ? "Ekleniyor…" : "Takvime ekle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
