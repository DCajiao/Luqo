import { useState, useEffect } from 'react'
import { invoices as invoiceApi } from '../services/api.js'
import CameraCapture from './CameraCapture.jsx'
import InvoiceDetail from './InvoiceDetail.jsx'

const s = {
  root: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  nav: {
    padding: '0 24px', height: '60px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'var(--bg-card)', position: 'sticky', top: 0, zIndex: 10,
  },
  logo: {
    fontSize: '20px', fontWeight: '700',
    background: 'linear-gradient(135deg, #fff 0%, #a09aff 100%)',
    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
  },
  navRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  userChip: {
    fontSize: '13px', color: 'var(--text-muted)',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: '20px', padding: '5px 12px',
  },
  logoutBtn: {
    fontSize: '13px', color: 'var(--text-muted)',
    background: 'transparent', padding: '5px 10px', borderRadius: '8px',
  },
  main: { flex: 1, padding: '28px 24px', maxWidth: '800px', margin: '0 auto', width: '100%' },
  hero: {
    background: 'linear-gradient(135deg, var(--accent-light) 0%, transparent 100%)',
    border: '1px solid rgba(108,99,255,0.25)', borderRadius: 'var(--radius-lg)',
    padding: '28px', marginBottom: '28px', display: 'flex',
    alignItems: 'center', justifyContent: 'space-between', gap: '16px',
  },
  heroText: {},
  heroTitle: { fontSize: '22px', fontWeight: '700', marginBottom: '6px' },
  heroSub: { color: 'var(--text-muted)', fontSize: '14px' },
  captureBtn: {
    padding: '12px 22px', background: 'var(--accent)', color: '#fff',
    borderRadius: '10px', fontSize: '15px', fontWeight: '600',
    whiteSpace: 'nowrap', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '8px',
    boxShadow: 'var(--shadow-accent)',
  },
  sectionHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '16px',
  },
  sectionTitle: { fontSize: '16px', fontWeight: '600' },
  count: {
    fontSize: '12px', color: 'var(--text-muted)',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: '12px', padding: '2px 10px',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '14px' },
  card: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '16px', cursor: 'pointer',
    transition: 'border-color 0.2s, transform 0.15s',
  },
  cardTop: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' },
  cardIcon: { fontSize: '24px' },
  badge: (status) => ({
    fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '12px',
    background: status === 'processed' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
    color: status === 'processed' ? 'var(--success)' : 'var(--warning)',
  }),
  cardVendor: { fontSize: '15px', fontWeight: '600', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardDate: { fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' },
  cardTotal: { fontSize: '18px', fontWeight: '700', color: 'var(--accent)' },
  cardCurrency: { fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' },
  empty: {
    textAlign: 'center', padding: '60px 24px',
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
  },
  emptyIcon: { fontSize: '48px', marginBottom: '12px' },
  emptyTitle: { fontWeight: '600', marginBottom: '8px' },
  emptySub: { color: 'var(--text-muted)', fontSize: '14px' },
  loading: { display: 'flex', justifyContent: 'center', padding: '60px' },
}

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'
const fmtAmt = (v) => v != null ? Number(v).toLocaleString('es-CO') : '—'

export default function Dashboard({ user, onLogout }) {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCamera, setShowCamera] = useState(false)
  const [selected, setSelected] = useState(null)

  const load = async () => {
    try {
      const { data } = await invoiceApi.list()
      setList(data.invoices)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleUploaded = (invoice) => {
    setList((prev) => [invoice, ...prev])
    setSelected(invoice)
  }

  return (
    <div style={s.root}>
      <nav style={s.nav}>
        <span style={s.logo}>Luqo</span>
        <div style={s.navRight}>
          <span style={s.userChip}>👤 {user.name || user.email}</span>
          <button style={s.logoutBtn} onClick={onLogout}>Salir</button>
        </div>
      </nav>

      <main style={s.main}>
        <div style={s.hero}>
          <div style={s.heroText}>
            <div style={s.heroTitle}>Digitaliza tu próxima factura</div>
            <div style={s.heroSub}>Usa Document AI + Gemini para extraer y analizar en segundos</div>
          </div>
          <button style={s.captureBtn} onClick={() => setShowCamera(true)}>
            📷 Capturar factura
          </button>
        </div>

        <div style={s.sectionHeader}>
          <span style={s.sectionTitle}>Facturas registradas</span>
          <span style={s.count}>{list.length}</span>
        </div>

        {loading ? (
          <div style={s.loading}><span className="spinner" /></div>
        ) : list.length === 0 ? (
          <div style={s.empty}>
            <div style={s.emptyIcon}>🧾</div>
            <div style={s.emptyTitle}>Aún no tienes facturas</div>
            <div style={s.emptySub}>Captura tu primera factura con la cámara</div>
          </div>
        ) : (
          <div style={s.grid}>
            {list.map((inv) => (
              <div
                key={inv.id}
                style={s.card}
                onClick={() => setSelected(inv)}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = 'translateY(0)' }}
              >
                <div style={s.cardTop}>
                  <span style={s.cardIcon}>🧾</span>
                  <span style={s.badge(inv.status)}>{inv.status === 'processed' ? '✓' : '⏳'}</span>
                </div>
                <div style={s.cardVendor}>{inv.vendor_name || 'Sin proveedor'}</div>
                <div style={s.cardDate}>{fmtDate(inv.invoice_date || inv.created_at)}</div>
                <div style={s.cardTotal}>{fmtAmt(inv.total_amount)}</div>
                <div style={s.cardCurrency}>{inv.currency || 'COP'}</div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCamera && (
        <CameraCapture onClose={() => setShowCamera(false)} onUploaded={handleUploaded} />
      )}

      {selected && (
        <InvoiceDetail invoice={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
