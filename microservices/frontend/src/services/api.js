import axios from 'axios'

const BASE = '/api'

const client = axios.create({ baseURL: BASE })

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('luqo_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('luqo_token')
      localStorage.removeItem('luqo_user')
      window.dispatchEvent(new Event('luqo:logout'))
    }
    return Promise.reject(err)
  },
)

export const auth = {
  register: (data) => client.post('/auth/register', data),
  login: (data) => client.post('/auth/login', data),
}

export const invoices = {
  upload: (formData, onProgress) =>
    client.post('/invoices', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded * 100) / e.total)),
    }),
  list: () => client.get('/invoices'),
  get: (id) => client.get(`/invoices/${id}`),
  delete: (id) => client.delete(`/invoices/${id}`),
}
