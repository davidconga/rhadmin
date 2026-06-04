import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Users, ReceiptText, CalendarCheck, ArrowLeftRight, ShieldCheck,
  Building2, CheckCircle2, Layers, BarChart3,
} from 'lucide-react'
import { api } from '../lib/api'
import heroBg from '../assets/hero.png'

interface Plan {
  id: number
  slug: string
  name: string
  description: string
  price_aoa: number
  max_companies: number
  max_employees: number
  max_users: number
  features: string[]
}

const fmt = (n: number) =>
  n >= 999 ? 'Ilimitado' : n.toLocaleString('pt-PT')

const FEATURES = [
  { icon: Users,          title: 'Gestão de Funcionários',    desc: 'Fichas completas com foto, dados bancários e histórico salarial.' },
  { icon: ReceiptText,    title: 'Recibos de Salário',        desc: 'Geração automática com cálculo de IRT, INSS e subsídios.' },
  { icon: CalendarCheck,  title: 'Assiduidade & Escalas',     desc: 'Controlo de presenças, turnos e integração com biométricos.' },
  { icon: ArrowLeftRight, title: 'Ordens de Pagamento',       desc: 'Ficheiros bancários para transferências em massa.' },
  { icon: Building2,      title: 'Multi-Empresa',             desc: 'Uma única conta para gerir todas as empresas clientes.' },
  { icon: ShieldCheck,    title: 'Controlo de Acessos',       desc: 'Papéis por utilizador: administrador, gestor ou visualizador.' },
  { icon: Layers,         title: 'Departamentos',             desc: 'Estrutura organizacional com afectação de funcionários.' },
  { icon: BarChart3,      title: 'Dashboard Analytics',       desc: 'Gráficos de massa salarial, assiduidade e evolução mensal.' },
]


const PLAN_HIGHLIGHT = ['profissional']

