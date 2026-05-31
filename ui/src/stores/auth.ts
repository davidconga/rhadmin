import { create } from 'zustand'
import { api } from '../lib/api'
import type { User } from '../types'

interface AuthState {
  user: User | null
  token: string | null
  loading: boolean
  setupRequired: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  fetchMe: () => Promise<void>
  clearSetup: () => void
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem('mp_token'),
  loading: false,
  setupRequired: false,

  login: async (email, password) => {
    set({ loading: true })
    try {
      const { data } = await api.post('/login', { email, password })
      localStorage.setItem('mp_token', data.token)
      set({ token: data.token, user: data.user, setupRequired: !!data.setup_required })
    } finally {
      set({ loading: false })
    }
  },

  logout: async () => {
    try {
      await api.post('/logout')
    } catch {
      // ignora erros de rede no logout
    }
    localStorage.removeItem('mp_token')
    set({ token: null, user: null, setupRequired: false })
  },

  fetchMe: async () => {
    const { data } = await api.get('/me')
    set({ user: data, setupRequired: !!data.setup_required })
  },

  clearSetup: () => set({ setupRequired: false }),
}))
