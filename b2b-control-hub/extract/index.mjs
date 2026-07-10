// Fabryka providerów — wybór silnika ekstrakcji jednym ustawieniem.
// Wybór: argument funkcji > zmienna EXTRACTOR_PROVIDER > domyślnie "demo".

import { validateInvoice } from "./schema.mjs";

const PROVIDERS = {
  demo: () => import("./providers/demo.mjs"),
  claude: () => import("./providers/claude.mjs"),
  azure: () => import("./providers/azure.mjs"),
};

export function listProviders() {
  return Object.keys(PROVIDERS);
}

// input: { text?, pdfBase64? }, opts: { provider? }
// Zwraca: { provider, raw, value, ok, errors }
export async function extractInvoice(input, opts = {}) {
  const name = opts.provider || process.env.EXTRACTOR_PROVIDER || "demo";
  const loader = PROVIDERS[name];
  if (!loader) {
    throw new Error(`Nieznany provider "${name}". Dostępne: ${listProviders().join(", ")}.`);
  }
  const mod = await loader();
  const raw = await mod.extract(input);
  const { ok, errors, value } = validateInvoice(raw);
  return { provider: name, raw, value, ok, errors };
}
