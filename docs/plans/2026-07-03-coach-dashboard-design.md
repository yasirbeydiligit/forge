# Koç Dashboard — Triyaj, Uyarılar, Sporcu Detay Sekmeleri (Tasarım)

**Tarih:** 2026-07-03 · **Felsefe:** management by exception — koça dikkat
gerektiren sporcular öne çıkar; her şey yolunda olanlar katlanır.

## 1. Veri kaynakları (mevcut durum özeti)

| Boyut | Tablolar | Mevcut motorlar |
|---|---|---|
| Antrenman | `log_sessions` (athlete_id, session_date, completed), `log_sets` (weight/reps/rir, performed_at), `calendar_assignments` | `buildCoachWeekly` (kas-bazlı haftalık, Faz 2), `detectPlateau` (N-seans durgunluk, `PLATEAU_CONFIG.sessions=3`) |
| Beslenme | `meals` (gün+makrolar), `nutrition_targets` (tekil hedef satırı) | `buildNutritionWeekly` (`KCAL_BAND 0.9–1.1`, `MACRO_FLOOR 0.9`) |
| Protokol | `protocol_assignments`, `protocol_completions` (gün başına satır = yapıldı) | haftalık uyum `nutrition-weekly` içinde |
| Günlük takip / check-in | `daily_metrics` (kilo, uyku, RHR, enerji, adım…; gün başına 1 satır) — bu uygulamada "check-in" = günlük takip girişi | `tracker_settings` (hedefler) |
| Profil / hedef | `profile_details` (goal: muscle_gain/strength/fat_loss/maintenance, weekly_target_days) | `GOAL_LABEL_TR` |
| Feed | `feed_posts` (is_question/answered), `feed_comments`; **DB trigger**: koç yorum yazınca post otomatik `answered` | panel "cevaplanmamış sorular" |
| Erişim | Tek koçlu model: `public.is_coach()` RLS helper'ı koça tüm sporcu verisini okutur (0022/0026 deseni) | `requireCoach()` |

Koç↔sporcu ilişki tablosu yok; "koç yalnızca kendi sporcularını görür" bu
uygulamada rol-bazlı RLS ile sağlanıyor (tüm sporcular tek koçun).

## 2. Mimari karar: türetilmiş uyarılar + kalıcı "görüldü"

Uyarılar **DB'ye yazılmaz** — her panel yüklemesinde saf fonksiyonlarla
hesaplanır. Tek kalıcı şey koçun "görüldü/çözüldü" işareti:

```
alert_dismissals (id, athlete_id, alert_key, fingerprint,
                  dismissed_by, dismissed_at)
UNIQUE (athlete_id, alert_key, fingerprint) · RLS: yalnız koç (is_coach())
```

- **Neden türetilmiş?** Cron/worker gerekmez; veri düzelince uyarı kendiliğinden
  kaybolur (sporcu antrenman girince "3 gündür giriş yok" otomatik çözülür);
  bayat uyarı imkânsız.
