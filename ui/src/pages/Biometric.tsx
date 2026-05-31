import { useEffect, useRef, useState } from 'react'
import { Plus, Pencil, Trash2, Fingerprint, Wifi, Upload, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { Card, Modal, Spinner, EmptyState, ConfirmModal, FeatureLocked } from '../components/ui'
import { useSubscription } from '../stores/subscription'
import type { BiometricDevice, BiometricImportResult } from '../types'

const emptyDevice: Partial<BiometricDevice> = {
  name: '', brand: 'ZKTeco', model: '', ip_address: '', port: 4370, location: '', active: true,
}

export default function Biometric({ embedded = false }: { embedded?: boolean }) {
  const { hasFeature } = useSubscription()
  const [devices, setDevices] = useState<BiometricDevice[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState<Partial<BiometricDevice>>(emptyDevice)
  const [entryLimit, setEntryLimit] = useState('08:15')
  const [result, setResult] = useState<BiometricImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [confirmDelete, setConfirmDelete] = useState<BiometricDevice | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get<BiometricDevice[]>('/biometric/devices')
      setDevices(data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    api.get('/settings').then((r) => setEntryLimit(r.data.attendance_entry_limit ?? '08:15'))
  }, [])

  const saveDevice = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (form.id) await api.put(`/biometric/devices/${form.id}`, form)
      else await api.post('/biometric/devices', form)
      toast.success('Dispositivo guardado')
      setModal(false)
      load()
    } catch {
      toast.error('Erro ao guardar (verifique o IP)')
    }
  }

  const removeDevice = (d: BiometricDevice) => setConfirmDelete(d)
  const doRemove = async () => {
    if (!confirmDelete) return
    try {
      await api.delete(`/biometric/devices/${confirmDelete.id}`)
      toast.success('Dispositivo eliminado')
      setConfirmDelete(null); load()
    } catch { toast.error('Erro ao eliminar') }
  }

  const testDevice = async (d: BiometricDevice) => {
    toast.message(`A testar ${d.name}...`)
    try {
      const { data } = await api.post(`/biometric/devices/${d.id}/test`)
      data.reachable ? toast.success(data.message) : toast.error(data.message)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Falha no teste')
    }
  }

  const saveEntryLimit = async () => {
    try {
      await api.put('/settings', { attendance_entry_limit: entryLimit })
      toast.success('Hora-limite de entrada guardada')
    } catch {
      toast.error('Erro ao guardar')
    }
  }

  const importFile = async (file: File, deviceId?: number) => {
    const fd = new FormData()
    fd.append('file', file)
    if (deviceId) fd.append('device_id', String(deviceId))
    try {
      const { data } = await api.post<BiometricImportResult>('/biometric/import', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setResult(data)
      toast.success(`${data.attendances} presenças importadas de ${data.matched} funcionários`)
      if (data.unmatched.length) toast.warning(`IDs sem funcionário: ${data.unmatched.join(', ')}`)
    } catch {
      toast.error('Erro ao importar ficheiro')
    }
  }

  if (!hasFeature('biometrics')) return <FeatureLocked feature="biometrics" plan="Empresarial" />

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        {embedded ? (
          <p className="text-sm text-slate-500">Terminais de ponto e importação de picagens para a assiduidade</p>
        ) : (
          <div>
            <h1 className="font-heading text-2xl font-bold text-primary">Biométricos</h1>
            <p className="text-sm text-slate-500">Terminais de ponto e importação de picagens para a assiduidade</p>
          </div>
        )}
        <button className="btn-primary" onClick={() => { setForm(emptyDevice); setModal(true) }}><Plus size={18} /> Novo dispositivo</button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Importação */}
        <Card className="p-5 lg:col-span-1">
          <div className="mb-2 flex items-center gap-2 text-primary"><Upload size={18} /><h2 className="font-heading font-bold">Importar picagens</h2></div>
          <p className="mb-3 text-xs text-slate-500">Ficheiro CSV/TXT exportado do terminal. Cada linha: <code className="rounded bg-slate-100 px-1">ID;data hora</code></p>
          <input ref={fileRef} type="file" accept=".csv,.txt,.dat" className="hidden"
            onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
          <button className="btn-outline w-full" onClick={() => fileRef.current?.click()}><Upload size={16} /> Escolher ficheiro</button>

          {result && (
            <div className="mt-4 space-y-1 rounded-lg bg-primary/5 p-3 text-sm text-slate-600">
              <div>Picagens lidas: <strong>{result.punches}</strong></div>
              <div>Funcionários: <strong>{result.matched}</strong></div>
              <div>Presenças geradas: <strong className="text-primary">{result.attendances}</strong></div>
              {result.unmatched.length > 0 && (
                <div className="text-amber-700">IDs sem funcionário: {result.unmatched.join(', ')}</div>
              )}
            </div>
          )}

          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="mb-2 flex items-center gap-2 text-primary"><Clock size={16} /><h3 className="text-sm font-semibold">Hora-limite de entrada</h3></div>
            <p className="mb-2 text-xs text-slate-500">Picagens de entrada depois desta hora contam como atraso.</p>
            <div className="flex gap-2">
              <input type="time" className="input" value={entryLimit} onChange={(e) => setEntryLimit(e.target.value)} />
              <button className="btn-outline" onClick={saveEntryLimit}>Guardar</button>
            </div>
          </div>
        </Card>

        {/* Dispositivos */}
        <Card className="lg:col-span-2">
          <div className="border-b border-slate-200 px-4 py-3 font-heading font-bold text-primary">Terminais registados</div>
          {loading ? (
            <Spinner />
          ) : devices.length === 0 ? (
            <EmptyState message="Nenhum terminal registado." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Terminal</th>
                    <th className="px-4 py-3">Endereço</th>
                    <th className="px-4 py-3">Local</th>
                    <th className="px-4 py-3">Última sinc.</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {devices.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 font-medium text-slate-700"><Fingerprint size={15} className="text-primary" /> {d.name}</div>
                        <div className="text-xs text-slate-400">{[d.brand, d.model].filter(Boolean).join(' · ') || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{d.ip_address ? `${d.ip_address}:${d.port}` : '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{d.location ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-500">{d.last_sync_at ? new Date(d.last_sync_at).toLocaleString('pt-PT') : '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button title="Testar ligação" onClick={() => testDevice(d)} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary"><Wifi size={16} /></button>
                          <button title="Editar" onClick={() => { setForm(d); setModal(true) }} className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-primary"><Pencil size={16} /></button>
                          <button title="Eliminar" onClick={() => removeDevice(d)} className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <p className="rounded-lg bg-slate-100 px-4 py-3 text-xs text-slate-500">
        Dica: para sincronização automática, um pequeno agente na rede local lê o terminal (ex.: ZKTeco) e envia as picagens
        para <code className="rounded bg-white px-1">POST /api/biometric/punches</code>. A importação de ficheiro funciona com qualquer marca.
      </p>

      <Modal open={modal} onClose={() => setModal(false)} title={form.id ? 'Editar dispositivo' : 'Novo dispositivo'}>
        <form onSubmit={saveDevice} className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><label className="label">Nome</label><input className="input" value={form.name ?? ''} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
          <div><label className="label">Marca</label><input className="input" value={form.brand ?? ''} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
          <div><label className="label">Modelo</label><input className="input" value={form.model ?? ''} onChange={(e) => setForm({ ...form, model: e.target.value })} /></div>
          <div><label className="label">Endereço IP</label><input className="input" placeholder="192.168.1.201" value={form.ip_address ?? ''} onChange={(e) => setForm({ ...form, ip_address: e.target.value })} /></div>
          <div><label className="label">Porta</label><input type="number" className="input" value={form.port ?? 4370} onChange={(e) => setForm({ ...form, port: Number(e.target.value) })} /></div>
          <div className="col-span-2"><label className="label">Localização</label><input className="input" value={form.location ?? ''} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={!!form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300 text-primary" /> Ativo
          </label>
          <div className="col-span-2 flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setModal(false)}>Cancelar</button>
            <button className="btn-primary">Guardar</button>
          </div>
        </form>
      </Modal>

      <ConfirmModal open={!!confirmDelete} title="Eliminar dispositivo"
        message={`Tem a certeza que quer eliminar "${confirmDelete?.name}"?`}
        danger confirmLabel="Eliminar" onConfirm={doRemove} onCancel={() => setConfirmDelete(null)} />
    </div>
  )
}
