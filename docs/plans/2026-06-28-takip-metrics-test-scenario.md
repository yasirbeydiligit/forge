# Test senaryosu — Günlük takip: seçilebilir kolonlar + relatif renk

`npm run dev` ile çalıştırıp aşağıdaki akışı izle. (Otomatik kapılar yeşil:
`npm run test` 225, `npm run typecheck`, `npm run lint`, `npm run build`. Canlı DB
`gscwjsqsklqpinrymtqe` / Frankfurt: `daily_metrics.digestion` kolonu eklendi,
`tracker_settings` tablosu RLS açık + 4 policy ile doğrulandı.)

Sporcu olarak giriş yap → **Günlük takip** (`/takip`).

## A. Kolon seçimi + sindirim
1. Sağ üstte **Kolonlar** düğmesine bas → "Takip ayarları" diyaloğu açılır.
2. Her metriğin yanında bir anahtar var: **Sindirim**'i aç, **RHR**'yi kapat → **Kaydet**.
3. Tabloda artık "RHR" kolonu yok, "Sindirim" kolonu (`/10`) **var**. Sıra registry
   sırasını korur (Kilo · Uyku · Enerji · Açlık · Uyum · Sindirim · Not).
4. Bir güne sindirim değeri gir (ör. 7). Alt **Bu hafta** kartlarında "Ort. sindirim"
   kartı belirir. Diyaloğu tekrar aç → tercih **kalıcı** (anahtarlar aynı kaldı).
5. **Veri kaybı yok kontrolü:** RHR'ye değer girilmiş bir günün varsa, RHR'yi kapatıp
   başka bir hücreyi düzenle → RHR'yi tekrar açtığında eski değer **duruyor**
   (gizli kolonlar kaydederken silinmez).

## B. Relatif renklendirme — kişisel ortalamaya göre
Renk için geçmiş gerek (görüntülenen haftadan önceki ~28 günde ≥4 ölçüm).
1. **Önceki hafta** okuna basıp 5 güne uyku ~7.5s gir (taban çizgisi oluşsun).
2. Bu haftaya dön. Üç gün gir: **5.5s**, **7.5s**, **9.5s**.
   - 5.5s → **rose** tint + aşağı `▼` (kendi normalinin altında).
   - 7.5s → renksiz (nötr band içinde — tablo sakin kalır).
   - 9.5s → **green** tint + yukarı `▲`.
3. **RHR (ters yön):** önce taban (~60 bpm × birkaç gün), sonra **52 bpm** → düşük nabız
   **green ▲** (düşük=iyi), **68 bpm** → **rose ▼**. Yani sayı düşse de "iyi" `▲` okunur —
   renk-körü için glyph anlamı taşır, sadece renge bağlı değil.

## C. Hedefe göre renk + kilo (trend-only)
1. **Kolonlar** → Uyku **hedef = 8** gir, Kaydet. Artık renk merkezi ortalama değil **hedef**:
   8s altı günler rose'a, 8+ yeşile kayar (geçmiş az olsa bile hedefle hemen renklenir).
2. **Kilo:** birkaç gün kilo gir. Kilo hücresi **hiç yeşil/kırmızı olmaz** — sadece nötr
   ton yön oku (`↑/↓/→`, ortalamaya göre hareket). İstersen Kolonlar'dan **hedef kilo** gir:
   alt karttaki "Ort. kilo" kartında "Hedefe X kg" ipucu çıkar (yine renk yargısı yok).

## D. Giriş deneyimi (mobil)
1. Bir hücreye dokun → içerik **otomatik seçilir** (üzerine yazmak kolay).
2. **Enter** → satırdaki **bir sonraki** hücreye geçer; son hücrede odak kalkar (kaydeder).
3. Sayısal hücrelerde mobil **sayı klavyesi** açılır (`inputMode`), kilo/uyku ondalıklı.
4. Değer aralık dışıysa blur'da sınıra çekilir (ör. uyku 30 → 24).

## Beklenen davranış / sınırlar
- Renk **yalnızca** sapmaları vurgular: nötr günler ve veri yetersizse (≥4 değilse, hedef
  de yoksa) **renksiz**. İlk gün yargılanmaz.
- Kolon seti `tracker_settings` satırında saklanır; hiç açılmadıysa varsayılan = eski 6
  metrik + Not (Sindirim opt-in) → mevcut kullanıcıda görünüm değişmez.
- En az bir kolon açık olmalı (hepsi kapatılırsa kayıt reddedilir, toast uyarır).

## RLS (canlı)
- `tracker_settings`: RLS açık, 4 policy (`select/insert/update/delete`). Sporcu yalnız
  kendi satırını okur/yazar; koç salt-okur (`is_coach()` — `daily_metrics` ile aynı desen).
- `daily_metrics` politikaları değişmedi; `digestion` mevcut sahiplik kuralına tabidir.
