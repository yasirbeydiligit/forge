# Koç Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Management-by-exception koç dashboard'u: triyaj board'u (skor-sıralı sporcu kartları), iki kategori uyarı (uyum/performans), sekmeli sporcu detayı, uygulama-içi rozet + günlük özet, hızlı-dokunuş feed mesajı.

**Architecture:** Uyarılar DB'ye yazılmaz; her yüklemede `src/lib/triage/` altındaki saf, vitest'li fonksiyonlarla türetilir. Tek kalıcı durum `alert_dismissals` (görüldü işareti, fingerprint'li). Toplu loader sporcu sayısından bağımsız ~9 sorgu atar ve React `cache()` ile layout+page arasında paylaşılır. Detay: `docs/plans/2026-07-03-coach-dashboard-design.md`.

**Tech Stack:** Next 15 (RSC + server actions), Supabase (RLS, MCP ile migration), Drizzle (şema), vitest, GSAP (yalnız panel animasyonları), Tailwind 4 + Forge lab tokenları.

---

### Task 1: GSAP bağımlılığı

1. `npm install gsap`
2. `git add package.json package-lock.json && git commit -m "chore: add gsap for panel animations"`

### Task 2: Triage tipleri + config

**Files:** Create `src/lib/triage/types.ts`, `src/lib/triage/config.ts`

`types.ts` — motorun sözlüğü:

```ts
export type AlertCategory = "adherence" | "performance";
export type AlertDimension = "training" | "nutrition" | "tracking" | "protocol";
export type AlertSeverity = "warning" | "critical";

export type TriageAlert = {
  key: string;              // stable slug, e.g. "workout_gap"
  category: AlertCategory;
  dimension: AlertDimension;
  severity: AlertSeverity;
  titleTr: string;
  detailTr: string;
  /** Identifies the alert's data period; a new period => a fresh alert. */
  fingerprint: string;
  /** Athlete-detail tab this alert belongs to. */
  tab: "antrenman" | "beslenme" | "takip";
};

export type TriageInput = {
  athleteId: string;
  fullName: string;
  avatarUrl: string | null;
  joinedAt: string;                    // profiles.created_at (ISO)
  goal: "muscle_gain" | "strength" | "fat_loss" | "maintenance" | null;
  weeklyTargetDays: number | null;
  sessionDates: string[];              // last 35d, any log_sessions
  plateauStats: Record<string, { exerciseName: string; stats: PlateauSessionStat[] }>;
  mealDays: { date: string; protein: number }[];  // last 14d, per-day sums
  proteinTarget: number | null;
  metricDays: { date: string; weight: number | null }[]; // last 28d
  protocolAssigned: number;
  protocolCompletions: { date: string }[];        // last 7d, per (protocol,day)
  rirSessions: { date: string; avgRir: number; setCount: number }[]; // last sessions with RIR
};

export type TriageResult = {
  athleteId: string; fullName: string; avatarUrl: string | null;
  score: number; band: "green" | "amber" | "red";
  alerts: TriageAlert[];               // open (non-dismissed) only
  adherenceCount: number; performanceCount: number;
  lastActivity: string | null;         // ISO date of any latest input
};
```

`config.ts` — tüm eşikler + cezalar tek objede (`DEFAULT_TRIAGE_CONFIG`),
tasarım dokümanındaki varsayılanlarla. Commit.

### Task 3: Uyum (adherence) dedektörleri — TDD

**Files:** Create `src/lib/triage/alerts.ts`, `src/lib/triage/alerts.test.ts`

Senaryolar (her biri önce kırmızı test):
- `workout_gap`: 3 gün boşluk → warning; 7+ → critical; hiç seans yok + hesap ≥3 gün → critical "hiç giriş yok"; hesap 1 günlük → uyarı yok; dün seans → yok.
- `meal_gap`: dün+önceki gün öğün yok → warning (bugün loglamamak sayılmaz); 5+ gün → critical; dün öğün var → yok.
- `checkin_gap`: 3 gün metrik yok → warning; 7+ → critical.
- `protocol_low`: 2 atama × 7 gün = 14 beklenen, 7 tamamlama (0.5) → warning; 3 (0.21) → critical; atama yoksa → yok; oran 0.6+ → yok.
- Fingerprint: workout_gap fingerprint'i son seans tarihi ("never" dahil) — testte assert.

Run `npx vitest run src/lib/triage` → fail → implement → pass → commit.

### Task 4: Performans dedektörleri — TDD

Aynı dosyalara devam:
- `protein_low`: hedef 180, son 3 loglu gün 150/155/140 → warning (3 gün, %10 açığın altı); araya loglanmamış gün girse de "loglu günler" streak'i sayılır; 2 loglu gün → yok; hedef yok → yok.
- `plateau`: `detectPlateau` stalled olan 2 egzersiz → tek alert, detayda isimler; stalled yok → yok. (Faz 2 fonksiyonu import edilir, yeniden yazılmaz.)
- `weight_trend`: goal=fat_loss, haftalık ort. +0.4/+0.5 kg iki hafta → warning; goal=muscle_gain düşüş → warning; maintenance/strength → yok; tek hafta → yok.
- `rir_extreme`: son 3 seans avgRir 4.0/3.8/3.6 (≥6 set) → warning "çok temkinli"; 0.2/0.3/0.0 → warning "sürekli sınırda"; 2 seans → yok.

Fail → implement → pass → commit.

### Task 5: Skor + bant + sıralama — TDD

**Files:** Create `src/lib/triage/score.ts`, `src/lib/triage/score.test.ts`

- Ceza tablosu configten; clamp 0–100; bant: critical→red, warning→amber, yok→green.
- `filterDismissed(alerts, dismissals)`: (key, fingerprint) eşleşmesi düşer; farklı fingerprint kalır.
- `sortTriage(results)`: skor artan; eşitlikte lastActivity eski önce; testler.
- lastActivity: girdilerdeki en yeni tarih.
Fail → implement → pass → commit.

### Task 6: `alert_dismissals` migration + RLS + types

**Files:** Modify `src/db/schema.ts`; generate `drizzle/0028_*.sql`; create `drizzle/0029_alert_dismissals_rls.sql`

1. Şemaya tablo: id uuid pk, athleteId fk profiles cascade, alertKey text, fingerprint text, dismissedBy fk set null, dismissedAt timestamptz default now; `UNIQUE(athlete_id, alert_key, fingerprint)`; index athlete_id.
2. `npx drizzle-kit generate` (0028) — memory'deki numaralandırma uyarısına dikkat.
3. `0029_alert_dismissals_rls.sql`: RLS enable; SELECT/INSERT/DELETE yalnız `public.is_coach()` (INSERT'te `dismissed_by = auth.uid()` check); UPDATE politikası yok.
4. Canlıya `mcp__supabase__apply_migration` ile (0028 sonra 0029, proje gscwjsqsklqpinrymtqe).
5. `mcp__supabase__generate_typescript_types` → `src/lib/database.types.ts`.
6. `npx drizzle-kit generate` tekrar → "No schema changes" beklenir. Commit.

### Task 7: Toplu triyaj loader'ı

**Files:** Create `src/lib/triage/load-triage.ts`

Tasarımdaki ~9 sorgu; tümü `Promise.all`; satırlar `Map<athleteId, …>` ile
gruplanır; `TriageInput[]` kurup `detectAlerts`+`computeTriage` çağırır;
dismissals filtreler. Export: `loadTriage = cache(async () => …)` — Supabase
server client içeride kurulur (RLS koç JWT'siyle). Dönen şey
`{ results: TriageResult[], attentionCount, criticalCount }`.
Typecheck + commit. (Saf mantık zaten testli; loader ince tutulur.)

### Task 8: Görüldü server action

**Files:** Create `src/app/(app)/panel/actions.ts`

`dismissAlert(formData: athleteId, alertKey, fingerprint)` → `requireCoach()`,
insert (unique violation sessiz), `revalidatePath("/panel")` +
`revalidatePath("/panel/sporcular/[id]", "page")`. `undismissAlert` = delete.
Commit.

### Task 9: Panel UI — özet bandı, Dikkat kartı, triyaj board'u

**Files:** Modify `src/app/(app)/panel/page.tsx`; Create `src/app/(app)/panel/triage-board.tsx` (client), `src/app/(app)/panel/score-ring.tsx` (client)

- Page: `loadTriage()` sonucu; 5'li MeasureCard grid (`Dikkat`, rose, emphasis);
  günlük özet bandı; `<TriageBoard results snapshot>`; mevcut sorular + hızlı
  işlemler aynen.
- `TriageBoard`: kartlar (sol bant şeridi, skor halkası, brief, kategori-ayrımlı
  uyarı çipleri — uyum kesikli amber / performans dolu, critical rose; çip
  "Görüldü" form butonu; kart gövdesi ilgili sekmeye `Link`). Sorunsuzlar
  `<details>` altında kompakt. GSAP: `useGSAP`-vari `useEffect` + context,
  stagger giriş, halka `stroke-dashoffset` animasyonu, skor count-up;
  `matchMedia('(prefers-reduced-motion: reduce)')` kapatır.
- Görsel dil: PaperCard/serif/mono, DESIGN.md tokenları.
Typecheck + commit. (Görsel doğrulama Task 12'de.)

### Task 10: Nav rozeti

**Files:** Modify `src/app/(app)/layout.tsx`, `src/components/shell/app-shell.tsx`

Layout koçsa `loadTriage()`dan `attentionCount` alır (React cache sayesinde
panel ile tek hesap); AppShell'e `attentionCount` prop; koç nav'ında Panel
öğesine rose rozet (mevcut NavBadge'e `tone` eklenebilir). Commit.

### Task 11: Sporcu detayı — sekmeler + hızlı dokunuş

**Files:** Modify `src/app/(app)/panel/sporcular/[athleteId]/page.tsx`; Create `athlete-tabs.tsx`, `alert-list.tsx`, `quick-message.tsx` (client), `quick-message-actions.ts`

- `?tab=` (genel|antrenman|beslenme|takip|fizik, default genel) — Link'li
  sekme çubuğu `week` param'ını korur; mevcut bölümler sekmelere taşınır
  (kod bloklarını bölerken davranış birebir korunur).
- Tek sporcu için triyaj: loader'a `loadTriageFor(athleteId)` yolu (aynı saf
  motor, tek sporcu filtresi). Genel sekmesi: skor + iki kategori uyarı listesi
  (görüldü butonlu); her sekme kendi dimension uyarılarını üstte gösterir.
- Hızlı dokunuş: başlıkta "Mesaj" → Sheet/slide-over: sporcunun son 5 feed
  gönderisi + her birinde yorum formu (`addComment` yeniden kullanılır;
  detay sayfası da revalidate edilir). Boş durum metni.
Typecheck + commit.

### Task 12: Görsel self-verification (headless Chrome)

- Geçici `/ornek/triyaj` rotası: fixture `TriageResult[]` (kırmızı/sarı/yeşil
  karışımı) ile TriageBoard + panel bileşimini render eder.
- `npm run dev` + headless Chrome screenshot: 390×844 ve 1440×900; panel,
  /ornek/triyaj, sporcu detay tüm sekmeler. Sorunları düzelt, tekrar çek.
- Konsol hatası kontrolü (chrome devtools protokolü üzerinden).
- Doğrulama sonrası /ornek rotası silinir (veya bırakılıyorsa gerekçe yazılır).
Commit.

### Task 13: Canlı RLS matrisi

`alert_dismissals` için canlı DB'de JWT simülasyonu (önceki fazlardaki
`request.jwt.claims` yöntemiyle): koç SELECT/INSERT/DELETE ✓; sporcu A/B
SELECT boş + INSERT reject; anon reject. Transcript'i test-senaryosu dokümanına.

### Task 14: Test senaryosu dokümanı + final doğrulama

- `docs/plans/2026-07-03-coach-dashboard-test-scenario.md`: triyaj sıralaması,
  iki uyarı türü, görüldü akışı, sekmeler, hızlı dokunuş, RLS matrisi,
  ekran görüntüsü referansları.
- `npm run test` + `npm run typecheck` + `npm run lint` + `npm run build` hepsi
  yeşil. Commit.

### Task 15: Bitiş

superpowers:finishing-a-development-branch — main'e merge kararı kullanıcıya
sunulur (autonomous: branch push'lanmaz, merge önerisi raporda).