- **Fingerprint** = uyarının "dönemini" kimlikleyen dize (ör. son seans tarihi,
  streak'in son günü, `plateau:<exerciseId>:<lastDate>`). Aynı koşul yeni veriyle
  yeniden oluşursa fingerprint değişir → uyarı yeniden görünür. Görüldü yapılan
  uyarı skoru ve "dikkat" sayacını etkilemez (dashboard temiz kalır).
- **Gelecek push/email:** aynı saf fonksiyonları bir edge function/cron da
  tüketebilir; şimdilik yalnız uygulama-içi rozet + günlük özet bandı.

## 3. Saf triyaj motoru — `src/lib/triage/`

Tamamı server-side saf ve vitest'li; eşikler tek `TriageConfig` objesinde.

```
config.ts   TriageConfig + DEFAULT_TRIAGE_CONFIG (tüm eşik ve ceza ağırlıkları)
types.ts    TriageInput (sporcu başına ham satır özetleri), Alert, TriageResult
alerts.ts   detectAlerts(input, config, today) -> Alert[]
score.ts    computeTriage(alerts, input, config) -> { score, band, lastActivity… }
```

`Alert = { key, category: 'adherence'|'performance', dimension: 'training'|
'nutrition'|'tracking'|'protocol', severity: 'warning'|'critical', titleTr,
detailTr, fingerprint, tabHref }`

### Uyum uyarıları (veri YOKLUĞU — "kullanıcı kayıp")

| key | Kural (varsayılan) | critical |
|---|---|---|
| `workout_gap` | `workoutGapDays=3` gündür seans yok (hiç yoksa hesap yaşı > eşik) | ≥ `workoutGapCriticalDays=7` |
| `meal_gap` | Dün dahil `mealGapDays=2` gündür öğün yok (bugün sayılmaz, gün bitmedi) | ≥ 5 gün |
| `checkin_gap` | `checkinGapDays=3` gündür `daily_metrics` yok | ≥ 7 gün |
| `protocol_low` | Atama varken son 7 günde tamamlama oranı < `protocolFloor=0.6` | < 0.3 |

### Performans uyarıları (veri VAR ama kötü — "kullanıcı zorlanıyor")

| key | Kural (varsayılan) | Tükettiği faz |
|---|---|---|
| `protein_low` | Loglanmış son `proteinLowDays=3` ardışık günde protein < hedef×`MACRO_FLOOR(0.9)` | Faz 4 + Faz 6 hedef |
| `plateau` | Son 28 günde çalışılan egzersizlerde `detectPlateau` stalled — tek uyarıda gruplanır ("3 egzersizde durgunluk: Bench…") | Faz 2 |
| `weight_trend` | Haftalık ort. kilo, hedefe ters yönde ≥ `weightTrendWeeks=2` hafta üst üste ≥ `weightTrendMinKg=0.3`/hafta (fat_loss↑ veya muscle_gain↓) | Faz 6 hedef |
| `rir_extreme` | Son `rirSessions=3` seansta ort. RIR ≥ 3.5 (hep çok temkinli) veya ≤ 0.5 (hep sınırda), ≥6 RIR'lı set şartıyla | Faz 1 RIR |

İki kategori mantıksal + görsel olarak ayrı: uyum = **kesikli** kenarlıklı amber
grup ("geri getir" aksiyonu), performans = **dolu** kenarlıklı grup ("programı /
beslenmeyi gözden geçir"). Kritik her iki grupta `--lab-rose`.

### Skor & bant

- `score = 100 − Σ ceza`, clamp 0–100. Cezalar (yapılandırılabilir):
  uyum warning 20 / critical 50; performans warning 12 / critical 30.
- **Bant uyarıdan türer** (okunabilirlik): açık critical → kırmızı, açık
  warning → sarı, hiç açık uyarı yok → yeşil. Skor sıralama + gösterge.
- Görüldü yapılmış uyarılar skora ve banta girmez.
- Sıralama: skor artan (en kötü üstte); eşitlikte son aktivitesi eski olan önce.
- Sıfır açık uyarısı olanlar "Sorunsuz (N)" başlığı altında katlanır.

## 4. Toplu yükleyici — `src/lib/triage/load-triage.ts`

N+1 yok: sporcu sayısından bağımsız ~9 sorgu, hepsi tarih-pencereli ve mevcut
`(athlete_id, date)` index'lerine oturur (yeni index gerekmez):

1. `profiles` (role=athlete) + `profile_details` — 2 sorgu
2. `log_sessions` son 35 gün (plato penceresi dahil)
3. `log_sets` × `log_sessions!inner` son 28 gün (plato istatistiği, min kolon)
4. `meals` son 14 gün (yalnız tarih+makro)
5. `daily_metrics` son 28 gün (kilo trendi + check-in)
6. `nutrition_targets` (tümü)
7. `protocol_assignments` + `protocol_completions` son 7 gün — 2 sorgu
8. `alert_dismissals` (açık fingerprint eşleşmesi için)

Loader satırları sporcuya göre gruplar → `TriageInput[]` → saf motor. React
`cache()` ile sarılır: layout (rozet) + panel (board) aynı render'da tek sefer
hesaplar. 50 sporcuda beklenen satır hacmi < ~20k; ileride gerekirse SQL view /
materyalize önbellek notu.

## 5. UI

### Panel (`/panel`) — koruyarak genişlet

1. **Üst MeasureCard'lar:** mevcut 4'e 5.si eklenir: "Dikkat" (rose accent,
   `emphasis` >0'da) = açık uyarısı olan sporcu sayısı. Bekleyen soru amber
   vurgusu aynen kalır. Grid `grid-cols-2 sm:grid-cols-3 lg:grid-cols-5`.
2. **Günlük özet bandı** (toplulaştırılmış bildirim): "Bugün 3 sporcu dikkat
   istiyor · 1 kritik" + kritikler isimle. Uyarı yoksa yeşil "Herkes yolunda".
3. **Triyaj board'u:** banta göre sıralı sporcu kartları. Kart: sol şerit
   (yeşil/sarı/kırmızı), avatar+isim, **skor halkası** (SVG, GSAP ile çizilir),
   kısa brief ("son aktivite 2g önce · 2 uyum + 1 performans uyarısı"), en
   önemli 2 uyarı çipi (kategori-ayrımlı), her uyarıda "Görüldü" düğmesi
   (server action). Kart → sporcu detayının ilgili sekmesine link.
4. **Sorunsuz sporcular:** katlanmış kompakt satır listesi (`<details>`).
5. Cevaplanmamış sorular + hızlı işlemler bölümleri aynen korunur.
6. **Nav rozeti:** koç nav'ında "Panel" öğesine dikkat sayısı (AppShell'e
   `attentionCount`; layout `cache()`li loader'ı çağırır). Feed rozeti kalır.

### Sporcu detayı (`/panel/sporcular/[athleteId]`) — sekmeli

Sekmeler `?tab=` query param'ı ile server-rendered (paylaşılabilir URL, `week`
param'ı korunur): **Genel** · **Antrenman** · **Beslenme** · **Takip** ·
**Fizik**. ("Check-in" bu uygulamada günlük takip girişinin kendisi → Takip
sekmesi ikisini birden karşılar; Profil özeti başlıkta kalır.)

- **Genel:** skor halkası + iki kategori halinde açık uyarılar (görüldü
  aksiyonlu) + kayıtlı/kendi programları.
- **Antrenman:** Faz 2 haftalık kas raporu + plato notları + seans geçmişi +
  antrenman uyarıları.
- **Beslenme:** Faz 4 haftalık beslenme/protokol raporu + protokol atamaları +
  beslenme/protokol uyarıları.
- **Takip:** günlük metrik tablosu + kilo trendi (hedefe göre yön) + kardiyo +
  takip uyarıları.
- **Fizik:** fotoğraf ızgarası + karşılaştırma linki.
- **Hızlı dokunuş:** başlıkta "Mesaj gönder" → slide-over: sporcunun son feed
  gönderileri + satır-içi yorum kutusu (mevcut `addComment`; koç yorumu DB
  trigger'ıyla soruyu otomatik "cevaplandı" yapar). Gönderisi yoksa boş durum.
  Not: feed topluluk-görünür — gerçek DM ileride ayrı özellik.

### Görsel dil

Editöryal Forge dili: PaperCard, serif hero skor, mono etiketler, `--lab-*`
tokenları. **GSAP eklenir** (yalnız panel board'unda): kart stagger girişi, skor
halkası çizimi, sayı count-up; `prefers-reduced-motion`'da kapalı. **Three.js
bilinçli olarak yok**: kağıt/dergi estetiğiyle çatışır, bundle maliyeti yüksek,
bu ekranın değeri okunabilirlik.

## 6. Migration & RLS

- Drizzle şemasına `alert_dismissals` → `drizzle-kit generate` (0028) + el
  yazımı `0029_alert_dismissals_rls.sql` (SELECT/INSERT/DELETE yalnız
  `is_coach()`; UPDATE yok — görüldü geri alma = satır silme).
- Canlıya Supabase MCP `apply_migration` ile; sonra `database.types.ts`
  yenilenir ve `drizzle-kit generate` "No schema changes" doğrulanır.

## 7. Test planı

- **vitest TDD:** `alerts.test.ts` + `score.test.ts` — her uyarı tipi için
  tetiklenen/tetiklenmeyen/critical senaryolar, streak'in loglanmamış günle
  kırılması, fingerprint yenilenmesi, dismissal filtresi, bant/sıralama.
- **Canlı RLS matrisi:** `alert_dismissals` için JWT simülasyonu (koç ✓, sporcu
  A ✗, sporcu B ✗, anon ✗) canlı DB'de.
- **Görsel doğrulama:** geçici `/ornek/triyaj` rotası fixture veriyle; headless
  Chrome mobil (390px) + masaüstü (1440px) ekran görüntüleri; sporcu detay
  sekmeleri aynı yöntemle.
- **Test senaryosu dokümanı:** triyaj sıralaması, iki uyarı türü, sekmeler,
  hızlı dokunuş → `docs/plans/2026-07-03-coach-dashboard-test-scenario.md`.
