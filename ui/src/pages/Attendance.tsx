import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { CalendarCheck, Users, QrCode, MapPin, Clock, RefreshCw } from 'lucide-react'
import { api } from '../lib/api'
import { MONTHS, monthName } from '../lib/format'
import { Card, Spinner } from '../components/ui'
import type { AttendanceMonth, AttendanceStatus, AttendanceSummaryRow } from '../types'
import QRCodeLib from 'qrcode'

const STATUS: Record<AttendanceStatus, { label: string; short: string; cls: string }> = {
  present: { label: 'Presente', short: 'P', cls: 'bg-green-500 text-white' },
  late: { label: 'Atraso', short: 'A', cls: 'bg-amber-400 text-amber-900' },
  absent: { label: 'Falta', short: 'F', cls: 'bg-red-500 text-white' },
  justified: { label: 'Falta justificada', short: 'J', cls: 'bg-blue-500 text-white' },
  vacation: { label: 'Férias', short: 'Fé', cls: 'bg-violet-500 text-white' },
  sick: { label: 'Baixa médica', short: 'B', cls: 'bg-orange-500 text-white' },
  holiday: { label: 'Feriado', short: 'Fr', cls: 'bg-slate-400 text-white' },
}
const ORDER = Object.keys(STATUS) as AttendanceStatus[]

const now = new Date()
const pad = (n: number) => String(n).padStart(2, '0')

