import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { api, setTenant } from '../lib/api'
import { useAuth } from '../stores/auth'
import logo from '../assets/rhadmin-logo.svg'

interface Plan {
  id: number; slug: string; name: string; price_aoa: number; features: string[]
}

export default function Register() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { fetchMe } = useAuth()
  const [plans, setPlans] = useState<Plan[]>([])
  const [selectedPlan, setSelectedPlan] = useState(params.get('plano') ?? 'profissional')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    company_name: '', name: '', email: '', password: '', password_confirmation: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    api.get<Plan[]>('/plans').then((r) => setPlans(r.data)).catch(() => {})
  }, [])

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setLoading(true)
    try {
      const { data } = await api.post('/register', { ...form, plan_slug: selectedPlan })
      // Guardar tenant slug e token
      setTenant(data.tenant.slug)
      localStorage.setItem('mp_token', data.token)
      await fetchMe()
      toast.success(`Bem-vindo! O seu código de organização é: ${data.tenant.slug}`, { duration: 8000 })
      navigate('/app')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } }
      const apiErrors = e?.response?.data?.errors
      if (apiErrors) {
        setErrors(Object.fromEntries(Object.entries(apiErrors).map(([k, v]) => [k, v[0]])))
      } else {
        toast.error(e?.response?.data?.message ?? 'Erro ao criar conta')
      }
    } finally {
      setLoading(false)
    }
  }

  const fmtPrice = (n: number) => n === 0 ? 'Grátis' : `${n.toLocaleString('pt-PT')} AOA/mês`

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary to-primary-600 flex items-start justify-center p-4 py-12">
      <div className="w-full max-w-4xl">

        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <img src={logo} alt="RHadmin" className="w-44 brightness-0 invert" />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">

          {/* Formulário */}
          <div className="lg:col-span-3 rounded-2xl bg-white p-8 shadow-2xl">
            <h1 className="font-heading text-2xl font-bold text-slate-900">Criar conta</h1>
            <p className="mt-1 text-sm text-slate-500">7 dias de trial sem cartão de crédito.</p>

            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="label">Nome da empresa</label>
                <input className={`input ${errors.company_name ? 'border-red-400' : ''}`}
                  placeholder="Ex: Tecnologias Luanda Lda"
                  value={form.company_name} onChange={set('company_name')} required />
                {errors.company_name && <p className="mt-1 text-xs text-red-600">{errors.company_name}</p>}
              </div>
              <div>
                <label className="label">O seu nome</label>
                <input className={`input ${errors.name ? 'border-red-400' : ''}`}
                  placeholder="Nome completo"
                  value={form.name} onChange={set('name')} required />
                {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name}</p>}
              </div>
              <div>
                <label className="label">Email</label>
                <input type="email" className={`input ${errors.email ? 'border-red-400' : ''}`}
                  placeholder="email@empresa.ao"
                  value={form.email} onChange={set('email')} required />
                {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Password</label>
                  <input type="password" className={`input ${errors.password ? 'border-red-400' : ''}`}
                    placeholder="Mínimo 8 caracteres"
                    value={form.password} onChange={set('password')} required minLength={8} />
                  {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password}</p>}
                </div>
                <div>
                  <label className="label">Confirmar password</label>
                  <input type="password" className="input"
                    placeholder="Repetir password"
                    value={form.password_confirmation} onChange={set('password_confirmation')} required />
                </div>
              </div>

              <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base">
                {loading ? 'A criar conta...' : 'Criar conta e começar →'}
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-slate-400">
              Já tem conta?{' '}
              <button onClick={() => navigate('/login')} className="text-primary hover:underline font-medium">
                Entrar
              </button>
            </p>
          </div>

          {/* Selector de plano */}
          <div className="lg:col-span-2 space-y-3">
            <h2 className="font-heading text-sm font-semibold text-white/80 uppercase tracking-wide">Plano</h2>
            {plans.map((plan) => {
              const active = selectedPlan === plan.slug
              return (
                <button
                  key={plan.slug}
                  type="button"
                  onClick={() => setSelectedPlan(plan.slug)}
                  className={`w-full rounded-xl border-2 p-4 text-left transition ${
                    active ? 'border-white bg-white/15 text-white' : 'border-white/20 bg-white/5 text-white/70 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-heading font-bold">{plan.name}</span>
                    <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${active ? 'border-white bg-white' : 'border-white/40'}`}>
                      {active && <div className="h-2 w-2 rounded-full bg-primary" />}
                    </div>
                  </div>
                  <p className={`mt-0.5 text-sm ${active ? 'text-white/80' : 'text-white/50'}`}>{fmtPrice(plan.price_aoa)}</p>
                  <ul className="mt-3 space-y-1">
                    {(plan.features ?? []).slice(0, 4).map((f) => (
                      <li key={f} className={`flex items-center gap-1.5 text-xs ${active ? 'text-white/80' : 'text-white/40'}`}>
                        <CheckCircle2 size={11} className={active ? 'text-white' : 'text-white/30'} /> {f}
                      </li>
                    ))}
                  </ul>
                </button>
              )
            })}
            <p className="text-xs text-white/40 pt-1">
              Todos os planos incluem 7 dias de trial.
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/40">
          <button onClick={() => navigate('/')} className="hover:text-white/70 transition">
            ← Voltar ao website
          </button>
        </p>
      </div>
    </div>
  )
}
