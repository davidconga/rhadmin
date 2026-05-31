import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Pencil, Trash2, Search, Eye, Send, CheckSquare, Square } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { money } from '../lib/format'
import { Card, Modal, Spinner, EmptyState, ConfirmModal } from '../components/ui'
import EmployeeWizard from '../components/EmployeeWizard'
import { getTenant } from '../lib/api'
import { useCompany } from '../stores/company'
import { useEmployeeOptions } from '../hooks/useEmployeeOptions'
import type { Employee, Paginated } from '../types'

const schema = z.object({
  full_name: z.string().min(2, 'Nome obrigatório'),
  bi_nif: z.string().optional(),
  biometric_id: z.string().optional(),
  position: z.string().optional(),
  department: z.string().optional(),
  bank_name: z.string().optional(),
  account_number: z.string().optional(),
  iban: z.string().optional(),
  base_salary: z.number().min(0),
  food_allowance: z.number().min(0),
  transport_allowance: z.number().min(0),
  social_security_rate: z.number().min(0).max(100),
  active: z.boolean(),
})
type FormData = z.infer<typeof schema>

const empty: FormData = {
  full_name: '', bi_nif: '', biometric_id: '', position: '', department: '',
  bank_name: '', account_number: '', iban: '',
  base_salary: 0, food_allowance: 0, transport_allowance: 0,
  social_security_rate: 3, active: true,
}

