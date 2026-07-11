/**
 * Gazete nav signal: how many issues feel "new" to the athlete right now —
 * unread printed issues plus closed-but-unprinted periods (which will print
 * the moment /gazete is opened). Wrapped in React cache() so the app layout
 * (nav badge) and the Bugün discovery card share one computation per request.
 *
 * The unprinted half is an upper bound: duePeriods can't know a period is
 * empty without loading it. Printing skips empty periods, so the count
 * self-corrects on the first visit — an accepted approximation for a badge.
 */
import { cache } from "react";

import { toDateKey } from "@/lib/format";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { duePeriods } from "./periods";
import { loadJourneyStart } from "./loader";

export const loadGazeteSignal = cache(
  async (athleteId: string): Promise<{ newCount: number }> => {
    const supabase = await createSupabaseServerClient();

    const [{ count: unread }, { data: printedRows }, journeyStart] =
      await Promise.all([
        supabase
          .from("report_issues")
          .select("id", { count: "exact", head: true })
          .eq("athlete_id", athleteId)
          .is("read_at", null),
        supabase
          .from("report_issues")
          .select("period_type, period_end")
          .eq("athlete_id", athleteId),
        loadJourneyStart(supabase, athleteId),
      ]);

    let pending = 0;
    if (journeyStart) {
      const printed = new Set(
        (printedRows ?? []).map((r) => `${r.period_type}:${r.period_end}`),
      );
      pending = duePeriods(journeyStart, toDateKey(new Date()), printed).length;
    }

    return { newCount: (unread ?? 0) + pending };
  },
);
