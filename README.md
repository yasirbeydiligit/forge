# Forge — Antrenman Platformu

Küçük, kapalı bir topluluk için TrainHeroic benzeri antrenman platformu. **Koç** programlar
yazıp takvime atar; **sporcular** davet linkiyle katılır, her antrenmanı logbook'a işler ve
ortak feed üzerinden koça soru sorar.

- **Roller:** `coach` (tek admin) ve `athlete`. Kayıt **yalnızca davet linkiyle** açıktır.
- **Mobile-first PWA:** Telefonda "ana ekrana ekle" ile native uygulama hissi, masaüstünde
  yan menü.
- **Türkçe arayüz**, koyu "athletic" tema.

---

## İçindekiler

1. [Özellikler](#özellikler)
2. [Teknoloji yığını](#teknoloji-yığını)
3. [Mimari notu](#mimari-notu)
4. [Hızlı başlangıç](#hızlı-başlangıç)
5. [Supabase projesi](#1-supabase-projesi)
6. [Ortam değişkenleri (.env.local)](#2-ortam-değişkenleri-envlocal)
7. [Veritabanı şeması / migration](#3-veritabanı-şeması--migration)
8. [Seed (ilk koç + demo veri)](#4-seed-ilk-koç--demo-veri)
9. [Çalıştırma](#5-çalıştırma)
10. [PWA'yı telefona kurma](#6-pwayı-telefona-kurma)
11. [Vercel'e deploy](#7-vercele-deploy)
12. [Uçtan uca test senaryosu](#uçtan-uca-test-senaryosu)
13. [Proje yapısı](#proje-yapısı)

---

## Özellikler

**Koç paneli**
- Program & antrenman günü (workout) oluşturma, sıralı egzersizler (hedef set/tekrar/ağırlık/RPE/dinlenme/not)
- Tekrar kullanılabilir egzersiz kütüphanesi
- Aylık takvim grid'inde workout'ları tarihe atama (program geneli ya da tek sporcuya)
- Sporcu listesi ve her sporcunun salt-okunur logbook'u
- Tek/çok kullanımlık ve süreli davet linkleri üretimi
- Cevaplanmamış sorular listesi

**Sporcu deneyimi**
- Bugünkü antrenman, kişisel takvim
- Logbook: egzersiz bazında set set giriş (kg + tekrar + RPE/not), "tamamlandı" işareti
- Egzersiz başına geçmiş, PR (kişisel rekor) ve ağırlık/zaman grafiği (recharts)
- Programlara kaydolma

**Topluluk feed'i**
- Metin + opsiyonel görsel gönderiler, soru etiketi
- Thread şeklinde yorumlar, koç yorumları "Koç" rozetiyle vurgulanır
- Beğeni, en yeni üstte
- Koç yorum yazınca soru otomatik "cevaplandı" olur (DB trigger)

---

## Teknoloji yığını

- **Next.js 15** (App Router, TypeScript, Server Actions)
- **Supabase** — Postgres + Auth (email/şifre) + Row Level Security + Storage
- **Drizzle ORM** — şema + migration'ların tek kaynağı
- **Tailwind CSS v4 + shadcn/ui** (new-york, Radix)
- **react-hook-form benzeri** form akışları + **zod** doğrulama (Server Actions ile)
- **date-fns** + özel takvim grid'i, **recharts** grafikler, **lucide-react** ikonlar
- PWA: `manifest.webmanifest` + service worker (`public/sw.js`)

---

## Mimari notu

> **Drizzle şemayı ve migration'ları yönetir; uygulama sorguları Supabase istemcisi
> üzerinden gider.**

Bu bilinçli bir tercihtir. Her sorgu, oturum açan kullanıcının JWT'si ile çalışan
`@supabase/ssr` istemcisi üzerinden gittiği için **Row Level Security (RLS) tüm erişim
kontrolünün tek otoritesidir** — "sporcu yalnızca kendi logbook'unu görür, koç her şeyi
görür" kuralı doğrudan Postgres'te uygulanır. Drizzle'ı ayrıcalıklı bir bağlantıyla sorgu
için kullansaydık RLS baypas edilirdi.

Sonuç olarak uygulama yalnızca `URL` + `anon key` ile çalışır. `service_role` anahtarı ve
`DATABASE_URL` sadece **davet kaydı**, **seed script** ve **Drizzle CLI** için gerekir.

RLS politikaları, trigger'lar ve storage tanımları `drizzle/0001_security.sql` ve
`drizzle/0002_security_hardening.sql` migration'larındadır.

---

## Hızlı başlangıç

```bash
# 1) Bağımlılıklar
npm install

# 2) .env.local doldur (aşağıya bak)

# 3) Şemayı veritabanına uygula (zaten uygulanmış bir projeye bağlanıyorsan atla)
npm run db:migrate

# 4) İlk koç hesabı + demo veri + test daveti
npm run seed

# 5) Geliştirme sunucusu
npm run dev
```

---

## 1. Supabase projesi

1. [supabase.com](https://supabase.com) → yeni proje oluştur (bölge size yakın olsun).
2. **Project Settings → Data API**: `Project URL` değerini al.
3. **Project Settings → API Keys**:
   - `anon` / `publishable` anahtarı (tarayıcıya açık)
   - `service_role` (gizli, sunucu tarafı)
4. **Connect** (üst bar) → "Connection string" → ORMs / session pooler bağlantısını al
   (`DATABASE_URL` için).

> Bu repo, `cjnhujhfcpbigsrhzviw` referanslı bir Supabase projesine bağlı gelir ve şema
> + RLS canlı projeye uygulanmıştır. Kendi projenize taşımak için `.env.local`'ı kendi
> değerlerinizle güncelleyip `npm run db:migrate` çalıştırmanız yeterli.

---

## 2. Ortam değişkenleri (.env.local)

`.env.example`'ı kopyalayıp doldurun:

```bash
cp .env.example .env.local
```

| Değişken | Zorunlu | Açıklama |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | `publishable` ya da legacy `anon` anahtarı |
| `NEXT_PUBLIC_SITE_URL` | ✅ | Davet linkleri için temel URL (`http://localhost:3000`) |
| `SUPABASE_SERVICE_ROLE_KEY` | davet kaydı + seed | `service_role` gizli anahtarı |
| `DATABASE_URL` | sadece Drizzle CLI | Postgres bağlantı dizesi (session pooler) |
| `SEED_COACH_EMAIL` / `SEED_COACH_PASSWORD` / `SEED_COACH_NAME` | seed | İlk koç hesabı |

> ⚠️ `SUPABASE_SERVICE_ROLE_KEY` ve `DATABASE_URL` MCP üzerinden alınamaz; **Supabase
> Dashboard'dan kopyalamanız** gerekir. Uygulamanın kendisi bunlar olmadan da çalışır;
> yalnızca davet kaydı ve seed/CLI bunları ister.

---

## 3. Veritabanı şeması / migration

Şema **Drizzle** ile tanımlıdır (`src/db/schema.ts`). Migration dosyaları `drizzle/` altında:

- `0000_*.sql` — tablolar, indexler, foreign key'ler
- `0001_security.sql` — `auth.users` bağlantısı, RLS politikaları, trigger'lar, storage bucket
- `0002_security_hardening.sql` — advisor güvenlik sertleştirmeleri

```bash
# Şemayı değiştirdiyseniz yeni migration üret
npm run db:generate

# Migration'ları veritabanına uygula (DATABASE_URL gerekir)
npm run db:migrate

# (Alternatif) Şemayı doğrudan it
npm run db:push
```

> Bu repodaki bağlı Supabase projesine şema + RLS zaten uygulanmıştır. Sıfırdan bir projede
> `npm run db:migrate` tüm yapıyı kurar.

---

## 4. Seed (ilk koç + demo veri)

`SUPABASE_SERVICE_ROLE_KEY` doldurulduktan sonra:

```bash
npm run seed
```

Script şunları yapar (idempotent):
- İlk **koç** hesabını oluşturur (e-posta doğrulaması otomatik onaylı).
- Örnek **egzersiz kütüphanesi** ekler.
- Bir **demo program** (3 antrenman günü + egzersizler) oluşturur ve önümüzdeki günlere
  takvime atar.
- Bir **test davet linki** üretir ve konsola yazar.

Çıktıdaki koç e-posta/şifresi ve davet linkini not alın.

---

## 5. Çalıştırma

```bash
npm run dev      # http://localhost:3000
npm run build    # production build
npm start        # production sunucusu
npm run lint     # ESLint
npm run typecheck# tsc --noEmit
```

Koç olarak giriş yapın → otomatik `/panel`'e, sporcu olarak `/bugun`'e yönlendirilirsiniz.

---

## 6. PWA'yı telefona kurma

Uygulama installable bir PWA'dır (manifest + service worker). Service worker yalnızca
**production** derlemesinde aktiftir (`npm run build && npm start` ya da deploy).

- **iOS (Safari):** Paylaş → "Ana Ekrana Ekle".
- **Android (Chrome):** Menü → "Uygulamayı yükle" / "Ana ekrana ekle".
- **Masaüstü (Chrome/Edge):** Adres çubuğundaki yükleme simgesi.

Kurulunca tam ekran, standalone modda, alt navigasyon barıyla native hissi verir.

---

## 7. Vercel'e deploy

1. Repoyu GitHub'a push edin, [Vercel](https://vercel.com)'de **Import** edin.
2. **Environment Variables** olarak `.env.local`'daki değerleri ekleyin
   (`NEXT_PUBLIC_SITE_URL`'ı production domaininize ayarlayın).
3. Deploy. Build komutu `next build`, framework otomatik algılanır.
4. İlk deploy sonrası `npm run seed`'i lokalden (production env ile) bir kez çalıştırarak
   koç hesabını oluşturun veya Supabase Dashboard'dan kullanıcıyı manuel ekleyin.

> Supabase Auth → URL Configuration kısmında production domaininizi **Site URL** ve
> **Redirect URLs**'e eklemeyi unutmayın.

---

## Uçtan uca test senaryosu

1. **Koç girişi:** Seed'in verdiği e-posta/şifre ile giriş yap → `/panel`.
2. **Egzersiz ekle:** `Egzersiz Kütüphanesi` → birkaç egzersiz ekle.
3. **Program oluştur:** `Programlar` → "Yeni program" → antrenman günleri ve egzersizler ekle.
4. **Takvime ata:** `Takvim` → bir güne tıkla → program + antrenman + "Tüm sporcular" seç.
5. **Davet üret:** `Davetler` → "Davet oluştur" → bağlantıyı kopyala.
6. **Sporcu kaydı:** Davet bağlantısını (gizli sekmede) aç → ad/e-posta/şifre ile kaydol.
7. **Logbook:** Sporcu olarak `Bugün` → antrenmanı aç → set set kg/tekrar gir, "Tamamla".
8. **İlerleme:** `İlerleme` → egzersiz seç → PR ve grafik.
9. **Feed sorusu:** `Feed` → "Soru olarak" işaretleyip bir soru paylaş.
10. **Koç cevabı:** Koç olarak `Panel` veya `Cevaplanmamış Sorular` → soruya yorum yaz →
    soru otomatik "cevaplandı" olur, sporcu yorumu "Koç" rozetiyle görür.

---

## Proje yapısı

```
src/
  app/
    (auth)/                # login + davetle kayıt + auth server actions
    (app)/                 # oturum gerektiren alan (AppShell ile)
      panel/               # KOÇ: dashboard, programlar, takvim, sporcular,
                           #      egzersizler, davetler, sorular
      bugun/ takvim/       # SPORCU: bugün + takvim
      antrenman/[date]/    # SPORCU: günün logbook'u
      ilerleme/            # SPORCU: PR + grafik
      programlar/          # SPORCU: programa kaydolma
      feed/                # ortak topluluk feed'i
      profil/              # profil düzenleme
    manifest.ts            # PWA manifest
    offline/               # çevrimdışı fallback sayfası
  components/              # shell, shadcn/ui ve paylaşılan bileşenler
  db/
    schema.ts              # Drizzle şeması (tek kaynak)
    seed.ts                # seed script
  lib/
    supabase/              # browser / server / admin istemcileri + middleware
    auth.ts                # oturum & rol yardımcıları
    database.types.ts      # Supabase'ten üretilen tipler
drizzle/                   # SQL migration'lar (tablolar + RLS + sertleştirme)
public/                    # sw.js, ikonlar
```
