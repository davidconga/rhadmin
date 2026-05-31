import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, KeyRound, ShieldCheck, Shield, Eye } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { Card, Modal, Spinner, EmptyState, ConfirmModal } from '../components/ui'
import { useAuth } from '../stores/auth'
import type { User, Role } from '../types'

// ─── Permissões por papel ─────────────────────────────────────
const ROLE_INFO: Record<Role, { label: string; color: string; icon: React.ReactNode; perms: string[] }> = {
  admin: {
    label: 'Administrador', color: 'bg-purple-100 text-purple-700',
    icon: <ShieldCheck size={14} />,
    perms: ['Acesso total', 'Gerir utilizadores', 'Configurações do sistema', 'Criar e eliminar dados'],
  },
  manager: {
    label: 'Gestor', color: 'bg-blue-100 text-blue-700',
    icon: <Shield size={14} />,
    perms: ['Criar e editar funcionários', 'Gerar recibos', 'Aprovar férias', 'Gerir assiduidade'],
  },
  viewer: {
    label: 'Visualizador', color: 'bg-slate-100 text-slate-600',
    icon: <Eye size={14} />,
    perms: ['Consultar funcionários', 'Ver recibos', 'Ver relatórios', 'Sem edição'],
  },
}

const empty = { name: '', email: '', password: '', role: 'viewer' as Role, active: true }

export default function Users() {
  const { user: me } = useAuth()
  const [list, setList] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [form, setForm] = useState<typeof empty & { id?: number }>(empty)
  const [pwModal, setPwModal] = useState<User | null>(null)
  const [newPw, setNewPw] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<User | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get<User[]>('/users')
      setList(data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const openCreate = () => { setForm(empty); setModal('create') }
  const openEdit = (u: User) => {
    setForm({ id: u.id, name: u.name, email: u.email, password: '', role: u.role, active: u.active })
    setModal('edit')
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (modal === 'edit' && form.id) {
        const { password, ...rest } = form
        await api.put(`/users/${form.id}`, rest)
        toast.success('Utilizador actualizado')
      } else {
        await api.post('/users', form)
        toast.success('Utilizador criado')
      }
      setModal(null)
      load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao guardar')
    }
  }

  const resetPw = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pwModal) return
    try {
      await api.post(`/users/${pwModal.id}/reset-password`, { password: newPw })
      toast.success('Password redefinida')
      setPwModal(null)
      setNewPw('')
    } catch {
      toast.error('Erro ao redefinir password')
    }
  }

  const doRemove = async () => {
    if (!confirmDelete) return
    try {
      await api.delete(`/users/${confirmDelete.id}`)
      toast.success('Utilizador eliminado')
      setConfirmDelete(null)
      load()
    } catch {
      toast.error('Erro ao eliminar')
    }
  }

  const RoleBadge = ({ role }: { role: Role }) => {
    const info = ROLE_INFO[role]
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${info.color}`}>
        {info.icon} {info.label}
      </span>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Utilizadores & Permissões</h1>
          <p className="text-sm text-slate-500">Gerir acessos ao sistema por papel</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus size={18} /> Novo utilizador</button>
      </div>

      {/* Legenda de papéis */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(Object.entries(ROLE_INFO) as [Role, typeof ROLE_INFO[Role]][]).map(([role, info]) => (
          <Card key={role} className="p-4">
            <div className="mb-2 flex items-center gap-2">
              <RoleBadge role={role} />
            </div>
            <ul className="space-y-1">
              {info.perms.map((p) => (
                <li key={p} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary/40 shrink-0" /> {p}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      {/* Tabela */}
      <Card>
        {loading ? <Spinner /> : list.length === 0 ? (
          <EmptyState message="Nenhum utilizador encontrado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Utilizador</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Papel</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3">Último acesso</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((u) => (
                  <tr key={u.id} className={`hover:bg-slate-50 ${!u.active ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading text-sm font-bold text-primary">
                          {u.name.charAt(0)}
                        </div>
                        <span className="font-medium text-slate-700">
                          {u.name}
                          {me?.id === u.id && <span className="ml-1.5 text-xs text-slate-400">(eu)</span>}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{u.email}</td>
                    <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${u.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {u.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString('pt-PT', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setPwModal(u); setNewPw('') }} className="rounded p-1.5 text-slate-400 hover:bg-amber-50 hover:text-amber-600" title="Redefinir password"><KeyRound size={15} /></button>
                        <button onClick={() => openEdit(u)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary" title="Editar"><Pencil size={15} /></button>
                        {me?.id !== u.id && (
                          <button onClick={() => setConfirmDelete(u)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Eliminar"><Trash2 size={15} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal criar / editar */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'edit' ? 'Editar utilizador' : 'Novo utilizador'}>
        <form onSubmit={save} className="space-y-4">
          <div>
            <label className="label">Nome</label>
            <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div>
            <label className="label">Email</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          {modal === 'create' && (
            <div>
              <label className="label">Password</label>
              <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} placeholder="Mínimo 8 caracteres" />
            </div>
          )}
          <div>
            <label className="label">Papel</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
              disabled={modal === 'edit' && me?.id === form.id}>
              <option value="admin">Administrador — acesso total</option>
              <option value="manager">Gestor — criar e editar</option>
              <option value="viewer">Visualizador — apenas leitura</option>
            </select>
            {modal === 'edit' && me?.id === form.id && (
              <p className="mt-1 text-xs text-slate-400">Não pode alterar o seu próprio papel.</p>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-primary" /> Ativo
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-outline" onClick={() => setModal(null)}>Cancelar</button>
            <button className="btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      {/* Modal redefinir password */}
      <Modal open={!!pwModal} onClose={() => setPwModal(null)} title={`Redefinir password — ${pwModal?.name}`}>
        <form onSubmit={resetPw} className="space-y-4">
          <div>
            <label className="label">Nova password</label>
            <input type="password" className="input" value={newPw} onChange={(e) => setNewPw(e.target.value)} required minLength={8} placeholder="Mínimo 8 caracteres" autoFocus />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setPwModal(null)}>Cancelar</button>
            <button className="btn-primary"><KeyRound size={15} /> Redefinir</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!confirmDelete}
        title="Eliminar utilizador"
        message={`Tem a certeza que quer eliminar "${confirmDelete?.name}"? Esta ação é permanente.`}
        danger confirmLabel="Eliminar"
        onConfirm={doRemove} onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
