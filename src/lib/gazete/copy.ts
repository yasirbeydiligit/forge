/**
 * Forge Gazete copy engine — rule-based Turkish template pools.
 *
 * Voice: "gazete nötr" (user-approved 2026-07-13) — plain journalistic
 * Turkish; the praise comes from the numbers, never from adjectives. Written
 * as native Turkish, not translated English.
 *
 * Hard rules:
 * - A template declares required slots; fillTemplate returns null when any is
 *   missing (double-guarded against stray placeholders) — a half sentence can
 *   never be printed.
 * - NEVER attach a Turkish suffix to a dynamic slot value ({exercise}'te,
 *   {sessions}'i…): vowel harmony breaks on unknown words/numbers. Suffixes
 *   are allowed only on fixed words. Count/number-dependent phrasing is
 *   handled with `match` predicates instead.
 * - Variant choice is a deterministic hash of the issue seed, so a printed
 *   issue is reproducible while consecutive issues vary their voice.
 */
import type { Caution, FactType } from "./facts";

export type Template = {
  text: string;
  slots: string[];
  /** Optional eligibility test (e.g. count === 1) evaluated on the fact slots. */
  match?: (slots: Record<string, string | number>) => boolean;
};

/** djb2 — tiny, stable, good enough spread for variant picking. */
function hash(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 33) ^ seed.charCodeAt(i);
  }
  return h >>> 0;
}

export function pickVariant<T>(pool: readonly T[], seed: string): T {
  return pool[hash(seed) % pool.length];
}

/** Turkish print formatting: decimal comma, thousands dot ("1,8", "9.412"). */
export function trNum(v: number): string {
  return v.toLocaleString("tr-TR", { maximumFractionDigits: 1 });
}

export function fillTemplate(
  tpl: Template,
  slots: Record<string, string | number>,
): string | null {
  for (const key of tpl.slots) {
    if (slots[key] == null) return null;
  }
  let missing = false;
  const text = tpl.text.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = slots[key];
    if (v == null) {
      missing = true;
      return "";
    }
    return typeof v === "number" ? trNum(v) : v;
  });
  return missing ? null : text;
}

/** Pick a deterministic eligible variant and fill it; null if none fits. */
export function renderTemplate(
  pool: readonly Template[],
  slots: Record<string, string | number>,
  seed: string,
): string | null {
  const eligible = pool.filter((t) => !t.match || t.match(slots));
  if (eligible.length === 0) return null;
  return fillTemplate(pickVariant(eligible, seed), slots);
}

const one = (key: string) => (slots: Record<string, string | number>) =>
  Number(slots[key]) === 1;
const many = (key: string) => (slots: Record<string, string | number>) =>
  Number(slots[key]) > 1;

/* -------------------------------------------------------------------------- */
/*  Manşetler — kısa, kuru, rakam konuşur                                     */
/* -------------------------------------------------------------------------- */

