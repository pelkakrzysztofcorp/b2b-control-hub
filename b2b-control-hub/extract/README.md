# Document AI — ekstrakcja faktur (Etap 2)

Wyciąga dane z dokumentu faktury i wpuszcza je do silnika kontroli z Etapu 1.
Ekstrakcja jest **wymienna** — wybierasz dostawcę (provider) jednym ustawieniem,
wynik zawsze ma ten sam format JSON ([`schema.mjs`](schema.mjs)).

## Providery

| Provider | Czego potrzebuje | Kiedy używać |
|---|---|---|
| `demo` | nic (działa od ręki) | testy, pokaz całego obiegu bez kont/kosztów; parsuje wklejony **tekst** |
| `claude` | `ANTHROPIC_API_KEY` + `npm install @anthropic-ai/sdk` | produkcja; czyta **PDF lub tekst**, najlepiej radzi sobie z umowami i nietypowymi fakturami |
| `azure` | `AZURE_DI_ENDPOINT` + `AZURE_DI_KEY` | klient w ekosystemie Microsoft; czyta **PDF** (model prebuilt-invoice) |

Wybór dostawcy: flaga `--provider` **lub** zmienna `EXTRACTOR_PROVIDER` (domyślnie `demo`).

## Uruchomienie

```bash
# Demo, bez żadnego klucza — parsuje tekst:
node extract/run.mjs --text extract/sample-faktura.txt

# Claude na PDF:
export ANTHROPIC_API_KEY=sk-ant-...
npm install @anthropic-ai/sdk
EXTRACTOR_PROVIDER=claude node extract/run.mjs --pdf faktura.pdf

# Azure na PDF:
export AZURE_DI_ENDPOINT=https://twoja-nazwa.cognitiveservices.azure.com
export AZURE_DI_KEY=...
node extract/run.mjs --provider azure --pdf faktura.pdf
```

Wynik: wyciągnięty JSON → lista kontroli (7 reguł) → werdykt (ZGODNA / WYMAGA UWAGI / WSTRZYMANA).

## Z czego się składa

- [`schema.mjs`](schema.mjs) — wspólny schemat JSON + walidacja (kontrakt dla wszystkich providerów)
- [`providers/`](providers) — adaptery: `demo.mjs`, `claude.mjs`, `azure.mjs`
- [`index.mjs`](index.mjs) — fabryka: wybiera provider, waliduje wynik
- [`control-engine.mjs`](control-engine.mjs) — silnik kontroli (ta sama logika co w `27-...html`)
- [`run.mjs`](run.mjs) — CLI łączące ekstrakcję + kontrolę
- [`contracts.json`](contracts.json) — przykładowy rejestr umów (baza + aneksy)

## Zasada bezpieczeństwa

AI tylko **odczytuje i strukturyzuje** dane. Zgodność liczy deterministyczny silnik,
a ostateczną decyzję o płatności podejmuje człowiek (zgodnie z `AGENTS.md`).

## Co dalej

- Podpiąć rejestr umów do realnego źródła (Google Sheets / baza), zamiast `contracts.json`.
- Połączyć z Make (plik `22-...md`): faktura ze skrzynki → ekstrakcja → kontrola → alert.
- Rozszerzyć ekstrakcję umów i aneksów (nie tylko faktur), żeby AI samo budowało rejestr.
