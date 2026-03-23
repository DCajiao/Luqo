const router = require('express').Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const dbClient = require('../dbClient')
const authenticate = require('../middleware/authenticate')
const { extractText } = require('../services/documentAI')
const { analyzeInvoice } = require('../services/gemini')

const UPLOADS_DIR = path.join(__dirname, '../../uploads')
fs.mkdirSync(UPLOADS_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`),
})
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true)
    else cb(new Error('Solo se permiten imágenes'))
  },
})

const parseDate = (d) => {
  if (!d) return null
  // Handle DD/MM/YYYY format from Gemini
  const ddmmyyyy = d.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (ddmmyyyy) return `${ddmmyyyy[3]}-${ddmmyyyy[2].padStart(2, '0')}-${ddmmyyyy[1].padStart(2, '0')}`
  // Handle YYYY-MM-DD and ISO formats
  const date = new Date(d)
  return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
}

// POST /api/invoices — upload & process
router.post('/', authenticate, upload.single('invoice'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Se requiere una imagen de factura' })

  // Create a pending record immediately
  let invoiceId
  try {
    const { id } = await dbClient.createInvoice({ user_id: req.user.sub, image_path: req.file.filename })
    invoiceId = id
  } catch (err) {
    console.error('DB insert error:', err)
    return res.status(500).json({ message: 'Error al crear el registro' })
  }

  try {
    const imageBuffer = fs.readFileSync(req.file.path)

    // 1. Document AI: extract raw text (throws if nothing found)
    const rawText = await extractText(imageBuffer, req.file.mimetype)
    console.log(`[Document AI] Extracted ${rawText.length} chars`)

    // 2. Gemini: parse structure + insights from raw text
    const { structured, insights } = await analyzeInvoice(rawText)
    console.log('[Gemini] Analysis complete:', JSON.stringify(structured, null, 2))

    // 3. Save to DB via db-service
    const invoice = await dbClient.updateInvoice(invoiceId, {
      vendor_name:     structured.vendor_name,
      invoice_number:  structured.invoice_number,
      invoice_date:    parseDate(structured.invoice_date),
      due_date:        parseDate(structured.due_date),
      subtotal:        structured.subtotal,
      tax_amount:      structured.tax_amount,
      total_amount:    structured.total_amount,
      currency:        structured.currency || 'COP',
      extracted_data:  JSON.stringify({ raw_text: rawText }),
      gemini_insights: insights,
    })

    // 4. Insert line items
    const validItems = (structured.line_items || []).filter((i) => i.description || i.total_price)
    if (validItems.length > 0) {
      await dbClient.bulkInsertItems(invoiceId, validItems)
    }

    // 5. Fetch items and return full invoice
    const items = await dbClient.getItems(invoiceId)
    res.status(201).json({ invoice: { ...invoice, invoice_items: items } })
  } catch (err) {
    console.error('Processing error:', err)
    await dbClient.setInvoiceStatus(invoiceId, 'failed').catch(() => {})
    res.status(500).json({ message: 'Error al procesar la factura con IA', detail: err.message })
  }
})

// GET /api/invoices
router.get('/', authenticate, async (req, res) => {
  try {
    const invoices = await dbClient.listInvoices(req.user.sub)
    res.json({ invoices })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error al obtener facturas' })
  }
})

// GET /api/invoices/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const invoice = await dbClient.getInvoice(req.params.id, req.user.sub)
    const items = await dbClient.getItems(req.params.id)
    res.json({ invoice: { ...invoice, invoice_items: items } })
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ message: 'Factura no encontrada' })
    console.error(err)
    res.status(500).json({ message: 'Error al obtener la factura' })
  }
})

// GET /api/invoices/:id/image — accepts token via query param for <img src> tags
router.get('/:id/image', (req, res, next) => {
  if (req.query.token) req.headers.authorization = `Bearer ${req.query.token}`
  next()
}, authenticate, async (req, res) => {
  try {
    const invoice = await dbClient.getInvoice(req.params.id, req.user.sub)
    const filePath = path.join(UPLOADS_DIR, invoice.image_path)
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Imagen no encontrada' })
    res.sendFile(filePath)
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ message: 'No encontrada' })
    console.error(err)
    res.status(500).json({ message: 'Error al obtener la imagen' })
  }
})

// DELETE /api/invoices/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { image_path } = await dbClient.deleteInvoice(req.params.id, req.user.sub)
    const filePath = path.join(UPLOADS_DIR, image_path)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    res.json({ message: 'Factura eliminada' })
  } catch (err) {
    if (err.status === 404) return res.status(404).json({ message: 'Factura no encontrada' })
    console.error(err)
    res.status(500).json({ message: 'Error al eliminar la factura' })
  }
})

module.exports = router
