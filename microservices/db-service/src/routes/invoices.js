const router = require('express').Router()
const db = require('../db')

// POST /invoices — create a pending invoice record
router.post('/', async (req, res) => {
  const { user_id, image_path } = req.body
  try {
    const { rows } = await db.query(
      `INSERT INTO invoices (user_id, image_path, status) VALUES ($1, $2, 'processing') RETURNING id`,
      [user_id, image_path],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error al crear factura' })
  }
})

// PATCH /invoices/:id — update invoice after AI processing
router.patch('/:id', async (req, res) => {
  const { vendor_name, invoice_number, invoice_date, due_date, subtotal, tax_amount,
          total_amount, currency, extracted_data, gemini_insights } = req.body
  try {
    const { rows } = await db.query(
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
      [vendor_name, invoice_number, invoice_date, due_date, subtotal, tax_amount,
       total_amount, currency, extracted_data, gemini_insights, req.params.id],
    )
    if (!rows[0]) return res.status(404).json({ message: 'Factura no encontrada' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error al actualizar factura' })
  }
})

// PATCH /invoices/:id/status — update only the status field
router.patch('/:id/status', async (req, res) => {
  const { status } = req.body
  try {
    await db.query('UPDATE invoices SET status = $1 WHERE id = $2', [status, req.params.id])
    res.json({ id: req.params.id, status })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error al actualizar estado' })
  }
})

// GET /invoices?user_id=x — list invoices for a user
router.get('/', async (req, res) => {
  const { user_id } = req.query
  try {
    const { rows } = await db.query(
      'SELECT * FROM invoices WHERE user_id = $1 ORDER BY created_at DESC',
      [user_id],
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error al listar facturas' })
  }
})

// GET /invoices/:id?user_id=x — get a single invoice (ownership check)
router.get('/:id', async (req, res) => {
  const { user_id } = req.query
  try {
    const { rows: [invoice] } = await db.query(
      'SELECT * FROM invoices WHERE id = $1 AND user_id = $2',
      [req.params.id, user_id],
    )
    if (!invoice) return res.status(404).json({ message: 'Factura no encontrada' })
    res.json(invoice)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error al obtener factura' })
  }
})

// DELETE /invoices/:id?user_id=x — delete invoice, returns image_path for cleanup
router.delete('/:id', async (req, res) => {
  const { user_id } = req.query
  try {
    const { rows: [invoice] } = await db.query(
      'DELETE FROM invoices WHERE id = $1 AND user_id = $2 RETURNING image_path',
      [req.params.id, user_id],
    )
    if (!invoice) return res.status(404).json({ message: 'Factura no encontrada' })
    res.json({ image_path: invoice.image_path })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error al eliminar factura' })
  }
})

// POST /invoices/items/bulk — insert multiple line items
router.post('/items/bulk', async (req, res) => {
  const { invoice_id, items } = req.body
  if (!items?.length) return res.status(204).end()
  try {
    // Build parameterized query for bulk insert
    const values = []
    const placeholders = items.map((item, i) => {
      const base = i * 5
      values.push(invoice_id, item.description, item.quantity ?? null, item.unit_price ?? null, item.total_price ?? null)
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
    })
    await db.query(
      `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, total_price) VALUES ${placeholders.join(', ')}`,
      values,
    )
    res.status(204).end()
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error al insertar ítems' })
  }
})

// GET /invoices/items/:invoice_id — get line items for an invoice
router.get('/items/:invoice_id', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM invoice_items WHERE invoice_id = $1',
      [req.params.invoice_id],
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error al obtener ítems' })
  }
})

module.exports = router
