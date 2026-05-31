import { useEffect, useMemo, useState } from 'react'
import {
  CalendarRange, Users, AlertTriangle, Wand2, Plus, Pencil, Trash2, Save,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { MONTHS, monthName } from '../lib/format'
import { Card, Modal, Spinner, EmptyState, ConfirmModal } from '../components/ui'
import type { Shift, ShiftMonth, ShiftScheduleEntry, ShiftSummaryRow, ShiftViolation } from '../types'

type Tab = 'escala' | 'resumo' | 'turnos'
const now = new Date()
const pad = (n: number) => String(n).padStart(2, '0')

// Cabeçalho de dias da semana
const WDAYS = ['D','S','T','Q','Q','S','S']

export default function Schedules() {
  const [tab, setTab] = useState<Tab>('escala')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const years = [year - 1, year, year + 1]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Escalas e Turnos</h1>
          <p className="text-sm text-slate-500">Gestão de turnos, piquetes, folgas e escalas mensais por sector</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-36" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select className="input w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {([['escala','Escala Mensal', CalendarRange],['resumo','Resumo',Users],['turnos','Gerir Turnos',Pencil]] as const).map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id as Tab)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <Icon size={16} />{label}
          </button>
        ))}
      </div>

      {tab === 'escala' && <MonthGrid month={month} year={year} />}
      {tab === 'resumo' && <SummaryTab month={month} year={year} />}
      {tab === 'turnos' && <ShiftsTab />}
    </div>
  )
}

/* =========================================================
   GRELHA MENSAL
   ========================================================= */
