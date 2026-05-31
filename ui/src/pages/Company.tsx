import { useEffect, useRef, useState } from 'react'
import { Upload, Save, ImageOff, Plus, Building2, Phone, Landmark, ArrowRight, ArrowLeft, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { Card, Spinner } from '../components/ui'
import { useAuth } from '../stores/auth'
import { useCompany } from '../stores/company'
import type { Company as CompanyType } from '../types'

const EMPTY: Partial<CompanyType> = { name: '', nif: '', address: '', phone: '', email: '', bank_name: '', account_number: '', iban: '', default_debit_account: '', currency: 'AOA' }

const STEPS = [
  { label: 'Identificação', icon: Building2, desc: 'Nome, NIF e morada' },
  { label: 'Contacto',      icon: Phone,     desc: 'Telefone e email' },
  { label: 'Banco',         icon: Landmark,  desc: 'Dados bancários' },
]

function Field({ label, value, onChange, required, type, placeholder, span2 }: {
  label: string; value: string; onChange: (v: string) => void
  required?: boolean; type?: string; placeholder?: string; span2?: boolean
}) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}{required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      <input
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm placeholder-slate-400 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        type={type ?? 'text'} placeholder={placeholder} required={required}
        value={value} onChange={e => onChange(e.target.value)}
      />
    </div>
  )
}

function CompanyWizard({ draft, setDraft, onSubmit, onCancel, saving, setupRequired, embedded }: {
  draft: Partial<CompanyType>
  setDraft: (d: Partial<CompanyType>) => void
  onSubmit: (e: React.FormEvent) => void
  onCancel?: () => void
  saving: boolean
  setupRequired: boolean
  embedded: boolean
}) {
  const [step, setStep] = useState(0)
  const set = (k: keyof CompanyType) => (v: string) => setDraft({ ...draft, [k]: v })

  const validateStep = () => {
    if (step === 0 && !draft.name?.trim()) { toast.error('Nome da empresa é obrigatório'); return false }
    if (step === 0 && !draft.nif?.trim())  { toast.error('NIF é obrigatório'); return false }
    return true
  }

  const next = () => { if (validateStep()) setStep(s => s + 1) }
  const back = () => setStep(s => s - 1)

  return (
    <div className="max-w-xl space-y-6">
      {setupRequired && (
        <div className="rounded-xl border border-amber-900/50 bg-amber-900/20 px-5 py-4">
          <p className="font-semibold text-amber-400">Configure a sua empresa antes de continuar</p>
          <p className="mt-0.5 text-sm text-amber-500/80">Preencha pelo menos o nome e o NIF para desbloquear a plataforma.</p>
        </div>
      )}

      {!embedded && (
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Nova empresa</h1>
          <p className="text-sm text-slate-500">Preencha os dados da sua organização em 3 passos</p>
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const done = i < step
          const active = i === step
          const Icon = s.icon
          return (
            <div key={i} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                  done   ? 'border-primary bg-primary text-white' :
                  active ? 'border-primary bg-primary/10 text-primary' :
                           'border-slate-200 bg-white text-slate-400'
                }`}>
                  {done ? <CheckCircle2 size={18} /> : <Icon size={16} />}
                </div>
                <span className={`text-xs font-medium ${active ? 'text-primary' : done ? 'text-primary/70' : 'text-slate-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`mb-4 h-0.5 flex-1 transition-all ${i < step ? 'bg-primary' : 'bg-slate-200'}`} />
              )}
            </div>
          )
        })}
      </div>

      {/* Passo activo */}
      <Card className="overflow-hidden shadow-sm">
        <div className={`border-b border-slate-100 bg-gradient-to-r from-primary/5 to-transparent px-6 py-4`}>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              {(() => { const Icon = STEPS[step].icon; return <Icon size={18} className="text-primary" /> })()}
            </div>
            <div>
              <p className="font-semibold text-slate-800">{STEPS[step].label}</p>
              <p className="text-xs text-slate-500">{STEPS[step].desc}</p>
            </div>
          </div>
        </div>

        <form id="wizard-form" onSubmit={step < STEPS.length - 1 ? (e) => { e.preventDefault(); next() } : onSubmit}>
          <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2">
            {step === 0 && <>
              <Field label="Nome da empresa" value={draft.name ?? ''} onChange={set('name')} required span2 placeholder="Ex: das Acácias Lda" />
              <Field label="NIF"             value={draft.nif  ?? ''} onChange={set('nif')}  required placeholder="5XXXXXXXXX" />
              <Field label="Morada"          value={draft.address ?? ''} onChange={set('address')} placeholder="Rua, nº, cidade" />
            </>}
            {step === 1 && <>
              <Field label="Telefone" value={draft.phone ?? ''} onChange={set('phone')} placeholder="+244 9XX XXX XXX" />
              <Field label="Email"    value={draft.email ?? ''} onChange={set('email')} type="email" placeholder="geral@empresa.ao" />
            </>}
            {step === 2 && <>
              <Field label="Banco"          value={draft.bank_name ?? ''}             onChange={set('bank_name')}             placeholder="Banco BAI" />
              <Field label="Nº de conta"    value={draft.account_number ?? ''}        onChange={set('account_number')}        placeholder="000123456789" />
              <Field label="IBAN"           value={draft.iban ?? ''}                  onChange={set('iban')}          span2   placeholder="AO06 0040 0000 …" />
              <Field label="Conta de débito" value={draft.default_debit_account ?? ''} onChange={set('default_debit_account')} placeholder="000123456789" />
              <Field label="Moeda"          value={draft.currency ?? 'AOA'}           onChange={set('currency')}              placeholder="AOA" />
            </>}
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
            <div>
              {step === 0 && onCancel && (
                <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700">
                  Cancelar
                </button>
              )}
              {step > 0 && (
                <button type="button" onClick={back} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
                  <ArrowLeft size={14} /> Voltar
                </button>
              )}
            </div>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition disabled:opacity-60">
              {step < STEPS.length - 1 ? <>Seguinte <ArrowRight size={15} /></> : saving ? 'A criar…' : <><Save size={15} /> Criar empresa</>}
            </button>
          </div>
        </form>
      </Card>

      {/* Indicador de passo */}
      <p className="text-center text-xs text-slate-400">Passo {step + 1} de {STEPS.length}</p>
    </div>
  )
}

