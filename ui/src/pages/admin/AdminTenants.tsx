import { useEffect, useState } from 'react'
import { Search, Power, Trash2, LogIn, ChevronLeft, ChevronRight, X, Users, Building2, User, RefreshCw, Save } from 'lucide-react'
import { toast } from 'sonner'
import { adminApi } from '../../lib/adminApi'
import { setTenant } from '../../lib/api'
import { ConfirmModal, Spinner } from '../../components/ui'
import { useNavigate } from 'react-router-dom'

interface Plan { id: number; name: string; slug: string }
interface Tenant {
  id: number; name: string; slug: string; active: boolean
  subscription_status: string; trial_ends_at: string | null
  subscribed_at: string | null; created_at: string; plan: Plan | null
}
interface TenantDetail {
  tenant: Tenant
  stats: { employees: number | string; users: number | string; companies: number | string }
}
interface Paginated { data: Tenant[]; total: number; current_page: number; last_page: number }

const STATUS_STYLE: Record<string, string> = {
  trial:     'bg-amber-900/40 text-amber-400',
  active:    'bg-green-900/40 text-green-400',
  suspended: 'bg-red-900/40 text-red-400',
  cancelled: 'bg-slate-700 text-slate-400',
}
const STATUS_LABEL: Record<string, string> = {
  trial: 'Trial', active: 'Activo', suspended: 'Suspenso', cancelled: 'Cancelado',
}

