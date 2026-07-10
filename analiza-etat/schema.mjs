// Analiza umowy B2B pod kątem znamion umowy o pracę (art. 22 §1 Kodeksu pracy).
// Wynik strukturalny — wszystkie providery (claude/demo) muszą go produkować.
// To wsparcie decyzji dla prawnika, NIE porada prawna — ostatnie słowo ma człowiek.

export const KRYTERIA = [
  "Kierownictwo i podporządkowanie (praca pod kierownictwem zamawiającego)",
  "Wyznaczone miejsce i czas wykonywania pracy",
  "Obowiązek osobistego świadczenia (zakaz zastępstwa/podwykonawstwa)",
  "Ryzyko gospodarcze (kto je ponosi: wykonawca czy zamawiający)",
  "Stałe wynagrodzenie niezależne od rezultatu",
  "Świadczenia typu pracowniczego (płatne przerwy, urlopy, benefity)",
  "Narzędzia i sprzęt zapewniane przez zamawiającego",
  "Wyłączność / zakaz świadczenia usług dla innych podmiotów",
  "Odpowiedzialność wobec osób trzecich (kto ją ponosi)",
  "Podleganie wewnętrznym procedurom i regulaminom zamawiającego",
];

export const ETAT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    ocena: {
      type: "string", enum: ["niskie", "srednie", "wysokie"],
      description: "Ogólne ryzyko uznania umowy za stosunek pracy",
    },
    podsumowanie: {
      type: "string",
      description: "3-5 zdań: najważniejsze ustalenia i co ewentualnie poprawić w umowie",
    },
    kryteria: {
      type: "array",
      description: "Ocena każdego z 10 kryteriów — dokładnie w podanej kolejności",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          nazwa: { type: "string", description: "Nazwa kryterium (z listy)" },
          wskazanie: {
            type: "string", enum: ["etat", "neutralne", "b2b"],
            description: "etat = zapis wskazuje na stosunek pracy; b2b = zapis typowy dla B2B; neutralne = brak zapisu / bez znaczenia",
          },
          cytat: { type: "string", description: "Dosłowny cytat z umowy będący podstawą oceny, albo pusty string" },
          komentarz: { type: "string", description: "1-2 zdania wyjaśnienia" },
        },
        required: ["nazwa", "wskazanie", "cytat", "komentarz"],
      },
    },
  },
  required: ["ocena", "podsumowanie", "kryteria"],
};

export const ETAT_INSTRUCTION =
  "Jesteś asystentem prawnika w polskiej firmie. Oceń przekazaną umowę B2B pod kątem znamion " +
  "stosunku pracy (art. 22 §1 Kodeksu pracy: praca określonego rodzaju na rzecz pracodawcy i pod " +
  "jego kierownictwem, w miejscu i czasie przez niego wyznaczonym, za wynagrodzeniem). Oceń KOLEJNO " +
  "te kryteria:\n" + KRYTERIA.map((k, i) => `${i + 1}. ${k}`).join("\n") + "\n" +
  "Dla każdego kryterium podaj wskazanie (etat/neutralne/b2b), DOSŁOWNY cytat z umowy (albo pusty " +
  "string, jeśli umowa milczy) i krótki komentarz. Nie zgaduj — jeśli czegoś w umowie nie ma, " +
  "wskazanie 'neutralne' i pusty cytat. Ocena ogólna: 'wysokie' gdy 3+ kryteriów wskazuje etat lub " +
  "występuje kierownictwo + miejsce i czas + osobiste świadczenie łącznie; 'niskie' gdy zapisy są " +
  "typowe dla B2B. Zwróć WYŁĄCZNIE JSON zgodny ze schematem. Pamiętaj: to wsparcie analizy, nie " +
  "porada prawna.";

// Walidacja + normalizacja wyniku.
export function validateEtat(raw) {
  const errors = [];
  if (typeof raw !== "object" || raw === null) return { ok: false, errors: ["Wynik nie jest obiektem."], value: null };
  const v = {};
  v.ocena = ["niskie", "srednie", "wysokie"].includes(raw.ocena) ? raw.ocena : "srednie";
  v.podsumowanie = String(raw.podsumowanie || "");
  v.kryteria = Array.isArray(raw.kryteria) ? raw.kryteria.map((k) => ({
    nazwa: String(k?.nazwa || ""),
    wskazanie: ["etat", "neutralne", "b2b"].includes(k?.wskazanie) ? k.wskazanie : "neutralne",
    cytat: String(k?.cytat || ""),
    komentarz: String(k?.komentarz || ""),
  })) : [];
  if (!v.kryteria.length) errors.push("Brak listy kryteriów w wyniku.");
  return { ok: errors.length === 0, errors, value: v };
}
