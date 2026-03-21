import { useState, useEffect } from 'react'
import Auth from './components/Auth.jsx'
import Dashboard from './components/Dashboard.jsx'

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('luqo_user')) } catch { return null }
  })

  useEffect(() => {
    const handler = () => setUser(null)
    window.addEventListener('luqo:logout', handler)
    return () => window.removeEventListener('luqo:logout', handler)
  }, [])

  const handleLogin = (userData, token) => {
    localStorage.setItem('luqo_token', token)
    localStorage.setItem('luqo_user', JSON.stringify(userData))
    setUser(userData)
  }

  const handleLogout = () => {
    localStorage.removeItem('luqo_token')
    localStorage.removeItem('luqo_user')
    setUser(null)
  }

  if (!user) return <Auth onLogin={handleLogin} />
  return <Dashboard user={user} onLogout={handleLogout} />
}
