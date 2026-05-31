import { useEffect, useState } from 'react'
import { Save, Send, Wallet, CheckCircle2, XCircle, Clock, Check, X, List, BarChart2 } from 'lucide-react'
import { toast } from 'sonner'
import { adminApi } from '../../lib/adminApi'

interface SmsRequest {
  id: number; tenant_id: number; tenant_name: string; tenant_slug: string
  status: 'pending' | 'approved' | 'rejected'
  justification: string; contact_name: string; contact_phone: string
  admin_notes: string | null; created_at: string
}

interface SmsLog {
  id: number; to: string; message: string; event: string | null
  driver: string; status: 'sent' | 'failed' | 'pending'
  provider_response: string | null; created_at: string
}

interface TenantLogsData {
  tenant: { id: number; name: string; slug: string }
  data: SmsLog[]
  total: number
}

interface UsageData {
  month: number; year: number; price_per_sms: number
  total_sms: number; total_cost: number
  tenants: { tenant_name: string; tenant_slug: string; sms_count: number; billed: boolean }[]
}

export default function AdminSms() {
  const [apiKey, setApiKey] = useState('')
  const [apiKeySet, setApiKeySet] = useState(false)
  const [saving, setSaving] = useState(false)

  const [requests, setRequests] = useState<SmsRequest[]>([])
  const [reviewing, setReviewing] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  const [testTo, setTestTo] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; response: string } | null>(null)

  const [balance, setBalance] = useState<Record<string, unknown> | null>(null)
  const [loadingBalance, setLoadingBalance] = useState(false)

  const [tenantLogs, setTenantLogs] = useState<TenantLogsData | null>(null)
  const [loadingLogs, setLoadingLogs] = useState(false)
  const [usage, setUsage] = useState<UsageData | null>(null)
  const [loadingUsage, setLoadingUsage] = useState(false)

  const loadRequests = () =>
    adminApi.get<SmsRequest[]>('/sms/requests').then(r => setRequests(r.data)).catch(() => {})

  useEffect(() => {
    adminApi.get('/sms/config').then(r => {
      setApiKeySet(r.data.api_key_set)
      if (r.data.api_key_set) setApiKey(r.data.api_key)
    }).catch(() => {})
    loadRequests()
  }, [])

  const review = async (id: number, status: 'approved' | 'rejected') => {
    setReviewing(id)
    try {
      await adminApi.post(`/sms/requests/${id}`, { status, admin_notes: notes || undefined })
      toast.success(status === 'approved' ? 'Pedido aprovado' : 'Pedido rejeitado')
      setNotes(''); loadRequests()
    } catch { toast.error('Erro') } finally { setReviewing(null) }
  }

  const saveKey = async () => {
    if (!apiKey || apiKey.includes('•')) { toast.error('Insira uma chave válida'); return }
    setSaving(true)
    try {
      await adminApi.post('/sms/config', { api_key: apiKey })
      setApiKeySet(true)
      toast.success('Chave TelcoSMS guardada')
    } catch { toast.error('Erro ao guardar') } finally { setSaving(false) }
  }

  const loadUsage = async () => {
    setLoadingUsage(true)
    try {
      const { data } = await adminApi.get<UsageData>('/sms/usage')
      setUsage(data)
    } catch { toast.error('Erro ao carregar usage') } finally { setLoadingUsage(false) }
  }

  const openTenantLogs = async (slug: string) => {
    setLoadingLogs(true); setTenantLogs(null)
    try {
      const { data } = await adminApi.get<TenantLogsData>(`/sms/tenant/${slug}/logs`)
      setTenantLogs(data)
    } catch { toast.error('Erro ao carregar logs') } finally { setLoadingLogs(false) }
  }

  const checkBalance = async () => {
    setLoadingBalance(true); setBalance(null)
    try {
      const { data } = await adminApi.get('/sms/balance')
      setBalance(data)
    } catch { toast.error('Erro — verifique a API key') } finally { setLoadingBalance(false) }
  }

  const sendTest = async (e: React.FormEvent) => {
    e.preventDefault(); setTesting(true); setTestResult(null)
    try {
      const { data } = await adminApi.post('/sms/test', { to: testTo, message: testMsg || undefined })
      setTestResult(data)
      toast[data.success ? 'success' : 'error'](data.success ? 'SMS enviado!' : 'Falha no envio')
    } catch { toast.error('Erro') } finally { setTesting(false) }
  }

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">SMS — TelcoSMS</h1>
          <p className="text-sm text-slate-400">Integração com telcosms.co.ao</p>
        </div>

      {/* API Key */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-white">API Key</h2>
          {apiKeySet && <span className="flex items-center gap-1 rounded-full bg-green-900/40 px-2 py-0.5 text-xs text-green-400"><CheckCircle2 size={11} /> Configurada</span>}
        </div>
        <div className="flex gap-3">
          <input
            className="flex-1 rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
            placeholder="prd••••••••••••••••••••"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            onFocus={() => { if (apiKey.includes('•')) setApiKey('') }}
          />
          <button onClick={saveKey} disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition disabled:opacity-60">
            <Save size={15} /> {saving ? 'A guardar...' : 'Guardar'}
          </button>
        </div>
        <p className="text-xs text-slate-500">A chave é guardada de forma segura na base de dados central.</p>
      </div>

      {/* Pedidos de acesso SMS dos tenants */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-700 px-5 py-4">
          <h2 className="font-semibold text-white">Pedidos de acesso SMS</h2>
          <span className="rounded-full bg-amber-900/40 px-2.5 py-0.5 text-xs font-medium text-amber-400">
            {requests.filter(r => r.status === 'pending').length} pendente(s)
          </span>
        </div>
        {requests.length === 0 ? (
          <p className="p-8 text-center text-sm text-slate-500">Nenhum pedido submetido.</p>
        ) : (
          <div className="divide-y divide-slate-700">
            {requests.map(r => (
              <div key={r.id} className="p-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-white">{r.tenant_name} <span className="text-slate-500 text-xs">({r.tenant_slug})</span></p>
                    <p className="text-xs text-slate-400 mt-0.5">{r.contact_name} · {r.contact_phone}</p>
                    <p className="text-sm text-slate-300 mt-2 max-w-lg">{r.justification}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => openTenantLogs(r.tenant_slug)}
                      className="flex items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1 text-xs text-slate-300 hover:border-primary hover:text-primary transition">
                      <List size={12} /> Logs
                    </button>
                    {r.status === 'pending' ? (
                      <span className="flex items-center gap-1 rounded-full bg-amber-900/40 px-2.5 py-1 text-xs text-amber-400"><Clock size={11} /> Pendente</span>
                    ) : r.status === 'approved' ? (
                      <span className="flex items-center gap-1 rounded-full bg-green-900/40 px-2.5 py-1 text-xs text-green-400"><CheckCircle2 size={11} /> Aprovado</span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-red-900/40 px-2.5 py-1 text-xs text-red-400"><XCircle size={11} /> Rejeitado</span>
                    )}
                  </div>
                </div>
                {r.status === 'pending' && (
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      className="flex-1 rounded-lg border border-slate-600 bg-slate-700 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                      placeholder="Nota opcional para o tenant…"
                      value={reviewing === r.id ? notes : ''}
                      onFocus={() => setReviewing(r.id)}
                      onChange={e => setNotes(e.target.value)}
                    />
                    <button onClick={() => review(r.id, 'approved')} disabled={reviewing === r.id && !notes && reviewing !== null}
                      className="flex items-center gap-1.5 rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-600 transition">
                      <Check size={13} /> Aprovar
                    </button>
                    <button onClick={() => review(r.id, 'rejected')}
                      className="flex items-center gap-1.5 rounded-lg bg-red-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition">
                      <X size={13} /> Rejeitar
                    </button>
                  </div>
                )}
                {r.admin_notes && (
                  <p className="text-xs text-slate-400 italic">Nota: {r.admin_notes}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Saldo */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 space-y-4">
        <h2 className="font-semibold text-white">Verificar saldo</h2>
        <button onClick={checkBalance} disabled={loadingBalance || !apiKeySet}
          className="flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm text-slate-300 hover:border-primary hover:text-primary transition disabled:opacity-40">
          <Wallet size={15} className={loadingBalance ? 'animate-pulse' : ''} />
          {loadingBalance ? 'A verificar...' : 'Consultar saldo TelcoSMS'}
        </button>
        {balance && (
          <div className="rounded-lg bg-slate-700/50 p-4">
            <pre className="text-xs text-slate-300 whitespace-pre-wrap">{JSON.stringify(balance, null, 2)}</pre>
          </div>
        )}
      </div>

      {/* Usage SMS por tenant */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Faturação SMS — mês corrente</h2>
          <button onClick={loadUsage} disabled={loadingUsage}
            className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:border-primary hover:text-primary transition disabled:opacity-40">
            <BarChart2 size={13} className={loadingUsage ? 'animate-pulse' : ''} />
            {loadingUsage ? 'A carregar...' : 'Ver usage'}
          </button>
        </div>
        {usage && (
          <div className="space-y-3">
            <div className="flex items-center gap-6 rounded-xl bg-slate-700/50 px-5 py-3">
              <div>
                <p className="text-xs text-slate-400">Total SMS enviados</p>
                <p className="text-xl font-bold text-white">{usage.total_sms}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Preço unitário</p>
                <p className="text-xl font-bold text-white">{usage.price_per_sms} AOA</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Total a faturar</p>
                <p className="text-xl font-bold text-primary">{usage.total_cost.toLocaleString('pt-PT')} AOA</p>
              </div>
            </div>
            {usage.tenants.length > 0 && (
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-400">
                  <tr>
                    <th className="py-2 text-left">Tenant</th>
                    <th className="py-2 text-right">SMS</th>
                    <th className="py-2 text-right">Custo</th>
                    <th className="py-2 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {usage.tenants.map((t, i) => (
                    <tr key={i}>
                      <td className="py-2 text-white">{t.tenant_name} <span className="text-slate-500 text-xs">({t.tenant_slug})</span></td>
                      <td className="py-2 text-right text-slate-300">{t.sms_count}</td>
                      <td className="py-2 text-right font-mono text-slate-300">{(t.sms_count * usage.price_per_sms).toLocaleString('pt-PT')} AOA</td>
                      <td className="py-2 text-right">
                        {t.billed
                          ? <span className="text-xs text-green-400">Faturado</span>
                          : <span className="text-xs text-amber-400">Pendente</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {usage.tenants.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">Sem SMS enviados este mês.</p>
            )}
          </div>
        )}
      </div>

      {/* Teste */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-6 space-y-4">
        <h2 className="font-semibold text-white">Enviar SMS de teste</h2>
        <form onSubmit={sendTest} className="space-y-3">
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Número de destino</label>
            <input
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              placeholder="923000000 (sem +244)"
              value={testTo} onChange={e => setTestTo(e.target.value)} required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-slate-400">Mensagem (opcional)</label>
            <input
              className="w-full rounded-lg border border-slate-600 bg-slate-700 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              placeholder="Mensagem de teste RHadmin…"
              maxLength={160}
              value={testMsg} onChange={e => setTestMsg(e.target.value)}
            />
          </div>
          <button type="submit" disabled={testing || !apiKeySet}
            className="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition disabled:opacity-40">
            <Send size={15} /> {testing ? 'A enviar...' : 'Enviar SMS'}
          </button>
        </form>

        {testResult && (
          <div className={`flex items-start gap-3 rounded-lg p-4 ${testResult.success ? 'bg-green-900/20 border border-green-800' : 'bg-red-900/20 border border-red-800'}`}>
            {testResult.success
              ? <CheckCircle2 size={18} className="text-green-400 mt-0.5 shrink-0" />
              : <XCircle size={18} className="text-red-400 mt-0.5 shrink-0" />}
            <div>
              <p className={`text-sm font-semibold ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
                {testResult.success ? 'SMS enviado com sucesso' : 'Falha no envio'}
              </p>
              <pre className="mt-1 text-xs text-slate-400 whitespace-pre-wrap">{testResult.response}</pre>
            </div>
          </div>
        )}
      </div>
    </div>

      {/* Modal logs do tenant */}
      {(tenantLogs || loadingLogs) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setTenantLogs(null)}>
          <div className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-xl border border-slate-700 bg-slate-900 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-700 px-6 py-4">
              <div>
                <h3 className="font-semibold text-white">
                  Logs SMS — {tenantLogs?.tenant.name ?? '…'}
                  <span className="ml-2 text-xs text-slate-400">({tenantLogs?.tenant.slug})</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{tenantLogs?.total ?? 0} registo(s)</p>
              </div>
              <button onClick={() => setTenantLogs(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white transition">
                <X size={16} />
              </button>
            </div>

            <div className="overflow-auto flex-1">
              {loadingLogs ? (
                <div className="flex items-center justify-center py-16 text-slate-500 text-sm">A carregar…</div>
              ) : tenantLogs?.data.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-slate-500 text-sm">Sem logs de SMS para este tenant.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-800 text-xs text-slate-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Data</th>
                      <th className="px-4 py-3 text-left">Para</th>
                      <th className="px-4 py-3 text-left">Evento</th>
                      <th className="px-4 py-3 text-left">Mensagem</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {tenantLogs?.data.map(log => (
                      <tr key={log.id} className="hover:bg-slate-800/50">
                        <td className="px-4 py-3 text-slate-400 whitespace-nowrap text-xs">
                          {new Date(log.created_at.replace(' ', 'T')).toLocaleString('pt-PT', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-3 text-white font-mono text-xs whitespace-nowrap">{log.to}</td>
                        <td className="px-4 py-3 text-slate-400 text-xs">{log.event ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-300 text-xs max-w-xs truncate" title={log.message}>{log.message}</td>
                        <td className="px-4 py-3">
                          {log.status === 'sent' ? (
                            <span className="flex items-center gap-1 text-green-400 text-xs"><CheckCircle2 size={11} /> enviado</span>
                          ) : log.status === 'failed' ? (
                            <span className="flex items-center gap-1 text-red-400 text-xs"><XCircle size={11} /> falhou</span>
                          ) : (
                            <span className="flex items-center gap-1 text-amber-400 text-xs"><Clock size={11} /> pendente</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
