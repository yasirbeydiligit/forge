"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { createProtocol, updateProtocol, type FormState } from "./actions";
import {
  PROTOCOL_TIMING_LABEL_TR,
  PROTOCOL_TIMING_ORDER,
} from "@/lib/nutrition/protocols";
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
import type { ProtocolTemplate } from "@/lib/types";

/**
 * Create or edit a coach protocol template. `protocol` present => edit mode.
 */
export function ProtocolDialog({ protocol }: { protocol?: ProtocolTemplate }) {
  const editing = Boolean(protocol);
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<FormState, FormData>(
    editing ? updateProtocol : createProtocol,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(editing ? "Protokol güncellendi." : "Protokol oluşturuldu.");
      setOpen(false);
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, editing]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {editing ? (
          <button
            type="button"
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Protokolü düzenle"
          >
            <Pencil className="size-4" />
          </button>
        ) : (
          <Button size="sm">
            <Plus /> Protokol ekle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Protokolü düzenle" : "Protokol ekle"}
          </DialogTitle>
          <DialogDescription>
            Zamana bağlı takviye/uygulama protokolü. Örn. “Antrenman öncesi: 5g
            kreatin + 200mg kafein”.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {protocol ? (
            <input type="hidden" name="id" value={protocol.id} />
          ) : null}

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="space-y-2">
              <Label htmlFor="name">Ad</Label>
              <Input
                id="name"
                name="name"
                placeholder="Pre-Workout"
                required
                autoComplete="off"
                defaultValue={protocol?.name ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orderIndex">Sıra</Label>
              <Input
                id="orderIndex"
                name="orderIndex"
                type="number"
                min={0}
                className="w-20"
                defaultValue={protocol?.order_index ?? 0}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timing">Zaman</Label>
            <select
              id="timing"
              name="timing"
              defaultValue={protocol?.timing ?? "pre_workout"}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              {PROTOCOL_TIMING_ORDER.map((t) => (
                <option key={t} value={t}>
                  {PROTOCOL_TIMING_LABEL_TR[t]}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="instructions">Talimat</Label>
            <Textarea
              id="instructions"
              name="instructions"
              placeholder="5g kreatin + 200mg kafein"
              rows={2}
              defaultValue={protocol?.instructions ?? ""}
            />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? "Kaydediliyor…"
                : editing
                  ? "Kaydet"
                  : "Oluştur"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