export default function Attendance() {
  const [tab, setTab] = useState<'folha' | 'resumo' | 'qr'>('folha')
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const years = [year - 1, year, year + 1]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Assiduidade</h1>
          <p className="text-sm text-slate-500">Gestão de presenças e mapa mensal de assiduidade</p>
        </div>
        {tab !== 'qr' && (
          <div className="flex items-center gap-2">
            <select className="input w-36" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
            </select>
            <select className="input w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        <button onClick={() => setTab('folha')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === 'folha' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <CalendarCheck size={16} /> Folha mensal
        </button>
        <button onClick={() => setTab('resumo')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === 'resumo' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <Users size={16} /> Resumo
        </button>
        <button onClick={() => setTab('qr')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${tab === 'qr' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
          <QrCode size={16} /> QR Code
        </button>
      </div>

      {tab === 'folha' && <MonthSheet month={month} year={year} />}
      {tab === 'resumo' && <SummaryView month={month} year={year} />}
      {tab === 'qr' && <QrGenerator />}
    </div>
  )
}

// ── QR Generator (admin) ──────────────────────────────────────────────────────

function QrGenerator() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [radius, setRadius] = useState(100)
  const [minutes, setMinutes] = useState(60)
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [remaining, setRemaining] = useState<string | null>(null)
  const [locating, setLocating] = useState(false)

  // Countdown
  useEffect(() => {
    if (!expiresAt) return
    const iv = setInterval(() => {
      const secs = expiresAt - Math.floor(Date.now() / 1000)
      if (secs <= 0) { setRemaining('Expirado'); clearInterval(iv); setQrUrl(null); return }
      const m = Math.floor(secs / 60), s = secs % 60
      setRemaining(`${m}m ${String(s).padStart(2, '0')}s`)
    }, 1000)
    return () => clearInterval(iv)
  }, [expiresAt])

  const locate = () => {
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      p => { setLat(String(p.coords.latitude)); setLng(String(p.coords.longitude)); setLocating(false) },
      () => { toast.error('Não foi possível obter a localização'); setLocating(false) }
    )
  }

  const generate = async () => {
    if (!lat || !lng) { toast.error('Indique a localização'); return }
    setLoading(true)
    try {
      const { data } = await api.post('/attendances/qr/generate', {
        lat: parseFloat(lat), lng: parseFloat(lng),
        radius_meters: radius, valid_minutes: minutes,
        label: label || undefined,
      })
      const dataUrl = await QRCodeLib.toDataURL(data.url, { width: 300, margin: 2 })
      setQrUrl(dataUrl)
      setExpiresAt(data.expires_at)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao gerar QR')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Formulário */}
      <Card className="p-6 space-y-4">
        <h2 className="font-heading font-semibold text-slate-800 flex items-center gap-2">
          <QrCode size={18} className="text-primary" /> Gerar QR de Presença
        </h2>

        <div>
          <label className="label">Local / Etiqueta</label>
          <input className="input" placeholder="ex: Sede, Armazém…" value={label} onChange={e => setLabel(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Latitude</label>
            <input className="input font-mono text-sm" placeholder="-8.8383" value={lat} onChange={e => setLat(e.target.value)} />
          </div>
          <div>
            <label className="label">Longitude</label>
            <input className="input font-mono text-sm" placeholder="13.2344" value={lng} onChange={e => setLng(e.target.value)} />
          </div>
        </div>

        <button onClick={locate} disabled={locating}
          className="flex items-center gap-2 text-sm text-primary hover:underline disabled:opacity-50">
          <MapPin size={14} /> {locating ? 'A obter localização…' : 'Usar a minha localização actual'}
        </button>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Raio (metros)</label>
            <input className="input" type="number" min={10} max={5000} value={radius} onChange={e => setRadius(Number(e.target.value))} />
          </div>
          <div>
            <label className="label">Validade (minutos)</label>
            <input className="input" type="number" min={1} max={1440} value={minutes} onChange={e => setMinutes(Number(e.target.value))} />
          </div>
        </div>

        <button onClick={generate} disabled={loading}
          className="btn-primary w-full flex items-center justify-center gap-2">
          {loading ? <Spinner /> : <><QrCode size={16} /> Gerar QR Code</>}
        </button>
      </Card>

      {/* QR Code */}
      <Card className="p-6 flex flex-col items-center justify-center gap-4">
        {qrUrl ? (
          <>
            <img src={qrUrl} alt="QR Presença" className="w-60 h-60 rounded-xl border border-slate-200" />
            <div className={`flex items-center gap-2 text-sm font-semibold ${remaining === 'Expirado' ? 'text-red-600' : 'text-primary'}`}>
              <Clock size={15} />
              {remaining === 'Expirado' ? 'QR expirado' : `Expira em ${remaining}`}
            </div>
            <div className="flex gap-2">
              <button onClick={generate}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                <RefreshCw size={13} /> Renovar
              </button>
              <a href={qrUrl} download="qr-presenca.png"
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90">
                Descarregar
              </a>
            </div>
            <canvas ref={canvasRef} className="hidden" />
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <QrCode size={64} strokeWidth={1} />
            <p className="text-sm">Preencha o formulário e clique em <strong>Gerar QR Code</strong></p>
          </div>
        )}
      </Card>
    </div>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
      {ORDER.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <span className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold ${STATUS[s].cls}`}>{STATUS[s].short}</span>
          {STATUS[s].label}
        </span>
      ))}
    </div>
  )
}

function MonthSheet({ month, year }: { month: number; year: number }) {
  const [data, setData] = useState<AttendanceMonth | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null) // `${empId}-${day}`
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>('present')
  const [bulkDay, setBulkDay] = useState(1)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get<AttendanceMonth>('/attendances/month', { params: { month, year } })
      setData(data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [month, year])

  // mapa empId-day -> status
  const map = useMemo(() => {
    const m: Record<string, AttendanceStatus> = {}
    data?.attendances.forEach((a) => {
      const day = Number(a.date.slice(8, 10))
      m[`${a.employee_id}-${day}`] = a.status
    })
    return m
  }, [data])

  if (loading || !data) return <Spinner />

  const days = Array.from({ length: data.days_in_month }, (_, i) => i + 1)
  const isWeekend = (d: number) => {
    const wd = new Date(year, month - 1, d).getDay()
    return wd === 0 || wd === 6
  }
  const weekday = (d: number) => ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][new Date(year, month - 1, d).getDay()]

  const setStatus = async (empId: number, day: number, status: AttendanceStatus | null) => {
    setEditing(null)
    const date = `${year}-${pad(month)}-${pad(day)}`
    try {
      if (status === null) {
        // remover: precisa do id do registo
        const rec = data.attendances.find((a) => a.employee_id === empId && Number(a.date.slice(8, 10)) === day)
        if (rec) await api.delete(`/attendances/${rec.id}`)
      } else {
        await api.post('/attendances', { employee_id: empId, date, status })
      }
      load()
    } catch {
      toast.error('Erro ao guardar')
    }
  }

  const bulkMark = async () => {
    const date = `${year}-${pad(month)}-${pad(bulkDay)}`
    try {
      const { data: r } = await api.post('/attendances/bulk', { date, status: bulkStatus })
      toast.success(`${r.marked} funcionários marcados (${STATUS[bulkStatus].label}, dia ${bulkDay})`)
      load()
    } catch {
      toast.error('Erro ao marcar')
    }
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label">Dia</label>
          <select className="input w-20" value={bulkDay} onChange={(e) => setBulkDay(Number(e.target.value))}>
            {days.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Estado</label>
          <select className="input w-44" value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value as AttendanceStatus)}>
            {ORDER.map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </select>
        </div>
        <button className="btn-outline" onClick={bulkMark}>Aplicar a todos</button>
        <span className="ml-auto text-xs text-slate-400">Clique numa célula para alterar o estado desse dia.</span>
      </Card>

      <Card className="p-4">
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-white px-2 py-2 text-left font-medium text-slate-400">Funcionário</th>
                {days.map((d) => (
                  <th key={d} className={`w-8 px-0 py-1 text-center font-medium ${isWeekend(d) ? 'bg-slate-100 text-slate-400' : 'text-slate-500'}`}>
                    <div>{d}</div>
                    <div className="text-[9px] text-slate-300">{weekday(d)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/50">
                  <td className="sticky left-0 z-10 whitespace-nowrap bg-white px-2 py-1 font-medium text-slate-700">{emp.full_name}</td>
                  {days.map((d) => {
                    const key = `${emp.id}-${d}`
                    const st = map[key]
                    return (
                      <td key={d} className={`relative p-0.5 text-center ${isWeekend(d) ? 'bg-slate-50' : ''}`}>
                        <button
                          onClick={() => setEditing(editing === key ? null : key)}
                          className={`flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold ${
                            st ? STATUS[st].cls : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                          }`}
                        >
                          {st ? STATUS[st].short : '·'}
                        </button>
                        {editing === key && (
                          <>
                            <div className="fixed inset-0 z-20" onClick={() => setEditing(null)} />
                            <div className="absolute left-1/2 top-7 z-30 w-44 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-1 text-left shadow-lg">
                              {ORDER.map((s) => (
                                <button key={s} onClick={() => setStatus(emp.id, d, s)}
                                  className="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-100">
                                  <span className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold ${STATUS[s].cls}`}>{STATUS[s].short}</span>
                                  {STATUS[s].label}
                                </button>
                              ))}
                              {st && (
                                <button onClick={() => setStatus(emp.id, d, null)}
                                  className="mt-1 w-full rounded px-2 py-1.5 text-left text-red-600 hover:bg-red-50">Limpar</button>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Legend />
    </div>
  )
}

function SummaryView({ month, year }: { month: number; year: number }) {
  const [rows, setRows] = useState<AttendanceSummaryRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get<AttendanceSummaryRow[]>('/attendances/summary', { params: { month, year } })
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false))
  }, [month, year])

  if (loading) return <Spinner />

  return (
    <Card>
      <div className="border-b border-slate-200 px-4 py-3 text-sm text-slate-500">
        Resumo de {monthName(month)} / {year}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-3">Funcionário</th>
              <th className="px-4 py-3 text-center">Presenças</th>
              <th className="px-4 py-3 text-center">Atrasos</th>
              <th className="px-4 py-3 text-center">Faltas</th>
              <th className="px-4 py-3 text-center">Justif.</th>
              <th className="px-4 py-3 text-center">Férias</th>
              <th className="px-4 py-3 text-right">Horas</th>
              <th className="px-4 py-3 w-40">Taxa de presença</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.employee_id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-700">{r.full_name}</td>
                <td className="px-4 py-3 text-center text-green-700">{r.present}</td>
                <td className="px-4 py-3 text-center text-amber-700">{r.late}</td>
                <td className="px-4 py-3 text-center text-red-700">{r.absent}</td>
                <td className="px-4 py-3 text-center text-blue-700">{r.justified}</td>
                <td className="px-4 py-3 text-center text-violet-700">{r.vacation}</td>
                <td className="px-4 py-3 text-right text-slate-600">{r.worked_hours}h</td>
                <td className="px-4 py-3">
                  {r.rate === null ? (
                    <span className="text-slate-400">—</span>
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${r.rate >= 90 ? 'bg-green-500' : r.rate >= 75 ? 'bg-amber-400' : 'bg-red-500'}`} style={{ width: `${r.rate}%` }} />
                      </div>
                      <span className="w-12 text-right text-xs font-medium text-slate-600">{r.rate}%</span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
