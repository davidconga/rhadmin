import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { adminApi } from '../../lib/adminApi'
import { ConfirmModal } from '../../components/ui'

interface Plan {
  id: number; slug: string; name: string; description: string
  price_aoa: number; max_companies: number; max_employees: number
  max_users: number; features: string[]; feature_keys: string[]
  active: boolean; sort_order: number; tenants_count?: number
}

const ALL_FEATURES: { key: string; label: string }[] = [
  { key: 'employees',      label: 'Funcionários' },
  { key: 'salary_slips',   label: 'Recibos de Salário' },
  { key: 'contracts',      label: 'Contratos' },
  { key: 'departments',    label: 'Departamentos' },
  { key: 'positions',      label: 'Cargos' },
  { key: 'attendance',     label: 'Assiduidade' },
  { key: 'schedules',      label: 'Escalas / Turnos' },
  { key: 'vacations',      label: 'Férias' },
  { key: 'banks',          label: 'Bancos' },
  { key: 'biometrics',     label: 'Biométricos' },
  { key: 'payment_orders', label: 'Ordens de Pagamento' },
  { key: 'api_keys',       label: 'API Keys' },
  { key: 'sms',            label: 'SMS' },
]

const empty = {
  slug: '', name: '', description: '', price_aoa: 0,
  max_companies: 1, max_employees: 50, max_users: 5,
  features: [''], feature_keys: ['employees','salary_slips','contracts','departments','positions'],
  active: true, sort_order: 99,
}

export default function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<typeof empty & { id?: number }>(empty)
  const [confirmDelete, setConfirmDelete] = useState<Plan | null>(null)

  const load = async () => {
    const { data } = await adminApi.get<Plan[]>('/plans')
    setPlans(data)
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(empty); setModal(true) }
  const openEdit = (p: Plan) => {
    setForm({ id: p.id, slug: p.slug, name: p.name, description: p.description, price_aoa: p.price_aoa, max_companies: p.max_companies, max_employees: p.max_employees, max_users: p.max_users, features: p.features?.length ? p.features : [''], feature_keys: p.feature_keys ?? [], active: p.active, sort_order: p.sort_order })
    setModal(true)
  }

  const toggleFeatureKey = (key: string) => {
    const keys = form.feature_keys.includes(key)
      ? form.feature_keys.filter(k => k !== key)
      : [...form.feature_keys, key]
    setForm({ ...form, feature_keys: keys })
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { ...form, features: form.features.filter(f => f.trim()) }
    try {
      if (form.id) await adminApi.put(`/plans/${form.id}`, payload)
      else await adminApi.post('/plans', payload)
      toast.success('Plano guardado')
      setModal(false); load()
    } catch { toast.error('Erro ao guardar plano') }
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    try {
      await adminApi.delete(`/plans/${confirmDelete.id}`)
      toast.success('Plano eliminado')
      setConfirmDelete(null); load()
    } catch (err: unknown) {
      toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro')
    }
  }

  const updateFeature = (i: number, v: string) => {
    const f = [...form.features]; f[i] = v; setForm({ ...form, features: f })
  }
  const addFeature = () => setForm({ ...form, features: [...form.features, ''] })
  const removeFeature = (i: number) => setForm({ ...form, features: form.features.filter((_, j) => j !== i) })

  const fmt = (n: number) => n >= 999 ? '∞' : n.toString()

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Planos</h1>
          <p className="text-sm text-slate-400">Preços e limites da plataforma</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition">
          <Plus size={16} /> Novo plano
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className={`rounded-xl border p-5 ${p.active ? 'border-slate-700 bg-slate-800' : 'border-slate-700/50 bg-slate-800/50 opacity-60'}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="font-heading font-bold text-white">{p.name}</p>
                <p className="text-xs text-slate-500">{p.description}</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(p)} className="rounded p-1 text-slate-500 hover:text-primary"><Pencil size={14} /></button>
                <button onClick={() => setConfirmDelete(p)} className="rounded p-1 text-slate-500 hover:text-red-400"><Trash2 size={14} /></button>
              </div>
            </div>
            <p className="mt-3 font-heading text-2xl font-bold text-primary">
              {p.price_aoa === 0 ? 'Grátis' : `${p.price_aoa.toLocaleString('pt-PT')} AOA`}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[['Empresas', fmt(p.max_companies)], ['Func.', fmt(p.max_employees)], ['Users', fmt(p.max_users)]].map(([l, v]) => (
                <div key={l} className="rounded-lg bg-slate-700/50 py-2">
                  <p className="font-bold text-sm text-white">{v}</p>
                  <p className="text-[10px] text-slate-500">{l}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-slate-500">{p.tenants_count ?? 0} tenant(s)</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${p.active ? 'bg-green-900/40 text-green-400' : 'bg-slate-700 text-slate-500'}`}>
                {p.active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8" onClick={() => setModal(false)}>
          <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-800 my-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
              <h3 className="font-heading font-bold text-white">{form.id ? 'Editar plano' : 'Novo plano'}</h3>
              <button onClick={() => setModal(false)} className="text-slate-500 hover:text-white">✕</button>
            </div>
            <form onSubmit={save} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Nome</label>
                  <input className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Slug</label>
                  <input className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none" value={form.slug} onChange={e => setForm({...form, slug: e.target.value})} required disabled={!!form.id} />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Descrição</label>
                <input className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} />
              </div>
              <div className="grid grid-cols-4 gap-3">
                {[['Preço (AOA)', 'price_aoa'], ['Empresas', 'max_companies'], ['Func.', 'max_employees'], ['Utilizadores', 'max_users']].map(([label, key]) => (
                  <div key={key}>
                    <label className="mb-1 block text-xs text-slate-400">{label}</label>
                    <input type="number" min="0" className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                      value={(form as Record<string, unknown>)[key] as number}
                      onChange={e => setForm({...form, [key]: parseInt(e.target.value)})} />
                  </div>
                ))}
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Módulos activos (feature keys)</label>
                <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-slate-600 bg-slate-700/50 p-3">
                  {ALL_FEATURES.map(f => (
                    <label key={f.key} className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 hover:text-white">
                      <input type="checkbox" checked={form.feature_keys.includes(f.key)}
                        onChange={() => toggleFeatureKey(f.key)}
                        className="rounded border-slate-500 bg-slate-600 text-primary" />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-400">Descrição das funcionalidades (exibida ao cliente)</label>
                <div className="space-y-1.5">
                  {form.features.map((f, i) => (
                    <div key={i} className="flex gap-2">
                      <input className="flex-1 rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none" value={f} onChange={e => updateFeature(i, e.target.value)} placeholder={`Funcionalidade ${i+1}`} />
                      <button type="button" onClick={() => removeFeature(i)} className="text-slate-500 hover:text-red-400">✕</button>
                    </div>
                  ))}
                  <button type="button" onClick={addFeature} className="text-xs text-primary hover:underline">+ Adicionar</button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-slate-400">
                  <input type="checkbox" checked={form.active} onChange={e => setForm({...form, active: e.target.checked})} className="rounded" /> Activo
                </label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setModal(false)} className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-400 hover:border-slate-500">Cancelar</button>
                  <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">Guardar</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title="Eliminar plano"
        message={`Vai eliminar "${confirmDelete?.name}". Tenants neste plano perderão a associação.`}
        danger confirmLabel="Eliminar"
        onConfirm={doDelete} onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
