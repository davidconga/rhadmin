import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Clock, Zap, AlertTriangle, FileDown, Receipt, Eye, CreditCard, Copy, Paperclip, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { Card, Spinner } from '../components/ui'
import { useAuth } from '../stores/auth'

interface Plan {
  id: number; slug: string; name: string; description: string
  price_aoa: number; max_companies: number; max_employees: number
  max_users: number; features: string[]
}
interface Usage { current: number; limit: number | string }
interface SubscriptionData {
  tenant: { name: string; subscription_status: string; trial_ends_at: string | null; subscribed_at: string | null }
  plan: Plan | null
  trial_days_remaining: number | null
  subscription_days_remaining: number | null
  sms_usage: { count: number; cost: number; price_per_sms: number } | null
  usage?: { companies: Usage; employees: Usage; users: Usage }
}
interface PaymentRecord {
  id: number; reference: string; amount: number; status: string
  fr_number?: string | null; fr_path?: string | null
  reviewed_at?: string | null; created_at: string
  plan: { name: string }
}

const STATUS_INFO: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  trial:     { label: 'Trial',     color: 'bg-amber-100 text-amber-700',  icon: <Clock size={14} /> },
  active:    { label: 'Activo',    color: 'bg-green-100 text-green-700',  icon: <CheckCircle2 size={14} /> },
  suspended: { label: 'Suspenso',  color: 'bg-red-100 text-red-700',      icon: <AlertTriangle size={14} /> },
  cancelled: { label: 'Cancelado', color: 'bg-slate-100 text-slate-500',  icon: <AlertTriangle size={14} /> },
}

const fmt = (n: number) => n >= 999 ? 'Ilimitado' : n.toLocaleString('pt-PT')
const fmtMoney = (n: number) => n === 0 ? 'Grátis' : `${n.toLocaleString('pt-PT')} AOA/mês`

