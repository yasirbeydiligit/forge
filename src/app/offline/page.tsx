import { WifiOff } from "lucide-react";

import { Brand } from "@/components/brand";

export const metadata = { title: "Çevrimdışı" };

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-6 text-center">
      <Brand />
      <div className="mt-4 flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <WifiOff className="size-7" />
      </div>
      <h1 className="text-xl font-semibold">Bağlantı yok</h1>
      <p className="max-w-xs text-sm text-muted-foreground">
        İnternet bağlantın kesildi. Bağlantın geri geldiğinde sayfayı yenile.
      </p>
    </div>
  );
}
