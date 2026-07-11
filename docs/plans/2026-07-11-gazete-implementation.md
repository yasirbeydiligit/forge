# Forge Gazete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Sporcuların kendi ulaşabildiği, gazete formatında, donan (immutable) dönemlik gelişim sayıları — haftalık/aylık/milestone; motivasyon odaklı, %100 veri-dürüst, GSAP'li, mobil öncelikli.

**Architecture:** Tembel üretim — sporcu `/gazete`'yi açınca kapanmış-basılmamış dönemler saf builder'la `report_issues.payload`'a (jsonb, sindirilmiş içerik) basılır ve asla değişmez. Saf katman (`src/lib/gazete/`) vitest ile TDD; loader ince, sadece sorgu. UI landing'in dergi kimliğinin devamı (Newsreader manşet, SplitText, DrawSVG, ScrollReveal, paper-grain).

**Tech Stack:** Next 15 App Router (repo pinli, `node_modules/next/dist/docs` YOK — mevcut repo desenlerini taklit et), Drizzle şema + Supabase MCP `apply_migration` (ASLA drizzle-kit migrate), RLS, date-fns(+tr), GSAP (SplitText/DrawSVG/ScrollTrigger), vitest.

**Tasarım dokümanı:** `docs/plans/2026-07-11-gazete-design.md`

**Tasarımdan tek sapma (onaylı düzeltme):** unique kısıtı `(athlete_id, period_type, period_end)` — milestone sayıları aynı `period_start`'ı (yolculuk başlangıcı) paylaşır, `period_end` her milestone'da farklıdır.

## Kritik repo konvansiyonları (görev sırasında tekrar bakma, buradan uygula)

