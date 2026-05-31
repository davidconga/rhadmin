import { create } from 'zustand'
import { api } from '../lib/api'
import type { Company } from '../types'

interface CompanyState {
  companies: Company[]
  active: Company | null
  loading: boolean
  setActive: (company: Company) => void
  fetchAll: () => Promise<void>
}

const stored = localStorage.getItem('mp_company')

export const useCompany = create<CompanyState>((set) => ({
  companies: [],
  active: stored ? (JSON.parse(stored) as Company) : null,
  loading: false,

  setActive: (company) => {
    localStorage.setItem('mp_company', JSON.stringify(company))
    set({ active: company })
  },

  fetchAll: async () => {
    set({ loading: true })
    try {
      const { data } = await api.get<Company[]>('/companies')
      set((state) => {
        const active = state.active
          ? (data.find((c) => c.id === state.active!.id) ?? data[0] ?? null)
          : (data[0] ?? null)
        if (active) localStorage.setItem('mp_company', JSON.stringify(active))
        return { companies: data, active }
      })
    } finally {
      set({ loading: false })
    }
  },
}))
