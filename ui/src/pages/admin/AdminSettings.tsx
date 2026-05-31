import { useEffect, useRef, useState } from 'react'
import { Save, Settings, CreditCard, Bell, Clock, Hash, ImagePlus } from 'lucide-react'
import { toast } from 'sonner'
import { adminApi } from '../../lib/adminApi'
import { Spinner } from '../../components/ui'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'

interface Settings {
  platform_name?: string
  payment_nif?: string
  payment_address?: string
  payment_email?: string
  payment_iban?: string
  payment_bank?: string
  payment_beneficiary?: string
  payment_notify_phone?: string
  trial_days?: string
  sms_price_per_unit?: string
  fr_sequence?: string
}

const Section = ({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) => (
  <div className="rounded-2xl border border-slate-700 bg-slate-800 overflow-hidden">
    <div className="flex items-center gap-2 border-b border-slate-700 px-5 py-3.5">
      <span className="text-primary">{icon}</span>
      <h2 className="font-heading font-semibold text-white text-sm">{title}</h2>
    </div>
    <div className="p-5 space-y-4">{children}</div>
  </div>
)

const Field = ({ label, name, value, onChange, type = 'text', hint }: {
  label: string; name: string; value: string; onChange: (k: string, v: string) => void
  type?: string; hint?: string
}) => (
  <div>
    <label className="mb-1 block text-xs text-slate-400">{label}</label>
    <input
      type={type}
      className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
      value={value}
      onChange={e => onChange(name, e.target.value)}
    />
    {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
  </div>
)

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    try {
      const { data } = await adminApi.get<Settings>('/settings')
      setSettings(data)
      // testa se o logo existe
      const res = await fetch(`${API}/platform/logo`)
      if (res.ok) setLogoUrl(`${API}/platform/logo?t=${Date.now()}`)
    } catch { toast.error('Erro ao carregar configurações') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.append('logo', file)
      await adminApi.post('/settings/logo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      setLogoUrl(`${API}/platform/logo?t=${Date.now()}`)
      toast.success('Logótipo actualizado.')
    } catch { toast.error('Erro ao fazer upload do logótipo') }
    finally { setUploadingLogo(false) }
  }

  const set = (key: string, value: string) => setSettings(s => ({ ...s, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      await adminApi.put('/settings', settings)
      toast.success('Configurações guardadas com sucesso.')
    } catch { toast.error('Erro ao guardar configurações') }
    finally { setSaving(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-24"><Spinner /></div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-white">Configurações da Plataforma</h1>
          <p className="text-sm text-slate-400">Dados globais do sistema RHadmin</p>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-60 transition">
          {saving ? <Spinner /> : <><Save size={15} /> Guardar</>}
        </button>
      </div>

      <Section icon={<ImagePlus size={16} />} title="Logótipo da Plataforma">
        <div className="flex items-center gap-6">
          <div className="flex h-20 w-40 items-center justify-center rounded-xl border border-slate-600 bg-slate-700/50 overflow-hidden">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="max-h-16 max-w-36 object-contain" />
            ) : (
              <span className="text-xs text-slate-500">Sem logótipo</span>
            )}
          </div>
          <div className="space-y-2">
            <p className="text-xs text-slate-400">Formatos aceites: PNG, JPG, SVG, WebP · Máx. 2 MB</p>
            <p className="text-xs text-slate-500">Usado na Factura-Recibo e documentos da plataforma.</p>
            <button onClick={() => logoRef.current?.click()} disabled={uploadingLogo}
              className="flex items-center gap-2 rounded-lg border border-primary/60 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/10 disabled:opacity-60 transition">
              {uploadingLogo ? <Spinner /> : <><ImagePlus size={14} /> {logoUrl ? 'Substituir logótipo' : 'Carregar logótipo'}</>}
            </button>
            <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={uploadLogo} />
          </div>
        </div>
      </Section>

      <Section icon={<Settings size={16} />} title="Identidade da Plataforma">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da plataforma" name="platform_name"
            value={settings.platform_name ?? ''} onChange={set}
            hint="Aparece na FR e documentos gerados." />
          <Field label="NIF" name="payment_nif"
            value={settings.payment_nif ?? ''} onChange={set} />
          <Field label="Endereço" name="payment_address"
            value={settings.payment_address ?? ''} onChange={set} />
          <Field label="Email" name="payment_email" type="email"
            value={settings.payment_email ?? ''} onChange={set} />
        </div>
      </Section>

      <Section icon={<CreditCard size={16} />} title="Dados de Pagamento (Transferência Bancária)">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Beneficiário" name="payment_beneficiary"
            value={settings.payment_beneficiary ?? ''} onChange={set} />
          <Field label="Banco" name="payment_bank"
            value={settings.payment_bank ?? ''} onChange={set} />
          <div className="sm:col-span-2">
            <Field label="IBAN" name="payment_iban"
              value={settings.payment_iban ?? ''} onChange={set}
              hint="Enviado aos tenants nas instruções de pagamento de subscrição." />
          </div>
        </div>
      </Section>

      <Section icon={<Bell size={16} />} title="Notificações">
        <Field label="Telefone de notificação (SMS)" name="payment_notify_phone"
          value={settings.payment_notify_phone ?? ''} onChange={set}
          hint="Recebe SMS quando um novo tenant se regista ou um pagamento é submetido." />
      </Section>

      <Section icon={<Clock size={16} />} title="Trial">
        <Field label="Duração do trial (dias)" name="trial_days" type="number"
          value={settings.trial_days ?? '7'} onChange={set}
          hint="Aplicado a todos os novos registos." />
      </Section>

      <Section icon={<Hash size={16} />} title="Numeração">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sequência actual da FR" name="fr_sequence" type="number"
            value={settings.fr_sequence ?? '0'} onChange={set}
            hint="A próxima FR gerada usará este número + 1." />
          <Field label="Preço por SMS (AOA)" name="sms_price_per_unit" type="number"
            value={settings.sms_price_per_unit ?? '5'} onChange={set}
            hint="Cobrado aos tenants por SMS enviado." />
        </div>
      </Section>
    </div>
  )
}
