import { useEffect, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { Card, Modal, Spinner, EmptyState, ConfirmModal } from '../components/ui'
import { useCompany } from '../stores/company'
import type { Company } from '../types'

const empty: Partial<Company> = {
  name: '', nif: '', address: '', phone: '', email: '',
  bank_name: '', account_number: '', iban: '', currency: 'AOA', active: true,
}

export default function Companies() {
  const { companies, fetchAll, active, setActive } = useCompany()
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Partial<Company>>(empty)
  const [confirmDelete, setConfirmDelete] = useState<Company | null>(null)
  const [logoModal, setLogoModal] = useState<Company | null>(null)
  const [logoUrls, setLogoUrls] = useState<Record<number, string>>({})
  const logoRef = useRef<HTMLInputElement>(null)

  const load = async () => {
    setLoading(true)
    await fetchAll()
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    companies.forEach((c) => {
      if (c.logo_path && !logoUrls[c.id]) {
        api.get(`/companies/${c.id}/logo`, { responseType: 'blob' })
          .then((res) => setLogoUrls((prev) => ({ ...prev, [c.id]: URL.createObjectURL(res.data) })))
          .catch(() => {})
      }
    })
  }, [companies])

  const openCreate = () => { setForm(empty); setModal(true) }
  const openEdit = (c: Company) => { setForm(c); setModal(true) }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (form.id) await api.put(`/companies/${form.id}`, form)
      else await api.post('/companies', form)
      toast.success('Empresa guardada')
      setModal(false)
      load()
    } catch (err: any) {
      const msg = err?.response?.data?.message
      toast.error(msg ?? 'Erro ao guardar')
    }
  }

  const doRemove = async () => {
    if (!confirmDelete) return
    try {
      await api.delete(`/companies/${confirmDelete.id}`)
      toast.success('Empresa eliminada')
      setConfirmDelete(null)
      load()
    } catch {
      toast.error('Erro ao eliminar')
    }
  }

  const uploadLogo = async (file: File, company: Company) => {
    const fd = new FormData()
    fd.append('logo', file)
    try {
      await api.post(`/companies/${company.id}/logo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Logótipo actualizado')
      setLogoModal(null)
      const res = await api.get(`/companies/${company.id}/logo`, { responseType: 'blob' })
      setLogoUrls((prev) => ({ ...prev, [company.id]: URL.createObjectURL(res.data) }))
    } catch {
      toast.error('Erro ao carregar logótipo (PNG/JPG/WEBP até 2 MB)')
    }
  }

  const f = (key: keyof Company, label: string, type = 'text') => (
    <div>
      <label className="label">{label}</label>
      <input
        type={type}
        className="input"
        value={(form[key] as string) ?? ''}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold text-primary">Empresas</h1>
          <p className="text-sm text-slate-500">Empresas clientes geridas por este tenant</p>
        </div>
        <button className="btn-primary" onClick={openCreate}><Plus size={18} /> Nova empresa</button>
      </div>

      <Card>
        {loading ? <Spinner /> : companies.length === 0 ? (
          <EmptyState message="Nenhuma empresa registada." />
        ) : (
          <div className="divide-y divide-slate-100">
            {companies.map((c) => (
              <div key={c.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50">
                {/* Logo */}
                <button
                  onClick={() => { setLogoModal(c); setTimeout(() => logoRef.current?.click(), 50) }}
                  className="group relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200"
                  title="Alterar logótipo"
                >
                  {logoUrls[c.id] ? (
                    <img src={logoUrls[c.id]} alt={c.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-primary/10 font-heading font-bold text-primary text-sm">
                      {c.name.charAt(0)}
                    </div>
                  )}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100 text-white text-xs">
                    Logo
                  </div>
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-800 truncate">{c.name}</p>
                    {active?.id === c.id && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        <CheckCircle2 size={11} /> Activa
                      </span>
                    )}
                    {!c.active && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">Inativa</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate">{c.nif ? `NIF: ${c.nif}` : ''}{c.email ? ` · ${c.email}` : ''}</p>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => setActive(c)}
                    disabled={active?.id === c.id}
                    className="rounded px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-primary/10 hover:text-primary disabled:opacity-30"
                  >
                    Seleccionar
                  </button>
                  <button onClick={() => openEdit(c)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary"><Pencil size={16} /></button>
                  <button onClick={() => setConfirmDelete(c)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Input oculto para logo */}
      <input
        ref={logoRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f && logoModal) uploadLogo(f, logoModal)
          e.target.value = ''
        }}
      />

      {/* Modal criar / editar */}
      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar empresa' : 'Nova empresa'} wide>
        <form onSubmit={save} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">{f('name', 'Nome da empresa')}</div>
          {f('nif', 'NIF')}
          {f('email', 'Email', 'email')}
          {f('phone', 'Telefone')}
          <div className="sm:col-span-2">{f('address', 'Morada')}</div>
          {f('bank_name', 'Banco')}
          {f('account_number', 'Nº de conta')}
          {f('iban', 'IBAN')}
          {f('default_debit_account', 'Conta de débito padrão')}
          <div>
            <label className="label">Moeda</label>
            <select className="input" value={form.currency ?? 'AOA'} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
              <option value="AOA">AOA — Kwanza</option>
              <option value="USD">USD — Dólar</option>
              <option value="EUR">EUR — Euro</option>
              <option value="MZN">MZN — Metical</option>
            </select>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm text-slate-600">
            <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-primary" /> Ativa
          </label>
          <div className="sm:col-span-2 mt-2 flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!confirmDelete}
        title="Eliminar empresa"
        message={`Tem a certeza que quer eliminar "${confirmDelete?.name}"? Todos os funcionários associados perderão a ligação.`}
        danger
        confirmLabel="Eliminar"
        onConfirm={doRemove}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
