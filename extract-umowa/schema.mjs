// Wspólny schemat danych umowy — wynik odczytu z dokumentu (wgranej umowy / tekstu jednolitego).
// Te pola zasilają rejestr umów w systemie. Wszystkie providery muszą go produkować.

export const UMOWA_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    numer: { type: "string", description: "Numer/oznaczenie umowy" },
    kontrahent: { type: "string", description: "Nazwa kontrahenta (Usługodawcy/Wykonawcy)" },
    nip: { type: "string", description: "NIP kontrahenta (same cyfry) lub pusty" },
    model: { type: "string", enum: ["godzinowy", "ryczalt"], description: "Model rozliczenia" },
    obowiazuje_od: { type: "string", description: "Data obowiązywania od RRRR-MM-DD" },
    obowiazuje_do: { type: "string", description: "Data obowiązywania do RRRR-MM-DD (pusty = bezterminowa)" },
    stawka: { type: "number", description: "Stawka: zł/h (godzinowy) lub zł/mc (ryczałt); 0 jeśli brak" },
    limit_godzin: { type: "number", description: "Limit godzin/mc (0 = brak/nie dotyczy)" },
    rachunek: { type: "string", description: "Rachunek bankowy (IBAN) lub pusty" },
    akceptujacy: { type: "string", description: "Osoba akceptująca po stronie zamawiającego lub pusty" },
    zakres: { type: "string", description: "Krótki opis zakresu usług" },
  },
  required: ["numer","kontrahent","nip","model","obowiazuje_od","obowiazuje_do","stawka","limit_godzin","rachunek","akceptujacy","zakres"],
};

// Pola, których brak realnie blokuje kontrolę faktur — to one trafiają do listy "nie udało się pobrać".
const KLUCZOWE = ["numer","kontrahent","model","obowiazuje_od","stawka","rachunek","akceptujacy"];

export const UMOWA_INSTRUCTION =
  "Wyciągnij dane z umowy B2B o świadczenie usług (lub jej tekstu jednolitego) i zwróć WYŁĄCZNIE " +
  "obiekt JSON zgodny ze schematem. Daty RRRR-MM-DD. Stawkę i limit jako liczby (bez 'zł'/'PLN'/spacji). " +
  "Model: 'ryczalt' gdy wynagrodzenie miesięczne stałe, 'godzinowy' gdy stawka za godzinę. Dla ryczałtu " +
  "limit_godzin = 0. Jeśli pola nie ma w dokumencie, użyj \"\" (tekst) lub 0 (liczba) — nie zgaduj.";

export function validateUmowa(raw) {
  const errors = [];
  if (typeof raw !== "object" || raw === null) return { ok:false, errors:["Wynik nie jest obiektem."], value:null, braki:[] };
  const v = {};
  v.model = raw.model === "ryczalt" ? "ryczalt" : "godzinowy";
  for (const n of ["stawka","limit_godzin"]) { const x=Number(raw[n]); v[n]=Number.isNaN(x)?0:x; }
  for (const dF of ["obowiazuje_od","obowiazuje_do"]) {
    const s=String(raw[dF]||""); if(s && !/^\d{4}-\d{2}-\d{2}$/.test(s)) errors.push(`Pole ${dF} nie jest datą RRRR-MM-DD: ${s}`); v[dF]=s;
  }
  for (const sF of ["numer","kontrahent","nip","rachunek","akceptujacy","zakres"]) v[sF]= raw[sF]==null?"":String(raw[sF]);

  // Czego nie udało się pobrać (kluczowe pola puste/zerowe)
  const braki = KLUCZOWE.filter(k => {
    const val = v[k];
    return (typeof val === "number") ? !val : !String(val).trim();
  });
  return { ok: errors.length===0, errors, value:v, braki };
}
