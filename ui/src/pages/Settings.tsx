import { useEffect, useState } from 'react'
import { Building2, Percent, ShieldCheck, Landmark, Fingerprint, CalendarClock, CalendarRange, Palmtree, Plus, Trash2, Save, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { money } from '../lib/format'
import { Card, Spinner, FeatureLocked } from '../components/ui'
import { useSubscription } from '../stores/subscription'
import Company from './Company'
import Banks from './Banks'
import Biometric from './Biometric'
import type { IrtBracket, Settings as SettingsType } from '../types'

type Tab = 'empresa' | 'bancos' | 'biometricos' | 'processamento' | 'escalas' | 'ferias' | 'irt' | 'inss' | 'sms'

export default function Settings() {
  const [tab, setTab] = useState<Tab>('empresa')
  const { hasFeature } = useSubscription()

  const tabs: { id: Tab; label: string; icon: typeof Building2; feature?: string }[] = [
    { id: 'empresa',        label: 'Empresa',           icon: Building2 },
    { id: 'bancos',         label: 'Bancos',            icon: Landmark },
    { id: 'biometricos',    label: 'Biométricos',       icon: Fingerprint,   feature: 'biometrics' },
    { id: 'processamento',  label: 'Processamento',     icon: CalendarClock },
    { id: 'escalas',        label: 'Escalas / Setor',   icon: CalendarRange, feature: 'schedules' },
    { id: 'ferias',         label: 'Férias',            icon: Palmtree,      feature: 'vacations' },
    { id: 'irt',            label: 'IRT',               icon: Percent },
    { id: 'inss',           label: 'Segurança Social',  icon: ShieldCheck },
    { id: 'sms',            label: 'SMS / Telco',       icon: MessageSquare, feature: 'sms' },
  ]

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary">Configurações</h1>
        <p className="text-sm text-slate-500">Empresa, tabela de IRT e taxas de Segurança Social</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 flex-wrap">
        {tabs.filter(t => !t.feature || hasFeature(t.feature)).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              tab === t.id ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon size={16} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'empresa' && <Company embedded />}
      {tab === 'bancos' && <Banks embedded />}
      {tab === 'biometricos' && <Biometric embedded />}
      {tab === 'processamento' && <ProcessamentoTab />}
      {tab === 'escalas' && <EscalasTab />}
      {tab === 'ferias' && <FeriasTab />}
      {tab === 'irt' && <IrtTab />}
      {tab === 'inss' && <InssTab />}
      {tab === 'sms'  && <SmsTab />}
    </div>
  )
}

function useSettings() {
  const [settings, setSettings] = useState<SettingsType | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.get<SettingsType>('/settings').then((r) => setSettings(r.data)).finally(() => setLoading(false))
  }, [])
  return { settings, setSettings, loading }
}

