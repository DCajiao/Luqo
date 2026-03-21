const { GoogleGenerativeAI } = require('@google/generative-ai')

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

/**
 * Sends raw invoice text to Gemini.
 * Returns { structured, insights } where:
 *   - structured: parsed invoice fields (vendor, date, total, items, etc.)
 *   - insights: free-text spending analysis
 *
 * @param {string} rawText - text extracted by Document AI
 * @returns {Promise<{ structured: object, insights: string }>}
 */
async function analyzeInvoice(rawText) {
  const model = genAI.getGenerativeModel({ model: 'gemini-3.1-pro-preview' })

  const prompt = `Eres un asistente experto en análisis de facturas. A continuación te paso el texto crudo extraído de una factura mediante OCR.

TEXTO DE LA FACTURA:
---
${rawText}
---

Tu tarea tiene DOS partes:

PARTE 1 — Extracción estructurada:
Extrae los siguientes campos del texto. Si no encuentras un campo, usa null.
Devuelve SOLO un bloque JSON válido con esta estructura (sin markdown, sin explicaciones):
{
  "vendor_name": string | null,
  "invoice_number": string | null,
  "invoice_date": string | null,
  "due_date": string | null,
  "currency": string | null,
  "subtotal": number | null,
  "tax_amount": number | null,
  "total_amount": number | null,
  "line_items": [
    {
      "description": string,
      "quantity": number | null,
      "unit_price": number | null,
      "total_price": number | null
    }
  ],
  "insights": string
}

PARTE 2 — insights:
En el campo "insights" escribe 2-3 párrafos cortos en español con:
1. Resumen de qué tipo de compra fue
2. Si el monto parece razonable
3. Una sugerencia financiera práctica relacionada con esta compra

Responde ÚNICAMENTE con el JSON. Sin texto adicional antes o después.`

  const result = await model.generateContent(prompt)
  const raw = result.response.text().trim()

  // Strip markdown code fences if Gemini wraps the JSON
  const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()

  let parsed
  try {
    parsed = JSON.parse(jsonStr)
  } catch {
    throw new Error(`Gemini devolvió una respuesta no parseable: ${raw.slice(0, 200)}`)
  }

  const { insights, ...structured } = parsed
  return { structured, insights: insights || '' }
}

module.exports = { analyzeInvoice }
