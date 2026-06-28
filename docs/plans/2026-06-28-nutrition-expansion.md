# Nutrition Expansion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Forge'un beslenme bölümünü bozmadan genişlet: oto-kalori (4/4/9), hazır
öğün (template) kütüphanesi, görsel makro/kalori barları, koç tanımlı supplement
protokolleri (sporcu checklist + koç uyum görünümü), koç haftalık beslenme özeti.

**Architecture:** Yeni Drizzle tabloları (`meal_templates`, `protocol_templates`,
`protocol_assignments`, `protocol_completions`) + enum. Yapısal migration
`db:generate`/`db:migrate` ile; RLS elle `.sql` + Supabase MCP. Saf mantık
`src/lib/nutrition/*` ve `src/lib/reports/*` (TDD, vitest). UI mevcut lab
primitifleri + server action + `useActionState`/optimistik kalıpla.

**Tech Stack:** Next 15 (app router), React 19, Drizzle, Supabase (RLS), vitest,
Tailwind v4, radix-ui, sonner.

**Design doc:** `docs/plans/2026-06-28-nutrition-expansion-design.md`

**Çalışma dizini:** worktree `.worktrees/nutrition-expansion` (tüm komutlar burada).

---

## Phase 1 — Veri temeli

### Task 1.1: Şemaya enum + 4 tablo ekle

**Files:**
- Modify: `src/db/schema.ts` (Nutrition bölümünden sonra, ~line 620)

