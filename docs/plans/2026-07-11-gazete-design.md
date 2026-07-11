# Forge Gazete — Sporcu Dönem Raporu Tasarımı

**Tarih:** 2026-07-11
**Durum:** Onaylandı (brainstorming oturumu sonucu)

## Amaç

Sporcuların kendi başlarına ulaşabileceği, gazete/dergi formatında dönemlik
gelişim raporları. Koç haftalık takipte negatif tarafı zaten yönetiyor; Gazete
**motivasyon ve hedef sürekliliği** aracı. Temel ilke: **yalan asla yok** —
her övgü veriye bağlı, övgüyü hak etmek gerekir. Görsel olarak landing page
kalitesinde, GSAP'li, mobil öncelikli (asıl kitle sporcu telefonu).

## Onaylanan kararlar

| Karar | Seçim |
| --- | --- |
| Üretim modeli | Dönem kapanınca **donan sayılar** (snapshot, gerçek arşiv) |
| Tetikleme | **Tembel üretim**: sporcu `/gazete`'yi açınca kapanmış-basılmamış dönemler o anda basılır. Cron yok. |
| Dönem hizası | Haftalık = ISO Pzt–Paz; Aylık = takvim ayı; 3/6/9/12 ay = **sporcunun yolculuk başlangıcına göre** milestone; 12. aydan sonra her yıl dönümü |
| Metin motoru | **Kural tabanlı şablon havuzu** (LLM yok) — zorunlu veri slotları, deterministik seed ile varyant seçimi |
| Kimlik | **Forge Gazete**, rota `/gazete` |

## Veri modeli

Yeni tablo `report_issues`:

- `id` uuid PK
- `athlete_id` → profiles, cascade
- `period_type` enum: `weekly` | `monthly` | `milestone`
- `period_start`, `period_end` (date)
- `milestone_months` int, nullable (3/6/9/12/24…, sadece milestone)
- `issue_number` int — sporcu başına o period_type içinde artan sayı no
- `payload` jsonb — **sindirilmiş içerik** (aşağıda), ham veri değil
- `read_at` timestamptz nullable — "YENİ" rozeti / nav sayacı için
- `created_at`
- Unique: `(athlete_id, period_type, period_start)`

Payload bir kez basılınca **asla değişmez**; kod evrilse bile eski sayılar
aynı kalır. Fotoğraflar payload'da **ID olarak** durur; signed URL görüntüleme
anında üretilir (private bucket, hassas veri sızmaz).

### RLS

