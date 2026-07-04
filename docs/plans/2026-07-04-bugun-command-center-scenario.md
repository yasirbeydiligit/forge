# Bugün — Komuta Merkezi: test senaryosu

**Tarih:** 2026-07-04

Bugün sayfası iki uçta da doğrulandı: **dolu veri** (aktif sporcu) ve **boş
veri** (yeni kullanıcı). Saf katman vitest ile, görsel katman geçici `/ornek`
harness'ı + headless-Chrome (CDP `prefers-reduced-motion: reduce` emülasyonu, ki
GSAP giriş animasyonları final duruma otursun) ile mobil 390px + masaüstünde
yakalandı.

## Otomatik testler (vitest, 10 test)

- `src/lib/today/week-strip.test.ts` — `buildWeekStrip`: boş hafta (7 dinlenme,
  tek bugün), geçmiş gün işareti, gün başına planlı adlar (giriş sırası korunur),
  plansız-ama-tamamlanmış gün, null workout'u yok sayma.
- `src/lib/today/metrics-window.test.ts` — `summarizeMetric`: boş satırlar,
  kronolojik non-null seri, latest/previous + işaretli delta, bugüne özel değer,
  PG numeric-string coercion + non-finite'i eksik sayma.

`npm test` → 342/342 geçer. `npm run build` → temiz. `tsc --noEmit` + `eslint`
temiz.

## Senaryo A — Dolu veri (aktif sporcu)

Girdi: bugün planlı "İtiş Günü" (5 egzersiz + 2 fazla), hafta 3/4 seans (Pzt/Sal
tamamlı), 1840/2600 kcal + makrolar, 8.420 adım (trend), 79,4 kg (−0,3 trend),
1,5/3 L su, 45 dk kardiyo (koşu), 3 gün önce fizik, 3 protokol (2 tamam).

Beklenen görünüm:
- Hafta şeridi: 7 gün; bugün yeşil nefes-ring; Pzt/Sal yeşil check; Per/Cum renkli
  planlı noktası.
- Antrenman kartı: egzersiz özeti + belirgin yeşil **"Antrenmanı başlat"** →
  `/antrenman/{gün}/seans?a={id}`.
- Beslenme: sayaç 1.840, üç makro barı dolu.
- **Hidrasyon şişesi:** mavi sıvı ~%50, dalgalar; "+1 bardak" ile optimistik
  dolar (splash).
- Özet: Adım (sparkline), Kilo (trend + delta ipucu), Kardiyo (süre + aktivite),
  Fizik (son foto durumu). Masaüstünde tek sıra 4 kutu.
- Protokoller: Sabah/Antrenman öncesi/Gece grupları, 2/3.
- Bu hafta 3/4 + program 2; hızlı erişim; süreklilik notu.

## Senaryo B — Boş veri (yeni kullanıcı)

Girdi: plan yok, öğün/metrik/kardiyo/foto/protokol yok, su 0, program 0.

Beklenen görünüm ("boş değil, davet eden"):
- Başlık alt satırı: "… bugün planlı antrenman yok".
- Hafta şeridi: 7 dinlenme, bugün ringli.
- Antrenman: "Dinlenme günü olabilir 💪" + belirgin **"Antrenman seç"** →
  `/programlar` + "Takvim →".
- Beslenme / Adım / Kilo / Kardiyo / Fizik: her biri nazik bir **"ekle" çağrısı**
  (boş kutu yok).
- Hidrasyon: boş şişe (0/3 L), "+1 bardak" hazır.
- Protokoller bölümü **gizli** (atama yok).
- Bu hafta 0/0; süreklilik notu ivme çağrısı.

## Görsel doğrulama yöntemi (tekrar üretmek için)

Kalıcı harness yok (temiz kalsın diye silindi). Tekrar üretmek için: presentational
`TodayView` fixture'larla `/ornek` altında geçici bir route'a bağlanır,
middleware `PUBLIC_PATHS`'e geçici `"/ornek"` eklenir, `PORT=3111 npm run dev`
sonrası CDP script'i `prefers-reduced-motion: reduce` + `captureBeyondViewport`
ile 390px ve 1120px yakalar. Doğrulama sonrası route + middleware satırı geri
alınır.
