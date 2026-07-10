// B2B Control Hub — serwer (Etap 1: prawdziwy backend + SQLite).
// Zero zależności: wbudowany http + node:sqlite. Uruchomienie: node b2b-hub/server.mjs
// Silnik kontroli jest współdzielony z resztą projektu (extract/control-engine.mjs).

import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CONFIG, providerOpis } from "./config.mjs";
import { runControl, verdict } from "../extract/control-engine.mjs";
import { extractUmowa } from "../extract-umowa/index.mjs";
import { extractInvoice } from "../extract/index.mjs";
import { analyzeEtat } from "../analiza-etat/index.mjs";
import { Kontraktorzy, Umowy, Faktury, Historia, Analizy, log } from "./db.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORT = CONFIG.port;
const AI_PROVIDER = CONFIG.provider;

/* ---------- odczyt dokumentów przez AI ---------- */
// Zamiana wgranego pliku na wejście providera: PDF idzie w całości do modelu
// (czyta też skany), .docx przez mammoth, .txt/.md jako tekst.
async function plikDoWejscia(filename, base64) {
  const ext = path.extname(filename || "").toLowerCase();
  const buf = Buffer.from(base64, "base64");
  if (buf.length > 15 * 1024 * 1024) throw { code: 400, msg: "Plik większy niż 15 MB." };
  if (ext === ".pdf") return { pdfBase64: base64 };
  if (ext === ".docx") {
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ buffer: buf });
    return { text: r.value };
  }
  if (ext === ".txt" || ext === ".md") return { text: buf.toString("utf8") };
  throw { code: 400, msg: `Nieobsługiwany format: ${ext || "(brak rozszerzenia)"}. Wgraj .pdf, .docx lub .txt.` };
}

/* ---------- mapowanie: wiersze bazy -> kształt danych silnika kontroli ---------- */
function umowaDoSilnika(u) {
  return {
    numer: u.numer,
    obowiazuje_od: u.obowiazuje_od,
    obowiazuje_do: u.obowiazuje_do,
    baza: { stawka: u.stawka, limit_godzin: u.limit_godzin, rachunek: u.rachunek, akceptujacy: u.akceptujacy },
    aneksy: u.aneksy || [],
  };
}
function fakturaDoSilnika(f, u) {
  return {
    id_umowy: u.numer, model: u.model,
    okres_od: f.okres_od, okres_do: f.okres_do, data_wystawienia: f.data_wystawienia,
    godziny: f.godziny, stawka: f.stawka, kwota_netto: f.kwota_netto,
    rachunek: f.rachunek, akceptujacy: f.akceptujacy,
  };
}
function kontrolaFaktury(f) {
  const u = Umowy.get(f.umowa_id);
  const { checks, eff } = runControl(fakturaDoSilnika(f, u), umowaDoSilnika(u));
  return { checks, eff, werdykt: verdict(checks) };
}

// "Tekst jednolity": wersja 0 = umowa główna, każdy aneks = nowe warunki obowiązujące.
function wersjeUmowy(u) {
  const eff = { stawka: u.stawka, limit_godzin: u.limit_godzin, rachunek: u.rachunek, akceptujacy: u.akceptujacy };
  const out = [{ idx: 0, data: u.obowiazuje_od, label: "Umowa główna (tekst pierwotny)", warunki: { ...eff }, opis: "Zawarcie umowy." }];
  for (const a of u.aneksy) {
    Object.assign(eff, a.zmiany);
    out.push({ idx: a.nr, data: a.data, label: `Tekst jednolity po Aneksie nr ${a.nr}`, warunki: { ...eff }, opis: a.opis });
  }
  return out;
}

