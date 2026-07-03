# Koç Dashboard — Test Senaryosu & Doğrulama Kaydı (2026-07-03)

Kapsam: triyaj sıralaması, iki uyarı türü, görüldü akışı, sporcu detay
sekmeleri, hızlı dokunuş, RLS. Tasarım: `2026-07-03-coach-dashboard-design.md`.

## 1. Saf mantık — vitest (43 test, tümü yeşil)

`npx vitest run src/lib/triage` → `alerts.test.ts` (33) + `score.test.ts` (10).

| Senaryo | Beklenen | Durum |
|---|---|---|
| Dün antrenman girmiş sporcu | `workout_gap` yok | ✓ |
| 3 gün boşluk / 7+ gün | warning / critical | ✓ |
| Hiç seans yok, hesap 4 günlük vs 1 günlük | uyarı var (fingerprint `never:*`) / grace period | ✓ |
| Dün öğün var (bugün boş) | `meal_gap` yok — gün bitmeden sayılmaz | ✓ |
| 2 gün / 5+ gün öğünsüz | warning / critical | ✓ |
| Check-in 3 gün / 7+ gün yok | warning / critical | ✓ |
| Protokol oranı 0.71 / 0.5 / 0.21 (atama yoksa) | yok / warning / critical (yok) | ✓ |
| Protein: loglu son 3 gün < %90 hedef; loglanmamış gün streak'i KIRMAZ; son gün hedefte ise sıfırlanır | warning yalnız ilk durumda | ✓ |
| 2 egzersiz plato + 1 ilerleyen | TEK gruplu uyarı, ilerleyen listede yok | ✓ |
| fat_loss 2 hafta kilo ↑ / muscle_gain ↓ / maintenance-strength / tek hafta / <0.3 kg | warning / warning / yok / yok / yok | ✓ |
| RIR 3 seans ort ≥3.5 / ≤0.5 / 2 seans / az set / normal | warning(temkinli) / warning(sınırda) / yok / yok / yok | ✓ |
| Skor: uyum > performans cezası (80 vs 88); 5 kritik → 0'a clamp | ✓ | ✓ |
| Bant: warning→amber, herhangi critical→red, uyarısız→green | ✓ | ✓ |
| Dismissal: aynı (key, fingerprint) düşer; fingerprint değişince YENİDEN yüzeye çıkar; başka sporcununki etkilemez | ✓ | ✓ |
| Sıralama: skor artan; eşitlikte bayat aktivite önce (hiç aktivite = en eski) | ✓ | ✓ |

## 2. Görsel — headless Chrome (geçici /ornek rotaları, silindi)

Fixture'lar GERÇEK motor + GERÇEK bileşenlerle render edildi
(`detectAlerts`+`computeTriage` → `TriageBoard`/`AlertGroups`/`DigestBanner`).
Çekimler: masaüstü 1440px + mobil 500px, `--force-prefers-reduced-motion`
(deterministik final durum; ayrıca reduced-motion yolunu doğrular).

- **Panel/triyaj:** 5 MeasureCard (Dikkat rose+kritik hint) · günlük özet bandı
  ("Bugün 3 sporcu dikkat istiyor · 1 kritik (Deniz Aksoy)") · kartlar skor
  sırasıyla 0 → 64 → 80 · kritik uyarılarda "KRİTİK" rozeti · uyum kesikli
  amber / performans dolu viyole çerçeve ayrımı net · "+N uyarı daha" taşması ·
  "Sorunsuz sporcular (2)" katlanmış. Mobilde yatay taşma yok.
- **Sporcu detayı:** sekme çubuğu (Genel 5 · Antrenman 2 · Beslenme 2 · Takip 1
  · Fizik) rozetli; Genel'de iki kategori ayrı başlıkla, uzun detay satırlarıyla;
  başlıkta Mesaj düğmesi + skor halkası. 500px'te sekmeler sığıyor.
- **Hızlı dokunuş:** sheet açık halde; "Yanıt bekliyor" rozeti, satır-içi yanıt
  formu + Gönder; feed-görünürlüğü uyarısı metinde.
- Konsolda hata yok (eşleşen "error" dizeleri sonner CSS değişkenleri).
- Düzeltme: skor 0'da halka yayının rounded-cap "nokta" artefaktı → yay skor
  0'da çizilmiyor.

## 3. Canlı RLS matrisi — `alert_dismissals` (JWT simülasyonu, hepsi ROLLBACK)

Koç `ac1745ea…`, Sporcu A `cf53ba9b…` (Ilgaz), Sporcu B `e740a7e5…` (Demo).

| # | Aktör | İşlem | Beklenen | Sonuç |
|---|---|---|---|---|
| 1 | Koç | INSERT + SELECT | 1 satır görür | ✓ 1 |
| 1b | Koç | DELETE + SELECT | 0 satır | ✓ 0 |
| 2 | Sporcu A | SELECT (koç eklemişken) | 0 satır | ✓ 0 |
| 3 | Sporcu A | INSERT (kendi uyarısını "görüldü" yapma) | 42501 deny | ✓ 42501 |
| 4 | Sporcu B | DELETE (koçun kaydını silme) | no-op, satır kalır | ✓ 1 |
| 5 | Koç | INSERT `dismissed_by` sahte (başkası) | 42501 deny (WITH CHECK) | ✓ 42501 |
| 6 | anon | SELECT | 0 satır | ✓ 0 |
| 7 | anon | INSERT | 42501 deny | ✓ 42501 |

## 4. Canlı loader sorguları — gerçek koç JWT'si