export default function AdminTenants() {
  const navigate = useNavigate()
  const [data, setData] = useState<Paginated | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [confirmDelete, setConfirmDelete] = useState<Tenant | null>(null)
  const [detail, setDetail] = useState<TenantDetail | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [editForm, setEditForm] = useState<{ subscription_status: string; plan_slug: string; trial_ends_at: string; active: boolean } | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [saving, setSaving] = useState(false)

  const load = async (q = search, p = page) => {
    const res = await adminApi.get<Paginated>('/tenants', { params: { search: q, page: p } })
    setData(res.data)
  }

  useEffect(() => { load() }, [page])
  useEffect(() => {
    adminApi.get<{ data: Plan[] }>('/plans').then(r => setPlans(r.data.data ?? r.data)).catch(() => {})
  }, [])

  const openDetail = async (t: Tenant) => {
    setLoadingDetail(true)
    setDetail(null)
    setEditForm(null)
    try {
      const { data: d } = await adminApi.get<TenantDetail>(`/tenants/${t.id}`)
      setDetail(d)
      setEditForm({
        subscription_status: d.tenant.subscription_status,
        plan_slug: d.tenant.plan?.slug ?? '',
        trial_ends_at: d.tenant.trial_ends_at?.split('T')[0] ?? '',
        active: d.tenant.active,
      })
    } catch { toast.error('Erro ao carregar detalhe') }
    finally { setLoadingDetail(false) }
  }

  const toggle = async (t: Tenant) => {
    await adminApi.put(`/tenants/${t.id}`, { active: !t.active })
    toast.success(t.active ? 'Tenant suspenso' : 'Tenant activado')
    load()
    if (detail?.tenant.id === t.id) openDetail({ ...t, active: !t.active })
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    try {
      await adminApi.delete(`/tenants/${confirmDelete.id}`)
      toast.success('Tenant eliminado')
      setConfirmDelete(null)
      setDetail(null)
      load()
    } catch { toast.error('Erro ao eliminar') }
  }

  const impersonate = async (t: Tenant) => {
    try {
      const { data: d } = await adminApi.post(`/tenants/${t.id}/impersonate`)
      setTenant(d.tenant)
      localStorage.setItem('mp_token', d.token)
      toast.success(`A entrar como admin de "${t.name}"`)
      navigate('/app')
    } catch { toast.error('Erro ao impersonar tenant') }
  }

  const saveEdit = async () => {
    if (!detail || !editForm) return
    setSaving(true)
    try {
      const { data: updated } = await adminApi.put(`/tenants/${detail.tenant.id}`, {
        subscription_status: editForm.subscription_status,
        plan_slug: editForm.plan_slug || undefined,
        trial_ends_at: editForm.trial_ends_at || undefined,
        active: editForm.active,
      })
      toast.success('Tenant actualizado')
      setDetail(d => d ? { ...d, tenant: updated } : d)
      load()
    } catch { toast.error('Erro ao guardar') }
    finally { setSaving(false) }
  }

  return (
    <div className="flex gap-5 h-full">
      {/* Lista */}
      <div className="flex-1 space-y-5 min-w-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold text-white">Tenants</h1>
            <p className="text-sm text-slate-400">{data?.total ?? '—'} registados</p>
          </div>
        </div>

        <div className="relative max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-700 pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
            placeholder="Pesquisar por nome ou slug..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); load(e.target.value, 1) }}
          />
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Plano</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Criado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {(data?.data ?? []).map((t) => (
                <tr key={t.id}
                  onClick={() => openDetail(t)}
                  className={`cursor-pointer hover:bg-slate-700/50 ${detail?.tenant.id === t.id ? 'bg-slate-700/50 border-l-2 border-primary' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.slug}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{t.plan?.name ?? <span className="text-slate-500">—</span>}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[t.subscription_status] ?? ''}`}>
                      {STATUS_LABEL[t.subscription_status] ?? t.subscription_status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">{new Date(t.created_at).toLocaleDateString('pt-PT')}</td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <button onClick={() => impersonate(t)} title="Entrar como admin" className="rounded p-1.5 text-slate-500 hover:bg-primary/20 hover:text-primary"><LogIn size={14} /></button>
                      <button onClick={() => toggle(t)} title={t.active ? 'Suspender' : 'Activar'} className="rounded p-1.5 text-slate-500 hover:bg-amber-900/30 hover:text-amber-400"><Power size={14} /></button>
                      <button onClick={() => setConfirmDelete(t)} title="Eliminar" className="rounded p-1.5 text-slate-500 hover:bg-red-900/30 hover:text-red-400"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && data.last_page > 1 && (
            <div className="flex items-center justify-between border-t border-slate-700 px-4 py-3">
              <p className="text-xs text-slate-500">Página {data.current_page} de {data.last_page}</p>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="rounded p-1.5 text-slate-400 hover:bg-slate-700 disabled:opacity-30"><ChevronLeft size={16} /></button>
                <button onClick={() => setPage(p => Math.min(data.last_page, p + 1))} disabled={page === data.last_page} className="rounded p-1.5 text-slate-400 hover:bg-slate-700 disabled:opacity-30"><ChevronRight size={16} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Painel de detalhe */}
      {(loadingDetail || detail) && (
        <div className="w-80 shrink-0 rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-5 self-start sticky top-0">
          {loadingDetail ? (
            <div className="flex justify-center py-10"><Spinner /></div>
          ) : detail && editForm && (
            <>
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-heading font-bold text-white text-lg leading-tight">{detail.tenant.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{detail.tenant.slug}</p>
                </div>
                <button onClick={() => setDetail(null)} className="rounded p-1 text-slate-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Users, label: 'Funcionários', value: detail.stats.employees },
                  { icon: User, label: 'Utilizadores', value: detail.stats.users },
                  { icon: Building2, label: 'Empresas', value: detail.stats.companies },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-lg bg-slate-700 p-3 text-center">
                    <Icon size={14} className="mx-auto mb-1 text-primary" />
                    <p className="text-xl font-bold text-white">{value}</p>
                    <p className="text-xs text-slate-400">{label}</p>
                  </div>
                ))}
              </div>

              <hr className="border-slate-700" />

              {/* Edição */}
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Configuração</p>

                <div>
                  <label className="mb-1 block text-xs text-slate-400">Estado da subscrição</label>
                  <select className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    value={editForm.subscription_status}
                    onChange={e => setEditForm(f => f ? { ...f, subscription_status: e.target.value } : f)}>
                    {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-400">Plano</label>
                  <select className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    value={editForm.plan_slug}
                    onChange={e => setEditForm(f => f ? { ...f, plan_slug: e.target.value } : f)}>
                    <option value="">— sem plano —</option>
                    {plans.map(p => <option key={p.slug} value={p.slug}>{p.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs text-slate-400">Trial até</label>
                  <input type="date" className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                    value={editForm.trial_ends_at}
                    onChange={e => setEditForm(f => f ? { ...f, trial_ends_at: e.target.value } : f)} />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input type="checkbox" checked={editForm.active}
                    onChange={e => setEditForm(f => f ? { ...f, active: e.target.checked } : f)}
                    className="h-4 w-4 rounded border-slate-600 text-primary" />
                  Tenant activo
                </label>

                <button onClick={saveEdit} disabled={saving}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary/90 transition">
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                  Guardar alterações
                </button>
              </div>

              <hr className="border-slate-700" />

              {/* Acções */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acções</p>
                <button onClick={() => impersonate(detail.tenant)}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 transition">
                  <LogIn size={14} /> Entrar como admin
                </button>
                <button onClick={() => setConfirmDelete(detail.tenant)}
                  className="flex w-full items-center gap-2 rounded-lg border border-red-900/50 px-3 py-2 text-sm text-red-400 hover:bg-red-900/20 transition">
                  <Trash2 size={14} /> Eliminar tenant
                </button>
              </div>

              <p className="text-xs text-slate-600">Criado em {new Date(detail.tenant.created_at).toLocaleDateString('pt-PT')}</p>
            </>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!confirmDelete}
        title="Eliminar tenant"
        message={`Vai eliminar permanentemente "${confirmDelete?.name}" e toda a sua base de dados. Esta ação é irreversível.`}
        danger confirmLabel="Eliminar"
        onConfirm={doDelete} onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