export const HEADLINES: Record<FactType, Template[]> = {
  pr_count: [
    {
      text: "Yeni kişisel rekor: {exercise} {weight} kg",
      slots: ["exercise", "weight"],
      match: one("count"),
    },
    {
      text: "Kişisel rekor tazelendi: {exercise} {weight} kg × {reps}",
      slots: ["exercise", "weight", "reps"],
      match: one("count"),
    },
    {
      text: "Bu {period} {count} kişisel rekor kırıldı",
      slots: ["period", "count"],
      match: many("count"),
    },
    {
      text: "Rekor tablosuna {count} yeni giriş",
      slots: ["count"],
      match: many("count"),
    },
  ],
  weight_trend: [
    {
      text: "{periodGenCap} bilançosu: {deltaKg} kg {direction}",
      slots: ["periodGenCap", "deltaKg", "direction"],
      match: (s) => s.direction !== "korundu",
    },
    {
      text: "Tartıda net sonuç: {deltaKg} kg {direction}",
      slots: ["deltaKg", "direction"],
      match: (s) => s.direction !== "korundu",
    },
    {
      text: "Kilo hedeflenen aralıkta korundu: {from} → {to}",
      slots: ["from", "to"],
      match: (s) => s.direction === "korundu",
    },
  ],
  consistency: [
    {
      text: "Planlanan antrenmanların tamamı yapıldı: {sessions}/{planned}",
      slots: ["sessions", "planned"],
      match: (s) => s.sessions === s.planned,
    },
    {
      text: "Planın üzerine çıkıldı: {planned} yerine {sessions} antrenman",
      slots: ["planned", "sessions"],
      match: (s) => Number(s.sessions) > Number(s.planned),
    },
    {
      text: "Program yüksek oranda uygulandı: {sessions}/{planned} antrenman",
      slots: ["sessions", "planned"],
      match: (s) => Number(s.sessions) < Number(s.planned),
    },
    {
      text: "Devamlılık tablosu net: {sessions}/{planned} antrenman",
      slots: ["sessions", "planned"],
      match: (s) => Number(s.sessions) <= Number(s.planned),
    },
  ],
  volume_trend: [
    { text: "Antrenman hacmi yüzde {percent} arttı", slots: ["percent"] },
    { text: "Hacimde artış: önceki döneme göre +%{percent}", slots: ["percent"] },
  ],
  protein_consistency: [
    { text: "Protein hedefi {hit}/{logged} gün tutturuldu", slots: ["hit", "logged"] },
    { text: "Beslenmede istikrar: {hit} gün protein hedefinde", slots: ["hit"] },
  ],
  sleep_improvement: [
    { text: "Uyku ortalaması {avg} saate yükseldi", slots: ["avg"] },
    { text: "Uykuda iyileşme: önceki döneme göre +{delta} saat", slots: ["delta"] },
  ],
  steps_avg: [
    { text: "Günlük ortalama {avg} adım", slots: ["avg"] },
    { text: "Adım ortalaması {avg} olarak kaydedildi", slots: ["avg"] },
  ],
  cardio_total: [
    { text: "{minutes} dakika kardiyo tamamlandı", slots: ["minutes"] },
    { text: "Kardiyo toplamı: {count} seans, {minutes} dakika", slots: ["count", "minutes"] },
  ],
  protocol_adherence: [
    { text: "Protokol uyumu yüksek: {done}/{due}", slots: ["done", "due"] },
    { text: "Protokoller büyük ölçüde uygulandı: {done}/{due}", slots: ["done", "due"] },
  ],
  new_exercises: [
    {
      text: "Programa yeni bir hareket eklendi: {first}",
      slots: ["first"],
      match: one("count"),
    },
    {
      text: "{count} yeni hareket denendi",
      slots: ["count"],
      match: many("count"),
    },
  ],
  best_session: [
    { text: "{periodGenCap} en yoğun antrenmanı: {sets} set", slots: ["periodGenCap", "sets"] },
    { text: "Zirve gün: {sets} setlik antrenman", slots: ["sets"] },
  ],
};

/** Pozitif fact çıkmayan ama verisi olan dönem: dürüst, övgüsüz kapak. */
export const NEUTRAL_HEADLINES: Template[] = [
  { text: "Dönem raporu hazır", slots: [] },
  { text: "Kayıtlar işlendi, rapor masada", slots: [] },
  { text: "Veriler derlendi", slots: [] },
];

/* -------------------------------------------------------------------------- */
/*  Hikâye gövdeleri — 1-2 cümle, bilgi verir, süslemez                       */
/* -------------------------------------------------------------------------- */

