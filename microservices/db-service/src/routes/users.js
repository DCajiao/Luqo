const router = require('express').Router()
const db = require('../db')

// POST /users — create user (password must be pre-hashed by caller)
router.post('/', async (req, res) => {
  const { name, email, password } = req.body
  try {
    const { rows } = await db.query(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3) RETURNING id, name, email, created_at',
      [name || null, email, password],
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ message: 'Ya existe una cuenta con ese correo' })
    console.error(err)
    res.status(500).json({ message: 'Error al crear usuario' })
  }
})

// GET /users/by-email/:email — find user including password hash
router.get('/by-email/:email', async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM users WHERE email = $1', [req.params.email])
    if (!rows[0]) return res.status(404).json({ message: 'Usuario no encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Error al buscar usuario' })
  }
})

module.exports = router
