// Wspólny schemat JSON faktury — wszystkie providery (Claude, Azure, demo) muszą go produkować.
// Używany jako: (1) instrukcja dla AI, (2) walidacja wyniku przed wpuszczeniem do silnika kontroli.

export const INVOICE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    numer: { type: "string", description: "Numer faktury, np. FV/06/2026/118" },
    kontrahent: { type: "string", description: "Pełna nazwa kontrahenta (sprzedawcy)" },
    nip: { type: "string", description: "NIP sprzedawcy, same cyfry lub pusty" },
    id_umowy: { type: "string", description: "Numer umowy, jeśli podany na fakturze, inaczej pusty" },
    okres_od: { type: "string", description: "Początek okresu rozliczeniowego RRRR-MM-DD" },
    okres_do: { type: "string", description: "Koniec okresu rozliczeniowego RRRR-MM-DD" },
    data_wystawienia: { type: "string", description: "Data wystawienia RRRR-MM-DD" },
    model: { type: "string", enum: ["godzinowy", "ryczalt"], description: "Model rozliczenia" },
    godziny: { type: "number", description: "Liczba godzin (0 dla ryczałtu)" },
    stawka: { type: "number", description: "Stawka: zł/h dla godzinowego, zł/mc dla ryczałtu" },
    kwota_netto: { type: "number", description: "Kwota netto w zł" },
    rachunek: { type: "string", description: "Numer rachunku bankowego (IBAN)" },
    akceptujacy: { type: "string", description: "Osoba akceptująca, jeśli wskazana, inaczej pusty" },
    zrodlo: { type: "string", description: "Źródło dokumentu: KSeF / E-mail / PDF" },
  },
  required: [
    "numer", "kontrahent", "nip", "id_umowy", "okres_od", "okres_do",
    "data_wystawienia", "model", "godziny", "stawka", "kwota_netto",
    "rachunek", "akceptujacy", "zrodlo",
  ],
};

const FIELDS = INVOICE_JSON_SCHEMA.required;

// Lekka walidacja + normalizacja (nie polegamy tylko na trybie strict API — demo też przez to przechodzi).
export function validateInvoice(raw) {
  const errors = [];
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["Wynik nie jest obiektem JSON."], value: null };
  }
  const v = {};
  for (const f of FIELDS) {
    if (!(f in raw)) errors.push(`Brak pola: ${f}`);
  }
  // Typy liczbowe
  for (const numField of ["godziny", "stawka", "kwota_netto"]) {
    const n = Number(raw[numField]);
    if (Number.isNaN(n)) errors.push(`Pole ${numField} nie jest liczbą: ${raw[numField]}`);
    v[numField] = n;
  }
  // Model
  v.model = raw.model === "ryczalt" ? "ryczalt" : "godzinowy";
  // Daty RRRR-MM-DD
  for (const dField of ["okres_od", "okres_do", "data_wystawienia"]) {
    const s = String(raw[dField] || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) errors.push(`Pole ${dField} nie jest datą RRRR-MM-DD: ${s}`);
    v[dField] = s;
  }
  // Pozostałe tekstowe
  for (const sField of ["numer", "kontrahent", "nip", "id_umowy", "rachunek", "akceptujacy", "zrodlo"]) {
    v[sField] = raw[sField] == null ? "" : String(raw[sField]);
  }
  return { ok: errors.length === 0, errors, value: v };
}

export const EXTRACTION_INSTRUCTION =
  "Jesteś asystentem księgowym. Wyciągnij dane z faktury i zwróć WYŁĄCZNIE obiekt JSON " +
  "zgodny ze schematem. Daty w formacie RRRR-MM-DD. Kwoty i stawki jako liczby (bez 'zł', " +
  "bez spacji). Dla modelu 'ryczalt' ustaw godziny = 0. Jeśli pola nie ma na fakturze, użyj " +
  'pustego stringa "" (dla tekstu) lub 0 (dla liczb). Nie zgaduj rachunku ani NIP — przepisz dokładnie.';
