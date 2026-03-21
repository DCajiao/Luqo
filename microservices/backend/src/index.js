require('dotenv').config()
const express = require('express')
const cors = require('cors')

const authRoutes    = require('./routes/auth')
const invoiceRoutes = require('./routes/invoices')

const app = express()
const PORT = process.env.PORT || 8000

app.use(cors({ origin: '*' }))
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

// Routes
app.use('/api/auth',     authRoutes)
app.use('/api/invoices', invoiceRoutes)

// 404
app.use((req, res) => res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.path}` }))

// Error handler
app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({ message: err.message || 'Error interno del servidor' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Luqo backend corriendo en puerto ${PORT}`)
})
