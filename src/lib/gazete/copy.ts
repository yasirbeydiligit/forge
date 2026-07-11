/**
 * Forge Gazete copy engine — rule-based Turkish template pools.
 *
 * Every claim is data-bound: a template declares its required slots and
 * fillTemplate returns null when any is missing (and, as a double guard, when
 * any placeholder in the text can't be resolved) — a half sentence can never
 * be printed. Variant choice is a deterministic hash of the issue seed, so a
 * printed issue is reproducible while consecutive issues vary their voice.
 * Tone: newspaper, warm, no exaggeration — the numbers do the bragging.
 */
import type { Caution, FactType } from "./facts";

export type Template = { text: string; slots: string[] };

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
    return String(v);
  });
  return missing ? null : text;
}

/* -------------------------------------------------------------------------- */
/*  Manşetler — büyük serif punto, kısa ve vurucu                             */
/* -------------------------------------------------------------------------- */

export const HEADLINES: Record<FactType, Template[]> = {
  pr_count: [
    { text: "Bu dönem {count} kez tarihe geçtin", slots: ["count"] },
    { text: "{count} yeni rekor: çıta yükseldi", slots: ["count"] },
    { text: "Rekor defterine {count} yeni satır", slots: ["count"] },
    { text: "{exercise} konuştu: {weight} kg", slots: ["exercise", "weight"] },
  ],
  weight_trend: [
    { text: "{deltaKg} kg {direction}: plan işliyor", slots: ["deltaKg", "direction"] },
    { text: "Terazi tarafını seçti: {deltaKg} kg {direction}", slots: ["deltaKg", "direction"] },
    { text: "{from} → {to}: yön doğru", slots: ["from", "to"] },
  ],
  consistency: [
    { text: "Söz verdin, geldin: {sessions} antrenman", slots: ["sessions"] },
    { text: "Program mı? İmza gibi: {sessions}/{planned} gün", slots: ["sessions", "planned"] },
    { text: "Devamsızlık defterinde adın yok", slots: [] },
  ],
  volume_trend: [
    { text: "Hacim yüzde {percent} yukarı", slots: ["percent"] },
    { text: "Daha çok demir kalktı: +%{percent}", slots: ["percent"] },
  ],
  protein_consistency: [
    { text: "Protein hedefi: {hit}/{logged} gün tam isabet", slots: ["hit", "logged"] },
    { text: "Mutfak da antrenmandaydı: {hit} gün protein tamam", slots: ["hit"] },
  ],
  sleep_improvement: [
    { text: "Uyku +{delta} saat: en ucuz takviye işliyor", slots: ["delta"] },
    { text: "Geceler uzadı: ortalama {avg} saat uyku", slots: ["avg"] },
  ],
  steps_avg: [
    { text: "Günde {avg} adım: motor hep sıcak", slots: ["avg"] },
    { text: "{avg} adım ortalama — şehir senin", slots: ["avg"] },
  ],
  cardio_total: [
    { text: "{minutes} dakika kardiyo hanene yazıldı", slots: ["minutes"] },
    { text: "Nefes açık: {count} kardiyo, {minutes} dakika", slots: ["count", "minutes"] },
  ],
  protocol_adherence: [
    { text: "Protokol saati şaşmadı: {done}/{due}", slots: ["done", "due"] },
    { text: "Detaylar da tamam: {done} protokol işlendi", slots: ["done"] },
  ],
  new_exercises: [
    { text: "Repertuvara yeni hareket: {first}", slots: ["first"] },
    { text: "{count} yeni hareket denendi — cesaret iyi şeydir", slots: ["count"] },
  ],
  best_session: [
    { text: "Haftanın maçı: {sets} setlik gün", slots: ["sets"] },
    { text: "Bir gün vardı ki: {sets} set üst üste", slots: ["sets"] },
  ],
};

/** Pozitif fact çıkmayan ama verisi olan dönem: dürüst, övgüsüz kapak. */
export const NEUTRAL_HEADLINES: Template[] = [
  { text: "Dönem kayıtları masada", slots: [] },
  { text: "Defter işlendi: rakamlar içeride", slots: [] },
  { text: "Bu sayı: veriler, sade ve net", slots: [] },
];

/* -------------------------------------------------------------------------- */
/*  Hikâye gövdeleri — 1-2 cümle, veri merkezde                               */
/* -------------------------------------------------------------------------- */

