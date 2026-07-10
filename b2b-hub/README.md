# B2B Control Hub — wersja z prawdziwym backendem (Etap 1)

To już nie jest demo w HTML: dane zapisują się w **prawdziwej bazie SQLite**
(`data/hub.db` — jeden plik), a każdy guzik w przeglądarce wywołuje **prawdziwe API**.

## Uruchomienie

Dwuklik: **`start.cmd`** (uruchamia serwer i otwiera http://localhost:5180).
Ręcznie: `node b2b-hub/server.mjs` (z folderu projektu).

## Architektura (3 warstwy — tak buduje się prawdziwe aplikacje)

```
przeglądarka (public/index.html)      ← interfejs: tylko wyświetla i wysyła
        │  fetch() /api/...
serwer  (server.mjs)                  ← logika: walidacja, silnik kontroli
        │
baza    (db.mjs → data/hub.db)        ← dane: SQLite, jeden plik na dysku
```

- **Silnik kontroli 7 reguł** jest współdzielony z resztą projektu:
  `../extract/control-engine.mjs` (jedna wersja prawdy, zero duplikacji).
- **Zero zależności npm** — wystarczy Node 22.5+ (SQLite jest wbudowane).

## API (dla ciekawych / do integracji)

| Metoda | Adres | Co robi |
|---|---|---|
| GET/POST | `/api/kontraktorzy` | lista / dodanie kontrahenta |
| GET/POST | `/api/umowy` | lista / rejestracja umowy |
| GET | `/api/umowy/:id` | umowa + aneksy + wersje tekstu jednolitego |
| POST | `/api/umowy/:id/aneksy` | dodanie aneksu |
| GET/POST | `/api/faktury` | lista / rejestracja faktury (od razu z kontrolą) |
| GET | `/api/faktury/:id` | faktura + wynik kontroli 7 reguł |
| POST | `/api/faktury/:id/decyzja` | decyzja człowieka (audyt: kto, kiedy, komentarz) |
| GET | `/api/historia` | dziennik operacji |
| GET | `/api/pulpit` | liczniki KPI |

## Przeniesienie do klienta

1. Na serwerze klienta: zainstaluj Node.js (LTS).
2. Skopiuj folder projektu (wystarczą `b2b-hub/` + `extract/control-engine.mjs`).
3. `node b2b-hub/server.mjs` — dane od tej chwili żyją w JEDNYM pliku
   `b2b-hub/data/hub.db` **na serwerze klienta** i nigdzie indziej.
4. Kopia zapasowa = skopiowanie pliku `hub.db`.

## Odczyt dokumentów przez AI (Etap 2 — zrobione)

W zakładkach **Umowy** i **Rozliczenia** jest przycisk „📄 Wczytaj … z dokumentu (AI)":
wgrywasz plik (**.pdf — także skan**, .docx, .txt), AI odczytuje pola do formularza,
Ty sprawdzasz i klikasz Zapisz. AI **niczego nie zapisuje samo** — człowiek zatwierdza.

- Umowa: system dopasowuje kontrahenta po NIP/nazwie; jeśli go nie ma w rejestrze,
  najpierw otwiera formularz kontrahenta (wypełniony), potem umowy.
- Faktura: system dopasowuje umowę po numerze z faktury.
- Braki oznaczane wprost: „Nie odczytano: …" — bez zgadywania.

Warstwa AI jest **wymienna** (`extract/` i `extract-umowa/`, providery: `claude`/`azure`/`demo`).
Klucz: zmienna `ANTHROPIC_API_KEY` albo plik `generator/apikey.txt` (gitignore).
U klienta podmieniamy providera na jego środowisko (np. Azure OpenAI) — reszta bez zmian.

## Dalsze etapy

- Etap 3: dziennik decyzji rozszerzony o załączniki i role.
- Etap 4: moduł prawnika — „znamiona umowy o pracę" w umowie B2B.
- Etap 5: pakowanie/instalator.