export default function Employees() {
  const { active: activeCompany } = useCompany()
  const tenantName = activeCompany?.name ?? getTenant()
  const empOptions = useEmployeeOptions()

  const [list, setList] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [wizard, setWizard] = useState(false)
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Employee | null>(null)
  const [inviteModal, setInviteModal] = useState(false)
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [confirmBulk, setConfirmBulk] = useState(false)
  const [deletingBulk, setDeletingBulk] = useState(false)
  const navigate = useNavigate()

  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: empty })

  const load = async (q = '') => {
    setLoading(true)
    try {
      const { data } = await api.get<Paginated<Employee>>('/employees', { params: { search: q, per_page: 50 } })
      setList(data.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const openCreate = () => setWizard(true)

  const toggleSelect = (id: number) =>
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  const toggleAll = () =>
    setSelected(s => s.size === list.length ? new Set() : new Set(list.map(e => e.id)))

  const doBulkDelete = async () => {
    setDeletingBulk(true)
    try {
      await api.delete('/employees', { data: { ids: [...selected] } })
      toast.success(`${selected.size} funcionário(s) eliminado(s)`)
      setSelected(new Set()); setConfirmBulk(false); load(search)
    } catch { toast.error('Erro ao eliminar') } finally { setDeletingBulk(false) }
  }

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    try {
      const res = await api.post('/employee-registrations/invite', {
        phone: invitePhone,
        name: inviteName || undefined,
      })
      toast.success(res.data.message)
      setInviteModal(false); setInvitePhone(''); setInviteName('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao enviar convite')
    } finally { setInviting(false) }
  }

  const openEdit = (e: Employee) => {
    setEditing(e)
    form.reset({
      full_name: e.full_name, bi_nif: e.bi_nif ?? '', biometric_id: e.biometric_id ?? '', position: e.position ?? '',
      department: e.department ?? '', bank_name: e.bank_name ?? '',
      account_number: e.account_number ?? '', iban: e.iban ?? '',
      base_salary: Number(e.base_salary), food_allowance: Number(e.food_allowance),
      transport_allowance: Number(e.transport_allowance),
      social_security_rate: Number(e.social_security_rate), active: e.active,
    })
    setModal(true)
  }

  const onSubmit = async (data: FormData) => {
    try {
      if (editing) {
        await api.put(`/employees/${editing.id}`, data)
        toast.success('Funcionário atualizado')
      } else {
        await api.post('/employees', data)
        toast.success('Funcionário criado')
      }
      setModal(false)
      load(search)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao guardar')
    }
  }

  const remove = (e: Employee) => setConfirmDelete(e)
  const doRemove = async () => {
    if (!confirmDelete) return
    try {
      await api.delete(`/employees/${confirmDelete.id}`)
      toast.success('Funcionário eliminado')
      setConfirmDelete(null); load(search)
    } catch { toast.error('Erro ao eliminar') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Funcionários</h1>
          <p className="text-sm text-slate-500">Gestão de funcionários e dados salariais</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setInviteModal(true)}
            className="flex items-center gap-2 rounded-xl border border-primary px-4 py-2.5 text-sm font-semibold text-primary hover:bg-primary/5 transition">
            <Send size={15} /> Convidar por SMS
          </button>
          <button className="btn-primary" onClick={openCreate}><Plus size={18} /> Novo funcionário</button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Pesquisar por nome, função ou departamento..."
            value={search} onChange={(e) => { setSearch(e.target.value); load(e.target.value) }} />
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2">
            <span className="text-sm font-medium text-red-700">{selected.size} seleccionado(s)</span>
            <button onClick={() => setConfirmBulk(true)}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 transition">
              <Trash2 size={13} /> Apagar selecionados
            </button>
            <button onClick={() => setSelected(new Set())} className="text-xs text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
      </div>

      <Card>
        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyState message="Nenhum funcionário encontrado." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="w-10 px-4 py-3">
                    <button onClick={toggleAll} className="text-slate-400 hover:text-primary transition">
                      {selected.size === list.length && list.length > 0
                        ? <CheckSquare size={16} className="text-primary" />
                        : <Square size={16} />}
                    </button>
                  </th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Função</th>
                  <th className="px-4 py-3">Departamento</th>
                  <th className="px-4 py-3 text-right">Salário base</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((e) => (
                  <tr key={e.id} className={`hover:bg-slate-50 transition ${selected.has(e.id) ? 'bg-red-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleSelect(e.id)} className="text-slate-400 hover:text-primary transition">
                        {selected.has(e.id)
                          ? <CheckSquare size={16} className="text-primary" />
                          : <Square size={16} />}
                      </button>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-700">{e.full_name}</td>
                    <td className="px-4 py-3 text-slate-500">{e.position ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-500">{e.department ?? '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{money(e.base_salary)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${e.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {e.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => navigate(`/app/funcionarios/${e.id}`)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary" title="Ver detalhe"><Eye size={16} /></button>
                        <button onClick={() => openEdit(e)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary" title="Editar"><Pencil size={16} /></button>
                        <button onClick={() => remove(e)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Eliminar"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Wizard de criação */}
      {wizard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="flex h-full max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <EmployeeWizard
              onDone={() => { setWizard(false); load(search) }}
              onCancel={() => setWizard(false)}
            />
          </div>
        </div>
      )}

      {/* Modal de edição */}
      <Modal open={modal} onClose={() => setModal(false)} title="Editar funcionário" wide>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nome completo</label>
            <input className="input" {...form.register('full_name')} />
            {form.formState.errors.full_name && <p className="mt-1 text-xs text-red-600">{form.formState.errors.full_name.message}</p>}
          </div>
          <div><label className="label">BI / NIF</label><input className="input" {...form.register('bi_nif')} /></div>
          <div><label className="label">ID biométrico</label><input className="input" placeholder="Nº no terminal de ponto" {...form.register('biometric_id')} /></div>
          <div>
            <label className="label">Função</label>
            <input className="input" list="positions-list" {...form.register('position')} placeholder="Seleccione ou escreva…" />
            <datalist id="positions-list">{empOptions.positions.map(p => <option key={p} value={p} />)}</datalist>
          </div>
          <div>
            <label className="label">Departamento</label>
            <input className="input" list="departments-list" {...form.register('department')} placeholder="Seleccione ou escreva…" />
            <datalist id="departments-list">{empOptions.departments.map(d => <option key={d} value={d} />)}</datalist>
          </div>
          <div><label className="label">Banco</label><input className="input" {...form.register('bank_name')} /></div>
          <div><label className="label">Nº de conta</label><input className="input" {...form.register('account_number')} /></div>
          <div><label className="label">IBAN</label><input className="input" {...form.register('iban')} /></div>
          <div><label className="label">Salário base (AOA)</label><input type="number" step="0.01" className="input" {...form.register('base_salary', { valueAsNumber: true })} /></div>
          <div><label className="label">Subsídio alimentação</label><input type="number" step="0.01" className="input" {...form.register('food_allowance', { valueAsNumber: true })} /></div>
          <div><label className="label">Subsídio transporte</label><input type="number" step="0.01" className="input" {...form.register('transport_allowance', { valueAsNumber: true })} /></div>
          <div><label className="label">Taxa Seg. Social (%)</label><input type="number" step="0.01" className="input" {...form.register('social_security_rate', { valueAsNumber: true })} /></div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600">
            <input type="checkbox" {...form.register('active')} className="h-4 w-4 rounded border-slate-300 text-primary" /> Ativo
          </label>
          <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary" disabled={form.formState.isSubmitting}>Guardar</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!confirmDelete}
        title="Eliminar funcionário"
        message={`Tem a certeza que quer eliminar "${confirmDelete?.full_name}"? Esta ação é permanente.`}
        danger confirmLabel="Eliminar"
        onConfirm={doRemove} onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmModal
        open={confirmBulk}
        title={`Eliminar ${selected.size} funcionário(s)`}
        message={`Tem a certeza que quer eliminar ${selected.size} funcionário(s) seleccionado(s)? Esta ação é permanente e não pode ser revertida.`}
        danger confirmLabel={deletingBulk ? 'A eliminar…' : `Eliminar ${selected.size}`}
        onConfirm={doBulkDelete} onCancel={() => setConfirmBulk(false)}
      />

      {/* Modal — Convidar por SMS */}
      <Modal open={inviteModal} onClose={() => setInviteModal(false)} title="Convidar funcionário por SMS">
        <form onSubmit={sendInvite} className="space-y-4">
          <p className="text-sm text-slate-500">
            O candidato recebe um SMS com o link de registo. Após preencher os dados,
            o pedido aparece em <strong>Pedidos de Admissão</strong> para aprovação.
          </p>
          <div>
            <label className="label">Número de telefone *</label>
            <input className="input" value={invitePhone} onChange={e => setInvitePhone(e.target.value)}
              placeholder="+244 9XX XXX XXX" required autoFocus />
          </div>
          <div>
            <label className="label">Nome <span className="text-slate-400">(opcional)</span></label>
            <input className="input" value={inviteName} onChange={e => setInviteName(e.target.value)}
              placeholder="Ex: João Silva" />
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <p className="font-medium text-slate-600 mb-1">SMS que será enviado</p>
            <p>
              {inviteName ? `Olá ${inviteName}! ` : 'Olá! '}
              Foi convidado(a) a registar-se em <strong>{tenantName}</strong>. Preencha o seu perfil em: …/admissao/<span className="font-mono text-primary">{getTenant()}</span>
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-outline" onClick={() => setInviteModal(false)}>Cancelar</button>
            <button type="submit" disabled={inviting} className="btn-primary flex items-center gap-2">
              <Send size={15} />{inviting ? 'A enviar…' : 'Enviar convite'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