export const STORY_BODIES: Record<FactType, Template[]> = {
  pr_count: [
    {
      text: "En parlağı {exercise}: {weight} kg × {reps}. Geçmişteki her setini geride bıraktın.",
      slots: ["exercise", "weight", "reps"],
    },
    {
      text: "{count} rekorun zirvesi {exercise} — {weight} kg ile yeni kişisel sınırın.",
      slots: ["count", "exercise", "weight"],
    },
  ],
  weight_trend: [
    {
      text: "Dönem başında {from} kg, sonunda {to} kg. Tartı günlük oynar; trend senden yana.",
      slots: ["from", "to"],
    },
    {
      text: "Net {deltaKg} kg {direction}. Bu, tesadüf değil — kayıtların toplamı.",
      slots: ["deltaKg", "direction"],
    },
  ],
  consistency: [
    {
      text: "{planned} planlanan günün {sessions} tanesi tamamlandı. Süreklilik, sonuçların annesidir.",
      slots: ["planned", "sessions"],
    },
    {
      text: "Takvim {sessions} kez imzalandı. En zor kısım gelmekti; geldin.",
      slots: ["sessions"],
    },
  ],
  volume_trend: [
    {
      text: "Toplam {sets} set işlendi — önceki döneme göre %{percent} artış.",
      slots: ["sets", "percent"],
    },
    {
      text: "İş hacmi %{percent} büyüdü. Vücut, verilen işe uyum sağlar.",
      slots: ["percent"],
    },
  ],
  protein_consistency: [
    {
      text: "Kayıtlı {logged} günün {hit} tanesinde protein hedefin tamamdı.",
      slots: ["logged", "hit"],
    },
    {
      text: "Protein {hit} gün yerinde. Kaslar sofrada yapılır, salonda çağrılır.",
      slots: ["hit"],
    },
  ],
  sleep_improvement: [
    {
      text: "Uyku ortalaman {avg} saate çıktı (+{delta}). Toparlanma bütçen büyüdü.",
      slots: ["avg", "delta"],
    },
    {
      text: "+{delta} saat uyku — görünmeyen antrenman da iyi geçti.",
      slots: ["delta"],
    },
  ],
  steps_avg: [
    {
      text: "Günlük ortalama {avg} adım. Temel aktivite sessizce iş görüyor.",
      slots: ["avg"],
    },
    {
      text: "{avg} adım/gün — NEAT hanesi dolu.",
      slots: ["avg"],
    },
  ],
  cardio_total: [
    {
      text: "{count} seansta {minutes} dakika kardiyo, {distance} km yol.",
      slots: ["count", "minutes", "distance"],
    },
    {
      text: "Kondisyon hattı çalıştı: toplam {minutes} dakika.",
      slots: ["minutes"],
    },
  ],
  protocol_adherence: [
    {
      text: "{due} protokolün {done} tanesi zamanında işlendi.",
      slots: ["due", "done"],
    },
    {
      text: "Küçük işler büyük fark yaratır: {done} protokol tamam.",
      slots: ["done"],
    },
  ],
  new_exercises: [
    {
      text: "İlk kez denenen {count} hareketin başında {first} var. Yeni uyaran, yeni adaptasyon.",
      slots: ["count", "first"],
    },
    {
      text: "{first} artık repertuvarında.",
      slots: ["first"],
    },
  ],
  best_session: [
    {
      text: "Dönemin zirve günü: {sets} set. O günkü sen, referans noktası.",
      slots: ["sets"],
    },
    {
      text: "En dolu gün {sets} setle kapandı.",
      slots: ["sets"],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/*  Editörün Notu — nazik hatırlatma, asla azarlama                           */
/* -------------------------------------------------------------------------- */

export const EDITOR_NOTES: Record<Caution["type"], Template[]> = {
  weight_against_goal: [
    {
      text: "Tartı bu dönem {deltaKg} kg ters yöne yazdı. Panik yok — koçun planla birlikte değerlendirecektir.",
      slots: ["deltaKg"],
    },
    {
      text: "Kilo hedefin aksine {deltaKg} kg oynadı; tek dönem trend değildir, koçunla konuşulacak konu.",
      slots: ["deltaKg"],
    },
  ],
  sleep_decline: [
    {
      text: "Uyku ortalaman {delta} saat geriledi. Toparlanma bütçesi antrenman kadar değerli.",
      slots: ["delta"],
    },
    {
      text: "Geceler biraz kısaldı (-{delta} saat). Küçük bir düzen ayarı iyi gelebilir.",
      slots: ["delta"],
    },
  ],
  protein_low: [
    {
      text: "Protein, kayıtlı günlerin yarısından azında hedefteydi. Mutfağa küçük bir hatırlatma.",
      slots: [],
    },
    {
      text: "Protein hanesi bu dönem sessiz kaldı ({hit}/{logged}). Koçun menüye bakacaktır.",
      slots: ["hit", "logged"],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/*  Kapanış satırları                                                         */
/* -------------------------------------------------------------------------- */

export const CLOSING_LINES: Template[] = [
  { text: "Sonraki sayıda görüşmek üzere.", slots: [] },
  { text: "Baskı bitti; iş bitmedi. Sonraki sayıda buluşalım.", slots: [] },
  { text: "Bu sayı arşive girdi. Sıradaki manşet senin elinde.", slots: [] },
];
