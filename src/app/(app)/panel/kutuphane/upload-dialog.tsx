"use client";

import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import { uploadLibraryDocument } from "./actions";
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
import { useRouter } from "next/navigation";

const SOURCE_TYPES = [
  { value: "paper", label: "Makale" },
  { value: "book", label: "Kitap" },
  { value: "handout", label: "Ders notu" },
] as const;

export function UploadDialog({ trigger }: { trigger?: React.ReactNode }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [sourceType, setSourceType] = useState<string>("paper");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const formData = new FormData(event.currentTarget);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      toast.error("PDF dosyası seçin.");
      return;
    }

    setPending(true);
    try {
      const result = await uploadLibraryDocument(formData);
      if (result.ok) {
        toast.success("Belge eklendi ve kütüphaneye işlendi.");
        formRef.current?.reset();
        setSourceType("paper");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(result.error ?? "Belge yüklenemedi.");
      }
    } catch {
      toast.error("Belge yüklenemedi. Tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Don't let the dialog close mid-ingest.
        if (pending) return;
        setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Upload /> Belge yükle
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni belge yükle</DialogTitle>
          <DialogDescription>
            Bir PDF yükle; başlık ve kaynak bilgilerini gir. Belge ayrıştırılıp
            gömülerek kütüphaneye eklenir.
          </DialogDescription>
        </DialogHeader>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Başlık</Label>
            <Input
              id="title"
              name="title"
              placeholder="Örn. Resistance Training Volume and Hypertrophy"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="authors">Yazarlar</Label>
              <Input
                id="authors"
                name="authors"
                placeholder="A. Author, B. Author"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year">Yıl</Label>
              <Input
                id="year"
                name="year"
                type="number"
                inputMode="numeric"
                placeholder="2024"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tür</Label>
              <input type="hidden" name="source_type" value={sourceType} />
              <Select value={sourceType} onValueChange={setSourceType}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Tür seç" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="license">Lisans</Label>
              <Input id="license" name="license" placeholder="CC-BY (opsiyonel)" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="source_url">Kaynak bağlantısı</Label>
            <Input
              id="source_url"
              name="source_url"
              type="url"
              placeholder="https://… (opsiyonel)"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doi">DOI</Label>
            <Input id="doi" name="doi" placeholder="10.1000/xyz123 (opsiyonel)" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">PDF dosyası</Label>
            <Input
              id="file"
              name="file"
              type="file"
              accept="application/pdf"
              required
            />
          </div>

          {pending ? (
            <p className="flex items-center gap-2 rounded-lg border border-paper-border bg-paper-foreground/[0.04] px-3 py-2 text-sm text-paper-muted">
              <Loader2 className="size-4 animate-spin" />
              İşleniyor… ayrıştırılıyor ve gömülüyor
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "İşleniyor…" : "Yükle ve işle"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
