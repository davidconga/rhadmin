import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import axios from 'axios'
import { useAuth } from '../stores/auth'
import { ShieldCheck } from 'lucide-react'
import logo from '../assets/rhadmin-logo.svg'

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api'
const DNS_SUFFIX = 'rhadmin.ao'

function getSubdomainTenant(): string | null {
  const parts = window.location.hostname.split('.')
  const ignored = ['www', 'api', 'localhost']
  if (parts.length >= 3 && !ignored.includes(parts[0])) return parts[0]
  return null
}

export default function Login() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()

  // Em desenvolvimento (localhost), usa VITE_TENANT como tenant se não houver subdomínio
  const envTenant = import.meta.env.VITE_TENANT as string | undefined
  const subdomainTenant = getSubdomainTenant() ?? envTenant ?? null
  const isMainDomain = !subdomainTenant

  const prefillEmail = new URLSearchParams(window.location.search).get('email') ?? ''
  const [email, setEmail]       = useState(prefillEmail)
  const [password, setPassword] = useState('')
  const [searching, setSearching] = useState(false)

  const submit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (isMainDomain) {
      setSearching(true)
      try {
        const { data } = await axios.post(`${API}/find-tenant`, { email })
        const slug = data.slug as string
        window.location.href = `https://${slug}.${DNS_SUFFIX}/login?email=${encodeURIComponent(email)}`
      } catch {
        toast.error('Nenhuma conta encontrada com este email.')
      } finally {
        setSearching(false)
      }
      return
    }

    try {
      await login(email, password)
      toast.success('Sessão iniciada')
      const { setupRequired } = useAuth.getState()
      navigate(setupRequired ? '/app/empresa' : '/app')
    } catch {
      toast.error('Credenciais inválidas')
    }
  }

  return (
    <div className="flex h-full flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #052e16 0%, #085041 50%, #047857 100%)' }}>

      {/* Badge tipo */}
      <div className="mb-4 flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
        <ShieldCheck size={15} className="text-emerald-300" />
        Acesso de Gestão
      </div>

      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-8 py-6 text-center">
          <img src={logo} alt="RHadmin" className="mx-auto mb-4 w-44" />
          <h1 className="font-heading text-xl font-bold text-slate-800">Bem-vindo de volta</h1>
          <p className="mt-1 text-sm text-slate-500">
            {isMainDomain ? 'Introduza o seu email para aceder' : 'Entre na sua organização'}
          </p>
        </div>

        {subdomainTenant && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-emerald-700">{subdomainTenant}.{DNS_SUFFIX}</span>
          </div>
        )}

        <form onSubmit={submit} className="space-y-4 px-8 py-6">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} required autoFocus />
          </div>

          {!isMainDomain && (
            <div>
              <label className="label">Palavra-passe</label>
              <input className="input" type="password" value={password}
                onChange={e => setPassword(e.target.value)} required />
            </div>
          )}

          <button className="btn-primary w-full py-3 text-base" disabled={loading || searching}>
            {searching ? 'A procurar...' : loading ? 'A entrar...' : isMainDomain ? 'Continuar →' : 'Entrar na plataforma'}
          </button>
        </form>

        <div className="border-t border-slate-100 px-8 py-4 text-center">
          <p className="text-xs text-slate-400">
            É funcionário?{' '}
            <a href="/portal" className="font-medium text-blue-600 hover:underline">
              Aceder ao Portal do Funcionário →
            </a>
          </p>
        </div>
      </div>

      <button onClick={() => navigate('/')} className="mt-5 text-xs text-white/50 hover:text-white transition">
        ← Voltar ao website
      </button>
    </div>
  )
}
