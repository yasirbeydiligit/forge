/**
 * Instant navigation fallback for every (app) page. The App Router shows this
 * the moment a link is clicked, so navigation feels immediate while the server
 * renders the real page — which currently pays a few cross-region Supabase
 * round-trips per request. One shared, neutral skeleton (max-w matches LabPage)
 * covers all screens; add a closer-matching loading.tsx beside a specific page
 * later if its shape warrants it.
 */
export default function AppLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <span role="status" className="sr-only">
        Yükleniyor…
      </span>
      <div className="animate-pulse" aria-hidden>
        <div className="mb-8 space-y-3">
          <div className="h-3 w-24 rounded bg-muted" />
          <div className="h-9 w-2/3 rounded bg-muted" />
          <div className="h-4 w-1/2 rounded bg-muted/70" />
        </div>
        <div className="space-y-4">
          <div className="h-28 rounded-xl border border-border bg-card" />
          <div className="h-28 rounded-xl border border-border bg-card" />
          <div className="h-28 rounded-xl border border-border bg-card" />
        </div>
      </div>
    </div>
  );
}
