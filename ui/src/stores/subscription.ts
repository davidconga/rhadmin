import { create } from 'zustand'
import { api } from '../lib/api'

interface SubscriptionStore {
  features: string[]
  fetchFeatures: () => Promise<void>
  hasFeature: (f: string) => boolean
}

export const useSubscription = create<SubscriptionStore>((set, get) => ({
  features: [],
  fetchFeatures: async () => {
    try {
      const { data } = await api.get('/subscription')
      set({ features: data.features ?? [] })
    } catch {}
  },
  hasFeature: (f) => {
    const { features } = get()
    if (features.length === 0) return true // ainda a carregar — não bloqueia
    return features.includes(f)
  },
}))
