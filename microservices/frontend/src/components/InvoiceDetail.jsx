const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 100, padding: '16px',
  },
  modal: {
    width: '100%', maxWidth: '560px', maxHeight: '90vh',
    background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--border)', overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
    boxShadow: 'var(--shadow-accent)',
  },
  header: {
    padding: '18px 20px', borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  },
  title: { fontWeight: '600', fontSize: '16px' },
  closeBtn: {
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    color: 'var(--text-muted)', borderRadius: '8px', padding: '6px 10px', fontSize: '13px',
  },
  body: { padding: '20px', overflowY: 'auto', flex: 1 },
  img: { width: '100%', borderRadius: '10px', marginBottom: '20px', border: '1px solid var(--border)' },
  section: { marginBottom: '20px' },
  sectionTitle: {
    fontSize: '11px', fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: '1px', color: 'var(--text-muted)', marginBottom: '10px',
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  field: { background: 'var(--bg)', borderRadius: '8px', padding: '10px 12px' },
  fieldLabel: { fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' },
  fieldValue: { fontSize: '15px', fontWeight: '500' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', fontSize: '11px', fontWeight: '600', textTransform: 'uppercase',
    letterSpacing: '0.5px', color: 'var(--text-muted)', padding: '6px 8px',
    borderBottom: '1px solid var(--border)',
  },
  td: { padding: '8px', fontSize: '13px', borderBottom: '1px solid var(--border)' },
  insights: {
    background: 'var(--accent-light)', border: '1px solid rgba(108,99,255,0.3)',
    borderRadius: '10px', padding: '14px', fontSize: '14px', lineHeight: '1.7',
    color: 'var(--text)',
  },
  insightsIcon: { fontSize: '18px', marginBottom: '6px', display: 'block' },
  badge: (status) => ({
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
    background: status === 'processed' ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
    color: status === 'processed' ? 'var(--success)' : 'var(--warning)',
  }),
}

const fmt = (val, prefix = '') =>
  val != null ? `${prefix}${Number(val).toLocaleString('es-CO')}` : '—'

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'

export default function InvoiceDetail({ invoice, onClose }) {
  const items = invoice.invoice_items || []

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal} className="fade-in">
        <div style={s.header}>
          <span style={s.title}>Detalle de factura</span>
          <button style={s.closeBtn} onClick={onClose}>✕ Cerrar</button>
        </div>

        <div style={s.body}>
          {invoice.image_path && (
            <img
              src={`/api/invoices/${invoice.id}/image?token=${localStorage.getItem('luqo_token')}`}
              style={s.img}
              alt="Factura"
            />
          )}

          <div style={s.section}>
            <div style={s.sectionTitle}>Información general</div>
            <div style={s.grid}>
              <div style={s.field}>
                <div style={s.fieldLabel}>Proveedor</div>
                <div style={s.fieldValue}>{invoice.vendor_name || '—'}</div>
              </div>
              <div style={s.field}>
                <div style={s.fieldLabel}>Estado</div>
                <div style={{ ...s.fieldValue, paddingTop: '2px' }}>
                  <span style={s.badge(invoice.status)}>{invoice.status === 'processed' ? '✓ Procesada' : invoice.status}</span>
                </div>
              </div>
              <div style={s.field}>
                <div style={s.fieldLabel}>Fecha de factura</div>
                <div style={s.fieldValue}>{fmtDate(invoice.invoice_date)}</div>
              </div>
              <div style={s.field}>
                <div style={s.fieldLabel}>N° de factura</div>
                <div style={s.fieldValue}>{invoice.invoice_number || '—'}</div>
              </div>
              <div style={s.field}>
                <div style={s.fieldLabel}>Subtotal</div>
                <div style={s.fieldValue}>{fmt(invoice.subtotal, '$ ')}</div>
              </div>
              <div style={s.field}>
                <div style={s.fieldLabel}>IVA</div>
                <div style={s.fieldValue}>{fmt(invoice.tax_amount, '$ ')}</div>
              </div>
              <div style={{ ...s.field, gridColumn: '1 / -1', background: 'rgba(108,99,255,0.08)', border: '1px solid rgba(108,99,255,0.2)' }}>
                <div style={s.fieldLabel}>Total</div>
                <div style={{ ...s.fieldValue, fontSize: '20px', fontWeight: '700', color: 'var(--accent)' }}>
                  {fmt(invoice.total_amount, `${invoice.currency || 'COP'} `)}
                </div>
              </div>
            </div>
          </div>

          {items.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionTitle}>Ítems ({items.length})</div>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Descripción</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Cant.</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Precio</th>
                    <th style={{ ...s.th, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td style={s.td}>{item.description}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{item.quantity}</td>
                      <td style={{ ...s.td, textAlign: 'right' }}>{fmt(item.unit_price, '$ ')}</td>
                      <td style={{ ...s.td, textAlign: 'right', fontWeight: '500' }}>{fmt(item.total_price, '$ ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {invoice.gemini_insights && (
            <div style={s.section}>
              <div style={s.sectionTitle}>✨ Insights de Gemini</div>
              <div style={s.insights}>
                <span style={s.insightsIcon}>🤖</span>
                {invoice.gemini_insights}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
