import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Building2, CreditCard, LogOut, ShieldCheck, MessageSquare, Banknote, Settings } from 'lucide-react'
import { useAdminAuth } from '../../stores/adminAuth'
import { Spinner as SpinnerUI } from '../../components/ui'

const nav = [
  { to: '/admin',            label: 'Dashboard',  icon: LayoutDashboard, end: true },
  { to: '/admin/tenants',   label: 'Tenants',     icon: Building2 },
  { to: '/admin/plans',     label: 'Planos',      icon: CreditCard },
  { to: '/admin/payments',  label: 'Pagamentos',  icon: Banknote },
  { to: '/admin/sms',       label: 'SMS / Telco', icon: MessageSquare },
  { to: '/admin/settings',  label: 'Configurações', icon: Settings },
]

export default function AdminLayout() {
  const { admin, token, fetchMe, logout } = useAdminAuth()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(!admin)

  useEffect(() => {
    if (token && !admin) {
      fetchMe().catch(() => navigate('/admin/login')).finally(() => setChecking(false))
    } else if (!token) {
      navigate('/admin/login')
    } else {
      setChecking(false)
    }
  }, [token])

  if (checking) return <div className="flex min-h-screen items-center justify-center bg-slate-900"><SpinnerUI /></div>

  const handleLogout = async () => { await logout(); navigate('/admin/login') }

  return (
    <div className="flex min-h-screen bg-slate-900 text-white">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col border-r border-slate-700 bg-slate-800">
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-700">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <ShieldCheck size={16} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-white">RHadmin</p>
            <p className="text-[10px] text-slate-400">Super Admin</p>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 p-3">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-primary/20 text-primary' : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                }`
              }>
              <Icon size={16} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-700 p-3">
          <div className="mb-2 px-3 py-1">
            <p className="text-xs font-medium text-white truncate">{admin?.name}</p>
            <p className="text-[10px] text-slate-500 truncate">{admin?.email}</p>
          </div>
          <button onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-700 hover:text-white transition">
            <LogOut size={14} /> Terminar sessão
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
