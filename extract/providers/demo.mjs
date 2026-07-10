// Provider "demo" — bez żadnego klucza API. Parsuje wklejony TEKST faktury heurystykami.
// Działa od ręki, służy do testów end-to-end i pokazania całego obiegu bez kont/kosztów.
// W produkcji zastępują go providery claude / azure.

const reDate = (label) =>
  new RegExp(label + "\\D{0,15}(\\d{4}-\\d{2}-\\d{2}|\\d{2}[.\\/]\\d{2}[.\\/]\\d{4})", "i");

function toISO(s) {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/(\d{2})[.\/](\d{2})[.\/](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
function num(s) {
  if (!s) return 0;
  return Number(String(s).replace(/\s/g, "").replace(/zł/gi, "").replace(",", "."));
}
function grab(text, re) {
  const m = text.match(re);
  return m ? m[1].trim() : "";
}

export async function extract({ text }) {
  if (!text) throw new Error('Provider "demo" wymaga pola text (treści faktury).');

  const stawka = num(grab(text, /stawka\D{0,15}([\d\s.,]+)/i));
  const godziny = num(grab(text, /godzin\w*\D{0,15}([\d\s.,]+)/i));
  const model = /ryczałt|ryczał|miesiąc|\/mc/i.test(text) && !godziny ? "ryczalt" : "godzinowy";

  return {
    numer: grab(text, /\bnr\s*[:\-]?\s*([A-Z0-9][\w\/\-]+)/i),
    kontrahent: grab(text, /(?:sprzedawca|kontrahent|wykonawca)\s*[:\-]?\s*(.+)/i),
    nip: grab(text, /nip\s*[:\-]?\s*(\d[\d\s-]{8,})/i).replace(/\D/g, ""),
    id_umowy: grab(text, /umow\w*\s*[:\-]?\s*([A-Z0-9][\w\/\-]+)/i),
    okres_od: toISO(grab(text, reDate("okres\\w*\\s*od"))),
    okres_do: toISO(grab(text, reDate("(?:do|okres\\w*\\s*do)"))),
    data_wystawienia: toISO(grab(text, reDate("(?:data wystawienia|wystawiono)"))),
    model,
    godziny: model === "ryczalt" ? 0 : godziny,
    stawka,
    kwota_netto: num(grab(text, /(?:kwota netto|netto|razem)\D{0,15}([\d\s.,]+)/i)),
    rachunek: grab(text, /(?:rachunek|konto|iban)\s*[:\-]?\s*((?:PL)?[\d\s]{20,})/i).replace(/\s/g, ""),
    akceptujacy: grab(text, /(?:akceptuj\w*|zatwierdza)\s*[:\-]?\s*(.+)/i),
    zrodlo: "Demo (tekst)",
  };
}
