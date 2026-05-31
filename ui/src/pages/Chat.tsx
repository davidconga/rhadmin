import { useEffect, useRef, useState } from 'react'
import { Send, MessageSquare, Search, Plus, X, Hash, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../lib/api'
import { useAuth } from '../stores/auth'
import { Spinner } from '../components/ui'

interface User  { id: number; name: string; role: string; employee_id?: number }
interface Message {
  id: number; conversation_id: number; sender_id: number
  sender: User | null; body: string; created_at: string
}
interface Conversation {
  id: number; participants: User[]; unread: number; updated_at: string
  last_message: { body: string; sender_id: number; created_at: string } | null
}
interface Channel {
  id: number; name: string; slug: string; description: string | null
}
interface ChannelMessage {
  id: number; channel_id: number; sender_id: number
  sender: User | null; body: string; created_at: string
}

type Tab = 'channels' | 'direct'

function timeAgo(dt: string) {
  const diff = (Date.now() - new Date(dt).getTime()) / 1000
  if (diff < 60) return 'agora'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(dt).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' })
}

export default function Chat() {
  const { user: me } = useAuth()

  // ── Tab ──
  const [tab, setTab] = useState<Tab>('channels')

  // ── Canais públicos ──
  const [channels, setChannels]         = useState<Channel[]>([])
  const [activeChannel, setActiveChannel] = useState<number | null>(null)
  const [channelMsgs, setChannelMsgs]   = useState<ChannelMessage[]>([])
  const channelPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Mensagens privadas ──
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeId, setActiveId]   = useState<number | null>(null)
  const [messages, setMessages]   = useState<Message[]>([])
  const [search, setSearch]       = useState('')
  const [users, setUsers]         = useState<User[]>([])
  const [showNew, setShowNew]     = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const dmPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── Partilhado ──
  const [text, setText]     = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── Carregar dados iniciais ──
  useEffect(() => {
    api.get<Channel[]>('/channels').then(r => {
      setChannels(r.data)
      if (r.data.length > 0) setActiveChannel(r.data[0].id)
    }).catch(() => {})

    api.get<User[]>('/users').then(r => setUsers(r.data)).catch(() => {})
  }, [])

  // ── Canais: carregar mensagens + polling ──
  const loadChannelMsgs = async (cid: number) => {
    try {
      const { data } = await api.get<ChannelMessage[]>(`/channels/${cid}/messages`)
      setChannelMsgs(data)
    } catch {}
  }

  useEffect(() => {
    if (!activeChannel) return
    loadChannelMsgs(activeChannel)
    channelPollRef.current = setInterval(() => loadChannelMsgs(activeChannel), 3000)
    return () => { if (channelPollRef.current) clearInterval(channelPollRef.current) }
  }, [activeChannel])

  // ── DMs: carregar conversas ──
  const loadConversations = async () => {
    try {
      const { data } = await api.get<Conversation[]>('/chat/conversations')
      setConversations(data)
    } catch {}
  }

  const loadMessages = async (cid: number) => {
    try {
      const { data } = await api.get<Message[]>(`/chat/conversations/${cid}/messages`)
      setMessages(data)
      setConversations(prev => prev.map(c => c.id === cid ? { ...c, unread: 0 } : c))
    } catch {}
  }

  useEffect(() => {
    if (tab !== 'direct') return
    loadConversations()
  }, [tab])

  useEffect(() => {
    if (!activeId) return
    loadMessages(activeId)
    dmPollRef.current = setInterval(() => {
      loadMessages(activeId)
      loadConversations()
    }, 3000)
    return () => { if (dmPollRef.current) clearInterval(dmPollRef.current) }
  }, [activeId])

  // ── Scroll automático ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, channelMsgs])

  // ── Enviar mensagem ──
  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    setSending(true)
    try {
      if (tab === 'channels' && activeChannel) {
        const { data: msg } = await api.post<ChannelMessage>(`/channels/${activeChannel}/messages`, { body: text.trim() })
        setChannelMsgs(prev => [...prev, msg])
      } else if (tab === 'direct' && activeId) {
        const { data: msg } = await api.post<Message>(`/chat/conversations/${activeId}/messages`, { body: text.trim() })
        setMessages(prev => [...prev, msg])
        loadConversations()
      }
      setText('')
    } catch { toast.error('Erro ao enviar') }
    finally { setSending(false) }
  }

  // ── DMs: nova conversa ──
  const openConversation = (cid: number) => {
    setActiveId(cid)
    setMessages([])
  }

  const startChat = async (userId: number) => {
    try {
      const { data } = await api.post<{ id: number }>('/chat/conversations', { user_id: userId })
      setShowNew(false)
      setUserSearch('')
      await loadConversations()
      openConversation(data.id)
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Erro')
    }
  }

  const initials = (name: string) => name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()

  const activeConv    = conversations.find(c => c.id === activeId)
  const activeChObj   = channels.find(c => c.id === activeChannel)
  const otherParticip = (c: Conversation) => c.participants.find(p => p.id !== me?.id) ?? c.participants[0]

  const filteredConvs = conversations.filter(c => {
    const other = otherParticip(c)
    return other?.name.toLowerCase().includes(search.toLowerCase())
  })
  const filteredUsers = users.filter(u =>
    u.id !== me?.id && u.name.toLowerCase().includes(userSearch.toLowerCase())
  )

  const hasActiveChat = tab === 'channels' ? !!activeChannel : !!activeId

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-2xl border border-slate-200 overflow-hidden bg-white">

      {/* ── Sidebar ── */}
      <div className="flex w-72 shrink-0 flex-col border-r border-slate-100">

        {/* Tabs */}
        <div className="flex border-b border-slate-100">
          <button
            onClick={() => setTab('channels')}
            className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition ${
              tab === 'channels' ? 'border-b-2 border-primary text-primary' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Hash size={13} /> Canais
          </button>
          <button
            onClick={() => { setTab('direct'); loadConversations() }}
            className={`flex flex-1 items-center justify-center gap-1.5 py-3 text-xs font-semibold transition ${
              tab === 'direct' ? 'border-b-2 border-primary text-primary' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Lock size={13} /> Privado
          </button>
        </div>

        {/* ── Conteúdo da sidebar: Canais ── */}
        {tab === 'channels' && (
          <div className="flex-1 overflow-y-auto py-2">
            {channels.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
                <Hash size={28} className="opacity-30" />
                <p className="text-xs">Sem canais</p>
              </div>
            )}
            {channels.map(ch => (
              <button
                key={ch.id}
                onClick={() => { setActiveChannel(ch.id); setChannelMsgs([]) }}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left transition hover:bg-slate-50 ${
                  activeChannel === ch.id ? 'bg-primary/5 border-r-2 border-primary' : ''
                }`}
              >
                <Hash size={15} className={activeChannel === ch.id ? 'text-primary' : 'text-slate-400'} />
                <div className="min-w-0">
                  <p className={`text-sm font-medium truncate ${activeChannel === ch.id ? 'text-primary' : 'text-slate-700'}`}>
                    {ch.name}
                  </p>
                  {ch.description && (
                    <p className="text-xs text-slate-400 truncate">{ch.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Conteúdo da sidebar: Privado ── */}
        {tab === 'direct' && (
          <>
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h2 className="font-heading font-bold text-slate-800">Mensagens</h2>
              <button onClick={() => setShowNew(!showNew)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition">
                {showNew ? <X size={14} /> : <Plus size={14} />}
              </button>
            </div>

            {showNew && (
              <div className="border-b border-slate-100 p-3">
                <input className="input text-sm" placeholder="Procurar utilizador…"
                  value={userSearch} onChange={e => setUserSearch(e.target.value)} autoFocus />
                <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                  {filteredUsers.map(u => (
                    <button key={u.id} onClick={() => startChat(u.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-slate-50 text-left">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {initials(u.name)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700 truncate">{u.name}</p>
                        <p className="text-xs text-slate-400 capitalize">{u.role}</p>
                      </div>
                    </button>
                  ))}
                  {filteredUsers.length === 0 && <p className="text-xs text-slate-400 px-2 py-1">Sem resultados</p>}
                </div>
              </div>
            )}

            <div className="border-b border-slate-100 px-3 py-2">
              <div className="flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5">
                <Search size={13} className="text-slate-400 shrink-0" />
                <input className="flex-1 bg-transparent text-sm text-slate-700 placeholder-slate-400 focus:outline-none"
                  placeholder="Pesquisar…" value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {filteredConvs.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-12 text-slate-400">
                  <MessageSquare size={28} className="opacity-30" />
                  <p className="text-xs">Sem conversas</p>
                </div>
              )}
              {filteredConvs.map(c => {
                const other = otherParticip(c)
                const isActive = c.id === activeId
                return (
                  <button key={c.id} onClick={() => openConversation(c.id)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 ${isActive ? 'bg-primary/5 border-r-2 border-primary' : ''}`}>
                    <div className="relative shrink-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                        {other ? initials(other.name) : '?'}
                      </div>
                      {c.unread > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                          {c.unread > 9 ? '9+' : c.unread}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className={`text-sm truncate ${c.unread > 0 ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                          {other?.name ?? 'Desconhecido'}
                        </p>
                        <span className="text-[10px] text-slate-400 shrink-0 ml-1">
                          {c.last_message ? timeAgo(c.last_message.created_at) : ''}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${c.unread > 0 ? 'text-slate-700' : 'text-slate-400'}`}>
                        {c.last_message
                          ? (c.last_message.sender_id === me?.id ? 'Eu: ' : '') + c.last_message.body
                          : 'Sem mensagens'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* ── Área principal ── */}
      {hasActiveChat ? (
        <div className="flex flex-1 flex-col">

          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3">
            {tab === 'channels' && activeChObj && (
              <>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <Hash size={18} className="text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800">{activeChObj.name}</p>
                  {activeChObj.description && (
                    <p className="text-xs text-slate-400">{activeChObj.description}</p>
                  )}
                </div>
              </>
            )}
            {tab === 'direct' && activeConv && (() => {
              const other = otherParticip(activeConv)
              return other ? (
                <>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                    {initials(other.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">{other.name}</p>
                    <p className="text-xs capitalize text-slate-400">{other.role}</p>
                  </div>
                </>
              ) : null
            })()}
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {tab === 'channels' && channelMsgs.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-16 text-slate-300">
                <Hash size={32} />
                <p className="text-sm">Nenhuma mensagem ainda — seja o primeiro!</p>
              </div>
            )}
            {tab === 'direct' && messages.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-16 text-slate-300">
                <MessageSquare size={32} />
                <p className="text-sm">Nenhuma mensagem ainda</p>
              </div>
            )}

            {tab === 'channels' && channelMsgs.map((msg, i) => {
              const isMine   = msg.sender_id === me?.id
              const showName = i === 0 || channelMsgs[i-1].sender_id !== msg.sender_id
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
                    {showName && !isMine && (
                      <span className="text-[10px] text-slate-400 px-1">{msg.sender?.name}</span>
                    )}
                    <div className={`rounded-2xl px-4 py-2 text-sm ${
                      isMine ? 'bg-primary text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                    }`}>
                      {msg.body}
                    </div>
                    <span className="text-[10px] text-slate-400 px-1">{timeAgo(msg.created_at)}</span>
                  </div>
                </div>
              )
            })}

            {tab === 'direct' && messages.map((msg, i) => {
              const isMine   = msg.sender_id === me?.id
              const showName = !isMine && (i === 0 || messages[i-1].sender_id !== msg.sender_id)
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[70%] flex flex-col gap-0.5 ${isMine ? 'items-end' : 'items-start'}`}>
                    {showName && (
                      <span className="text-[10px] text-slate-400 px-1">{msg.sender?.name}</span>
                    )}
                    <div className={`rounded-2xl px-4 py-2 text-sm ${
                      isMine ? 'bg-primary text-white rounded-br-sm' : 'bg-slate-100 text-slate-800 rounded-bl-sm'
                    }`}>
                      {msg.body}
                    </div>
                    <span className="text-[10px] text-slate-400 px-1">{timeAgo(msg.created_at)}</span>
                  </div>
                </div>
              )
            })}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="border-t border-slate-100 px-4 py-3 flex gap-2">
            <input
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:border-primary focus:outline-none"
              placeholder={
                tab === 'channels' && activeChObj
                  ? `Mensagem em #${activeChObj.name}…`
                  : 'Escreva uma mensagem…'
              }
              value={text} onChange={e => setText(e.target.value)}
              autoFocus
            />
            <button type="submit" disabled={!text.trim() || sending}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition">
              {sending ? <Spinner /> : <Send size={16} />}
            </button>
          </form>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-300">
          <MessageSquare size={48} className="opacity-30" />
          <p className="text-sm">Seleccione um canal ou conversa</p>
        </div>
      )}
    </div>
  )
}
