// Provider "demo" — analiza bez klucza API: proste dopasowanie słów-kluczy.
// Pokazuje kształt wyniku; do realnej pracy służy provider "claude".
import { KRYTERIA } from "../schema.mjs";

const SYGNATURY = [
  { i: 0, etat: ["pod kierownictwem", "polecenia przełożonego", "nadzorem zamawiającego", "podporządkow"], b2b: ["samodzielnie", "według własnego uznania"] },
  { i: 1, etat: ["w siedzibie zamawiającego", "w godzinach 8", "od poniedziałku do piątku", "wyznaczonym miejscu i czasie"], b2b: ["miejsce i czas wykonania usług określa wykonawca", "dowolnym miejscu"] },
  { i: 2, etat: ["osobiście", "bez możliwości zastępstwa", "nie może powierzyć"], b2b: ["może powierzyć wykonanie", "podwykonawc", "zastępc"] },
  { i: 3, etat: [], b2b: ["ryzyko gospodarcze ponosi wykonawca", "na własne ryzyko"] },
  { i: 4, etat: ["stałe miesięczne wynagrodzenie", "niezależnie od rezultatu"], b2b: ["stawka godzinowa", "za wykonane usługi", "po wykonaniu"] },
  { i: 5, etat: ["urlop", "płatna przerwa", "pakiet medyczny", "karta sportowa"], b2b: [] },
  { i: 6, etat: ["sprzęt zamawiającego", "udostępni komputer", "narzędzia pracy zapewnia"], b2b: ["własnym sprzętem", "własnych narzędzi"] },
  { i: 7, etat: ["wyłączność", "nie może świadczyć usług na rzecz innych"], b2b: [] },
  { i: 8, etat: ["odpowiedzialność wobec osób trzecich ponosi zamawiający"], b2b: ["wykonawca ponosi odpowiedzialność", "odpowiedzialność wobec osób trzecich ponosi wykonawca"] },
  { i: 9, etat: ["regulamin", "procedur wewnętrznych", "polityk zamawiającego"], b2b: [] },
];

function znajdz(text, fraza) {
  const idx = text.toLowerCase().indexOf(fraza);
  if (idx < 0) return "";
  return text.slice(Math.max(0, idx - 40), idx + fraza.length + 60).replace(/\s+/g, " ").trim();
}

export async function analyze({ text, pdfBase64 }) {
  if (!text) {
    if (pdfBase64) throw new Error("Provider demo nie czyta PDF — ustaw klucz API (provider claude) albo wgraj .txt/.docx.");
    throw new Error("Brak tekstu do analizy.");
  }
  const t = text.toLowerCase();
  const kryteria = SYGNATURY.map(({ i, etat, b2b }) => {
    const trafEtat = etat.find((f) => t.includes(f));
    const trafB2b = b2b.find((f) => t.includes(f));
    const wskazanie = trafEtat ? "etat" : trafB2b ? "b2b" : "neutralne";
    return {
      nazwa: KRYTERIA[i],
      wskazanie,
      cytat: trafEtat ? znajdz(text, trafEtat) : trafB2b ? znajdz(text, trafB2b) : "",
      komentarz: wskazanie === "etat" ? "Zapis typowy dla stosunku pracy (dopasowanie frazy — tryb demo)."
        : wskazanie === "b2b" ? "Zapis typowy dla współpracy B2B (dopasowanie frazy — tryb demo)."
        : "Umowa nie zawiera charakterystycznych zapisów (tryb demo).",
    };
  });
  const n = kryteria.filter((k) => k.wskazanie === "etat").length;
  return {
    ocena: n >= 3 ? "wysokie" : n >= 1 ? "srednie" : "niskie",
    podsumowanie: `Tryb demo (bez AI): wykryto ${n} z 10 kryteriów wskazujących na stosunek pracy na podstawie prostego dopasowania fraz. Do rzetelnej analizy użyj providera claude (klucz API).`,
    kryteria,
  };
}