/* ---------- API ---------- */
async function api(method, url, body) {
  const p = url.pathname.split("/").filter(Boolean); // np. ["api","umowy","3","aneksy"]

  if (method === "GET" && url.pathname === "/api/kontraktorzy") return Kontraktorzy.all();
  if (method === "POST" && url.pathname === "/api/kontraktorzy") {
    if (!body?.nazwa?.trim()) throw { code: 400, msg: "Nazwa kontraktora jest wymagana." };
    return Kontraktorzy.add(body);
  }

  if (method === "GET" && url.pathname === "/api/umowy") return Umowy.all();
  if (method === "POST" && url.pathname === "/api/umowy") {
    if (!body?.numer?.trim() || !body?.obowiazuje_od) throw { code: 400, msg: "Numer umowy i data od są wymagane." };
    if (!body?.kontraktor_id) throw { code: 400, msg: "Wybierz kontraktora." };
    return Umowy.add(body);
  }
  if (method === "GET" && p[1] === "umowy" && p[2] && !p[3]) {
    const u = Umowy.get(Number(p[2]));
    if (!u) throw { code: 404, msg: "Nie ma takiej umowy." };
    return { ...u, wersje: wersjeUmowy(u) };
  }
  if (method === "POST" && p[1] === "umowy" && p[2] && p[3] === "aneksy") {
    if (!body?.data) throw { code: 400, msg: "Data wejścia w życie aneksu jest wymagana." };
    const zmiany = {};
    if (body.stawka !== "" && body.stawka != null) zmiany.stawka = Number(body.stawka);
    if (body.limit_godzin !== "" && body.limit_godzin != null) zmiany.limit_godzin = Number(body.limit_godzin);
    if (body.rachunek) zmiany.rachunek = String(body.rachunek).replace(/\s/g, "");
    if (body.akceptujacy) zmiany.akceptujacy = body.akceptujacy;
    if (!Object.keys(zmiany).length) throw { code: 400, msg: "Aneks musi zmieniać co najmniej jedno pole." };
    return Umowy.addAneks(Number(p[2]), { data: body.data, opis: body.opis || "Zmiana warunków.", zmiany });
  }

  if (method === "GET" && url.pathname === "/api/faktury")
    return Faktury.all().map((f) => ({ ...f, kontrola: { werdykt: f.decyzja_status ? { label: f.decyzja_status, cls: f.decyzja_status === "Zatwierdzona" ? "ok" : "bad" } : kontrolaFaktury(f).werdykt } }));
  if (method === "POST" && url.pathname === "/api/faktury") {
    if (!body?.umowa_id || !body?.numer?.trim()) throw { code: 400, msg: "Umowa i numer faktury są wymagane." };
    const f = Faktury.add(body);
    return { ...f, kontrola: kontrolaFaktury(f) };
  }
  if (method === "GET" && p[1] === "faktury" && p[2] && !p[3]) {
    const f = Faktury.get(Number(p[2]));
    if (!f) throw { code: 404, msg: "Nie ma takiej faktury." };
    return { ...f, kontrola: kontrolaFaktury(f) };
  }
  if (method === "POST" && p[1] === "faktury" && p[2] && p[3] === "decyzja") {
    if (!["Zatwierdzona", "Odrzucona"].includes(body?.status)) throw { code: 400, msg: "Decyzja: Zatwierdzona albo Odrzucona." };
    if (!body?.kto?.trim()) throw { code: 400, msg: "Podaj, kto podejmuje decyzję." };
    return Faktury.decyzja(Number(p[2]), body);
  }

  if (method === "GET" && url.pathname === "/api/historia") return Historia.all();

  if (method === "GET" && url.pathname === "/api/ai")
    return { provider: AI_PROVIDER, opis: providerOpis(), organizacja: CONFIG.organizacja };

  // Odczyt UMOWY z dokumentu: plik -> AI -> pola + lista braków + dopasowany kontraktor.
  if (method === "POST" && url.pathname === "/api/odczyt/umowa") {
    if (!body?.base64) throw { code: 400, msg: "Brak pliku." };
    const input = await plikDoWejscia(body.filename, body.base64);
    const r = await extractUmowa(input, { provider: AI_PROVIDER });
    // dopasowanie kontraktora po NIP (pewniejsze) albo po nazwie
    const ks = Kontraktorzy.all();
    const nip = (r.value.nip || "").replace(/[^0-9]/g, "");
    const nazwa = (r.value.kontrahent || "").toLowerCase();
    const k = ks.find((x) => nip && x.nip.replace(/[^0-9]/g, "") === nip)
          || ks.find((x) => nazwa && (x.nazwa.toLowerCase().includes(nazwa.slice(0, 12)) || nazwa.includes(x.nazwa.toLowerCase().slice(0, 12))));
    const istniejaca = Umowy.byNumer(r.value.numer);
    log(`AI (${r.provider}) odczytał umowę z pliku ${body.filename}${r.braki.length ? " — nie odczytano: " + r.braki.join(", ") : " — komplet pól"}.`);
    return { ...r, kontraktor_id: k?.id || null, istniejaca_umowa_id: istniejaca?.id || null };
  }

  // Odczyt FAKTURY z dokumentu: plik -> AI -> pola + dopasowana umowa po numerze.
  if (method === "POST" && url.pathname === "/api/odczyt/faktura") {
    if (!body?.base64) throw { code: 400, msg: "Brak pliku." };
    const input = await plikDoWejscia(body.filename, body.base64);
    const r = await extractInvoice(input, { provider: AI_PROVIDER });
    const nr = (r.value.id_umowy || "").trim().toLowerCase();
    const u = Umowy.all().find((x) => nr && x.numer.toLowerCase() === nr);
    log(`AI (${r.provider}) odczytał fakturę z pliku ${body.filename}${u ? ` — powiązano z umową ${u.numer}` : " — nie rozpoznano umowy"}.`);
    return { ...r, umowa_id: u?.id || null };
  }

  // Analiza prawna: znamiona umowy o pracę w umowie B2B (art. 22 KP). Wynik trafia do bazy.
  if (method === "POST" && url.pathname === "/api/analiza-etat") {
    if (!body?.base64) throw { code: 400, msg: "Brak pliku." };
    const input = await plikDoWejscia(body.filename, body.base64);
    const r = await analyzeEtat(input, { provider: AI_PROVIDER });
    const a = Analizy.add({ plik: body.filename, wynik: r.value });
    return { id: a.id, provider: r.provider, ...a };
  }
  if (method === "GET" && url.pathname === "/api/analizy") return Analizy.all();
  if (method === "GET" && p[1] === "analizy" && p[2]) {
    const a = Analizy.get(Number(p[2]));
    if (!a) throw { code: 404, msg: "Nie ma takiej analizy." };
    return a;
  }

  if (method === "GET" && url.pathname === "/api/pulpit") {
    const faktury = Faktury.all();
    const kolejka = faktury.filter((f) => !f.decyzja_status);
    const niezgodne = kolejka.filter((f) => kontrolaFaktury(f).werdykt.cls === "bad");
    return {
      kontraktorzy: Kontraktorzy.all().length,
      umowy: Umowy.all().length,
      w_kolejce: kolejka.length,
      niezgodnosci: niezgodne.length,
    };
  }

  throw { code: 404, msg: "Nieznany adres API." };
}

/* ---------- serwer HTTP ---------- */
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png", ".svg": "image/svg+xml" };

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      let body = null;
      if (req.method === "POST") {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
      }
      const data = await api(req.method, url, body);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify(data));
      return;
    }
    // pliki statyczne z public/
    const file = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const safe = path.normalize(file).replace(/^(\.\.[\\/])+/, "");
    const buf = await readFile(path.join(HERE, "public", safe));
    res.writeHead(200, { "Content-Type": MIME[path.extname(safe)] || "application/octet-stream" });
    res.end(buf);
  } catch (e) {
    const code = e.code && Number.isInteger(e.code) ? e.code : e.code === "ENOENT" ? 404 : 500;
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: e.msg || (code === 404 ? "Nie znaleziono." : "Błąd serwera: " + (e.message || e)) }));
    if (code === 500) console.error(e);
  }
});

server.listen(PORT, () => {
  console.log(`B2B Control Hub (${CONFIG.organizacja})`);
  console.log(`  Adres:              http://localhost:${PORT}`);
  console.log(`  Baza danych (1 plik): b2b-hub/data/hub.db`);
  console.log(`  Odczyt dokumentów AI: ${providerOpis()}`);
});
