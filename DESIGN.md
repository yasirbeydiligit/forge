# Forge — Design System

Forge'un görsel dili: **editöryal / basılı antrenman dergisi**. Sıcak krem
"kağıt" zemin, koyu yeşil aksan, üç-fontlu sistem ve renkli sol-şeritli
araştırma-alıntı kartları. Bu doküman tek kaynak token katmanını ve ortak
bileşenleri özetler. Tokenlar `src/app/globals.css` içinde tanımlıdır.

## Renk

OKLCH; hem `:root` hem `.dark` aynı açık paleti taşır (uygulama daima açık).

| Token | Rol |
|---|---|
| `--background` `oklch(0.965 0.008 85)` | Sayfa kremi (page) |
| `--surface` `oklch(0.985 0.005 85)` | Ara yüzey — iç dolgu, progress track, boş takvim hücresi |
| `--card` / `--paper` `oklch(0.995 0.003 85)` | Beyaz kart (raised) |
| `--foreground` / `--paper-foreground` | Mürekkep metin |
| `--paper-muted` / `--muted-foreground` | İkincil metin |
| `--paper-border` `oklch(0.89 0.01 85)` | Hairline kenarlık (her ekranda) |
| `--primary` `oklch(0.52 0.11 152)` | Yeşil aksan + focus ring |

Yüzey derinliği üç kademe: **page → surface → card** (artan açıklık + gölge).

### Semantik araştırma rengi (imza)

Bilgi alanını renge bağlayan **tek kaynak**. Sol şerit / nokta dili her yerde
bunu kullanır:

| Alias | Renk | Alan |
|---|---|---|
| `--accent-nutrition` | `--lab-green` | Beslenme |
| `--accent-recovery` | `--lab-amber` | Toparlanma |
| `--accent-training` | `--lab-blue` | Antrenman _(mavi — brief gereği)_ |

`--lab-violet` korunur (genel kullanım), `--lab-link` satır-içi bağlantı mavisi.
Su/hidrasyon `--lab-blue` ile gösterilir.

## Tipografi

Üç font: **Newsreader** (serif/display), **Geist Sans** (gövde), **Geist Mono**
(veri: sayı·set·kg·rpe·saat·eksen). Ölçek tek kaynak utility'lerde:

| Sınıf | Kullanım |
|---|---|
| `.text-display` | Sayfa başlığı (serif, clamp 2–2.75rem) |
| `.text-h1` / `.text-h2` | Bölüm başlıkları (serif) |
| `.text-label` | Tracked uppercase mono-etiket (11px, `0.16em`) |
| `.text-caption` | Küçük yardımcı metin (12px) |

**Kural:** büyük hero rakamı **serif**; birim · etiket · tablo/satır-içi veri
**mono**.

## Hareket

| Token | Değer |
|---|---|
| `--ease-out` (`ease-soft`) | `cubic-bezier(0.2,0.8,0.2,1)` |
| `--ease-in-out` | `cubic-bezier(0.4,0,0.2,1)` |
| `--dur-fast` / `--dur-base` / `--dur-slow` | `120ms` / `220ms` / `360ms` |

Tüm geçişler bu tokenları kullanır. `prefers-reduced-motion: reduce` global
olarak tüm transition/animation sürelerini ~0'a indirir (`@layer base`).

## Gölge & yüzey utility'leri

- `paper-shadow` — kartların yumuşak, alçak temel gölgesi.
- `shadow-raised` — hover/raised; biraz daha derin ama yine yumuşak.
- `paper-grain` — `--grain-image` ile döşenen kağıt dokusu.

## Atmosfer / grain

`PaperGrain` (`src/components/paper-grain.tsx`) — `fixed inset-0 -z-10`,
`pointer-events-none`, ~%4 opaklık, `mix-blend-multiply`. AppShell ve
`LabBackdrop` içine girer. Doku `--grain-image` değişkenindedir (varsayılan:
inline fractal-noise SVG). **Higgsfield asset'i geldiğinde** tek satır:

```css
:root { --grain-image: url("/textures/grain.png"); }
```

## Ortak bileşenler

- **lab primitifleri** (`src/components/lab/lab.tsx`): `LabPage`, `LabHeader`,
  `SectionLabel`, `PaperCard`, `MarginNote` (sol şerit: `green/amber/violet/blue`),
  `LabLink`.
- **`MeasureCard`** (`src/components/measure-card.tsx`): tüm metrik kartları —
  mono etiket, serif hero değer, opsiyonel mono birim / ikon / sparkline / hint,
  `accent` + `emphasis` (ör. bekleyen soru amber vurgusu). İlerleme, Takip,
  Panel hep bunu kullanır.
- **`MacroBar`** (`src/components/nutrition/macro-bar.tsx`): mount'ta dolan,
  yüzde + hedef-aşımı gösteren makro barı.
- **`WaterTracker`** (`src/app/(app)/beslenme/water-tracker.tsx`): hedefe dolan
  bardak; optimistik, bardak-bardak su kaydı (`daily_metrics.water_ml`).
- **`Sparkline`** (`src/components/logbook/sparkline.tsx`): saf-SVG, `color` prop.
- **`InsightNote`** (`src/components/library/insight-note.tsx`): imza alıntı
  kartı; alan→renk (`nutrition→green, recovery→amber, training→blue`).
- **`EmptyState`** (`src/components/empty-state.tsx`): editöryal boş durum +
  `illustration` slotu.

## İkonografi

`src/components/icon.tsx` — tek `<Icon name=… />` (lucide registry + override).
Özel kas/ekipman seti geldiğinde yalnızca `ICONS` registry değişir; çağrı
yerleri aynı kalır. Egzersiz satırları ve Kütüphane ilk adaptasyon hedefleri.

## Asset konvansiyonu (Higgsfield)

`public/` altında:

| Yol | İçerik | Bağlantı |
|---|---|---|
| `public/textures/grain.png` | Kağıt grain | `--grain-image` |
| `public/illustrations/*` | Boş-durum sanatları | `EmptyState illustration` / yerel art bileşenleri |
| `public/icons/exercise/*` | Kas/ekipman ikonları | `icon.tsx` ICONS registry |

## Ekran durumu

Görsel/UX katmanı uygulanan ekranlar: **Takvim** (sporcu + koç), **İlerleme /
Takip / Panel** (MeasureCard), **Beslenme** (canlı makro + su), **Feed**,
**Kütüphane**, **Panel hızlı işlemler**, **mobil alt navigasyon**.

İleride: "Tamamla" başarı animasyonu (logbook), özel ikon seti adaptasyonu,
Higgsfield asset'lerinin bağlanması.
