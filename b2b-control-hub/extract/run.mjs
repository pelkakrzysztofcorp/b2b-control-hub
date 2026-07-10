#!/usr/bin/env node
// CLI: dokument faktury -> ekstrakcja (wybrany provider) -> kontrola -> werdykt.
//
// Przykłady:
//   node extract/run.mjs --text extract/sample-faktura.txt
//   EXTRACTOR_PROVIDER=claude node extract/run.mjs --pdf faktura.pdf
//   node extract/run.mjs --provider azure --pdf faktura.pdf
//
// Flagi:
//   --provider <demo|claude|azure>   (lub zmienna EXTRACTOR_PROVIDER; domyślnie demo)
//   --text <plik.txt>                wejście tekstowe
//   --pdf  <plik.pdf>                wejście PDF (base64)
//   --contracts <plik.json>          rejestr umów (domyślnie extract/contracts.json)

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractInvoice, listProviders } from "./index.mjs";
import { runControl, verdict, plMoney } from "./control-engine.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const ICON = { ok: "✓", warn: "!", bad: "✕" };

async function main() {
  const provider = arg("--provider", undefined);
  const textPath = arg("--text", undefined);
  const pdfPath = arg("--pdf", undefined);
  const contractsPath = arg("--contracts", path.join(here, "contracts.json"));

  if (!textPath && !pdfPath) {
    console.log("Podaj --text <plik.txt> lub --pdf <plik.pdf>.");
    console.log("Dostępne providery: " + listProviders().join(", "));
    process.exit(1);
  }

  const input = {};
  if (textPath) input.text = await fs.readFile(textPath, "utf8");
  if (pdfPath) input.pdfBase64 = (await fs.readFile(pdfPath)).toString("base64");

  console.log(`\n=== EKSTRAKCJA (provider: ${provider || process.env.EXTRACTOR_PROVIDER || "demo"}) ===`);
  const res = await extractInvoice(input, { provider });
  const inv = res.value;
  console.log(JSON.stringify(inv, null, 2));
  if (!res.ok) {
    console.log("\n⚠ Ostrzeżenia walidacji:");
    res.errors.forEach((e) => console.log("  - " + e));
  }

  const contracts = JSON.parse(await fs.readFile(contractsPath, "utf8"));
  const contract = contracts[inv.id_umowy];

  console.log("\n=== KONTROLA ===");
  if (!contract) {
    console.log(`✕ Nie znaleziono umowy "${inv.id_umowy}" w rejestrze — faktura WYMAGA decyzji (brak podstawy kontroli).`);
    process.exit(0);
  }

  const { checks } = runControl(inv, contract);
  for (const c of checks) console.log(`  ${ICON[c.status]} ${c.t} — ${c.det}`);

  const v = verdict(checks);
  console.log(`\n=== WERDYKT: ${v.label} ===`);
  console.log(`${inv.numer} · ${inv.kontrahent} · ${plMoney.format(inv.kwota_netto)} netto`);
  console.log(v.note);
  console.log("\n(AI/silnik nie zatwierdza płatności — ostateczną decyzję podejmuje przełożony.)");
}

main().catch((e) => {
  console.error("Błąd: " + e.message);
  process.exit(1);
});
