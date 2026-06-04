import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LogOut, FileText, CheckCircle2, Clock, PenLine, User, ChevronDown, ChevronUp, KeyRound, Palmtree, CalendarRange, Plus, Send, ScrollText, TrendingUp, Star, QrCode, Video, LogIn, LogOut as LogOutIcon } from 'lucide-react'
import jsQR from 'jsqr'
import { toast } from 'sonner'
import axios from 'axios'
import logo from '../assets/rhadmin-logo.svg'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

interface PortalEmployee {
  id: number; full_name: string; email: string; position?: string; department?: string
  bi_nif?: string; signature_path?: string
}

interface Slip {
  id: number; month: number; year: number; net_salary: string
  status: string; issued_at?: string; issued_by_name?: string
  receipt_confirmed_at?: string; receipt_signature_path?: string
}

interface VacationBalance {
  year: number; entitled_days: number; carried_over: number
  extra_days: number; used_days: number; total: number; remaining: number
}
interface VacationReq {
  id: number; start_date: string; end_date: string; working_days: number
  reason?: string; status: 'pending' | 'approved' | 'rejected'; approved_at?: string; rejection_reason?: string
}
interface ScheduleEntry {
  id: number; date: string; notes?: string
  shift: { name: string; code: string; color: string; start_time: string; end_time: string; type: string }
}

interface ReviewItem {
  id: number; period_year: number; period_type: string; period_number: number
  overall_score?: string | null; reviewer_comments?: string; conducted_at?: string
  reviewer?: { id: number; name: string }
  scores?: { id: number; score: number; comment?: string; criterion: { name: string; category: string; weight: string } }[]
}

interface ContractItem {
  id: number; type: string; title?: string; position?: string; department?: string
  base_salary: string; food_allowance: string; transport_allowance: string
  start_date: string; end_date?: string; status: string
  signed_at?: string; employee_signature_path?: string
}

const CONTRACT_TYPE: Record<string, string> = {
  indeterminado: 'Prazo Indeterminado', prazo_certo: 'Prazo Certo', prestacao_servicos: 'Prestação de Serviços',
}
const CONTRACT_STATUS_STYLE: Record<string, string> = {
  active: 'bg-green-100 text-green-700', suspended: 'bg-amber-100 text-amber-700',
  terminated: 'bg-red-100 text-red-700', expired: 'bg-slate-100 text-slate-500',
}
const CONTRACT_STATUS_LABEL: Record<string, string> = {
  active: 'Activo', suspended: 'Suspenso', terminated: 'Rescindido', expired: 'Expirado',
}

const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

// ── API helper ───────────────────────────────────────────────────────────────

function makeApi(slug: string, token: string) {
  return axios.create({
    baseURL: API,
    headers: { 'X-Tenant': slug, Authorization: `Bearer ${token}`, Accept: 'application/json' },
  })
}

// ── QR Scanner (funcionário) ─────────────────────────────────────────────────

interface TodayAttendance {
  check_in?: string; check_out?: string; status?: string; source?: string
}

