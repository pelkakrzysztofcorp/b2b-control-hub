// Provider "claude" — ekstrakcja przez Claude API (model claude-opus-4-8).
// Obsługuje wejście: PDF (base64 document block) ALBO tekst.
// Zwraca ustrukturyzowany JSON wymuszony przez output_config.format (structured outputs).
//
// Wymaga:
//   - zmiennej środowiskowej ANTHROPIC_API_KEY
//   - pakietu: npm install @anthropic-ai/sdk
//
// Import SDK jest leniwy, żeby provider demo działał bez instalacji czegokolwiek.

import { INVOICE_JSON_SCHEMA, EXTRACTION_INSTRUCTION } from "../schema.mjs";

export async function extract({ text, pdfBase64 }) {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Brak ANTHROPIC_API_KEY w środowisku (provider claude).");
  }
  let Anthropic;
  try {
    ({ default: Anthropic } = await import("@anthropic-ai/sdk"));
  } catch {
    throw new Error('Brak pakietu @anthropic-ai/sdk. Uruchom: npm install @anthropic-ai/sdk');
  }
  const client = new Anthropic();

  // Zbuduj treść użytkownika: PDF jako document block (przed tekstem) albo sam tekst.
  const content = [];
  if (pdfBase64) {
    content.push({
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
    });
  }
  content.push({
    type: "text",
    text: pdfBase64
      ? "Wyciągnij dane z załączonej faktury PDF."
      : `Wyciągnij dane z poniższej faktury:\n\n${text}`,
  });

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 2048,
    system: EXTRACTION_INSTRUCTION,
    output_config: { format: { type: "json_schema", schema: INVOICE_JSON_SCHEMA } },
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("Model odmówił przetworzenia (stop_reason: refusal).");
  }
  const block = response.content.find((b) => b.type === "text");
  if (!block) throw new Error("Brak bloku tekstowego w odpowiedzi modelu.");
  return JSON.parse(block.text);
}
