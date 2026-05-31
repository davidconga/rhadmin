import { useState } from 'react'
import {
  User, Banknote, Landmark, Users,
  ArrowRight, ArrowLeft, Save, Plus, Trash2, CheckCircle2, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { useEmployeeOptions } from '../hooks/useEmployeeOptions'

// ── tipos ────────────────────────────────────────────────────────────────────

interface FamilyMemberDraft {
  key: number
  full_name: string
  relationship: string
  bi_nif: string
  date_of_birth: string
}

interface EmployeeDraft {
  full_name: string
  bi_nif: string
  biometric_id: string
  position: string
  department: string
  active: boolean
  base_salary: string
  food_allowance: string
  transport_allowance: string
  social_security_rate: string
  bank_name: string
  account_number: string
  iban: string
}

const EMPTY_DRAFT: EmployeeDraft = {
  full_name: '', bi_nif: '', biometric_id: '', position: '', department: '', active: true,
  base_salary: '', food_allowance: '0', transport_allowance: '0', social_security_rate: '3',
  bank_name: '', account_number: '', iban: '',
}

const RELATIONSHIPS = ['Cônjuge', 'Filho', 'Filha', 'Pai', 'Mãe', 'Irmão', 'Irmã', 'Outro']

const STEPS = [
  { label: 'Identificação', icon: User,     desc: 'Dados pessoais e cargo' },
  { label: 'Remuneração',   icon: Banknote, desc: 'Salário e subsídios' },
  { label: 'Banco',         icon: Landmark, desc: 'Dados bancários' },
  { label: 'Família',       icon: Users,    desc: 'Agregado familiar' },
]

// ── componentes auxiliares ───────────────────────────────────────────────────

function WField({ label, children, span2 }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>
      {children}
    </div>
  )
}

function WInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm placeholder-slate-400 transition focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
    />
  )
}

function WSelect(props: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
    />
  )
}

// ── wizard principal ─────────────────────────────────────────────────────────

