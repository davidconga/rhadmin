import { useEffect, useState } from 'react'
import { FileText, FileType, Download, Eye, Sparkles, CheckCircle2, Package } from 'lucide-react'
import { toast } from 'sonner'
import { api, downloadFile, downloadPost } from '../lib/api'
import { money, monthName, MONTHS } from '../lib/format'
import { Card, Modal, Spinner, EmptyState, StatusBadge } from '../components/ui'
import type { DocumentRef, SalarySlip } from '../types'

const now = new Date()

export default function SalarySlips() {
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [list, setList] = useState<SalarySlip[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [detail, setDetail] = useState<SalarySlip | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [pdfPreview, setPdfPreview] = useState<{ url: string; filename: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/salary-slips', { params: { month, year, per_page: 100 } })
      setList(data.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [month, year])

  const generateBatch = async () => {
    setGenerating(true)
    try {
      const { data } = await api.post('/salary-slips/generate-batch', { month, year })
      toast.success(`${data.generated} recibos gerados para ${monthName(month)}/${year}`)
      load()
    } catch {
      toast.error('Erro ao gerar recibos')
    } finally {
      setGenerating(false)
    }
  }

  const genDoc = async (slip: SalarySlip, type: 'docx' | 'pdf') => {
    setBusyId(slip.id)
    try {
      const { data } = await api.post<DocumentRef>(`/salary-slips/${slip.id}/generate-${type}`)
      if (type === 'pdf') {
        const res = await api.get(`/documents/${data.id}/download`, { responseType: 'blob' })
        const url = URL.createObjectURL(res.data)
        setPdfPreview({ url, filename: data.filename })
      } else {
        await downloadFile(`/documents/${data.id}/download`, data.filename)
        toast.success('DOCX descarregado')
      }
    } catch {
      toast.error('Erro ao gerar documento')
    } finally {
      setBusyId(null)
    }
  }

  const closePdfPreview = () => {
    if (pdfPreview) URL.revokeObjectURL(pdfPreview.url)
    setPdfPreview(null)
  }

  const issue = async (slip: SalarySlip) => {
    try {
      await api.post(`/salary-slips/${slip.id}/issue`)
      toast.success('Recibo emitido')
      load()
    } catch {
      toast.error('Erro ao emitir')
    }
  }

  const downloadZip = async () => {
    try {
      toast.message('A preparar ZIP...')
      await downloadPost('/salary-slips/download-zip', { month, year }, `recibos-${month}-${year}.zip`)
    } catch {
      toast.error('Erro ao descarregar ZIP')
    }
  }

  const years = [year - 1, year, year + 1]

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Recibos de Salário</h1>
          <p className="text-sm text-slate-500">Geração automática com cálculo de IRT e Segurança Social</p>
        </div>
        <div className="flex items-center gap-2">
          <select className="input w-36" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
            {MONTHS.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
          <select className="input w-28" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button className="btn-primary" onClick={generateBatch} disabled={generating}>
            <Sparkles size={18} /> {generating ? 'A gerar...' : 'Gerar lote'}
          </button>
          {list.length > 0 && (
            <button className="btn-outline" onClick={downloadZip}><Package size={18} /> ZIP</button>
          )}
        </div>
      </div>

      <Card>
        {loading ? (
          <Spinner />
        ) : list.length === 0 ? (
          <EmptyState message={`Sem recibos para ${monthName(month)}/${year}. Clique em "Gerar lote".`} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-4 py-3">Funcionário</th>
                  <th className="px-4 py-3 text-right">Bruto</th>
                  <th className="px-4 py-3 text-right">IRT</th>
                  <th className="px-4 py-3 text-right">INSS</th>
                  <th className="px-4 py-3 text-center">Faltas</th>
                  <th className="px-4 py-3 text-center">H.Extra</th>
                  <th className="px-4 py-3 text-right">Líquido</th>
                  <th className="px-4 py-3 text-center">Estado</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{s.employee?.full_name}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{money(s.gross_salary)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{money(s.irt_tax)}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{money(s.social_security)}</td>
                    <td className="px-4 py-3 text-center text-sm">
                      {(s.absence_days ?? 0) > 0
                        ? <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">{s.absence_days}d</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {parseFloat(s.overtime_hours ?? '0') > 0
                        ? <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">{parseFloat(s.overtime_hours ?? '0')}h</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-primary">{money(s.net_salary)}</td>
                    <td className="px-4 py-3 text-center"><StatusBadge status={s.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button title="Detalhe" onClick={() => setDetail(s)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary"><Eye size={16} /></button>
                        <button title="Gerar/Descarregar PDF" disabled={busyId === s.id} onClick={() => genDoc(s, 'pdf')} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-red-600"><FileText size={16} /></button>
                        <button title="Gerar/Descarregar DOCX" disabled={busyId === s.id} onClick={() => genDoc(s, 'docx')} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-blue-600"><FileType size={16} /></button>
                        {s.status === 'draft' && (
                          <button title="Emitir" onClick={() => issue(s)} className="rounded p-1.5 text-slate-400 hover:bg-green-50 hover:text-green-600"><CheckCircle2 size={16} /></button>
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

      <SlipDetail slip={detail} onClose={() => setDetail(null)} onDownload={genDoc} />

      {pdfPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-2.5">
            <span className="text-sm font-medium text-slate-200">{pdfPreview.filename}</span>
            <div className="flex items-center gap-2">
              <a
                href={pdfPreview.url}
                download={pdfPreview.filename}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90"
              >
                <Download size={13} /> Descarregar
              </a>
              <button onClick={closePdfPreview} className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-white">
                Fechar
              </button>
            </div>
          </div>
          <iframe src={pdfPreview.url} className="flex-1 w-full" title="Pré-visualização PDF" />
        </div>
      )}
    </div>
  )
}

function SlipDetail({
  slip, onClose, onDownload,
}: {
  slip: SalarySlip | null
  onClose: () => void
  onDownload: (s: SalarySlip, t: 'docx' | 'pdf') => void
}) {
  if (!slip) return null
  const row = (label: string, value: string, strong = false) => (
    <div className={`flex justify-between py-1.5 ${strong ? 'font-semibold text-primary' : 'text-slate-600'}`}>
      <span>{label}</span><span>{money(value)}</span>
    </div>
  )
  const otHours = parseFloat(slip.overtime_hours ?? '0')
  const absenceDays = slip.absence_days ?? 0
  return (
    <Modal open={!!slip} onClose={onClose} title={`Recibo — ${slip.employee?.full_name}`} wide>
      <p className="mb-3 text-sm text-slate-500">{monthName(slip.month)} / {slip.year} · <StatusBadge status={slip.status} /></p>

      {/* Resumo assiduidade, se houver dados */}
      {(absenceDays > 0 || otHours > 0) && (
        <div className="mb-4 flex gap-4 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
          {absenceDays > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
              {absenceDays} falta{absenceDays > 1 ? 's' : ''} descontada{absenceDays > 1 ? 's' : ''}
            </span>
          )}
          {otHours > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
              {otHours}h extra pagas
            </span>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Rendimentos</h4>
          <div className="divide-y divide-slate-100 text-sm">
            {row('Salário base', slip.base_salary)}
            {row('Subsídio alimentação', slip.food_allowance)}
            {row('Subsídio transporte', slip.transport_allowance)}
            {row(`Horas extra${otHours > 0 ? ` (${otHours}h)` : ''}`, slip.overtime)}
            {row('Outros rendimentos', slip.other_income)}
            {row('Salário bruto', slip.gross_salary, true)}
          </div>
        </div>
        <div>
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Descontos</h4>
          <div className="divide-y divide-slate-100 text-sm">
            {row('IRT', slip.irt_tax)}
            {row('Segurança Social (INSS)', slip.social_security)}
            {row(`Outros descontos${absenceDays > 0 ? ` (${absenceDays} falta${absenceDays > 1 ? 's' : ''})` : ''}`, slip.other_deductions)}
            {row('Total descontos', slip.total_deductions, true)}
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-lg bg-primary/5 px-4 py-3">
        <span className="font-heading font-bold text-primary">Salário líquido</span>
        <span className="font-heading text-xl font-bold text-primary">{money(slip.net_salary)}</span>
      </div>
      <div className="mt-5 flex justify-end gap-2">
        <button className="btn-outline" onClick={() => onDownload(slip, 'pdf')}><Download size={16} /> PDF</button>
        <button className="btn-primary" onClick={() => onDownload(slip, 'docx')}><Download size={16} /> DOCX</button>
      </div>
    </Modal>
  )
}
