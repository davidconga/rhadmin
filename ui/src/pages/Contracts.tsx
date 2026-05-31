import { useEffect, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, FileText, Search, ChevronDown, Eye, Download } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { Card, Modal, Spinner, EmptyState, ConfirmModal } from '../components/ui'
import type { Employee, Paginated } from '../types'

interface Contract {
  id: number
  employee_id: number
  employee?: { id: number; full_name: string }
  type: 'indeterminado' | 'prazo_certo' | 'prestacao_servicos'
  title?: string
  position?: string
  department?: string
  base_salary: string
  food_allowance: string
  transport_allowance: string
  start_date: string
  end_date?: string
  status: 'active' | 'suspended' | 'terminated' | 'expired'
  notes?: string
}

const TYPE_LABEL: Record<Contract['type'], string> = {
  indeterminado: 'Prazo Indeterminado',
  prazo_certo: 'Prazo Certo',
  prestacao_servicos: 'Prestação de Serviços',
}

const STATUS_STYLE: Record<Contract['status'], string> = {
  active:     'bg-green-100 text-green-700',
  suspended:  'bg-amber-100 text-amber-700',
  terminated: 'bg-red-100 text-red-700',
  expired:    'bg-slate-100 text-slate-500',
}

const STATUS_LABEL: Record<Contract['status'], string> = {
  active: 'Activo', suspended: 'Suspenso', terminated: 'Rescindido', expired: 'Expirado',
}

interface ContractForm {
  employee_id: string; type: Contract['type']; title: string; position: string; department: string
  base_salary: string; food_allowance: string; transport_allowance: string
  start_date: string; end_date: string; status: Contract['status']; notes: string
}

const EMPTY_FORM: ContractForm = {
  employee_id: '', type: 'indeterminado', title: '', position: '', department: '',
  base_salary: '', food_allowance: '0', transport_allowance: '0',
  start_date: '', end_date: '', status: 'active', notes: '',
}

function SearchableSelect({ value, onChange, options, placeholder = 'Escrever ou seleccionar…' }: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = value
    ? options.filter(o => o.toLowerCase().includes(value.toLowerCase()))
    : options

  return (
    <div ref={ref} className="relative">
      <input
        className="input"
        value={value}
        placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
      />
      {open && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow-lg text-sm">
          {filtered.length > 0 ? filtered.map(o => (
            <li key={o}
              className="cursor-pointer px-3 py-2 hover:bg-primary/5 hover:text-primary"
              onMouseDown={() => { onChange(o); setOpen(false) }}>
              {o}
            </li>
          )) : (
            <li className="px-3 py-2 text-slate-400 italic">Sem sugestões — escreva livremente</li>
          )}
        </ul>
      )}
    </div>
  )
}

