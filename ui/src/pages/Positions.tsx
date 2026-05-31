import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Briefcase, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { Card, Modal, Spinner, EmptyState, ConfirmModal } from '../components/ui'
import type { Department, Paginated } from '../types'

interface Position {
  id?: number
  name: string
  code?: string
  department?: string
  description?: string
  active: boolean
}

const emptyPos: Position = { name: '', code: '', department: '', description: '', active: true }
const emptyDep: Partial<Department> = { name: '', code: '', description: '', active: true }

export default function Positions() {
  const [tab, setTab] = useState<'cargos' | 'departamentos'>('cargos')

  // ── Cargos ──────────────────────────────────────────────────────────────────
  const [positions, setPositions] = useState<Position[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loadingPos, setLoadingPos] = useState(true)
  const [posModal, setPosModal] = useState(false)
  const [posForm, setPosForm] = useState<Position>(emptyPos)
  const [confirmDeletePos, setConfirmDeletePos] = useState<Position | null>(null)

  // ── Departamentos ────────────────────────────────────────────────────────────
  const [loadingDep, setLoadingDep] = useState(true)
  const [depModal, setDepModal] = useState(false)
  const [depForm, setDepForm] = useState<Partial<Department>>(emptyDep)
  const [confirmDeleteDep, setConfirmDeleteDep] = useState<Department | null>(null)

  const loadAll = async () => {
    setLoadingPos(true); setLoadingDep(true)
    try {
      const [posRes, depRes] = await Promise.all([
        api.get<Paginated<Position>>('/positions', { params: { per_page: 100 } }),
        api.get<Paginated<Department>>('/departments', { params: { per_page: 100 } }),
      ])
      setPositions(posRes.data.data)
      setDepartments(depRes.data.data)
    } finally {
      setLoadingPos(false); setLoadingDep(false)
    }
  }
  useEffect(() => { loadAll() }, [])

  // ── Cargos handlers ──────────────────────────────────────────────────────────
  const savePos = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (posForm.id) await api.put(`/positions/${posForm.id}`, posForm)
      else await api.post('/positions', posForm)
      toast.success('Cargo guardado')
      setPosModal(false)
      loadAll()
    } catch { toast.error('Erro ao guardar') }
  }

  const doRemovePos = async () => {
    if (!confirmDeletePos) return
    try {
      await api.delete(`/positions/${confirmDeletePos.id}`)
      toast.success('Cargo eliminado')
      setConfirmDeletePos(null)
      loadAll()
    } catch { toast.error('Erro ao eliminar') }
  }

  // ── Departamentos handlers ───────────────────────────────────────────────────
  const saveDep = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (depForm.id) await api.put(`/departments/${depForm.id}`, depForm)
      else await api.post('/departments', depForm)
      toast.success('Departamento guardado')
      setDepModal(false)
      loadAll()
    } catch { toast.error('Erro ao guardar') }
  }

  const doRemoveDep = async () => {
    if (!confirmDeleteDep) return
    try {
      await api.delete(`/departments/${confirmDeleteDep.id}`)
      toast.success('Departamento eliminado')
      setConfirmDeleteDep(null)
      loadAll()
    } catch { toast.error('Erro ao eliminar') }
  }

  const depNames = departments.map(d => d.name)

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Cargos & Departamentos</h1>
          <p className="text-sm text-slate-500">Estrutura organizacional da empresa</p>
        </div>
        <button className="btn-primary" onClick={() => {
          if (tab === 'cargos') { setPosForm(emptyPos); setPosModal(true) }
          else { setDepForm(emptyDep); setDepModal(true) }
        }}>
          <Plus size={18} /> {tab === 'cargos' ? 'Novo cargo' : 'Novo departamento'}
        </button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 w-fit">
        {([['cargos', 'Cargos', Briefcase], ['departamentos', 'Departamentos', Layers]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${tab === key ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Cargos ── */}
      {tab === 'cargos' && (
        loadingPos ? <Card><Spinner /></Card> : positions.length === 0 ? (
          <Card><EmptyState message="Nenhum cargo registado." /></Card>
        ) : (
          Object.entries(
            positions.reduce<Record<string, Position[]>>((acc, p) => {
              const key = p.department || 'Sem departamento'
              ;(acc[key] = acc[key] || []).push(p)
              return acc
            }, {})
          ).sort(([a], [b]) => a.localeCompare(b)).map(([dept, items]) => (
            <Card key={dept} className="overflow-hidden">
              <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
                <Layers size={14} className="text-primary" />
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">{dept}</span>
                <span className="ml-auto text-xs text-slate-400">{items.length} cargo{items.length !== 1 ? 's' : ''}</span>
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-100">
                  {items.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">
                        <span className="inline-flex items-center gap-2">
                          <Briefcase size={15} className="text-primary" /> {p.name}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{p.code ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate hidden sm:table-cell">{p.description ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${p.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {p.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => { setPosForm(p); setPosModal(true) }} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary"><Pencil size={16} /></button>
                          <button onClick={() => setConfirmDeletePos(p)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          ))
        )
      )}

      {/* ── Tab: Departamentos ── */}
      {tab === 'departamentos' && (
        <Card>
          {loadingDep ? <Spinner /> : departments.length === 0 ? (
            <EmptyState message="Nenhum departamento registado." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Nome</th>
                    <th className="px-4 py-3">Código</th>
                    <th className="px-4 py-3">Descrição</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departments.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-700">
                        <span className="inline-flex items-center gap-2"><Layers size={15} className="text-primary" /> {d.name}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{d.code ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{d.description ?? '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${d.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                          {d.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => { setDepForm(d); setDepModal(true) }} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary"><Pencil size={16} /></button>
                          <button onClick={() => setConfirmDeleteDep(d)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Modal Cargo */}
      <Modal open={posModal} onClose={() => setPosModal(false)} title={posForm.id ? 'Editar cargo' : 'Novo cargo'}>
        <form onSubmit={savePos} className="space-y-4">
          <div>
            <label className="label">Nome do cargo *</label>
            <input className="input" value={posForm.name} onChange={e => setPosForm({ ...posForm, name: e.target.value })} required placeholder="Ex: Técnico de TI" />
          </div>
          <div>
            <label className="label">Código / Sigla</label>
            <input className="input" value={posForm.code ?? ''} onChange={e => setPosForm({ ...posForm, code: e.target.value })} placeholder="Ex: TEC-TI" />
          </div>
          <div>
            <label className="label">Departamento</label>
            <select className="input" value={posForm.department ?? ''} onChange={e => setPosForm({ ...posForm, department: e.target.value })}>
              <option value="">— seleccionar —</option>
              {depNames.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea className="input" rows={3} value={posForm.description ?? ''} onChange={e => setPosForm({ ...posForm, description: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={posForm.active} onChange={e => setPosForm({ ...posForm, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-primary" /> Ativo
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setPosModal(false)}>Cancelar</button>
            <button className="btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      {/* Modal Departamento */}
      <Modal open={depModal} onClose={() => setDepModal(false)} title={depForm.id ? 'Editar departamento' : 'Novo departamento'}>
        <form onSubmit={saveDep} className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={depForm.name ?? ''} onChange={e => setDepForm({ ...depForm, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Código / Sigla</label>
            <input className="input" value={depForm.code ?? ''} onChange={e => setDepForm({ ...depForm, code: e.target.value })} placeholder="Ex: TI, FIN, RH" />
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea className="input" rows={3} value={depForm.description ?? ''} onChange={e => setDepForm({ ...depForm, description: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={!!depForm.active} onChange={e => setDepForm({ ...depForm, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-primary" /> Ativo
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setDepModal(false)}>Cancelar</button>
            <button className="btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!confirmDeletePos} title="Eliminar cargo"
        message={`Tem a certeza que quer eliminar "${confirmDeletePos?.name}"?`}
        danger confirmLabel="Eliminar" onConfirm={doRemovePos} onCancel={() => setConfirmDeletePos(null)} />

      <ConfirmModal open={!!confirmDeleteDep} title="Eliminar departamento"
        message={`Tem a certeza que quer eliminar "${confirmDeleteDep?.name}"? Esta ação não pode ser revertida.`}
        danger confirmLabel="Eliminar" onConfirm={doRemoveDep} onCancel={() => setConfirmDeleteDep(null)} />
    </div>
  )
}