- Sporcu: kendi satırlarını SELECT + INSERT (üretim kendi ziyaretinde, kendi
  JWT'siyle) + read_at UPDATE.
- Koç: sporcusunun satırlarını SELECT (koç paritesi — panelden salt-okunur).

## Üretim akışı (tembel)

`/gazete` server sayfası açılınca:

1. Yolculuk başlangıcını bul: min(ilk log_session, ilk daily_metric, ilk
   enrollment start) — cache'lenebilir, her seferinde hesaplansa da ucuz.
2. Kapanmış dönemleri listele: haftalıklar (**backfill son 8 kapalı hafta ile
   sınırlı**), aylıklar (tam backfill), dolmuş milestone'lar (tam backfill).
3. Basılmamış olanlar için dönem verisini topla → saf builder → payload →
   INSERT. **Hiç verisi olmayan dönem basılmaz** (boş gazete = suçluluk hissi;
   ayrıca dürüst değil).
4. Arşivi göster.

## İçerik motoru (`src/lib/gazete/`, saf + test edilebilir)

### Fact çıkarımı

Dönem verisinden aday gerçekler: PR sayısı + en parlak PR; hacim/set trendi
(önceki döneme göre); antrenman tutarlılığı (hedef gün vs gerçekleşen); kilo
trendi (**hedefe göre yorumlanır**: fat_loss → düşüş övgü, muscle_gain → artış
övgü, maintenance → stabilite övgü); protein/kalori tutarlılığı; uyku
ortalaması değişimi; adım ortalaması; kardiyo toplamları; protokol uyumu; ilk
kez denenen hareketler; en iyi seans.

### Puanlama & seçim

Her fact "haber değeri" puanı alır (büyüklük × süreklilik × hedefe uygunluk).
En yüksek → **manşet**; sonraki 3–5 → hikâye blokları; kalan pozitifler →
istatistik kutuları.

### Dürüstlük garantisi (yapısal)

- Her cümle şablonunun zorunlu veri slotları var — fact yoksa cümle kurulamaz.
- Övgü eşikleri kodda açık sabit (örn. tutarlılık övgüsü ≥ hedefin %80'i).
- Veri yoksa bölüm görünmez; boş genelleme ("iyi gidiyorsun") asla basılmaz.
- Hedefe aykırı değişim (fat_loss'ta kilo artışı) övgüye dönüşemez — nötr
  istatistik olarak kalır ya da Editörün Notu'na gider.

### Editörün Notu

Sayı sonunda en fazla 2 nazik hatırlatma. Ton: uyarı değil hatırlatma
("uyku ortalaman biraz geriledi — koçun değinecektir"). Negatif iş koçta.

### Çeşitlilik

Fact tipi başına 3–5 manşet/cümle varyantı; sayı kimliğinden türetilen
deterministik seed ile seçim — üretim tekrarlanabilir, sayılar arası çeşitli.

## Görsel tasarım

Landing kimliğinin devamı: FORGE masthead, Newsreader serif manşet, mono
anotasyonlar, paper-grain. Server-render, JS'siz okunabilir,
`prefers-reduced-motion` korumalı (landing standardı).

### `/gazete` — arşiv/bayi

Masthead; en yeni sayı büyük "birinci sayfa" kartı; eskiler raf düzeninde
kronolojik. Milestone sayıları rozetli ("6. AY ÖZEL SAYISI"). Okunmamışta
"YENİ" rozeti; nav öğesinde okunmamış sayaç.

### `/gazete/[issueId]` — sayı (mobilde tek sütun)

1. **Masthead bandı** — FORGE GAZETE, sayı no, dönem, "X adına özel baskı" (mono)
2. **Manşet** — Newsreader dev punto, SplitText satır-maske girişi
3. **Lead hikâye** — sayan sayı + kendini çizen mini SVG grafik (DrawSVG)
4. **Hikâye blokları** — 3–5 alt haber, ScrollReveal, scaleX dolum barları
5. **Rakamlarla Bu Dönem** — mono borsa-tablosu; yükselenlerde ▲
6. **Foto karşılaştırma** (varsa) — dönem başı/sonu yan yana, tarih+kilo
   etiketli, clip-path perde reveal
7. **Editörün Notu** — küçük çerçeveli kutu
8. **Kapanış** — "Sonraki sayıda görüşmek üzere" + sonraki milestone geri sayımı

### Foto kuralları

Dönem başına/sonuna en yakın fotolar; tolerans aylıkta ±14 gün, milestone'da
±21 gün. İkisi birden yoksa bölüm yok. Haftalık sayılarda foto bölümü yok
(anlamlı değişim penceresi değil).

## Test & doğrulama

- **TDD (vitest):** dönem matematiği (ISO hafta, ay sınırı, milestone kenar
  durumları: 30 Kasım + 3 ay), backfill listesi, fact eşikleri, dürüstlük
  testleri (boş dönem → sayı yok; dolmayan slot → cümle yok; hedefe aykırı
  değişim övgü olamaz), deterministik seed.
- **Canlı doğrulama:** seed sporcu verisi + temp `/ornek` rotası + headless
  Chrome ekran görüntüleri (mobil viewport dahil); JWT simülasyonuyla RLS
  matrisi (sporcu kendi ✓ / başkası ✗, koç kendi sporcusu ✓ / yabancı ✗).

## Kapsam

**v1:** migration + RLS, üretim motoru, arşiv + sayı sayfaları, nav rozeti,
koç panelinden salt-okunur erişim, üç dönem tipi de dahil.

**Bilinçli dışarıda (YAGNI):** push bildirimi, PDF/paylaşım çıktısı, LLM
metin, devam eden dönemin taslak önizlemesi, sayıyı yeniden basma/düzenleme.
