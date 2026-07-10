// B2B Control Hub — warstwa bazy danych (SQLite wbudowane w Node 22.5+).
// Cała baza to JEDEN plik: data/hub.db — kopiujesz plik, przenosisz dane.

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(HERE, "data");
mkdirSync(DATA_DIR, { recursive: true });

export const db = new DatabaseSync(path.join(DATA_DIR, "hub.db"));
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

db.exec(`
CREATE TABLE IF NOT EXISTS kontraktorzy (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  nazwa     TEXT NOT NULL,
  nip       TEXT DEFAULT '',
  rachunek  TEXT DEFAULT '',
  utworzono TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS umowy (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  kontraktor_id INTEGER NOT NULL REFERENCES kontraktorzy(id),
  numer         TEXT NOT NULL UNIQUE,
  model         TEXT NOT NULL DEFAULT 'godzinowy',   -- godzinowy | ryczalt
  obowiazuje_od TEXT NOT NULL,                        -- RRRR-MM-DD
  obowiazuje_do TEXT DEFAULT '',
  zakres        TEXT DEFAULT '',
  stawka        REAL NOT NULL DEFAULT 0,
  limit_godzin  REAL,                                 -- NULL = brak limitu
  rachunek      TEXT DEFAULT '',
  akceptujacy   TEXT DEFAULT '',
  utworzono     TEXT DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS aneksy (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  umowa_id INTEGER NOT NULL REFERENCES umowy(id),
  nr       INTEGER NOT NULL,
  data     TEXT NOT NULL,                             -- data wejścia w życie
  opis     TEXT DEFAULT '',
  zmiany   TEXT NOT NULL DEFAULT '{}'                 -- JSON: {stawka?, limit_godzin?, rachunek?, akceptujacy?}
);

CREATE TABLE IF NOT EXISTS faktury (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  umowa_id          INTEGER NOT NULL REFERENCES umowy(id),
  numer             TEXT NOT NULL,
  okres_od          TEXT DEFAULT '',
  okres_do          TEXT DEFAULT '',
  data_wystawienia  TEXT DEFAULT '',
  godziny           REAL DEFAULT 0,
  stawka            REAL DEFAULT 0,
  kwota_netto       REAL DEFAULT 0,
  rachunek          TEXT DEFAULT '',
  akceptujacy       TEXT DEFAULT '',
  zrodlo            TEXT DEFAULT 'ręcznie',           -- KSeF | E-mail | PDF | ręcznie
  utworzono         TEXT DEFAULT (datetime('now','localtime')),
  -- decyzja człowieka (audyt): NULL dopóki nie podjęta
  decyzja_status    TEXT,                             -- Zatwierdzona | Odrzucona
  decyzja_kto       TEXT,
  decyzja_kiedy     TEXT,
  decyzja_komentarz TEXT
);

CREATE TABLE IF NOT EXISTS historia (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  ts    TEXT DEFAULT (datetime('now','localtime')),
  tekst TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analizy (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  ts     TEXT DEFAULT (datetime('now','localtime')),
  plik   TEXT NOT NULL,
  ocena  TEXT NOT NULL,          -- niskie | srednie | wysokie
  wynik  TEXT NOT NULL           -- pełny JSON analizy (podsumowanie + kryteria)
);
`);

/* ---------- pomocnicze ---------- */
export function log(tekst) {
  db.prepare("INSERT INTO historia (tekst) VALUES (?)").run(tekst);
}

/* ---------- kontraktorzy ---------- */
export const Kontraktorzy = {
  all: () => db.prepare("SELECT * FROM kontraktorzy ORDER BY nazwa").all(),
  get: (id) => db.prepare("SELECT * FROM kontraktorzy WHERE id=?").get(id),
  add({ nazwa, nip = "", rachunek = "" }) {
    const r = db.prepare("INSERT INTO kontraktorzy (nazwa,nip,rachunek) VALUES (?,?,?)")
      .run(nazwa, nip, rachunek.replace(/\s/g, ""));
    log(`Dodano kontraktora: ${nazwa}.`);
    return this.get(r.lastInsertRowid);
  },
};