export const STORY_BODIES: Record<FactType, Template[]> = {
  pr_count: [
    {
      text: "En dikkat çekeni {exercise}: {weight} kg × {reps} — önceki tüm kayıtların üzerinde.",
      slots: ["exercise", "weight", "reps"],
    },
    {
      text: "Listenin başında {exercise} var: {weight} kg × {reps} ile kişisel en iyi.",
      slots: ["exercise", "weight", "reps"],
    },
  ],
  weight_trend: [
    {
      text: "Dönem başı ortalaması {from} kg, dönem sonu {to} kg. Günlük dalgalanma normaldir; belirleyici olan eğilim.",
      slots: ["from", "to"],
      match: (s) => s.direction !== "korundu",
    },
    {
      text: "Net değişim {deltaKg} kg, yönü {direction}. Kayıtlar düzenli olduğu için tablo güvenilir.",
      slots: ["deltaKg", "direction"],
      match: (s) => s.direction !== "korundu",
    },
    {
      text: "Başlangıç {from} kg, bitiş {to} kg — hedeflenen aralığın içinde kaldı.",
      slots: ["from", "to"],
      match: (s) => s.direction === "korundu",
    },
  ],
  consistency: [
    {
      text: "Takvimde {planned} antrenman planlıydı; {sessions} antrenman tamamlandı.",
      slots: ["planned", "sessions"],
    },
    {
      text: "Devamlılık bu {period} da bozulmadı: {sessions}/{planned}.",
      slots: ["period", "sessions", "planned"],
      match: (s) => Number(s.sessions) <= Number(s.planned),
    },
  ],
  volume_trend: [
    {
      text: "Toplam {sets} set çalışıldı — önceki döneme göre yüzde {percent} artış.",
      slots: ["sets", "percent"],
    },
    {
      text: "İş hacmi yüzde {percent} genişledi; adaptasyon için gereken uyaran yerinde.",
      slots: ["percent"],
    },
  ],
  protein_consistency: [
    {
      text: "Kayıt girilen {logged} günün {hit} gününde protein hedefi karşılandı.",
      slots: ["logged", "hit"],
    },
    {
      text: "Protein alımı {hit} gün hedef aralığındaydı.",
      slots: ["hit"],
    },
  ],
  sleep_improvement: [
    {
      text: "Ortalama uyku {avg} saat; önceki döneme göre {delta} saat artış.",
      slots: ["avg", "delta"],
    },
    {
      text: "Uyku süresi {delta} saat uzadı — toparlanma tarafı güçlendi.",
      slots: ["delta"],
    },
  ],
  steps_avg: [
    {
      text: "Dönem ortalaması günde {avg} adım olarak kaydedildi.",
      slots: ["avg"],
    },
    {
      text: "Günlük aktivite {avg} adım seviyesinde seyretti.",
      slots: ["avg"],
    },
  ],
  cardio_total: [
    {
      text: "{count} seansta toplam {minutes} dakika kardiyo, {distance} km yol.",
      slots: ["count", "minutes", "distance"],
    },
    {
      text: "Kardiyo hanesine {minutes} dakika işlendi.",
      slots: ["minutes"],
    },
  ],
  protocol_adherence: [
    {
      text: "{due} protokol uygulamasından {done} tanesi zamanında işaretlendi.",
      slots: ["due", "done"],
    },
    {
      text: "Protokol takibi düzenli ilerledi: {done}/{due}.",
      slots: ["done", "due"],
    },
  ],
  new_exercises: [
    {
      text: "İlk kez uygulandı: {first}. Yeni hareket, yeni uyaran demek.",
      slots: ["first"],
      match: one("count"),
    },
    {
      text: "İlk kez uygulanan {count} hareketin başında {first} var.",
      slots: ["count", "first"],
      match: many("count"),
    },
  ],
  best_session: [
    {
      text: "En yoğun gün {sets} setle tamamlandı — dönemin referans antrenmanı.",
      slots: ["sets"],
    },
    {
      text: "Tek antrenmanda {sets} set: dönemin zirvesi.",
      slots: ["sets"],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/*  Editörün Notu — nazik hatırlatma, suçlama yok                             */
/* -------------------------------------------------------------------------- */

export const EDITOR_NOTES: Record<Caution["type"], Template[]> = {
  weight_against_goal: [
    {
      text: "Kilo bu dönem hedefin tersine {deltaKg} kg değişti. Tek dönem eğilim sayılmaz; değerlendirme koçta.",
      slots: ["deltaKg"],
    },
    {
      text: "Tartı hedefin aksi yönünde {deltaKg} kg gösterdi — koç haftalık takipte ele alacaktır.",
      slots: ["deltaKg"],
    },
  ],
  sleep_decline: [
    {
      text: "Uyku ortalaması {delta} saat geriledi. Toparlanma, antrenman kadar sonuç belirler.",
      slots: ["delta"],
    },
    {
      text: "Uyku süresi bu dönem {delta} saat kısaldı — göz önünde tutmakta fayda var.",
      slots: ["delta"],
    },
  ],
  protein_low: [
    {
      text: "Protein hedefi kayıtlı günlerin yarısından azında karşılandı ({hit}/{logged}).",
      slots: ["hit", "logged"],
    },
    {
      text: "Protein alımı bu dönem hedefin gerisinde kaldı — menü koçla gözden geçirilebilir.",
      slots: [],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/*  Kapanış satırları                                                         */
/* -------------------------------------------------------------------------- */

export const CLOSING_LINES: Template[] = [
  { text: "Sonraki sayıda görüşmek üzere.", slots: [] },
  { text: "Bu sayı arşive kaldırıldı; kayıt sürüyor.", slots: [] },
  { text: "Rapor tamamlandı. Sıradaki dönem şimdiden açık.", slots: [] },
];
