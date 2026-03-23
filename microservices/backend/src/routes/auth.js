const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const dbClient = require('../dbClient')

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body
  if (!email || !password) return res.status(400).json({ message: 'Email y contraseña son obligatorios' })
  if (password.length < 6) return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' })

  try {
    const hash = await bcrypt.hash(password, 12)
    const user = await dbClient.createUser({ name: name?.trim() || null, email: email.toLowerCase().trim(), password: hash })
    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
    res.status(201).json({ token, user })
  } catch (err) {
    if (err.status === 409) return res.status(409).json({ message: err.message })
    console.error(err)
    res.status(500).json({ message: 'Error interno del servidor' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ message: 'Email y contraseña son obligatorios' })

  try {
    const user = await dbClient.getUserByEmail(email.toLowerCase().trim())
    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ message: 'Credenciales incorrectas' })

    const token = jwt.sign({ sub: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' })
    const { password: _, ...safeUser } = user
    res.json({ token, user: safeUser })
  } catch (err) {
    if (err.status === 404) return res.status(401).json({ message: 'Credenciales incorrectas' })
    console.error(err)
    res.status(500).json({ message: 'Error interno del servidor' })
  }
})

module.exports = router
