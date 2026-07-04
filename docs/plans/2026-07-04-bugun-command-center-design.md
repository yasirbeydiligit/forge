# Bugün — Komuta Merkezi (vitrin) tasarımı

**Tarih:** 2026-07-04
**Durum:** onaylandı, uygulanacak

Sporcunun başlangıç ("Bugün") sayfasını, mevcut tüm modülleri (antrenman,
beslenme, takip, kardiyo, fizik, protokol, hidrasyon) tek bakışta toplayan bir
**komuta merkezi**ne dönüştürmek — ama editöryal sakinlikte. Mevcut sayfa
geliştirilir, bozulmaz.

## İlkeler

- **Editöryal dil korunur:** kağıt zemin, serif başlık, mono sayılar, bol nefes,
  araştırma kartı yerinde. "Komuta merkezi" hissi *yoğunlukla* değil,
  *hiyerarşi + isabetli hareketle* verilir.
- **Mobil-öncelikli:** sporcu telefonda açar. Özet kutuları mobilde tek/iki
  sütun; dokunma hedefleri ≥ 44px.
- **Hareket sistemli, süs değil:** yeniden kullanılabilir bir "hareket dili"
  paketlenir (`HydrationBottle`, `AnimatedNumber`, `RevealStagger`, sparkline
  draw). Hepsi `prefers-reduced-motion`'a saygılı. Sonradan İlerleme/Takip/Panel
  ekranları da bu bileşenleri alarak zenginleşebilir.
- **Yeni şema yok, yeni büyük özellik yok:** var olan tablolar + server
  action'lar (`adjustWater`, `toggleProtocol`) kullanılır.

## Karar kayıtları

1. **Three.js YOK.** Su objesi SVG + GSAP ile yapılır (dalgalı sıvı yüzeyi,
   path morph). WebGL mobilde ağır ve editöryal dille çelişir.
2. **Ad-hoc/serbest logger YOK (bu iş kapsamında).** Logger
   (`/antrenman/{gün}/seans`) hâlâ bir `assignment` zorunlu kılıyor. Plansız
   günde CTA "Antrenman seç" → programlar/takvim seçimine gider.
3. **Hidrasyon paylaşılan bileşen olarak zenginleştirilir:** `HydrationBottle`
   hem Bugün'de (hero) hem Beslenme'de (kompakt) `variant` prop ile kullanılır;
   server action aynı (`adjustWater`).

## Yerleşim (yukarıdan aşağı, mobil-öncelikli)

1. **Başlık** (`LabHeader`) — tarih · hafta no · selam + bugünün antrenman adı /
   "plan yok".
2. **Hafta şeridi** (`WeekStrip`, yeni) — 7 gün yatay şerit. Bugün vurgulu
   (nefes alan ring). Her günde durum: planlı (kas-grubu renk noktası),
   tamamlandı (check), boş. Dokun → `/antrenman/{gün}`. Yatayda taşarsa
   `overflow-x-auto`.
3. **Bugünün antrenmanı — akıllı giriş**:
   - Plan **var**: belirgin **"Antrenmanı başlat"** → `/antrenman/{gün}/seans?a={id}`
     (doğrudan logger) + egzersiz özeti (ilk ~5). Tamamlandıysa "Tamamlandı ✓ ·
     Özeti gör" → `/antrenman/{gün}`.
   - Plan **yok**: editöryal boş-durum ("Dinlenme günü olabilir 💪") + belirgin
     **"Antrenman seç"** → programlar/takvim.
4. **Özet kutuları** (mobilde 2 sütun grid, "ölçüm kartı" diliyle):
   - **Kalori + makrolar** (tam genişlik): `CalorieBar` + 3× `MacroBar`.
   - **Hidrasyon** (tam genişlik hero): `HydrationBottle` — SVG dalgalı şişe.
   - 2 sütun: **Adım** (hedefe mini ring + sayaç), **Kilo** (son değer + trend
     sparkline), **Kardiyo** (bugün/hafta süresi + aktivite), **Fizik** (son foto
     + bayatlık nudge).
   - **Protokoller** (tam genişlik `ProtocolChecklist`): *yalnızca* atanmış aktif
     protokol varsa görünür.
   - **Boş-durum kuralı:** veri yoksa kutu kaybolmaz, nazik bir "ekle" çağrısına
     döner (Forge dili). Adım/Kilo/Kardiyo/Fizik hep görünür.