`signInWithPassword` (seed koç) ile load-triage'ın 10 sorgusu birebir koşuldu:
hepsi hatasız; `log_sets` × `log_sessions!inner` embedded-filter join'i örnek
satırla doğrulandı (97 set satırı, athlete_id/session_date gömülü geldi).
Toplam sorgu sayısı sporcu sayısından bağımsız (N+1 yok); tüm filtreler mevcut
`(athlete_id, tarih)` index'lerine oturur, yeni index gerekmedi.

## 5. Manuel akış senaryoları (canlı kullanım için)

1. **Triyaj:** `/panel` → en riskli sporcu en üstte, şerit rengi banda uygun.
2. **Görüldü:** bir uyarının göz düğmesi → uyarı listeden düşer, Dikkat sayacı
   ve nav rozeti azalır; sporcu yeni veri girip koşul yeniden oluşursa
   (fingerprint değişir) uyarı geri gelir.
3. **Sekme yönlendirme:** karttaki uyarıya tıkla → sporcunun ilgili sekmesi
   (`?tab=`) açılır; hafta gezintisi (`?week=`) sekmeyi korur.
4. **Hızlı dokunuş:** detayda Mesaj → sporcunun sorusuna yanıt yaz → soru
   feed'de "Cevaplandı"ya döner (DB trigger), panel bekleyen soru sayısı düşer.
5. **Rozet:** koç nav'ında Panel öğesinde açık-uyarılı sporcu sayısı (rose).

## 6. Final kapılar

- `npm run test` ✓ (tüm suite) · `npm run typecheck` ✓ · `npm run lint` ✓ ·
  `npm run build` ✓ (bu dokümanın commit'iyle aynı turda koşuldu).

## 7. Geri bildirim turu (2026-07-03, akşam)

Kullanıcı geri bildirimiyle üç değişiklik yapıldı ve aynı yöntemlerle
doğrulandı:

1. **Antrenman sekmesi — ham veri varsayılandan çıktı.** Yeni saf motor
   `src/lib/reports/training-progress.ts` (12 vitest): kas → region → hareket
   hiyerarşisi; hareket başına ilk→son top set ("100×5 → 105×6"), Faz-2
   `evaluatePR` ile pencere-içi güç PR olayları (pencere ÖNCESİ tarihçe de
   beslenir — eski rekor yeni PR sayılmaz; RIR-only PR sayılmaz), trend oku ve
   **ani düşüş** anomalisi (son top set, dönem rekorunun ≥%15 altı, ≥3 seans).
   Özet kartları: PR toplamı (X/Y harekette), seans, hareket, ani düşüş.
   Ham seans listesi `<details>` ("Ham seans geçmişi") arkasına taşındı.
   Görsel doğrulama: masaüstü+mobil ekran görüntüsü (fixture'lar gerçek motor
   üzerinden; Squat 140×5→110×5 "ani düşüş" rozetiyle, Göğüs 5 PR / Lat 0 PR).
2. **Takip sekmesi — sporcu takip sayfasının koç kopyası.** Renklendirme
   mantığı `buildCellConfigs` olarak `src/lib/metrics.ts`'e çekildi (4 yeni
   vitest; sporcu sayfası da aynı fonksiyonu kullanıyor — koç ve sporcu aynı
   haftayı birebir aynı renklerle okur). `CoachTrackerWeek`: valence tintli
   hafta tablosu (bugün vurgusu, not kolonu), haftalık ortalama MeasureCard'lar
   (sparkline + iyi/kötü vurgu), haftalık kardiyo özeti + listesi. Koçun
   `tracker_settings` SELECT hakkı 0024 politikasında mevcut (doğrulandı).
3. **Hafta seçici belirginleşti.** Ortak `WeekSwitcher`
   (`src/components/week-switcher.tsx`): tam genişlik kağıt şeridi, büyük
   dokunma hedefleri, serif hafta etiketi, geçmişteyken "Bu haftaya dön"
   kısayolu. Antrenman/Beslenme rapor başlıklarındaki minik çevronlar
   kaldırıldı; üç sekme (Antrenman/Beslenme/Takip) sayfa seviyesinde tek
   switcher kullanıyor, `?week=` sekmeyi koruyor.

Final kapılar yeniden: 328 test ✓ · typecheck ✓ · lint ✓ · build ✓.

## 8. Geri bildirim turu 2 (2026-07-03, gece)

1. **Ayarlanabilir ilerleme penceresi.** `?win=` (hafta, 1–52 clamp,
   varsayılan 12): başlıkta 1H/4H/8H/12H pill linkleri + serbest sayı girişli
   GET formu ("Uygula"). `loadTrainingProgress(supabase, athleteId,
   windowWeeks)` parametreli; PR tarihçesi her durumda ≥365 gün beslenir.
2. **Hareket geçmişi.** Antrenman sekmesine "Hareket geçmişi" bölümü:
   sporcunun tüm zamanlardaki hareketleri set sayısıyla çip olarak (`?ex=`),
   seçilende en-iyi-set grafiği (İlerleme sayfasının `ProgressChartLazy`'si)
   + tarih-gruplu TÜM setler tablosu (set no · kg · tekrar · RIR, en yeni
   seans üstte, kaydırılabilir).
3. **Haftalık kas raporuna PR kolonu.** Sıra/Set/Dinlenme/RIR yanına PR:
   hafta içi güç PR olayları (🏆 n, yoksa —). Saf `countPrEvents`
   (`src/lib/pr/count-events.ts`, 4 vitest; RIR-only hariç, pencere-öncesi
   tarihçe referans) hem burada hem ilerleme motorunda tek kaynak.

Görsel doğrulama: masaüstü 1440 + mobil 500 ekran görüntüleri (pill seçici,
PR kolonu, çip+grafik+tüm-setler tablosu). Final: 332 test ✓ · typecheck ✓ ·
lint ✓ · build ✓. Dal main'e merge edilip push'landı.