/* ---------- umowy + aneksy ---------- */
export const Umowy = {
  all() {
    return db.prepare(`
      SELECT u.*, k.nazwa AS kontraktor_nazwa,
             (SELECT COUNT(*) FROM aneksy a WHERE a.umowa_id = u.id) AS liczba_aneksow
      FROM umowy u JOIN kontraktorzy k ON k.id = u.kontraktor_id
      ORDER BY u.numer`).all();
  },
  get(id) {
    const u = db.prepare(`
      SELECT u.*, k.nazwa AS kontraktor_nazwa
      FROM umowy u JOIN kontraktorzy k ON k.id = u.kontraktor_id
      WHERE u.id=?`).get(id);
    if (!u) return null;
    u.aneksy = db.prepare("SELECT * FROM aneksy WHERE umowa_id=? ORDER BY data, nr").all(id)
      .map((a) => ({ ...a, zmiany: JSON.parse(a.zmiany) }));
    return u;
  },
  byNumer(numer) {
    return db.prepare("SELECT * FROM umowy WHERE lower(numer)=lower(?)").get(String(numer || "").trim());
  },
  add(v) {
    if (this.byNumer(v.numer))
      throw { code: 400, msg: `Umowa o numerze ${v.numer} już jest w rejestrze. Jeśli warunki się zmieniły — otwórz ją i dodaj aneks.` };
    const r = db.prepare(`
      INSERT INTO umowy (kontraktor_id,numer,model,obowiazuje_od,obowiazuje_do,zakres,stawka,limit_godzin,rachunek,akceptujacy)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(v.kontraktor_id, v.numer, v.model || "godzinowy", v.obowiazuje_od, v.obowiazuje_do || "",
           v.zakres || "", Number(v.stawka) || 0, v.limit_godzin == null || v.limit_godzin === "" ? null : Number(v.limit_godzin),
           (v.rachunek || "").replace(/\s/g, ""), v.akceptujacy || "");
    log(`Zarejestrowano umowę ${v.numer}.`);
    return this.get(r.lastInsertRowid);
  },
  addAneks(umowaId, { data, opis = "", zmiany }) {
    const nr = (db.prepare("SELECT MAX(nr) AS m FROM aneksy WHERE umowa_id=?").get(umowaId).m || 0) + 1;
    db.prepare("INSERT INTO aneksy (umowa_id,nr,data,opis,zmiany) VALUES (?,?,?,?,?)")
      .run(umowaId, nr, data, opis, JSON.stringify(zmiany));
    const u = this.get(umowaId);
    log(`Dodano Aneks nr ${nr} do ${u.numer} — powstał nowy tekst jednolity.`);
    return u;
  },
};

/* ---------- faktury ---------- */
export const Faktury = {
  all() {
    return db.prepare(`
      SELECT f.*, u.numer AS umowa_numer, u.model, k.nazwa AS kontraktor_nazwa
      FROM faktury f JOIN umowy u ON u.id = f.umowa_id
                     JOIN kontraktorzy k ON k.id = u.kontraktor_id
      ORDER BY f.id DESC`).all();
  },
  get(id) {
    return db.prepare(`
      SELECT f.*, u.numer AS umowa_numer, u.model, k.nazwa AS kontraktor_nazwa
      FROM faktury f JOIN umowy u ON u.id = f.umowa_id
                     JOIN kontraktorzy k ON k.id = u.kontraktor_id
      WHERE f.id=?`).get(id);
  },
  add(v) {
    const r = db.prepare(`
      INSERT INTO faktury (umowa_id,numer,okres_od,okres_do,data_wystawienia,godziny,stawka,kwota_netto,rachunek,akceptujacy,zrodlo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .run(v.umowa_id, v.numer, v.okres_od || "", v.okres_do || "", v.data_wystawienia || v.okres_do || "",
           Number(v.godziny) || 0, Number(v.stawka) || 0, Number(v.kwota_netto) || 0,
           (v.rachunek || "").replace(/\s/g, ""), v.akceptujacy || "", v.zrodlo || "ręcznie");
    log(`Zarejestrowano fakturę ${v.numer} (${v.zrodlo || "ręcznie"}).`);
    return this.get(r.lastInsertRowid);
  },
  decyzja(id, { status, kto, komentarz = "" }) {
    db.prepare(`UPDATE faktury SET decyzja_status=?, decyzja_kto=?, decyzja_kiedy=datetime('now','localtime'), decyzja_komentarz=? WHERE id=?`)
      .run(status, kto, komentarz, id);
    const f = this.get(id);
    log(`Faktura ${f.numer}: ${status} przez ${kto}${komentarz ? " — " + komentarz : ""}.`);
    return f;
  },
};

export const Historia = {
  all: (limit = 100) => db.prepare("SELECT * FROM historia ORDER BY id DESC LIMIT ?").all(limit),
};

/* ---------- analizy prawne (znamiona etatu) ---------- */
export const Analizy = {
  all: () => db.prepare("SELECT id, ts, plik, ocena FROM analizy ORDER BY id DESC").all(),
  get(id) {
    const a = db.prepare("SELECT * FROM analizy WHERE id=?").get(id);
    return a ? { ...a, wynik: JSON.parse(a.wynik) } : null;
  },
  add({ plik, wynik }) {
    const r = db.prepare("INSERT INTO analizy (plik, ocena, wynik) VALUES (?,?,?)")
      .run(plik, wynik.ocena, JSON.stringify(wynik));
    log(`Analiza prawna pliku ${plik}: ryzyko ${wynik.ocena.toUpperCase()}.`);
    return this.get(r.lastInsertRowid);
  },
};
