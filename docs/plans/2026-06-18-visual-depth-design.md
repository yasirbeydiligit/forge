# Forge — Görsel & Deneyimsel Derinlik (Tasarım)

_2026-06-18 · salt görsel/UX katmanı; fonksiyon, veri akışı, auth/RLS, server action'lar korunur._

## Amaç

Çalışan "Forge" uygulamasına editöryal/basılı antrenman dergisi hissini
sistematik biçimde kazandırmak. Jenerik shadcn admin dashboard'dan uzak;
mevcut **kasıtlı** dili (sıcak krem paper zemin, koyu yeşil aksan, üç-fontlu
sistem, renkli sol şeritli araştırma-alıntı kartları) koruyup derinleştirmek.

## Mevcut kimlik envanteri (KORUNUYOR)

- **Renk** (`globals.css`): page cream `oklch(0.965 0.008 85)`, kart near-white
  `oklch(0.995)`, yeşil aksan `oklch(0.52 0.11 152)`, hairline
  `oklch(0.89 0.01 85)`. `lab-*` semantik: green / amber / violet / link(blue).
- **Tipografi**: Newsreader (serif/display), Geist Sans (gövde), Geist Mono (veri).
- **İmza öğe**: `MarginNote` (`src/components/lab/lab.tsx`) — renkli sol şerit +
  tracked-uppercase etiket + serif-italik gövde. Üretimde `InsightNote` (RAG).
- **Yüzey**: `PaperCard` + `paper-shadow` (yumuşak, alçak gölge).

## Karar kayıtları (onaylı)

1. **Asset'ler**: grain saf CSS noise; illüstrasyon/ikon için isimlendirilmiş
   slot + fallback (Higgsfield çıktısı sonra tek değişkenden bağlanır).
2. **Su takibi**: gerçek — `daily_metrics.water_ml` + `nutrition_targets`
   su hedefi (additive migration + ufak action; RLS tabloyu zaten kapsar).
   _Beslenme adımında_ gelir, foundation'da değil.
3. **Tempo**: önce temel + Takvim → onay → kalan ekranlar sırayla.
4. **training = mavi**: brief "mavi=antrenman" diyor. `lab-violet` korunur ama
   semantik training aksanı maviye bağlanır (`InsightNote` dahil).
5. **Hero rakam = serif**: büyük istatistik değerleri serif (mevcut `StatCard`
   dili); mono ise birim · etiket · set · kg · rpe · saat · sparkline ekseni
   gibi satır-içi/tabular veri için. "Sayılar mono" kuralı satır-içi veriye.

## 1. Token katmanı (`globals.css`'e EKLER)

- **Hareket**: `--ease-out`, `--ease-in-out`; `--dur-fast 120ms / base 220ms /
  slow 360ms`. `@media (prefers-reduced-motion: reduce)` → süreler ~0.
- **Yüzey derinliği**: `--surface` (0.985, iç dolgu / track / boş hücre) page
  (0.965) ile kart (0.995) arasında. `--shadow-raised` (hover/raised).
- **Semantik araştırma rengi**: `--accent-nutrition`(green) /
  `--accent-recovery`(amber) / `--accent-training`(**blue**, yeni). MarginNote'a
  `blue` accent eklenir.
- **Tipografi ölçeği** (utility): `.text-display / .text-h1 / .text-h2 /
  .text-label / .text-caption` — tek kaynak; `SectionLabel`/`LabHeader` bunları
  kullanır.
- **Grain**: `.paper-grain` utility + `--grain-image` değişkeni (default inline
  SVG fractalNoise; ileride `/public/textures/grain.png` ile override).

## 2. Atmosfer

- `PaperGrain` overlay (`fixed inset-0 -z-10`, `pointer-events-none`, ~%4) →
  AppShell. Cream zemine "kağıt" dokusu; kartların opak paper'ı üstünü örter.
- Bölüm etiketleri tek sistemde: `SectionLabel` + `.text-label`.
- Hairline & kart kenarlık dili her ekranda `border-paper-border`.

## 3. Icon wrapper

`src/components/icon.tsx` — tek `<Icon name=…>` (lucide registry + override
hook). Özel kas/ekipman seti gelince tek dosyadan bağlanır. Foundation'da
oluşturulur; egzersiz/Kütüphane satırlarına ileriki cycle'larda adapte edilir.

## 4. Takvim (kanıt ekran — bu cycle)

`athlete-calendar.tsx` (+ `coach-calendar.tsx` aynı dile):

- **Hücre durumları** gerçek görsel ağırlıkla:
  - _Boş_: düz paper, muted gün no.
  - _Planlı_: hafif tint + sol renk şeridi; antrenman çipi + kas-grubu renk
    noktası (workout adından deterministik hue; gerçek kategori gelince map'lenir).
  - _Tamamlanmış_: yumuşak yeşil wash + tik — sakin "doluluk".
  - _Bugün_: ayrı ring + mono "BUGÜN"; planlı/tamamlanmışla çakışsa da okunur.
- **Mobil**: `sm` altı 7-kolon grid yerine dikey ajanda (aktif günler + bugün),
  min 44px dokunma hedefi.
- Ay başlığı + prev/next lab diline (mono, ghost ikon butonlar).
- Hareket token'larıyla hover; `prefers-reduced-motion` saygılı.

## Yol haritası (sonraki cycle'lar)

Takvim → **metrik kartları** (`MeasureCard` birleşimi: İlerleme + Takip + Panel)
→ **Beslenme** (canlı makro barları + su şişesi + migration) → **Feed** (koç
rozeti / soru-cevap durumu) → **Kütüphane** (zengin boş durum + öneri çipleri) →
**Panel** (4 stat → MeasureCard, amber vurgu) → **Navigasyon/mikro-etkileşim**
cilası. Bitince `DESIGN.md`.

## Git

`feat/visual-depth` dalı. Foundation bir commit, Takvim ayrı commit; her ekran
kendi commit'i. Dokunulan dosyalara kapsamlı (mevcut takip edilmeyen app
dosyalarını süpürmeden).
