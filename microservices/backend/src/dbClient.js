const DB_SERVICE_URL = process.env.DB_SERVICE_URL || 'http://db-service:3001'

async function request(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } }
  if (body !== undefined) opts.body = JSON.stringify(body)

  const res = await fetch(`${DB_SERVICE_URL}${path}`, opts)

  // 204 No Content
  if (res.status === 204) return null

  const data = await res.json()

  if (!res.ok) {
    const err = new Error(data.message || 'DB service error')
    err.status = res.status
    throw err
  }

  return data
}

const dbClient = {
  // Users
  createUser: (body)       => request('POST', '/users', body),
  getUserByEmail: (email)  => request('GET', `/users/by-email/${encodeURIComponent(email)}`),

  // Invoices
  createInvoice: (body)    => request('POST', '/invoices', body),
  updateInvoice: (id, body)=> request('PATCH', `/invoices/${id}`, body),
  setInvoiceStatus: (id, status) => request('PATCH', `/invoices/${id}/status`, { status }),
  listInvoices: (userId)   => request('GET', `/invoices?user_id=${userId}`),
  getInvoice: (id, userId) => request('GET', `/invoices/${id}?user_id=${userId}`),
  deleteInvoice: (id, userId) => request('DELETE', `/invoices/${id}?user_id=${userId}`),

  // Invoice items
  bulkInsertItems: (invoiceId, items) => request('POST', '/invoices/items/bulk', { invoice_id: invoiceId, items }),
  getItems: (invoiceId)    => request('GET', `/invoices/items/${invoiceId}`),
}

module.exports = dbClient