export default function Company({ embedded = false }: { embedded?: boolean }) {
  const { setupRequired, clearSetup } = useAuth()
  const { fetchAll } = useCompany()
  const navigate = useNavigate()
  const [company, setCompany] = useState<CompanyType | null>(null)
  const [noCompany, setNoCompany] = useState(false)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState<Partial<CompanyType>>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [sigUrl, setSigUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const sigRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const loadLogo = async () => {
    try {
      const res = await api.get('/company/logo', { responseType: 'blob' })
      setLogoUrl(URL.createObjectURL(res.data))
    } catch { setLogoUrl(null) }
  }

  const loadSig = async () => {
    try {
      const res = await api.get('/company/signature', { responseType: 'blob' })
      setSigUrl(URL.createObjectURL(res.data))
    } catch { setSigUrl(null) }
  }

  useEffect(() => {
    api.get<CompanyType>('/company')
      .then((res) => {
        if (res.status === 204 || !res.data) {
          setNoCompany(true)
          if (setupRequired) setCreating(true)
        } else {
          setCompany(res.data)
          loadLogo()
          loadSig()
        }
      })
      .catch(() => {
        setNoCompany(true)
        if (setupRequired) setCreating(true)
      })
      .finally(() => setLoading(false))
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!company) return
    setSaving(true)
    try {
      const { data } = await api.put('/company', company)
      setCompany(data)
      if (setupRequired && company.nif) {
        clearSetup()
        await fetchAll()
        toast.success('Empresa configurada! Bem-vindo à plataforma.')
        navigate('/app')
      } else {
        toast.success('Dados da empresa guardados')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.name) { toast.error('Nome é obrigatório'); return }
    setSaving(true)
    try {
      const { data } = await api.post('/companies', { ...draft, active: true })
      setCompany(data)
      setNoCompany(false)
      setCreating(false)
      await fetchAll()
      if (setupRequired && draft.nif) {
        clearSetup()
        toast.success('Empresa criada! Bem-vindo à plataforma.')
        navigate('/app')
      } else {
        toast.success('Empresa criada com sucesso')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao criar empresa')
    } finally {
      setSaving(false)
    }
  }

  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const src = 'touches' in e ? e.touches[0] : e
    return { x: (src.clientX - rect.left) * (canvas.width / rect.width), y: (src.clientY - rect.top) * (canvas.height / rect.height) }
  }
  const sigStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); drawing.current = true
    const ctx = sigRef.current!.getContext('2d')!
    const { x, y } = getPos(e, sigRef.current!)
    ctx.beginPath(); ctx.moveTo(x, y)
  }
  const sigDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); if (!drawing.current) return
    const ctx = sigRef.current!.getContext('2d')!
    const { x, y } = getPos(e, sigRef.current!)
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b'
    ctx.lineTo(x, y); ctx.stroke()
  }
  const sigStop = () => { drawing.current = false }
  const sigClear = () => sigRef.current!.getContext('2d')!.clearRect(0, 0, sigRef.current!.width, sigRef.current!.height)
  const saveSig = async () => {
    const dataUrl = sigRef.current!.toDataURL('image/png')
    try {
      await api.post('/company/signature', { signature: dataUrl })
      toast.success('Assinatura da empresa guardada.')
      loadSig()
    } catch { toast.error('Erro ao guardar assinatura') }
  }

  const uploadLogo = async (file: File) => {
    const fd = new FormData()
    fd.append('logo', file)
    try {
      await api.post('/company/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Logótipo atualizado — aparecerá nos recibos gerados')
      loadLogo()
    } catch {
      toast.error('Erro ao carregar logótipo (apenas PNG/JPG/WEBP até 2MB)')
    }
  }

  if (loading) return <Spinner />

  if (noCompany && !creating) return (
    <div className="space-y-5">
      {setupRequired && (
        <div className="rounded-xl border border-amber-900/50 bg-amber-900/20 px-5 py-4">
          <p className="font-semibold text-amber-400">Configure a sua empresa antes de continuar</p>
          <p className="mt-0.5 text-sm text-amber-500/80">Preencha pelo menos o nome e o NIF para desbloquear a plataforma.</p>
        </div>
      )}
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Plus size={28} className="text-primary" />
        </div>
        <div>
          <p className="font-heading text-lg font-bold text-slate-800">Ainda não tem nenhuma empresa</p>
          <p className="mt-1 text-sm text-slate-500">Crie a primeira empresa para começar a usar a plataforma.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary px-6 py-2.5">
          + Criar empresa
        </button>
      </Card>
    </div>
  )

  if (creating && !company) return <CompanyWizard
    draft={draft} setDraft={setDraft}
    onSubmit={create} onCancel={!setupRequired ? () => setCreating(false) : undefined}
    saving={saving} setupRequired={setupRequired}
    embedded={embedded}
  />

  if (!company) return <Spinner />

  const field = (key: keyof CompanyType, label: string, type = 'text') => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        value={(company[key] as string) ?? ''}
        onChange={(e) => setCompany({ ...company, [key]: e.target.value })}
      />
    </div>
  )

  return (
    <div className="space-y-5">
      {setupRequired && (
        <div className="rounded-xl border border-amber-900/50 bg-amber-900/20 px-5 py-4">
          <p className="font-semibold text-amber-400">Configure a sua empresa antes de continuar</p>
          <p className="mt-0.5 text-sm text-amber-500/80">Preencha pelo menos o nome e o NIF para desbloquear a plataforma.</p>
        </div>
      )}
      {!embedded && (
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Empresa</h1>
          <p className="text-sm text-slate-500">Dados da empresa e logótipo (usado nos documentos)</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
        <Card className="p-5 lg:col-span-1">
          <h2 className="mb-3 font-heading font-bold text-primary">Logótipo</h2>
          <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-slate-200 bg-slate-50">
            {logoUrl ? (
              <img src={logoUrl} alt="logótipo" className="max-h-full max-w-full object-contain p-3" />
            ) : (
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <ImageOff size={32} />
                <span className="text-xs">Sem logótipo</span>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
          />
          <button className="btn-outline mt-3 w-full" onClick={() => fileRef.current?.click()}>
            <Upload size={16} /> Carregar logótipo
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">PNG/JPG/WEBP, fundo transparente, até 2MB</p>
        </Card>

        <Card className="p-5 lg:col-span-1">
          <h2 className="mb-3 font-heading font-bold text-primary">Assinatura</h2>
          <p className="mb-3 text-xs text-slate-400">Aparece no recibo como "A Entidade Empregadora". Desenhe com o rato ou dedo.</p>
          {sigUrl && (
            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
              <p className="mb-1 text-xs text-slate-400">Actual</p>
              <img src={sigUrl} alt="assinatura" className="mx-auto max-h-12 opacity-80" />
            </div>
          )}
          <div className="overflow-hidden rounded-lg border-2 border-dashed border-slate-200 bg-slate-50">
            <canvas ref={sigRef} width={360} height={120} className="w-full cursor-crosshair touch-none"
              onMouseDown={sigStart} onMouseMove={sigDraw} onMouseUp={sigStop} onMouseLeave={sigStop}
              onTouchStart={sigStart} onTouchMove={sigDraw} onTouchEnd={sigStop} />
          </div>
          <div className="mt-2 flex gap-2">
            <button type="button" className="btn-outline flex-1" onClick={sigClear}>Limpar</button>
            <button type="button" className="btn-primary flex-1" onClick={saveSig}>Guardar</button>
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-3 font-heading font-bold text-primary">Dados gerais</h2>
          <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">{field('name', 'Nome da empresa')}</div>
            {field('nif', 'NIF')}
            {field('phone', 'Telefone')}
            <div className="sm:col-span-2">{field('address', 'Morada')}</div>
            {field('email', 'Email', 'email')}
            {field('currency', 'Moeda')}
            {field('bank_name', 'Banco')}
            {field('account_number', 'Nº de conta')}
            {field('iban', 'IBAN')}
            {field('default_debit_account', 'Conta de débito padrão')}
            <div className="sm:col-span-2 flex justify-end">
              <button className="btn-primary" disabled={saving}><Save size={16} /> Guardar</button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
