// Silnik kontroli B2B — wersja modułowa (Etap 1), współdzielona przez narzędzia Node.
// Logika identyczna jak w 27-b2b-control-hub-silnik-kontroli-v1.html.
// Werdykt liczy ten kod deterministycznie; ostateczną decyzję podejmuje człowiek.

const d = (s) => new Date(String(s) + "T00:00:00");
const norm = (s) => (s || "").replace(/\s/g, "");

export const plMoney = new Intl.NumberFormat("pl-PL", {
  style: "currency",
  currency: "PLN",
  maximumFractionDigits: 0,
});

// Konsolidacja umowy: baza + aneksy obowiązujące na dzień faktury -> warunki aktualne.
export function consolidate(contract, asOf) {
  const eff = { ...contract.baza };
  const limit = asOf ? d(asOf) : null;
  [...(contract.aneksy || [])]
    .sort((a, b) => d(a.data) - d(b.data))
    .filter((a) => !limit || d(a.data) <= limit)
    .forEach((a) => Object.assign(eff, a.zmiany));
  return eff; // { stawka, limit_godzin, rachunek, akceptujacy }
}

// Główny silnik: zwraca listę kontroli (każda: { t, status, det }) + warunki efektywne.
export function runControl(inv, contract) {
  const eff = consolidate(contract, inv.data_wystawienia);
  const checks = [];
  const add = (t, status, det) => checks.push({ t, status, det });

  if (inv.id_umowy && inv.id_umowy === contract.numer)
    add("Powiązanie z umową", "ok", `Faktura przypisana do ${contract.numer}.`);
  else
    add("Powiązanie z umową", "bad", "Brak jednoznacznego powiązania z aktywną umową.");

  if (d(inv.okres_od) >= d(contract.obowiazuje_od) && d(inv.okres_do) <= d(contract.obowiazuje_do))
    add("Okres współpracy", "ok", `Okres faktury mieści się w umowie.`);
  else
    add("Okres współpracy", "bad", `Okres faktury wykracza poza umowę kończącą się ${contract.obowiazuje_do}.`);

  if (inv.model === "godzinowy") {
    if (inv.stawka === eff.stawka) add("Stawka po aneksach", "ok", `${inv.stawka} zł/h zgodne z aktualnymi warunkami.`);
    else add("Stawka po aneksach", "bad", `Faktura: ${inv.stawka} zł/h, umowa po aneksach: ${eff.stawka} zł/h.`);
  } else {
    if (inv.stawka === eff.stawka) add("Stawka ryczałtowa", "ok", `${plMoney.format(inv.stawka)}/mc zgodne z umową.`);
    else add("Stawka ryczałtowa", "bad", `Faktura: ${plMoney.format(inv.stawka)}/mc, umowa: ${plMoney.format(eff.stawka)}/mc.`);
  }

  if (inv.model === "godzinowy" && eff.limit_godzin != null) {
    if (inv.godziny <= eff.limit_godzin) add("Limit godzin", "ok", `${inv.godziny} h w limicie ${eff.limit_godzin} h.`);
    else add("Limit godzin", "bad", `${inv.godziny} h przekracza limit ${eff.limit_godzin} h o ${inv.godziny - eff.limit_godzin} h.`);
  }

  const expected = inv.model === "godzinowy" ? inv.godziny * inv.stawka : inv.stawka;
  if (Math.abs(inv.kwota_netto - expected) < 0.5)
    add("Kwota netto", "ok", `${plMoney.format(inv.kwota_netto)} zgodne z wyliczeniem.`);
  else
    add("Kwota netto", "bad", `Faktura: ${plMoney.format(inv.kwota_netto)}, wyliczenie: ${plMoney.format(expected)}.`);

  if (norm(inv.rachunek) === norm(eff.rachunek))
    add("Rachunek bankowy", "ok", "Rachunek zgodny z kartą kontrahenta.");
  else
    add("Rachunek bankowy", "bad", "Rachunek na fakturze różni się od rachunku z umowy.");

  if (inv.akceptujacy && inv.akceptujacy === eff.akceptujacy)
    add("Osoba akceptująca", "ok", `${inv.akceptujacy} — zgodna z umową.`);
  else
    add("Osoba akceptująca", "warn", `Akceptujący do potwierdzenia (umowa: ${eff.akceptujacy || "brak"}).`);

  return { checks, eff };
}

export function verdict(checks) {
  if (checks.some((c) => c.status === "bad")) {
    const n = checks.filter((c) => c.status === "bad").length;
    return { cls: "bad", label: "WSTRZYMANA — NIEZGODNA", n, note: `${n} niezgodności do decyzji przełożonego` };
  }
  if (checks.some((c) => c.status === "warn")) {
    const n = checks.filter((c) => c.status === "warn").length;
    return { cls: "warn", label: "WYMAGA UWAGI", n, note: `${n} element(y) do potwierdzenia` };
  }
  return { cls: "ok", label: "ZGODNA", n: 0, note: "Brak rozbieżności — gotowa do akceptacji" };
}
