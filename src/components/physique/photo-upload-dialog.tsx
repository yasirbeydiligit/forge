"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { addPhysiquePhoto, type FormState } from "@/app/(app)/fizik/actions";
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
import { toDateKey } from "@/lib/format";
import { PHYSIQUE_BUCKET } from "@/lib/physique";

const ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Physique photo entry. Unlike `ImageUpload` this targets the PRIVATE bucket:
 * the file goes to `{uid}/{uuid}.{ext}` on submit (never a public URL) and the
 * metadata row is written by the server action afterwards.
 */
export function PhotoUploadDialog({
  todayWeight,
}: {
  /** Today's tracked weight (placeholder prefill), if the athlete logged one. */
  todayWeight?: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const pathRef = useRef<HTMLInputElement>(null);
  const [state, formAction] = useActionState<FormState, FormData>(
    addPhysiquePhoto,
    {},
  );

  useEffect(() => {
    if (state.ok) {
      toast.success("Fotoğraf eklendi.");
      reset();
      setOpen(false);
    } else if (state.error) toast.error(state.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function reset() {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  }

  function pick(f: File) {
    if (!ACCEPT.split(",").includes(f.type)) {
      toast.error("JPEG, PNG veya WebP seçin.");
      return;
    }
    if (f.size > MAX_BYTES) {
      toast.error("Fotoğraf 10MB'tan küçük olmalı.");
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  /** Upload to the private bucket first, then submit the metadata form. */
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!file) return; // hidden path input stays empty → action rejects
    if (pathRef.current?.value) return; // path already set → let it submit
    e.preventDefault();
    setUploading(true);
    try {
      const { createSupabaseBrowserClient } = await import(
        "@/lib/supabase/client"
      );
      const supabase = createSupabaseBrowserClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("no-user");

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage
        .from(PHYSIQUE_BUCKET)
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (error) throw error;

      if (pathRef.current) pathRef.current.value = path;
      formRef.current?.requestSubmit();
    } catch {
      toast.error("Fotoğraf yüklenemedi. Tekrar deneyin.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Camera className="size-4" /> Fotoğraf ekle
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fizik fotoğrafı</DialogTitle>
          <DialogDescription>
            Yalnız sen ve koçun görebilir. Aynı ışık ve poz, kıyası kolaylaştırır.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} action={formAction} onSubmit={handleSubmit} className="space-y-4">
          <input ref={pathRef} type="hidden" name="storagePath" value="" />

          {preview ? (
            <div className="relative overflow-hidden rounded-xl border border-border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Önizleme"
                className="aspect-[3/4] w-full object-cover"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="absolute right-2 top-2"
                onClick={() => {
                  reset();
                  if (pathRef.current) pathRef.current.value = "";
                }}
              >
                Değiştir
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/40 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
            >
              <Camera className="size-6" />
              Fotoğraf seç veya çek
              <span className="text-xs">JPEG · PNG · WebP, en çok 10MB</span>
            </button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT}
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) pick(f);
              e.target.value = "";
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="physique-date">Tarih</Label>
              <Input
                id="physique-date"
                name="photoDate"
                type="date"
                defaultValue={toDateKey(new Date())}
                required
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="physique-weight">Kilo (kg)</Label>
              <Input
                id="physique-weight"
                name="weightKg"
                inputMode="decimal"
                placeholder={todayWeight != null ? String(todayWeight) : "opsiyonel"}
                className="font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="physique-note">Not</Label>
            <Input
              id="physique-note"
              name="note"
              placeholder="opsiyonel — ör. sabah aç karnına"
              maxLength={280}
            />
          </div>

          <DialogFooter>
            <SubmitButton disabled={!file || uploading}>
              {uploading ? (
                <>
                  <Loader2 className="animate-spin" /> Yükleniyor…
                </>
              ) : (
                "Kaydet"
              )}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
