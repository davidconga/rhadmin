import { useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  User, Phone, CreditCard, PenLine,
  CheckCircle2, ArrowRight, ArrowLeft, Upload, Eye, EyeOff,
} from 'lucide-react'
import { toast } from 'sonner'
import axios from 'axios'
import logo from '../assets/rhadmin-logo.svg'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

const STEPS = [
  { label: 'Identificação', icon: User,       desc: 'Nome e BI/NIF' },
  { label: 'Contacto',      icon: Phone,      desc: 'Email e telefone' },
  { label: 'Documentos',    icon: CreditCard, desc: 'BI frente e verso' },
  { label: 'Assinatura',    icon: PenLine,    desc: 'Assinatura e senha de acesso' },
]

// ── Signature Pad ─────────────────────────────────────────────────────────────
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [hasSig, setHasSig] = useState(false)

  const pos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    const scaleX = canvas.width / r.width
    const scaleY = canvas.height / r.height
    const s = 'touches' in e ? e.touches[0] : e
    return { x: (s.clientX - r.left) * scaleX, y: (s.clientY - r.top) * scaleY }
  }
  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y)
  }
  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = pos(e)
    ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b'
    ctx.lineTo(x, y); ctx.stroke()
    setHasSig(true); onChange(canvasRef.current!.toDataURL('image/png'))
  }
  const stop = () => { drawing.current = false }
  const clear = () => {
    canvasRef.current!.getContext('2d')!.clearRect(0, 0, 460, 160)
    setHasSig(false); onChange(null)
  }

  return (
    <div className="space-y-2">
      <div className={`overflow-hidden rounded-xl border-2 transition ${hasSig ? 'border-primary' : 'border-dashed border-slate-300'} bg-slate-50`}>
        <canvas ref={canvasRef} width={460} height={160}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
        />
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Desenhe com o rato ou com o dedo</p>
        {hasSig && (
          <button type="button" onClick={clear} className="text-xs text-slate-500 hover:text-red-500 transition">
            Limpar
          </button>
        )}
      </div>
    </div>
  )
}

// ── File upload preview ──────────────────────────────────────────────────────
function FileUpload({ label, file, onChange }: {
  label: string; file: File | null; onChange: (f: File | null) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const preview = file ? URL.createObjectURL(file) : null

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      <div
        onClick={() => ref.current?.click()}
        className={`relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 transition ${
          file ? 'border-primary' : 'border-dashed border-slate-300 hover:border-primary/50'
        } bg-slate-50`}
        style={{ height: 140 }}
      >
        {preview ? (
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-2 text-slate-400">
            <Upload size={24} />
            <span className="text-xs">Clique para seleccionar</span>
            <span className="text-[10px]">JPG, PNG, WEBP até 4MB</span>
          </div>
        )}
        {file && (
          <div className="absolute bottom-0 left-0 right-0 bg-primary/80 px-2 py-1 text-center">
            <p className="truncate text-[10px] font-medium text-white">{file.name}</p>
          </div>
        )}
      </div>
      <input ref={ref} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
        onChange={e => onChange(e.target.files?.[0] ?? null)} />
    </div>
  )
}

