// Fabryka providerów analizy znamion etatu. Wybór: opcja > EXTRACTOR_PROVIDER > "demo".
import { validateEtat } from "./schema.mjs";

const PROVIDERS = {
  demo: () => import("./providers/demo.mjs"),
  claude: () => import("./providers/claude.mjs"),
};
export const listProviders = () => Object.keys(PROVIDERS);

export async function analyzeEtat(input, opts = {}) {
  const name = opts.provider || process.env.EXTRACTOR_PROVIDER || "demo";
  const loader = PROVIDERS[name];
  if (!loader) throw new Error(`Nieznany provider "${name}". Dostępne: ${listProviders().join(", ")}.`);
  const mod = await loader();
  const raw = await mod.analyze(input);
  const { ok, errors, value } = validateEtat(raw);
  return { provider: name, raw, value, ok, errors };
}
