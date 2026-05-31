import { useEffect, useState } from 'react'
import { Plus, Star, CheckCircle2, Pencil, Trash2, ChevronDown, ChevronUp, Save, FileDown, Eye, ChevronRight, ChevronLeft, TrendingUp, User, CalendarDays, ClipboardList } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { Card, Spinner, EmptyState, ConfirmModal } from '../components/ui'

interface Employee { id: number; full_name: string; position?: string; department?: string }
interface Criterion { id: number; name: string; category: string; weight: string; description?: string }
interface Score { id: number; criterion_id: number; score: number; comment?: string; criterion: Criterion }
interface Review {
  id: number
  employee: Employee
  reviewer?: { id: number; name: string }
  period_year: number
  period_type: 'annual' | 'semi_annual' | 'quarterly'
  period_number: number
  status: 'draft' | 'in_progress' | 'completed'
  method?: string
  overall_score?: string | null
  reviewer_comments?: string
  conducted_at?: string
  scores?: Score[]
}
interface Paginated { data: Review[]; total: number; current_page: number; last_page: number }

const STATUS: Record<string, { label: string; style: string }> = {
  draft:       { label: 'Rascunho',     style: 'bg-slate-100 text-slate-500' },
  in_progress: { label: 'Em avaliação', style: 'bg-amber-100 text-amber-700' },
  completed:   { label: 'Concluída',    style: 'bg-green-100 text-green-700' },
}
const TYPE_LABEL: Record<string, string> = {
  annual: 'Anual', semi_annual: 'Semestral', quarterly: 'Trimestral',
}
const METHOD_LABEL: Record<string, string> = {
  standard: 'Avaliação padrão (chefia)',
  '360':    'Avaliação 360°',
  self:     'Autoavaliação',
  apo:      'Avaliação por Objectivos (APO)',
}
const SCORE_LABEL = ['', 'Insuficiente', 'Necessita melhoria', 'Satisfatório', 'Bom', 'Excelente']
const SCORE_COLOR = ['', 'text-red-500', 'text-orange-500', 'text-amber-500', 'text-blue-600', 'text-green-600']

function overallColor(score?: string | null) {
  if (!score) return 'text-slate-400'
  const n = parseFloat(score)
  if (n >= 4.5) return 'text-green-600'
  if (n >= 3.5) return 'text-blue-600'
  if (n >= 2.5) return 'text-amber-500'
  return 'text-red-500'
}

const years = Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i)

// ── Wizard ───────────────────────────────────────────────────────────────────
// Passo 0: Dados gerais (funcionário, período, método)
// Passo 1..N: Um passo por categoria de critério
// Último passo: Comentário geral + resumo

