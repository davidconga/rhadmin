import { useEffect, useState } from 'react'
import { Plus, Trash2, Copy, Check, KeyRound, Eye, EyeOff, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { Card, Modal, Spinner, EmptyState, ConfirmModal, FeatureLocked } from '../components/ui'
import { useSubscription } from '../stores/subscription'

interface ApiKey {
  id: number
  name: string
  prefix: string
  permissions: string[]
  active: boolean
  last_used_at: string | null
  expires_at: string | null
  created_at: string
}

const PERMISSION_OPTIONS = [
  { value: '*',          label: 'Acesso total' },
  { value: 'employees',  label: 'Funcionários' },
  { value: 'attendances',label: 'Assiduidade' },
  { value: 'salary-slips',label: 'Recibos' },
]

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

export default function ApiKeys() {
  const { hasFeature } = useSubscription()
  const [list, setList] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState({ name: '', permissions: ['*'], expires_at: '' })
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<ApiKey | null>(null)
  const [showDocs, setShowDocs] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get<ApiKey[]>('/api-keys')
      setList(data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data } = await api.post<{ key: string; meta: ApiKey }>('/api-keys', {
        name: form.name,
        permissions: form.permissions,
        expires_at: form.expires_at || undefined,
      })
      setNewKey(data.key)
      setModal(false)
      load()
    } catch { toast.error('Erro ao criar API key') }
  }

  const toggle = async (k: ApiKey) => {
    await api.put(`/api-keys/${k.id}`, { active: !k.active })
    load()
  }

  const doRemove = async () => {
    if (!confirmDelete) return
    await api.delete(`/api-keys/${confirmDelete.id}`)
    toast.success('API key revogada')
    setConfirmDelete(null); load()
  }

  const copy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Copiado!')
  }

  const togglePerm = (v: string) => {
    if (v === '*') { setForm({ ...form, permissions: ['*'] }); return }
    const perms = form.permissions.filter(p => p !== '*')
    setForm({ ...form, permissions: perms.includes(v) ? perms.filter(p => p !== v) : [...perms, v] })
  }

  if (!hasFeature('api_keys')) return <FeatureLocked feature="api_keys" plan="Empresarial" />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">API de Integração</h1>
          <p className="text-sm text-slate-500">API keys para sistemas externos acederem ao RHadmin</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => setShowDocs(v => !v)}>
            {showDocs ? <EyeOff size={16} /> : <Eye size={16} />} Documentação
          </button>
          <button className="btn-primary" onClick={() => { setForm({ name: '', permissions: ['*'], expires_at: '' }); setModal(true) }}>
            <Plus size={18} /> Nova key
          </button>
        </div>
      </div>

      {/* Documentação inline */}
      {showDocs && (
        <Card className="p-5 bg-slate-900 text-slate-100">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">Base URL</p>
          <code className="block rounded bg-slate-800 px-3 py-2 text-sm text-green-400">{BASE}</code>
          <p className="mt-4 mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Autenticação</p>
          <code className="block rounded bg-slate-800 px-3 py-2 text-xs text-yellow-300 leading-relaxed">
            X-Tenant: {'<slug>'}<br />
            X-Api-Key: {'<sua-api-key>'}<br />
            X-Company: {'<company-id>'}  {'/* opcional */'}
          </code>
          <p className="mt-4 mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Endpoints</p>
          <div className="space-y-1.5 text-xs">
            {[
              ['GET',  '/external/employees',    'Listar funcionários activos'],
              ['POST', '/external/employees',    'Criar/actualizar funcionário (upsert por bi_nif)'],
              ['POST', '/external/attendances',  'Enviar registos de assiduidade em lote (máx. 500)'],
              ['GET',  '/external/salary-slips', 'Listar recibos (?month=&year=&status=)'],
            ].map(([method, path, desc]) => (
              <div key={path} className="flex items-start gap-3">
                <span className={`w-12 shrink-0 rounded px-1.5 py-0.5 text-center font-mono font-bold text-[10px] ${method === 'GET' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'}`}>{method}</span>
                <code className="text-slate-300 font-mono">{path}</code>
                <span className="text-slate-500">{desc}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Lista de keys */}
      <Card>
        {loading ? <Spinner /> : list.length === 0 ? (
          <EmptyState message="Nenhuma API key criada. Gere uma para começar a integrar." />
        ) : (
          <div className="divide-y divide-slate-100">
            {list.map((k) => (
              <div key={k.id} className={`flex items-center gap-4 px-4 py-3 ${!k.active ? 'opacity-50' : ''}`}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <KeyRound size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-slate-800">{k.name}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <code className="text-xs text-slate-400 font-mono">{k.prefix}••••••••••••</code>
                    {k.permissions?.includes('*')
                      ? <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">Acesso total</span>
                      : k.permissions?.map(p => (
                          <span key={p} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{p}</span>
                        ))
                    }
                  </div>
                </div>
                <div className="text-right text-xs text-slate-400 shrink-0">
                  {k.last_used_at
                    ? <p>Último uso: {new Date(k.last_used_at).toLocaleDateString('pt-PT')}</p>
                    : <p>Nunca usada</p>}
                  {k.expires_at && <p className="text-amber-500">Expira: {new Date(k.expires_at).toLocaleDateString('pt-PT')}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => toggle(k)} className={`rounded px-2.5 py-1.5 text-xs font-medium transition ${k.active ? 'text-slate-500 hover:bg-slate-100' : 'text-primary hover:bg-primary/10'}`}>
                    {k.active ? 'Desactivar' : 'Activar'}
                  </button>
                  <button onClick={() => setConfirmDelete(k)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal criar */}
      <Modal open={modal} onClose={() => setModal(false)} title="Nova API key">
        <form onSubmit={create} className="space-y-4">
          <div>
            <label className="label">Nome / Descrição</label>
            <input className="input" placeholder="Ex: ERP Primavera, Biométrico ZK" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Permissões</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {PERMISSION_OPTIONS.map(({ value, label }) => (
                <button key={value} type="button"
                  onClick={() => togglePerm(value)}
                  className={`rounded-full border px-3 py-1 text-sm transition ${form.permissions.includes(value) ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 text-slate-500 hover:border-primary/50'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Expira em (opcional)</label>
            <input type="date" className="input" value={form.expires_at} onChange={e => setForm({ ...form, expires_at: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary"><Zap size={15} /> Gerar key</button>
          </div>
        </form>
      </Modal>

      {/* Modal mostrar key gerada */}
      <Modal open={!!newKey} onClose={() => setNewKey(null)} title="API key gerada">
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm text-amber-700">
            ⚠️ Copie agora — esta key <strong>não será mostrada novamente</strong>.
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-slate-900 px-4 py-3 text-sm text-green-400 font-mono break-all">{newKey}</code>
            <button onClick={() => copy(newKey!)} className="shrink-0 rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50 transition">
              {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} className="text-slate-500" />}
            </button>
          </div>
          <button className="btn-primary w-full" onClick={() => setNewKey(null)}>Fechar</button>
        </div>
      </Modal>

      <ConfirmModal
        open={!!confirmDelete}
        title="Revogar API key"
        message={`Tem a certeza que quer eliminar "${confirmDelete?.name}"? Qualquer sistema que use esta key deixará de funcionar.`}
        danger confirmLabel="Revogar"
        onConfirm={doRemove} onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
