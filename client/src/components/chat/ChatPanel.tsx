import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { ChatInput } from './ChatInput'
import { CommandPalette } from './CommandPalette'
import { ChatMessage } from './ChatMessage'
import type { Message, ToolCall } from './ChatMessage'
import { EventProposalCard } from './EventProposalCard'
import type { ProposedEvent } from './EventProposalCard'
import { DraftCard } from './DraftCard'
import type { DraftData } from './DraftCard'
import { usePendingEventsStore } from '../../store/pendingEventsStore'

type SpecialCard =
  | { type: 'propose_event'; data: ProposedEvent }
  | { type: 'draft_card'; data: DraftData }

interface ExtendedMessage extends Message {
  cards?: SpecialCard[]
}

interface ChatPanelProps {
  onTabSwitch?: (tab: 'calendar' | 'insights') => void
  /** Pre-filled text injected from outside (e.g. InsightsPanel click) */
  initialInput?: string
  /** Called after initialInput has been consumed */
  onInputConsumed?: () => void
}

export function ChatPanel({ onTabSwitch, initialInput, onInputConsumed }: ChatPanelProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ExtendedMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [showPalette, setShowPalette] = useState(false)
  const [chatSessionId, setChatSessionId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const addPendingEvent = usePendingEventsStore((s) => s.addEvent)

  // Consume initialInput from parent (InsightsPanel → ChatPanel)
  useEffect(() => {
    if (initialInput) {
      setInput(initialInput)
      onInputConsumed?.()
    }
  }, [initialInput])

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
        content: `${greeting}, ${firstName}! I can help you schedule meetings, find free time, draft emails, and analyse your calendar patterns.\n\nWhat can I help you with today?`,
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

  const updateMessage = useCallback(
    (id: string, updater: (msg: ExtendedMessage) => ExtendedMessage) => {
      setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)))
    },
    []
  )

  const sendMessage = async (text: string) => {
    if (!text.trim() || isStreaming) return
    setShowPalette(false)
    setInput('')

    const userMsg: ExtendedMessage = { id: `u-${Date.now()}`, role: 'user', content: text }
    const assistantId = `a-${Date.now() + 1}`
    const assistantMsg: ExtendedMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      toolCalls: [],
      cards: [],
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsStreaming(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message: text, chat_session_id: chatSessionId }),
      })

      // Capture chat session ID from response header
      const newSessionId = res.headers.get('X-Chat-Session-Id')
      if (newSessionId) setChatSessionId(newSessionId)

      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6))
            handleSseEvent(event, assistantId)
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch {
      updateMessage(assistantId, (m) => ({
        ...m,
        content: m.content || 'Sorry, something went wrong. Please try again.',
        isStreaming: false,
      }))
    } finally {
      updateMessage(assistantId, (m) => ({ ...m, isStreaming: false }))
      setIsStreaming(false)
    }
  }

  const handleSseEvent = (event: Record<string, unknown>, assistantId: string) => {
    switch (event.type) {
      case 'text':
        updateMessage(assistantId, (m) => ({
          ...m,
          content: m.content + (event.delta as string ?? ''),
        }))
        break

      case 'tool_start':
        updateMessage(assistantId, (m) => ({
          ...m,
          toolCalls: [
            ...(m.toolCalls ?? []),
            {
              id: event.tool_use_id as string,
              toolName: event.tool_name as string,
              status: 'running',
            } as ToolCall,
          ],
        }))
        break

      case 'tool_result':
        updateMessage(assistantId, (m) => ({
          ...m,
          toolCalls: (m.toolCalls ?? []).map((tc) =>
            tc.id === event.tool_use_id
              ? {
                  ...tc,
                  status: (event.error ? 'error' : 'done') as ToolCall['status'],
                  durationMs: event.duration_ms as number | undefined,
                }
              : tc
          ),
        }))
        break

      case 'propose_event': {
        const proposed = event as unknown as ProposedEvent
        // Also push to global store so it appears on the calendar
        addPendingEvent({
          id: proposed.id,
          title: proposed.title,
          start: new Date(proposed.start),
          end: new Date(proposed.end),
          attendees: proposed.attendees,
          description: proposed.description,
        })
        updateMessage(assistantId, (m) => ({
          ...m,
          cards: [...(m.cards ?? []), { type: 'propose_event', data: proposed }],
        }))
        break
      }

      case 'draft_card': {
        const draft = event as unknown as DraftData
        updateMessage(assistantId, (m) => ({
          ...m,
          cards: [...(m.cards ?? []), { type: 'draft_card', data: draft }],
        }))
        break
      }

      case 'switch_tab':
        onTabSwitch?.(event.tab as 'calendar' | 'insights')
        break

      case 'done':
        updateMessage(assistantId, (m) => ({ ...m, isStreaming: false }))
        break
    }
  }

  const handlePaletteSelect = (text: string) => {
    setInput(text)
    sendMessage(text)
  }

  return (
    <div data-testid="chat-panel" className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 shrink-0">
        <h2 className="text-sm font-semibold text-gray-800">Assistant</h2>
        <p className="text-xs text-gray-400">Press ⌘K for quick actions</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-2">
            <ChatMessage message={msg} />
            {msg.cards && msg.cards.length > 0 && (
              <div className="flex flex-col gap-2">
                {msg.cards.map((card, i) =>
                  card.type === 'propose_event' ? (
                    <EventProposalCard
                      key={i}
                      event={card.data}
                      onRevise={(prefill) => setInput(prefill)}
                    />
                  ) : (
                    <DraftCard
                      key={i}
                      draft={card.data}
                      onRevise={(prefill) => setInput(prefill)}
                    />
                  )
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Command palette */}
      {showPalette && (
        <CommandPalette onSelect={handlePaletteSelect} onClose={() => setShowPalette(false)} />
      )}

      {/* Input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={sendMessage}
        disabled={isStreaming}
        onPaletteToggle={() => setShowPalette((v) => !v)}
      />
    </div>
  )
}
