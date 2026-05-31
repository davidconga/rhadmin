import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { useAdminAuth } from '../../stores/adminAuth'

export default function AdminLogin() {
  const { login } = useAdminAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('superadmin@rhadmin.ao')
  const [password, setPassword] = useState('superadmin123')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      navigate('/admin')
    } catch {
      toast.error('Credenciais inválidas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white">
            <ShieldCheck size={28} />
          </div>
          <div className="text-center">
            <h1 className="font-heading text-2xl font-bold text-white">RHadmin</h1>
            <p className="text-sm text-slate-400">Painel de Super Admin</p>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-800 p-8">
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Email</label>
              <input
                type="email" className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                value={email} onChange={e => setEmail(e.target.value)} required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-400">Password</label>
              <input
                type="password" className="w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                value={password} onChange={e => setPassword(e.target.value)} required
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary/90 disabled:opacity-60">
              {loading ? 'A autenticar...' : 'Entrar no painel'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