export default function Contracts() {
  const [list, setList] = useState<Contract[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [options, setOptions] = useState<{ positions: string[]; departments: string[] }>({ positions: [], departments: [] })
  const [departments, setDepartments] = useState<string[]>([])
  const [allPositions, setAllPositions] = useState<{ name: string; department?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<Contract | null>(null)
  const [form, setForm] = useState<ContractForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<Contract | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [pdfPreview, setPdfPreview] = useState<{ url: string; filename: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [cr, em] = await Promise.all([
        api.get<Paginated<Contract>>('/contracts', { params: { per_page: 50, status: statusFilter || undefined } }),
        api.get<Paginated<Employee>>('/employees', { params: { per_page: 200 } }),
      ])
      setList(cr.data.data)
      setEmployees(em.data.data)
      api.get<{ positions: string[]; departments: string[] }>('/employees/options')
        .then(r => setOptions(r.data)).catch(() => {})
      api.get<{ data: { name: string }[] }>('/departments', { params: { per_page: 100 } })
        .then(r => setDepartments(r.data.data.map(d => d.name))).catch(() => {})
      api.get<{ data: { name: string; department?: string }[] }>('/positions', { params: { per_page: 100 } })
        .then(r => setAllPositions(r.data.data)).catch(() => {})
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [statusFilter])

  const filtered = list.filter(c =>
    !search || c.employee?.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.title ?? '').toLowerCase().includes(search.toLowerCase())
  )

  const openCreate = () => { setEditing(null); setForm(EMPTY_FORM); setModal(true) }
  const openEdit = (c: Contract) => {
    setEditing(c)
    setForm({
      employee_id: String(c.employee_id), type: c.type, title: c.title ?? '',
      position: c.position ?? '', department: c.department ?? '',
      base_salary: c.base_salary, food_allowance: c.food_allowance,
      transport_allowance: c.transport_allowance,
      start_date: c.start_date?.split('T')[0] ?? '',
      end_date: c.end_date?.split('T')[0] ?? '',
      status: c.status, notes: c.notes ?? '',
    })
    setModal(true)
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.employee_id) { toast.error('Seleccione um funcionário'); return }
    if (!form.start_date) { toast.error('Data de início é obrigatória'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        employee_id: Number(form.employee_id),
        base_salary: Number(form.base_salary) || 0,
        food_allowance: Number(form.food_allowance) || 0,
        transport_allowance: Number(form.transport_allowance) || 0,
        end_date: form.end_date || undefined,
      }
      if (editing) {
        await api.put(`/contracts/${editing.id}`, payload)
        toast.success('Contrato actualizado')
      } else {
        await api.post('/contracts', payload)
        toast.success('Contrato criado')
      }
      setModal(false); load()
    } catch { toast.error('Erro ao guardar') } finally { setSaving(false) }
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    try {
      await api.delete(`/contracts/${confirmDelete.id}`)
      toast.success('Contrato eliminado')
      setConfirmDelete(null); load()
    } catch { toast.error('Erro ao eliminar') }
  }

  const previewContract = async (c: Contract) => {
    try {
      const res = await api.get(`/contracts/${c.id}/generate-pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      const name = `contrato-${c.employee?.full_name?.toLowerCase().replace(/\s+/g, '-')}-${c.id}.pdf`
      setPdfPreview({ url, filename: name })
    } catch { toast.error('Erro ao gerar contrato') }
  }

  const set = (k: keyof ContractForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Contratos</h1>
          <p className="text-sm text-slate-500">Gestão de contratos de trabalho</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Novo contrato
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className="input pl-9" placeholder="Pesquisar funcionário…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="relative">
          <select className="input appearance-none pr-8" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
            <option value="">Todos os estados</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? <div className="flex justify-center py-12"><Spinner /></div>
        : filtered.length === 0 ? (
          <EmptyState title="Sem contratos" description="Crie o primeiro contrato com o botão acima." />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="px-5 py-3 text-left">Funcionário</th>
                <th className="px-4 py-3 text-left">Tipo</th>
                <th className="px-4 py-3 text-left">Início</th>
                <th className="px-4 py-3 text-left">Fim</th>
                <th className="px-4 py-3 text-left">Salário base</th>
                <th className="px-4 py-3 text-left">Estado</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-50 transition">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-slate-800">{c.employee?.full_name ?? '—'}</p>
                    {c.position && <p className="text-xs text-slate-400">{c.position}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-slate-600">{TYPE_LABEL[c.type]}</td>
                  <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap">{c.start_date?.split('T')[0] ?? '—'}</td>
                  <td className="px-4 py-3.5 text-slate-400 whitespace-nowrap">{c.end_date?.split('T')[0] ?? '—'}</td>
                  <td className="px-4 py-3.5 font-mono text-slate-700">
                    {Number(c.base_salary).toLocaleString('pt-PT')} AOA
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLE[c.status]}`}>
                      {STATUS_LABEL[c.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => previewContract(c)} title="Ver contrato PDF" className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => openEdit(c)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => setConfirmDelete(c)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {/* Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar contrato' : 'Novo contrato'} wide>
        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Funcionário *</label>
            <select className="input" value={form.employee_id} onChange={set('employee_id')} required>
              <option value="">Seleccionar…</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tipo de contrato</label>
            <select className="input" value={form.type} onChange={set('type')}>
              {Object.entries(TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Estado</label>
            <select className="input" value={form.status} onChange={set('status')}>
              {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Título (opcional)</label>
            <input className="input" value={form.title} onChange={set('title')} placeholder="Ex: Contrato de admissão…" />
          </div>
          <div>
            <label className="label">Departamento</label>
            <SearchableSelect
              value={form.department}
              onChange={v => setForm(f => ({ ...f, department: v, position: '' }))}
              options={[...new Set([...departments, ...options.departments])]}
              placeholder="Ex: Recursos Humanos…"
            />
          </div>
          <div>
            <label className="label">Função / Cargo</label>
            <SearchableSelect
              value={form.position}
              onChange={v => setForm(f => ({ ...f, position: v }))}
              options={[...new Set([
                ...allPositions
                  .filter(p => !form.department || p.department === form.department)
                  .map(p => p.name),
                ...options.positions,
              ])]}
              placeholder={form.department ? `Cargos de ${form.department}…` : 'Seleccione primeiro o departamento…'}
            />
          </div>
          <div>
            <label className="label">Data de início *</label>
            <input type="date" className="input" value={form.start_date} onChange={set('start_date')} required />
          </div>
          <div>
            <label className="label">Data de fim <span className="text-slate-400">(prazo certo)</span></label>
            <input type="date" className="input" value={form.end_date} onChange={set('end_date')} />
          </div>
          <div>
            <label className="label">Salário base (AOA) *</label>
            <input type="number" step="0.01" className="input" value={form.base_salary} onChange={set('base_salary')} required />
          </div>
          <div>
            <label className="label">Subsídio alimentação</label>
            <input type="number" step="0.01" className="input" value={form.food_allowance} onChange={set('food_allowance')} />
          </div>
          <div>
            <label className="label">Subsídio transporte</label>
            <input type="number" step="0.01" className="input" value={form.transport_allowance} onChange={set('transport_allowance')} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Notas / Cláusulas especiais</label>
            <textarea className="input" rows={3} value={form.notes} onChange={set('notes')} />
          </div>
          <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
            <button type="button" className="btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              <FileText size={15} className="mr-1.5 inline" />{saving ? 'A guardar…' : 'Guardar contrato'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!confirmDelete} title="Eliminar contrato"
        message={`Tem a certeza que quer eliminar o contrato de "${confirmDelete?.employee?.full_name}"?`}
        danger confirmLabel="Eliminar" onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} />

      {pdfPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-2.5">
            <span className="text-sm font-medium text-slate-200">{pdfPreview.filename}</span>
            <div className="flex items-center gap-2">
              <a href={pdfPreview.url} download={pdfPreview.filename}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90">
                <Download size={13} /> Descarregar
              </a>
              <button onClick={() => { URL.revokeObjectURL(pdfPreview.url); setPdfPreview(null) }}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-white">
                Fechar
              </button>
            </div>
          </div>
          <iframe src={pdfPreview.url} className="flex-1 w-full" title="Contrato PDF" />
        </div>
      )}
    </div>
  )
}