export default function EmployeeWizard({ onDone, onCancel }: {
  onDone: () => void
  onCancel: () => void
}) {
  const [step, setStep] = useState(0)
  const empOptions = useEmployeeOptions()
  const [draft, setDraft] = useState<EmployeeDraft>(EMPTY_DRAFT)
  const [family, setFamily] = useState<FamilyMemberDraft[]>([])
  const [saving, setSaving] = useState(false)
  const [nextKey, setNextKey] = useState(0)

  const set = (k: keyof EmployeeDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft(d => ({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  // ── validação por passo ──────────────────────────────────────────────────
  const validate = () => {
    if (step === 0 && !draft.full_name.trim()) { toast.error('Nome completo é obrigatório'); return false }
    if (step === 1 && (!draft.base_salary || Number(draft.base_salary) < 0)) {
      toast.error('Salário base é obrigatório'); return false
    }
    return true
  }

  const next = () => { if (validate()) setStep(s => s + 1) }
  const back = () => setStep(s => s - 1)

  // ── agregado familiar ────────────────────────────────────────────────────
  const addMember = () => {
    setFamily(f => [...f, { key: nextKey, full_name: '', relationship: RELATIONSHIPS[0], bi_nif: '', date_of_birth: '' }])
    setNextKey(k => k + 1)
  }
  const updateMember = (key: number, field: keyof Omit<FamilyMemberDraft, 'key'>, value: string) =>
    setFamily(f => f.map(m => m.key === key ? { ...m, [field]: value } : m))
  const removeMember = (key: number) => setFamily(f => f.filter(m => m.key !== key))

  // ── submissão ────────────────────────────────────────────────────────────
  const submit = async () => {
    if (!draft.full_name.trim()) { toast.error('Nome completo é obrigatório'); setStep(0); return }
    setSaving(true)
    try {
      await api.post('/employees', {
        ...draft,
        base_salary: Number(draft.base_salary) || 0,
        food_allowance: Number(draft.food_allowance) || 0,
        transport_allowance: Number(draft.transport_allowance) || 0,
        social_security_rate: Number(draft.social_security_rate) || 3,
        family_members: family.filter(m => m.full_name.trim()).map(({ key: _, ...m }) => m),
      })
      toast.success('Funcionário criado com sucesso')
      onDone()
    } catch {
      toast.error('Erro ao criar funcionário')
    } finally {
      setSaving(false)
    }
  }

  // ── stepper ──────────────────────────────────────────────────────────────
  const Stepper = () => (
    <div className="flex items-center px-6 py-5">
      {STEPS.map((s, i) => {
        const done = i < step; const active = i === step
        const Icon = s.icon
        return (
          <div key={i} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <div onClick={() => i < step && setStep(i)} className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
                done   ? 'border-primary bg-primary text-white cursor-pointer' :
                active ? 'border-primary bg-primary/10 text-primary' :
                         'border-slate-200 bg-white text-slate-400'
              }`}>
                {done ? <CheckCircle2 size={18} /> : <Icon size={16} />}
              </div>
              <span className={`text-[11px] font-medium whitespace-nowrap ${active ? 'text-primary' : done ? 'text-primary/70' : 'text-slate-400'}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mb-4 h-0.5 flex-1 mx-1 transition-all ${i < step ? 'bg-primary' : 'bg-slate-200'}`} />
            )}
          </div>
        )
      })}
    </div>
  )

  // ── conteúdo por passo ───────────────────────────────────────────────────
  const StepContent = () => {
    if (step === 0) return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WField label="Nome completo *" span2>
          <WInput value={draft.full_name} onChange={set('full_name')} placeholder="Ex: Maria da Silva" autoFocus />
        </WField>
        <WField label="BI / NIF">
          <WInput value={draft.bi_nif} onChange={set('bi_nif')} placeholder="000000000LA000" />
        </WField>
        <WField label="ID Biométrico">
          <WInput value={draft.biometric_id} onChange={set('biometric_id')} placeholder="Nº no terminal de ponto" />
        </WField>
        <WField label="Função / Cargo">
          <WInput value={draft.position} onChange={set('position')} placeholder="Ex: Enfermeiro Chefe" list="wiz-positions" />
          <datalist id="wiz-positions">{empOptions.positions.map(p => <option key={p} value={p} />)}</datalist>
        </WField>
        <WField label="Departamento">
          <WInput value={draft.department} onChange={set('department')} placeholder="Ex: Urgências" list="wiz-departments" />
          <datalist id="wiz-departments">{empOptions.departments.map(d => <option key={d} value={d} />)}</datalist>
        </WField>
        <WField label="Estado">
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-4 py-2.5">
            <input type="checkbox" checked={draft.active} onChange={set('active')} className="h-4 w-4 rounded border-slate-300 text-primary" />
            <span className="text-sm text-slate-700">Activo</span>
          </label>
        </WField>
      </div>
    )

    if (step === 1) return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WField label="Salário base (AOA) *" span2>
          <WInput type="number" min="0" step="0.01" value={draft.base_salary} onChange={set('base_salary')} placeholder="0.00" />
        </WField>
        <WField label="Subsídio de alimentação (AOA)">
          <WInput type="number" min="0" step="0.01" value={draft.food_allowance} onChange={set('food_allowance')} placeholder="0.00" />
        </WField>
        <WField label="Subsídio de transporte (AOA)">
          <WInput type="number" min="0" step="0.01" value={draft.transport_allowance} onChange={set('transport_allowance')} placeholder="0.00" />
        </WField>
        <WField label="Taxa Seg. Social (%)">
          <WInput type="number" min="0" max="100" step="0.01" value={draft.social_security_rate} onChange={set('social_security_rate')} placeholder="3" />
        </WField>
        <div className="sm:col-span-2 rounded-xl bg-primary/5 border border-primary/10 px-4 py-3">
          <p className="text-xs text-primary font-medium">Custo mensal estimado</p>
          <p className="mt-0.5 text-lg font-bold text-primary">
            {(Number(draft.base_salary)||0) + (Number(draft.food_allowance)||0) + (Number(draft.transport_allowance)||0) > 0
              ? ((Number(draft.base_salary)||0) + (Number(draft.food_allowance)||0) + (Number(draft.transport_allowance)||0)).toLocaleString('pt-PT') + ' AOA'
              : '—'}
          </p>
        </div>
      </div>
    )

    if (step === 2) return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <WField label="Banco" span2>
          <WInput value={draft.bank_name} onChange={set('bank_name')} placeholder="Ex: Banco BAI" />
        </WField>
        <WField label="Nº de conta">
          <WInput value={draft.account_number} onChange={set('account_number')} placeholder="000123456789" />
        </WField>
        <WField label="IBAN">
          <WInput value={draft.iban} onChange={set('iban')} placeholder="AO06 0040 0000 …" />
        </WField>
        <p className="sm:col-span-2 text-xs text-slate-400">Dados bancários são opcionais mas necessários para ordens de pagamento.</p>
      </div>
    )

    if (step === 3) return (
      <div className="space-y-3">
        {family.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 py-8 text-center">
            <Users size={28} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-500">Nenhum membro adicionado</p>
            <p className="mt-0.5 text-xs text-slate-400">Opcional — pode adicionar mais tarde</p>
          </div>
        )}
        {family.map((m) => (
          <div key={m.key} className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-4">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">Nome *</label>
              <WInput value={m.full_name} onChange={e => updateMember(m.key, 'full_name', e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Parentesco *</label>
              <WSelect value={m.relationship} onChange={e => updateMember(m.key, 'relationship', e.target.value)}>
                {RELATIONSHIPS.map(r => <option key={r}>{r}</option>)}
              </WSelect>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-slate-600">Data nasc.</label>
                <WInput type="date" value={m.date_of_birth} onChange={e => updateMember(m.key, 'date_of_birth', e.target.value)} />
              </div>
              <button type="button" onClick={() => removeMember(m.key)}
                className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-red-200 text-red-400 hover:bg-red-50 transition">
                <Trash2 size={15} />
              </button>
            </div>
            <div className="sm:col-span-4">
              <label className="mb-1 block text-xs font-medium text-slate-600">BI / NIF</label>
              <WInput value={m.bi_nif} onChange={e => updateMember(m.key, 'bi_nif', e.target.value)} placeholder="Opcional" />
            </div>
          </div>
        ))}
        <button type="button" onClick={addMember}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 py-3 text-sm font-medium text-primary hover:bg-primary/5 transition">
          <Plus size={16} /> Adicionar membro
        </button>
      </div>
    )

    return null
  }

  // ── render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-primary">Novo funcionário</h2>
          <p className="text-xs text-slate-400">{STEPS[step].desc}</p>
        </div>
        <button onClick={onCancel} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
          <X size={18} />
        </button>
      </div>

      <Stepper />

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto px-6 pb-4">
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
            {(() => { const Icon = STEPS[step].icon; return <Icon size={15} className="text-primary" /> })()}
          </div>
          <span className="font-semibold text-slate-700">{STEPS[step].label}</span>
        </div>
        <StepContent />
      </div>

      {/* Footer navegação */}
      <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-4">
        <div>
          {step > 0 && (
            <button type="button" onClick={back}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition">
              <ArrowLeft size={14} /> Voltar
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Passo {step + 1} de {STEPS.length}</span>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={next}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition">
              Seguinte <ArrowRight size={15} />
            </button>
          ) : (
            <button type="button" onClick={submit} disabled={saving}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 transition disabled:opacity-60">
              {saving ? 'A criar…' : <><Save size={15} /> Criar funcionário</>}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
