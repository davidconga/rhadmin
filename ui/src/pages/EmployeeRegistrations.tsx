import { useEffect, useState } from 'react'
import { Check, X, Clock, CheckCircle2, XCircle, Send } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { getTenant } from '../lib/api'
import { useCompany } from '../stores/company'
import { Card, Spinner, Modal } from '../components/ui'

interface Registration {
  id: number; full_name: string; email?: string; phone?: string
  bi_nif?: string; position?: string
  has_password?: boolean
  status: 'pending' | 'approved' | 'rejected'; admin_notes?: string
  employee_id?: number; created_at: string
}

interface ApproveForm { base_salary: string; password: string; create_account: boolean; send_sms: boolean; admin_notes: string }

export default function EmployeeRegistrations() {
  const { active: activeCompany } = useCompany()
  const tenantName = activeCompany?.name ?? getTenant()

  const [list, setList] = useState<Registration[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Registration | null>(null)
  const [approveModal, setApproveModal] = useState(false)
  const [rejectNotes, setRejectNotes] = useState('')
  const [rejectModal, setRejectModal] = useState(false)
  const [form, setForm] = useState<ApproveForm>({ base_salary: '', password: '', create_account: true, send_sms: false, admin_notes: '' })
  const [saving, setSaving] = useState(false)
  const [inviteModal, setInviteModal] = useState(false)
  const [invitePhone, setInvitePhone] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)

  const load = () => {
    setLoading(true)
    api.get<{ data: Registration[] }>('/employee-registrations')
      .then(r => setList(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const sendInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    try {
      const res = await api.post('/employee-registrations/invite', {
        phone: invitePhone,
        name: inviteName || undefined,
      })
      toast.success(res.data.message)
      setInviteModal(false); setInvitePhone(''); setInviteName('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao enviar convite')
    } finally { setInviting(false) }
  }

  const openApprove = (r: Registration) => { setSelected(r); setForm({ base_salary: '', password: '', create_account: true, send_sms: !!r.phone, admin_notes: '' }); setApproveModal(true) }
  const openReject  = (r: Registration) => { setSelected(r); setRejectNotes(''); setRejectModal(true) }

  const approve = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected) return
    setSaving(true)
    try {
      const res = await api.post(`/employee-registrations/${selected.id}/approve`, {
        base_salary: Number(form.base_salary) || 0,
        password: form.password || undefined,
        create_account: form.create_account,
        send_sms: form.send_sms,
        admin_notes: form.admin_notes || undefined,
      })
      if (form.send_sms && !res.data.sms_sent) toast.warning('SMS não enviado — verifique a API key TelcoSMS')
      toast.success('Funcionário aprovado e criado!')
      setApproveModal(false); load()
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      toast.error(msg ?? 'Erro ao aprovar')
    } finally { setSaving(false) }
  }

  const reject = async () => {
    if (!selected) return
    setSaving(true)
    try {
      await api.post(`/employee-registrations/${selected.id}/reject`, { admin_notes: rejectNotes || undefined })
      toast.success('Pedido rejeitado')
      setRejectModal(false); load()
    } catch { toast.error('Erro ao rejeitar') } finally { setSaving(false) }
  }

  const pending = list.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Pedidos de Admissão</h1>
          <p className="text-sm text-slate-500">Auto-registos submetidos por candidatos</p>
        </div>
        <div className="flex items-center gap-3">
          {pending > 0 && (
            <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700">
              {pending} pendente{pending !== 1 ? 's' : ''}
            </span>
          )}
          <button onClick={() => setInviteModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition">
            <Send size={15} /> Convidar por SMS
          </button>
        </div>
      </div>

      <Card className="overflow-hidden">
        {loading ? <div className="flex justify-center py-12"><Spinner /></div>
        : list.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500">Nenhum pedido recebido.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {list.map(r => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800">{r.full_name}</p>
                      {r.status === 'pending' && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700"><Clock size={10} /> Pendente</span>
                      )}
                      {r.status === 'approved' && (
                        <span className="flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700"><CheckCircle2 size={10} /> Aprovado</span>
                      )}
                      {r.status === 'rejected' && (
                        <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-600"><XCircle size={10} /> Rejeitado</span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {[r.position, r.department].filter(Boolean).join(' · ')}
                      {r.email && ` · ${r.email}`}
                      {r.phone && ` · ${r.phone}`}
                    </p>
                    {r.notes && <p className="mt-1 text-sm text-slate-600 max-w-xl">{r.notes}</p>}
                    {r.admin_notes && <p className="mt-1 text-xs text-slate-400 italic">Nota: {r.admin_notes}</p>}
                    <p className="mt-1 text-xs text-slate-400">
                      Submetido em {new Date(r.created_at.replace(' ', 'T')).toLocaleDateString('pt-PT')}
                    </p>
                  </div>
                  {r.status === 'pending' && (
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => openApprove(r)}
                        className="flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500 transition">
                        <Check size={13} /> Aprovar
                      </button>
                      <button onClick={() => openReject(r)}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition">
                        <X size={13} /> Rejeitar
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Modal aprovação */}
      <Modal open={approveModal} onClose={() => setApproveModal(false)} title={`Aprovar — ${selected?.full_name}`}>
        <form onSubmit={approve} className="space-y-4">
          <div>
            <label className="label">Salário base (AOA) *</label>
            <input type="number" className="input" value={form.base_salary} onChange={e => setForm(f => ({ ...f, base_salary: e.target.value }))} required min="0" />
          </div>
          <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-slate-200 px-4 py-3">
            <input type="checkbox" checked={form.create_account} onChange={e => setForm(f => ({ ...f, create_account: e.target.checked }))} className="h-4 w-4 rounded border-slate-300 text-primary" />
            <div>
              <p className="text-sm font-medium text-slate-700">Criar conta de acesso ao portal</p>
              <p className="text-xs text-slate-400">O funcionário poderá aceder ao Portal e validar os recibos</p>
            </div>
          </label>
          {form.create_account && (
            selected?.has_password ? (
              <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
                <CheckCircle2 size={15} className="shrink-0" />
                O funcionário já definiu a sua senha durante o registo.
              </div>
            ) : (
              <div>
                <label className="label">Palavra-passe <span className="text-slate-400">(gerada automaticamente se vazio)</span></label>
                <input type="password" className="input" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="deixar vazio = gerada automaticamente" />
              </div>
            )
          )}

          <label className={`flex items-center gap-3 cursor-pointer rounded-xl border px-4 py-3 transition ${selected?.phone ? 'border-slate-200' : 'border-slate-100 opacity-50'}`}>
            <input type="checkbox" checked={form.send_sms} disabled={!selected?.phone}
              onChange={e => setForm(f => ({ ...f, send_sms: e.target.checked }))}
              className="h-4 w-4 rounded border-slate-300 text-primary" />
            <div>
              <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                Enviar SMS de boas-vindas
                {selected?.phone && <span className="font-mono text-xs text-slate-400">{selected.phone}</span>}
              </p>
              <p className="text-xs text-slate-400">
                {selected?.phone
                  ? form.create_account
                    ? 'Envia credenciais de acesso ao portal via SMS (TelcoSMS)'
                    : 'Envia notificação de aprovação via SMS (TelcoSMS)'
                  : 'Sem número de telefone — SMS não disponível'}
              </p>
            </div>
          </label>

          <div>
            <label className="label">Nota para o funcionário (opcional)</label>
            <textarea className="input" rows={2} value={form.admin_notes} onChange={e => setForm(f => ({ ...f, admin_notes: e.target.value }))} />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-outline" onClick={() => setApproveModal(false)}>Cancelar</button>
            <button type="submit" disabled={saving} className="btn-primary bg-green-600 hover:bg-green-500">
              <Check size={15} className="mr-1.5 inline" />{saving ? 'A aprovar…' : 'Aprovar e criar funcionário'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal rejeição */}
      <Modal open={rejectModal} onClose={() => setRejectModal(false)} title={`Rejeitar — ${selected?.full_name}`}>
        <div className="space-y-4">
          <div>
            <label className="label">Motivo / Nota (opcional)</label>
            <textarea className="input" rows={3} value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} placeholder="Explique o motivo da rejeição…" />
          </div>
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setRejectModal(false)}>Cancelar</button>
            <button className="btn-primary bg-red-600 hover:bg-red-500" onClick={reject} disabled={saving}>
              <X size={15} className="mr-1.5 inline" />{saving ? 'A rejeitar…' : 'Rejeitar pedido'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal convite SMS */}
      <Modal open={inviteModal} onClose={() => setInviteModal(false)} title="Convidar funcionário por SMS">
        <form onSubmit={sendInvite} className="space-y-4">
          <p className="text-sm text-slate-500">
            Será enviado um SMS com o link de auto-registo para o número indicado.
            O candidato preenche os seus dados e o pedido aparece nesta lista para aprovação.
          </p>
          <div>
            <label className="label">Número de telefone *</label>
            <input
              className="input"
              value={invitePhone}
              onChange={e => setInvitePhone(e.target.value)}
              placeholder="+244 9XX XXX XXX"
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label">Nome <span className="text-slate-400">(opcional — personaliza o SMS)</span></label>
            <input
              className="input"
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              placeholder="Ex: João Silva"
            />
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-500">
            <p className="font-medium text-slate-600 mb-1">Pré-visualização do SMS</p>
            <p>
              {inviteName ? `Olá ${inviteName}! ` : 'Olá! '}
              Foi convidado(a) a registar-se em <strong>{tenantName}</strong>. Preencha o seu perfil em:<br />
              <span className="font-mono text-primary">/admissao/{getTenant()}</span>
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn-outline" onClick={() => setInviteModal(false)}>Cancelar</button>
            <button type="submit" disabled={inviting} className="btn-primary flex items-center gap-2">
              <Send size={15} />{inviting ? 'A enviar…' : 'Enviar convite'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
