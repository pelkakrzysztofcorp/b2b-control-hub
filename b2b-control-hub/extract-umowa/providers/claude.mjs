// Provider "claude" — odczyt danych umowy przez Claude API (model claude-opus-4-8).
// Wejście: PDF (base64) albo tekst. Wynik: JSON wg schema.mjs. Import SDK leniwy.
// Wymaga: ANTHROPIC_API_KEY + npm install @anthropic-ai/sdk.

import { UMOWA_JSON_SCHEMA, UMOWA_INSTRUCTION } from "../schema.mjs";

export async function extract({ text, pdfBase64 }){
  if(!process.env.ANTHROPIC_API_KEY) throw new Error("Brak ANTHROPIC_API_KEY (provider claude).");
  let Anthropic;
  try { ({ default: Anthropic } = await import("@anthropic-ai/sdk")); }
  catch { throw new Error("Brak pakietu @anthropic-ai/sdk. Uruchom: npm install @anthropic-ai/sdk"); }
  const client = new Anthropic();

  const content = [];
  if(pdfBase64){
    content.push({ type:"document", source:{ type:"base64", media_type:"application/pdf", data:pdfBase64 } });
    content.push({ type:"text", text:"Wyciągnij dane z załączonej umowy." });
  } else {
    content.push({ type:"text", text:`Wyciągnij dane z poniższej umowy:\n\n${text}` });
  }

  const res = await client.messages.create({
    model:"claude-opus-4-8", max_tokens:2048, system: UMOWA_INSTRUCTION,
    output_config:{ format:{ type:"json_schema", schema: UMOWA_JSON_SCHEMA } },
    messages:[{ role:"user", content }],
  });
  if(res.stop_reason==="refusal") throw new Error("Model odmówił odczytu (stop_reason: refusal).");
  const b = res.content.find(x=>x.type==="text");
  if(!b) throw new Error("Brak bloku tekstowego w odpowiedzi modelu.");
  return JSON.parse(b.text);
}
