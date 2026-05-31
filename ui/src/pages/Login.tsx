import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../stores/auth'
import { getTenant, setTenant } from '../lib/api'
import logo from '../assets/rhadmin-logo.svg'

export default function Login() {
  const { login, loading } = useAuth()
  const navigate = useNavigate()
  const stored = getTenant()
  const [slug, setSlug] = useState(stored === 'matombe' ? '' : stored)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const s = slug.trim().toLowerCase()
    if (!s) { toast.error('Indique o nome da organização'); return }
    setTenant(s)
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
    <div className="flex h-full flex-col items-center justify-center bg-gradient-to-br from-primary-900 via-primary to-primary-600 p-4">
      <div className="card w-full max-w-md p-8">
        <div className="mb-8 flex justify-center">
          <img src={logo} alt="RHadmin" className="w-52" />
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">Organização</label>
            <input
              className="input"
              type="text"
              placeholder="código da organização (ex: acacias)"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
              autoCapitalize="none"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-slate-400">Visível no rodapé do menu após entrar</p>
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="label">Palavra-passe</label>
            <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          <button className="btn-primary w-full py-3" disabled={loading}>
            {loading ? 'A entrar...' : 'Entrar na plataforma'}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button onClick={() => navigate('/')} className="text-xs text-primary hover:underline">
            ← Voltar ao website
          </button>
        </div>
      </div>
    </div>
  )
}
