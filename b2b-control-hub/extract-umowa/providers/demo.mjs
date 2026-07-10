// Provider "demo" — odczyt danych umowy z TEKSTU, bez klucza API (heurystyka).
// Działa od ręki na demo; wersję na PDF/Word z AI daje provider "claude".

function toISO(s){ if(!s) return ""; if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m=String(s).match(/(\d{1,2})[.\/]\s?(\d{1,2})[.\/]\s?(\d{4})/); if(m) return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
  const r=String(s).match(/(\d{1,2})\s+(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia)\s+(\d{4})/i);
  const mc={stycznia:1,lutego:2,marca:3,kwietnia:4,maja:5,czerwca:6,lipca:7,sierpnia:8,"września":9,"października":10,listopada:11,grudnia:12};
  if(r) return `${r[3]}-${String(mc[r[2].toLowerCase()]).padStart(2,"0")}-${r[1].padStart(2,"0")}`; return ""; }
function num(s){ if(!s) return 0; return Number(String(s).replace(/\s/g,"").replace(/zł|pln/gi,"").replace(/\.(?=\d{3}\b)/g,"").replace(",", ".")) || 0; }
function grab(t,re){ const m=t.match(re); return m? m[1].trim():""; }

export async function extract({ text }){
  if(!text) throw new Error('Provider "demo" wymaga pola text (treści umowy).');
  const ryczalt = /miesięczn\w*\s+wynagrodz|ryczałt|\/\s?mc|miesięcznie/i.test(text);
  const stawka = num(grab(text, /(?:stawk\w*|wynagrodzeni\w*)\D{0,40}?([\d\s.,]+)\s*(?:zł|pln)/i));
  return {
    numer: grab(text, /(?:umow\w*\s*(?:nr|numer)?|nr)\s*[:\-]?\s*([A-Z0-9][\w\/\-]{3,})/i),
    kontrahent: grab(text, /(?:usługodawc\w*|wykonawc\w*|zleceniobiorc\w*)\s*[:\-]?\s*([^\n,]+?(?:sp\.?\s*z\s*o\.?o\.?|s\.a\.|jdg)?)\s*(?:\n|,|\()/i)
              || grab(text, /(?:usługodawc\w*|wykonawc\w*)\s*[:\-]?\s*([^\n]+)/i),
    nip: grab(text, /nip\D{0,6}(\d[\d\s-]{8,})/i).replace(/\D/g,""),
    model: ryczalt ? "ryczalt" : "godzinowy",
    obowiazuje_od: toISO(grab(text, /(?:obowiązuje\s*od|od\s*dnia|z\s*dnia|zawart\w*\s*dnia)\D{0,12}([\d.\/]{8,10}|\d{1,2}\s+\w+\s+\d{4})/i)),
    obowiazuje_do: toISO(grab(text, /(?:obowiązuje\s*do|do\s*dnia|na\s*czas\s*do)\D{0,12}([\d.\/]{8,10}|\d{1,2}\s+\w+\s+\d{4})/i)),
    stawka,
    limit_godzin: ryczalt ? 0 : num(grab(text, /limit\D{0,20}?([\d\s.,]+)\s*(?:h|godz)/i)),
    rachunek: grab(text, /(?:rachunek|konto|iban)\D{0,8}((?:PL)?[\d\s]{20,})/i).replace(/\s/g,""),
    akceptujacy: grab(text, /(?:akceptuj\w*|zatwierdza|osoba\s*akceptująca)\s*[:\-]?\s*([^\n]+)/i),
    zakres: grab(text, /(?:przedmiot\w*|zakres\w*)\D{0,20}?[:\-]?\s*([^\n]{8,120})/i),
  };
}