function MonthGrid({ month, year }: { month: number; year: number }) {
  const [data, setData] = useState<ShiftMonth | null>(null)
  const [loading, setLoading] = useState(true)
  const [dept, setDept] = useState('')
  const [editing, setEditing] = useState<string | null>(null) // `${empId}-${day}`

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get<ShiftMonth>('/shifts/month', {
        params: { month, year, department: dept || undefined },
      })
      setData(data)
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [month, year, dept])

  const map = useMemo(() => {
    const m: Record<string, ShiftScheduleEntry> = {}
    data?.schedules.forEach((s) => {
      const day = Number(s.date.slice(8, 10))
      m[`${s.employee_id}-${day}`] = s
    })
    return m
  }, [data])

  if (loading || !data) return <Spinner />

  const days = Array.from({ length: data.days_in_month }, (_, i) => i + 1)
  const isWeekend = (d: number) => { const w = new Date(year, month - 1, d).getDay(); return w === 0 || w === 6 }

  const assign = async (empId: number, day: number, shiftId: number | null) => {
    setEditing(null)
    const date = `${year}-${pad(month)}-${pad(day)}`
    try {
      await api.post('/shifts/assign', { employee_id: empId, shift_id: shiftId, date })
      load()
    } catch { toast.error('Erro ao guardar') }
  }

  const autoRest = async () => {
    try {
      const { data: r } = await api.post('/shifts/auto-rest', { month, year })
      toast.success(`${r.rest_days_applied} folga(s) automática(s) aplicada(s) após turno noturno`)
      load()
    } catch (e: any) { toast.error(e?.response?.data?.error ?? 'Erro') }
  }

  // células da grelha agrupadas por departamento
  const grouped: Record<string, typeof data.employees> = {}
  data.employees.forEach((e) => {
    const d = e.department ?? 'Geral'
    if (!grouped[d]) grouped[d] = []
    grouped[d].push(e)
  })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {data.departments.length > 0 && (
          <select className="input w-48" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">Todos os sectores</option>
            {data.departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <button className="btn-outline" onClick={autoRest}><Wand2 size={16} /> Folgas automáticas (pós-noite)</button>
        <span className="ml-auto text-xs text-slate-400">Clique numa célula para atribuir turno</span>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0 text-xs w-full">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[140px] bg-white px-3 py-2 text-left text-xs font-medium text-slate-400">Funcionário</th>
                {days.map((d) => (
                  <th key={d} className={`w-8 px-0 py-1 text-center font-medium ${isWeekend(d) ? 'bg-slate-100 text-slate-400' : 'text-slate-500'}`}>
                    <div className="text-xs">{d}</div>
                    <div className="text-[9px] text-slate-300">{WDAYS[new Date(year, month - 1, d).getDay()]}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(grouped).map(([deptName, emps]) => (
                <>
                  {data.departments.length > 1 && (
                    <tr key={`dept-${deptName}`}>
                      <td colSpan={days.length + 1}
                        className="sticky left-0 bg-primary/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
                        {deptName}
                      </td>
                    </tr>
                  )}
                  {emps.map((emp) => (
                    <tr key={emp.id} className="hover:bg-slate-50/50">
                      <td className="sticky left-0 z-10 bg-white px-3 py-1 font-medium text-slate-700 whitespace-nowrap">{emp.full_name}</td>
                      {days.map((d) => {
                        const key = `${emp.id}-${d}`
                        const entry = map[key]
                        const shift = entry?.shift
                        return (
                          <td key={d} className={`relative p-0.5 ${isWeekend(d) ? 'bg-slate-50' : ''}`}>
                            <button
                              onClick={() => setEditing(editing === key ? null : key)}
                              title={shift ? `${shift.name}${shift.start_time ? ` (${shift.start_time}–${shift.end_time})` : ''}` : 'Sem turno'}
                              className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold transition hover:ring-2 hover:ring-primary/40"
                              style={shift ? { backgroundColor: shift.color, color: '#fff' } : { backgroundColor: '#f1f5f9', color: '#94a3b8' }}>
                              {shift ? shift.code : '·'}
                            </button>

                            {editing === key && (
                              <>
                                <div className="fixed inset-0 z-20" onClick={() => setEditing(null)} />
                                <div className="absolute left-1/2 top-7 z-30 w-48 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                                  <div className="mb-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                                    {emp.full_name} — dia {d}
                                  </div>
                                  {data.shifts.map((s) => (
                                    <button key={s.id} onClick={() => assign(emp.id, d, s.id)}
                                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50">
                                      <span className="flex h-5 w-7 items-center justify-center rounded text-[9px] font-bold text-white"
                                        style={{ backgroundColor: s.color }}>{s.code}</span>
                                      <span className="text-xs text-slate-600">{s.name}
                                        {s.start_time && <span className="ml-1 text-slate-400">{s.start_time}–{s.end_time}</span>}
                                      </span>
                                    </button>
                                  ))}
                                  {entry && (
                                    <button onClick={() => assign(emp.id, d, null)}
                                      className="mt-1 w-full rounded px-2 py-1.5 text-left text-xs text-red-600 hover:bg-red-50">
                                      Remover turno
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-600">
        {data.shifts.map((s) => (
          <span key={s.id} className="inline-flex items-center gap-1.5">
            <span className="flex h-5 w-7 items-center justify-center rounded text-[9px] font-bold text-white"
              style={{ backgroundColor: s.color }}>{s.code}</span>
            {s.name}{s.start_time ? ` (${s.start_time}–${s.end_time})` : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

/* =========================================================
   RESUMO + ALERTAS
   ========================================================= */
function SummaryTab({ month, year }: { month: number; year: number }) {
  const [summary, setSummary] = useState<ShiftSummaryRow[]>([])
  const [violations, setViolations] = useState<ShiftViolation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get('/shifts/summary', { params: { month, year } })
      .then((r) => { setSummary(r.data.summary); setViolations(r.data.violations) })
      .finally(() => setLoading(false))
  }, [month, year])

  if (loading) return <Spinner />

  return (
    <div className="space-y-5">
      {violations.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-amber-700 font-semibold">
            <AlertTriangle size={16} /> {violations.length} alerta{violations.length > 1 ? 's' : ''} de regras
          </div>
          <ul className="space-y-1 text-xs text-amber-800">
            {violations.map((v, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-amber-500">▸</span>
                <span><strong>{new Date(v.date).toLocaleDateString('pt-PT')}</strong> — {v.message}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
          Resumo de {monthName(month)} / {year}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="px-4 py-3">Funcionário</th>
                <th className="px-4 py-3">Sector</th>
                <th className="px-4 py-3 text-center">Turnos</th>
                <th className="px-4 py-3 text-center">Horas</th>
                <th className="px-4 py-3 text-center">Noites</th>
                <th className="px-4 py-3 text-center">Piquetes</th>
                <th className="px-4 py-3 text-center">Folgas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.length === 0 && (
                <tr><td colSpan={7} className="py-8 text-center text-slate-400">Sem dados de escala para este mês.</td></tr>
              )}
              {summary.map((r) => (
                <tr key={r.employee_id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700">{r.full_name}</td>
                  <td className="px-4 py-3 text-slate-500">{r.department ?? '—'}</td>
                  <td className="px-4 py-3 text-center">{r.total_shifts}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`font-semibold ${r.total_hours > 160 ? 'text-amber-600' : 'text-primary'}`}>{r.total_hours}h</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.night_shifts > 0 ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">{r.night_shifts}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.oncall_shifts > 0 ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{r.oncall_shifts}</span> : '—'}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-500">{r.rest_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

/* =========================================================
   GERIR TURNOS (CRUD)
   ========================================================= */
const SHIFT_COLORS = [
  '#0F6E56','#1D9E75','#085041','#2E4057','#F59E0B',
  '#EF4444','#8B5CF6','#64748B','#94A3B8','#0EA5E9',
]

const emptyShift = {
  name: '', code: '', type: 'regular' as const,
  start_time: '', end_time: '', duration_hours: 8,
  crosses_midnight: false, color: '#0F6E56',
  counts_as_worked: true, active: true, sort_order: 0,
}

function ShiftsTab() {
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Partial<Shift>>(emptyShift)
  const [confirmDelete, setConfirmDelete] = useState<Shift | null>(null)

  const load = () => {
    setLoading(true)
    api.get<Shift[]>('/shifts').then((r) => setShifts(r.data)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (form.id) await api.put(`/shifts/${form.id}`, form)
      else await api.post('/shifts', form)
      toast.success('Turno guardado')
      setModal(false); load()
    } catch { toast.error('Erro ao guardar') }
  }

  const remove = (s: Shift) => setConfirmDelete(s)
  const doRemove = async () => {
    if (!confirmDelete) return
    try {
      await api.delete(`/shifts/${confirmDelete.id}`)
      toast.success('Turno eliminado'); setConfirmDelete(null); load()
    } catch { toast.error('Erro ao eliminar') }
  }

  const typeLabel: Record<string, string> = { regular: 'Regular', oncall: 'Piquete', rest: 'Folga', holiday: 'Feriado/Férias' }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => { setForm(emptyShift); setModal(true) }}><Plus size={18} /> Novo turno</button>
      </div>
      <Card>
        {loading ? <Spinner /> : shifts.length === 0 ? <EmptyState message="Nenhum turno definido." /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Turno</th>
                  <th className="px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Horário</th>
                  <th className="px-4 py-3 text-center">Horas</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-8 items-center justify-center rounded text-[10px] font-bold text-white"
                          style={{ backgroundColor: s.color }}>{s.code}</span>
                        <span className="font-medium text-slate-700">{s.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{typeLabel[s.type]}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.start_time ? `${s.start_time} – ${s.end_time}${s.crosses_midnight ? ' (+1)' : ''}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-slate-600">{s.duration_hours > 0 ? `${s.duration_hours}h` : '—'}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${s.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {s.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => { setForm(s); setModal(true) }} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary"><Pencil size={16} /></button>
                        <button onClick={() => remove(s)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar turno' : 'Novo turno'} wide>
        <form onSubmit={save} className="grid grid-cols-2 gap-4">
          <div className="col-span-2 grid grid-cols-3 gap-4">
            <div className="col-span-2"><label className="label">Nome</label><input className="input" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><label className="label">Código</label><input className="input uppercase" maxLength={10} value={form.code ?? ''} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} required /></div>
          </div>
          <div>
            <label className="label">Tipo</label>
            <select className="input" value={form.type ?? 'regular'} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
              <option value="regular">Regular</option>
              <option value="oncall">Piquete</option>
              <option value="rest">Folga</option>
              <option value="holiday">Feriado / Férias</option>
            </select>
          </div>
          <div><label className="label">Duração (horas)</label><input type="number" className="input" min={0} max={24} value={form.duration_hours ?? 8} onChange={(e) => setForm({ ...form, duration_hours: Number(e.target.value) })} /></div>
          <div><label className="label">Início</label><input type="time" className="input" value={form.start_time ?? ''} onChange={(e) => setForm({ ...form, start_time: e.target.value })} /></div>
          <div><label className="label">Fim</label><input type="time" className="input" value={form.end_time ?? ''} onChange={(e) => setForm({ ...form, end_time: e.target.value })} /></div>

          <div className="col-span-2">
            <label className="label">Cor</label>
            <div className="flex flex-wrap gap-2">
              {SHIFT_COLORS.map((c) => (
                <button key={c} type="button" onClick={() => setForm({ ...form, color: c })}
                  className="h-7 w-7 rounded-full border-2 transition"
                  style={{ backgroundColor: c, borderColor: form.color === c ? '#000' : 'transparent' }} />
              ))}
              <input type="color" className="h-7 w-7 cursor-pointer rounded" value={form.color ?? '#0F6E56'}
                onChange={(e) => setForm({ ...form, color: e.target.value })} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!form.crosses_midnight} onChange={(e) => setForm({ ...form, crosses_midnight: e.target.checked })} className="h-4 w-4 rounded" />
              Passa a meia-noite
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!form.counts_as_worked} onChange={(e) => setForm({ ...form, counts_as_worked: e.target.checked })} className="h-4 w-4 rounded" />
              Conta como dia trabalhado
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 rounded" />
              Ativo
            </label>
          </div>

          <div className="flex flex-col justify-end">
            <label className="label">Ordem de exibição</label>
            <input type="number" className="input" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
          </div>

          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary"><Save size={16} /> Guardar</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!confirmDelete} title="Eliminar turno"
        message={`Eliminar o turno "${confirmDelete?.name}" (${confirmDelete?.code})? Os dias já escalados com este turno não serão alterados.`}
        danger confirmLabel="Eliminar" onConfirm={doRemove} onCancel={() => setConfirmDelete(null)} />
    </div>
  )
}