**Step 1:** `src/db/schema.ts` içinde enum bloklarına ekle (diğer pgEnum'ların yanında):

```ts
export const protocolTiming = pgEnum("protocol_timing", [
  "morning",
  "pre_workout",
  "intra_workout",
  "post_workout",
  "night",
]);
```

**Step 2:** `meals` tablosundan sonra ekle:

```ts
/** Athlete-owned saved meals: one-tap re-add with optional portion scaling. */
export const mealTemplates = pgTable(
  "meal_templates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    kcal: integer("kcal"),
    protein: integer("protein"),
    carbs: integer("carbs"),
    fat: integer("fat"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("meal_templates_athlete_idx").on(t.athleteId)],
);

/* ---- Supplement / timing protocols (compliance, NOT macros) ---- */

/** Coach-defined protocol shown to assigned athletes as a daily checkbox box. */
export const protocolTemplates = pgTable(
  "protocol_templates",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    timing: protocolTiming("timing").notNull(),
    instructions: text("instructions"),
    orderIndex: integer("order_index").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdBy: uuid("created_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("protocol_templates_active_idx").on(t.isActive, t.timing, t.orderIndex)],
);

/** Links a protocol template to a specific athlete (coach assigns). */
export const protocolAssignments = pgTable(
  "protocol_assignments",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    protocolId: uuid("protocol_id")
      .notNull()
      .references(() => protocolTemplates.id, { onDelete: "cascade" }),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    assignedBy: uuid("assigned_by").references(() => profiles.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("protocol_assignments_unique").on(t.protocolId, t.athleteId),
    index("protocol_assignments_athlete_idx").on(t.athleteId),
  ],
);

/** Athlete checked off a protocol on a given day (compliance record). */
export const protocolCompletions = pgTable(
  "protocol_completions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    protocolId: uuid("protocol_id")
      .notNull()
      .references(() => protocolTemplates.id, { onDelete: "cascade" }),
    athleteId: uuid("athlete_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    completionDate: date("completion_date").notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("protocol_completions_unique").on(
      t.protocolId,
      t.athleteId,
      t.completionDate,
    ),
    index("protocol_completions_athlete_date_idx").on(
      t.athleteId,
      t.completionDate,
    ),
  ],
);
```

**Step 3:** Commit.
```bash
git add src/db/schema.ts && git commit -m "feat(db): schema for meal templates + supplement protocols"
```

### Task 1.2: Yapısal migration üret + uygula

**Step 1:** `npm run db:generate:auto` → `drizzle/0021_*.sql` + `_journal.json` idx 19 + yeni snapshot. (Etkileşim olursa default'ları seç.)

**Step 2:** Üretilen `0021_*.sql`'i oku; SADECE yeni enum + 4 tablo (+ index/unique/FK) içerdiğini doğrula. Mevcut tabloya dokunan beklenmedik bir ALTER varsa DUR ve incele.

**Step 3:** `npm run db:migrate` → 0021 canlıya uygulanır (DATABASE_URL .env.local'den). Beklenen: "applied 0021...".

**Step 4:** Doğrula: `mcp__supabase__list_tables` (schema public) → 4 yeni tablo görünür.

**Step 5:** Commit.
```bash
git add drizzle/ && git commit -m "feat(db): generate 0021 nutrition+protocol tables migration"
```

### Task 1.3: RLS migration (elle) + uygula

**Files:**
- Create: `drizzle/0022_nutrition_protocols_rls.sql`

**Step 1:** Dosyayı yaz:

```sql
-- Hand-authored (RLS-only; NOT in the drizzle journal). Apply live via Supabase MCP.
-- meal_templates: owner-only. protocols: coach writes, assigned athlete reads,
-- athlete owns completions (and may only complete a protocol assigned to them).

ALTER TABLE public.meal_templates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocol_completions ENABLE ROW LEVEL SECURITY;

-- meal_templates: only the owner, every operation. Coach has NO access.
CREATE POLICY "meal_templates_all" ON public.meal_templates
  FOR ALL TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- protocol_templates: coach writes; assigned athlete (or any coach) reads.
CREATE POLICY "protocol_templates_select" ON public.protocol_templates
  FOR SELECT TO authenticated
  USING (
    public.is_coach()
    OR EXISTS (
      SELECT 1 FROM public.protocol_assignments a
      WHERE a.protocol_id = protocol_templates.id
        AND a.athlete_id = auth.uid()
    )
  );
CREATE POLICY "protocol_templates_write" ON public.protocol_templates
  FOR ALL TO authenticated
  USING (public.is_coach()) WITH CHECK (public.is_coach());

-- protocol_assignments: coach writes; coach or the assigned athlete reads.
CREATE POLICY "protocol_assignments_select" ON public.protocol_assignments
  FOR SELECT TO authenticated
  USING (public.is_coach() OR athlete_id = auth.uid());
CREATE POLICY "protocol_assignments_write" ON public.protocol_assignments
  FOR ALL TO authenticated
  USING (public.is_coach()) WITH CHECK (public.is_coach());

-- protocol_completions: athlete owns; coach reads. Athlete may only complete a
-- protocol that is currently assigned to them.
CREATE POLICY "protocol_completions_select" ON public.protocol_completions
  FOR SELECT TO authenticated
  USING (athlete_id = auth.uid() OR public.is_coach());
CREATE POLICY "protocol_completions_insert" ON public.protocol_completions
  FOR INSERT TO authenticated
  WITH CHECK (
    athlete_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.protocol_assignments a
      WHERE a.protocol_id = protocol_completions.protocol_id
        AND a.athlete_id = auth.uid()
    )
  );
CREATE POLICY "protocol_completions_delete" ON public.protocol_completions
  FOR DELETE TO authenticated USING (athlete_id = auth.uid());
```

**Step 2:** Uygula: `mcp__supabase__apply_migration` name `0022_nutrition_protocols_rls`, query = dosya içeriği.

**Step 3:** Doğrula: `mcp__supabase__get_advisors` (type security) → yeni tablolarda "RLS disabled" uyarısı OLMAMALI.

**Step 4:** Commit.
```bash
git add drizzle/0022_nutrition_protocols_rls.sql && git commit -m "feat(db): RLS for meal templates + protocols (0022)"
```

### Task 1.4: Tipleri yeniden üret

**Files:** Modify `src/lib/database.types.ts`, `src/lib/types.ts`

**Step 1:** `mcp__supabase__generate_typescript_types` → çıktıyı `src/lib/database.types.ts`'e yaz (tam dosya).

**Step 2:** `src/lib/types.ts`'e ekle:
```ts
export type MealTemplate = Tables<"meal_templates">;
export type ProtocolTemplate = Tables<"protocol_templates">;
export type ProtocolAssignment = Tables<"protocol_assignments">;
export type ProtocolCompletion = Tables<"protocol_completions">;
```

**Step 3:** `npm run typecheck` → temiz. Commit.
```bash
git add src/lib/database.types.ts src/lib/types.ts && git commit -m "feat(db): regenerate types for nutrition expansion"
```

---

## Phase 2 — Oto-kalori (4/4/9)

### Task 2.1: Saf makro mantığı (TDD)

**Files:** Create `src/lib/nutrition/macros.ts`, `src/lib/nutrition/macros.test.ts`

**Step 1 (failing test):** `macros.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { computeKcal, kcalMismatch, scaleMacros } from "./macros";

describe("computeKcal", () => {
  it("uses 4/4/9", () => {
    expect(computeKcal(40, 60, 20)).toBe(40 * 4 + 60 * 4 + 20 * 9); // 580
  });
  it("treats null/undefined macros as 0", () => {
    expect(computeKcal(null, null, null)).toBe(0);
    expect(computeKcal(30, undefined, 10)).toBe(30 * 4 + 90);
  });
});

describe("kcalMismatch", () => {
  it("null when no manual kcal or no macros", () => {
    expect(kcalMismatch(null, 40, 60, 20)).toBeNull();
    expect(kcalMismatch(580, 0, 0, 0)).toBeNull();
  });
  it("false within tolerance (default 10%)", () => {
    expect(kcalMismatch(580, 40, 60, 20)).toBe(false);
    expect(kcalMismatch(610, 40, 60, 20)).toBe(false); // ~5% over
  });
  it("true beyond tolerance", () => {
    expect(kcalMismatch(700, 40, 60, 20)).toBe(true); // ~20% over
  });
});

describe("scaleMacros", () => {
  it("scales and rounds each field", () => {
    expect(scaleMacros({ kcal: 580, protein: 40, carbs: 60, fat: 20 }, 1.5))
      .toEqual({ kcal: 870, protein: 60, carbs: 90, fat: 30 });
  });
  it("keeps nulls null", () => {
    expect(scaleMacros({ kcal: null, protein: 40, carbs: null, fat: null }, 2))
      .toEqual({ kcal: null, protein: 80, carbs: null, fat: null });
  });
});
```

**Step 2:** Run `npx vitest run src/lib/nutrition/macros.test.ts` → FAIL (module yok).

**Step 3 (impl):** `macros.ts`:
```ts
/** Macro→calorie math. 4 kcal/g protein & carbs, 9 kcal/g fat (Atwater). */
type Num = number | null | undefined;
const n = (v: Num) => (v == null || Number.isNaN(v) ? 0 : v);

export function computeKcal(protein: Num, carbs: Num, fat: Num): number {
  return Math.round(n(protein) * 4 + n(carbs) * 4 + n(fat) * 9);
}

/**
 * Whether a manually-entered kcal deviates from the 4/4/9 estimate beyond `tol`
 * (fractional, default 0.10). Returns null when there is nothing to compare
 * (no manual kcal, or macros all zero). Never blocks — UI shows a gentle hint.
 */
export function kcalMismatch(
  manualKcal: Num,
  protein: Num,
  carbs: Num,
  fat: Num,
  tol = 0.1,
): boolean | null {
  if (manualKcal == null) return null;
  const est = computeKcal(protein, carbs, fat);
  if (est === 0) return null;
  return Math.abs(n(manualKcal) - est) / est > tol;
}

type Macros = { kcal: Num; protein: Num; carbs: Num; fat: Num };
export function scaleMacros(m: Macros, factor: number) {
  const s = (v: Num) => (v == null ? null : Math.round(v * factor));
  return { kcal: s(m.kcal), protein: s(m.protein), carbs: s(m.carbs), fat: s(m.fat) };
}
```

**Step 4:** Run test → PASS. **Step 5:** Commit.
```bash
git add src/lib/nutrition/macros.ts src/lib/nutrition/macros.test.ts
git commit -m "feat(nutrition): pure 4/4/9 macro math (computeKcal, kcalMismatch, scaleMacros)"
```

### Task 2.2: Meal dialog'a canlı oto-kalori + ipucu

**Files:** Modify `src/app/(app)/beslenme/meal-dialog.tsx`

- p/c/f inputlarını controlled state'e al; `auto = computeKcal(p,c,f)`.
- kcal input: kullanıcı dokunmadıysa placeholder `auto` (ve boşsa submit'te auto'yu gönder — kcal alanına değer yazılı tut veya hidden fallback).
- `kcalMismatch(kcal, p,c,f)` true ise kcal altında caption: "≈{auto} kcal bekleniyor (lif/şeker alkolü sapma yaratabilir)". `text-caption text-lab-amber`.
- Mevcut form/aksiyon imzası korunur (`addMeal` kcal alıyor).

**Verify:** `npm run build` veya dev'de elle; `npm run typecheck`.
**Commit:** `feat(nutrition): live 4/4/9 kcal estimate + gentle mismatch hint in meal dialog`

---

## Phase 3 — Hazır öğün (template)

### Task 3.1: Server actions

**Files:** Modify `src/app/(app)/beslenme/actions.ts`

- `addMeal`: ek opsiyonel `saveAsTemplate` ("on"/null). True ise meal insert'inden
  sonra `meal_templates`'e de insert (aynı name+macros).
- `mealTemplateSchema` (name zorunlu, kcal/p/c/f `int(...)`, description ops.).
- `updateMealTemplate(prev, formData)` — id + alanlar; `eq("id", id)` update (RLS sahibi).
- `deleteMealTemplate(formData)` — id ile delete.
- `revalidate()`'e `/beslenme/hazir-ogunler` ekle.

**Commit:** `feat(nutrition): server actions to save/update/delete meal templates`

### Task 3.2: Meal dialog — "Yeni / Hazır öğünden" sekmeleri

**Files:** Modify `meal-dialog.tsx`; Modify `page.tsx` (template yükle + prop geçir)

- `page.tsx`: `meal_templates` (athlete_id eq, name order) çek → `<MealDialog templates={...} />`.
- Dialog'da radix `Tabs` (shadcn varsa `@/components/ui/tabs`; yoksa basit segmented).
  - **Yeni** sekmesi: mevcut form + "Bu öğünü hazır öğünlerime kaydet" checkbox (name `saveAsTemplate`).
  - **Hazır öğünden** sekmesi: template listesi (radio/seçim) + porsiyon çarpanı (×0.5/×1/×1.5/×2 segmented). Seçince "Yeni" alanlarını `scaleMacros` ile doldur (kullanıcı düzeltebilir) ya da doğrudan ekle. Boş durum: "Henüz hazır öğün yok."
- Not: `shadcn` Radix new-york stili (base-nova DEĞİL). Tabs yoksa `npx shadcn@latest add tabs` ile ekle.

**Commit:** `feat(nutrition): add-from-template tab with portion scaling + save-as-template`

### Task 3.3: Hazır öğün yönetim sayfası

**Files:** Create `src/app/(app)/beslenme/hazir-ogunler/page.tsx` (+ küçük client edit/delete bileşenleri)

- Server: athlete `meal_templates` listele (LabPage/LabHeader/PaperCard).
- Her satır: ad + makro rozetleri + düzenle (dialog/inline) + sil (server action form).
- Beslenme sayfasına link/buton: "Hazır öğünlerim".

**Verify:** `npm run typecheck`; dev'de CRUD.
**Commit:** `feat(nutrition): meal template management page (edit/delete)`

---

## Phase 4 — Görsel makro/kalori barları

### Task 4.1: MacroBar renk-kodlu durum + CalorieBar

**Files:** Modify `src/components/nutrition/macro-bar.tsx`; Modify `beslenme/page.tsx`

- `MacroBar`: durum hesapla — `under` (<%90), `on` (%90–110), `over` (>%110).
  - `on` → accent tam; `over` → accent + amber overflow işareti (ör. %100 çizgisi
    + taşan kısım amber/daha koyu cap); `under` → mevcut. API geriye uyumlu
    (label/value/target/accent korunur; içerik zenginleşir).
  - Hedef yoksa (target null) mevcut sade davranış.
- `CalorieBar` (yeni export ya da aynı dosyada): toplam kcal / hedef; kalan/aşım;
  "Bugün" kartında serif hero altına yerleştir. Tokenlarla animasyon, reduced-motion.
- DESIGN.md'de MacroBar açıklamasını güncelle (opsiyonel, küçük).

**Verify:** dev'de göz; `npm run typecheck`.
**Commit:** `feat(nutrition): color-coded macro states + total calorie progress bar`

---

## Phase 5 — Protokoller (sporcu tarafı)

### Task 5.1: Protokol sabitleri (TDD)

**Files:** Create `src/lib/nutrition/protocols.ts`, `protocols.test.ts`

**Test:** timing display sırası `["morning","pre_workout","intra_workout","post_workout","night"]`;
`PROTOCOL_TIMING_LABEL_TR` her timing için TR etiket; `sortByTiming` helper'ı timing
sonra order_index'e göre sıralar.

**Impl:** `protocols.ts`:
```ts
import type { ProtocolTemplate } from "@/lib/types";

export const PROTOCOL_TIMING_ORDER = [
  "morning", "pre_workout", "intra_workout", "post_workout", "night",
] as const;
export type ProtocolTiming = (typeof PROTOCOL_TIMING_ORDER)[number];

export const PROTOCOL_TIMING_LABEL_TR: Record<ProtocolTiming, string> = {
  morning: "Sabah (kalkınca)",
  pre_workout: "Antrenman öncesi",
  intra_workout: "Antrenman içi",
  post_workout: "Antrenman sonrası",
  night: "Gece (yatarken)",
};

export function sortByTiming<T extends Pick<ProtocolTemplate, "timing" | "order_index">>(
  items: T[],
): T[] {
  const rank = (t: string) => PROTOCOL_TIMING_ORDER.indexOf(t as ProtocolTiming);
  return [...items].sort(
    (a, b) => rank(a.timing) - rank(b.timing) || a.order_index - b.order_index,
  );
}
```
**Commit:** `feat(nutrition): protocol timing order + Turkish labels`

### Task 5.2: toggleProtocol server action

**Files:** Modify `beslenme/actions.ts`

- `toggleProtocol(formData)`: `protocolId`, `date`, `done` ("1"/"0").
  - done → `protocol_completions` upsert (onConflict protocol_id,athlete_id,completion_date).
  - !done → delete eq protocol_id+athlete_id+completion_date.
  - RLS WITH CHECK atama kontrolünü zaten yapar.
- `revalidate()` (/beslenme).

**Commit:** `feat(nutrition): toggleProtocol completion server action`

### Task 5.3: ProtocolChecklist + sayfaya bağla

**Files:** Create `src/components/nutrition/protocol-checklist.tsx`; Modify `beslenme/page.tsx`

- `page.tsx` ek yükler (Promise.all'a): atanan aktif protokoller
  (`protocol_assignments` athlete eq → join `protocol_templates` is_active),
  bugünün `protocol_completions` (athlete+date). Boşsa section gizle.
- `ProtocolChecklist` (client, `WaterTracker` optimistik kalıbı):
  `sortByTiming`; timing başlıkları; her protokol box: ad + talimat + checkbox.
  Checkbox `useOptimistic` + `toggleProtocol`. Tamamlanınca saat (`completed_at`).
- Kart başlığı `SectionLabel "Protokoller"`; lab-green/violet aksanlı; makro kartından ayrı.

**Verify:** dev'de işaretle/kaldır; `npm run typecheck`.
**Commit:** `feat(nutrition): athlete protocol checklist on nutrition page`

---

## Phase 6 — Koç haftalık beslenme özeti

### Task 6.1: Saf rapor mantığı (TDD)

**Files:** Create `src/lib/reports/nutrition-weekly.ts`, `nutrition-weekly.test.ts`

- Girdi: `weekDates: string[]` (7 gün), `meals` (date, eaten_at, name, macros),
  `target` (kcal/p/c/f|null), `assignments` (protocol_id, timing, name),
  `completions` (protocol_id, completion_date).
- Çıktı `NutritionWeeklyReport`:
  ```ts
  type DayMacros = { kcal: number; protein: number; carbs: number; fat: number };
  type ProtocolDay = { protocolId: string; name: string; timing: string; done: boolean; at: string | null };
  type NutritionDay = {
    date: string;
    meals: { time: string | null; name: string; kcal: number }[];
    totals: DayMacros;
    target: DayMacros | null;
    hit: { kcal: boolean | null; protein: boolean | null; carbs: boolean | null; fat: boolean | null };
    protocols: ProtocolDay[];
    protocolsDone: number;
    protocolsTotal: number;
  };
  type NutritionWeeklyReport = {
    days: NutritionDay[];
    weekTotals: DayMacros;
    avgKcal: number;
    daysLogged: number;
  };
  ```
- `hit`: hedef varsa toplam, hedefin %90–110 bandındaysa true (kcal), makrolar
  için ≥%90 true (aşım makroda da true sayılır? → karar: kcal band, makro ≥%90).
  Hedef yoksa null. Eşik sabitleri test edilebilir.
- Test: 2 günlük örnek; toplamlar, hit bayrakları, protokol done/total sayımı,
  avgKcal (sadece logged günler).
**Commit:** `feat(reports): pure weekly nutrition + protocol compliance builder`

### Task 6.2: Loader (server)

**Files:** Create `src/app/(app)/panel/sporcular/[athleteId]/nutrition-weekly-loader.ts`

- `loadNutritionWeekly(supabase, athleteId, weekStart, weekEnd, weekDates)`:
  - meals (athlete+date aralığı, eaten_at order),
  - nutrition_targets (athlete maybeSingle),
  - protocol_assignments (athlete) → join protocol_templates (is_active, timing, name),
  - protocol_completions (athlete, date aralığı).
  - `buildNutritionWeekly(...)` çağır.
- Koç erişimi RLS ile (sayfa zaten koç).
**Commit:** `feat(reports): nutrition weekly loader for coach`

### Task 6.3: View + sayfaya bağla

**Files:** Create `...[athleteId]/nutrition-weekly-report.tsx`; Modify `...[athleteId]/page.tsx`

- `page.tsx`: mevcut `week` searchParam'ı paylaş (kas raporu ile aynı weekStart/End).
  `loadNutritionWeekly` çağır, yeni section ekle (mevcut `CoachWeeklyReportView`'in altına/üstüne).
- `NutritionWeeklyReportView`: sakin tablo/zaman çizelgesi. Gün satırı: tarih +
  öğünler (saat·ad·kcal mono) + günlük makro toplam/hedef (renk: hit yeşil, kaçır
  amber, hedefsiz nötr) + protokol uyumu (done/total + timing noktaları,
  `report-colors`/lab tokenları). Boş hafta durumu.
**Verify:** koç olarak sporcu detayında göz; `npm run typecheck`.
**Commit:** `feat(panel): coach weekly nutrition + protocol compliance summary`

---

## Phase 7 — Koç protokol tanım/atama (minimum) + kapanış

> Not: Brief koç tarafı protokol TANIMINI ima ediyor (template + atama). Faz 7
> dashboard ayrı; burada koçun template oluşturup atayabileceği MINIMUM UI.

### Task 7.1: Koç protokol yönetimi (template CRUD + atama)

**Files:** Create `src/app/(app)/panel/protokoller/page.tsx` + actions; (ve/veya
sporcu detayına "protokol ata" bölümü).

- Koç: protokol template oluştur (name, timing, instructions, order), listele,
  düzenle, arşivle (is_active=false). Server actions (is_coach RLS).
- Atama: sporcu detay sayfasında ya da protokol sayfasında, bir protokolü
  sporcuya ata/kaldır (`protocol_assignments`).
- Panel navigasyonuna giriş ekle (mevcut panel kalıbına bak).
**Verify:** koç oluştur→ata; sporcu beslenme sayfasında görür.
**Commit:** `feat(panel): coach protocol templates + athlete assignment`

### Task 7.2: Test senaryosu dokümanı + tam doğrulama

**Files:** Create `docs/plans/2026-06-28-nutrition-expansion-test-scenario.md`

- Senaryo 1 (öğün→oto-kalori→kaydet→hazırdan ekle), Senaryo 2 (protokol→koç uyumu).
- `npm test` (tümü yeşil), `npm run typecheck`, `npm run lint`, `npm run build`.
- `mcp__supabase__get_advisors` (security + performance) temiz.
**Commit:** `docs(nutrition): manual test scenario + verification`

---

## Kapanış
- superpowers:requesting-code-review ile gözden geçir.
- superpowers:finishing-a-development-branch ile merge/PR kararı (kullanıcıya sor).

## Genel kurallar
- TR UI, EN kod/yorum. Sporcu mobil-öncelikli, koç web-öncelikli.
- DRY/YAGNI/TDD; her task'ta küçük commit.
- Mevcut `MacroBar`/`addMeal` API'lerini kırma; beslenme sayfasının çalışan akışı bozulmamalı.
- Migration'lar canlı paylaşılan Supabase'e (Frankfurt) uygulanır; yapısal değişiklik geriye uyumlu.
