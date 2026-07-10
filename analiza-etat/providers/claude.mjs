// Provider "claude" — analiza znamion etatu przez Claude API. Wejście: PDF (base64) albo tekst.
import { ETAT_JSON_SCHEMA, ETAT_INSTRUCTION } from "../schema.mjs";

export async function analyze({ text, pdfBase64 }) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("Brak ANTHROPIC_API_KEY (provider claude).");
  let Anthropic;
  try { ({ default: Anthropic } = await import("@anthropic-ai/sdk")); }
  catch { throw new Error("Brak pakietu @anthropic-ai/sdk. Uruchom: npm install @anthropic-ai/sdk"); }
  const client = new Anthropic();

  const content = [];
  if (pdfBase64) {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } });
    content.push({ type: "text", text: "Przeanalizuj załączoną umowę pod kątem znamion stosunku pracy." });
  } else {
    content.push({ type: "text", text: `Przeanalizuj poniższą umowę pod kątem znamion stosunku pracy:\n\n${text}` });
  }

  const res = await client.messages.create({
    model: "claude-opus-4-8", max_tokens: 4096, system: ETAT_INSTRUCTION,
    output_config: { format: { type: "json_schema", schema: ETAT_JSON_SCHEMA } },
    messages: [{ role: "user", content }],
  });
  if (res.stop_reason === "refusal") throw new Error("Model odmówił analizy (stop_reason: refusal).");
  const b = res.content.find((x) => x.type === "text");
  if (!b) throw new Error("Brak bloku tekstowego w odpowiedzi modelu.");
  return JSON.parse(b.text);
}
