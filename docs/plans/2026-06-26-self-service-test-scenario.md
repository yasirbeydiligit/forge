# Test senaryosu — Self-service egzersiz & program

`npm run dev` ile çalıştırıp aşağıdaki akışı izle. (Otomatik kapılar zaten yeşil:
`npm run test` 180, `npm run typecheck`, `npm run lint`, `npm run build`; RLS canlıda
JWT-simülasyonuyla doğrulandı.)

## A. Sporcu — kendi egzersizini tanımlama
1. Sporcu olarak giriş yap → soldaki "more"/ikincil menüden **Egzersizlerim**.
2. **Yeni egzersiz** → ad gir (ör. "Kablo Cross-over").
3. **Hareket paterni** = İtiş — yatay, **Ekipman** = Kablo, (ops.) Kategori = Göğüs.
4. **Hedef kaslar**: Kas = Göğüs (Pectoralis) → Fonksiyon seç → **Birincil** → "Hedef ekle".
   İstersen ikinci bir kası **İkincil** ekle. Chip'ler listede görünür, X ile silinebilir.
5. Kaydet → kart "Özel" rozetiyle, "N hedef kas" ve patern/ekipman satırıyla listelenir.
6. Kartı **düzenle** → hedeflerin formda yüklü geldiğini, değiştirip kaydedebildiğini doğrula.

## B. Sporcu — kendi programını oluşturma
1. İkincil menü → **Programlarım** → **Yeni program** (ad + açıklama). (Yayın anahtarı YOK —
   kişisel program her zaman özeldir.) Kaydedince detay sayfasına yönlenir.
2. **Antrenman günü ekle** (ör. "Gün A — Göğüs").
3. Güne **Egzersiz** ekle: açılan listede **Sistem egzersizleri** ve **Özel egzersizlerim**
   ayrı gruplar; A'da tanımladığın özel egzersiz "· Özel" ile görünür.
4. Bir sistem egzersizi seç → **Muadil göster** → patern + birincil kas eşleşmeli muadiller
   listelenir; birine dokun → seçili egzersiz onunla değişir (kas/fonksiyon takibi sürer).
5. Hedef set/tekrar(min-max)/kilo/RIR/dinlenme/not gir → Kaydet. Yukarı/aşağı ile sırala.

## C. Sporcu — takvime atama ve görme
1. Program detayında **Takvime ata** → bir antrenman günü + **bugünün tarihi** → ekle.
2. **Bugün** sayfasına git → "Bugünün antrenmanı" kartında bu antrenman görünür;
   **Takvim**'de o günde işaretli. Karta dokunup antrenmanı açıp set işleyebilirsin.

## D. Koç tarafı (bozulmadığını + oversight doğrula)
1. Koç olarak gir → **Egzersiz Kütüphanesi** → Yeni egzersiz: artık aynı zengin form
   (patern/ekipman/hedef kaslar). Koç egzersizi community (`is_system`) olur; listede
   sistem + koçun kendi egzersizleri görünür (sporcuların özelleri değil).
2. **Programlar** → mevcut program oluşturma/günler/egzersiz/muadil akışı aynen çalışır.
3. **Sporcular → (ilgili sporcu)** → "Kendi programları" bölümünde sporcunun kişisel
   programları **salt-okunur** listelenir (koç düzenleyemez).

## Beklenen RLS (canlı doğrulandı)
- Sporcu: kendi egzersiz+hedef, kendi program/gün/egzersiz, kendine takvim ataması → izinli.
- Koç: sporcunun programını/egzersizini **görür ama düzenleyemez** (update 0 satır).
- Başka sporcu: bu sporcunun özel program/egzersizini **göremez** (ama 100 sistem egzersizi görür).
- Engellenenler: sporcunun community-publish'i, program-geneli (athlete_id NULL) atama,
  sistem egzersizine hedef yazma.
