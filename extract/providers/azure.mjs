// Provider "azure" — ekstrakcja przez Azure AI Document Intelligence (prebuilt-invoice).
// Wynik mapowany na nasz wspólny schemat JSON faktury.
//
// Wymaga (zmienne środowiskowe):
//   - AZURE_DI_ENDPOINT   np. https://twoja-nazwa.cognitiveservices.azure.com
//   - AZURE_DI_KEY        klucz zasobu Document Intelligence
//
// Używa REST API (analyze + polling), bez dodatkowych pakietów — działa na fetch w Node 18+.

const API_VERSION = "2024-11-30";

function toISO(s) {
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s.slice(0, 10);
  const m = String(s).match(/(\d{2})[.\/](\d{2})[.\/](\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
const fieldValue = (f) =>
  !f ? "" : f.valueString ?? f.valueNumber ?? f.valueDate ?? f.content ?? "";

export async function extract({ pdfBase64, text }) {
  const endpoint = process.env.AZURE_DI_ENDPOINT;
  const key = process.env.AZURE_DI_KEY;
  if (!endpoint || !key) {
    throw new Error("Brak AZURE_DI_ENDPOINT / AZURE_DI_KEY w środowisku (provider azure).");
  }
  if (!pdfBase64) {
    throw new Error('Provider "azure" wymaga PDF (pole pdfBase64); tryb tekstowy nieobsługiwany.');
  }

  const url =
    `${endpoint.replace(/\/$/, "")}/documentintelligence/documentModels/prebuilt-invoice:analyze` +
    `?api-version=${API_VERSION}`;

  const start = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Ocp-Apim-Subscription-Key": key },
    body: JSON.stringify({ base64Source: pdfBase64 }),
  });
  if (!start.ok) throw new Error(`Azure DI analyze HTTP ${start.status}: ${await start.text()}`);
  const opLocation = start.headers.get("operation-location");
  if (!opLocation) throw new Error("Azure DI: brak nagłówka operation-location.");

  // Polling wyniku
  let result;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const poll = await fetch(opLocation, { headers: { "Ocp-Apim-Subscription-Key": key } });
    const data = await poll.json();
    if (data.status === "succeeded") { result = data; break; }
    if (data.status === "failed") throw new Error("Azure DI: analiza nieudana.");
  }
  if (!result) throw new Error("Azure DI: przekroczono czas oczekiwania na wynik.");

  const doc = result.analyzeResult?.documents?.[0];
  const f = doc?.fields || {};

  // Azure prebuilt-invoice nie zna naszego modelu/limitów/akceptującego — mapujemy co się da,
  // resztę zostawiamy pustą; silnik kontroli oznaczy braki do uzupełnienia.
  const kwota = Number(fieldValue(f.InvoiceTotal?.valueCurrency?.amount ?? f.SubTotal)) || 0;
  return {
    numer: String(fieldValue(f.InvoiceId)),
    kontrahent: String(fieldValue(f.VendorName)),
    nip: String(fieldValue(f.VendorTaxId)).replace(/\D/g, ""),
    id_umowy: String(fieldValue(f.PurchaseOrder)),
    okres_od: toISO(fieldValue(f.ServiceStartDate)),
    okres_do: toISO(fieldValue(f.ServiceEndDate)),
    data_wystawienia: toISO(fieldValue(f.InvoiceDate)),
    model: "godzinowy",
    godziny: 0,
    stawka: 0,
    kwota_netto: kwota,
    rachunek: String(fieldValue(f.PaymentDetails)).replace(/\s/g, ""),
    akceptujacy: "",
    zrodlo: "Azure Document Intelligence",
  };
}
