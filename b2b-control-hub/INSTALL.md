# B2B Control Hub — instrukcja wdrożenia

System do kontroli współpracy B2B: rejestry umów, aneksów i faktur, automatyczna
kontrola zgodności faktur, odczyt dokumentów przez AI oraz analiza prawna umów
(znamiona stosunku pracy). **Wszystkie dane pozostają na tym komputerze/serwerze** —
baza to jeden plik SQLite (`b2b-hub/data/hub.db`), nic nie jest wysyłane na zewnątrz
poza (opcjonalnym) zapytaniem do wybranego dostawcy AI przy odczycie dokumentu.

## Wymagania
- **Node.js** w wersji LTS (22.5 lub nowszej) — https://nodejs.org
- System Windows (launchery .cmd) lub dowolny z Node (uruchomienie: `node b2b-hub/server.mjs`)

## Instalacja (raz)
1. Skopiuj ten folder na serwer/komputer docelowy.
2. Dwuklik **instalacja.cmd** — pobierze biblioteki i utworzy `config.json`.
3. Otwórz **config.json** i uzupełnij:
   - `organizacja` — nazwa firmy (wyświetla się w nagłówku),
   - `ai.anthropic_api_key` — klucz API do odczytu/analizy dokumentów
     (albo ustaw `provider` na `"demo"`, by działać bez AI).

## Uruchomienie
- Dwuklik **start.cmd** — otworzy się `http://localhost:5180`.
- Zmiana portu: pole `port` w `config.json`.

## Kopia zapasowa
- Dwuklik **kopia-zapasowa.cmd** — zapisuje kopię bazy do folderu `kopie\`.
- Ręcznie: skopiuj plik `b2b-hub/data/hub.db` w bezpieczne miejsce. To cała baza.

## Bezpieczeństwo danych
- Baza (umowy, faktury, decyzje) nie opuszcza tej maszyny.
- Przy odczycie/analizie dokumentu jego treść jest wysyłana do wybranego dostawcy AI
  (domyślnie Claude API). Aby pracować **w pełni offline / bez wysyłki**, ustaw
  `provider: "demo"` lub skorzystaj z lokalnego modelu (osobny etap wdrożeniowy).
- Klucz API trzymaj w `config.json` (nie udostępniaj tego pliku).

## Podpięcie pod firmowe AI (Azure / Copilot)
Warstwa AI jest wymienna (foldery `extract`, `extract-umowa`, `analiza-etat` —
providery). Skierowanie odczytu na Azure OpenAI / firmowego Copilota to osobny,
krótki etap integracyjny do ustalenia z dostawcą.

## Aktualizacja
Podmień foldery `b2b-hub`, `extract`, `extract-umowa`, `analiza-etat` na nowsze.
Twój `config.json` i baza `hub.db` pozostają nietknięte.
