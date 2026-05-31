import { useEffect, useMemo, useState } from 'react'
import {
  Palmtree, CalendarDays, BarChart3, Plus, CheckCircle2,
  XCircle, Ban, ChevronLeft, ChevronRight,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { monthName } from '../lib/format'
import { Card, Modal, Spinner, EmptyState, ConfirmModal } from '../components/ui'
import type { VacationBalanceRow, VacationRequest } from '../types'

type Tab = 'pedidos' | 'calendario' | 'saldos'

const STATUS_STYLE: Record<string, string> = {
  pending:   'bg-amber-100 text-amber-700',
  approved:  'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-700',
  cancelled: 'bg-slate-100 text-slate-500',
}
const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente', approved: 'Aprovado', rejected: 'Rejeitado', cancelled: 'Cancelado',
}

function VBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? ''}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  )
}

export default function Vacations() {
  const [tab, setTab] = useState<Tab>('pedidos')

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary">Férias</h1>
        <p className="text-sm text-slate-500">Pedidos, aprovações, calendário e saldos de férias</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {([
          ['pedidos', 'Pedidos', Palmtree],
          ['calendario', 'Calendário', CalendarDays],
          ['saldos', 'Saldos', BarChart3],
        ] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      {tab === 'pedidos' && <RequestsTab />}
      {tab === 'calendario' && <CalendarTab />}
      {tab === 'saldos' && <BalancesTab />}
    </div>
  )
}

/* ================================================================
   PEDIDOS
   ================================================================ */
function RequestsTab() {
  const [list, setList] = useState<VacationRequest[]>([])
  const [, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [createOpen, setCreateOpen] = useState(false)
  const [rejectModal, setRejectModal] = useState<VacationRequest | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [cancelConfirm, setCancelConfirm] = useState<VacationRequest | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/vacations', { params: { status: status || undefined, year, per_page: 50 } })
      setList(data.data); setTotal(data.total)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [status, year])

  const approve = async (r: VacationRequest) => {
    try {
      await api.post(`/vacations/${r.id}/approve`)
      toast.success('Férias aprovadas — escala e assiduidade atualizadas')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erro ao aprovar') }
  }

  const reject = async () => {
    if (!rejectModal) return
    try {
      await api.post(`/vacations/${rejectModal.id}/reject`, { reason: rejectReason })
      toast.success('Pedido rejeitado'); setRejectModal(null); setRejectReason(''); load()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erro') }
  }

  const cancel = (r: VacationRequest) => setCancelConfirm(r)
  const doCancel = async () => {
    if (!cancelConfirm) return
    try {
      await api.post(`/vacations/${cancelConfirm.id}/cancel`)
      toast.success('Pedido cancelado'); setCancelConfirm(null); load()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erro') }
  }

  const years = [year - 1, year, year + 1]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select className="input w-36" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos os estados</option>
          <option value="pending">Pendentes</option>
          <option value="approved">Aprovados</option>
          <option value="rejected">Rejeitados</option>
          <option value="cancelled">Cancelados</option>
        </select>
        <button className="btn-primary ml-auto" onClick={() => setCreateOpen(true)}>
          <Plus size={18} /> Novo pedido
        </button>
      </div>

      <Card>
        {loading ? <Spinner /> : list.length === 0 ? <EmptyState message="Nenhum pedido encontrado." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Funcionário</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3 text-center">Dias úteis</th>
                  <th className="px-4 py-3">Motivo</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {r.employee?.full_name}
                      {r.employee?.department && <div className="text-xs text-slate-400">{r.employee.department}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {new Date(r.start_date).toLocaleDateString('pt-PT')} – {new Date(r.end_date).toLocaleDateString('pt-PT')}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-primary">{r.working_days}d</td>
                    <td className="px-4 py-3 text-slate-500 max-w-xs truncate">{r.reason || '—'}</td>
                    <td className="px-4 py-3 text-center"><VBadge status={r.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {r.status === 'pending' && (
                          <>
                            <button onClick={() => approve(r)} title="Aprovar"
                              className="rounded p-1.5 text-slate-400 hover:bg-green-50 hover:text-green-600">
                              <CheckCircle2 size={16} />
                            </button>
                            <button onClick={() => { setRejectModal(r); setRejectReason('') }} title="Rejeitar"
                              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600">
                              <XCircle size={16} />
                            </button>
                          </>
                        )}
                        {(r.status === 'pending' || r.status === 'approved') && (
                          <button onClick={() => cancel(r)} title="Cancelar"
                            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                            <Ban size={16} />
                          </button>
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

      <CreateModal open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); load() }} />

      <Modal open={!!rejectModal} onClose={() => setRejectModal(null)} title="Rejeitar pedido">
        <p className="mb-3 text-sm text-slate-500">
          Pedido de <strong>{rejectModal?.employee?.full_name}</strong> ({rejectModal?.working_days}d úteis)
        </p>
        <label className="label">Motivo da rejeição *</label>
        <textarea className="input" rows={3} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-outline" onClick={() => setRejectModal(null)}>Cancelar</button>
          <button className="btn-danger" onClick={reject} disabled={!rejectReason.trim()}>Rejeitar</button>
        </div>
      </Modal>

      <ConfirmModal open={!!cancelConfirm} title="Cancelar pedido de férias"
        message={`Cancelar o pedido de ${cancelConfirm?.working_days} dias de "${cancelConfirm?.employee?.full_name}"? Se aprovado, as marcações na escala serão removidas.`}
        confirmLabel="Cancelar pedido" onConfirm={doCancel} onCancel={() => setCancelConfirm(null)} />
    </div>
  )
}

/* ----------------------------------------------------------------- */
function CreateModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [employees, setEmployees] = useState<{ id: number; full_name: string }[]>([])
  const [empId, setEmpId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [workingDays, setWorkingDays] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api.get('/employees', { params: { per_page: 100, active: true } }).then((r) => setEmployees(r.data.data))
  }, [])

  useEffect(() => {
    if (from && to && to >= from) {
      api.get('/vacations/working-days', { params: { from, to } })
        .then((r) => setWorkingDays(r.data.working_days))
        .catch(() => setWorkingDays(null))
    } else {
      setWorkingDays(null)
    }
  }, [from, to])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await api.post('/vacations', { employee_id: Number(empId), start_date: from, end_date: to, reason })
      toast.success('Pedido criado'); onCreated()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Erro ao criar pedido')
    } finally { setSaving(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Novo pedido de férias">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Funcionário</label>
          <select className="input" value={empId} onChange={(e) => setEmpId(e.target.value)} required>
            <option value="">— Selecionar —</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Data de início</label>
            <input type="date" className="input" value={from} onChange={(e) => setFrom(e.target.value)} required />
          </div>
          <div>
            <label className="label">Data de fim</label>
            <input type="date" className="input" value={to} min={from} onChange={(e) => setTo(e.target.value)} required />
          </div>
        </div>
        {workingDays !== null && (
          <div className="rounded-lg bg-primary/5 px-4 py-2 text-sm">
            Dias úteis no período: <strong className="text-primary">{workingDays}</strong>
          </div>
        )}
        <div>
          <label className="label">Motivo (opcional)</label>
          <textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-outline" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" disabled={saving || !empId || !from || !to}>Submeter</button>
        </div>
      </form>
    </Modal>
  )
}

/* ================================================================
   CALENDÁRIO
   ================================================================ */
function CalendarTab() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [requests, setRequests] = useState<VacationRequest[]>([])
  const [loading, setLoading] = useState(true)

  const from = `${year}-${String(month).padStart(2,'0')}-01`
  const to = new Date(year, month, 0).toISOString().slice(0, 10)

  useEffect(() => {
    setLoading(true)
    api.get('/vacations/calendar', { params: { from, to } })
      .then((r) => setRequests(r.data))
      .finally(() => setLoading(false))
  }, [year, month])

  const daysInMonth = new Date(year, month, 0).getDate()
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  const COLORS = ['#0F6E56','#1D9E75','#F59E0B','#EF4444','#8B5CF6','#0EA5E9','#EC4899']

  // Mapa employee_id → cor
  const colorMap = useMemo(() => {
    const m: Record<number, string> = {}
    let i = 0
    requests.forEach((r) => { if (!m[r.employee_id]) { m[r.employee_id] = COLORS[i++ % COLORS.length] } })
    return m
  }, [requests])

  // Verifica se um funcionário está de férias num dia
  const onVacation = (empId: number, day: number): boolean => {
    const d = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    return requests.some((r) => r.employee_id === empId && r.start_date <= d && r.end_date >= d)
  }

  const isWeekend = (d: number) => { const w = new Date(year, month - 1, d).getDay(); return w === 0 || w === 6 }
  const WDAYS = ['D','S','T','Q','Q','S','S']

  const unique = [...new Map(requests.map((r) => [r.employee_id, r.employee])).values()].filter(Boolean)

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button className="btn-ghost" onClick={() => { if (month === 1) { setMonth(12); setYear(y => y - 1) } else setMonth(m => m - 1) }}>
          <ChevronLeft size={18} />
        </button>
        <span className="font-heading font-bold text-primary w-36 text-center">{monthName(month)} {year}</span>
        <button className="btn-ghost" onClick={() => { if (month === 12) { setMonth(1); setYear(y => y + 1) } else setMonth(m => m + 1) }}>
          <ChevronRight size={18} />
        </button>
      </div>

      <Card>
        {loading ? <Spinner /> : unique.length === 0 ? (
          <EmptyState message="Nenhuma férias aprovada neste mês." />
        ) : (
          <div className="overflow-x-auto">
            <table className="border-separate border-spacing-0 text-xs w-full">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white min-w-[140px] px-3 py-2 text-left text-xs font-medium text-slate-400">Funcionário</th>
                  {days.map((d) => (
                    <th key={d} className={`w-7 px-0 py-1 text-center font-medium ${isWeekend(d) ? 'bg-slate-100 text-slate-300' : 'text-slate-400'}`}>
                      <div>{d}</div>
                      <div className="text-[8px]">{WDAYS[new Date(year, month - 1, d).getDay()]}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unique.map((emp) => emp && (
                  <tr key={emp.id}>
                    <td className="sticky left-0 z-10 bg-white px-3 py-1 font-medium text-slate-700 whitespace-nowrap">{emp.full_name}</td>
                    {days.map((d) => {
                      const vac = onVacation(emp.id, d)
                      const weekend = isWeekend(d)
                      return (
                        <td key={d} className={`p-0.5 ${weekend ? 'bg-slate-50' : ''}`}>
                          <div
                            className="h-6 w-6 rounded"
                            style={vac && !weekend ? { backgroundColor: colorMap[emp.id], opacity: 0.85 } : {}}
                          />
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {unique.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-slate-600">
          {unique.map((emp) => emp && (
            <span key={emp.id} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded" style={{ backgroundColor: colorMap[emp.id] }} />
              {emp.full_name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ================================================================
   SALDOS
   ================================================================ */
function BalancesTab() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [balances, setBalances] = useState<VacationBalanceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState<VacationBalanceRow | null>(null)
  const [editForm, setEditForm] = useState({ entitled_days: 22, carried_over: 0, extra_days: 0 })

  const load = () => {
    setLoading(true)
    api.get('/vacations/balances', { params: { year } })
      .then((r) => setBalances(r.data))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [year])

  const saveBalance = async () => {
    if (!editModal) return
    try {
      await api.put(`/employees/${editModal.employee_id}/vacation-balance`, { year, ...editForm })
      toast.success('Saldo atualizado'); setEditModal(null); load()
    } catch { toast.error('Erro ao guardar') }
  }

  const years = [year - 1, year, year + 1]

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select className="input w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <span className="text-xs text-slate-400">Clique no ícone de edição para ajustar o saldo de um funcionário</span>
      </div>

      <Card>
        {loading ? <Spinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Funcionário</th>
                  <th className="px-4 py-3 text-center">Direito</th>
                  <th className="px-4 py-3 text-center">Transitados</th>
                  <th className="px-4 py-3 text-center">Extra</th>
                  <th className="px-4 py-3 text-center">Total</th>
                  <th className="px-4 py-3 text-center">Usados</th>
                  <th className="px-4 py-3 w-56">Restantes</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {balances.map((b) => (
                  <tr key={b.employee_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {b.full_name}
                      {b.department && <div className="text-xs text-slate-400">{b.department}</div>}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{b.entitled_days}d</td>
                    <td className="px-4 py-3 text-center text-slate-500">{b.carried_over}d</td>
                    <td className="px-4 py-3 text-center text-slate-500">{b.extra_days}d</td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-700">{b.total_days}d</td>
                    <td className="px-4 py-3 text-center text-red-600">{b.used_days}d</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-full rounded-full ${b.remaining === 0 ? 'bg-red-500' : b.remaining <= 5 ? 'bg-amber-400' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(100, (b.used_days / b.total_days) * 100)}%` }} />
                        </div>
                        <span className={`w-8 text-right text-xs font-medium ${b.remaining === 0 ? 'text-red-600' : 'text-primary'}`}>{b.remaining}d</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => { setEditModal(b); setEditForm({ entitled_days: b.entitled_days, carried_over: b.carried_over, extra_days: b.extra_days }) }}
                        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary">
                        ✎
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={!!editModal} onClose={() => setEditModal(null)} title={`Saldo — ${editModal?.full_name}`}>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="label">Dias de direito</label>
              <input type="number" className="input" min={0} value={editForm.entitled_days}
                onChange={(e) => setEditForm({ ...editForm, entitled_days: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Transitados</label>
              <input type="number" className="input" min={0} value={editForm.carried_over}
                onChange={(e) => setEditForm({ ...editForm, carried_over: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label">Dias extra</label>
              <input type="number" className="input" min={0} value={editForm.extra_days}
                onChange={(e) => setEditForm({ ...editForm, extra_days: Number(e.target.value) })} />
            </div>
          </div>
          <div className="rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-600">
            Total disponível: <strong className="text-primary">{editForm.entitled_days + editForm.carried_over + editForm.extra_days}d</strong>
            {editModal && <span className="text-slate-400"> · usados: {editModal.used_days}d · restantes: {editForm.entitled_days + editForm.carried_over + editForm.extra_days - (editModal?.used_days ?? 0)}d</span>}
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setEditModal(null)}>Cancelar</button>
            <button className="btn-primary" onClick={saveBalance}>Guardar</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
