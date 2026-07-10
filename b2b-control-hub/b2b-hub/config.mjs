// Konfiguracja Huba w jednym miejscu — czyta plik config.json z katalogu głównego paczki.
// Kolejność źródeł: zmienne środowiskowe > config.json > wartości domyślne.
// Dzięki temu klient ustawia wszystko w jednym pliku, bez grzebania w kodzie.

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_FILE = path.join(HERE, "..", "config.json"); // katalog główny paczki

let fromFile = {};
if (existsSync(CONFIG_FILE)) {
  try {
    fromFile = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
  } catch (e) {
    console.error("Uwaga: nie udało się wczytać config.json —", e.message);
  }
}
const ai = fromFile.ai || {};

// Sekrety z pliku przenosimy do środowiska (jeśli nie ma ich już w env).
if (ai.anthropic_api_key && !process.env.ANTHROPIC_API_KEY)
  process.env.ANTHROPIC_API_KEY = String(ai.anthropic_api_key).trim();
if (ai.azure_endpoint && !process.env.AZURE_DI_ENDPOINT) process.env.AZURE_DI_ENDPOINT = ai.azure_endpoint;
if (ai.azure_key && !process.env.AZURE_DI_KEY) process.env.AZURE_DI_KEY = ai.azure_key;

// Zgodność ze środowiskiem deweloperskim: awaryjnie klucz z generator/apikey.txt.
if (!process.env.ANTHROPIC_API_KEY) {
  const legacy = path.join(HERE, "..", "generator", "apikey.txt");
  if (existsSync(legacy)) {
    try { process.env.ANTHROPIC_API_KEY = readFileSync(legacy, "utf8").trim(); } catch {}
  }
}

// Hub obsługuje end-to-end dwa tryby: "claude" (pełne AI) i "demo" (bez klucza).
// Integracja z Azure/Copilotem klienta to osobny etap wdrożeniowy (kod providera azure
// istnieje dla faktur, ale odczyt umów i analiza prawna wymagają dorobienia po stronie klienta).
function pickProvider() {
  const forced = (process.env.EXTRACTOR_PROVIDER || ai.provider || "").toLowerCase();
  if (forced === "demo") return "demo";
  if (forced === "claude") return "claude";
  return process.env.ANTHROPIC_API_KEY ? "claude" : "demo";
}

export const CONFIG = {
  organizacja: fromFile.organizacja || process.env.HUB_ORG || "Twoja firma",
  port: Number(process.env.HUB_PORT || fromFile.port || 5180),
  provider: pickProvider(),
};

export function providerOpis() {
  return CONFIG.provider === "claude"
    ? "Claude API (klucz aktywny)"
    : "demo (brak klucza API — tylko przykładowe parsowanie)";
}
