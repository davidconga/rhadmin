import { useEffect, useState } from 'react'
import { api } from '../lib/api'

interface Options { positions: string[]; departments: string[] }

let cache: Options | null = null

export function useEmployeeOptions() {
  const [options, setOptions] = useState<Options>(cache ?? { positions: [], departments: [] })

  useEffect(() => {
    if (cache) return
    api.get<Options>('/employees/options')
      .then(r => { cache = r.data; setOptions(r.data) })
      .catch(() => {})
  }, [])

  return options
}
