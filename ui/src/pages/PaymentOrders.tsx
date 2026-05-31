import { useEffect, useState } from 'react'
import { Plus, FileText, FileType, FileSpreadsheet, Eye, Trash2, Users, CheckCircle2, Send, Save } from 'lucide-react'
import { toast } from 'sonner'
import { api, downloadFile } from '../lib/api'
import { money, monthName, MONTHS } from '../lib/format'
import { Card, Modal, Spinner, EmptyState, ConfirmModal } from '../components/ui'
import type { Bank, DocumentRef, PaymentOrder, PaymentOrderItem } from '../types'

const now = new Date()

const statusStyles: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  approved: 'bg-blue-100 text-blue-700',
  sent: 'bg-green-100 text-green-700',
}
const statusLabels: Record<string, string> = { draft: 'Rascunho', approved: 'Aprovado', sent: 'Enviado' }

function OrderStatus({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status]}`}>{statusLabels[status] ?? status}</span>
}

export default function PaymentOrders() {
  const [list, setList] = useState<PaymentOrder[]>([])
  const [banks, setBanks] = useState<Bank[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailId, setDetailId] = useState<number | null>(null)
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [bankId, setBankId] = useState<number | ''>('')
  const [debit, setDebit] = useState('')
  const [notes, setNotes] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<PaymentOrder | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/payment-orders', { params: { per_page: 100 } })
      setList(data.data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    api.get<Bank[]>('/banks', { params: { only_active: true } }).then((r) => setBanks(r.data))
  }, [])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const { data } = await api.post<PaymentOrder>('/payment-orders', {
        month, year, bank_id: bankId || null, debit_account: debit, notes,
      })
      toast.success(`Ordem ${data.reference_number} criada`)
      setCreateOpen(false)
      setDebit(''); setNotes(''); setBankId('')
      load()
      setDetailId(data.id)
    } catch {
      toast.error('Erro ao criar ordem')
    }
  }

  const remove = (o: PaymentOrder) => setConfirmDelete(o)
  const doRemove = async () => {
    if (!confirmDelete) return
    try {
      await api.delete(`/payment-orders/${confirmDelete.id}`)
      toast.success('Ordem eliminada')
      setConfirmDelete(null); load()
    } catch { toast.error('Erro ao eliminar') }
  }

  const years = [year - 1, year, year + 1]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Ordens de Pagamento</h1>
          <p className="text-sm text-slate-500">Transferências para o banco — beneficiários, aprovação e exportação</p>
        </div>
        <button className="btn-primary" onClick={() => setCreateOpen(true)}><Plus size={18} /> Nova ordem</button>
      </div>

      <Card>
        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyState message='Nenhuma ordem de pagamento. Clique em "Nova ordem".' />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Referência</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Banco</th>
                  <th className="px-4 py-3 text-center">Beneficiários</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{o.reference_number}</td>
                    <td className="px-4 py-3 text-slate-500">{monthName(o.month)}/{o.year}</td>
                    <td className="px-4 py-3 text-slate-500">{o.bank?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-center text-slate-500">{o.items_count ?? '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-primary">{money(o.total_amount)}</td>
                    <td className="px-4 py-3 text-center"><OrderStatus status={o.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button title="Detalhe" onClick={() => setDetailId(o.id)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary"><Eye size={16} /></button>
                        {o.status !== 'sent' && (
                          <button title="Eliminar" onClick={() => remove(o)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Criar */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nova ordem de pagamento">
        <form onSubmit={create} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Mês</label>
              <select className="input" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Ano</label>
              <select className="input" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label">Banco (débito)</label>
            <select className="input" value={bankId} onChange={(e) => setBankId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">— Selecionar —</option>
              {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Conta de débito</label>
            <input className="input" value={debit} onChange={(e) => setDebit(e.target.value)} placeholder="Nº da conta a debitar" />
          </div>
          <div>
            <label className="label">Observações</label>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setCreateOpen(false)}>Cancelar</button>
            <button className="btn-primary">Criar</button>
          </div>
        </form>
      </Modal>

      {detailId && <OrderDetail id={detailId} banks={banks} onClose={() => setDetailId(null)} onChanged={load} />}

      <ConfirmModal open={!!confirmDelete} title="Eliminar ordem"
        message={`Eliminar a ordem ${confirmDelete?.reference_number}? Esta ação não pode ser revertida.`}
        danger confirmLabel="Eliminar" onConfirm={doRemove} onCancel={() => setConfirmDelete(null)} />
    </div>
  )
}

function OrderDetail({ id, banks, onClose, onChanged }: { id: number; banks: Bank[]; onClose: () => void; onChanged: () => void }) {
  const [order, setOrder] = useState<PaymentOrder | null>(null)
  const [items, setItems] = useState<PaymentOrderItem[]>([])
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const { data } = await api.get<PaymentOrder>(`/payment-orders/${id}`)
    setOrder(data)
    setItems(data.items ?? [])
  }
  useEffect(() => { load() }, [id])

  if (!order) return <Modal open onClose={onClose} title="Ordem" wide><Spinner /></Modal>

  const editable = order.status === 'draft'
  const total = items.reduce((s, it) => s + (parseFloat(String(it.amount)) || 0), 0)

  const importEmployees = async () => {
    setBusy(true)
    try {
      await api.post(`/payment-orders/${id}/add-employees`)
      toast.success('Funcionários importados')
      await load(); onChanged()
    } catch { toast.error('Erro ao importar') } finally { setBusy(false) }
  }

  const addRow = () => setItems([...items, { beneficiary: '', iban: '', bank: '', amount: 0 }])
  const updateRow = (i: number, patch: Partial<PaymentOrderItem>) =>
    setItems(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)))
  const removeRow = (i: number) => setItems(items.filter((_, idx) => idx !== i))

  const saveItems = async () => {
    setBusy(true)
    try {
      await api.put(`/payment-orders/${id}`, {
        items: items.map((it) => ({
          employee_id: it.employee_id ?? null,
          beneficiary: it.beneficiary,
          iban: it.iban ?? null,
          bank: it.bank ?? null,
          amount: parseFloat(String(it.amount)) || 0,
        })),
      })
      toast.success('Beneficiários guardados')
      await load(); onChanged()
    } catch { toast.error('Erro ao guardar') } finally { setBusy(false) }
  }

  const setBank = async (value: string) => {
    await api.put(`/payment-orders/${id}`, { bank_id: value ? Number(value) : null })
    await load(); onChanged()
  }

  const approve = async () => {
    try {
      await api.post(`/payment-orders/${id}/approve`)
      toast.success('Ordem aprovada')
      await load(); onChanged()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erro ao aprovar') }
  }

  const send = async () => {
    try {
      await api.post(`/payment-orders/${id}/send`)
      toast.success('Ordem enviada ao banco')
      await load(); onChanged()
    } catch (e: any) { toast.error(e?.response?.data?.message ?? 'Erro ao enviar') }
  }

  const genDoc = async (type: 'docx' | 'pdf') => {
    setBusy(true)
    try {
      const { data } = await api.post<DocumentRef>(`/payment-orders/${id}/generate-${type}`)
      await downloadFile(`/documents/${data.id}/download`, data.filename)
    } catch { toast.error('Erro ao gerar documento') } finally { setBusy(false) }
  }
  const genExcel = async () => {
    try {
      await downloadFile(`/payment-orders/${id}/generate-excel`, `transferencias-${order.reference_number}.xlsx`)
    } catch { toast.error('Erro ao gerar Excel') }
  }

  return (
    <Modal open onClose={onClose} title={`Ordem ${order.reference_number}`} wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="text-slate-500">
          {monthName(order.month)} / {order.year} · <OrderStatus status={order.status} />
          {order.approver && <span className="ml-2 text-slate-400">aprovado por {order.approver.name}</span>}
        </div>
        <div>
          <label className="mr-2 text-slate-500">Banco:</label>
          <select className="input inline-block w-56" disabled={!editable} value={order.bank_id ?? ''} onChange={(e) => setBank(e.target.value)}>
            <option value="">— Selecionar —</option>
            {banks.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>
      </div>

      {editable && (
        <div className="mb-3 flex gap-2">
          <button className="btn-outline" onClick={importEmployees} disabled={busy}><Users size={16} /> Importar funcionários</button>
          <button className="btn-ghost" onClick={addRow}><Plus size={16} /> Linha manual</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">Beneficiário</th>
              <th className="px-3 py-2">IBAN</th>
              <th className="px-3 py-2">Banco</th>
              <th className="px-3 py-2 text-right">Montante</th>
              {editable && <th className="px-3 py-2"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Sem beneficiários. Importe funcionários ou adicione linhas.</td></tr>
            )}
            {items.map((it, i) => (
              <tr key={i}>
                {editable ? (
                  <>
                    <td className="px-2 py-1"><input className="input" value={it.beneficiary} onChange={(e) => updateRow(i, { beneficiary: e.target.value })} /></td>
                    <td className="px-2 py-1"><input className="input" value={it.iban ?? ''} onChange={(e) => updateRow(i, { iban: e.target.value })} /></td>
                    <td className="px-2 py-1"><input className="input" value={it.bank ?? ''} onChange={(e) => updateRow(i, { bank: e.target.value })} /></td>
                    <td className="px-2 py-1"><input type="number" step="0.01" className="input text-right" value={it.amount} onChange={(e) => updateRow(i, { amount: e.target.value })} /></td>
                    <td className="px-2 py-1 text-center"><button onClick={() => removeRow(i)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button></td>
                  </>
                ) : (
                  <>
                    <td className="px-3 py-2 text-slate-700">{it.beneficiary}</td>
                    <td className="px-3 py-2 text-slate-500">{it.iban || '—'}</td>
                    <td className="px-3 py-2 text-slate-500">{it.bank || '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-700">{money(it.amount)}</td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-primary/20 bg-primary/5">
              <td className="px-3 py-2 font-semibold text-primary" colSpan={3}>TOTAL ({items.length})</td>
              <td className="px-3 py-2 text-right font-bold text-primary">{money(total)}</td>
              {editable && <td></td>}
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button className="btn-outline" onClick={() => genDoc('pdf')} disabled={busy}><FileText size={16} /> PDF</button>
          <button className="btn-outline" onClick={() => genDoc('docx')} disabled={busy}><FileType size={16} /> DOCX</button>
          <button className="btn-outline" onClick={genExcel}><FileSpreadsheet size={16} /> Excel (banco)</button>
        </div>
        <div className="flex gap-2">
          {editable && <button className="btn-primary" onClick={saveItems} disabled={busy}><Save size={16} /> Guardar</button>}
          {order.status === 'draft' && <button className="btn-primary" onClick={approve}><CheckCircle2 size={16} /> Aprovar</button>}
          {order.status === 'approved' && <button className="btn-primary" onClick={send}><Send size={16} /> Enviar ao banco</button>}
        </div>
      </div>
    </Modal>
  )
}
