import axios from 'axios'

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api') + '/admin-api'

export const adminApi = axios.create({
  baseURL: BASE,
  headers: { Accept: 'application/json' },
})

adminApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('sadm_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

adminApi.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sadm_token')
      if (!location.pathname.startsWith('/admin/login')) {
        location.href = '/admin/login'
      }
    }
    return Promise.reject(error)
  },
)