5. **Hızlı erişim** kısayolları (korunur) + **InsightNotes / MarginNote**
   (araştırma kartı yerinde).

## Bileşenler

Yeni (client, animasyonlu):
- `HydrationBottle` — SVG dalgalı sıvı + GSAP fill/dalga + optimistik su ekleme
  (`variant: "hero" | "compact"`). Beslenme'deki `WaterTracker` bununla değişir.
- `WeekStrip` — 7 günlük şerit; giriş stagger + bugün ring + check draw.
- `AnimatedNumber` — mount'ta 0→değer sayan mono/serif rakam; `MeasureCard`'ın
  `value` prop'una geçilir (MeasureCard server kalır, ReactNode alır).
- `StepRing` — hedefe küçük dairesel ilerleme (SVG, draw-on).
- `RevealStagger` — bölümleri alttan yükselterek stagger'la açan sarmalayıcı.

Yeniden kullanılan: `MeasureCard`, `MacroBar`/`CalorieBar`, `ProtocolChecklist`,
`Sparkline`, `InsightNotes`, lab primitifleri, `workoutColor`.

## Hareket dili (GSAP)

- Giriş: `RevealStagger` — 8px alttan, opacity, 60ms stagger.
- Hero rakamlar: 0→değer sayaç (~600ms, `ease-soft`).
- Hidrasyon: sıvı yüksekliği tween + sürekli düşük genlikli dalga (2 SVG sinüs
  path, GSAP timeline); ekleme'de küçük splash.
- Sparkline: `stroke-dashoffset` draw-in.
- Hafta şeridi: bugün nefes ring; tamamlanan gün check draw.
- Hepsi tek `gsap.matchMedia()`; `(prefers-reduced-motion: reduce)` → final
  duruma anında oturur, tween yok.

## Veri çekimi (tek Promise.all, ~11 sorgu, request-cached)

1. Hafta `calendar_assignments` (weekStart..weekEnd, workout adı).
2. Hafta `log_sessions` (session_date, assignment_id, completed) — bugünün
   durumu + şerit tamamlanma + haftalık sayı, hepsi bundan türer.
3. `enrollments` count (program sayısı).
4. `nutrition_targets` (kcal/makro + water_ml).
5. Bugün `meals` (kcal/makro).
6. ~14 günlük `daily_metrics` penceresi (metric_date, weight, steps, water_ml) —
   bugünün su/adımı + kilo & adım trendi.
7. Bu hafta `cardio_sessions`.
8. `profile_details` (weekly_target_days).
9. Son `physique_photos` (+ imzalı thumb).
10. `protocol_assignments` (aktif) + 11. bugün `protocol_completions`.

Ayrıca `getAthleteInsights(...)` (mevcut).

Saf yardımcılar (`src/lib/today/`):
- `buildWeekStrip(days, assignments, sessions, todayKey)` → gün durumları.
- `summarizeToday(...)` → su/adım/kilo/kardiyo/protokol digest + trend serileri.
- `pickDefaultBoxes(...)` → hangi kutular görünür (protokol yalnızca atama varsa).

## Test

TDD — saf yardımcılar önce:
- `buildWeekStrip` — planlı/tamamlandı/bugün/boş durumları, hafta sınırları.
- `summarizeToday` — boş vs dolu; trend serilerinin doğru sırası; protokol digest.
- `pickDefaultBoxes` — protokol atamasız gizli, atamalı görünür.

Görsel/canlı doğrulama: geçici `/ornek` rotası + headless-Chrome ile iki
senaryo ekran görüntüsü — (a) dolu veri, (b) yeni kullanıcı (boş) — mobil 390px +
masaüstü + reduced-motion.

## Kapsam dışı (sonraya)

- Gerçek ad-hoc/serbest antrenman logger'ı (yeni şema + rota).
- Hareket dilinin İlerleme/Takip/Panel'e taşınması (bileşenler hazır olacak).
- Higgsfield grain/illustration asset bağlanması.
