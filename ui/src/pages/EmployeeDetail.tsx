import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Pencil, User as UserIcon, Banknote, Building2, ReceiptText, TrendingUp, Gift, Wallet, Camera, FileText, PenLine, Users as UsersIcon, KeyRound, ShieldCheck, ShieldOff, Link, Star, Plus, Trash2, ChevronDown, ChevronUp, Award, ArrowUpCircle, RefreshCw, BookOpen, AlertTriangle, MoreHorizontal } from 'lucide-react'
import { toast } from 'sonner'
import { api, getTenant } from '../lib/api'
import { money, monthName } from '../lib/format'
import { Card, Modal, Spinner, ConfirmModal } from '../components/ui'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Employee, SalarySlip, Paginated, User } from '../types'

// ---------- schema ----------
const schema = z.object({
  full_name: z.string().min(2),
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

interface Contract {
  id: number; type: string; title?: string; position?: string
  base_salary: string; start_date: string; end_date?: string; status: string
}

interface FamilyMember {
  id: number; full_name: string; relationship: string; bi_nif?: string; date_of_birth?: string
}

const TYPE_LABEL: Record<string, string> = {
  indeterminado: 'Prazo Indeterminado', prazo_certo: 'Prazo Certo', prestacao_servicos: 'Prestação de Serviços',
}
const CONTRACT_STATUS: Record<string, string> = {
  active: 'bg-green-100 text-green-700', suspended: 'bg-amber-100 text-amber-700',
  terminated: 'bg-red-100 text-red-700', expired: 'bg-slate-100 text-slate-500',
}

// Signature Pad (reutilizável)
function SignaturePad({ employeeId, existing }: { employeeId: number; existing: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [saved, setSaved] = useState(false)
  const [sigUrl, setSigUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!existing) return
    api.get(`/employees/${employeeId}/signature`, { responseType: 'blob' })
      .then(r => setSigUrl(URL.createObjectURL(r.data)))
      .catch(() => {})
  }, [employeeId, existing])

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const src = 'touches' in e ? e.touches[0] : e
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY }
  }
  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e); ctx.beginPath(); ctx.moveTo(x, y)
  }
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b'
    ctx.lineTo(x, y); ctx.stroke()
  }
  const stop = () => { drawing.current = false }
  const clear = () => canvasRef.current!.getContext('2d')!.clearRect(0, 0, 500, 160)
  const save = async () => {
    const dataUrl = canvasRef.current!.toDataURL('image/png')
    try {
      await api.post(`/employees/${employeeId}/signature`, { signature: dataUrl })
      toast.success('Assinatura guardada')
      setSaved(true); setSigUrl(dataUrl)
    } catch { toast.error('Erro ao guardar assinatura') }
  }

  return (
    <div className="space-y-3">
      {existing && !saved && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
          {sigUrl && <img src={sigUrl} alt="Assinatura actual" className="mx-auto max-h-16 opacity-70" />}
          <p className="mt-1 text-xs text-slate-400">Assinatura actual — desenhe abaixo para substituir</p>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
        <canvas ref={canvasRef} width={500} height={160} className="w-full cursor-crosshair touch-none"
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop} />
      </div>
      <div className="flex justify-between">
        <button type="button" onClick={clear} className="text-sm text-slate-500 hover:text-slate-700">Limpar</button>
        <button type="button" onClick={save}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition">
          <PenLine size={14} /> Guardar assinatura
        </button>
      </div>
    </div>
  )
}

const TABS = [
  { key: 'dados',       label: 'Dados',       icon: UserIcon },
  { key: 'subsidios',   label: 'Subsídios',   icon: Wallet },
  { key: 'vencimentos', label: 'Vencimentos', icon: ReceiptText },
  { key: 'contratos',   label: 'Contratos',   icon: FileText },
  { key: 'familia',     label: 'Família',     icon: UsersIcon },
  { key: 'assinatura',  label: 'Assinatura',  icon: PenLine },
  { key: 'portal',      label: 'Portal',      icon: KeyRound },
  { key: 'desempenho',  label: 'Desempenho',  icon: TrendingUp },
  { key: 'carreira',    label: 'Carreira',    icon: Gift },
] as const
type TabKey = typeof TABS[number]['key']

