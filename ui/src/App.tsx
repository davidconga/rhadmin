import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/Layout'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Employees from './pages/Employees'
import SalarySlips from './pages/SalarySlips'
import Attendance from './pages/Attendance'
import ApiKeys from './pages/ApiKeys'
import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './pages/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminTenants from './pages/admin/AdminTenants'
import AdminPlans from './pages/admin/AdminPlans'
import AdminSms from './pages/admin/AdminSms'
import AdminPayments from './pages/admin/AdminPayments'
import AdminSettings from './pages/admin/AdminSettings'
import EmployeeRegister from './pages/EmployeeRegister'
import EmployeePortal from './pages/EmployeePortal'
import EmployeeRegistrations from './pages/EmployeeRegistrations'
import Contracts from './pages/Contracts'
import Companies from './pages/Companies'
import Users from './pages/Users'
import Departments from './pages/Departments'
import Positions from './pages/Positions'
import EmployeeDetail from './pages/EmployeeDetail'
import Schedules from './pages/Schedules'
import Vacations from './pages/Vacations'
import Biometric from './pages/Biometric'
import Banks from './pages/Banks'
import PaymentOrders from './pages/PaymentOrders'
import Company from './pages/Company'
import Settings from './pages/Settings'
import Subscription from './pages/Subscription'
import Performance from './pages/Performance'
import Chat from './pages/Chat'
import { useAuth } from './stores/auth'
import { Spinner } from './components/ui'

function Protected({ children }: { children: React.ReactNode }) {
  const { token, user, fetchMe, setupRequired } = useAuth()
  const [checking, setChecking] = useState(!user)
  const location = useLocation()

  useEffect(() => {
    if (token && !user) {
      fetchMe().catch(() => {}).finally(() => setChecking(false))
    } else {
      setChecking(false)
    }
  }, [token, user, fetchMe])

  if (!token) return <Navigate to="/" replace />
  if (checking) return <div className="flex h-full items-center justify-center"><Spinner /></div>
  if (setupRequired && location.pathname !== '/app/empresa') {
    return <Navigate to="/app/empresa" replace />
  }
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Super Admin */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="tenants" element={<AdminTenants />} />
          <Route path="plans"   element={<AdminPlans />} />
          <Route path="sms"      element={<AdminSms />} />
          <Route path="payments"  element={<AdminPayments />} />
          <Route path="settings" element={<AdminSettings />} />
        </Route>

        {/* Público */}
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/registar" element={<Register />} />
        <Route path="/portal" element={<EmployeePortal />} />
        <Route path="/admissao/:slug" element={<EmployeeRegister />} />

        {/* App protegida */}
        <Route
          element={
            <Protected>
              <Layout />
            </Protected>
          }
        >
          <Route path="/app" element={<Dashboard />} />
          <Route path="/app/empresas" element={<Companies />} />
          <Route path="/app/utilizadores" element={<Users />} />
          <Route path="/app/api-keys" element={<ApiKeys />} />
          <Route path="/app/funcionarios" element={<Employees />} />
          <Route path="/app/funcionarios/:id" element={<EmployeeDetail />} />
          <Route path="/app/departamentos" element={<Navigate to="/app/cargos" replace />} />
          <Route path="/app/cargos" element={<Positions />} />
          <Route path="/app/assiduidade" element={<Attendance />} />
          <Route path="/app/escalas" element={<Schedules />} />
          <Route path="/app/ferias" element={<Vacations />} />
          <Route path="/app/biometricos" element={<Biometric />} />
          <Route path="/app/recibos" element={<SalarySlips />} />
          <Route path="/app/ordens-pagamento" element={<PaymentOrders />} />
          <Route path="/app/bancos" element={<Banks />} />
          <Route path="/app/configuracoes" element={<Settings />} />
          <Route path="/app/empresa" element={<Company />} />
          <Route path="/app/subscricao" element={<Subscription />} />
          <Route path="/app/contratos" element={<Contracts />} />
          <Route path="/app/admissoes" element={<EmployeeRegistrations />} />
          <Route path="/app/desempenho" element={<Performance />} />
          <Route path="/app/chat" element={<Chat />} />
        </Route>
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