export default function Subscription() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [sub, setSub] = useState<SubscriptionData | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [confirmPlan, setConfirmPlan] = useState<Plan | null>(null)
  const [frUrl, setFrUrl] = useState<{ url: string; label: string } | null>(null)
  const [paymentRef, setPaymentRef] = useState<{ reference: string; amount: number; original_amount: number; discount: number; plan: { name: string }; iban: string; bank: string; beneficiary: string } | null>(null)
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [proofSent, setProofSent] = useState(false)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const proofRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [subRes, plansRes, paymentsRes] = await Promise.all([
        api.get<SubscriptionData>('/subscription'),
        api.get<Plan[]>('/plans'),
        api.get<PaymentRecord[]>('/subscription/payments'),
      ])
      setSub(subRes.data)
      setPlans(plansRes.data)
      setPayments(paymentsRes.data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const viewFr = async (p: PaymentRecord) => {
    try {
      const res = await api.get(`/subscription/payments/${p.id}/fr`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      setFrUrl({ url, label: p.fr_number ? `Factura-Recibo ${p.fr_number}` : 'Factura-Recibo' })
    } catch { toast.error('Erro ao abrir Factura-Recibo') }
  }

  const requestUpgrade = (plan: Plan) => {
    if (!isAdmin) return
    setConfirmPlan(plan)
  }

  const upgrade = async () => {
    if (!confirmPlan) return
    setUpgrading(confirmPlan.slug)
    setConfirmPlan(null)
    try {
      const { data } = await api.post('/subscription/upgrade', { plan_slug: confirmPlan.slug })
      setPaymentRef(data)
      setProofFile(null)
      setProofSent(false)
    } catch {
      toast.error('Erro ao criar pedido de pagamento')
    } finally {
      setUpgrading(null)
    }
  }

  const submitProof = async () => {
    if (!proofFile) return
    setUploadingProof(true)
    try {
      const fd = new FormData()
      fd.append('proof', proofFile)
      await api.post('/subscription/proof', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setProofSent(true)
      toast.success('Comprovativo enviado. Aguarde a confirmação em até 24h úteis.')
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

  if (loading) return <Spinner />

  const status = sub?.tenant.subscription_status ?? 'trial'
  const statusInfo = STATUS_INFO[status] ?? STATUS_INFO.trial

  return (
    <>
    {frUrl && (
      <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
        <div className="flex items-center justify-between bg-white px-4 py-2.5 border-b border-slate-200">
          <span className="text-sm font-semibold text-slate-800">{frUrl.label}</span>
          <div className="flex gap-2">
            <a href={frUrl.url} download={`${frUrl.label}.pdf`}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              Descarregar
            </a>
            <button onClick={() => { URL.revokeObjectURL(frUrl.url); setFrUrl(null) }}
              className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">
              Fechar
            </button>
          </div>
        </div>
        <iframe src={frUrl.url} className="flex-1 w-full" title="Factura-Recibo" />
      </div>
    )}

    {confirmPlan && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl space-y-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100">
            <AlertTriangle size={22} className="text-amber-600" />
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold text-slate-800">Mudar para {confirmPlan.name}?</h3>
            {sub?.subscription_days_remaining != null && sub.subscription_days_remaining > 0 && sub.plan ? (() => {
              const dailyRate = Math.round(sub.plan.price_aoa / 30)
              const credit    = Math.min(confirmPlan.price_aoa, dailyRate * sub.subscription_days_remaining)
              const toPay     = Math.max(0, confirmPlan.price_aoa - credit)
              return (
                <div className="mt-2 space-y-3 text-sm text-slate-600">
                  <p>O plano actual ainda tem <strong>{sub.subscription_days_remaining} dias</strong> restantes.</p>
                  <div className="rounded-xl border border-green-200 bg-green-50 p-3 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Plano {confirmPlan.name}</span>
                      <span>{confirmPlan.price_aoa.toLocaleString('pt-PT')} AOA</span>
                    </div>
                    <div className="flex justify-between text-green-700">
                      <span>Crédito ({sub.subscription_days_remaining}d × {dailyRate.toLocaleString('pt-PT')} AOA/dia)</span>
                      <span>− {credit.toLocaleString('pt-PT')} AOA</span>
                    </div>
                    <div className="flex justify-between font-bold border-t border-green-200 pt-1 text-slate-800">
                      <span>A pagar agora</span>
                      <span>{toPay.toLocaleString('pt-PT')} AOA</span>
                    </div>
                  </div>
                </div>
              )
            })() : (
              <p className="mt-2 text-sm text-slate-600">
                Será criado um pedido de pagamento para o plano <strong>{confirmPlan.name}</strong> ({confirmPlan.price_aoa.toLocaleString('pt-PT')} AOA/mês).
                O plano é activado após confirmação da transferência.
              </p>
            )}
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={() => setConfirmPlan(null)}
              className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
              Cancelar
            </button>
            <button onClick={upgrade} disabled={upgrading === confirmPlan.slug}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
              {upgrading === confirmPlan.slug ? <Zap size={14} className="inline animate-pulse" /> : 'Confirmar'}
            </button>
          </div>
        </div>
      </div>
    )}

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
            {([
              { label: 'Referência',   value: paymentRef.reference },
              { label: 'IBAN',         value: paymentRef.iban },
              { label: 'Banco',        value: paymentRef.bank },
              { label: 'Beneficiário', value: paymentRef.beneficiary },
              ...(paymentRef.discount > 0 ? [
                { label: 'Valor base',  value: `${paymentRef.original_amount.toLocaleString('pt-PT')} AOA` },
                { label: 'Crédito dias restantes', value: `− ${paymentRef.discount.toLocaleString('pt-PT')} AOA` },
              ] : []),
              { label: 'Montante a pagar', value: `${paymentRef.amount.toLocaleString('pt-PT')} AOA` },
            ] as { label: string; value: string }[]).map(({ label, value }) => (
              <div key={label} className={`flex items-center justify-between px-4 py-2.5 ${label === 'Crédito dias restantes' ? 'text-green-700' : ''}`}>
                <span className={label === 'Crédito dias restantes' ? 'text-green-600' : 'text-slate-500'}>{label}</span>
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${label === 'Montante a pagar' ? 'text-primary font-bold' : label === 'Crédito dias restantes' ? 'text-green-700' : 'text-slate-800'}`}>{value}</span>
                  {label !== 'Valor base' && label !== 'Crédito dias restantes' && (
                    <button onClick={() => copyToClipboard(value.replace(' AOA','').replace('− ',''), label)} className="text-slate-400 hover:text-primary">
                      {copied === label ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-700">
            Após efectuar a transferência, envie o comprovativo abaixo. A equipa RHadmin irá confirmar e activar o seu plano em até <strong>24 horas úteis</strong>.
          </div>

          {proofSent ? (
            <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
              <CheckCircle2 size={16} /> Comprovativo enviado — aguarde a confirmação.
            </div>
          ) : !proofFile ? (
            <button onClick={() => proofRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition">
              <Paperclip size={15} /> Já paguei — enviar comprovativo
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

          <button onClick={() => { setPaymentRef(null); setProofFile(null); load() }}
            className="w-full rounded-xl border border-slate-200 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
            Fechar
          </button>
        </div>
      </div>
    )}
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary">Subscrição</h1>
        <p className="text-sm text-slate-500">Plano actual e gestão da subscrição</p>
      </div>

      {/* Plano actual */}
      <Card className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Plano actual</p>
            <h2 className="font-heading text-2xl font-bold text-slate-900 mt-0.5">
              {sub?.plan?.name ?? 'Sem plano'}
            </h2>
            {sub?.plan && (
              <p className="text-sm text-slate-500 mt-1">{fmtMoney(sub.plan.price_aoa)}</p>
            )}
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${statusInfo.color}`}>
              {statusInfo.icon} {statusInfo.label}
            </span>
            {status === 'trial' && sub?.trial_days_remaining !== null && (
              <div className="flex items-center gap-2">
                <svg width="36" height="36" viewBox="0 0 40 40" className="shrink-0">
                  <circle cx="20" cy="20" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                  <circle cx="20" cy="20" r="16" fill="none"
                    stroke={(sub.trial_days_remaining ?? 0) <= 2 ? '#ef4444' : (sub.trial_days_remaining ?? 0) <= 4 ? '#f59e0b' : '#085041'}
                    strokeWidth="3.5"
                    strokeDasharray={`${Math.round(((sub.trial_days_remaining ?? 0) / 7) * 100.5)} 100.5`}
                    strokeLinecap="round" transform="rotate(-90 20 20)" />
                  <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="700"
                    fill={(sub.trial_days_remaining ?? 0) <= 2 ? '#ef4444' : (sub.trial_days_remaining ?? 0) <= 4 ? '#f59e0b' : '#085041'}>
                    {sub.trial_days_remaining}d
                  </text>
                </svg>
                <p className="text-sm text-amber-600 font-medium">{sub.trial_days_remaining} dias restantes de trial</p>
              </div>
            )}
            {status === 'active' && sub?.subscription_days_remaining !== null && (
              <div className="flex items-center gap-2">
                <svg width="36" height="36" viewBox="0 0 40 40" className="shrink-0">
                  <circle cx="20" cy="20" r="16" fill="none" stroke="#e2e8f0" strokeWidth="3.5" />
                  <circle cx="20" cy="20" r="16" fill="none"
                    stroke={(sub.subscription_days_remaining ?? 0) <= 3 ? '#ef4444' : (sub.subscription_days_remaining ?? 0) <= 7 ? '#f59e0b' : '#085041'}
                    strokeWidth="3.5"
                    strokeDasharray={`${Math.round(((sub.subscription_days_remaining ?? 0) / 30) * 100.5)} 100.5`}
                    strokeLinecap="round" transform="rotate(-90 20 20)" />
                  <text x="20" y="24" textAnchor="middle" fontSize="11" fontWeight="700"
                    fill={(sub.subscription_days_remaining ?? 0) <= 3 ? '#ef4444' : (sub.subscription_days_remaining ?? 0) <= 7 ? '#f59e0b' : '#085041'}>
                    {sub.subscription_days_remaining}d
                  </text>
                </svg>
                <p className="text-sm text-slate-600 font-medium">{sub.subscription_days_remaining} dias até à renovação</p>
              </div>
            )}
            {sub?.tenant.subscribed_at && (
              <p className="text-xs text-slate-400">
                Activo desde {new Date(sub.tenant.subscribed_at).toLocaleDateString('pt-PT')}
              </p>
            )}
          </div>
        </div>

        {sub?.plan && (
          <div className="mt-5 space-y-3">
            {([
              { label: 'Empresas',      key: 'companies' as const },
              { label: 'Funcionários',  key: 'employees' as const },
              { label: 'Utilizadores',  key: 'users'     as const },
            ]).map(({ label, key }) => {
              const usage   = sub.usage?.[key]
              const current = usage?.current ?? 0
              const limit   = usage?.limit
              const isUnlimited = limit === '∞' || (typeof limit === 'number' && limit >= 999)
              const pct     = isUnlimited ? 0 : typeof limit === 'number' ? Math.min(100, (current / limit) * 100) : 0
              const near    = pct >= 80

              return (
                <div key={key}>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>{label}</span>
                    <span className={near ? 'font-semibold text-amber-600' : ''}>
                      {current} / {isUnlimited ? '∞' : limit}
                    </span>
                  </div>
                  {!isUnlimited && (
                    <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${near ? 'bg-amber-400' : 'bg-primary'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {/* SMS acumulados */}
      {(sub?.sms_usage?.count ?? 0) > 0 && (
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">SMS enviados este período</h3>
              <p className="mt-0.5 text-sm text-slate-500">Será cobrado na próxima mensalidade</p>
            </div>
            <div className="text-right">
              <p className="font-heading text-2xl font-bold text-primary">
                {sub!.sms_usage!.cost.toLocaleString('pt-PT')} AOA
              </p>
              <p className="text-xs text-slate-400">
                {sub!.sms_usage!.count} SMS × {sub!.sms_usage!.price_per_sms} AOA
              </p>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.min(100, (sub!.sms_usage!.count / 100) * 100)}%` }} />
          </div>
        </Card>
      )}

      {/* Histórico de pagamentos */}
      {payments.length > 0 && (
        <div>
          <h2 className="font-heading text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Receipt size={18} className="text-primary" /> Histórico de Pagamentos
          </h2>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Referência</th>
                    <th className="px-4 py-3">Plano</th>
                    <th className="px-4 py-3 text-right">Montante</th>
                    <th className="px-4 py-3">Estado</th>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Nº FR</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payments.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{p.reference}</td>
                      <td className="px-4 py-3 text-slate-700">{p.plan?.name}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-700">{p.amount.toLocaleString('pt-PT')} AOA</td>
                      <td className="px-4 py-3">
                        {p.status === 'paid' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                            <CheckCircle2 size={11} /> Pago
                          </span>
                        )}
                        {p.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700">
                            Rejeitado
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {new Date(p.reviewed_at ?? p.created_at).toLocaleDateString('pt-PT')}
                      </td>
                      <td className="px-4 py-3">
                        {p.fr_number ? (
                          <span className="font-mono text-xs text-primary">{p.fr_number}</span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.status === 'paid' && (
                          <button onClick={() => viewFr(p)}
                            title="Visualizar Factura-Recibo"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/5 transition">
                            <Eye size={13} /> Ver FR
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Comparação de planos */}
      <div>
        <h2 className="font-heading text-lg font-bold text-slate-800 mb-4">Mudar de plano</h2>
        {!isAdmin && (
          <p className="mb-4 text-sm text-amber-600 flex items-center gap-2">
            <AlertTriangle size={15} /> Apenas administradores podem alterar o plano.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = sub?.plan?.slug === plan.slug
            return (
              <Card key={plan.id} className={`p-5 flex flex-col ${isCurrent ? 'ring-2 ring-primary' : ''}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-heading font-bold text-slate-900">{plan.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{plan.description}</p>
                  </div>
                  {isCurrent && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Actual</span>
                  )}
                </div>
                <p className="font-heading text-2xl font-bold text-slate-900 mb-4">{fmtMoney(plan.price_aoa)}</p>
                <ul className="space-y-1.5 flex-1 mb-5">
                  {(plan.features ?? []).map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs text-slate-600">
                      <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-primary" /> {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => requestUpgrade(plan)}
                  disabled={isCurrent || !isAdmin || upgrading === plan.slug}
                  className={`w-full rounded-lg py-2.5 text-sm font-semibold transition ${
                    isCurrent
                      ? 'bg-primary/10 text-primary cursor-default'
                      : 'btn-primary disabled:opacity-50'
                  }`}
                >
                  {upgrading === plan.slug ? (
                    <span className="flex items-center justify-center gap-2"><Zap size={14} className="animate-pulse" /> A actualizar…</span>
                  ) : isCurrent ? 'Plano actual' : `Mudar para ${plan.name}`}
                </button>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
    </>
  )
}