- **Migration akışı:** `npx drizzle-kit generate` → üretilen `NNNN_<random>.sql`'i bir SONRAKİ BOŞ numaraya yeniden adlandır (`0030_report_issues.sql`; 0029 dolu) → `drizzle/meta/_journal.json` içindeki yeni entry'nin `tag`'ini aynı isimle güncelle → RLS'i elle `0031_report_issues_rls.sql` olarak yaz (journal'a GİRMEZ) → ikisini de Supabase MCP `apply_migration` ile canlıya uygula (proje: `gscwjsqsklqpinrymtqe`) → MCP `generate_typescript_types` ile `src/lib/database.types.ts`'i yenile → `npx drizzle-kit generate` tekrar çalıştır, "No schema changes" bekle.
- **Veri erişimi:** app kodu Supabase client (kullanıcı JWT'si) ile okur/yazar; RLS otoritedir. Drizzle sadece şema/migration.
- **Saf rapor mantığı** `src/lib/*` altında, colocated `*.test.ts` ile (örn. `src/lib/reports/coach-weekly.ts` + test — stil referansın).
- **Tarih:** date-fns + `tr` locale; `src/lib/format.ts`'teki `toDateKey/parseDateKey/formatDate/formatNumber` hazır.
- **PR motoru:** `src/lib/pr/count-events.ts` `countPrEvents(sets, from, to)` — haftalık PR sayımıyla birebir aynı motor kullanılacak (koç raporuyla tutarlılık).
- **Görsel dil:** `src/components/landing/hero.tsx` (SplitText masked lines + DrawSVG deseni, reduced-motion `gsap.matchMedia` guard'ı), `src/components/landing/scroll-reveal.tsx`, `src/components/paper-grain.tsx`, `src/components/lab/lab.tsx` (`PaperCard`). Font: `--font-newsreader` (serif manşet), geist mono (anotasyon).
- **Commit:** her görev sonunda; mesaj gövdesi Türkçe, `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>` ile biter.

---

### Task 1: Şema + migration + RLS + tipler

**Files:**
- Modify: `src/db/schema.ts` (dosya sonuna, insightRules'tan sonra)
- Create: `drizzle/0030_report_issues.sql` (generate + rename)
- Create: `drizzle/0031_report_issues_rls.sql` (elle)
- Modify: `drizzle/meta/_journal.json` (tag rename)
- Regenerate: `src/lib/database.types.ts` (MCP)

**Step 1: Şemaya ekle** — `src/db/schema.ts` sonuna:

```ts
/* -------------------------------------------------------------------------- */
/*  Forge Gazete — frozen athlete-facing period report issues                 */
/* -------------------------------------------------------------------------- */

export const reportPeriodType = pgEnum("report_period_type", [
  "weekly",
  "monthly",
  "milestone",
]);

/**
 * A printed Gazete issue. `payload` is the fully digested content (headline,
 * stories, stat table, photo refs by ID) — never raw data, never recomputed:
 * once printed an issue is immutable (column-level GRANT restricts athlete
 * updates to read_at; see 0031). Uniqueness is on period_end because all
 * milestone issues share period_start (the athlete's journey start).
 */
export const reportIssues = pgTable(
  "report_issues",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    periodType: reportPeriodType("period_type").notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    // 3/6/9/12/24… — only for milestone issues (CHECK enforces both ways).
    milestoneMonths: integer("milestone_months"),
    // Per-athlete, per-type sequential number ("Hafta Sayısı 3").
    issueNumber: integer("issue_number").notNull(),
    payload: jsonb("payload").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("report_issues_athlete_type_end_key").on(
      t.athleteId,
      t.periodType,
      t.periodEnd,
    ),
    index("report_issues_athlete_idx").on(t.athleteId, t.periodEnd),
    check(
      "report_issues_milestone_months_check",
      sql`(${t.periodType} = 'milestone') = (${t.milestoneMonths} IS NOT NULL)`,
    ),
  ],
);
```

**Step 2: Generate + rename** — `npx drizzle-kit generate`; üretilen `drizzle/0029_<random>.sql` dosyasını `drizzle/0030_report_issues.sql` yap (0029 elle-yazılmış RLS tarafından dolu); `_journal.json` yeni entry `tag` → `0030_report_issues`.

**Step 3: RLS yaz** — `drizzle/0031_report_issues_rls.sql`. Koç-okuma predicate'ini `drizzle/0004_daily_metrics_rls.sql`'den BİREBİR kopyala (muhtemelen enrollments üzerinden; kendi predicate'ini icat etme). İskelet:

```sql
alter table public.report_issues enable row level security;

-- Sporcu kendi sayılarını okur.
create policy "report_issues_athlete_select" on public.report_issues
  for select using (athlete_id = auth.uid());

-- Tembel üretim sporcunun kendi JWT'siyle çalışır: kendi adına basar.
create policy "report_issues_athlete_insert" on public.report_issues
  for insert with check (athlete_id = auth.uid());

-- Sporcu kendi satırını günceller; kolon GRANT'i bunu read_at ile sınırlar
-- (payload dondurulmuştur).
create policy "report_issues_athlete_update" on public.report_issues
  for update using (athlete_id = auth.uid())
  with check (athlete_id = auth.uid());

-- Koç: sporcusunun sayılarını okur (predicate'i 0004'ten kopyala).
create policy "report_issues_coach_select" on public.report_issues
  for select using (/* 0004'teki koç predicate'i, athlete_id üzerinden */);

-- Immutability: UPDATE sadece read_at kolonuna.
revoke update on table public.report_issues from authenticated;
grant update (read_at) on table public.report_issues to authenticated;
```

**Step 4: Canlıya uygula** — MCP `apply_migration` ile önce 0030, sonra 0031 (name parametreleri dosya adlarıyla aynı).

**Step 5: Tipleri yenile + doğrula** — MCP `generate_typescript_types` → `src/lib/database.types.ts`; `npx drizzle-kit generate` → "No schema changes"; `npx tsc --noEmit` temiz.

**Step 6: Commit** — `feat(gazete): report_issues şeması + RLS — donan sayı arşivi`

---

### Task 2: Dönem matematiği — `src/lib/gazete/periods.ts` (TDD)

**Files:**
- Create: `src/lib/gazete/periods.ts`
- Test: `src/lib/gazete/periods.test.ts`

**Step 1: Failing testleri yaz** (temsili çekirdek; kenar durumları dahil et):

```ts
import { describe, expect, it } from "vitest";
import { duePeriods, nextMilestone, periodLabel } from "./periods";

describe("duePeriods", () => {
  // journeyStart Salı: ilk kapalı hafta o haftadır (Pzt'ye geri hizalanır).
  it("kapalı ISO haftalarını Pzt–Paz döndürür, devam eden haftayı asla", () => {
    const due = duePeriods("2026-06-30", "2026-07-11", new Set());
    const weekly = due.filter((p) => p.type === "weekly");
    expect(weekly).toEqual([
      { type: "weekly", start: "2026-06-29", end: "2026-07-05" },
    ]); // 6–12 Tem haftası 11'inde hâlâ açık
  });

  it("haftalık backfill son 8 kapalı haftayla sınırlı", () => {
    const due = duePeriods("2025-07-01", "2026-07-11", new Set());
    const weekly = due.filter((p) => p.type === "weekly");
    expect(weekly).toHaveLength(8);
    expect(weekly[0].start).toBe("2026-05-11"); // en eski, kronolojik sıra
    expect(weekly[7].end).toBe("2026-07-05");
  });

  it("kapalı takvim aylarını tam backfill'ler, devam eden ayı vermez", () => {
    const due = duePeriods("2026-04-15", "2026-07-11", new Set());
    const monthly = due.filter((p) => p.type === "monthly");
    expect(monthly.map((m) => m.start)).toEqual([
      "2026-04-01", "2026-05-01", "2026-06-01",
    ]); // Nisan kısmî ay olsa da verisi olabilir; boşsa üretim atlar
  });

  it("dolmuş milestone'ları verir; period_start hep yolculuk başı", () => {
    const due = duePeriods("2025-12-20", "2026-07-11", new Set());
    const ms = due.filter((p) => p.type === "milestone");
    expect(ms).toEqual([
      { type: "milestone", start: "2025-12-20", end: "2026-03-20", months: 3 },
      { type: "milestone", start: "2025-12-20", end: "2026-06-20", months: 6 },
    ]);
  });

  it("ay sonu kenarı: 30 Kas + 3 ay = 28/29 Şub (date-fns clamp)", () => {
    const due = duePeriods("2025-11-30", "2026-03-05", new Set());
    const ms = due.filter((p) => p.type === "milestone");
    expect(ms[0].end).toBe("2026-02-28");
  });

  it("12'den sonra yıl dönümleri: 24, 36…", () => {
    const due = duePeriods("2024-01-10", "2026-02-01", new Set());
    const months = due
      .filter((p) => p.type === "milestone")
      .map((p) => p.months);
    expect(months).toEqual([3, 6, 9, 12, 24]);
  });

  it("basılmış dönemleri eler (printed anahtarı type:end)", () => {
    const printed = new Set(["weekly:2026-07-05"]);
    const due = duePeriods("2026-06-29", "2026-07-11", printed);
    expect(due.filter((p) => p.type === "weekly")).toHaveLength(0);
  });
});

describe("periodLabel / nextMilestone", () => {
  it("etiketler", () => {
    expect(periodLabel({ type: "weekly", start: "2026-06-29", end: "2026-07-05" }))
      .toBe("29 Haziran – 5 Temmuz 2026");
    expect(periodLabel({ type: "monthly", start: "2026-06-01", end: "2026-06-30" }))
      .toBe("Haziran 2026");
    expect(
      periodLabel({ type: "milestone", start: "2025-12-20", end: "2026-06-20", months: 6 }),
    ).toBe("6. Ay Özel Sayısı");
  });

  it("sonraki milestone", () => {
    expect(nextMilestone("2025-12-20", "2026-06-20")).toEqual({
      months: 9,
      dueDate: "2026-09-20",
    });
  });
});
```

**Step 2: Çalıştır, FAIL gör** — `npx vitest run src/lib/gazete/periods.test.ts` → "Cannot find module './periods'".

**Step 3: Implement** — `periods.ts`. İskelet (date-fns: `startOfISOWeek`, `addWeeks`, `addMonths`, `startOfMonth`, `endOfMonth`, `format` + tr):

```ts
export const WEEKLY_BACKFILL_LIMIT = 8;
export const MILESTONES = [3, 6, 9, 12] as const; // sonrası: 12'nin katları

export type Period =
  | { type: "weekly" | "monthly"; start: string; end: string }
  | { type: "milestone"; start: string; end: string; months: number };

export function periodKey(p: Period): string; // `${type}:${end}` — printed eşleşmesi
export function duePeriods(journeyStart: string, today: string, printed: Set<string>): Period[];
// Sıralama: kronolojik (end asc), tip fark etmeksizin — issue_number ataması buna dayanır.
export function nextMilestone(journeyStart: string, after: string): { months: number; dueDate: string } | null;
export function periodLabel(p: Period): string;
```

Kurallar: hafta `startOfISOWeek`; kapalı = `end < today` (bugün dahil değil — Pazar günü hafta hâlâ açık). Ay: `end = endOfMonth`, kapalı = `end < today`. Milestone: `end = toDateKey(addMonths(parseDateKey(journeyStart), months))`, dolmuş = `end <= today`; 12'den sonra `24, 36, …` today'e kadar. Weekly listesi hesaplandıktan sonra `slice(-WEEKLY_BACKFILL_LIMIT)` — printed elemesi SLICE'TAN SONRA (kayan pencere dışına düşen eski haftalar bir daha asla due olmaz; pending sinyali de aynı fonksiyonu kullandığı için tutarlı).

**Step 4: PASS gör** — `npx vitest run src/lib/gazete/periods.test.ts`.

**Step 5: Commit** — `feat(gazete): dönem matematiği — kapalı hafta/ay, milestone, backfill penceresi`

---

### Task 3: Dönem agregasyonu — `src/lib/gazete/aggregate.ts` (TDD)

Loader'ı ince tutmak için satır→özet dönüşümü saf fonksiyonda.

**Files:**
- Create: `src/lib/gazete/aggregate.ts`
- Test: `src/lib/gazete/aggregate.test.ts`

**Step 1: Tipleri tanımla** (test ile birlikte iterle):

```ts
/** Loader'ın sorgulardan getirdiği ham satırlar — hepsi dönem içi. */
export type AggregateRows = {
  sessions: { id: string; date: string; completed: boolean }[];
  sets: { sessionId: string; exerciseId: string; exerciseName: string; date: string; weight: number | null; reps: number | null; rir: number | null }[];
  /** Dönemden ÖNCE en az bir seti olan egzersizler (yeni-hareket tespiti). */
  historyExerciseIds: Set<string>;
  /** PR motoru için: dönem + 365g geriye dönük setler (count-events girdisi). */
  prHistorySets: { exerciseId: string; exerciseName: string; date: string; weight: number | null; reps: number | null; rir: number | null }[];
  metricDays: { date: string; weight: number | null; sleepHours: number | null; steps: number | null }[];
  mealDays: { date: string; kcal: number; protein: number }[]; // gün bazında toplanmış
  target: { kcal: number | null; protein: number | null } | null;
  cardio: { minutes: number; distanceKm: number | null }[];
  protocol: { due: number; done: number };
  weeklyTargetDays: number | null;
};

export type PeriodAggregates = {
  daysInPeriod: number;
  sessionsCompleted: number;
  totalSets: number;
  tonnageKg: number;               // sum(weight*reps), weight&reps non-null
  prCount: number;                  // countPrEvents toplamı (koç motoruyla aynı)
  bestPr: { exercise: string; weight: number; reps: number } | null;
  newExercises: string[];           // dönemde ilk kez yapılanlar (isim)
  bestSession: { date: string; sets: number; tonnageKg: number } | null;
  weightFirst: number | null;       // ilk 3 tartımın ortalaması (gürültü kırpma)
  weightLast: number | null;        // son 3 tartımın ortalaması
  weightSamples: number;
  sleepAvg: number | null;
  stepsAvg: number | null;
  proteinDaysHit: number;           // protein >= hedef*0.9 olan loglu günler
  nutritionDaysLogged: number;
  kcalDaysInBand: number;           // hedefin ±%10'u (nutrition-weekly bandı)
  cardioMinutes: number;
  cardioDistanceKm: number;
  cardioCount: number;
  protocolDone: number;
  protocolDue: number;
  weeklyTargetDays: number | null;
  /** Lead sparkline: weekly→günlük, monthly→haftalık, milestone→aylık tonaj. */
  sparkTonnage: number[];
};

export function aggregatePeriod(period: Period, rows: AggregateRows): PeriodAggregates;
```

**Step 2: Failing testler** — asgari kapsam:
- tonaj/set/seans sayımı; weight'i null setler tonaja girmez ama set sayısına girer
- `bestPr`: dönem içi PR eventleri arasında en yüksek `weight` (eşitlikte yüksek reps); PR sayımı `countPrEvents` ile — dönemden önceki tarihî set frontier'ı eski başarıyı "yeni rekor" saydırmaz (test: history'de 100kg varken dönemde 95kg PR DEĞİL)
- `newExercises`: historyExerciseIds'te olmayan egzersizler, ilk görülme sırasıyla
- `weightFirst/Last`: 3'ten az tartımda mevcut olanların ortalaması; 0 tartımda null
- protein günü: target.protein null ise proteinDaysHit=0 & nutritionDaysLogged sayılır
- spark bucket'ları: weekly 7 eleman (boş gün 0), monthly ISO-hafta sayısı, milestone ay sayısı
- kcal bandı `nutrition-weekly.ts`'teki `KCAL_BAND_LOW/HIGH` sabitlerini import eder (0.9/1.1 — tek kaynak)

**Step 3: FAIL gör → Step 4: Implement → Step 5: PASS** — `npx vitest run src/lib/gazete/aggregate.test.ts`

**Step 6: Commit** — `feat(gazete): dönem agregasyonu — tonaj, PR, tartım çıpaları, spark bucket'ları`

---

### Task 4: Fact çıkarımı — `src/lib/gazete/facts.ts` (TDD)

**Files:**
- Create: `src/lib/gazete/facts.ts`
- Test: `src/lib/gazete/facts.test.ts`

**Step 1: Tipler + eşikler** (hepsi export edilen açık sabit — dürüstlük eşikleri kodda görünür olacak):

```ts
export type FactType =
  | "pr_count" | "volume_trend" | "consistency" | "weight_trend"
  | "protein_consistency" | "sleep_improvement" | "steps_avg"
  | "cardio_total" | "protocol_adherence" | "new_exercises" | "best_session";

export type Fact = {
  type: FactType;
  /** Haber değeri — manşet/hikâye seçimi buna göre. */
  score: number;
  direction: "positive" | "neutral";
  /** Şablon slotları — copy.ts fillTemplate bunlarla doldurur. */
  slots: Record<string, string | number>;
  /** Hikâye kartındaki 0..1 dolum barı (varsa). */
  fill?: number;
};

/** Nazik hatırlatma adayı — asla hikâye olmaz, en fazla 2'si Editörün Notu olur. */
export type Caution = {
  type: "weight_against_goal" | "sleep_decline" | "protein_low";
  slots: Record<string, string | number>;
  severity: number;
};

// Övgü eşikleri — hak edilmeyen övgü yapısal olarak imkânsız:
export const CONSISTENCY_PRAISE_RATIO = 0.8;   // hedef günlerin %80'i
export const WEIGHT_TREND_MIN_KG = 0.4;        // altı gürültü sayılır
export const WEIGHT_MIN_SAMPLES = 4;
export const MAINTENANCE_STABLE_KG = 0.5;      // maintenance övgü bandı
export const PROTEIN_PRAISE_RATIO = 0.8;       // loglu günlerin %80'i
export const NUTRITION_MIN_LOGGED_DAYS = 4;
export const SLEEP_IMPROVE_MIN_H = 0.3;
export const SLEEP_MIN_SAMPLES = 4;
export const VOLUME_TREND_MIN_RATIO = 1.1;     // önceki döneme +%10
export const PROTOCOL_PRAISE_RATIO = 0.85;
export const CARDIO_MIN_MINUTES = 60;          // haftalıkta; ay/milestone'da 240

export function extractFacts(input: {
  goal: "muscle_gain" | "strength" | "fat_loss" | "maintenance" | null;
  periodType: "weekly" | "monthly" | "milestone";
  current: PeriodAggregates;
  previous: PeriodAggregates | null; // milestone'da null
}): { facts: Fact[]; cautions: Caution[] };
```

**Step 2: Failing testler — dürüstlük testleri EN ÖNEMLİ blok:**

```ts
it("fat_loss hedefinde kilo ARTIŞI asla positive fact olmaz; caution olur", () => {
  const { facts, cautions } = extractFacts({ goal: "fat_loss", ...upWeight });
  expect(facts.find((f) => f.type === "weight_trend")).toBeUndefined();
  expect(cautions.some((c) => c.type === "weight_against_goal")).toBe(true);
});

it("muscle_gain hedefinde aynı kilo artışı övgüdür", () => {
  const { facts } = extractFacts({ goal: "muscle_gain", ...upWeight });
  const f = facts.find((f) => f.type === "weight_trend");
  expect(f?.direction).toBe("positive");
  expect(f?.slots.deltaKg).toBe(1.2);
});

it("eşik altı veri fact üretmez: %79 tutarlılık övgü değil", () => { ... });
it("örneklem yetersizse kilo trendi hiç üretilmez (3 tartım < WEIGHT_MIN_SAMPLES)", () => { ... });
it("previous yoksa volume_trend üretilmez (uydurma kıyas yok)", () => { ... });
it("goal null iken kilo değişimi nötr fact'tir, övgü cümlesi kurulmaz", () => { ... });
```

Ayrıca: skor büyüklükle artar (5 PR > 1 PR); milestone'da `weight_trend` skoru ×1.5 (uzun dönemin yıldız haberi); her fact'in slots'u ilgili şablonun TÜM zorunlu slotlarını içerir.

**Step 3–5: FAIL → implement → PASS.** Skorlama basit tut: her tipin taban puanı + büyüklük çarpanı; sabitleri dosya başında topla.

**Step 6: Commit** — `feat(gazete): fact çıkarımı — hedefe duyarlı, eşikli, dürüstlük garantili`

---

### Task 5: Metin motoru — `src/lib/gazete/copy.ts` (TDD)

**Files:**
- Create: `src/lib/gazete/copy.ts`
- Test: `src/lib/gazete/copy.test.ts`

**Step 1: Failing testler:**

```ts
it("fillTemplate eksik slotta null döner — yarım cümle asla", () => {
  expect(fillTemplate({ text: "{count} PR kırdın", slots: ["count"] }, {})).toBeNull();
});
it("pickVariant deterministik: aynı seed aynı varyant", () => {
  const pool = HEADLINES.pr_count;
  expect(pickVariant(pool, "a:weekly:2026-07-05")).toBe(pickVariant(pool, "a:weekly:2026-07-05"));
});
it("farklı seed'ler havuzu geziyor (en az 2 farklı varyant / 20 seed)", () => { ... });
it("her FactType için manşet ve gövde havuzu var ve şablon slotları Fact üreticisinin slot anahtarlarıyla eşleşiyor", () => { ... });
```

**Step 2: Implement.** `djb2` hash → `pool[hash % len]`. Havuzlar — tip başına 3–5 varyant, gazete dili, abartısız (sayı zaten konuşuyor). Temsilî içerik (tamamını bu kalitede yaz):

```ts
export const HEADLINES: Record<FactType, Template[]> = {
  pr_count: [
    { text: "Bu dönem {count} kez tarihe geçtin", slots: ["count"] },
    { text: "{count} yeni rekor: çıta yükseldi", slots: ["count"] },
    { text: "Rekor defterine {count} yeni satır", slots: ["count"] },
  ],
  consistency: [
    { text: "Söz verdin, geldin: {sessions} antrenman", slots: ["sessions"] },
    { text: "Program mı? İmza gibi: {sessions}/{planned} gün", slots: ["sessions", "planned"] },
  ],
  weight_trend: [
    // Yön kelimesi slot'tan gelir ("verdin"/"aldın") — hedefe göre facts katmanı belirler.
    { text: "{deltaKg} kg {direction}: plan işliyor", slots: ["deltaKg", "direction"] },
  ],
  // ... tüm tipler
};
export const STORY_BODIES: Record<FactType, Template[]> = { /* 2-3'er varyant */ };
export const EDITOR_NOTES: Record<Caution["type"], Template[]> = {
  sleep_decline: [
    { text: "Uyku ortalaman {delta} saat geriledi — koçun bu hafta değinecektir.", slots: ["delta"] },
  ],
  // ... nazik, suçlamasız; "uyarı" değil "not" tonu
};
export const NEUTRAL_HEADLINES: Template[] = [
  // Pozitif fact çıkmayan ama verisi olan dönem: dürüst, övgüsüz kapak.
  { text: "Dönem kayıtları masada", slots: [] },
  { text: "Defter işlendi: rakamlar içeride", slots: [] },
];
```

**Step 3–4: PASS. Step 5: Commit** — `feat(gazete): kural tabanlı Türkçe metin havuzu — deterministik varyant, zorunlu slot`

---

### Task 6: Sayı derleyici — `src/lib/gazete/build-issue.ts` (TDD)

**Files:**
- Create: `src/lib/gazete/build-issue.ts` (+ `types.ts` payload tipi)
- Test: `src/lib/gazete/build-issue.test.ts`

**Step 1: Payload tipi:**

```ts
export type IssuePayload = {
  v: 1;
  headline: { title: string; factType: FactType | "neutral" };
  lead: {
    body: string;
    stat: { value: number; suffix: string; label: string } | null; // sayan sayı
    spark: number[] | null;
  };
  stories: {
    factType: FactType; title: string; body: string;
    stat: { value: string; label: string } | null;
    fill: number | null;
  }[];
  statTable: { label: string; value: string; delta: "up" | "down" | "flat" | null }[];
  photos: {
    beforeId: string; afterId: string;
    beforeDate: string; afterDate: string;
    beforeWeightKg: number | null; afterWeightKg: number | null;
  } | null;
  editorNotes: string[];
  closing: { nextMilestoneMonths: number | null; nextMilestoneDate: string | null };
};
```

**Step 2: Failing testler:**
- hiç fact + hiç veri (`totalSets===0 && metrik/öğün/kardiyo günleri 0`) → `buildIssue` **null** (sayı basılmaz)
- pozitif fact yok ama veri var → NEUTRAL_HEADLINES'tan manşet, stories boş olabilir, statTable dolu
- en yüksek skorlu fact manşet olur, manşet fact'i stories'te TEKRARLANMAZ; stories ≤ 5
- editorNotes ≤ 2, severity sırasına göre
- statTable: sadece verisi olan satırlar (kardiyo 0 dk ise satır yok); previous varsa delta oku, yoksa null
- aynı girdi + aynı seed → bit-bit aynı payload (determinizm)
- fotoğraflar ctx'ten geçer; yoksa null

**Step 3–4: Implement → PASS.** İmza:

```ts
export function buildIssue(ctx: {
  seed: string;                     // `${athleteId}:${type}:${periodEnd}`
  periodType: "weekly" | "monthly" | "milestone";
  photos: IssuePayload["photos"];   // loader seçer (±14g ay / ±21g milestone)
  nextMilestone: { months: number; dueDate: string } | null;
}, factsInput: Parameters<typeof extractFacts>[0]): IssuePayload | null;
```

**Step 5: Commit** — `feat(gazete): sayı derleyici — manşet seçimi, nötr kapak, editör notu sınırı`

---

### Task 7: Loader + tembel üretim — `src/lib/gazete/loader.ts`

İnce katman: sadece sorgular + saf fonksiyon çağrıları. Unit test yok (saf katman zaten test edildi); Task 11'de canlı doğrulanır.

**Files:**
- Create: `src/lib/gazete/loader.ts`
- Create: `src/lib/gazete/signal.ts`

**Step 1: `loader.ts`** — desen `coach-weekly-loader.ts` (JWT'li client parametre, RLS otorite):

```ts
export async function loadJourneyStart(supabase, athleteId): Promise<string | null>
// min(first log_session.session_date, first daily_metric.metric_date,
//     first enrollment start) — üçü de yoksa null (hiç veri yok, gazete boş).
// Enrollment tarih kolonunun adını schema.ts'ten doğrula (enrollments tablosu).

export async function generateDueIssues(supabase, athleteId): Promise<number>
// 1. journeyStart yoksa 0 dön.
// 2. printed: SELECT period_type, period_end FROM report_issues (athlete'ın) → Set("type:end")
// 3. duePeriods(...) → her biri için loadAggregateRows(...) → aggregatePeriod
//    - previous dönem: weekly→önceki ISO hafta, monthly→önceki ay (aynı sorgularla);
//      milestone→null. Önceki dönem TAMAMEN boşsa previous=null geç (uydurma kıyas olmasın).
// 4. Fotoğraf seçimi (monthly/milestone): physique_photos'tan period start/end'e
//    en yakınlar; tolerans ay ±14g, milestone ±21g; ikisi de yoksa null; aynı foto
//    iki uca seçildiyse null (karşılaştırma yalanı olmaz).
// 5. buildIssue null değilse INSERT (issue_number = o tipin mevcut sayısı + 1;
//    kronolojik üretiliyor, duePeriods sıralı). 23505 unique ihlali = paralel tab
//    basmış — sessiz geç.
// 6. Basılan sayı adedini dön.
```

`loadAggregateRows` sorguları (hepsi mevcut sayfalardaki desenlerle aynı):
- sessions: `log_sessions` athlete+tarih aralığı, `completed=true`
- sets: `log_sets` in sessionIds, `exercise:exercises(name)` join
- historyExerciseIds: dönem öncesi DISTINCT exercise_id (`log_sets` + `log_sessions!inner` tarih `< start`; koç loader'daki inner-join deseni)
- prHistorySets: `coach-weekly-loader.loadWeeklyPrs`'teki 365g sorgusunun aynısı (kopyala, ortaklaştırmaya çalışma — imzaları farklı)
- metricDays / mealDays+target / cardio / protocol / weeklyTargetDays: ilgili tablolardan dönem aralığı

**Step 2: `signal.ts`** — nav rozeti + Bugün kartı için request-cached (React `cache()` — `loadTriage` desenine bak):

```ts
export const loadGazeteSignal = cache(async (): Promise<{ newCount: number }> => {
  // unreadPrinted: report_issues WHERE read_at IS NULL (count head:true)
  // pendingUnprinted: journeyStart + printed set + duePeriods().length
  //   — duePeriods boş-veri dönemlerini bilemez; sinyal "en fazla" değeridir,
  //   üretim boş dönemi basmayınca sayı kendini düzeltir. Kabul edilen yaklaşıklık.
  // newCount = unreadPrinted + pendingUnprinted
});
```

**Step 3:** `npx tsc --noEmit` temiz. **Step 4: Commit** — `feat(gazete): tembel üretim loader'ı + gazete sinyali`

---

### Task 8: `/gazete` arşiv sayfası (bayi)

**Files:**
- Create: `src/app/(app)/gazete/page.tsx` (server)
- Create: `src/components/gazete/kiosk.tsx` (client, GSAP)
- Create: `src/components/gazete/masthead.tsx` (server-safe, iki sayfada ortak)

**Step 1: `page.tsx`:**
- `requireProfile()`; koç ise `redirect("/panel")` (athlete-only sayfa deseni: `/bugun/page.tsx`'te nasıl yapılmış bak, aynısını uygula)
- `await generateDueIssues(supabase, profile.id)` → sonra `report_issues` listesini çek (`period_end desc`)
- Hiç sayı yoksa `EmptyState` ("İlk sayın ilk antrenman haftan kapanınca basılacak")
- `<Kiosk issues={rows} />`

**Step 2: `kiosk.tsx`:**
- Masthead: "FORGE GAZETE" (Newsreader, `--font-newsreader`), altında mono tarih satırı
- En yeni sayı: büyük kapak kartı — manşet (payload.headline.title), dönem etiketi (`periodLabel`), sayı no, okunmamışsa "YENİ" rozeti; tıklayınca `/gazete/[id]`
- Kalanlar: kronolojik raf listesi (kompakt satırlar); milestone satırları rozetli ("6. AY ÖZEL SAYISI" — `periodLabel` zaten verir), okunmamışlarda nokta
- GSAP: kapak kartı SplitText mask girişi + raf satırları stagger (landing `hero.tsx` deseni: `gsap.matchMedia` + `prefers-reduced-motion: no-preference` guard, `ScrollReveal` reuse)
- Mobil: tek sütun; kart tam genişlik

**Step 3: Görsel kontrol dev server ile** (kabaca; asıl doğrulama Task 11). **Step 4: Commit** — `feat(gazete): arşiv/bayi sayfası — kapak kartı + raf`

---

### Task 9: `/gazete/[issueId]` sayı sayfası

**Files:**
- Create: `src/app/(app)/gazete/[issueId]/page.tsx` (server)
- Create: `src/components/gazete/issue-view.tsx` (client, ana GSAP sahnesi)
- Create: `src/components/gazete/photo-compare.tsx`, `stat-table.tsx`, `spark-line.tsx`

**Step 1: `page.tsx`:**
- Satırı çek (RLS zaten korur; yoksa `notFound()`)
- Sahibi açtıysa ve `read_at IS NULL` → `update({ read_at: new Date().toISOString() })` (kolon GRANT'i sayesinde sadece bu kolon yazılabilir)
- `payload.photos` varsa iki foto için `physique_photos`'tan `storage_path` çek + `createSignedUrl` (desen: `fizik/page.tsx:40` civarı) — payload'da URL YOK, ID var
- `<IssueView issue={row} payload={payload} photoUrls={...} athleteName={profile.full_name} />`

**Step 2: `issue-view.tsx`** — sayfa anatomisi (mobil tek sütun, md+ iki sütunlu hikâye ızgarası):
1. Masthead bandı: FORGE GAZETE / "Sayı {issueNumber} · {periodLabel}" / "{athleteName} adına özel baskı" (mono)
2. Manşet: Newsreader, `text-5xl md:text-7xl`, SplitText satır-maske girişi (hero deseni; font yüklenmesini bekle — hero'daki `run()` yaklaşımı)
3. Lead: gövde + sayan sayı (`gsap.to` textContent snap — landing `season-stats.tsx`'teki sayaç desenine bak, reuse edilebiliyorsa import et) + `spark-line.tsx` (inline SVG polyline, DrawSVG ile çizilir)
4. Hikâye blokları: `ScrollReveal` ile; her kartta başlık (serif), gövde, stat, `fill != null` ise scaleX dolum barı (origin-left, beslenme motion deseni)
5. "Rakamlarla Bu Dönem": mono tablo, `delta:"up"` → ▲ (primary), `down` → ▾ (nötr gri — negatife kırmızı ALARM verme, bu motivasyon sayfası), `flat` → –
6. `photo-compare.tsx` (payload.photos varsa): yan yana iki foto, mono tarih+kilo etiketleri, clip-path `inset` perde reveal (ScrollTrigger)
7. Editörün Notu: ince çerçeveli küçük kutu, mono "EDİTÖRÜN NOTU" başlığı
8. Kapanış: "Sonraki sayıda görüşmek üzere." + varsa "{months}. ay sayısına {n} gün" (n'i render'da `differenceInCalendarDays` ile hesapla — payload'daki dueDate donuk, gün sayısı canlı)
- TÜM motion `gsap.matchMedia("(prefers-reduced-motion: no-preference)")` içinde; JS'siz/reduced'da içerik tam okunur (hero standardı)

**Step 3: Commit** — `feat(gazete): sayı sayfası — manşet, lead, hikâyeler, foto perdesi, editör notu`

---

### Task 10: Nav + Bugün keşif kartı + koç erişimi

**Files:**
- Modify: `src/app/(app)/layout.tsx` — athlete dalına `loadGazeteSignal()` ekle, `gazeteCount` prop'u
- Modify: `src/components/shell/app-shell.tsx` — athlete `secondary`'ye `{ href: "/gazete", label: "Gazete", icon: Newspaper, badge: gazeteCount }` (lucide `Newspaper`)
- Inspect+Modify: `src/components/shell/user-menu.tsx` — mobilde secondary sayfalara erişim nasıl sağlanıyorsa (menü linkleri varsa) Gazete'yi aynı yere ekle; yoksa dokunma
- Modify: Bugün sayfası (`src/app/(app)/bugun/` — `today-view`'a kompakt slot): `gazeteCount > 0` iken küçük kart: mono "FORGE GAZETE" + "Yeni sayın basıldı →" linki. Bugün'ün mevcut motion diline uy (`[[athlete-motion-language]]`: SVG+GSAP, ölçülü)
- Create: `src/app/(app)/panel/sporcular/[athleteId]/gazete/page.tsx` — koç: sporcunun BASILI sayı listesi (üretim YOK — üretim yalnız sporcunun ziyaretinde); `src/app/(app)/panel/sporcular/[athleteId]/gazete/[issueId]/page.tsx` — aynı `IssueView`, `readOnly` (read_at'e dokunmaz; RLS + kolon grant zaten owner-only). Athlete detail sayfasına "Gazete" sekme/linki mevcut sekme desenine uyarak ekle (`page.tsx`'teki seans/fizik sekmelerine bak).

**Steps:** her dosya için değiştir → `npx tsc --noEmit` + `npx vitest run` yeşil → commit:
- `feat(gazete): nav rozeti + Bugün keşif kartı`
- `feat(gazete): koç salt-okunur gazete erişimi`

---

### Task 11: Canlı doğrulama (memory: live-self-verification-workflow)

**Step 1: Görsel — temp fixture rotaları** `src/app/offline/ornek-gazete/` altında (PUBLIC_PATHS'te, middleware'e dokunma): `kiosk` ve `issue` sayfaları, REAL bileşenler + zengin mock payload (PR manşeti, 4 hikâye, statTable, foto YOK — signed URL gerektirir; photo-compare'i placeholder img ile ayrı fixture'da). Scratchpad CDP script'i (`cdp-mobile-shot.mjs` deseni, Node≥22): 390×844 mobil + 1280 masaüstü ekran görüntüleri; scroll → ScrollTrigger'lar → tekrar capture. Overflow probe rozetini kontrol et (scrollWidth > clientWidth = FAIL). PNG'leri Read ile incele: manşet taşması, dolum barları, tablo hizası, karanlık tema (`prefers-color-scheme` iki mod).

**Step 2: RLS matrisi — MCP `execute_sql`, JWT simülasyonu** (`BEGIN; SET LOCAL role authenticated; SET LOCAL request.jwt.claims=...; ...; ROLLBACK;`):
| Aktör | İşlem | Beklenen |
| --- | --- | --- |
| Sporcu A | kendi INSERT + SELECT | ✓ |
| Sporcu A | kendi `read_at` UPDATE | ✓ |
| Sporcu A | kendi `payload` UPDATE | ✗ (kolon grant → 42501) |
| Sporcu B | A'nın satırı SELECT | 0 satır |
| Sporcu B | A adına INSERT | 42501 |
| A'nın koçu | A SELECT | ✓ |
| Yabancı koç | A SELECT | 0 satır |
| anon | SELECT | 0 satır |
Expected-deny'ler ayrı çağrılarda (hata txn'i düşürür). Sonuçları test-scenario dokümanına yaz.

**Step 3: Uçtan uca gerçek akış** — dev server + kendi hesabınla `/gazete` (canlı DB'de gerçek sporcu verisi var): sayılar basılıyor mu, arşiv doğru mu, ikinci ziyaret yeniden basmıyor mu (idempotens), sayı açınca rozet düşüyor mu.

**Step 4: Temizlik + dokümantasyon** — fixture rotalarını sil (`rm -rf` + `.next/types` stub'ları), `docs/plans/2026-07-11-gazete-test-scenario.md`'ye matris + ekran görüntüsü bulguları. Commit: `test(gazete): canlı doğrulama — RLS matrisi + mobil/masaüstü görsel denetim`

---

### Task 12: Kapanış

**Step 1:** Tam süit: `npx vitest run` (353 + yeniler), `npx tsc --noEmit`, `npm run lint`, `npm run build` — hepsi temiz.
**Step 2:** superpowers:verification-before-completion — kanıt topla.
**Step 3:** superpowers:finishing-a-development-branch — merge/PR seçeneklerini kullanıcıya sun.
