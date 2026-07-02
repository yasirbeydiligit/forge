# Profile + Physique + Cardio/Steps — Test Scenario & RLS Verification

**Date:** 2026-07-02 · Branch `feat/profile-physique-cardio`
Design: `2026-07-02-profile-physique-cardio-design.md` · Plan: `2026-07-02-profile-physique-cardio.md`

## Automated verification (all green, 2026-07-02)

- `npm run test` — **269 tests, 28 files** (new: steps metric registry,
  `weightPolarityForGoal`, profile helpers ×10, cardio summary ×7)
- `npm run build` · `npm run lint` · `npm run typecheck` — clean
- Migrations **0025 + 0026 applied live** via Supabase MCP to
  `gscwjsqsklqpinrymtqe`; `drizzle-kit generate` reports "No schema changes";
  `database.types.ts` regenerated.
- Visual pass: headless-Chrome screenshots (mobile 390 + desktop 1280) of
  profil / fizik (timeline + compare) / takip (steps + kardiyo) / bugün via
  temp `/ornek` sample routes (deleted afterwards).

## Manual test script (athlete = mobile first)

### 1. Profil (`/profil`)
1. Aç: künye kartı (avatar, ad, rol) + Kimlik + Ölçüler/Tercihler bölümleri.
2. Kullanıcı adına `Deniz!!` yaz → kaydet → hata toast'ı (format). `deniz_y`
   yaz → kaydet → künyede `@deniz_y`.
3. Boy 183, doğum tarihi, cinsiyet, hedef **Yağ kaybı**, haftalık gün 4 seç →
   kaydet → künye meta satırı `28 yaş · 183 cm · Erkek` + yeşil hedef satırı.
4. Aynı kullanıcı adını ikinci kullanıcıda dene → "Bu kullanıcı adı alınmış."

### 2. Takip (`/takip`)
1. Tabloda **Adım** kolonu (varsayılan açık) — bugün 9500 gir, blur → kaydolur;
   ertesi gün ortalama kartı "Ort. adım" gösterir.
2. Kolonlar diyaloğu: Adım için hedef (ör. 10000) koy → renkler hedefe göre.
3. Hedef **Yağ kaybı** iken kilo hücreleri: son ortalamanın belirgin altı yeşil,
   üstü kırmızı; hedef **Güç/Form koruma** iken yalnız trend oku.
4. **Kardiyo ekle** → Yüzme, 30 dk (mesafe/kalori boş) → listede "Yüzme · 30 dk"
   + gün rozeti; hafta navigasyonu kardiyo listesine de uygulanır.
5. "Bu hafta" ızgarasında Kardiyo kartı: toplam süre + "N aktivite · en çok …".
6. Kayıt sil (×) → liste ve kart güncellenir.

### 3. Fizik (`/fizik`)
1. **Fotoğraf ekle**: JPEG seç (10MB+ reddedilir), tarih bugün, kilo
   placeholder'ı o günün takip kilosu, not opsiyonel → kaydet → ay grubunda kart.
2. İki fotoğraf seç → üstte Önce/Sonra karşılaştırma + `Δ N gün · ±X kg`.
3. Silme: çöp ikonu → onay → satır + storage objesi gider.
4. Oturumsuz kullanıcıyla imzalı URL süresi (1 saat) sonrası link ölür.

### 4. Bugün (`/bugun`)
1. Haftalık hedef 4 iken "Tamamlanan seans" kartı `2 / 4`; hedefe ulaşınca
   yeşil "Haftalık hedef tamam ✓".
2. Fizik kartı: son fotoğraf küçük görseli + "Son fotoğraf N gün önce";
   14 günü aşınca amber "Güncelleme zamanı" satırı; hiç yoksa ilk-fotoğraf CTA.

### 5. Koç paneli (`/panel/sporcular/[id]`)
1. Başlıkta sporcu meta satırı: hedef · hedef gün · yaş · boy.
2. **Fizik takip** bölümü: son 4 küçük görsel + "Tüm fotoğraflar +
   karşılaştırma" → salt-okunur zaman çizelgesi (silme yok, karşılaştırma var).
3. **Kardiyo** tablosu: son kayıtlar (tarih/aktivite/süre/mesafe/kalori).
4. Günlük takip tablosunda **Adım** kolonu.
5. Koç, sporcunun profil detayını **düzenleyemez** (UI yok; RLS de engeller).

## Live RLS verification transcript (JWT simulation, 2026-07-02)

Method: `execute_sql` içinde `BEGIN; SET LOCAL role authenticated; SET LOCAL
request.jwt.claims='{"sub":"<uid>",...}'; … ROLLBACK;` (Phase 3 tekniği).
Kimlikler: koç `ac1745ea…`, Sporcu B (Ilgaz) `cf53ba9b…`, Sporcu A (Demo)
`e740a7e5…`. Tüm mutasyonlar geri alındı.

| # | Senaryo | Beklenen | Sonuç |
|---|---------|----------|-------|
| 1 | A kendi `profile_details` insert + update | izinli | ✓ |
| 2 | B, A'nın detaylarını SELECT | 0 satır | ✓ 0 |
| 3 | B, A'nın detayını UPDATE | 0 satır etkilenir | ✓ (height 181 kaldı) |
| 4 | Koç, A'nın detayını SELECT | 1 satır | ✓ 1 |
| 5 | Koç, A'nın detayını UPDATE | 0 satır (salt-okunur) | ✓ (height 181 kaldı) |
| 6 | B, A'nın `physique_photos`/`cardio_sessions` SELECT | 0/0 | ✓ 0/0 |
| 7 | Koç, aynıları SELECT | 1/1 | ✓ 1/1 |
| 8 | Koç, foto/kardiyo DELETE | no-op | ✓ (satırlar kaldı) |
| 9 | B, `athlete_id=A` ile foto row INSERT | 42501 | ✓ blocked |
| 10 | B, A'nın klasörüne `storage.objects` INSERT | 42501 | ✓ blocked |
| 11 | A, kendi klasörüne object INSERT | izinli | ✓ |
| 12 | B, physique bucket SELECT | 0 | ✓ 0 |
| 13 | Koç, A'nın objelerini SELECT (imzalı URL bunu kullanır) | 1 | ✓ 1 |
| 14 | `anon`: 3 tablo + physique objeleri | hepsi 0 | ✓ 0/0/0/0 |
| 15 | Geçersiz kullanıcı adı (`Geçersiz Ad!`) | 23514 CHECK | ✓ blocked |

Bucket durumu: `physique` **private** (`public=false`, 10MB,
jpeg/png/webp), tablo RLS'leri aktif (12 policy) + 3 storage policy.
