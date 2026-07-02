"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { saveCardio, type FormState } from "./actions";
import { SubmitButton } from "@/components/submit-button";
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
import { CARDIO_ACTIVITIES, type CardioActivityKey } from "@/lib/cardio";
import { toDateKey } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Lightweight cardio entry — deliberately simpler than workout logging. */
export function CardioDialog() {
  const [open, setOpen] = useState(false);
  const [activity, setActivity] = useState<CardioActivityKey>("walk");
  const [state, formAction] = useActionState<FormState, FormData>(
    saveCardio,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Kardiyo eklendi.");
      setOpen(false);
    } else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-4" /> Kardiyo ekle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kardiyo ekle</DialogTitle>
          <DialogDescription>
            Serbest bir kayıt: “30 dk yüzme” yeter, gerisi opsiyonel.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="activity" value={activity} />

          <div className="grid grid-cols-3 gap-2">
            {CARDIO_ACTIVITIES.map((a) => {
              const Icon = a.icon;
              const active = activity === a.key;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => setActivity(a.key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-medium transition-colors",
                    active
                      ? "border-lab-green/40 bg-lab-green/10 text-lab-green"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="size-5" />
                  {a.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cardio-date">Tarih</Label>
              <Input
                id="cardio-date"
                name="date"
                type="date"
                defaultValue={toDateKey(new Date())}
                required
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cardio-duration">Süre (dk)</Label>
              <Input
                id="cardio-duration"
                name="durationMin"
                inputMode="numeric"
                placeholder="30"
                required
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cardio-distance">Mesafe (km)</Label>
              <Input
                id="cardio-distance"
                name="distanceKm"
                inputMode="decimal"
                placeholder="opsiyonel"
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cardio-calories">Kalori</Label>
              <Input
                id="cardio-calories"
                name="calories"
                inputMode="numeric"
                placeholder="opsiyonel"
                className="font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cardio-note">Not</Label>
            <Input
              id="cardio-note"
              name="note"
              placeholder="opsiyonel"
              maxLength={140}
            />
          </div>

          <DialogFooter>
            <SubmitButton>Kaydet</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
