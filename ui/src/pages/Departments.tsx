import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { Card, Modal, Spinner, EmptyState, ConfirmModal } from '../components/ui'
import type { Department, Paginated } from '../types'

const empty: Partial<Department> = { name: '', code: '', description: '', active: true }

export default function Departments() {
  const [list, setList] = useState<Department[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Partial<Department>>(empty)
  const [confirmDelete, setConfirmDelete] = useState<Department | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get<Paginated<Department>>('/departments', { params: { per_page: 100 } })
      setList(data.data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(empty); setModal(true) }
  const openEdit = (d: Department) => { setForm(d); setModal(true) }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (form.id) await api.put(`/departments/${form.id}`, form)
      else await api.post('/departments', form)
      toast.success('Departamento guardado')
      setModal(false)
      load()
    } catch {
      toast.error('Erro ao guardar')
    }
  }

  const doRemove = async () => {
    if (!confirmDelete) return
    try {
      await api.delete(`/departments/${confirmDelete.id}`)
      toast.success('Departamento eliminado')
      setConfirmDelete(null)
      load()
    } catch {
      toast.error('Erro ao eliminar')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Departamentos</h1>
          <p className="text-sm text-slate-500">Estrutura organizacional da empresa</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus size={18} /> Novo departamento</button>
      </div>

      <Card>
        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
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
                {list.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">
                      <span className="inline-flex items-center gap-2">
                        <Layers size={15} className="text-primary" /> {d.name}
                      </span>
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
                        <button onClick={() => openEdit(d)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary"><Pencil size={16} /></button>
                        <button onClick={() => setConfirmDelete(d)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar departamento' : 'Novo departamento'}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Código / Sigla</label>
            <input className="input" value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Ex: TI, FIN, RH" />
          </div>
          <div>
            <label className="label">Descrição</label>
            <textarea className="input" rows={3} value={form.description ?? ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-primary" /> Ativo
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!confirmDelete}
        title="Eliminar departamento"
        message={`Tem a certeza que quer eliminar "${confirmDelete?.name}"? Esta ação não pode ser revertida.`}
        danger
        confirmLabel="Eliminar"
        onConfirm={doRemove}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