function IrtTab() {
  const { settings, setSettings, loading } = useSettings()
  const [saving, setSaving] = useState(false)

  if (loading || !settings) return <Spinner />

  const brackets = settings.irt_brackets
  const update = (i: number, patch: Partial<IrtBracket>) =>
    setSettings({ ...settings, irt_brackets: brackets.map((b, idx) => (idx === i ? { ...b, ...patch } : b)) })
  const addRow = () => setSettings({ ...settings, irt_brackets: [...brackets, { limit: 0, rate: 0 }] })
  const removeRow = (i: number) => setSettings({ ...settings, irt_brackets: brackets.filter((_, idx) => idx !== i) })

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await api.put<SettingsType>('/settings', {
        irt_brackets: brackets.map((b) => ({ limit: Number(b.limit), rate: Number(b.rate) })),
        irt_exempt_allowances: settings.irt_exempt_allowances,
      })
      setSettings(data)
      toast.success('Tabela de IRT guardada — aplica-se ao próximo recálculo')
    } catch {
      toast.error('Erro ao guardar (taxa entre 0 e 1, ex.: 0.10 = 10%)')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-primary">Tabela de IRT</h2>
          <p className="text-xs text-slate-500">Escalões progressivos. A taxa aplica-se ao excedente do limite inferior.</p>
        </div>
        <button className="btn-ghost" onClick={addRow}><Plus size={16} /> Escalão</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-3 py-2">A partir de (AOA)</th>
              <th className="px-3 py-2">Taxa (%)</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {brackets.map((b, i) => (
              <tr key={i}>
                <td className="px-2 py-1">
                  <input type="number" step="1" className="input" value={b.limit}
                    onChange={(e) => update(i, { limit: Number(e.target.value) })} />
                </td>
                <td className="px-2 py-1 w-40">
                  <input type="number" step="0.01" className="input" value={b.rate}
                    onChange={(e) => update(i, { rate: Number(e.target.value) })} />
                  <span className="ml-1 text-xs text-slate-400">{(Number(b.rate) * 100).toFixed(0)}%</span>
                </td>
                <td className="px-2 py-1 text-center">
                  <button onClick={() => removeRow(i)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
        <input type="checkbox" checked={settings.irt_exempt_allowances}
          onChange={(e) => setSettings({ ...settings, irt_exempt_allowances: e.target.checked })}
          className="h-4 w-4 rounded border-slate-300 text-primary" />
        Subsídios de alimentação e transporte isentos de IRT
      </label>

      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
        ⚠️ Indique a taxa em fração (0.10 = 10%). Valide a tabela contra a AGT antes de produção.
      </p>

      <div className="mt-4 flex justify-end">
        <button className="btn-primary" onClick={save} disabled={saving}><Save size={16} /> Guardar tabela</button>
      </div>
    </Card>
  )
}

function InssTab() {
  const { settings, setSettings, loading } = useSettings()
  const [saving, setSaving] = useState(false)

  if (loading || !settings) return <Spinner />

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await api.put<SettingsType>('/settings', {
        inss_employee_rate: Number(settings.inss_employee_rate),
        inss_company_rate: Number(settings.inss_company_rate),
      })
      setSettings(data)
      toast.success('Taxas de Segurança Social guardadas')
    } catch {
      toast.error('Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  const example = 100000
  const empRate = Number(settings.inss_employee_rate) / 100

  return (
    <Card className="max-w-2xl p-5">
      <h2 className="mb-1 font-heading font-bold text-primary">Segurança Social (INSS)</h2>
      <p className="mb-4 text-xs text-slate-500">A taxa do funcionário é descontada no recibo; a da empresa é a contribuição patronal.</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Taxa do funcionário (%)</label>
          <input type="number" step="0.5" className="input" value={settings.inss_employee_rate}
            onChange={(e) => setSettings({ ...settings, inss_employee_rate: Number(e.target.value) })} />
        </div>
        <div>
          <label className="label">Taxa da empresa (%)</label>
          <input type="number" step="0.5" className="input" value={settings.inss_company_rate}
            onChange={(e) => setSettings({ ...settings, inss_company_rate: Number(e.target.value) })} />
        </div>
      </div>

      <div className="mt-4 rounded-lg bg-primary/5 px-4 py-3 text-sm text-slate-600">
        Exemplo: sobre um salário base de {money(example)}, o desconto do funcionário seria{' '}
        <strong className="text-primary">{money(example * empRate)}</strong>.
      </div>

      <div className="mt-4 flex justify-end">
        <button className="btn-primary" onClick={save} disabled={saving}><Save size={16} /> Guardar</button>
      </div>
    </Card>
  )
}

function ProcessamentoTab() {
  const { settings, setSettings, loading } = useSettings()
  const [saving, setSaving] = useState(false)

  if (loading || !settings) return <Spinner />

  const dailyRate = settings.standard_working_days > 0
    ? 100000 / settings.standard_working_days
    : 0
  const hourlyRate = dailyRate / (settings.standard_daily_hours || 8)
  const otRate = hourlyRate * settings.overtime_multiplier

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await api.put<SettingsType>('/settings', {
        payroll_use_attendance: settings.payroll_use_attendance,
        standard_working_days: Number(settings.standard_working_days),
        standard_daily_hours: Number(settings.standard_daily_hours),
        overtime_multiplier: Number(settings.overtime_multiplier),
      })
      setSettings(data)
      toast.success('Configurações de processamento guardadas')
    } catch {
      toast.error('Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Card className="p-5">
        <h2 className="mb-1 font-heading font-bold text-primary">Integração com Assiduidade</h2>
        <p className="mb-4 text-xs text-slate-500">
          Quando ativa, o cálculo do salário usa automaticamente os registos de assiduidade do mês:
          faltas injustificadas são descontadas e horas extra são pagas.
        </p>

        <label className="flex cursor-pointer items-center gap-3">
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={settings.payroll_use_attendance}
              onChange={(e) => setSettings({ ...settings, payroll_use_attendance: e.target.checked })}
            />
            <div className={`h-6 w-11 rounded-full transition ${settings.payroll_use_attendance ? 'bg-primary' : 'bg-slate-300'}`} />
            <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${settings.payroll_use_attendance ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
          <span className="font-medium text-slate-700">
            {settings.payroll_use_attendance ? 'Ativa — assiduidade afeta os recibos' : 'Inativa — recibos calculados sem assiduidade'}
          </span>
        </label>

        {settings.payroll_use_attendance && (
          <div className="mt-4 rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs text-slate-600 space-y-1">
            <div>• Faltas injustificadas (<strong>absent</strong>) → desconto à taxa diária</div>
            <div>• Atrasos não são descontados mas ficam registados</div>
            <div>• Horas acima do padrão diário → pagas ao multiplicador de horas extra</div>
            <div>• Overrides manuais no recibo têm sempre prioridade sobre o cálculo automático</div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="mb-4 font-heading font-bold text-primary">Parâmetros de cálculo</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Dias úteis padrão / mês</label>
            <input type="number" className="input" min={1} max={31}
              value={settings.standard_working_days}
              onChange={(e) => setSettings({ ...settings, standard_working_days: Number(e.target.value) })} />
            <p className="mt-1 text-xs text-slate-400">Base para a taxa diária de desconto</p>
          </div>
          <div>
            <label className="label">Horas padrão / dia</label>
            <input type="number" className="input" min={1} max={24}
              value={settings.standard_daily_hours}
              onChange={(e) => setSettings({ ...settings, standard_daily_hours: Number(e.target.value) })} />
            <p className="mt-1 text-xs text-slate-400">Acima disto conta como horas extra</p>
          </div>
          <div>
            <label className="label">Multiplicador horas extra</label>
            <input type="number" className="input" step="0.25" min={1} max={5}
              value={settings.overtime_multiplier}
              onChange={(e) => setSettings({ ...settings, overtime_multiplier: Number(e.target.value) })} />
            <p className="mt-1 text-xs text-slate-400">Ex.: 1.5 = 150% da taxa horária</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-center text-xs text-slate-500">
          <div>
            <div className="font-semibold text-slate-700">{money(dailyRate)}</div>
            <div>taxa diária (p/ 100.000 AOA base)</div>
          </div>
          <div>
            <div className="font-semibold text-slate-700">{money(hourlyRate)}</div>
            <div>taxa horária normal</div>
          </div>
          <div>
            <div className="font-semibold text-primary">{money(otRate)}</div>
            <div>taxa hora extra (×{settings.overtime_multiplier})</div>
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={save} disabled={saving}><Save size={16} /> Guardar</button>
      </div>
    </div>
  )
}

function EscalasTab() {
  const { settings, setSettings, loading } = useSettings()
  const [saving, setSaving] = useState(false)

  if (loading || !settings) return <Spinner />

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await api.put<SettingsType>('/settings', {
        shift_rest_after_night_hours: Number(settings.shift_rest_after_night_hours),
        shift_max_consecutive_days: Number(settings.shift_max_consecutive_days),
        shift_weekly_hours_limit: Number(settings.shift_weekly_hours_limit),
      })
      setSettings(data)
      toast.success('Regras de escalas guardadas')
    } catch {
      toast.error('Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="max-w-2xl p-5">
      <h2 className="mb-1 font-heading font-bold text-primary">Regras do Setor</h2>
      <p className="mb-4 text-xs text-slate-500">
        Parâmetros de conformidade aplicados automaticamente à validação das escalas.
        Adequados para setores regulamentados como Saúde, Segurança, Bombeiros, etc.
      </p>

      <div className="space-y-5">
        <div>
          <label className="label">Descanso obrigatório após turno noturno (horas)</label>
          <input type="number" className="input max-w-xs" min={0} max={24}
            value={settings.shift_rest_after_night_hours}
            onChange={(e) => setSettings({ ...settings, shift_rest_after_night_hours: Number(e.target.value) })} />
          <p className="mt-1 text-xs text-slate-400">
            Se 0, a regra está desativada. Recomendação OIT/Saúde: mínimo 11h.
          </p>
        </div>

        <div>
          <label className="label">Máximo de dias consecutivos trabalhados</label>
          <input type="number" className="input max-w-xs" min={1} max={31}
            value={settings.shift_max_consecutive_days}
            onChange={(e) => setSettings({ ...settings, shift_max_consecutive_days: Number(e.target.value) })} />
          <p className="mt-1 text-xs text-slate-400">
            Alerta gerado no Resumo da escala quando excedido. Legislação angolana: 6 dias.
          </p>
        </div>

        <div>
          <label className="label">Limite semanal de horas (alerta)</label>
          <input type="number" className="input max-w-xs" min={1} max={168}
            value={settings.shift_weekly_hours_limit}
            onChange={(e) => setSettings({ ...settings, shift_weekly_hours_limit: Number(e.target.value) })} />
          <p className="mt-1 text-xs text-slate-400">
            Horas semanais acima deste valor aparecem destacadas no Resumo (padrão: 40h).
          </p>
        </div>

        <div className="rounded-lg bg-primary/5 p-3 text-xs text-slate-600">
          <strong>Setor Saúde — turnos pré-configurados:</strong> Manhã (M) 07h–15h,
          Tarde (T) 15h–23h, Noite (N) 23h–07h +1, 24h, Piquete (PQ).
          Gerir os turnos na aba <em>Escalas</em> → <em>Gerir Turnos</em>.
        </div>
      </div>

      <div className="mt-5 flex justify-end">
        <button className="btn-primary" onClick={save} disabled={saving}><Save size={16} /> Guardar</button>
      </div>
    </Card>
  )
}

function FeriasTab() {
  const { settings, setSettings, loading } = useSettings()
  const [saving, setSaving] = useState(false)
  const [newHoliday, setNewHoliday] = useState('')

  if (loading || !settings) return <Spinner />

  const holidays: string[] = (settings.vacation_holidays as string[]) ?? []

  const addHoliday = () => {
    if (!newHoliday || holidays.includes(newHoliday)) return
    setSettings({ ...settings, vacation_holidays: [...holidays, newHoliday].sort() })
    setNewHoliday('')
  }

  const removeHoliday = (h: string) =>
    setSettings({ ...settings, vacation_holidays: holidays.filter((x: string) => x !== h) })

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await api.put<SettingsType>('/settings', {
        vacation_days_per_year: Number(settings.vacation_days_per_year),
        vacation_carry_over_max: Number(settings.vacation_carry_over_max),
        vacation_holidays: holidays,
      })
      setSettings(data)
      toast.success('Configurações de férias guardadas')
    } catch {
      toast.error('Erro ao guardar')
    } finally { setSaving(false) }
  }

  return (
    <div className="max-w-2xl space-y-5">
      <Card className="p-5">
        <h2 className="mb-4 font-heading font-bold text-primary">Parâmetros gerais</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Dias de férias por ano</label>
            <input type="number" className="input" min={0} max={365}
              value={(settings.vacation_days_per_year as number) ?? 22}
              onChange={(e) => setSettings({ ...settings, vacation_days_per_year: Number(e.target.value) })} />
            <p className="mt-1 text-xs text-slate-400">Lei angolana: 22 dias úteis (art.º 219.º LGT)</p>
          </div>
          <div>
            <label className="label">Carry-over máximo (dias transitáveis)</label>
            <input type="number" className="input" min={0}
              value={(settings.vacation_carry_over_max as number) ?? 0}
              onChange={(e) => setSettings({ ...settings, vacation_carry_over_max: Number(e.target.value) })} />
            <p className="mt-1 text-xs text-slate-400">0 = sem transição para o ano seguinte</p>
          </div>
        </div>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 font-heading font-bold text-primary">Feriados (excluídos do cálculo)</h2>
        <p className="mb-3 text-xs text-slate-500">Estas datas não contam como dias úteis ao calcular pedidos de férias.</p>
        <div className="flex gap-2 mb-3">
          <input type="date" className="input" value={newHoliday} onChange={(e) => setNewHoliday(e.target.value)} />
          <button className="btn-outline" onClick={addHoliday}><Plus size={16} /> Adicionar</button>
        </div>
        {holidays.length === 0 ? (
          <p className="text-xs text-slate-400">Nenhum feriado configurado.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {holidays.map((h) => (
              <span key={h} className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">
                {new Date(h + 'T12:00').toLocaleDateString('pt-PT')}
                <button onClick={() => removeHoliday(h)} className="hover:text-red-600">×</button>
              </span>
            ))}
          </div>
        )}
      </Card>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={save} disabled={saving}><Save size={16} /> Guardar</button>
      </div>
    </div>
  )
}


// ─── Aba SMS / Telco ──────────────────────────────────────────
interface SmsRequest {
  id: number; status: 'pending' | 'approved' | 'rejected'
  justification: string; contact_name: string; contact_phone: string
  admin_notes: string | null; reviewed_at: string | null; created_at: string
  tenant_name?: string
}

function SmsTab() {
  const [request, setRequest] = useState<SmsRequest | null | false>(false)
  const [form, setForm] = useState({ justification: '', contact_name: '', contact_phone: '' })
  const [submitting, setSubmitting] = useState(false)
  const [testTo, setTestTo] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [testing, setTesting] = useState(false)
  const [smsLogs, setSmsLogs] = useState<{id:number;to:string;event:string;status:string;created_at:string}[]>([])

  useEffect(() => {
    api.get<SmsRequest>('/sms/request')
      .then(r => setRequest(r.data ?? null))
      .catch(() => setRequest(null))
    api.get('/sms/logs').then(r => setSmsLogs(r.data.data ?? [])).catch(() => {})
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true)
    try {
      await api.post('/sms/request', form)
      toast.success('Pedido submetido com sucesso')
      const r = await api.get<SmsRequest>('/sms/request')
      setRequest(r.data)
    } catch { toast.error('Erro ao submeter') } finally { setSubmitting(false) }
  }

  const sendTest = async (e: React.FormEvent) => {
    e.preventDefault(); setTesting(true)
    try {
      const { data } = await api.post('/sms/platform-send', { to: testTo, message: testMsg || undefined })
      toast[data.success ? 'success' : 'error'](data.success ? 'SMS enviado!' : 'Falha no envio')
      api.get('/sms/logs').then(r => setSmsLogs(r.data.data ?? []))
    } catch { toast.error('Erro') } finally { setTesting(false) }
  }

  if (request === false) return <Spinner />

  const STATUS_STYLE: Record<string, string> = {
    pending:  'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
  }
  const STATUS_LABEL: Record<string, string> = {
    pending: 'Pendente — a aguardar aprovação',
    approved: 'Aprovado — pode enviar SMS via plataforma',
    rejected: 'Rejeitado',
  }

  return (
    <div className="space-y-6">
      {/* Estado actual */}
      {request ? (
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-semibold text-slate-800">Pedido de acesso SMS</h3>
              <p className="mt-1 text-sm text-slate-500">Submetido em {new Date(request.created_at.replace(' ', 'T')).toLocaleDateString('pt-PT')}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLE[request.status]}`}>
              {STATUS_LABEL[request.status]}
            </span>
          </div>
          {request.admin_notes && (
            <div className="mt-3 rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-sm text-slate-600">
              <p className="font-medium text-slate-700 mb-1">Nota do administrador:</p>
              {request.admin_notes}
            </div>
          )}
          {request.status === 'rejected' && (
            <button className="mt-3 text-sm text-primary hover:underline" onClick={() => setRequest(null)}>
              Submeter novo pedido
            </button>
          )}
        </Card>
      ) : (
        /* Formulário de pedido */
        <Card className="p-5">
          <h3 className="font-semibold text-slate-800">Solicitar acesso a SMS</h3>
          <p className="mt-1 text-sm text-slate-500 mb-4">
            O envio de SMS é feito através da infraestrutura da plataforma TelcoSMS. Preencha o formulário e o administrador irá analisar o seu pedido.
          </p>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Nome do responsável</label>
                <input className="input" value={form.contact_name} onChange={e => setForm({...form, contact_name: e.target.value})} required />
              </div>
              <div>
                <label className="label">Telefone de contacto</label>
                <input className="input" placeholder="+244 9XX 000 000" value={form.contact_phone} onChange={e => setForm({...form, contact_phone: e.target.value})} required />
              </div>
            </div>
            <div>
              <label className="label">Justificação do uso (mín. 10 caracteres)</label>
              <textarea className="input" rows={3} minLength={10} value={form.justification} onChange={e => setForm({...form, justification: e.target.value})} placeholder="Ex: Precisamos de notificar funcionários sobre recibos emitidos..." required />
            </div>
            <button type="submit" className="btn-primary" disabled={submitting}>
              <MessageSquare size={16} /> {submitting ? 'A submeter...' : 'Submeter pedido'}
            </button>
          </form>
        </Card>
      )}

      {/* Envio de SMS (só se aprovado) */}
      {request && request.status === 'approved' && (
        <Card className="p-5 space-y-4">
          <h3 className="font-semibold text-slate-800">Enviar SMS</h3>
          <form onSubmit={sendTest} className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Número de destino</label>
              <input className="input" placeholder="+244923000000" value={testTo} onChange={e => setTestTo(e.target.value)} required />
            </div>
            <div>
              <label className="label">Mensagem</label>
              <div className="flex gap-2">
                <input className="input flex-1" maxLength={160} value={testMsg} onChange={e => setTestMsg(e.target.value)} placeholder="Mensagem…" />
                <button type="submit" className="btn-primary" disabled={testing}>
                  <MessageSquare size={15} /> {testing ? '...' : 'Enviar'}
                </button>
              </div>
            </div>
          </form>

          {smsLogs.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Últimos envios</p>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {smsLogs.slice(0,5).map(l => (
                  <div key={l.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="font-mono text-slate-600">{l.to}</span>
                    <span className="text-slate-400">{l.event}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${l.status==='sent'?'bg-green-100 text-green-700':'bg-red-100 text-red-600'}`}>{l.status}</span>
                    <span className="text-xs text-slate-400">{new Date(l.created_at.replace(' ', 'T')).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