function QrScanner({ slug, token }: { slug: string; token: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const scanRef = useRef<number | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned] = useState<string | null>(null)
  const [type, setType] = useState<'in' | 'out'>('in')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [today, setToday] = useState<TodayAttendance | null>(null)
  const [loadingToday, setLoadingToday] = useState(true)
  const api = makeApi(slug, token)

  // Carregar registo de hoje
  useEffect(() => {
    api.get('/attendances/qr/today')
      .then(r => { setToday(r.data); if (r.data?.check_in && !r.data?.check_out) setType('out') })
      .catch(() => {})
      .finally(() => setLoadingToday(false))
  }, [])

  // Iniciar câmara
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play() }
      setScanning(true)
      tick()
    } catch { toast.error('Não foi possível aceder à câmara') }
  }

  const stopCamera = () => {
    if (scanRef.current) cancelAnimationFrame(scanRef.current)
    const stream = videoRef.current?.srcObject as MediaStream | null
    stream?.getTracks().forEach(t => t.stop())
    if (videoRef.current) videoRef.current.srcObject = null
    setScanning(false)
  }

  const tick = () => {
    const video = videoRef.current; const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) { scanRef.current = requestAnimationFrame(tick); return }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const code = jsQR(img.data, img.width, img.height)
    if (code?.data) { setScanned(code.data); stopCamera(); return }
    scanRef.current = requestAnimationFrame(tick)
  }

  const submit = async () => {
    if (!scanned || !password) { toast.error('Leia o QR e introduza a senha'); return }
    setSubmitting(true)
    try {
      navigator.geolocation.getCurrentPosition(async pos => {
        try {
          const { data } = await api.post('/attendances/qr/clock', {
            token: scanned.split('qr=')[1] ?? scanned,
            lat: pos.coords.latitude, lng: pos.coords.longitude,
            type, password,
          })
          toast.success(data.message)
          setToday(data.attendance)
          setScanned(null); setPassword('')
          if (type === 'in') setType('out')
        } catch (e: unknown) {
          const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
          toast.error(msg ?? 'Erro ao registar presença')
        } finally { setSubmitting(false) }
      }, () => { toast.error('Localização necessária'); setSubmitting(false) })
    } catch { setSubmitting(false) }
  }

  return (
    <div className="space-y-4">
      {/* Registo de hoje */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-800 flex items-center gap-2">
          <Clock size={16} className="text-primary" /> Registo de hoje
        </h2>
        {loadingToday ? <p className="text-sm text-slate-400">A carregar…</p> : (
          <div className="grid grid-cols-2 gap-3">
            <div className={`rounded-xl p-3 text-center ${today?.check_in ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'}`}>
              <LogIn size={18} className={`mx-auto mb-1 ${today?.check_in ? 'text-green-600' : 'text-slate-400'}`} />
              <p className="text-xs text-slate-500">Entrada</p>
              <p className={`font-bold text-sm ${today?.check_in ? 'text-green-700' : 'text-slate-400'}`}>
                {today?.check_in ?? '—'}
              </p>
            </div>
            <div className={`rounded-xl p-3 text-center ${today?.check_out ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-slate-200'}`}>
              <LogOutIcon size={18} className={`mx-auto mb-1 ${today?.check_out ? 'text-blue-600' : 'text-slate-400'}`} />
              <p className="text-xs text-slate-500">Saída</p>
              <p className={`font-bold text-sm ${today?.check_out ? 'text-blue-700' : 'text-slate-400'}`}>
                {today?.check_out ?? '—'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Scanner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <QrCode size={16} className="text-primary" /> Registar Presença por QR
        </h2>

        <div className="flex gap-2">
          <button onClick={() => setType('in')}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${type === 'in' ? 'bg-green-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Entrada
          </button>
          <button onClick={() => setType('out')}
            className={`flex-1 rounded-xl py-2 text-sm font-medium transition ${type === 'out' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            Saída
          </button>
        </div>

        {/* Câmara */}
        {!scanned && (
          <div className="space-y-3">
            <div className="relative overflow-hidden rounded-xl bg-black aspect-square max-w-xs mx-auto">
              <video ref={videoRef} playsInline className="w-full h-full object-cover" />
              {scanning && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="h-40 w-40 rounded-xl border-2 border-primary/70 animate-pulse" />
                </div>
              )}
              {!scanning && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Video size={32} className="text-white/50" />
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" />
            <button onClick={scanning ? stopCamera : startCamera}
              className={`w-full rounded-xl py-2.5 text-sm font-semibold transition ${scanning ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-primary text-white hover:bg-primary/90'}`}>
              {scanning ? 'Parar câmara' : 'Abrir câmara e ler QR'}
            </button>
          </div>
        )}

        {/* QR lido — confirmar */}
        {scanned && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-3">
              <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              <p className="text-sm text-green-700 font-medium">QR lido com sucesso</p>
            </div>
            <div>
              <label className="label">Senha de confirmação</label>
              <input className="input" type="password" placeholder="A sua palavra-passe"
                value={password} onChange={e => setPassword(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setScanned(null) }}
                className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                Ler novamente
              </button>
              <button onClick={submit} disabled={submitting || !password}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60">
                {submitting ? 'A registar…' : `Confirmar ${type === 'in' ? 'entrada' : 'saída'}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Signature Pad ────────────────────────────────────────────────────────────

function SignaturePad({ onSave }: { onSave: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const src = 'touches' in e ? e.touches[0] : e
    return { x: (src.clientX - rect.left) * scaleX, y: (src.clientY - rect.top) * scaleY }
  }

  const start = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    drawing.current = true
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.beginPath(); ctx.moveTo(x, y)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b'
    ctx.lineTo(x, y); ctx.stroke()
  }

  const stop = () => { drawing.current = false }

  const clear = () => {
    const canvas = canvasRef.current!
    canvas.getContext('2d')!.clearRect(0, 0, canvas.width, canvas.height)
  }

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
        <canvas ref={canvasRef} width={460} height={160}
          className="w-full cursor-crosshair touch-none"
          onMouseDown={start} onMouseMove={draw} onMouseUp={stop} onMouseLeave={stop}
          onTouchStart={start} onTouchMove={draw} onTouchEnd={stop}
        />
      </div>
      <div className="flex justify-between">
        <button onClick={clear} className="text-sm text-slate-500 hover:text-slate-700">Limpar</button>
        <button onClick={() => onSave(canvasRef.current!.toDataURL('image/png'))}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition">
          <PenLine size={14} /> Guardar assinatura
        </button>
      </div>
    </div>
  )
}

// ── Portal principal ─────────────────────────────────────────────────────────

export default function EmployeePortal() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [slug, setSlug] = useState(localStorage.getItem('portal_tenant') ?? '')
  const [token, setToken] = useState(localStorage.getItem('portal_token') ?? '')
  const [employee, setEmployee] = useState<PortalEmployee | null>(null)
  const [slips, setSlips] = useState<Slip[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<'recibos' | 'contratos' | 'ferias' | 'escala' | 'perfil' | 'assinatura' | 'avaliacoes' | 'assiduidade'>('recibos')
  const [contracts, setContracts] = useState<ContractItem[]>([])
  const [expanded, setExpanded] = useState<number | null>(null)
  const [vacBalance, setVacBalance] = useState<VacationBalance | null>(null)
  const [vacRequests, setVacRequests] = useState<VacationReq[]>([])
  const [schedule, setSchedule] = useState<ScheduleEntry[]>([])
  const [schedMonth, setSchedMonth] = useState(new Date().getMonth() + 1)
  const [schedYear, setSchedYear] = useState(new Date().getFullYear())
  const [vacForm, setVacForm] = useState({ start_date: '', end_date: '', reason: '' })
  const [vacModal, setVacModal] = useState(false)
  const [submittingVac, setSubmittingVac] = useState(false)
  const [mustSetPassword, setMustSetPassword] = useState(false)
  const [newPw, setNewPw] = useState('')
  const [newPwConfirm, setNewPwConfirm] = useState('')
  const [settingPw, setSettingPw] = useState(false)
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null)
  const [portalError, setPortalError] = useState<string | null>(null)
  const [confirmSlip, setConfirmSlip] = useState<number | null>(null)
  const [receiptSigUrls, setReceiptSigUrls] = useState<Record<number, string>>({})
  const [pdfPreview, setPdfPreview] = useState<string | null>(null)
  const [signContractId, setSignContractId] = useState<number | null>(null)
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [expandedReview, setExpandedReview] = useState<number | null>(null)
  const signCanvasRef = useRef<HTMLCanvasElement>(null)
  const signDrawing = useRef(false)
  const [confirmPw, setConfirmPw] = useState('')
  const [confirming, setConfirming] = useState(false)

  // ── Token SMS auto-login ─────────────────────────────────────────────────
  useEffect(() => {
    const smsToken = searchParams.get('token')
    const org      = searchParams.get('org')
    if (!smsToken || !org) return
    setLoading(true)
    axios.post(`${API}/portal/token-login`, { token: smsToken }, {
      headers: { 'X-Tenant': org, Accept: 'application/json' },
    }).then(({ data }) => {
      localStorage.setItem('portal_token', data.token)
      localStorage.setItem('portal_tenant', org)
      setToken(data.token)
      setSlug(org)
      setMustSetPassword(!!data.must_set_password)
      setSearchParams({}, { replace: true })
    }).catch(() => {
      toast.error('Link inválido ou expirado.')
    }).finally(() => setLoading(false))
  }, [])

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [loginForm, setLoginForm] = useState({ slug: slug, email: '', password: '' })

  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setPortalError(null)
    try {
      const { data } = await axios.post(`${API}/login`,
        { email: loginForm.email, password: loginForm.password },
        { headers: { 'X-Tenant': loginForm.slug, Accept: 'application/json' } }
      )
      localStorage.setItem('portal_token', data.token)
      localStorage.setItem('portal_tenant', loginForm.slug)
      setToken(data.token); setSlug(loginForm.slug)
    } catch {
      toast.error('Credenciais inválidas')
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('portal_token'); localStorage.removeItem('portal_tenant')
    setToken(''); setEmployee(null); setSlips([]); setPortalError(null)
  }

  // ── Data ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!token || !slug) return
    const api = makeApi(slug, token)
    api.get('/portal/me').then(r => {
      setEmployee(r.data)
      setPortalError(null)
      if (r.data.signature_path) {
        api.get('/portal/signature', { responseType: 'blob' })
          .then(res => setSignatureUrl(URL.createObjectURL(res.data)))
          .catch(() => {})
      }
    }).catch((err) => {
      const status = err?.response?.status
      if (status === 404) {
        setPortalError('A sua conta de utilizador ainda não está associada a um perfil de funcionário. Contacte o departamento de RH.')
      } else if (status === 401) {
        logout()
      } else {
        setPortalError('Erro ao carregar perfil. Tente novamente.')
      }
    })
    api.get('/portal/salary-slips').then(r => setSlips(r.data.data ?? [])).catch(() => {})
    api.get('/portal/contracts').then(r => setContracts(r.data ?? [])).catch(() => {})
    api.get('/portal/vacations').then(r => { setVacBalance(r.data.balance); setVacRequests(r.data.requests) }).catch(() => {})
    api.get('/portal/reviews').then(r => setReviews(r.data ?? [])).catch(() => {})
  }, [token, slug])

  const loadSchedule = (m: number, y: number) => {
    const api = makeApi(slug, token)
    api.get(`/portal/schedule?month=${m}&year=${y}`).then(r => setSchedule(r.data)).catch(() => {})
  }

  useEffect(() => { if (token && slug) loadSchedule(schedMonth, schedYear) }, [token, slug, schedMonth, schedYear])

  const submitVacation = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmittingVac(true)
    const api = makeApi(slug, token)
    try {
      const res = await api.post('/portal/vacations', vacForm)
      toast.success('Pedido de férias submetido!')
      setVacRequests(v => [res.data, ...v])
      setVacModal(false); setVacForm({ start_date: '', end_date: '', reason: '' })
    } catch { toast.error('Erro ao submeter') } finally { setSubmittingVac(false) }
  }

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirmSlip) return
    setConfirming(true)
    try {
      const portalApi = makeApi(slug, token)
      await portalApi.post(`/portal/salary-slips/${confirmSlip}/confirm`, { password: confirmPw })
      toast.success('Recibo confirmado!')
      setSlips(s => s.map(slip => slip.id === confirmSlip ? { ...slip, receipt_confirmed_at: new Date().toISOString(), receipt_signature_path: 'pending' } : slip))
      // carrega a assinatura do recibo que acabou de ser confirmado
      makeApi(slug, token)
        .get(`/portal/salary-slips/${confirmSlip}/receipt-signature`, { responseType: 'blob' })
        .then(r => setReceiptSigUrls(prev => ({ ...prev, [confirmSlip!]: URL.createObjectURL(r.data) })))
        .catch(() => {})
      setConfirmSlip(null); setConfirmPw('')
    } catch (err: any) {
      const msg = err?.response?.data?.message
      toast.error(msg === 'Senha incorrecta.' ? 'Senha incorrecta.' : 'Erro ao confirmar')
    } finally {
      setConfirming(false)
    }
  }

  const sigGetPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const src = 'touches' in e ? e.touches[0] : e
    return { x: (src.clientX - rect.left) * (canvas.width / rect.width), y: (src.clientY - rect.top) * (canvas.height / rect.height) }
  }
  const sigStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); signDrawing.current = true
    const ctx = signCanvasRef.current!.getContext('2d')!
    const { x, y } = sigGetPos(e, signCanvasRef.current!)
    ctx.beginPath(); ctx.moveTo(x, y)
  }
  const sigDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault(); if (!signDrawing.current) return
    const ctx = signCanvasRef.current!.getContext('2d')!
    const { x, y } = sigGetPos(e, signCanvasRef.current!)
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1e293b'
    ctx.lineTo(x, y); ctx.stroke()
  }
  const sigStop = () => { signDrawing.current = false }
  const sigClear = () => signCanvasRef.current!.getContext('2d')!.clearRect(0, 0, signCanvasRef.current!.width, signCanvasRef.current!.height)

  const submitSignContract = async () => {
    if (!signContractId) return
    const dataUrl = signCanvasRef.current!.toDataURL('image/png')
    try {
      const portalApi = makeApi(slug, token)
      const { data } = await portalApi.post(`/portal/contracts/${signContractId}/sign`, { signature: dataUrl })
      toast.success('Contrato assinado com sucesso!')
      setContracts(cs => cs.map(c => c.id === signContractId ? { ...c, signed_at: data.signed_at, employee_signature_path: 'set' } : c))
      setSignContractId(null)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro ao assinar')
    }
  }

  const previewPdf = async (slipId: number) => {
    try {
      const portalApi = makeApi(slug, token)
      const res = await portalApi.get(`/portal/salary-slips/${slipId}/pdf`, { responseType: 'blob' })
      setPdfPreview(URL.createObjectURL(res.data))
    } catch { toast.error('Erro ao carregar PDF') }
  }

  const saveSignature = async (dataUrl: string) => {
    const portalApi = makeApi(slug, token)
    try {
      await portalApi.post('/portal/signature', { signature: dataUrl })
      toast.success('Assinatura guardada!')
      setEmployee(e => e ? { ...e, signature_path: 'set' } : e)
      // refrescar preview via blob
      setSignatureUrl(dataUrl)
    } catch { toast.error('Erro ao guardar assinatura') }
  }

  // ── Definir password (primeiro acesso via token) ─────────────────────────
  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPw !== newPwConfirm) { toast.error('As passwords não coincidem'); return }
    setSettingPw(true)
    try {
      const api = makeApi(slug, token)
      await api.post('/portal/set-password', { password: newPw, password_confirmation: newPwConfirm })
      toast.success('Password definida! Bem-vindo(a) ao portal.')
      setMustSetPassword(false)
      setNewPw(''); setNewPwConfirm('')
    } catch { toast.error('Erro ao definir password') } finally { setSettingPw(false) }
  }

  if (token && loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <p className="text-slate-500 text-sm">A entrar…</p>
    </div>
  )

  if (token && portalError) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-lg text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
          <KeyRound size={24} className="text-red-500" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-bold text-slate-800">Sem acesso ao portal</h2>
          <p className="mt-2 text-sm text-slate-500">{portalError}</p>
        </div>
        <button onClick={logout} className="w-full rounded-xl border border-slate-200 py-2.5 text-sm text-slate-600 hover:bg-slate-50 transition">
          Sair
        </button>
      </div>
    </div>
  )

  // ── Login form ────────────────────────────────────────────────────────────
  if (!token) return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-900 via-primary to-primary-600 p-4">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-8 py-6 text-center">
          <img src={logo} alt="RHadmin" className="mx-auto mb-3 w-32" />
          <h1 className="font-heading text-xl font-bold text-slate-800">Portal do Funcionário</h1>
          <p className="mt-1 text-sm text-slate-500">Aceda aos seus recibos e documentos</p>
        </div>
        <form onSubmit={login} className="space-y-4 px-8 py-6">
          <div>
            <label className="label">Organização</label>
            <input className="input" value={loginForm.slug} onChange={e => setLoginForm(f => ({ ...f, slug: e.target.value }))}
              placeholder="código da empresa" required autoCapitalize="none" />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={loginForm.email} onChange={e => setLoginForm(f => ({ ...f, email: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Palavra-passe</label>
            <input className="input" type="password" value={loginForm.password} onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))} required />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5">
            {loading ? 'A entrar…' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )

  // ── Portal ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Modal definir password no primeiro acesso */}
      {mustSetPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl">
            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
              <KeyRound size={22} className="text-primary" />
            </div>
            <h2 className="font-heading text-xl font-bold text-slate-800">Defina a sua password</h2>
            <p className="mt-1 text-sm text-slate-500">É o seu primeiro acesso. Escolha uma password para entrar no futuro.</p>
            <form onSubmit={submitPassword} className="mt-5 space-y-4">
              <div>
                <label className="label">Nova password</label>
                <input type="password" className="input" value={newPw} onChange={e => setNewPw(e.target.value)} required minLength={6} placeholder="mínimo 6 caracteres" />
              </div>
              <div>
                <label className="label">Confirmar password</label>
                <input type="password" className="input" value={newPwConfirm} onChange={e => setNewPwConfirm(e.target.value)} required minLength={6} />
              </div>
              <button type="submit" disabled={settingPw} className="btn-primary w-full py-2.5">
                {settingPw ? 'A guardar…' : 'Definir password e entrar'}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Topbar */}
      <header className="border-b border-slate-200 bg-white px-6 py-3.5">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logo} alt="RHadmin" className="h-7" />
            <span className="text-sm font-medium text-slate-600">Portal do Funcionário</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-700">{employee?.full_name}</span>
            <button onClick={logout} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 transition">
              <LogOut size={14} /> Sair
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {/* Perfil resumo */}
        <div className="rounded-2xl bg-white border border-slate-200 p-6 flex items-center gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-heading text-2xl font-bold text-primary">
            {employee?.full_name?.charAt(0) ?? '?'}
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800">{employee?.full_name}</p>
            <p className="text-sm text-slate-500">{employee?.position ?? '—'}{employee?.department ? ` · ${employee.department}` : ''}</p>
            <p className="text-xs text-slate-400 mt-0.5">{employee?.email}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-xl bg-slate-100 p-1 flex-wrap">
          {([
            { key: 'recibos',     label: 'Recibos',      icon: FileText },
            { key: 'contratos',   label: 'Contratos',    icon: ScrollText },
            { key: 'ferias',      label: 'Férias',       icon: Palmtree },
            { key: 'escala',      label: 'Escala',       icon: CalendarRange },
            { key: 'assiduidade', label: 'Assiduidade',  icon: QrCode },
            { key: 'avaliacoes',  label: 'Avaliações',   icon: TrendingUp },
            { key: 'perfil',      label: 'Perfil',       icon: User },
            { key: 'assinatura',  label: 'Assinatura',   icon: PenLine },
          ] as const).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition min-w-[72px] ${tab === key ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* Recibos */}
        {tab === 'recibos' && (
          <div className="space-y-3">
            {slips.length === 0 && (
              <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
                <FileText size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-slate-500">Sem recibos disponíveis</p>
              </div>
            )}
            {slips.map(slip => (
              <div key={slip.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <button className="flex w-full items-center justify-between px-5 py-4 text-left"
                  onClick={() => {
                    const next = expanded === slip.id ? null : slip.id
                    setExpanded(next)
                    if (next && slip.receipt_signature_path && !receiptSigUrls[slip.id]) {
                      makeApi(slug, token)
                        .get(`/portal/salary-slips/${slip.id}/receipt-signature`, { responseType: 'blob' })
                        .then(r => setReceiptSigUrls(prev => ({ ...prev, [slip.id]: URL.createObjectURL(r.data) })))
                        .catch(() => {})
                    }
                  }}>
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <FileText size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{MONTHS[slip.month - 1]} {slip.year}</p>
                      <p className="text-xs text-slate-500">{Number(slip.net_salary).toLocaleString('pt-PT')} AOA líquido</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {slip.receipt_confirmed_at ? (
                      <span className="flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-700">
                        <CheckCircle2 size={12} /> Confirmado
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700">
                        <Clock size={12} /> Pendente
                      </span>
                    )}
                    {expanded === slip.id ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                  </div>
                </button>
                {expanded === slip.id && (
                  <div className="border-t border-slate-100 px-5 py-4 space-y-3">
                    <div className="text-xs text-slate-400 space-y-0.5">
                      {slip.issued_at && (
                        <p>Emitido em {new Date(slip.issued_at.replace(' ','T')).toLocaleDateString('pt-PT')}
                          {slip.issued_by_name && <span className="ml-1">por <strong className="text-slate-600">{slip.issued_by_name}</strong></span>}
                        </p>
                      )}
                      {!slip.issued_at && <p>Ainda não emitido</p>}
                      {slip.receipt_confirmed_at && (
                        <p>Confirmado em {new Date(slip.receipt_confirmed_at.replace(' ','T')).toLocaleDateString('pt-PT')}</p>
                      )}
                    </div>
                    {slip.receipt_signature_path && receiptSigUrls[slip.id] && (
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                        <p className="text-xs text-slate-400 mb-2">Assinatura de confirmação</p>
                        <img src={receiptSigUrls[slip.id]} alt="assinatura" className="max-h-16 opacity-80" />
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2">
                      {slip.status === 'issued' && (
                        <button onClick={() => previewPdf(slip.id)}
                          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                          <FileText size={15} /> Ver recibo
                        </button>
                      )}
                      {!slip.receipt_confirmed_at && slip.status === 'issued' && (
                        <button onClick={() => { setConfirmSlip(slip.id); setConfirmPw('') }}
                          className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition">
                          <CheckCircle2 size={15} /> Confirmar recebimento
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Férias */}
        {tab === 'ferias' && (
          <div className="space-y-4">
            {vacBalance && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-xs text-slate-400 mb-3 uppercase tracking-wide">Saldo de Férias {vacBalance.year}</p>
                <div className="grid grid-cols-4 gap-3 text-center">
                  {[['Direito', vacBalance.entitled_days], ['Transitados', vacBalance.carried_over], ['Usados', vacBalance.used_days], ['Disponíveis', vacBalance.remaining]].map(([l, v]) => (
                    <div key={l as string} className={`rounded-xl p-3 ${l === 'Disponíveis' ? 'bg-primary/10' : 'bg-slate-50'}`}>
                      <p className={`text-2xl font-bold ${l === 'Disponíveis' ? 'text-primary' : 'text-slate-700'}`}>{v}</p>
                      <p className="text-xs text-slate-400">{l}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Pedidos de férias</p>
              <button onClick={() => setVacModal(true)}
                className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white hover:bg-primary/90 transition">
                <Plus size={13} /> Solicitar
              </button>
            </div>
            {vacRequests.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center">
                <Palmtree size={24} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-500">Sem pedidos de férias</p>
              </div>
            ) : (
              <div className="space-y-2">
                {vacRequests.map(v => (
                  <div key={v.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {new Date(v.start_date).toLocaleDateString('pt-PT')} → {new Date(v.end_date).toLocaleDateString('pt-PT')}
                      </p>
                      <p className="text-xs text-slate-400">{v.working_days} dias úteis{v.reason ? ` · ${v.reason}` : ''}</p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      v.status === 'approved' ? 'bg-green-100 text-green-700' :
                      v.status === 'rejected' ? 'bg-red-100 text-red-600' :
                      'bg-amber-100 text-amber-700'}`}>
                      {v.status === 'approved' ? 'Aprovado' : v.status === 'rejected' ? 'Rejeitado' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            )}
            {/* Modal pedido */}
            {vacModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
                  <h3 className="font-semibold text-slate-800 mb-4">Solicitar Férias</h3>
                  <form onSubmit={submitVacation} className="space-y-3">
                    <div>
                      <label className="label">Data de início *</label>
                      <input type="date" className="input" required value={vacForm.start_date} onChange={e => setVacForm(f => ({ ...f, start_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Data de fim *</label>
                      <input type="date" className="input" required value={vacForm.end_date} onChange={e => setVacForm(f => ({ ...f, end_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Motivo (opcional)</label>
                      <input className="input" value={vacForm.reason} onChange={e => setVacForm(f => ({ ...f, reason: e.target.value }))} placeholder="Férias anuais…" />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button type="button" onClick={() => setVacModal(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm text-slate-600">Cancelar</button>
                      <button type="submit" disabled={submittingVac} className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition">
                        {submittingVac ? 'A enviar…' : 'Submeter'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Escala */}
        {tab === 'escala' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <button onClick={() => { const d = new Date(schedYear, schedMonth - 2); setSchedMonth(d.getMonth() + 1); setSchedYear(d.getFullYear()) }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">‹</button>
              <p className="flex-1 text-center text-sm font-semibold text-slate-700">
                {MONTH_NAMES[schedMonth - 1]} {schedYear}
              </p>
              <button onClick={() => { const d = new Date(schedYear, schedMonth); setSchedMonth(d.getMonth() + 1); setSchedYear(d.getFullYear()) }}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50">›</button>
            </div>
            {schedule.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center">
                <CalendarRange size={24} className="mx-auto mb-2 text-slate-300" />
                <p className="text-sm text-slate-500">Sem escala definida para este mês</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {schedule.map(s => (
                  <div key={s.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-4 py-3">
                    <div className="w-12 shrink-0 text-center">
                      <p className="text-xs text-slate-400">{new Date(s.date + 'T00:00').toLocaleDateString('pt-PT', { weekday: 'short' })}</p>
                      <p className="text-lg font-bold text-slate-700">{new Date(s.date + 'T00:00').getDate()}</p>
                    </div>
                    <div className="h-8 w-1 rounded-full shrink-0" style={{ backgroundColor: s.shift?.color ?? '#94a3b8' }} />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{s.shift?.name ?? '—'} <span className="font-normal text-slate-400 text-xs">({s.shift?.code})</span></p>
                      {s.shift?.start_time && (
                        <p className="text-xs text-slate-400">{s.shift.start_time} – {s.shift.end_time}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Contratos */}
        {tab === 'contratos' && (
          <div className="space-y-3">
            {contracts.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
                <ScrollText size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-slate-500">Sem contratos disponíveis</p>
              </div>
            ) : contracts.map(c => (
              <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                      <ScrollText size={18} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {c.title || CONTRACT_TYPE[c.type] || c.type}
                      </p>
                      <p className="text-xs text-slate-500">
                        {c.position && <span>{c.position}</span>}
                        {c.position && c.department && <span> · </span>}
                        {c.department && <span>{c.department}</span>}
                      </p>
                    </div>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${CONTRACT_STATUS_STYLE[c.status] ?? ''}`}>
                    {CONTRACT_STATUS_LABEL[c.status] ?? c.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <div><span className="text-slate-400">Início:</span> {new Date(c.start_date).toLocaleDateString('pt-PT')}</div>
                  {c.end_date && <div><span className="text-slate-400">Fim:</span> {new Date(c.end_date).toLocaleDateString('pt-PT')}</div>}
                  <div><span className="text-slate-400">Salário base:</span> {Number(c.base_salary).toLocaleString('pt-PT')} AOA</div>
                  <div><span className="text-slate-400">Tipo:</span> {CONTRACT_TYPE[c.type] ?? c.type}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    onClick={async () => {
                      try {
                        const portalApi = makeApi(slug, token)
                        const res = await portalApi.get(`/portal/contracts/${c.id}/pdf`, { responseType: 'blob' })
                        setPdfPreview(URL.createObjectURL(res.data))
                      } catch { toast.error('Erro ao carregar contrato') }
                    }}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition"
                  >
                    <FileText size={13} /> Ver contrato
                  </button>
                  {!c.signed_at ? (
                    <button
                      onClick={() => { setSignContractId(c.id); setTimeout(() => sigClear(), 50) }}
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 transition"
                    >
                      <PenLine size={13} /> Assinar contrato
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 rounded-lg bg-green-100 px-3 py-1.5 text-xs font-medium text-green-700">
                      <CheckCircle2 size={13} /> Assinado em {new Date(c.signed_at).toLocaleDateString('pt-PT')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Perfil */}
        {tab === 'perfil' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="font-semibold text-slate-800">Os meus dados</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              {([['Nome', employee?.full_name], ['BI / NIF', employee?.bi_nif], ['Email', employee?.email], ['Cargo', employee?.position], ['Departamento', employee?.department]] as [string, string | undefined][]).map(([l, v]) => (
                <div key={l}>
                  <p className="text-xs text-slate-400 mb-0.5">{l}</p>
                  <p className="font-medium text-slate-700">{v ?? '—'}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">Para alterar os seus dados contacte o departamento de RH.</p>
          </div>
        )}

        {/* Assinatura */}
        {tab === 'avaliacoes' && (
          <div className="space-y-4">
            {reviews.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
                <TrendingUp size={32} className="mx-auto mb-2 text-slate-300" />
                <p className="text-slate-500">Sem avaliações disponíveis</p>
              </div>
            ) : reviews.map(r => {
              const typeLabel: Record<string, string> = { annual: 'Anual', semi_annual: 'Semestral', quarterly: 'Trimestral' }
              const scoreColor = (n: number) => n >= 4.5 ? 'text-green-600' : n >= 3.5 ? 'text-blue-600' : n >= 2.5 ? 'text-amber-500' : 'text-red-500'
              const isOpen = expandedReview === r.id
              return (
                <div key={r.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <button className="flex w-full items-center justify-between px-5 py-4 text-left"
                    onClick={() => setExpandedReview(isOpen ? null : r.id)}>
                    <div>
                      <p className="font-semibold text-slate-800">
                        {typeLabel[r.period_type]} {r.period_number > 1 ? `${r.period_number}º · ` : ''}{r.period_year}
                      </p>
                      {r.reviewer && <p className="text-xs text-slate-400">Avaliador: {r.reviewer.name}</p>}
                    </div>
                    <div className="flex items-center gap-3">
                      {r.overall_score && (
                        <div className={`font-heading text-2xl font-bold ${scoreColor(parseFloat(r.overall_score))}`}>
                          {parseFloat(r.overall_score).toFixed(1)}<span className="text-sm text-slate-400 font-normal">/5</span>
                        </div>
                      )}
                      {isOpen ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </button>
                  {isOpen && (
                    <div className="border-t border-slate-100 px-5 py-4 space-y-3 bg-slate-50">
                      {r.scores && r.scores.length > 0 && (
                        <div className="space-y-2">
                          {r.scores.map(s => (
                            <div key={s.id} className="flex items-center gap-3 text-sm">
                              <span className="flex-1 text-slate-600">{s.criterion.name}</span>
                              <div className="flex gap-0.5">
                                {[1,2,3,4,5].map(n => <Star key={n} size={12} className={n <= s.score ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {r.reviewer_comments && (
                        <p className="text-sm text-slate-600 border-t border-slate-200 pt-3">
                          <span className="font-medium text-slate-500">Comentário: </span>{r.reviewer_comments}
                        </p>
                      )}
                      {r.conducted_at && (
                        <p className="text-xs text-slate-400">Concluída a {new Date(r.conducted_at).toLocaleDateString('pt-PT')}</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'assiduidade' && (
          <QrScanner slug={slug} token={token} />
        )}

        {tab === 'assinatura' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-5">
            <div>
              <h2 className="font-semibold text-slate-800">Assinatura digital</h2>
              <p className="mt-1 text-sm text-slate-500">A sua assinatura é usada para validar documentos emitidos pela empresa.</p>
            </div>
            {signatureUrl && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4 text-center">
                <p className="text-xs text-slate-400 mb-2">Assinatura actual</p>
                <img src={signatureUrl} alt="assinatura" className="mx-auto max-h-20 opacity-80" />
              </div>
            )}
            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">
                {employee?.signature_path ? 'Actualizar assinatura' : 'Registar assinatura'}
              </p>
              <p className="mb-3 text-xs text-slate-400">Desenhe a sua assinatura com o rato ou com o dedo (no telemóvel).</p>
              <SignaturePad onSave={saveSignature} />
            </div>
          </div>
        )}
      </main>

      {/* Modal pré-visualização PDF */}
      {pdfPreview && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-2.5">
            <span className="text-sm font-medium text-slate-200">Recibo de Salário</span>
            <div className="flex items-center gap-2">
              <a href={pdfPreview} download="recibo.pdf"
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary/90">
                <FileText size={13} /> Descarregar
              </a>
              <button onClick={() => { URL.revokeObjectURL(pdfPreview); setPdfPreview(null) }}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-700 hover:text-white">
                Fechar
              </button>
            </div>
          </div>
          <iframe src={pdfPreview} className="flex-1 w-full" title="Recibo PDF" />
        </div>
      )}

      {/* Modal assinatura de contrato */}
      {signContractId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
              <PenLine size={20} className="text-primary" />
            </div>
            <h3 className="font-heading text-lg font-bold text-slate-800">Assinar contrato</h3>
            <p className="mt-1 text-sm text-slate-500">Desenhe a sua assinatura no espaço abaixo. Ao assinar confirma que leu e aceita os termos do contrato.</p>
            <div className="mt-4 overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
              <canvas
                ref={signCanvasRef} width={460} height={150}
                className="w-full cursor-crosshair touch-none"
                onMouseDown={sigStart} onMouseMove={sigDraw} onMouseUp={sigStop} onMouseLeave={sigStop}
                onTouchStart={sigStart} onTouchMove={sigDraw} onTouchEnd={sigStop}
              />
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={sigClear} className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50">
                Limpar
              </button>
              <button type="button" onClick={() => setSignContractId(null)} className="flex-1 rounded-lg border border-slate-200 py-2 text-sm text-slate-600">
                Cancelar
              </button>
              <button type="button" onClick={submitSignContract} className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary/90">
                Assinar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmação com senha */}
      {confirmSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 size={20} className="text-green-600" />
            </div>
            <h3 className="font-heading text-lg font-bold text-slate-800">Confirmar recebimento</h3>
            <p className="mt-1 text-sm text-slate-500">Introduza a sua senha para confirmar que recebeu este recibo de salário.</p>
            <form onSubmit={confirm} className="mt-4 space-y-3">
              <div>
                <label className="label">Senha</label>
                <input
                  type="password"
                  className="input"
                  value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  required
                  autoFocus
                  placeholder="A sua senha de acesso"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => { setConfirmSlip(null); setConfirmPw('') }}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                  Cancelar
                </button>
                <button type="submit" disabled={confirming}
                  className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-500 transition">
                  {confirming ? 'A confirmar…' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
