#!/usr/bin/env node
// CLI: wgrana umowa -> automatyczny odczyt danych do rejestru + lista pól, których nie udało się pobrać.
//
//   node extract-umowa/run.mjs --text extract-umowa/sample-umowa.txt
//   EXTRACTOR_PROVIDER=claude node extract-umowa/run.mjs --pdf umowa.pdf
//
// Flagi: --provider <demo|claude>  --text <plik.txt>  --pdf <plik.pdf>

import fs from "node:fs/promises";
import { extractUmowa, listProviders } from "./index.mjs";

function arg(n,d){ const i=process.argv.indexOf(n); return i!==-1&&process.argv[i+1]?process.argv[i+1]:d; }

async function main(){
  const provider=arg("--provider",undefined), textPath=arg("--text",undefined), pdfPath=arg("--pdf",undefined);
  if(!textPath&&!pdfPath){ console.log("Podaj --text <plik.txt> lub --pdf <plik.pdf>."); console.log("Providery: "+listProviders().join(", ")); process.exit(1); }
  const input={}; if(textPath) input.text=await fs.readFile(textPath,"utf8"); if(pdfPath) input.pdfBase64=(await fs.readFile(pdfPath)).toString("base64");

  const res=await extractUmowa(input,{provider});
  console.log(`\n=== ODCZYT UMOWY (provider: ${res.provider}) ===`);
  console.log(JSON.stringify(res.value,null,2));
  console.log("\n=== STATUS ODCZYTU ===");
  if(res.braki.length){
    console.log("⚠ Nie udało się pobrać (uzupełnij ręcznie): " + res.braki.join(", "));
  } else {
    console.log("✓ Wszystkie kluczowe pola odczytane — gotowe do zapisania w rejestrze.");
  }
  console.log("\n(AI odczytuje dane; zapis do rejestru zatwierdza człowiek.)");
}
main().catch(e=>{ console.error("Błąd: "+e.message); process.exit(1); });
