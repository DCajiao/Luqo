const router = require('express').Router()
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const db = require('../db')
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

// POST /api/invoices — upload & process
router.post('/', authenticate, upload.single('invoice'), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Se requiere una imagen de factura' })

  // Create a pending record immediately
  let invoiceId
  try {
    const { rows } = await db.query(
      `INSERT INTO invoices (user_id, image_path, status) VALUES ($1, $2, 'processing') RETURNING id`,
      [req.user.sub, req.file.filename],
    )
    invoiceId = rows[0].id
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

    const parseDate = (d) => { try { return d ? new Date(d) : null } catch { return null } }

    // 3. Save to DB
    const { rows: [invoice] } = await db.query(
      `UPDATE invoices SET
        vendor_name     = $1,
        invoice_number  = $2,
        invoice_date    = $3,
        due_date        = $4,
        subtotal        = $5,
        tax_amount      = $6,
        total_amount    = $7,
        currency        = $8,
        extracted_data  = $9,
        gemini_insights = $10,
        status          = 'processed'
       WHERE id = $11
       RETURNING *`,
      [
        structured.vendor_name,
        structured.invoice_number,
        parseDate(structured.invoice_date),
        parseDate(structured.due_date),
        structured.subtotal,
        structured.tax_amount,
        structured.total_amount,
        structured.currency || 'COP',
        JSON.stringify({ raw_text: rawText }),
        insights,
        invoiceId,
      ],
    )

    // 4. Insert line items from Gemini structured output
    if (structured.line_items?.length > 0) {
      const itemValues = structured.line_items
        .filter((i) => i.description || i.total_price)
        .map((i) => `('${invoiceId}', ${sqlStr(i.description)}, ${i.quantity ?? 'NULL'}, ${i.unit_price ?? 'NULL'}, ${i.total_price ?? 'NULL'})`)
        .join(', ')

      if (itemValues) {
        await db.query(
          `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price) VALUES ${itemValues}`,
        )
      }
    }

    // 5. Fetch full invoice with items
    const { rows: items } = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [invoiceId])
    res.status(201).json({ invoice: { ...invoice, invoice_items: items } })
  } catch (err) {
    console.error('Processing error:', err)
    await db.query(`UPDATE invoices SET status = 'failed' WHERE id = $1`, [invoiceId])
    res.status(500).json({ message: 'Error al procesar la factura con IA', detail: err.message })
  }
})

// GET /api/invoices
router.get('/', authenticate, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.sub],
    )
    res.json({ invoices: rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error al obtener facturas' })
  }
})

// GET /api/invoices/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { rows: [invoice] } = await db.query(
      'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.sub],
    )
    if (!invoice) return res.status(404).json({ message: 'Factura no encontrada' })

    const { rows: items } = await db.query('SELECT * FROM invoice_items WHERE invoice_id = $1', [req.params.id])
    res.json({ invoice: { ...invoice, invoice_items: items } })
  } catch (err) {
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
    const { rows: [invoice] } = await db.query(
      'SELECT image_path FROM invoices WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.sub],
    )
    if (!invoice) return res.status(404).json({ message: 'No encontrada' })
    const filePath = path.join(UPLOADS_DIR, invoice.image_path)
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Imagen no encontrada' })
    res.sendFile(filePath)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error al obtener la imagen' })
  }
})

// DELETE /api/invoices/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { rows: [invoice] } = await db.query(
      'DELETE FROM invoices WHERE id = $1 AND user_id = $2 RETURNING image_path',
      [req.params.id, req.user.sub],
    )
    if (!invoice) return res.status(404).json({ message: 'Factura no encontrada' })

    const filePath = path.join(UPLOADS_DIR, invoice.image_path)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

    res.json({ message: 'Factura eliminada' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error al eliminar la factura' })
  }
})

const sqlStr = (v) => v == null ? 'NULL' : `'${v.replace(/'/g, "''")}'`

module.exports = router
