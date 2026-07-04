# Landing page — "Sayı 01" (2026-07-04)

Forge'un ilk pazarlama yüzü. Konsept: uygulamanın "basılı antrenman dergisi"
kimliği landing'de gerçeğe dönüşür — sayfa, derginin **kapağı + açılış
forması** gibi okunur. Teknoloji: **SVG + GSAP** (ScrollTrigger, SplitText,
DrawSVG; hepsi gsap 3.15 paketinde). Three.js yok, bitmap yok. Dil: Türkçe.

## Yerleşim

`/` (src/app/page.tsx): oturum yoksa landing render edilir; oturum varsa
mevcut rol yönlendirmesi aynen kalır (coach → /panel, athlete → /bugun).
`getProfile()` anonim ziyaretçide temiz `null` döndürür — auth değişikliği yok.

Bileşenler `src/components/landing/` altında. Statik içerik server component;
hareket, mevcut today/ desenindeki gibi küçük client sarmalayıcılarda
(`gsap.context` + reduced-motion koruması).

## Bölümler

1. **Masthead + hero** — dergi künye satırı (mono: SAYI 01 · TEMMUZ 2026 ·
   KAPALI TOPLULUK), büyük Newsreader "FORGE" nameplate, hairline cetveller.
   Manşet: **"Antrenman, yazıya dökülür."** SplitText satır-maske reveal.
   Alt metin: "Koçun yazar. Sen uygularsın. Her set kayda geçer."
   CTA: [Giriş yap] + "Davetin mi var?" ikincil bağlantı.
   Görsel: kendini çizen SVG halter figürü (DrawSVG) + mono "Şekil 1."
   figür altyazısı ve kg açıklamaları.
2. **Register ticker** — üst/alt hairline arasında mono uppercase marquee:
   log numuneleri (SQUAT 5×5 @ RPE 8 · 92,5 KG ▸ …). Transform-only, sonsuz.
3. **Nasıl çalışır** — üç editoryal sütun, semantik aksan renkleriyle:
   mavi (koç yazar) · yeşil (sporcu işler) · amber (birlikte izlenir).
   Her sütunda küçük animasyonlu SVG vinyet (takvim dolar, set tikleri,
   sparkline çizilir). Sol-şerit dili araştırma kartlarıyla aynı.
4. **İmza sahne: "Defter kendini yazar"** — pinlenmiş scroll sahnesi
   (yalnız lg+; mobilde in-view timeline). Büyük PaperCard logbook sayfası
   scroll ile dolar: mono sayılar sayar, tikler damgalanır, yeşil "PR"
   damgası hafif overshoot ile döner. Uygulamanın gerçek görsel gramerinin
   önizlemesi.
5. **Sezon numunesi** — "Bir sezonun dökümü" bandı: büyük serif sayaçlar
   (12 hafta · 48 antrenman · 4.820 set · 212.400 kg), açıkça örnek/numune
   olarak etiketli. Mono altyazılar.
6. **Pull quote** — renkli sol-şeritli araştırma-alıntı kartı, italik
   Newsreader: "Yazmak, antrenmanın yarısıdır."
7. **Davet + kolofon** — "Forge davetle çalışır." Kapalı topluluk açıklaması,
   [Giriş yap] + "Koçundan davet linki iste" notu. Footer: dergi kolofonu
   (kullanılan yazı tipleri, © 2026, minik mono künye).

## Hareket kuralları

- Tüm efektler `gsap.matchMedia("(prefers-reduced-motion: no-preference)")`
  içinde; animasyonlar `from` ile yazılır — JS/hareket olmadan içerik tam
  görünür (progressive enhancement, SEO-güvenli).
- Pinleme yalnız `(min-width: 64rem)`; mobil dikey akışta pin yok.
- Süre/ease dili mevcut tokenlarla uyumlu (power2.out, kısa süreler).

## Revizyon 2 (aynı gün, kullanıcı geri bildirimi)

İlk sürüm "logbook uygulaması" anlatıyordu; ürün artık çok daha geniş ve
terminoloji yanlıştı. Düzeltmeler + genişletme (kullanıcıyla dört karar):

- **Terminoloji:** RPE → **RIR** her yerde; **tonaj kaldırıldı** (ürün kararı:
  hacim = set sayısı). Defter sahnesi ve ticker RIR diliyle yazılır; sezon
  bandı: hafta · antrenman · set · **PR**.
- **İki forma (spread):** "Sporcu için" (bugün, defter/RIR, beslenme, kardiyo,
  takip, fizik, programlarım) ve "Koç için" (program yazımı, triage/uyarılar,
  sindirilmiş haftalık rapor, davet).
- **Kütüphane kendi bölümü:** hakemli makaleler + kaynaklı/alıntılı AI
  cevapları + ekranlara düşen insight notları.
- **İmza sahne + günün tamamı:** defter sahnesi (RIR diliyle) korunur;
  ardından animasyonlu "günün tamamı" grid'i (makro barları dolar, su, adım,
  kardiyo, uyku) — Forge'un tüm günü kapsadığını gösterir.
- Metin içeriği, Explore ajanının ekran-ekran envanterindeki birebir Türkçe
  etiketlerle hizalanır (uygulamanın kendi sözcükleriyle pazarlama).

## Doğrulama

- `npm run typecheck` + `lint` + `build`.
- Headless Chrome: 1440×900 ve 390×844'te tam sayfa + scroll-derinliği
  ekran görüntüleri; console hatası sıfır; yatay taşma denetimi
  (`scrollWidth <= innerWidth`); reduced-motion emülasyonuyla içerik tam.
- Git: `feat/landing-page` dalı; doğrulama sonrası main'e merge.
