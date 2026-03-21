const { DocumentProcessorServiceClient } = require('@google-cloud/documentai').v1

const client = new DocumentProcessorServiceClient()

const processorName = () =>
  `projects/${process.env.GCP_PROJECT_ID}/locations/${process.env.GCP_LOCATION}/processors/${process.env.DOCUMENT_AI_PROCESSOR_ID}`

/**
 * Sends an image to Document AI and returns the raw extracted text.
 * Throws if no text could be extracted.
 * @param {Buffer} imageBuffer
 * @param {string} mimeType
 * @returns {Promise<string>} raw text
 */
const SUPPORTED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff', 'application/pdf'])

async function extractText(imageBuffer, mimeType = 'image/jpeg') {
  const safeMimeType = SUPPORTED_MIME_TYPES.has(mimeType) ? mimeType : 'image/jpeg'
  mimeType = safeMimeType
  const [result] = await client.processDocument({
    name: processorName(),
    rawDocument: { content: imageBuffer.toString('base64'), mimeType },
  })

  const text = result.document?.text?.trim()

  if (!text || text.length < 10) {
    throw new Error('Document AI no pudo extraer texto de la imagen. Verifica que la factura sea legible y esté bien iluminada.')
  }

  return text
}

module.exports = { extractText }
