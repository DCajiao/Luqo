import { useState } from 'react'
import { auth } from '../services/api.js'

const styles = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    background: 'radial-gradient(ellipse at 50% 0%, rgba(108,99,255,0.12) 0%, transparent 60%), var(--bg)',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '40px',
    boxShadow: 'var(--shadow)',
  },
  logo: {
    fontSize: '28px',
    fontWeight: '700',
    letterSpacing: '-0.5px',
    marginBottom: '8px',
    background: 'linear-gradient(135deg, #fff 0%, #a09aff 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  sub: { color: 'var(--text-muted)', fontSize: '14px', marginBottom: '32px' },
  tabs: { display: 'flex', gap: '4px', marginBottom: '28px', background: 'var(--bg)', borderRadius: '10px', padding: '4px' },
  tab: (active) => ({
    flex: 1,
    padding: '8px',
    borderRadius: '8px',
    fontSize: '14px',
    fontWeight: '500',
    background: active ? 'var(--bg-elevated)' : 'transparent',
    color: active ? 'var(--text)' : 'var(--text-muted)',
    border: active ? '1px solid var(--border)' : '1px solid transparent',
    transition: 'all 0.2s',
  }),
  label: { display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-muted)', marginBottom: '6px' },
  input: {
    width: '100%',
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '12px 14px',
    color: 'var(--text)',
    fontSize: '15px',
    marginBottom: '16px',
    transition: 'border-color 0.2s',
  },
  btn: (loading) => ({
    width: '100%',
    padding: '13px',
    background: loading ? 'var(--bg-elevated)' : 'var(--accent)',
    color: '#fff',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '600',
    marginTop: '8px',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  }),
  error: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '8px',
    padding: '10px 14px',
    fontSize: '13px',
    color: '#fca5a5',
    marginBottom: '16px',
  },
}

export default function Auth({ onLogin }) {
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const fn = mode === 'login' ? auth.login : auth.register
      const payload = mode === 'login' ? { email: form.email, password: form.password } : form
      const { data } = await fn(payload)
      onLogin(data.user, data.token)
    } catch (err) {
      setError(err.response?.data?.message || 'Algo salió mal. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.card} className="fade-in">
        <div style={styles.logo}>Luqo</div>
        <p style={styles.sub}>Digitaliza tus facturas con IA</p>

        <div style={styles.tabs}>
          {['login', 'register'].map((m) => (
            <button key={m} style={styles.tab(mode === m)} onClick={() => { setMode(m); setError('') }}>
              {m === 'login' ? 'Iniciar sesión' : 'Registrarse'}
            </button>
          ))}
        </div>

        <form onSubmit={submit}>
          {mode === 'register' && (
            <div>
              <label style={styles.label}>Nombre</label>
              <input style={styles.input} value={form.name} onChange={set('name')} placeholder="Tu nombre" required />
            </div>
          )}
          <label style={styles.label}>Correo electrónico</label>
          <input style={styles.input} type="email" value={form.email} onChange={set('email')} placeholder="correo@ejemplo.com" required />
          <label style={styles.label}>Contraseña</label>
          <input style={styles.input} type="password" value={form.password} onChange={set('password')} placeholder="••••••••" required minLength={6} />

          {error && <div style={styles.error}>{error}</div>}

          <button style={styles.btn(loading)} type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : null}
            {loading ? 'Procesando...' : mode === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>
      </div>
    </div>
  )
}
