# Nutrition Expansion — Manual Test Scenario

Date: 2026-06-28
Branch: `feature/nutrition-expansion`

Otomatik testler (vitest) saf mantığı kapsar: `macros` (4/4/9, mismatch,
scale), `protocols` (timing sırası/etiket), `nutrition-weekly` (günlük toplam,
hedef tutturma, uyum sayımı). Aşağıdaki senaryo uçtan uca UI doğrulaması içindir.

## Hazırlık
- Bir **koç** ve bir **sporcu** hesabı (mevcut seed: `seed:demo-athlete`).
- Sporcu bir programa kayıtlı olmasa da beslenme/protokol çalışır.

## Senaryo 1 — Öğün girişi → oto-kalori → kaydet → hazırdan ekle (sporcu)
1. Sporcu olarak **/beslenme** → **Öğün ekle**.
2. “Yeni” sekmesinde Pro **40**, Karb **60**, Yağ **20** gir.
   - **Beklenen:** kcal alanı otomatik **580** gösterir, yanında “oto” etiketi.
3. kcal’i elle **700** yap.
   - **Beklenen:** altında nazik amber ipucu (“≈580 kcal bekleniyor…”), **engellemez**.
4. Ad “Kahvaltı”, saat **08:00**, “**hazır öğünlerime kaydet**” işaretle → **Ekle**.
   - **Beklenen:** öğün zaman çizelgesinde 08:00’de görünür; makro barları akıcı
     dolar; toplam kalori barı görünür (hedef tanımlıysa).
5. Tekrar **Öğün ekle → “Hazır öğünden”**. “Kahvaltı”yı seç, porsiyon **×1.5**,
   **Forma aktar**.
   - **Beklenen:** “Yeni” sekmesi dolar; kcal **1050**, Pro **60**, Karb **90**,
     Yağ **30** (ölçeklenmiş, düzeltilebilir). **Ekle**.
6. **/beslenme/hazir-ogunler**: “Kahvaltı” listede. **Düzenle** (kalem) → adı
   değiştir → Kaydet. **Sil** (çöp) → kayıt kalkar.
7. Makro barları: hedefi aşınca **destructive (kırmızı) taşma** segmenti +
   “%X · aşım”; 90–110% arası **yeşil ✓ · tam**; altındaysa muted **%X**.

## Senaryo 2 — Protokol tanımı → atama → tamamlama → koç uyum görünümü
1. **Koç** olarak **/panel/protokoller** → **Protokol ekle**:
   - Ad “Pre-Workout”, Zaman “Antrenman öncesi”, Talimat “5g kreatin + 200mg
     kafein” → Oluştur.
   - İkinci protokol: Ad “Sabah”, Zaman “Sabah (kalkınca)”, Talimat “Multivitamin”.
2. **/panel/sporcular/<sporcu>** → **Protokol atamaları**: iki protokolde de
   **Ata** → “Atandı ✓”.
3. **Sporcu** olarak **/beslenme**: **Protokoller** kartı timing sırasıyla
   (Sabah, Antrenman öncesi) box’lar halinde görünür. Birini işaretle.
   - **Beklenen:** anında ✓ (optimistik) + tamamlanma saati; “1 / 2”.
4. **Koç** olarak **/panel/sporcular/<sporcu>** → **Haftalık beslenme**:
   - Gün gün öğünler (saatli), günlük makro hedef tutturma (renk), ve o günkü
     **Protokol x/y** + tamamlanan protokol yeşil ✓ (hover’da saat/timing).
   - Hafta okları kas raporuyla birlikte gezinir (ortak `week` param).
5. **RLS doğrulaması (negatif):** Sporcu yalnızca kendine **atanmış** protokolü
   görür/işaretler; atanmamış protokol için completion yazılamaz (WITH CHECK).
   meal_templates yalnızca sahibine; koç göremez.

## Doğrulama komutları (yeşil olmalı)
```
npm test           # tüm vitest (saf mantık)
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm run build      # next build (tüm rotalar derlenir)
```

## Migration durumu (canlı Frankfurt, ref gscwjsqsklqpinrymtqe)
- `0021_nutrition_protocols` (yapısal) — MCP ile uygulandı (drizzle journal idx 19,
  tag 0021’e renumber; bu projede `db:migrate` kullanılmıyor).
- `0022_nutrition_protocols_rls` (RLS) — MCP ile uygulandı.
- `get_advisors(security)`: yeni tablolarda RLS-disabled **yok**. Performans
  advisor’daki notlar (bare `auth.uid()`, indekssiz `created_by/assigned_by`,
  FOR ALL → çoklu permissive SELECT) projedeki 0001–0020 konvansiyonuyla
  **tutarlı**; yeni/özel bir risk değil. “unused_index” notları boş tablolar
  içindir, trafikle kalkar.
