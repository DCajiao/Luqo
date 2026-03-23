const express = require('express')
const app = express()
const PORT = process.env.PORT || 3001

app.use(express.json())

app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

app.use('/users',    require('./routes/users'))
app.use('/invoices', require('./routes/invoices'))

app.use((req, res) => res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.path}` }))

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🗄️  Luqo db-service corriendo en puerto ${PORT}`)
})
