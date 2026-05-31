import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { adminApi } from '../../lib/adminApi'

interface Stats {
  totals: { tenants: number; active: number; trial: number; paid: number; mrr_aoa: number }
  by_plan: Record<string, number>
  registrations: { month: string; total: number }[]
}

const COLORS = ['#4f46e5', '#06b6d4', '#10b981', '#f59e0b']

const money = (n: number) => n.toLocaleString('pt-PT') + ' AOA'

function StatBox({ label, value, sub, color = 'text-white' }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
      <p className="text-xs text-slate-400">{label}</p>
      <p className={`mt-1 font-heading text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    adminApi.get<Stats>('/stats').then(r => setStats(r.data)).catch(() => {})
  }, [])

  if (!stats) return <div className="flex h-64 items-center justify-center text-slate-500">A carregar...</div>

  const planData = Object.entries(stats.by_plan).map(([name, value]) => ({ name, value }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-slate-400">Visão geral da plataforma RHadmin</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatBox label="Total tenants"     value={stats.totals.tenants} />
        <StatBox label="Activos"           value={stats.totals.active}  color="text-green-400" />
        <StatBox label="Em trial"          value={stats.totals.trial}   color="text-amber-400" />
        <StatBox label="Pagos"             value={stats.totals.paid}    color="text-primary" />
        <StatBox label="MRR estimado"      value={money(stats.totals.mrr_aoa)} sub="receita mensal" color="text-primary" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Registos por mês */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-300">Novos tenants (últimos 6 meses)</h2>
          {stats.registrations.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={stats.registrations}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }} />
                <Bar dataKey="total" name="Tenants" fill="#4f46e5" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Tenants por plano */}
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-300">Tenants por plano</h2>
          {planData.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">Sem dados</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} innerRadius={40}
                  label={({ name, percent }) => `${name} ${((percent ?? 0)*100).toFixed(0)}%`} labelLine={false}>
                  {planData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
