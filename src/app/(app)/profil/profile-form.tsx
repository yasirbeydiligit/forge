"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";

import { updateProfile, type FormState } from "./actions";
import { ImageUpload } from "@/components/image-upload";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Profile } from "@/lib/auth";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState<FormState, FormData>(
    updateProfile,
    {},
  );

  useEffect(() => {
    if (state.ok) toast.success("Profil güncellendi.");
    else if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-2">
        <Label>Profil fotoğrafı</Label>
        <div className="max-w-40">
          <ImageUpload
            name="avatarUrl"
            defaultValue={profile.avatar_url ?? ""}
            aspect="square"
            label="Fotoğraf ekle"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="fullName">Ad soyad</Label>
        <Input
          id="fullName"
          name="fullName"
          defaultValue={profile.full_name}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="username">Kullanıcı adı</Label>
        <div className="flex items-center gap-2">
          <span className="font-mono text-sm text-muted-foreground">@</span>
          <Input
            id="username"
            name="username"
            defaultValue={profile.username ?? ""}
            placeholder="kullanici_adi"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={20}
            className="font-mono lowercase"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          3–20 karakter; küçük harf, rakam ve alt çizgi. Boş bırakılabilir.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">E-posta</Label>
        <Input id="email" value={profile.email ?? ""} disabled readOnly />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bio">Hakkında</Label>
        <Textarea
          id="bio"
          name="bio"
          defaultValue={profile.bio ?? ""}
          placeholder="Kısa bir tanıtım (opsiyonel)"
          rows={3}
          maxLength={280}
        />
      </div>

      <SubmitButton>Kaydet</SubmitButton>
    </form>
  );
}
