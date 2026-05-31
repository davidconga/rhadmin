import { AlertTriangle } from 'lucide-react'
import { type ReactNode, useEffect } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`}>{children}</div>
}

export function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 font-heading text-2xl font-bold text-primary">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </Card>
  )
}

const statusStyles: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600',
  issued: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
}
const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  issued: 'Emitido',
  paid: 'Pago',
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[status] ?? 'bg-slate-100 text-slate-600'}`}>
      {statusLabels[status] ?? status}
    </span>
  )
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center p-10 text-slate-400">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className={`card w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} animate-in`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="font-heading text-lg font-bold text-primary">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function EmptyState({ message }: { message: string }) {
  return <div className="p-10 text-center text-sm text-slate-400">{message}</div>
}

export function FeatureLocked({ feature, plan }: { feature: string; plan?: string }) {
  const labels: Record<string, string> = {
    biometrics: 'Biométricos', api_keys: 'API / Integrações',
    payment_orders: 'Ordens de Pagamento', attendance: 'Assiduidade',
    schedules: 'Escalas / Turnos', vacations: 'Férias', sms: 'SMS',
  }
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
      <div>
        <p className="font-heading text-lg font-bold text-slate-700">{labels[feature] ?? feature} — Plano superior necessário</p>
        <p className="mt-1 text-sm text-slate-500">
          Esta funcionalidade requer o plano {plan ?? 'Profissional ou Empresarial'}.
        </p>
      </div>
      <a href="/app/subscricao" className="rounded-xl bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90">
        Ver planos e fazer upgrade
      </a>
    </div>
  )
}

/**
 * Modal de confirmação reutilizável — substitui o confirm() nativo do browser.
 * Uso:
 *   const [confirm, ConfirmModal] = useConfirm()
 *   await confirm({ title:'Eliminar?', message:'Esta ação é irreversível.', danger:true })
 */
export function ConfirmModal({
  open,
  title,
  message,
  danger = false,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  danger?: boolean
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onCancel])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="card w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <div className="mb-3 flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-red-100' : 'bg-amber-100'}`}>
              <AlertTriangle size={20} className={danger ? 'text-red-600' : 'text-amber-600'} />
            </div>
            <h3 className="font-heading text-base font-bold text-slate-800">{title}</h3>
          </div>
          <p className="text-sm text-slate-500">{message}</p>
          <div className="mt-5 flex justify-end gap-2">
            <button className="btn-outline" onClick={onCancel}>{cancelLabel}</button>
            <button
              className={danger ? 'btn-danger' : 'btn-primary'}
              onClick={onConfirm}
            >{confirmLabel}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
