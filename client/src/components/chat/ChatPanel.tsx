import { useState, useRef, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

interface ChatPanelProps {
  onTabSwitch?: (tab: 'calendar' | 'insights') => void
}

const QUICK_ACTIONS = [
  { label: 'Schedule a meeting', text: 'Help me schedule a meeting' },
  { label: 'This week summary', text: "What does my week look like?" },
  { label: 'Find free time', text: 'Find me a 1-hour free slot this week' },
  { label: 'Draft email', text: 'Draft a follow-up email' },
]

export function ChatPanel({ onTabSwitch }: ChatPanelProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Proactive greeting on mount
  useEffect(() => {
    if (!user) return
    const firstName = user.name.split(' ')[0]
    const hour = new Date().getHours()
    const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

    setMessages([
      {
        id: 'greeting',
        role: 'assistant',
        content: `${greeting}, ${firstName}! 👋 I can see you have **13 meetings** this week — including back-to-back sessions Thursday morning. Your best focus block looks like **Tuesday 10am–1pm**.\n\nWhat can I help you with today?`,
      },
    ])
  }, [user?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ⌘K palette toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setShowPalette((v) => !v)
      }
      if (e.key === 'Escape') setShowPalette(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return
    setShowPalette(false)
    setInput('')

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])

    // Add streaming assistant message
    const assistantId = (Date.now() + 1).toString()
    setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])
    setIsStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text }),
      })

      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            if (event.type === 'text') {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + event.delta } : m
                )
              )
            } else if (event.type === 'switch_tab') {
              onTabSwitch?.(event.tab)
            } else if (event.type === 'done') {
              break
            }
          } catch {}
        }
      }
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: 'Sorry, something went wrong. Please try again.' }
            : m
        )
      )
    } finally {
      setIsStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <h2 className="text-sm font-semibold text-gray-800">Assistant</h2>
        <p className="text-xs text-gray-400">Press ⌘K for quick actions</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 text-gray-800 rounded-bl-sm'
              }`}
              dangerouslySetInnerHTML={{
                __html: msg.content
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\n/g, '<br />'),
              }}
            />
          </div>
        ))}
        {isStreaming && messages[messages.length - 1]?.content === '' && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Command palette */}
      {showPalette && (
        <div className="mx-3 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
          <p className="px-3 py-2 text-xs font-medium text-gray-400 border-b border-gray-100">
            Quick actions
          </p>
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => sendMessage(action.text)}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
            >
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-3 shrink-0">
        <div className="flex items-end gap-2 bg-gray-100 rounded-2xl px-3 py-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything… (⌘K for shortcuts)"
            rows={1}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-sm resize-none outline-none text-gray-800 placeholder-gray-400 max-h-32 disabled:opacity-50"
            style={{ minHeight: '24px' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isStreaming}
            className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed hover:bg-blue-700 shrink-0"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
