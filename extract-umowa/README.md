# Auto-odczyt danych z umowy (rejestracja przez wgranie dokumentu)

Wgrana umowa (lub jej tekst jednolity) → **automatyczny odczyt danych do rejestru umów**.
Jeśli czegoś nie da się odczytać, moduł **wskazuje, których pól brakuje** (do ręcznego uzupełnienia).

Ta sama architektura co `extract/` (faktury): wymienny provider, wspólny wynik JSON.

## Providery

| Provider | Czego potrzebuje | Co czyta |
|---|---|---|
| `demo` | nic (działa od ręki) | **tekst** umowy — heurystyka |
| `claude` | `ANTHROPIC_API_KEY` + `npm install @anthropic-ai/sdk` | **PDF lub tekst** — odczyt przez AI (model claude-opus-4-8) |

Wybór: `--provider` lub zmienna `EXTRACTOR_PROVIDER` (domyślnie `demo`).

## Uruchomienie

```bash
# Demo, bez klucza (na tekście):
node extract-umowa/run.mjs --text extract-umowa/sample-umowa.txt

# Claude na PDF umowy:
export ANTHROPIC_API_KEY=sk-ant-...
EXTRACTOR_PROVIDER=claude node extract-umowa/run.mjs --pdf umowa.pdf
```

Wynik: odczytany JSON (numer, kontrahent, model, daty, stawka, limit, rachunek, akceptujący, zakres)
+ status: **„Nie udało się pobrać: …"** dla pól, których nie znaleziono.

## Pola odczytywane

`numer, kontrahent, nip, model (godzinowy/ryczalt), obowiazuje_od, obowiazuje_do, stawka, limit_godzin, rachunek, akceptujacy, zakres`.
Pola kluczowe (raportowane jako braki, jeśli puste): `numer, kontrahent, model, obowiazuje_od, stawka, rachunek, akceptujacy`.

## Pliki

`schema.mjs` (schemat + walidacja + wykrywanie braków) · `providers/{demo,claude}.mjs` · `index.mjs` (fabryka) · `run.mjs` (CLI) · `sample-umowa.txt` (fikcyjny przykład).

## Powiązania

- W demo-appie spotkaniowym ([28-b2b-control-hub-demo-spotkanie.html](../28-b2b-control-hub-demo-spotkanie.html)) ta logika jest wbudowana jako „Wczytaj umowę z dokumentu (auto-odczyt)" — wypełnia formularz i pokazuje braki.
- Zasada bezpieczeństwa: AI odczytuje dane; zapis do rejestru zatwierdza człowiek.
