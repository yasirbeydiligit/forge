import type { Metadata } from "next";
import { Archive, ArchiveRestore, FlaskConical, Trash2 } from "lucide-react";

import { deleteProtocol, setProtocolActive } from "./actions";
import { ProtocolDialog } from "./protocol-dialog";
import { Badge } from "@/components/ui/badge";
import { requireCoach } from "@/lib/auth";
import {
  PROTOCOL_TIMING_LABEL_TR,
  sortByTiming,
  type ProtocolTiming,
} from "@/lib/nutrition/protocols";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ProtocolTemplate } from "@/lib/types";

export const metadata: Metadata = { title: "Protokoller" };

export default async function ProtocolsPage() {
  await requireCoach();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("protocol_templates")
    .select("*")
    .order("order_index", { ascending: true });
  const protocols = sortByTiming((data ?? []) as ProtocolTemplate[]);

  const active = protocols.filter((p) => p.is_active);
  const archived = protocols.filter((p) => !p.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <FlaskConical className="size-6" /> Protokoller
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Zamana bağlı takviye/uygulama protokolleri. Sporculara tek tek
            atanır; sporcu beslenme sayfasında günlük olarak işaretler.
          </p>
        </div>
        <ProtocolDialog />
      </div>

      {protocols.length === 0 ? (
        <p className="rounded-xl border border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
          Henüz protokol yok. “Protokol ekle” ile başla.
        </p>
      ) : (
        <div className="space-y-6">
          <ProtocolList protocols={active} />
          {archived.length > 0 ? (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Arşiv
              </h2>
              <ProtocolList protocols={archived} archived />
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}

function ProtocolList({
  protocols,
  archived = false,
}: {
  protocols: ProtocolTemplate[];
  archived?: boolean;
}) {
  return (
    <div className="space-y-2">
      {protocols.map((p) => (
        <div
          key={p.id}
          className="flex items-start gap-3 rounded-xl border border-border p-4"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-foreground">{p.name}</span>
              <Badge variant="secondary" className="rounded-full text-[11px]">
                {PROTOCOL_TIMING_LABEL_TR[p.timing as ProtocolTiming] ??
                  p.timing}
              </Badge>
            </div>
            {p.instructions ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {p.instructions}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {!archived ? <ProtocolDialog protocol={p} /> : null}
            <form action={setProtocolActive}>
              <input type="hidden" name="id" value={p.id} />
              <input
                type="hidden"
                name="active"
                value={archived ? "1" : "0"}
              />
              <button
                type="submit"
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label={archived ? "Arşivden çıkar" : "Arşivle"}
              >
                {archived ? (
                  <ArchiveRestore className="size-4" />
                ) : (
                  <Archive className="size-4" />
                )}
              </button>
            </form>
            <form action={deleteProtocol}>
              <input type="hidden" name="id" value={p.id} />
              <button
                type="submit"
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label="Protokolü sil"
              >
                <Trash2 className="size-4" />
              </button>
            </form>
          </div>
        </div>
      ))}
    </div>
  );
}