export default function Landing() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState<Plan[]>([])

  useEffect(() => {
    api.get<Plan[]>('/plans').then((r) => setPlans(r.data)).catch(() => {})
  }, [])

  return (
    <div className="min-h-screen bg-white text-slate-800">

      {/* Nav */}
      <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-[#0d1b2a]/80 backdrop-blur">
          <div className="flex items-center justify-between px-8 py-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white font-bold text-lg">R</div>
            <span className="font-heading text-lg font-bold text-white">RH<span className="text-primary">admin</span></span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-white/60 sm:flex">
            <a href="#funcionalidades" className="hover:text-white transition">Funcionalidades</a>
            <a href="#precos" className="hover:text-white transition">Preços</a>
            <a href="#sobre" className="hover:text-white transition">Sobre nós</a>
          </nav>
          {/* Selectores de país */}
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs text-white/80 hover:bg-white/15 transition">
              🇦🇴 Angola
            </button>
            <button onClick={() => navigate('/login')} className="ml-2 text-sm text-white/60 hover:text-white transition">Entrar</button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#0d1b2a]">
        {/* Imagem de fundo */}
        <div className="absolute inset-0">
          <img src={heroBg} alt="" className="h-full w-full object-cover object-center opacity-10" />
        </div>
        {/* Brilho radial */}
        <div className="absolute -left-32 top-0 h-[600px] w-[600px] rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute right-0 top-1/2 h-[400px] w-[400px] -translate-y-1/2 rounded-full bg-cyan-500/10 blur-3xl" />

        <div className="relative flex flex-col lg:flex-row">
          {/* Coluna esquerda */}
          <div className="flex flex-1 flex-col justify-center px-8 pb-12 pt-28 sm:px-16 lg:pt-24 lg:pb-16">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-primary">
              Gestão de RH simples e poderosa
            </p>
            <h1 className="font-heading text-5xl font-extrabold leading-tight text-white sm:text-6xl">
              Processar salários.<br />
              Controlar assiduidade.<br />
              <span className="text-primary">Sem complicações.</span>
            </h1>
            <p className="mt-6 max-w-md text-base text-white/60 leading-relaxed">
              Em conformidade com a legislação angolana e moçambicana. Uma plataforma, N empresas.
            </p>

            {/* Pills */}
            <div className="mt-8 flex flex-wrap gap-2">
              {['Folha de Salários', 'Recibos legais', 'Multi-empresa', 'Relatórios'].map((f) => (
                <span key={f} className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm text-primary">
                  <CheckCircle2 size={13} /> {f}
                </span>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-8 flex items-center gap-4">
              <button onClick={() => navigate('/registar')} className="rounded-2xl bg-primary px-8 py-3.5 text-base font-bold text-white shadow-lg shadow-primary/30 hover:bg-primary/90 transition">
                Comece grátis →
              </button>
              <span className="text-sm text-white/40">Sem cartão de crédito</span>
            </div>

            {/* Strip de confiança */}
            <div className="mt-12 flex flex-wrap gap-6">
              {[['🔒','Dados seguros'],['⚡','Configuração em minutos'],['🏢','Multi-empresa'],['📱','Acesso mobile']].map(([icon, label]) => (
                <div key={label} className="flex items-center gap-1.5 text-xs text-white/40">
                  <span>{icon}</span> {label}
                </div>
              ))}
            </div>
          </div>

          {/* Coluna direita — cards flutuantes */}
          <div className="relative hidden flex-1 items-center justify-center lg:flex">
            {/* Card salário */}
            <div className="absolute left-8 top-32 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm shadow-xl w-52">
              <p className="text-xs text-white/50 flex items-center gap-1">💰 Salário processado</p>
              <p className="mt-1 font-heading text-2xl font-bold text-white">245.000 Kz</p>
              <p className="mt-1 text-xs text-primary flex items-center gap-1"><CheckCircle2 size={11} /> Enviado</p>
            </div>
            {/* Card assiduidade */}
            <div className="absolute right-12 top-24 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm shadow-xl w-48">
              <p className="text-xs text-white/50">📊 Assiduidade — Nov</p>
              <div className="mt-2 flex items-end gap-1 h-10">
                {[60,80,55,90,70,85,40].map((h,i) => (
                  <div key={i} className={`flex-1 rounded-sm ${i === 5 ? 'bg-red-400' : 'bg-primary'}`} style={{height:`${h}%`}} />
                ))}
              </div>
              <p className="mt-2 text-xs text-white/60">92% presença</p>
            </div>
            {/* Card recibo */}
            <div className="absolute bottom-32 left-16 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm shadow-xl w-52">
              <p className="text-xs text-white/50">📄 Recibo gerado</p>
              <p className="mt-1 font-semibold text-white">João Mateus</p>
              <div className="mt-2 border-t border-white/10 pt-2 text-xs text-primary">↓ PDF pronto</div>
            </div>
            {/* Ilustração personagem */}
            <div className="mt-8 flex flex-col items-center justify-center">
              <div className="relative">
                <div className="h-40 w-40 rounded-full bg-primary/10" />
                <div className="absolute inset-0 flex items-center justify-center text-7xl">🧑‍💼</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Funcionalidades */}
      <section id="funcionalidades" className="bg-slate-50 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mb-12 text-center">
            <h2 className="font-heading text-3xl font-bold text-slate-900">Tudo o que precisa</h2>
            <p className="mt-2 text-slate-500">Do registo do funcionário ao recibo emitido, numa só plataforma.</p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon size={20} />
                </div>
                <h3 className="font-heading font-semibold text-slate-800">{title}</h3>
                <p className="mt-1 text-sm text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Preços */}
      <section id="precos" className="py-20">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mb-12 text-center">
            <h2 className="font-heading text-3xl font-bold text-slate-900">Planos e preços</h2>
            <p className="mt-2 text-slate-500">Escolha o plano certo para a sua operação. Mude quando quiser.</p>
          </div>
          {plans.length === 0 ? (
            <p className="text-center text-slate-400">A carregar planos…</p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-3">
              {plans.map((plan) => {
                const highlight = PLAN_HIGHLIGHT.includes(plan.slug)
                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-2xl border p-7 flex flex-col ${
                      highlight
                        ? 'border-primary bg-primary shadow-xl shadow-primary/20 text-white'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    {highlight && (
                      <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-400 px-4 py-1 text-xs font-bold text-amber-900">
                        Mais popular
                      </div>
                    )}
                    <div>
                      <h3 className={`font-heading text-xl font-bold ${highlight ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                      <p className={`mt-1 text-sm ${highlight ? 'text-white/75' : 'text-slate-500'}`}>{plan.description}</p>
                    </div>
                    <div className="my-6">
                      <span className={`font-heading text-4xl font-extrabold ${highlight ? 'text-white' : 'text-slate-900'}`}>
                        {plan.price_aoa.toLocaleString('pt-PT')}
                      </span>
                      <span className={`ml-1 text-sm ${highlight ? 'text-white/75' : 'text-slate-400'}`}>AOA/mês</span>
                    </div>
                    <div className={`mb-6 space-y-1.5 rounded-xl p-4 text-sm ${highlight ? 'bg-white/10' : 'bg-slate-50'}`}>
                      <div className={`flex justify-between ${highlight ? 'text-white/90' : 'text-slate-600'}`}>
                        <span>Empresas</span><span className="font-semibold">{fmt(plan.max_companies)}</span>
                      </div>
                      <div className={`flex justify-between ${highlight ? 'text-white/90' : 'text-slate-600'}`}>
                        <span>Funcionários</span><span className="font-semibold">{fmt(plan.max_employees)}</span>
                      </div>
                      <div className={`flex justify-between ${highlight ? 'text-white/90' : 'text-slate-600'}`}>
                        <span>Utilizadores</span><span className="font-semibold">{fmt(plan.max_users)}</span>
                      </div>
                    </div>
                    <ul className="mb-8 space-y-2 flex-1">
                      {(plan.features ?? []).map((f) => (
                        <li key={f} className={`flex items-start gap-2 text-sm ${highlight ? 'text-white/85' : 'text-slate-600'}`}>
                          <CheckCircle2 size={15} className={`mt-0.5 shrink-0 ${highlight ? 'text-white' : 'text-primary'}`} />
                          {f}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => navigate(`/registar?plano=${plan.slug}`)}
                      className={`w-full rounded-xl py-3 text-sm font-semibold transition ${
                        highlight
                          ? 'bg-white text-primary hover:bg-white/90'
                          : 'border border-primary bg-white text-primary hover:bg-primary/5'
                      }`}
                    >
                      Iniciar trial de 7 dias
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* Sobre nós */}
      <section id="sobre" className="bg-[#0d1b2a] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            {/* Texto */}
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">Sobre nós</p>
              <h2 className="font-heading text-3xl font-bold text-white leading-snug">
                Construído para o mercado africano<br />
                <span className="text-primary">de língua portuguesa</span>
              </h2>
              <p className="mt-5 text-white/60 leading-relaxed">
                A RHadmin nasceu da necessidade real de simplificar a gestão de recursos humanos em Angola.
                Desenvolvemos uma plataforma que respeita a legislação local — IRT, INSS, subsídios legais —
                e que qualquer equipa de RH consegue operar sem formação técnica.
              </p>
              <p className="mt-4 text-white/60 leading-relaxed">
                Somos uma equipa apaixonada por tecnologia e pelo potencial das empresas africanas.
                A nossa missão é eliminar o trabalho burocrático para que as equipas possam focar
                no que realmente importa: as pessoas.
              </p>
              <div className="mt-8 grid grid-cols-3 gap-4">
                {[['500+','Empresas'], ['50K+','Recibos gerados'], ['99%','Satisfação']].map(([num, label]) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
                    <p className="font-heading text-2xl font-bold text-primary">{num}</p>
                    <p className="mt-0.5 text-xs text-white/50">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Visual */}
            <div className="relative flex items-center justify-center">
              <div className="absolute h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
              <div className="relative grid grid-cols-2 gap-4">
                {[
                  { icon: '🏆', title: 'Legislação local', desc: 'IRT e INSS calculados automaticamente.' },
                  { icon: '🔒', title: 'Dados seguros', desc: 'Cada empresa num ambiente isolado.' },
                  { icon: '⚡', title: 'Rápido de configurar', desc: 'Operacional em menos de 10 minutos.' },
                  { icon: '🤝', title: 'Suporte dedicado', desc: 'Equipa disponível para ajudar.' },
                ].map(({ icon, title, desc }) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                    <span className="text-2xl">{icon}</span>
                    <p className="mt-2 font-semibold text-white text-sm">{title}</p>
                    <p className="mt-1 text-xs text-white/50">{desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="bg-primary py-16 text-center text-white">
        <div className="mx-auto max-w-2xl px-6">
          <h2 className="font-heading text-3xl font-bold">Pronto para começar?</h2>
          <p className="mt-3 text-white/75">7 dias de trial. Sem compromisso. Configure em minutos.</p>
          <button onClick={() => navigate('/registar')} className="mt-6 inline-block rounded-xl bg-white px-8 py-3.5 text-sm font-bold text-primary shadow hover:bg-white/90 transition">
            Criar conta gratuita →
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white py-8 text-center text-xs text-slate-400">
        <p>© {new Date().getFullYear()} RHadmin · Software de Recursos Humanos para África</p>
        <p className="mt-1">Angola · Moçambique · Mercados de língua portuguesa</p>
      </footer>
    </div>
  )
}
