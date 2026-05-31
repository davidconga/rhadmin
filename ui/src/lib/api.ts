import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

export const DEFAULT_TENANT = import.meta.env.VITE_TENANT ?? 'matombe'

export const getTenant = () => localStorage.getItem('mp_tenant') ?? DEFAULT_TENANT
export const setTenant = (slug: string) => localStorage.setItem('mp_tenant', slug)

export const api = axios.create({
  baseURL: API_URL,
  headers: { Accept: 'application/json' },
})

api.interceptors.request.use((config) => {
  config.headers['X-Tenant'] = getTenant()
  const token = localStorage.getItem('mp_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  const company = localStorage.getItem('mp_company')
  if (company) {
    const parsed = JSON.parse(company) as { id?: number }
    if (parsed?.id) config.headers['X-Company'] = parsed.id
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('mp_token')
      if (!location.pathname.startsWith('/login')) {
        location.href = '/login'
      }
    }
    return Promise.reject(error)
  },
)

/** Faz download de um ficheiro autenticado (blob) e dispara o save no browser. */
export async function downloadFile(url: string, fallbackName = 'documento') {
  const res = await api.get(url, { responseType: 'blob' })
  const disposition = res.headers['content-disposition'] as string | undefined
  const match = disposition?.match(/filename="?([^"]+)"?/)
  const name = match?.[1] ?? fallbackName
  const blobUrl = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
}

/** Faz POST e descarrega a resposta como ficheiro (ex.: ZIP de recibos). */
export async function downloadPost(url: string, body: unknown, fallbackName = 'documento') {
  const res = await api.post(url, body, { responseType: 'blob' })
  const blobUrl = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(blobUrl)
}
