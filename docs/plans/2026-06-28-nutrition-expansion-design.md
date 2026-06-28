# Nutrition Expansion — Design

Date: 2026-06-28
Branch: `feature/nutrition-expansion`
Status: approved (brainstorm)

Genişletiyoruz, bozmuyoruz: mevcut beslenme sayfası (günlük öğün listesi, makro
barları, su, araştırma kartı) çalışır halde kalır. Bu doküman 5 dilimin tasarımı.

## 1. Mevcut durum (baz alınan)

- **Şema** (`src/db/schema.ts`):
  - `nutrition_targets` — sporcu başına tek satır (`kcal, protein, carbs, fat,
    water_ml`). RLS `0006`: sahibi yazar, koç salt-okur.
  - `meals` — `athlete_id, meal_date, eaten_at (time), name, description, kcal,
    protein, carbs, fat`. Aynı RLS.
  - Su `daily_metrics.water_ml` üzerinden.
- **Sayfa** (`src/app/(app)/beslenme/page.tsx`) — server component; gün bazlı
  targets+meals+water okur; `MealDialog` / `TargetsDialog` (server action +
  `useActionState`); `MacroBar` (mount'ta dolan); `WaterTracker`; `InsightNotes`.
- **Mimari kurallar:**
  - Tek kaynak Drizzle şeması → SQL migration. **Tablo değişikliği**:
    `drizzle-kit generate` → numaralı `.sql`. **RLS-only**: elle yazılır,
    Supabase MCP `apply_migration` ile canlıya (Frankfurt, ref
    `gscwjsqsklqpinrymtqe`). Sıradaki numara **0021**.
  - `is_coach()` **global** rol kontrolü; koç-sporcu eşleşme tablosu yok. Her koç
    tüm sporcuları görür. `calendar_assignments.athlete_id` nullable precedent'i.
  - Koç rapor kalıbı: saf fonksiyon `src/lib/reports/*` (+ vitest) → loader
    (server) → view component; sporcu detayı `panel/sporcular/[athleteId]`.
- **Tasarım dili** (`DESIGN.md`): editöryal/kağıt. `lab-green`=beslenme,
  `lab-amber`=toparlanma, `lab-blue`=su/antrenman, `lab-violet`=genel. Serif
  hero rakam, mono veri. Lab primitifleri: `LabPage/LabHeader/PaperCard/
  SectionLabel/MarginNote`. Motion tokenları; reduced-motion global.

## 2. Kararlar (brainstorm)

- **Protokol atama:** sporcu bazında (ayrı `protocol_assignments`). Sporcu
  yalnızca kendine atananı görür.
- **Protokol tekrarı:** her gün gösterilir; sporcu o gün yaptığını işaretler.
  Tamamlama = (protokol, sporcu, tarih).
- **Protokol = tek işaretlenebilir BOX** (alt-checklist yok); talimat tek metin.
- **Hazır öğün:** sporcuya ait (sadece sahibi). Template'ten eklerken porsiyon
  çarpanı (×0.5–2) ile makro+kcal ölçeklenir, yine elle düzeltilebilir.
- **Oto-kalori:** client'ta canlı 4/4/9; DB'ye yalnızca nihai `kcal`. Tutarsızlık
  uyarısı client-side (>%10), engellemez.

## 3. Veri modeli (yeni)

Yapısal migration `0021_nutrition_protocols.sql` (drizzle generate).

```
meal_templates
  id           uuid pk default gen_random_uuid()
  athlete_id   uuid not null -> profiles(id) on delete cascade
  name         text not null
  description  text
  kcal,protein,carbs,fat  integer
  created_at   timestamptz not null default now()
  index (athlete_id)

protocol_timing  ENUM ('morning','pre_workout','intra_workout','post_workout','night')

protocol_templates
  id           uuid pk
  name         text not null            -- "Pre-Workout"
  timing       protocol_timing not null
  instructions text                     -- "5g kreatin + 200mg kafein"
  order_index  integer not null default 0
  is_active    boolean not null default true   -- soft archive
  created_by   uuid -> profiles(id) on delete set null
  created_at   timestamptz not null default now()
  index (is_active, timing, order_index)

protocol_assignments
  id           uuid pk
  protocol_id  uuid not null -> protocol_templates(id) on delete cascade
  athlete_id   uuid not null -> profiles(id) on delete cascade
  assigned_by  uuid -> profiles(id) on delete set null
  created_at   timestamptz not null default now()
  unique (protocol_id, athlete_id)
  index (athlete_id)

protocol_completions
  id              uuid pk
  protocol_id     uuid not null -> protocol_templates(id) on delete cascade
  athlete_id      uuid not null -> profiles(id) on delete cascade
  completion_date date not null
  completed_at    timestamptz not null default now()
  unique (protocol_id, athlete_id, completion_date)
  index (athlete_id, completion_date)
```

TR etiketler + gösterim sırası kodda (`src/lib/nutrition/protocols.ts`):
morning → pre_workout → intra_workout → post_workout → night.

## 4. RLS — `0022_nutrition_protocols_rls.sql` (elle, MCP ile uygula)

```
meal_templates  -- sadece sahibi (koç DEĞİL)
  ALL  USING athlete_id = auth.uid()  WITH CHECK athlete_id = auth.uid()

protocol_templates
  SELECT  is_coach()
          OR EXISTS(protocol_assignments a WHERE a.protocol_id = id
                    AND a.athlete_id = auth.uid())
  ALL(write)  USING is_coach()  WITH CHECK is_coach()

protocol_assignments
  SELECT  is_coach() OR athlete_id = auth.uid()
  ALL(write)  USING is_coach()  WITH CHECK is_coach()

protocol_completions
  SELECT  athlete_id = auth.uid() OR is_coach()
  INSERT/UPDATE/DELETE  athlete_id = auth.uid()
    + WITH CHECK ek: o protokol bana atanmış olmalı
      EXISTS(protocol_assignments a WHERE a.protocol_id = protocol_id
             AND a.athlete_id = auth.uid())
```

Uygula → `mcp__supabase__generate_typescript_types` → `src/lib/database.types.ts`
güncelle → `src/lib/types.ts`'e yeni tipler.

## 5. Özellik dilimleri

### 5.1 Oto-kalori (4/4/9)
- `src/lib/nutrition/macros.ts`: `computeKcal(p,c,f)=4p+4c+9f`;
  `macroKcalMismatch(kcal, p,c,f, tol=0.1)` → boolean/oran. Saf, testli.
- `meal-dialog.tsx`: p/c/f inputları izlenir; kcal placeholder/öneri canlı.
  kcal boşsa submit'te auto kullanılır (hidden veya doldurulmuş alan). Elle
  girilip sapma >%10 ise alan altında nazik ipucu (MarginNote/caption),
  engellemez. `addMeal` zaten kcal alıyor — değişiklik minimal.

### 5.2 Hazır öğün (template)
- Ekleme dialogunda **"Yeni / Hazır öğünden"** sekmesi (`Tabs`).
  - "Hazır öğünden": server'dan gelen `meal_templates` listesi; porsiyon çarpanı
    (×0.5/×1/×1.5/×2) makro+kcal ölçekler; "Yeni" sekmesine doldurarak geçiş ya
    da doğrudan ekle. Düzeltilebilir.
  - "Yeni" sekmesinde "Bu öğünü hazır öğünlerime kaydet" onay kutusu →
    `addMeal` aynı anda `meal_templates`'e de insert.
- Server actions (`actions.ts`): `addMeal` extend (saveAsTemplate flag);
  `addMealFromTemplate`/ölçekleme client'ta; `updateMealTemplate`,
  `deleteMealTemplate`.
- Yönetim: `/beslenme/hazir-ogunler/page.tsx` (liste + düzenle/sil).
- `page.tsx` `meal_templates` yükleyip `MealDialog`'a geçirir.

### 5.3 Makro barları (görsel)
- `MacroBar`: renk-kodlu durum — eksik (accent, soluk), tam (90–110%, accent
  dolu), aşım (amber overflow işareti). Tokenlarla; reduced-motion korunur.
- `CalorieBar` (yeni veya MacroBar genelleştir): "Bugün" kartında toplam kcal
  ilerlemesi; kalan/aşım görsel. Öğün eklendikçe (server re-render) akıcı dolar.

### 5.4 Protokoller (sporcu tarafı, beslenme sayfası)
- `page.tsx`: atanan aktif protokoller (join templates) + bugünün
  completion'ları yüklenir.
- `ProtocolChecklist` (client, `WaterTracker` optimistik kalıbı): timing-sıralı
  box'lar; her box'ta talimat + checkbox. İşaretle → `toggleProtocol` server
  action (upsert/delete completion, tarih bazlı). Tamamlanınca saat gösterilir.
- Kart: kendi `SectionLabel`'ı ("Protokoller"); makrodan ayrı (compliance).

### 5.5 Koç haftalık beslenme özeti
- `src/lib/reports/nutrition-weekly.ts` (saf) + test: girdi haftanın meals +
  targets + protocol completions/assignments; çıktı gün gün:
  öğünler (saatli), günlük makro toplamları vs hedef (tutmuş mu — renk),
  protokol uyumu (atanan vs tamamlanan, timing bazında).
- `nutrition-weekly-loader.ts` (server) — RLS koç erişimini sağlar.
- `nutrition-weekly-report.tsx` (view) — sakin tablo/zaman çizelgesi, mono
  sayılar, renk-kodlu uyum. `report-colors.ts` paleti.
- `panel/sporcular/[athleteId]/page.tsx`'e yeni section; mevcut `week`
  searchParam'ı paylaşır (kas raporuyla birlikte gezinir).

## 6. Test stratejisi (TDD)

Saf mantık önce test (vitest):
- `macros.test.ts`: computeKcal 4/4/9; mismatch eşiği.
- `protocols.test.ts`: timing sırası/etiketler.
- `nutrition-weekly.test.ts`: günlük toplamlar, hedef tutturma, uyum sayımı.

Manuel/entegre senaryo (doküman + uygulama):
1. Öğün gir → makro yaz → kcal otomatik → "hazır öğünlerime kaydet" → ekle.
2. Yeni öğün → "Hazır öğünden" → template seç → porsiyon ×1.5 → ekle.
3. Protokolü işaretle → koç `panel/sporcular/[id]` haftalık özette uyumu görür.

## 7. Riskler / notlar

- Worktree'de migration canlı paylaşılan Supabase'e uygulanıyor (Frankfurt);
  yapısal `0021` geri-uyumlu (yeni tablolar), mevcut akışı bozmaz.
- `database.types.ts` elle değil MCP `generate_typescript_types` ile üretilmeli.
- Mevcut `MacroBar` API'si korunur (page.tsx çağrıları kırılmaz); sadece içi
  zenginleşir + opsiyonel proplar.
- Koç özetinde N+1 kaçın: meals/completions haftalık tek sorguda çek.
