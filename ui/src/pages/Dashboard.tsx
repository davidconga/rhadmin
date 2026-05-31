import { useEffect, useState } from 'react'
import { Users, ReceiptText, Banknote, Building2 } from 'lucide-react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { api } from '../lib/api'
import { money, monthName } from '../lib/format'
import { StatCard, Card, Spinner } from '../components/ui'
import type { Employee, Paginated, SalarySlip } from '../types'

// ─── paleta ───────────────────────────────────────────────────
const PRIMARY = '#4f46e5'
const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6']
const STATUS_COLORS: Record<string, string> = {
  draft: '#94a3b8', issued: '#06b6d4', paid: '#10b981',
}
const STATUS_LABEL: Record<string, string> = {
  draft: 'Rascunho', issued: 'Emitido', paid: 'Pago',
}

// ─── helpers ─────────────────────────────────────────────────
const fmt = (v: number | string | undefined) => {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  return new Intl.NumberFormat('pt-PT', { notation: 'compact', maximumFractionDigits: 1 }).format(n) + ' AOA'
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [empTotal, setEmpTotal] = useState(0)
  const [slips, setSlips] = useState<SalarySlip[]>([])
  const [deptData, setDeptData] = useState<{ name: string; total: number }[]>([])

  useEffect(() => {
    const now = new Date()
    const year = now.getFullYear()

    Promise.all([
      api.get<Paginated<Employee>>('/employees', { params: { per_page: 1, active: true } }),
      api.get<Paginated<SalarySlip>>('/salary-slips', {
        params: { per_page: 200, year },
      }),
      api.get<Paginated<Employee>>('/employees', { params: { per_page: 200, active: true } }),
    ]).then(([empRes, slipRes, allEmpRes]) => {
      setEmpTotal(empRes.data.total)
      setSlips(slipRes.data.data)

      // Funcionários por departamento
      const byDept: Record<string, number> = {}
      for (const e of allEmpRes.data.data) {
        const d = e.department ?? 'Sem dept.'
        byDept[d] = (byDept[d] ?? 0) + 1
      }
      setDeptData(Object.entries(byDept).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total))
    }).finally(() => setLoading(false))
  }, [])

  if (loading) return <Spinner />

  const totalNet = slips.reduce((s, r) => s + parseFloat(r.net_salary), 0)
  const issued = slips.filter((s) => s.status !== 'draft').length

  // Massa salarial por mês (barras)
  const byMonth: Record<number, number> = {}
  for (const s of slips) {
    byMonth[s.month] = (byMonth[s.month] ?? 0) + parseFloat(s.net_salary)
  }
  const monthlyData = Array.from({ length: 12 }, (_, i) => ({
    mes: monthName(i + 1).slice(0, 3),
    total: byMonth[i + 1] ?? 0,
  })).filter((_, i) => i <= new Date().getMonth())

  // Status dos recibos (rosca)
  const statusData = Object.entries(
    slips.reduce<Record<string, number>>((acc, s) => {
      acc[s.status] = (acc[s.status] ?? 0) + 1
      return acc
    }, {})
  ).map(([status, count]) => ({ name: STATUS_LABEL[status] ?? status, value: count, status }))

  // Evolução líquido últimos 6 meses (linha)
  const lineData = monthlyData.slice(-6)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary">Dashboard</h1>
        <p className="text-sm text-slate-500">Resumo da atividade da empresa</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Funcionários ativos" value={empTotal} hint="na empresa activa" />
        <StatCard label="Recibos gerados" value={slips.length} hint={`${issued} emitidos`} />
        <StatCard label="Massa salarial líquida" value={money(totalNet)} hint="todos os recibos do ano" />
        <StatCard label="Documentos" value={slips.reduce((n, s) => n + (s.documents?.length ?? 0), 0)} hint="DOCX/PDF gerados" />
      </div>

      {/* Massa salarial mensal + estado recibos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-4">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <Banknote size={16} />
            <h2 className="font-heading text-sm font-bold">Massa salarial líquida mensal</h2>
          </div>
          {monthlyData.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Sem recibos este ano.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={72} />
                <Tooltip formatter={(v) => money(v as number)} labelFormatter={(l) => `Mês: ${l}`} />
                <Bar dataKey="total" name="Líquido" fill={PRIMARY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <ReceiptText size={16} />
            <h2 className="font-heading text-sm font-bold">Estado dos recibos</h2>
          </div>
          {statusData.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Sem recibos.</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40} paddingAngle={3} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`} labelLine={false}>
                  {statusData.map((entry) => (
                    <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? COLORS[0]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Evolução + funcionários por dept */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <Banknote size={16} />
            <h2 className="font-heading text-sm font-bold">Evolução salarial (últimos 6 meses)</h2>
          </div>
          {lineData.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Sem dados.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={lineData} margin={{ top: 4, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} width={72} />
                <Tooltip formatter={(v) => money(v as number)} />
                <Line type="monotone" dataKey="total" name="Líquido" stroke={PRIMARY} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4">
          <div className="mb-3 flex items-center gap-2 text-primary">
            <Building2 size={16} />
            <h2 className="font-heading text-sm font-bold">Funcionários por departamento</h2>
          </div>
          {deptData.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Sem funcionários.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={deptData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                <Tooltip />
                <Bar dataKey="total" name="Funcionários" radius={[0, 4, 4, 0]}>
                  {deptData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Últimos recibos */}
      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 text-primary">
          <Users size={16} />
          <h2 className="font-heading text-sm font-bold">Últimos recibos</h2>
        </div>
        {slips.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Ainda não há recibos. Gere um lote na página de Recibos.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {slips.slice(0, 6).map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2.5 text-sm">
                <span className="font-medium text-slate-700 w-40 truncate">{s.employee?.full_name}</span>
                <span className="text-slate-400">{monthName(s.month)} {s.year}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  s.status === 'paid' ? 'bg-green-100 text-green-700' :
                  s.status === 'issued' ? 'bg-blue-100 text-blue-700' :
                  'bg-slate-100 text-slate-500'
                }`}>{STATUS_LABEL[s.status]}</span>
                <span className="font-semibold text-primary font-mono text-xs">{money(s.net_salary)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