function PerformanceWizard({
  employees, criteria, onClose, onSaved, initial,
}: {
  employees: Employee[]
  criteria: Criterion[]
  onClose: () => void
  onSaved: () => void
  initial?: Review
}) {
  const [step, setStep] = useState(0)

  // Passo 0
  const [fEmployee, setFEmployee] = useState(String(initial?.employee?.id ?? ''))
  const [fYear, setFYear]         = useState(initial?.period_year ?? new Date().getFullYear())
  const [fType, setFType]         = useState<'annual'|'semi_annual'|'quarterly'>(initial?.period_type ?? 'annual')
  const [fPeriod, setFPeriod]     = useState(initial?.period_number ?? 1)
  const [fMethod, setFMethod]     = useState<'standard'|'360'|'self'|'apo'>((initial?.method as any) ?? 'standard')

  // Pontuações por criterion id
  const [scores, setScores] = useState<Record<number, { score: number; comment: string }>>(() => {
    const init: Record<number, { score: number; comment: string }> = {}
    criteria.forEach(c => { init[c.id] = { score: 0, comment: '' } })
    initial?.scores?.forEach(s => { init[s.criterion_id] = { score: s.score, comment: s.comment ?? '' } })
    return init
  })

  const [fComments, setFComments] = useState(initial?.reviewer_comments ?? '')
  const [saving, setSaving] = useState(false)

  // Agrupa critérios por categoria (ordem fixa)
  const categories = [...new Set(criteria.map(c => c.category))]
  const totalSteps = 1 + categories.length + 1 // passo 0 + 1 por cat + comentário

  const setScore = (cid: number, val: number) =>
    setScores(p => ({ ...p, [cid]: { ...p[cid], score: val } }))
  const setComment = (cid: number, val: string) =>
    setScores(p => ({ ...p, [cid]: { ...p[cid], comment: val } }))

  const canNext = () => {
    if (step === 0) return !!fEmployee
    return true
  }

  const stepLabel = (i: number) => {
    if (i === 0) return 'Dados gerais'
    if (i <= categories.length) return categories[i - 1]
    return 'Revisão'
  }

  const catCriteria = (i: number) => criteria.filter(c => c.category === categories[i - 1])

  const filledCount = criteria.filter(c => scores[c.id]?.score > 0).length

  const submit = async (status: 'draft' | 'completed') => {
    if (!fEmployee) { toast.error('Seleccione um funcionário'); return }
    if (status === 'completed' && filledCount === 0) {
      toast.error('Preencha pelo menos um critério'); return
    }
    setSaving(true)
    const payload = criteria
      .filter(c => scores[c.id]?.score > 0)
      .map(c => ({ criterion_id: c.id, score: scores[c.id].score, comment: scores[c.id].comment }))

    try {
      if (initial && initial.status !== 'completed') {
        if (payload.length > 0) await api.post(`/performance-reviews/${initial.id}/scores`, { scores: payload })
        if (status === 'completed') {
          await api.post(`/performance-reviews/${initial.id}/complete`, { reviewer_comments: fComments })
        } else {
          await api.put(`/performance-reviews/${initial.id}`, { reviewer_comments: fComments, status: 'in_progress' })
        }
      } else {
        await api.post('/performance-reviews/full', {
          employee_id: Number(fEmployee), period_year: fYear,
          period_type: fType, period_number: fPeriod,
          reviewer_comments: fComments, method: fMethod,
          scores: payload, status,
        })
      }
      toast.success(status === 'completed' ? 'Avaliação concluída' : 'Rascunho guardado')
      onSaved()
    } catch (err: any) {
      const d = err?.response?.data
      toast.error(d?.message ?? (d?.errors ? Object.values(d.errors).flat().join(' | ') : `HTTP ${err?.response?.status ?? '?'}`))
    } finally { setSaving(false) }
  }

  const emp = employees.find(e => String(e.id) === fEmployee)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl my-6 rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-heading text-lg font-bold text-slate-800">
              {initial ? 'Editar avaliação' : 'Nova avaliação'}
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl">✕</button>
          </div>
          {/* Progress bar */}
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className={`h-1.5 w-full rounded-full transition-all ${i <= step ? 'bg-primary' : 'bg-slate-100'}`} />
              </div>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-400">
            Passo {step + 1} de {totalSteps} — <span className="font-medium text-slate-600">{stepLabel(step)}</span>
          </p>
        </div>

        {/* Corpo */}
        <div className="px-6 py-5 min-h-[320px]">

          {/* Passo 0: Dados gerais */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="label">Funcionário *</label>
                <select className="input" value={fEmployee} onChange={e => setFEmployee(e.target.value)} disabled={!!initial}>
                  <option value="">— seleccionar —</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.id}>{e.full_name}{e.position ? ` (${e.position})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Ano *</label>
                  <select className="input" value={fYear} onChange={e => setFYear(Number(e.target.value))} disabled={!!initial}>
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Periodicidade *</label>
                  <select className="input" value={fType}
                    onChange={e => { setFType(e.target.value as any); setFPeriod(1) }}
                    disabled={!!initial}>
                    <option value="annual">Anual</option>
                    <option value="semi_annual">Semestral</option>
                    <option value="quarterly">Trimestral</option>
                  </select>
                </div>
                {fType !== 'annual' && (
                  <div>
                    <label className="label">Período</label>
                    <select className="input" value={fPeriod} onChange={e => setFPeriod(Number(e.target.value))} disabled={!!initial}>
                      {fType === 'semi_annual'
                        ? [1,2].map(n => <option key={n} value={n}>{n}º Semestre</option>)
                        : [1,2,3,4].map(n => <option key={n} value={n}>{n}º Trimestre</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="label">Método de avaliação</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.entries(METHOD_LABEL) as [string, string][]).map(([key, label]) => (
                    <button key={key} type="button"
                      onClick={() => setFMethod(key as any)}
                      className={`rounded-xl border px-4 py-2.5 text-left text-sm transition ${fMethod === key ? 'border-primary bg-primary/5 font-semibold text-primary' : 'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Passos de critérios */}
          {step >= 1 && step <= categories.length && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                {catCriteria(step).length} critério{catCriteria(step).length !== 1 ? 's' : ''} · clique nas estrelas para pontuar
              </p>
              {catCriteria(step).map(c => (
                <div key={c.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-slate-800">{c.name}</p>
                      {c.description && <p className="text-xs text-slate-400 mt-0.5">{c.description}</p>}
                    </div>
                    <span className="text-xs text-slate-400 shrink-0 ml-2">peso {c.weight}%</span>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} type="button"
                          onClick={() => setScore(c.id, n)}
                          className="p-0.5 transition-transform hover:scale-110">
                          <Star size={26} className={n <= (scores[c.id]?.score ?? 0)
                            ? 'fill-amber-400 text-amber-400' : 'text-slate-200 hover:text-amber-200'} />
                        </button>
                      ))}
                    </div>
                    {(scores[c.id]?.score ?? 0) > 0 && (
                      <span className={`text-sm font-semibold ${SCORE_COLOR[scores[c.id].score]}`}>
                        {SCORE_LABEL[scores[c.id].score]}
                      </span>
                    )}
                  </div>
                  <input className="input text-sm"
                    placeholder="Observação / comentário (opcional)"
                    value={scores[c.id]?.comment ?? ''}
                    onChange={e => setComment(c.id, e.target.value)} />
                </div>
              ))}
            </div>
          )}

          {/* Último passo: comentário + resumo */}
          {step === totalSteps - 1 && (
            <div className="space-y-5">
              {emp && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 flex items-center gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-heading font-bold text-primary">
                    {emp.full_name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{emp.full_name}</p>
                    <p className="text-xs text-slate-500">{emp.position} · {TYPE_LABEL[fType]}{fPeriod > 1 ? ` ${fPeriod}º` : ''} {fYear} · {METHOD_LABEL[fMethod]}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xs text-slate-400">{filledCount} / {criteria.length} critérios</p>
                    <div className="h-1.5 w-24 rounded-full bg-slate-200 mt-1 overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(filledCount / criteria.length) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="label">Comentário geral do avaliador</label>
                <textarea className="input" rows={4}
                  placeholder="Síntese do desempenho, pontos fortes, áreas a melhorar, recomendações para o próximo período…"
                  value={fComments} onChange={e => setFComments(e.target.value)} />
              </div>

              <div className="rounded-xl border border-slate-100 p-3">
                <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wide">Resumo das pontuações</p>
                <div className="space-y-1">
                  {categories.map(cat => {
                    const crits = criteria.filter(c => c.category === cat)
                    const filled = crits.filter(c => scores[c.id]?.score > 0)
                    const avg = filled.length > 0 ? filled.reduce((s, c) => s + scores[c.id].score, 0) / filled.length : 0
                    return (
                      <div key={cat} className="flex items-center gap-2 text-xs">
                        <span className="flex-1 text-slate-600">{cat}</span>
                        <span className="text-slate-400">{filled.length}/{crits.length}</span>
                        {avg > 0 && (
                          <span className={`font-semibold w-8 text-right ${SCORE_COLOR[Math.round(avg)]}`}>{avg.toFixed(1)}</span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer navegação */}
        <div className="flex items-center gap-3 border-t border-slate-100 px-6 py-4">
          {step > 0 ? (
            <button onClick={() => setStep(s => s - 1)} className="btn-outline flex items-center gap-1.5">
              <ChevronLeft size={15} /> Anterior
            </button>
          ) : (
            <button onClick={onClose} className="btn-outline">Cancelar</button>
          )}

          <div className="flex-1" />

          {step < totalSteps - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canNext()}
              className="btn-primary flex items-center gap-1.5 disabled:opacity-50">
              Seguinte <ChevronRight size={15} />
            </button>
          ) : (
            <>
              <button onClick={() => submit('draft')} disabled={saving}
                className="btn-outline flex items-center gap-1.5">
                {saving ? <Spinner /> : <><Save size={14} /> Rascunho</>}
              </button>
              <button onClick={() => submit('completed')} disabled={saving}
                className="btn-primary flex items-center gap-1.5">
                {saving ? <Spinner /> : <><CheckCircle2 size={14} /> Concluir</>}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function Performance() {
  const [data, setData] = useState<Paginated | null>(null)
  const [loading, setLoading] = useState(true)
  const [employees, setEmployees] = useState<Employee[]>([])
  const [criteria, setCriteria] = useState<Criterion[]>([])
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))
  const [filterStatus, setFilterStatus] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Review | null>(null)
  const [wizardReview, setWizardReview] = useState<Review | null | 'new'>(null)
  const [pdfUrl, setPdfUrl] = useState<{ url: string; filename: string } | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filterYear) params.year = filterYear
      if (filterStatus) params.status = filterStatus
      const { data: d } = await api.get<Paginated>('/performance-reviews', { params })
      setData(d)
    } finally { setLoading(false) }
  }

  useEffect(() => {
    load()
    api.get<{ data: Employee[] }>('/employees', { params: { per_page: 200 } })
      .then(r => setEmployees(r.data.data ?? [])).catch(() => {})
    api.get<Criterion[]>('/review-criteria').then(r => setCriteria(r.data)).catch(() => {})
  }, [filterYear, filterStatus])

  const openEdit = async (r: Review) => {
    const { data: full } = await api.get<Review>(`/performance-reviews/${r.id}`)
    setWizardReview(full)
  }

  const viewPdf = async (r: Review) => {
    try {
      const res = await api.get(`/performance-reviews/${r.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(res.data)
      setPdfUrl({ url, filename: `avaliacao-${r.employee?.full_name ?? r.id}-${r.period_year}.pdf` })
    } catch { toast.error('Erro ao gerar PDF') }
  }

  const doDelete = async () => {
    if (!confirmDelete) return
    try {
      await api.delete(`/performance-reviews/${confirmDelete.id}`)
      toast.success('Avaliação eliminada'); setConfirmDelete(null); load()
    } catch { toast.error('Erro ao eliminar') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Avaliação & Desempenho</h1>
          <p className="text-sm text-slate-500">{data?.total ?? '—'} avaliações</p>
        </div>
        <button className="btn-primary" onClick={() => setWizardReview('new')}>
          <Plus size={18} /> Nova avaliação
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select className="input w-auto text-sm" value={filterYear} onChange={e => setFilterYear(e.target.value)}>
          <option value="">Todos os anos</option>
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <select className="input w-auto text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos os estados</option>
          {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      <Card>
        {loading ? <Spinner /> : !data?.data.length ? (
          <EmptyState message="Nenhuma avaliação encontrada." />
        ) : (
          <div className="divide-y divide-slate-100">
            {data.data.map(r => (
              <div key={r.id}>
                <div className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 cursor-pointer"
                  onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">{r.employee?.full_name}</p>
                    <p className="text-xs text-slate-400">
                      {r.employee?.position}{r.employee?.department ? ` · ${r.employee.department}` : ''}
                      {r.method && r.method !== 'standard' ? ` · ${METHOD_LABEL[r.method]}` : ''}
                    </p>
                  </div>
                  <span className="text-xs text-slate-500 hidden sm:block">
                    {TYPE_LABEL[r.period_type]}{r.period_number > 1 ? ` ${r.period_number}º` : ''} {r.period_year}
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS[r.status].style}`}>
                    {STATUS[r.status].label}
                  </span>
                  {r.overall_score && (
                    <div className={`font-heading text-lg font-bold w-10 text-right ${overallColor(r.overall_score)}`}>
                      {parseFloat(r.overall_score).toFixed(1)}
                    </div>
                  )}
                  <div className="flex gap-1 shrink-0">
                    {r.status === 'completed' && (
                      <button onClick={e => { e.stopPropagation(); viewPdf(r) }}
                        title="Ver PDF" className="rounded p-1.5 text-slate-400 hover:bg-primary/10 hover:text-primary">
                        <Eye size={14} />
                      </button>
                    )}
                    {r.status !== 'completed' && (
                      <button onClick={e => { e.stopPropagation(); openEdit(r) }}
                        className="rounded p-1.5 text-slate-400 hover:bg-primary/10 hover:text-primary">
                        <Pencil size={14} />
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); setConfirmDelete(r) }}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                    {expanded === r.id ? <ChevronUp size={15} className="text-slate-400 mt-1" /> : <ChevronDown size={15} className="text-slate-400 mt-1" />}
                  </div>
                </div>

                {expanded === r.id && r.scores && r.scores.length > 0 && (
                  <div className="bg-slate-50 border-t border-slate-100 px-4 py-4 space-y-3">
                    {Object.entries(r.scores.reduce<Record<string, Score[]>>((acc, s) => {
                      const cat = s.criterion?.category ?? 'Geral'
                      ;(acc[cat] = acc[cat] || []).push(s); return acc
                    }, {})).map(([cat, ss]) => (
                      <div key={cat}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">{cat}</p>
                        <div className="space-y-1.5">
                          {ss.map(s => (
                            <div key={s.id} className="flex items-center gap-3 text-sm">
                              <span className="flex-1 text-slate-600">{s.criterion?.name}</span>
                              <div className="flex gap-0.5">
                                {[1,2,3,4,5].map(n => <Star key={n} size={12} className={n <= s.score ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />)}
                              </div>
                              <span className={`text-xs font-medium w-28 text-right ${SCORE_COLOR[s.score]}`}>{SCORE_LABEL[s.score]}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {r.reviewer_comments && (
                      <p className="text-sm text-slate-600 border-t border-slate-100 pt-3">
                        <span className="font-medium text-slate-400 text-xs">Comentário: </span>{r.reviewer_comments}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Overlay PDF */}
      {pdfUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/80">
          <div className="flex items-center justify-between bg-white px-4 py-2.5 border-b border-slate-200">
            <span className="text-sm font-semibold text-slate-800">{pdfUrl.filename}</span>
            <div className="flex gap-2">
              <a href={pdfUrl.url} download={pdfUrl.filename}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                <FileDown size={13} /> Descarregar
              </a>
              <button onClick={() => { URL.revokeObjectURL(pdfUrl.url); setPdfUrl(null) }}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-100">
                Fechar
              </button>
            </div>
          </div>
          <iframe src={pdfUrl.url} className="flex-1 w-full" title="Avaliação PDF" />
        </div>
      )}

      {/* Wizard */}
      {wizardReview !== null && criteria.length > 0 && (
        <PerformanceWizard
          employees={employees}
          criteria={criteria}
          onClose={() => setWizardReview(null)}
          onSaved={() => { setWizardReview(null); load() }}
          initial={wizardReview === 'new' ? undefined : wizardReview}
        />
      )}

      <ConfirmModal open={!!confirmDelete} title="Eliminar avaliação"
        message={`Eliminar a avaliação de ${confirmDelete?.employee?.full_name}?`}
        danger confirmLabel="Eliminar" onConfirm={doDelete} onCancel={() => setConfirmDelete(null)} />
    </div>
  )
}
