import { useEffect, useRef, useState } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, ReceiptText, LogOut, Settings as SettingsIcon,
  ArrowLeftRight, Briefcase, Building2, CalendarCheck, CalendarRange, Palmtree, TrendingUp, MessageSquare,
  ChevronDown, Check, Plus, ShieldCheck, CreditCard, KeyRound, FileText, ClipboardList, Clock, Copy, CheckCircle2, Upload, Paperclip,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../stores/auth'
import { useCompany } from '../stores/company'
import { useSubscription } from '../stores/subscription'
import { api, getTenant } from '../lib/api'
import logo from '../assets/rhadmin-logo.svg'

const nav = [
  { to: '/app',                  label: 'Dashboard',           icon: LayoutDashboard, end: true,  feature: null },
  { to: '/app/funcionarios',     label: 'Funcionários',        icon: Users,            feature: null },
  { to: '/app/cargos',           label: 'Cargos & Departamentos', icon: Briefcase,     feature: null },
  { to: '/app/desempenho',       label: 'Desempenho',          icon: TrendingUp,       feature: null },
  { to: '/app/assiduidade',      label: 'Assiduidade',         icon: CalendarCheck,    feature: 'attendance' },
  { to: '/app/escalas',          label: 'Escalas / Turnos',    icon: CalendarRange,    feature: 'schedules' },
  { to: '/app/ferias',           label: 'Férias',              icon: Palmtree,         feature: 'vacations' },
  { to: '/app/recibos',          label: 'Recibos de Salário',  icon: ReceiptText,      feature: null },
  { to: '/app/ordens-pagamento', label: 'Ordens de Pagamento', icon: ArrowLeftRight,   feature: 'payment_orders' },
  { to: '/app/contratos',        label: 'Contratos',           icon: FileText,         feature: null },
  { to: '/app/admissoes',        label: 'Pedidos Admissão',    icon: ClipboardList,    feature: null },
  { to: '/app/chat',             label: 'Mensagens',           icon: MessageSquare,    feature: null },
  { to: '/app/configuracoes',    label: 'Configurações',       icon: SettingsIcon,     feature: null },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const isAdmin = user?.role === 'admin'
  const { active, companies, fetchAll, setActive } = useCompany()
  const { fetchFeatures, hasFeature } = useSubscription()
  const navigate = useNavigate()
  const location = useLocation()
  const [dropOpen, setDropOpen] = useState(false)
  const [unreadMessages, setUnreadMessages] = useState(0)
  const dropRef = useRef<HTMLDivElement>(null)
  const [trialDays, setTrialDays] = useState<number | null>(null)
  const [subDays, setSubDays] = useState<number | null>(null)
  const [subBlocked, setSubBlocked] = useState<{ status: string; message: string } | null>(null)
  const [plans, setPlans] = useState<{ slug: string; name: string; price_aoa: number; features: string[] }[]>([])
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [paymentRef, setPaymentRef] = useState<{ reference: string; amount: number; plan: { name: string }; iban: string; bank: string; beneficiary: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [proofSent, setProofSent] = useState(false)
  const [pendingPayment, setPendingPayment] = useState<{ reference: string; plan: { name: string }; proof_path?: string } | null>(null)
  const proofRef = useRef<HTMLInputElement>(null)

  const submitProof = async () => {
    if (!proofFile) return
    setUploadingProof(true)
    try {
      const fd = new FormData()
      fd.append('proof', proofFile)
      await api.post('/subscription/proof', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Comprovativo enviado. Aguarde a confirmação.')
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      toast.error('Erro ao enviar comprovativo')
    } finally {
      setUploadingProof(false)
    }
  }

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  useEffect(() => {
    api.get('/subscription').then(r => {
      const status   = r.data?.tenant?.subscription_status
      const days     = r.data?.trial_days_remaining ?? 0
      const subDaysR = r.data?.subscription_days_remaining ?? null
      setTrialDays(null); setSubDays(null); setSubBlocked(null)
      if (status === 'trial' && days > 0) setTrialDays(days)
      if (status === 'trial' && days <= 0) setSubBlocked({ status: 'trial_expired', message: 'O período de trial terminou. Seleccione um plano para continuar.' })
      if (status === 'active' && subDaysR !== null) setSubDays(subDaysR)
      if (status === 'suspended') setSubBlocked({ status: 'suspended', message: 'A subscrição está suspensa. Actualize o plano para reactivar.' })
      if (status === 'cancelled') setSubBlocked({ status: 'cancelled', message: 'A subscrição foi cancelada. Seleccione um plano para reactivar.' })
    }).catch(() => {})
    api.get('/plans').then(r => setPlans(r.data)).catch(() => {})
    fetchFeatures()
    api.get('/subscription/payment-status').then(r => {
      if (r.data?.status === 'pending') {
        setPendingPayment(r.data)
        if (r.data.proof_path) setProofSent(true)
      }
    }).catch(() => {})
  }, [location.pathname])

  const handleUpgrade = async (slug: string) => {
    setUpgrading(slug)
    try {
      const { data } = await api.post('/subscription/upgrade', { plan_slug: slug })
      setPaymentRef(data)
    } catch {
      toast.error('Erro ao criar pedido de pagamento')
    } finally {
      setUpgrading(null)
    }
  }

  useEffect(() => { fetchAll() }, [])

  // Poll não lidos de mensagens a cada 15s
  useEffect(() => {
    const poll = () => api.get<{ unread: number }>('/chat/unread').then(r => setUnreadMessages(r.data.unread)).catch(() => {})
    poll()
    const iv = setInterval(poll, 15000)
    return () => clearInterval(iv)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-60 flex-col bg-[#0f1117] text-white">

        {/* Logo */}
        <div className="px-5 pt-5 pb-4">
          <img src={logo} alt="RHadmin" className="h-7 w-auto" />
        </div>

        {/* Empresa + NIF */}
        <div className="px-4 pt-5 pb-3" ref={dropRef}>
          <button
            onClick={() => setDropOpen((v) => !v)}
            className="flex w-full items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5 text-left transition hover:bg-white/10"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary font-bold text-white text-sm">
              {active?.name?.charAt(0) ?? 'R'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-wide text-white">
                {active?.name ?? 'Seleccionar empresa'}
              </p>
              {active?.nif && (
                <p className="text-[10px] text-white/40">NIF: {active.nif}</p>
              )}
            </div>
            <ChevronDown size={13} className={`shrink-0 text-white/30 transition ${dropOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropOpen && (
            <div className="mt-1 overflow-hidden rounded-xl border border-white/8 bg-[#1a1d27] py-1 shadow-2xl">
              {companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setActive(c); setDropOpen(false) }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-white/70 transition hover:bg-white/8 hover:text-white"
                >
                  <Check size={12} className={active?.id === c.id ? 'text-primary' : 'opacity-0'} />
                  <span className="flex-1 truncate">{c.name}</span>
                </button>
              ))}
              <div className="mx-3 my-1 border-t border-white/8" />
              <button
                onClick={() => { navigate('/app/empresas'); setDropOpen(false) }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[10px] text-white/40 transition hover:bg-white/8 hover:text-white/70"
              >
                <Plus size={11} /> Gerir empresas
              </button>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 pb-2">
          {nav.filter(({ feature }) => !feature || hasFeature(feature)).map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive ? 'bg-white/10 text-white font-medium' : 'text-white/50 hover:bg-white/6 hover:text-white/90'
                }`
              }
            >
              <Icon size={16} className="shrink-0" />
              {label}
              {to === '/app/chat' && unreadMessages > 0 && (
                <span className="ml-auto flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              )}
            </NavLink>
          ))}
          {isAdmin && hasFeature('api_keys') && (
            <NavLink to="/app/api-keys"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive ? 'bg-white/10 text-white font-medium' : 'text-white/50 hover:bg-white/6 hover:text-white/90'
                }`
              }
            >
              <KeyRound size={16} className="shrink-0" /> API / Integrações
            </NavLink>
          )}
          {isAdmin && (
            <NavLink to="/app/utilizadores"
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                  isActive ? 'bg-white/10 text-white font-medium' : 'text-white/50 hover:bg-white/6 hover:text-white/90'
                }`
              }
            >
              <ShieldCheck size={16} className="shrink-0" /> Utilizadores
            </NavLink>
          )}
          <NavLink to="/app/subscricao"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                isActive ? 'bg-white/10 text-white font-medium' : 'text-white/50 hover:bg-white/6 hover:text-white/90'
              }`
            }
          >
            <CreditCard size={16} className="shrink-0" /> Subscrição
          </NavLink>
        </nav>

        {/* Rodapé */}
        <div className="border-t border-white/8 px-3 py-3 space-y-0.5">
          <NavLink to="/app/configuracoes"
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
                isActive ? 'bg-white/10 text-white font-medium' : 'text-white/50 hover:bg-white/6 hover:text-white/90'
              }`
            }
          >
            <SettingsIcon size={16} className="shrink-0" /> Configuração
          </NavLink>
          <button onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/50 transition hover:bg-white/6 hover:text-white/90"
          >
            <LogOut size={16} /> Terminar sessão
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Building2 size={16} />
            <span>{active?.name ?? '—'}</span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs text-slate-400">{getTenant()}</span>
          </div>
          <div className="flex items-center gap-3">
            {trialDays !== null && (
              <button onClick={() => navigate('/app/subscricao')} title={`${trialDays} dias de trial restantes`}>
                <svg width="40" height="40" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                  <circle cx="20" cy="20" r="16" fill="none"
                    stroke={trialDays <= 2 ? '#ef4444' : trialDays <= 4 ? '#f59e0b' : '#085041'}
                    strokeWidth="3.5"
                    strokeDasharray={`${Math.round((trialDays / 7) * 100.5)} 100.5`}
                    strokeLinecap="round"
                    transform="rotate(-90 20 20)" />
                  <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="700"
                    fill={trialDays <= 2 ? '#ef4444' : trialDays <= 4 ? '#f59e0b' : '#085041'}>
                    {trialDays}d
                  </text>
                </svg>
              </button>
            )}
            {subDays !== null && (
              <button onClick={() => navigate('/app/subscricao')} title={`${subDays} dias até à renovação`}>
                <svg width="40" height="40" viewBox="0 0 40 40">
                  <circle cx="20" cy="20" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                  <circle cx="20" cy="20" r="16" fill="none"
                    stroke={subDays <= 3 ? '#ef4444' : subDays <= 7 ? '#f59e0b' : '#085041'}
                    strokeWidth="3.5"
                    strokeDasharray={`${Math.round((subDays / 30) * 100.5)} 100.5`}
                    strokeLinecap="round"
                    transform="rotate(-90 20 20)" />
                  <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="700"
                    fill={subDays <= 3 ? '#ef4444' : subDays <= 7 ? '#f59e0b' : '#085041'}>
                    {subDays}d
                  </text>
                </svg>
              </button>
            )}
            <div className="text-right">
              <p className="text-sm font-medium text-slate-700">{user?.name}</p>
              <p className="text-xs capitalize text-slate-400">{user?.role}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-heading font-bold text-primary">
              {user?.name?.charAt(0) ?? '?'}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          {subBlocked ? (
            <div className="flex min-h-full items-start justify-center py-10">
              <div className="w-full max-w-3xl space-y-6">
                {/* Banner */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
                    <Clock size={24} className="text-amber-500" />
                  </div>
                  <h2 className="font-heading text-xl font-bold text-slate-800">
                    {subBlocked.status === 'trial_expired' ? 'Trial expirado' : 'Subscrição inactiva'}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">{subBlocked.message}</p>
                </div>

                {/* Pedido pendente já submetido */}
                {pendingPayment && (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-5 space-y-3">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-blue-500 shrink-0" />
                      <p className="font-semibold text-slate-800">Pedido em análise — plano <strong>{pendingPayment.plan?.name}</strong></p>
                    </div>
                    <p className="text-sm text-slate-600">Ref: <span className="font-mono font-semibold">{pendingPayment.reference}</span></p>
                    {proofSent ? (
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <CheckCircle2 size={15} /> Comprovativo enviado — aguarda confirmação (até 24h úteis).
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm text-amber-700">Comprovativo ainda não enviado.</p>
                        {!proofFile ? (
                          <button onClick={() => proofRef.current?.click()}
                            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90">
                            <Upload size={14} /> Enviar comprovativo agora
                          </button>
                        ) : (
                          <div className="flex gap-2">
                            <span className="flex-1 truncate text-sm text-slate-700">{proofFile.name}</span>
                            <button onClick={submitProof} disabled={uploadingProof}
                              className="rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
                              {uploadingProof ? '…' : 'Enviar'}
                            </button>
                          </div>
                        )}
                        <input ref={proofRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
                          onChange={e => setProofFile(e.target.files?.[0] ?? null)} />
                      </div>
                    )}
                  </div>
                )}

                {/* Planos — só mostra se não houver pedido pendente */}
                {!pendingPayment && plans.length > 0 && (
                  <div>
                    <h3 className="mb-4 text-center font-heading text-lg font-bold text-slate-800">Escolha um plano</h3>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {plans.map(plan => (
                        <div key={plan.slug} className="rounded-2xl border border-slate-200 bg-white p-5 flex flex-col">
                          <p className="font-heading font-bold text-primary text-lg">{plan.name}</p>
                          <p className="mt-1 text-2xl font-extrabold text-slate-800">
                            {plan.price_aoa.toLocaleString('pt-PT')}
                            <span className="text-sm font-normal text-slate-400 ml-1">AOA/mês</span>
                          </p>
                          <ul className="mt-3 flex-1 space-y-1.5 text-xs text-slate-600">
                            {(plan.features ?? []).map((f: string) => (
                              <li key={f} className="flex items-center gap-1.5">
                                <span className="text-primary">✓</span> {f}
                              </li>
                            ))}
                          </ul>
                          {isAdmin ? (
                            <button
                              onClick={() => handleUpgrade(plan.slug)}
                              disabled={upgrading === plan.slug}
                              className="mt-4 w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition disabled:opacity-60"
                            >
                              {upgrading === plan.slug ? 'A activar…' : `Aderir ao ${plan.name}`}
                            </button>
                          ) : (
                            <p className="mt-4 text-center text-xs text-slate-400">Apenas o admin pode activar</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}


                <div className="text-center">
                  <button onClick={handleLogout} className="text-xs text-slate-400 hover:text-slate-600 underline">
                    Terminar sessão
                  </button>
                </div>
              </div>

              {/* Modal de referência de pagamento */}
              {paymentRef && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
                  <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-green-100">
                        <CreditCard size={20} className="text-green-600" />
                      </div>
                      <div>
                        <p className="font-heading font-bold text-slate-800">Instruções de pagamento</p>
                        <p className="text-sm text-slate-500">Plano <strong>{paymentRef.plan.name}</strong> — {paymentRef.amount.toLocaleString('pt-PT')} AOA/mês</p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-slate-50 border border-slate-200 divide-y divide-slate-200 text-sm">
                      {[
                        { label: 'Referência', value: paymentRef.reference },
                        { label: 'IBAN', value: paymentRef.iban },
                        { label: 'Banco', value: paymentRef.bank },
                        { label: 'Beneficiário', value: paymentRef.beneficiary },
                        { label: 'Montante', value: `${paymentRef.amount.toLocaleString('pt-PT')} AOA` },
                      ].map(({ label, value }) => (
                        <div key={label} className="flex items-center justify-between px-4 py-2.5">
                          <span className="text-slate-500">{label}</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-slate-800">{value}</span>
                            <button onClick={() => copyToClipboard(value, label)} className="text-slate-400 hover:text-primary">
                              {copied === label ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                      Após efectuar a transferência, envie o comprovativo abaixo. A equipa RHadmin irá confirmar e activar o seu plano em até <strong>24 horas úteis</strong>.
                    </div>

                    {/* Upload comprovativo */}
                    {proofSent ? (
                      <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                        <CheckCircle2 size={16} /> Comprovativo enviado — aguarde a confirmação.
                      </div>
                    ) : !proofFile ? (
                      <button onClick={() => proofRef.current?.click()}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition">
                        <CheckCircle2 size={15} /> Já paguei — enviar comprovativo
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                          <Paperclip size={15} className="text-slate-400 shrink-0" />
                          <span className="flex-1 text-sm text-slate-700 truncate">{proofFile.name}</span>
                          <button onClick={() => setProofFile(null)} className="text-xs text-slate-400 hover:text-red-500">✕</button>
                        </div>
                        <button onClick={submitProof} disabled={uploadingProof}
                          className="w-full rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
                          {uploadingProof ? 'A enviar…' : <><Upload size={14} className="inline mr-1.5" />Enviar comprovativo</>}
                        </button>
                      </div>
                    )}
                    <input ref={proofRef} type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden"
                      onChange={e => setProofFile(e.target.files?.[0] ?? null)} />

                    <button onClick={() => { setPaymentRef(null); setProofFile(null); setProofSent(false); window.location.reload() }}
                      className="w-full rounded-xl border border-slate-200 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                      Fechar
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Outlet key={active?.id ?? 'no-company'} />
          )}
        </main>
      </div>
    </div>
  )
}
