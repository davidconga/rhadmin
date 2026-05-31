import { useEffect, useState } from 'react'
import { CheckCircle2, XCircle, Clock, RefreshCw, Paperclip, FileDown } from 'lucide-react'
import { toast } from 'sonner'
import { adminApi } from '../../lib/adminApi'
import { ConfirmModal, Spinner } from '../../components/ui'

interface PaymentReq {
  id: number
  reference: string
  amount: number
  status: 'pending' | 'paid' | 'rejected'
  proof_path?: string
  fr_number?: string | null
  fr_path?: string | null
  created_at: string
  reviewed_at?: string
  notes?: string
  tenant: { id: number; name: string; slug: string }
  plan: { name: string; slug: string }
}
interface Paginated { data: PaymentReq[]; total: number; current_page: number; last_page: number }

const STATUS: Record<string, { label: string; style: string }> = {
  pending:  { label: 'Pendente',  style: 'bg-amber-900/40 text-amber-400' },
  paid:     { label: 'Aprovado',  style: 'bg-green-900/40 text-green-400' },
  rejected: { label: 'Rejeitado', style: 'bg-red-900/40 text-red-400' },
}

export default function AdminPayments() {
  const [data, setData] = useState<Paginated | null>(null)
  const [statusFilter, setStatusFilter] = useState('pending')
  const [rejectModal, setRejectModal] = useState<PaymentReq | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [processing, setProcessing] = useState<number | null>(null)
  const [proofUrl, setProofUrl] = useState<{ url: string; paymentId: number } | null>(null)
  const [frUrl, setFrUrl] = useState<{ url: string; label: string } | null>(null)

  const viewProof = async (p: PaymentReq) => {
    try {
      const res = await adminApi.get(`/payments/${p.id}/proof`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      setProofUrl({ url, paymentId: p.id })
    } catch { toast.error('Erro ao carregar comprovativo') }
  }

  const viewFr = async (p: PaymentReq) => {
    try {
      const res = await adminApi.get(`/payments/${p.id}/fr`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      setFrUrl({ url, label: p.fr_number ? `FR ${p.fr_number} — ${p.tenant.name}` : `Factura-Recibo — ${p.tenant.name}` })
    } catch { toast.error('Erro ao abrir FR') }
  }

  const load = async () => {
    const res = await adminApi.get<Paginated>('/payments', { params: { status: statusFilter || undefined } })
    setData(res.data)
  }
  useEffect(() => { load() }, [statusFilter])

  const approve = async (p: PaymentReq) => {
    setProcessing(p.id)
    try {
      await adminApi.post(`/payments/${p.id}/approve`)
      toast.success(`Plano ${p.plan.name} activado para ${p.tenant.name}`)
      load()
    } catch { toast.error('Erro ao aprovar') }
    finally { setProcessing(null) }
  }

  const reject = async () => {
    if (!rejectModal) return
    try {
      await adminApi.post(`/payments/${rejectModal.id}/reject`, { reason: rejectReason })
      toast.success('Pedido rejeitado')
      setRejectModal(null); setRejectReason(''); load()
    } catch { toast.error('Erro ao rejeitar') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Pagamentos</h1>
          <p className="text-sm text-slate-400">{data?.total ?? '—'} pedidos</p>
        </div>
        <button onClick={load} className="rounded-lg border border-slate-600 p-2 text-slate-400 hover:text-white">
          <RefreshCw size={16} />
        </button>
      </div>

      <div className="flex gap-2">
        {['pending', 'paid', 'rejected', ''].map(s => (
          <button key={s}
            onClick={() => setStatusFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${statusFilter === s ? 'bg-primary text-white' : 'border border-slate-600 text-slate-400 hover:text-white'}`}>
            {s === '' ? 'Todos' : STATUS[s]?.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3">Referência</th>
              <th className="px-4 py-3">Tenant</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3 text-right">Montante</th>
              <th className="px-4 py-3">Estado</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {(data?.data ?? []).map(p => (
              <tr key={p.id} className="hover:bg-slate-700/50">
                <td className="px-4 py-3 font-mono text-xs text-slate-300">{p.reference}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-white">{p.tenant.name}</p>
                  <p className="text-xs text-slate-500">{p.tenant.slug}</p>
                </td>
                <td className="px-4 py-3 text-slate-300">{p.plan.name}</td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">{p.amount.toLocaleString('pt-PT')} AOA</td>
                <td className="px-4 py-3">
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[p.status]?.style}`}>
                    {STATUS[p.status]?.label}
                  </span>
                  {p.notes && <p className="mt-0.5 text-xs text-slate-500 max-w-xs truncate">{p.notes}</p>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">{new Date(p.created_at).toLocaleDateString('pt-PT')}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    {p.status === 'pending' && p.proof_path && (
                      <button onClick={() => viewProof(p)} title="Ver comprovativo"
                        className="rounded p-1.5 text-slate-500 hover:bg-blue-900/30 hover:text-blue-400">
                        <Paperclip size={14} />
                      </button>
                    )}
                    {p.status === 'pending' && (
                      <>
                        <button onClick={() => approve(p)} disabled={processing === p.id} title="Aprovar"
                          className="rounded p-1.5 text-slate-500 hover:bg-green-900/30 hover:text-green-400 disabled:opacity-40">
                          {processing === p.id ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        </button>
                        <button onClick={() => { setRejectModal(p); setRejectReason('') }} title="Rejeitar"
                          className="rounded p-1.5 text-slate-500 hover:bg-red-900/30 hover:text-red-400">
                          <XCircle size={14} />
                        </button>
                      </>
                    )}
                    {p.status === 'paid' && (
                      <button onClick={() => viewFr(p)} title={p.fr_number ? `Ver FR ${p.fr_number}` : 'Ver Factura-Recibo'}
                        className="rounded p-1.5 text-slate-500 hover:bg-primary/20 hover:text-primary">
                        <FileDown size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {data?.data.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                <Clock size={24} className="mx-auto mb-2 opacity-30" />
                Sem pedidos {statusFilter ? STATUS[statusFilter]?.label.toLowerCase() + 's' : ''}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal comprovativo */}
      {proofUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-2.5">
            <span className="text-sm font-medium text-slate-200">Comprovativo de pagamento</span>
            <div className="flex gap-2">
              <a href={proofUrl.url} download={`comprovativo-${proofUrl.paymentId}`}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:text-white">
                Descarregar
              </a>
              <button onClick={() => { URL.revokeObjectURL(proofUrl.url); setProofUrl(null) }}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-white">
                Fechar
              </button>
            </div>
          </div>
          <iframe src={proofUrl.url} className="flex-1 w-full" title="Comprovativo" />
        </div>
      )}

      {/* Overlay FR */}
      {frUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-2.5">
            <span className="text-sm font-medium text-slate-200">{frUrl.label}</span>
            <div className="flex gap-2">
              <a href={frUrl.url} download={`${frUrl.label}.pdf`}
                className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:text-white">
                Descarregar
              </a>
              <button onClick={() => { URL.revokeObjectURL(frUrl.url); setFrUrl(null) }}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-white">
                Fechar
              </button>
            </div>
          </div>
          <iframe src={frUrl.url} className="flex-1 w-full" title="Factura-Recibo" />
        </div>
      )}

      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-800 border border-slate-700 p-6 space-y-4">
            <p className="font-semibold text-white">Rejeitar pedido de {rejectModal.tenant.name}</p>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Motivo (opcional)</label>
              <textarea className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
                rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)}
                placeholder="Ex: Pagamento não identificado..." />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setRejectModal(null)} className="flex-1 rounded-lg border border-slate-600 py-2 text-sm text-slate-400">Cancelar</button>
              <button onClick={reject} className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-500">Rejeitar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