export default function EmployeeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('dados')
  const [editModal, setEditModal] = useState(false)
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const [contracts, setContracts] = useState<Contract[]>([])
  const [family, setFamily] = useState<FamilyMember[]>([])

  const loadPhoto = async (empId: number | string) => {
    try {
      const res = await api.get(`/employees/${empId}/photo`, { responseType: 'blob' })
      setPhotoUrl(URL.createObjectURL(res.data))
    } catch {
      setPhotoUrl(null)
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get<Employee & { familyMembers?: FamilyMember[] }>(`/employees/${id}`)
      setEmployee(data)
      if (data.familyMembers) setFamily(data.familyMembers)
      loadPhoto(id!)
      api.get<Contract[]>(`/contracts?employee_id=${id}&per_page=50`).then(r => setContracts((r.data as unknown as { data: Contract[] }).data ?? [])).catch(() => {})
    } catch {
      toast.error('Funcionário não encontrado')
      navigate('/app/funcionarios')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [id])

  const uploadPhoto = async (file: File) => {
    const fd = new FormData()
    fd.append('photo', file)
    try {
      await api.post(`/employees/${id}/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Foto atualizada')
      loadPhoto(id!)
    } catch {
      toast.error('Erro ao carregar foto (PNG/JPG/WEBP até 2 MB)')
    }
  }

  const form = useForm<FormData>({ resolver: zodResolver(schema) })

  const openEdit = () => {
    if (!employee) return
    form.reset({
      full_name: employee.full_name,
      bi_nif: employee.bi_nif ?? '',
      biometric_id: employee.biometric_id ?? '',
      position: employee.position ?? '',
      department: employee.department ?? '',
      bank_name: employee.bank_name ?? '',
      account_number: employee.account_number ?? '',
      iban: employee.iban ?? '',
      base_salary: Number(employee.base_salary),
      food_allowance: Number(employee.food_allowance),
      transport_allowance: Number(employee.transport_allowance),
      social_security_rate: Number(employee.social_security_rate),
      active: employee.active,
    })
    setEditModal(true)
  }

  const onSubmit = async (data: FormData) => {
    try {
      await api.put(`/employees/${id}`, data)
      toast.success('Funcionário atualizado')
      setEditModal(false)
      load()
    } catch {
      toast.error('Erro ao guardar')
    }
  }

  if (loading) return <div className="flex h-64 items-center justify-center"><Spinner /></div>
  if (!employee) return null

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/app/funcionarios')} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-1 items-center gap-4">
          <button
            className="group relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-full border-2 border-slate-200"
            onClick={() => photoRef.current?.click()}
            title="Clique para alterar a foto"
          >
            {photoUrl ? (
              <img src={photoUrl} alt={employee.full_name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary/10 font-heading text-xl font-bold text-primary">
                {employee.full_name.charAt(0)}
              </div>
            )}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100">
              <Camera size={18} className="text-white" />
            </div>
          </button>
          <input
            ref={photoRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }}
          />
          <div>
            <h1 className="font-heading text-2xl font-bold text-primary">{employee.full_name}</h1>
            <p className="text-sm text-slate-500">
              {employee.position ?? '—'}{employee.department ? ` · ${employee.department}` : ''}
            </p>
          </div>
          <span className={`ml-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${employee.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
            {employee.active ? 'Ativo' : 'Inativo'}
          </span>
        </div>
        <button className="btn-primary" onClick={openEdit}><Pencil size={16} /> Editar</button>
      </div>

      {/* Abas */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px ${
              tab === key
                ? 'border-primary text-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      {tab === 'dados'       && <TabDados employee={employee} />}
      {tab === 'subsidios'   && <TabSubsidios employee={employee} />}
      {tab === 'vencimentos' && <TabVencimentos employeeId={employee.id} />}

      {tab === 'contratos' && (
        <Card className="overflow-hidden">
          {contracts.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              Sem contratos. <a href="/app/contratos" className="text-primary hover:underline">Criar contrato</a>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left">Tipo</th>
                  <th className="px-4 py-3 text-left">Início</th>
                  <th className="px-4 py-3 text-left">Fim</th>
                  <th className="px-4 py-3 text-left">Salário base</th>
                  <th className="px-4 py-3 text-left">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contracts.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{TYPE_LABEL[c.type] ?? c.type}</td>
                    <td className="px-4 py-3 text-slate-600">{c.start_date?.split('T')[0]}</td>
                    <td className="px-4 py-3 text-slate-400">{c.end_date?.split('T')[0] ?? '—'}</td>
                    <td className="px-4 py-3 font-mono">{Number(c.base_salary).toLocaleString('pt-PT')} AOA</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${CONTRACT_STATUS[c.status] ?? ''}`}>
                        {c.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'familia' && (
        <Card className="overflow-hidden">
          {family.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">Sem membros do agregado familiar registados.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-5 py-3 text-left">Nome</th>
                  <th className="px-4 py-3 text-left">Parentesco</th>
                  <th className="px-4 py-3 text-left">Data Nasc.</th>
                  <th className="px-4 py-3 text-left">BI / NIF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {family.map(m => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{m.full_name}</td>
                    <td className="px-4 py-3 text-slate-600">{m.relationship}</td>
                    <td className="px-4 py-3 text-slate-400">{m.date_of_birth?.split('T')[0] ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-slate-500">{m.bi_nif ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {tab === 'assinatura' && (
        <Card className="p-6 space-y-4 max-w-lg">
          <div>
            <h3 className="font-semibold text-slate-800">Assinatura do funcionário</h3>
            <p className="mt-1 text-sm text-slate-500">Usada para validar documentos. Pode ser registada pelo próprio via Portal ou pelo RH aqui.</p>
          </div>
          <SignaturePad employeeId={employee.id} existing={!!employee.signature_path} />
        </Card>
      )}

      {tab === 'portal'      && <TabPortal employee={employee} onRefresh={load} />}
      {tab === 'desempenho'  && <TabDesempenho employeeId={employee.id} />}
      {tab === 'carreira'    && <TabCarreira employee={employee} onRefresh={load} />}

      {/* Modal de edição */}
      <Modal open={editModal} onClose={() => setEditModal(false)} title="Editar funcionário" wide>
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">Nome completo</label>
            <input className="input" {...form.register('full_name')} />
          </div>
          <div><label className="label">BI / NIF</label><input className="input" {...form.register('bi_nif')} /></div>
          <div><label className="label">ID biométrico</label><input className="input" {...form.register('biometric_id')} /></div>
          <div><label className="label">Função</label><input className="input" {...form.register('position')} /></div>
          <div><label className="label">Departamento</label><input className="input" {...form.register('department')} /></div>
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
            <button type="button" className="btn-outline" onClick={() => setEditModal(false)}>Cancelar</button>
            <button className="btn-primary" disabled={form.formState.isSubmitting}>Guardar</button>
          </div>
        </form>
      </Modal>
    </div>
  )
}

// ─── Aba: Dados ───────────────────────────────────────────────
function TabDados({ employee: e }: { employee: Employee }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="space-y-0">
        <SectionHeader icon={<UserIcon size={14} />} title="Identificação" />
        <Row label="Nome completo" value={e.full_name} />
        <Row label="BI / NIF" value={e.bi_nif} />
        <Row label="ID biométrico" value={e.biometric_id} />
        <Row label="Foto" value={e.photo_path ? 'Carregada' : 'Sem foto'} />
      </Card>
      <Card className="space-y-0">
        <SectionHeader icon={<Building2 size={14} />} title="Organização" />
        <Row label="Função" value={e.position} />
        <Row label="Departamento" value={e.department} />
      </Card>
      <Card className="space-y-0 sm:col-span-2">
        <SectionHeader icon={<Banknote size={14} />} title="Dados bancários" />
        <div className="grid sm:grid-cols-3">
          <Row label="Banco" value={e.bank_name} />
          <Row label="Nº de conta" value={e.account_number} />
          <Row label="IBAN" value={e.iban} mono />
        </div>
      </Card>
    </div>
  )
}

// ─── Aba: Subsídios ───────────────────────────────────────────
function TabSubsidios({ employee: e }: { employee: Employee }) {
  const items = [
    { label: 'Salário base', value: money(e.base_salary), highlight: true },
    { label: 'Subsídio de alimentação', value: money(e.food_allowance) },
    { label: 'Subsídio de transporte', value: money(e.transport_allowance) },
    {
      label: 'Total bruto',
      value: money(Number(e.base_salary) + Number(e.food_allowance) + Number(e.transport_allowance)),
      highlight: true,
    },
    { label: 'Taxa INSS (funcionário)', value: `${e.social_security_rate} %` },
    {
      label: 'Desconto INSS',
      value: money(Number(e.base_salary) * Number(e.social_security_rate) / 100),
    },
  ]
  return (
    <Card>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-4 py-3">Rubrica</th>
            <th className="px-4 py-3 text-right">Valor</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map(({ label, value, highlight }) => (
            <tr key={label} className={highlight ? 'bg-slate-50' : ''}>
              <td className={`px-4 py-3 ${highlight ? 'font-semibold text-slate-700' : 'text-slate-600'}`}>{label}</td>
              <td className={`px-4 py-3 text-right font-mono ${highlight ? 'font-bold text-primary' : 'text-slate-700'}`}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  )
}

// ─── Aba: Vencimentos ─────────────────────────────────────────
function TabVencimentos({ employeeId }: { employeeId: number }) {
  const [slips, setSlips] = useState<SalarySlip[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      try {
        const { data } = await api.get<Paginated<SalarySlip>>('/salary-slips', {
          params: { employee_id: employeeId, per_page: 100 },
        })
        setSlips(data.data)
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [employeeId])

  const statusLabel: Record<string, string> = { draft: 'Rascunho', issued: 'Emitido', paid: 'Pago' }
  const statusClass: Record<string, string> = {
    draft: 'bg-slate-100 text-slate-500',
    issued: 'bg-blue-100 text-blue-700',
    paid: 'bg-green-100 text-green-700',
  }

  return (
    <Card>
      {loading ? <Spinner /> : slips.length === 0 ? (
        <p className="p-10 text-center text-sm text-slate-400">Nenhum recibo de salário encontrado.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Período</th>
                <th className="px-4 py-3 text-right">Salário bruto</th>
                <th className="px-4 py-3 text-right">Deduções</th>
                <th className="px-4 py-3 text-right">Líquido</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slips.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{monthName(s.month)} {s.year}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-700">{money(s.gross_salary)}</td>
                  <td className="px-4 py-3 text-right font-mono text-red-600">-{money(s.total_deductions)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-primary">{money(s.net_salary)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass[s.status] ?? ''}`}>
                      {statusLabel[s.status] ?? s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

// ─── Aba: Portal ──────────────────────────────────────────────
function TabPortal({ employee, onRefresh }: { employee: Employee; onRefresh: () => void }) {
  const hasAccount = !!employee.user_id
  const [mode, setMode] = useState<'create' | 'link'>('create')
  const [busy, setBusy] = useState(false)

  // formulário criar conta
  const [createEmail, setCreateEmail] = useState(employee.email ?? '')
  const [createPassword, setCreatePassword] = useState('')

  // formulário associar utilizador existente
  const [users, setUsers] = useState<User[]>([])
  const suggestedUser = users.find(u => u.email === employee.email) ?? null
  const [linkUserId, setLinkUserId] = useState('')

  useEffect(() => {
    if (!hasAccount) {
      api.get<User[]>('/users').then(r => {
        setUsers(r.data)
        const match = r.data.find(u => u.email === employee.email)
        if (match) {
          setLinkUserId(String(match.id))
          setMode('link')
        }
      }).catch(() => {})
    }
  }, [])

  // formulário reset de senha
  const [newPassword, setNewPassword] = useState('')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post(`/employees/${employee.id}/portal-account`, { email: createEmail, password: createPassword })
      toast.success('Conta de portal criada com sucesso.')
      onRefresh()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao criar conta.')
    } finally {
      setBusy(false)
    }
  }

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post(`/employees/${employee.id}/link-user`, { user_id: Number(linkUserId) })
      toast.success('Utilizador associado com sucesso.')
      onRefresh()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao associar utilizador.')
    } finally {
      setBusy(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post(`/employees/${employee.id}/reset-portal-password`, { password: newPassword })
      toast.success('Senha redefinida com sucesso.')
      setNewPassword('')
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao redefinir senha.')
    } finally {
      setBusy(false)
    }
  }

  const portalUrl = `${window.location.origin}/portal`
  const tenantSlug = getTenant()

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast.success(`${label} copiado!`))
  }

  if (hasAccount) {
    return (
      <Card className="p-6 max-w-lg space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
            <ShieldCheck size={20} className="text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">Conta de portal activa</p>
            <p className="text-sm text-slate-500">Funcionário tem acesso ao portal de auto-serviço</p>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3 text-sm">
          <p className="font-medium text-slate-700 text-xs uppercase tracking-wide">Dados de acesso para partilhar</p>
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-slate-400 text-xs">URL do Portal</span>
              <p className="font-mono text-slate-700">{portalUrl}</p>
            </div>
            <button type="button" onClick={() => copyToClipboard(portalUrl, 'URL')}
              className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-primary" title="Copiar URL">
              <FileText size={14} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="text-slate-400 text-xs">Código da Organização</span>
              <p className="font-mono text-slate-700">{tenantSlug}</p>
            </div>
            <button type="button" onClick={() => copyToClipboard(tenantSlug, 'Código')}
              className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-primary" title="Copiar código">
              <FileText size={14} />
            </button>
          </div>
          {employee.email && (
            <div className="flex items-center justify-between gap-2">
              <div>
                <span className="text-slate-400 text-xs">Email de acesso</span>
                <p className="font-mono text-slate-700">{employee.email}</p>
              </div>
              <button type="button" onClick={() => copyToClipboard(employee.email!, 'Email')}
                className="shrink-0 rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-primary" title="Copiar email">
                <FileText size={14} />
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleResetPassword} className="space-y-3">
          <label className="label">Redefinir senha</label>
          <input
            className="input"
            type="password"
            placeholder="Mínimo 6 caracteres"
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            minLength={6}
            required
          />
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner /> : 'Redefinir senha'}
          </button>
        </form>
      </Card>
    )
  }

  return (
    <Card className="p-6 max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
          <ShieldOff size={20} className="text-slate-400" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">Sem acesso ao portal</p>
          <p className="text-sm text-slate-500">Crie uma conta ou associe um utilizador existente.</p>
        </div>
      </div>

      {suggestedUser && (
        <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
          <Link size={15} className="shrink-0 text-amber-500" />
          <span className="text-amber-800">
            Utilizador <strong>{suggestedUser.email}</strong> encontrado — já pré-seleccionado abaixo.
          </span>
        </div>
      )}

      <div className="flex gap-2 rounded-lg border border-slate-200 p-1">
        <button
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${mode === 'create' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setMode('create')}
        >
          Criar conta
        </button>
        <button
          className={`flex-1 rounded-md py-1.5 text-sm font-medium transition ${mode === 'link' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setMode('link')}
        >
          Associar existente
        </button>
      </div>

      {mode === 'create' && (
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={createEmail} onChange={e => setCreateEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Senha</label>
            <input className="input" type="password" placeholder="Mínimo 6 caracteres" value={createPassword} onChange={e => setCreatePassword(e.target.value)} minLength={6} required />
          </div>
          <button className="btn-primary w-full" disabled={busy}>
            {busy ? <Spinner /> : 'Criar conta de portal'}
          </button>
        </form>
      )}

      {mode === 'link' && (
        <form onSubmit={handleLink} className="space-y-3">
          <div>
            <label className="label">Utilizador</label>
            <select className="input" value={linkUserId} onChange={e => setLinkUserId(e.target.value)} required>
              <option value="">— seleccionar —</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email}) · {u.role}
                </option>
              ))}
            </select>
          </div>
          <button className="btn-primary w-full" disabled={busy || !linkUserId}>
            {busy ? <Spinner /> : <><Link size={14} className="inline mr-1.5" />Associar utilizador</>}
          </button>
        </form>
      )}
    </Card>
  )
}

// ─── Placeholder ──────────────────────────────────────────────
function TabPlaceholder({ label }: { label: string }) {
  return (
    <Card>
      <div className="flex flex-col items-center gap-3 py-16 text-slate-400">
        <TrendingUp size={36} className="opacity-30" />
        <p className="text-sm">{label} — em breve</p>
      </div>
    </Card>
  )
}

// ─── Aba: Desempenho ──────────────────────────────────────────
const SCORE_COLOR = ['', 'text-red-500', 'text-orange-500', 'text-amber-500', 'text-blue-600', 'text-green-600']
const SCORE_LABEL = ['', 'Insuficiente', 'Necessita melhoria', 'Satisfatório', 'Bom', 'Excelente']
const REVIEW_TYPE_LABEL: Record<string, string> = { annual: 'Anual', semi_annual: 'Semestral', quarterly: 'Trimestral' }

function TabDesempenho({ employeeId }: { employeeId: number }) {
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)

  useEffect(() => {
    api.get(`/performance-reviews?employee_id=${employeeId}&per_page=50`)
      .then(r => setReviews(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [employeeId])

  const overallColor = (score?: string | null) => {
    if (!score) return 'text-slate-400'
    const n = parseFloat(score)
    if (n >= 4.5) return 'text-green-600'
    if (n >= 3.5) return 'text-blue-600'
    if (n >= 2.5) return 'text-amber-500'
    return 'text-red-500'
  }

  if (loading) return <Card><Spinner /></Card>
  if (!reviews.length) return <Card><div className="flex flex-col items-center gap-3 py-16 text-slate-400"><TrendingUp size={36} className="opacity-30" /><p className="text-sm">Sem avaliações registadas.</p></div></Card>

  return (
    <div className="space-y-3">
      {reviews.map(r => (
        <Card key={r.id} className="overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
            onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
            <div className="flex-1">
              <p className="font-medium text-slate-800">{REVIEW_TYPE_LABEL[r.period_type]} {r.period_number > 1 ? `${r.period_number}º · ` : ''}{r.period_year}</p>
              {r.reviewer && <p className="text-xs text-slate-400">Avaliador: {r.reviewer.name}</p>}
            </div>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${r.status === 'completed' ? 'bg-green-100 text-green-700' : r.status === 'in_progress' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-500'}`}>
              {r.status === 'completed' ? 'Concluída' : r.status === 'in_progress' ? 'Em avaliação' : 'Rascunho'}
            </span>
            {r.overall_score && (
              <div className={`font-heading text-xl font-bold ${overallColor(r.overall_score)}`}>
                {parseFloat(r.overall_score).toFixed(1)}
                <span className="text-xs text-slate-400 font-normal">/5</span>
              </div>
            )}
            {expanded === r.id ? <ChevronUp size={15} className="text-slate-400" /> : <ChevronDown size={15} className="text-slate-400" />}
          </div>

          {expanded === r.id && r.scores?.length > 0 && (
            <div className="border-t border-slate-100 bg-slate-50 px-4 py-4 space-y-3">
              {r.scores.map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 text-sm">
                  <span className="flex-1 text-slate-600">{s.criterion?.name}</span>
                  <div className="flex gap-0.5">
                    {[1,2,3,4,5].map(n => <Star key={n} size={12} className={n <= s.score ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />)}
                  </div>
                  <span className={`text-xs font-medium w-24 text-right ${SCORE_COLOR[s.score]}`}>{SCORE_LABEL[s.score]}</span>
                </div>
              ))}
              {r.reviewer_comments && (
                <p className="text-sm text-slate-600 border-t border-slate-200 pt-3">
                  <span className="font-medium">Comentário: </span>{r.reviewer_comments}
                </p>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

// ─── Aba: Carreira ────────────────────────────────────────────
const EVENT_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  promotion:   { label: 'Promoção',         color: 'bg-green-100 text-green-700 border-green-200',  icon: <ArrowUpCircle size={16} className="text-green-600" /> },
  transfer:    { label: 'Transferência',     color: 'bg-blue-100 text-blue-700 border-blue-200',    icon: <RefreshCw size={16} className="text-blue-600" /> },
  role_change: { label: 'Mudança de Cargo',  color: 'bg-purple-100 text-purple-700 border-purple-200', icon: <MoreHorizontal size={16} className="text-purple-600" /> },
  training:    { label: 'Formação',          color: 'bg-amber-100 text-amber-700 border-amber-200',  icon: <BookOpen size={16} className="text-amber-600" /> },
  award:       { label: 'Prémio / Louvor',   color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <Award size={16} className="text-yellow-600" /> },
  warning:     { label: 'Advertência',       color: 'bg-red-100 text-red-700 border-red-200',       icon: <AlertTriangle size={16} className="text-red-600" /> },
  other:       { label: 'Outro',             color: 'bg-slate-100 text-slate-600 border-slate-200', icon: <MoreHorizontal size={16} className="text-slate-500" /> },
}
const emptyEvent = { type: 'promotion', title: '', from_position: '', to_position: '', from_department: '', to_department: '', from_salary: '', to_salary: '', effective_date: '', description: '' }

function TabCarreira({ employee, onRefresh }: { employee: Employee; onRefresh: () => void }) {
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<typeof emptyEvent>(emptyEvent)
  const [editing, setEditing] = useState<number | null>(null)
  const [confirmDel, setConfirmDel] = useState<number | null>(null)

  const load = () => {
    api.get(`/employees/${employee.id}/career`)
      .then(r => setEvents(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [employee.id])

  const openCreate = () => { setForm({ ...emptyEvent, from_position: employee.position ?? '', from_department: employee.department ?? '' }); setEditing(null); setModal(true) }
  const openEdit = (e: any) => {
    setForm({ type: e.type, title: e.title ?? '', from_position: e.from_position ?? '', to_position: e.to_position ?? '', from_department: e.from_department ?? '', to_department: e.to_department ?? '', from_salary: e.from_salary ?? '', to_salary: e.to_salary ?? '', effective_date: e.effective_date ?? '', description: e.description ?? '' })
    setEditing(e.id); setModal(true)
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editing) await api.put(`/employees/${employee.id}/career/${editing}`, form)
      else await api.post(`/employees/${employee.id}/career`, form)
      toast.success('Evento guardado')
      setModal(false)
      load(); onRefresh()
    } catch { toast.error('Erro ao guardar') }
  }

  const doDelete = async () => {
    if (!confirmDel) return
    try {
      await api.delete(`/employees/${employee.id}/career/${confirmDel}`)
      toast.success('Eliminado')
      setConfirmDel(null); load()
    } catch { toast.error('Erro ao eliminar') }
  }

  if (loading) return <Card><Spinner /></Card>

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={openCreate}><Plus size={16} /> Adicionar evento</button>
      </div>

      {!events.length ? (
        <Card><div className="flex flex-col items-center gap-3 py-16 text-slate-400"><Gift size={36} className="opacity-30" /><p className="text-sm">Sem eventos de carreira registados.</p></div></Card>
      ) : (
        <div className="relative">
          <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-slate-200" />
          <div className="space-y-4">
            {events.map((ev: any) => {
              const cfg = EVENT_CONFIG[ev.type] ?? EVENT_CONFIG.other
              return (
                <div key={ev.id} className="relative pl-14">
                  <div className="absolute left-4 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-white border-2 border-slate-200">
                    {cfg.icon}
                  </div>
                  <Card className={`border ${cfg.color.split(' ')[2] ?? 'border-slate-200'}`}>
                    <div className="px-4 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                            {ev.title && <span className="font-semibold text-slate-800">{ev.title}</span>}
                            <span className="text-xs text-slate-400">{new Date(ev.effective_date).toLocaleDateString('pt-PT')}</span>
                          </div>
                          {(ev.from_position || ev.to_position) && (
                            <p className="mt-1.5 text-sm text-slate-600">
                              {ev.from_position && <span className="line-through text-slate-400">{ev.from_position}</span>}
                              {ev.from_position && ev.to_position && <span className="mx-2 text-slate-300">→</span>}
                              {ev.to_position && <span className="font-medium">{ev.to_position}</span>}
                            </p>
                          )}
                          {(ev.from_department || ev.to_department) && (
                            <p className="text-xs text-slate-500">
                              {ev.from_department && <span>{ev.from_department}</span>}
                              {ev.from_department && ev.to_department && <span className="mx-1.5">→</span>}
                              {ev.to_department && <span>{ev.to_department}</span>}
                            </p>
                          )}
                          {ev.from_salary && ev.to_salary && (
                            <p className="text-xs text-slate-500 mt-0.5">
                              {Number(ev.from_salary).toLocaleString('pt-PT')} AOA → <span className="font-medium text-green-700">{Number(ev.to_salary).toLocaleString('pt-PT')} AOA</span>
                            </p>
                          )}
                          {ev.description && <p className="mt-1.5 text-sm text-slate-500">{ev.description}</p>}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => openEdit(ev)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary"><Pencil size={13} /></button>
                          <button onClick={() => setConfirmDel(ev.id)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 size={13} /></button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editing ? 'Editar evento' : 'Novo evento de carreira'}>
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Tipo *</label>
              <select className="input" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                {Object.entries(EVENT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Data efectiva *</label>
              <input type="date" className="input" value={form.effective_date} onChange={e => setForm({ ...form, effective_date: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="label">Título / Descrição breve</label>
            <input className="input" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Ex: Promoção a Técnico Sénior" />
          </div>
          {['promotion', 'role_change', 'transfer'].includes(form.type) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Cargo anterior</label>
                <input className="input" value={form.from_position} onChange={e => setForm({ ...form, from_position: e.target.value })} />
              </div>
              <div>
                <label className="label">Cargo novo</label>
                <input className="input" value={form.to_position} onChange={e => setForm({ ...form, to_position: e.target.value })} />
              </div>
              <div>
                <label className="label">Departamento anterior</label>
                <input className="input" value={form.from_department} onChange={e => setForm({ ...form, from_department: e.target.value })} />
              </div>
              <div>
                <label className="label">Departamento novo</label>
                <input className="input" value={form.to_department} onChange={e => setForm({ ...form, to_department: e.target.value })} />
              </div>
            </div>
          )}
          {['promotion', 'role_change'].includes(form.type) && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Salário anterior (AOA)</label>
                <input type="number" className="input" value={form.from_salary} onChange={e => setForm({ ...form, from_salary: e.target.value })} />
              </div>
              <div>
                <label className="label">Salário novo (AOA)</label>
                <input type="number" className="input" value={form.to_salary} onChange={e => setForm({ ...form, to_salary: e.target.value })} />
              </div>
            </div>
          )}
          <div>
            <label className="label">Notas adicionais</label>
            <textarea className="input" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!confirmDel} title="Eliminar evento"
        message="Tem a certeza que quer eliminar este evento da carreira?"
        danger confirmLabel="Eliminar" onConfirm={doDelete} onCancel={() => setConfirmDel(null)} />
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────
function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
      {icon} {title}
    </div>
  )
}

function Row({ label, value, mono = false }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`${mono ? 'font-mono text-xs' : 'font-medium'} text-slate-800`}>{value || '—'}</span>
    </div>
  )
}
