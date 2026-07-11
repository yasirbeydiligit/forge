# Forge Gazete — Test & Doğrulama Kaydı

**Tarih:** 2026-07-11 · **Branch:** feat/gazete
**Tasarım:** `2026-07-11-gazete-design.md` · **Plan:** `2026-07-11-gazete-implementation.md`

## 1. Saf katman — vitest (69 gazete testi, toplam süit 422)

- `periods.test.ts` (19): ISO hafta kapanışı (Pazar günü hafta açık, Pazartesi
  kapalı), takvim ayı, milestone clamp (30 Kas + 3 ay = 28 Şub), 12 sonrası yıl
  dönümleri, 8 haftalık kayan backfill penceresi (pencere dışına düşen hafta
  bir daha due olmaz), basılmış eleme, kronolojik sıra.
- `aggregate.test.ts` (10): set/seans sayımı, set-sayısı hacim (tonaj ürün
  kararıyla dışarıda), PR frontier (dönem öncesi 100 kg varken dönemdeki 95 kg
  PR değil; ilk kayıt baseline), yeni hareket tespiti, tartım çıpaları (ilk/son
  3 ortalaması), nutrition-weekly bantları (0.9/1.1 tek kaynak), spark bucket
  tipleri (gün/ISO hafta/ay).
- `facts.test.ts` (19): **dürüstlük garantileri** — fat_loss'ta kilo artışı
  asla övgü olamaz (caution'a düşer), maintenance bandı, örneklem/eşik altı
  fact üretmez, previous yoksa volume_trend yok, %79 tutarlılık övgü değil
  %80 övgü; milestone'da kilo trendi çarpanı.
- `copy.test.ts` (9): eksik slot → cümle yok (çift güvence), deterministik
  varyant (djb2), havuz-slot tutarlılığı gerçek extractFacts çıktısıyla,
  Türkçe sayı biçimi (1,8 / 9.412).
- `build-issue.test.ts` (10): boş dönem → null, pozitifsiz → nötr övgüsüz
  kapak, manşet tekrarı yok, stories ≤ 5, editorNotes ≤ 2, statTable yalnız
  verili satırlar, determinizm (bit-bit aynı payload).

## 2. RLS matrisi — JWT simülasyonu (canlı DB, hepsi ROLLBACK)

Sporcu A = Ilgaz (cf53ba9b…), Sporcu B = Demo (e740a7e5…), Koç (ac1745ea…).
Tek koçlu model (`is_coach()`), "yabancı koç" senaryosu yok.

| Aktör | İşlem | Beklenen | Sonuç |
| --- | --- | --- | --- |
| Sporcu A | kendi INSERT | ✓ | ✓ |
| Sporcu A | kendi SELECT | 1 satır | ✓ |
| Sporcu A | kendi `read_at` UPDATE | 1 satır | ✓ |
| Sporcu A | kendi DELETE | 0 satır (arşiv silinmez) | ✓ |
| Sporcu A | kendi `payload` UPDATE | 42501 (kolon grant) | ✓ |
| Sporcu B | A'nın satırı SELECT | 0 satır | ✓ |
| Sporcu B | A'nın `read_at` UPDATE | 0 satır | ✓ |
| Sporcu B | A adına INSERT | 42501 | ✓ |
| Koç | A'nın satırı SELECT | 1 satır | ✓ |
| Koç | A'nın `read_at` UPDATE | 0 satır | ✓ |
| Koç | A adına INSERT | 42501 | ✓ |
| anon | SELECT | 0 satır | ✓ |

## 3. Uçtan uca üretim — canlı demo verisi

`generateDueIssues` Demo Sporcu için service-role ile çalıştırıldı
(geçici `scripts/verify-gazete-live.ts`, silindi; üretilen satırlar test
sonunda temizlendi ki sporcunun gerçek ilk ziyareti doğal bassın):

- İlk çalıştırma: **6 sayı** (5 haftalık + 1 aylık; yolculuk başı 1 Haz).
- İkinci çalıştırma: **0** — idempotens ✓.
- Dürüstlük gözlemleri: 1. hafta rekor iddiası yok (ilk kayıtlar baseline,
  manşet "3 yeni hareket denendi"); 2. hafta gerçek PR manşeti ("Deadlift
  konuştu: 110 kg"); editör notu yalnız hak edilen sayılarda (2 sayıda 1'er).

## 4. Görsel denetim — CDP headless Chrome (390×844 mobil + 1280 masaüstü)

Temp fixture rotaları `src/app/offline/ornek-gazete/*` (silindi) + scratchpad
`cdp-shot.mjs` (Emulation.setDeviceMetricsOverride).

- Yatay taşma yok: scrollWidth = innerWidth (390/390, 1280/1280) tüm sayfalarda.
- Kiosk: masthead, kapak kartı (SplitText giriş), raf, YENİ/ÖZEL rozetleri ✓.
- Sayı: manşet, sayan lead + DrawSVG spark, hikâye kartları + dolum barları,
  mono istatistik tablosu (▲ primary / ▾ nötr), foto perdesi (etiketli),
  Editörün Notu (amber kutu), kapanış + milestone geri sayımı ✓.
- Bulunan ve düzeltilen kusur: ondalık ayraç ("1.8 kg" → "1,8 kg") —
  `fillTemplate`/`trNum` tr-TR biçimlendirme + foto etiketi + storyStat;
  regresyon testi eklendi.

## 5. Bilinen sınırlar

- Gerçek sporcu oturumuyla tarayıcı akışı (nav rozeti → /gazete → sayı →
  rozet düşmesi) sporcu kimlik bilgisi gerektirdiğinden manuel doğrulamaya
  bırakıldı; aynı kod yolları yukarıdaki üç katmanla örtülü.
- Nav sinyalindeki "basılmamış dönem" sayısı üst sınırdır (boş dönem
  bilinemez); ilk ziyarette kendini düzeltir (tasarım kararı).