// ── Formulário principal ──────────────────────────────────────────────────────
export default function EmployeeRegister() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()

  const [step, setStep] = useState(0)
  const [done, setDone] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showPw, setShowPw] = useState(false)

  // campos
  const [fullName,   setFullName]   = useState('')
  const [biNif,      setBiNif]      = useState('')
  const [position,   setPosition]   = useState('')
  const [email,      setEmail]      = useState('')
  const [phone,      setPhone]      = useState('')
  const [biFrente,   setBiFrente]   = useState<File | null>(null)
  const [biVerso,    setBiVerso]    = useState<File | null>(null)
  const [signature,  setSignature]  = useState<string | null>(null)
  const [password,   setPassword]   = useState('')
  const [pwConfirm,  setPwConfirm]  = useState('')

  const validate = () => {
    if (step === 0 && !fullName.trim()) { toast.error('Nome completo é obrigatório'); return false }
    if (step === 1 && !email.trim()) { toast.error('Email é obrigatório'); return false }
    if (step === 3) {
      if (!signature) { toast.error('Por favor desenhe a sua assinatura'); return false }
      if (!password) { toast.error('Defina uma senha de acesso'); return false }
      if (password !== pwConfirm) { toast.error('As senhas não coincidem'); return false }
      if (password.length < 6) { toast.error('A senha deve ter pelo menos 6 caracteres'); return false }
    }
    return true
  }

  const next = () => { if (validate()) setStep(s => s + 1) }
  const back = () => setStep(s => s - 1)

  const submit = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const fd = new FormData()
      fd.append('full_name', fullName)
      if (biNif)    fd.append('bi_nif', biNif)
      if (position) fd.append('position', position)
      if (email)    fd.append('email', email)
      if (phone)    fd.append('phone', phone)
      if (biFrente) fd.append('bi_frente', biFrente)
      if (biVerso)  fd.append('bi_verso', biVerso)
      if (signature) fd.append('signature', signature)
      fd.append('password', password)

      await axios.post(`${API}/employee-portal/register`, fd, {
        headers: { 'X-Tenant': slug ?? '', Accept: 'application/json' },
      })
      setDone(true)
    } catch {
      toast.error('Erro ao submeter — tente novamente')
    } finally {
      setSaving(false)
    }
  }

  // ── Ecrã de sucesso ──────────────────────────────────────────────────────
  if (done) return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-900 via-primary to-primary-600 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-10 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 size={32} className="text-green-500" />
        </div>
        <h2 className="font-heading text-2xl font-bold text-slate-800">Pedido enviado!</h2>
        <p className="mt-2 text-slate-500">
          O seu pedido foi submetido com sucesso.<br />
          O departamento de RH irá rever e contactá-lo brevemente.
        </p>
        <button onClick={() => navigate('/')} className="mt-6 text-sm text-primary hover:underline">
          ← Voltar ao início
        </button>
      </div>
    </div>
  )

  // ── Layout ───────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen items-start justify-center bg-gradient-to-br from-primary-900 via-primary to-primary-600 p-4 py-10">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Header */}
        <div className="border-b border-slate-100 px-8 py-6 text-center">
          <img src={logo} alt="RHadmin" className="mx-auto mb-3 w-36" />
          <h1 className="font-heading text-xl font-bold text-slate-800">Registo de Funcionário</h1>
          <p className="mt-1 text-sm text-slate-500">Preencha os seus dados para iniciar o processo de admissão</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center px-8 py-5">
          {STEPS.map((s, i) => {
            const done = i < step; const active = i === step
            const Icon = s.icon
            return (
              <div key={i} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-all ${
                    done   ? 'border-primary bg-primary text-white' :
                    active ? 'border-primary bg-primary/10 text-primary' :
                             'border-slate-200 bg-white text-slate-400'
                  }`}>
                    {done ? <CheckCircle2 size={16} /> : <Icon size={14} />}
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap ${active ? 'text-primary' : done ? 'text-primary/70' : 'text-slate-400'}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`mb-4 h-0.5 flex-1 mx-1 ${i < step ? 'bg-primary' : 'bg-slate-200'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Conteúdo */}
        <div className="px-8 pb-4 space-y-4">
          <div className="flex items-center gap-2.5 mb-1">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
              {(() => { const Icon = STEPS[step].icon; return <Icon size={14} className="text-primary" /> })()}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{STEPS[step].label}</p>
              <p className="text-xs text-slate-400">{STEPS[step].desc}</p>
            </div>
          </div>

          {/* Passo 0 — Identificação */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="label">Nome completo <span className="text-red-400">*</span></label>
                <input className="input" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Ex: Ana Paula Silva" autoFocus />
              </div>
              <div>
                <label className="label">Nº BI / NIF</label>
                <input className="input" value={biNif} onChange={e => setBiNif(e.target.value)}
                  placeholder="000000000LA000" />
              </div>
            </div>
          )}

          {/* Passo 1 — Contacto */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="label">Email <span className="text-red-400">*</span></label>
                <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="nome@exemplo.ao" required autoFocus />
              </div>
              <div>
                <label className="label">Telefone</label>
                <input className="input" value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="+244 9XX XXX XXX" />
              </div>
            </div>
          )}

          {/* Passo 2 — Documentos */}
          {step === 2 && (
            <div className="grid grid-cols-2 gap-4">
              <FileUpload label="BI — Frente" file={biFrente} onChange={setBiFrente} />
              <FileUpload label="BI — Verso"  file={biVerso}  onChange={setBiVerso} />
              <p className="col-span-2 text-xs text-slate-400">
                Fotografe o seu Bilhete de Identidade dos dois lados. Os documentos são guardados de forma segura.
              </p>
            </div>
          )}

          {/* Passo 3 — Assinatura + Senha */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label className="label">Assinatura <span className="text-red-400">*</span></label>
                <SignaturePad onChange={setSignature} />
              </div>
              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div>
                  <label className="label">Senha de acesso ao portal <span className="text-red-400">*</span></label>
                  <div className="relative">
                    <input className="input pr-10" type={showPw ? 'text' : 'password'}
                      value={password} onChange={e => setPassword(e.target.value)}
                      placeholder="mínimo 6 caracteres" />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="label">Confirmar senha <span className="text-red-400">*</span></label>
                  <input className="input" type="password"
                    value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                    placeholder="repita a senha" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-8 py-4">
          <div>
            {step > 0 && (
              <button type="button" onClick={back}
                className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition">
                <ArrowLeft size={14} /> Voltar
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400">{step + 1} / {STEPS.length}</span>
            {step < STEPS.length - 1 ? (
              <button type="button" onClick={next}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition">
                Seguinte <ArrowRight size={15} />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition disabled:opacity-60">
                {saving ? 'A enviar…' : 'Submeter pedido'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
