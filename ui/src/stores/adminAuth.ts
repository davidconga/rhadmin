import { create } from 'zustand'
import { adminApi } from '../lib/adminApi'

interface AdminUser { id: number; name: string; email: string }
interface AdminAuthState {
  admin: AdminUser | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
}

export const useAdminAuth = create<AdminAuthState>((set) => ({
  admin: null,
  token: localStorage.getItem('sadm_token'),

  login: async (email, password) => {
    const { data } = await adminApi.post('/login', { email, password })
    localStorage.setItem('sadm_token', data.token)
    set({ token: data.token, admin: data.admin })
  },

  logout: async () => {
    try { await adminApi.post('/logout') } catch { /* ignore */ }
    localStorage.removeItem('sadm_token')
    set({ token: null, admin: null })
  },

  fetchMe: async () => {
    const { data } = await adminApi.get('/me')
    set({ admin: data })
  },
}))
