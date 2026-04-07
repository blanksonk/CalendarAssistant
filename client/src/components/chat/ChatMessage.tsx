import { ToolIndicator, ToolStatus } from './ToolIndicator'

export interface ToolCall {
  id: string
  toolName: string
  status: ToolStatus
  durationMs?: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  toolCalls?: ToolCall[]
  /** Set while the message is still streaming in */
  isStreaming?: boolean
}

interface ChatMessageProps {
  message: Message
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="bg-gray-200 rounded px-0.5 text-xs font-mono">$1</code>')
    .replace(/\n/g, '<br />')
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} flex-col gap-1`}>
      {/* Tool call indicators — shown above assistant text */}
      {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
        <div className="flex flex-col gap-0.5 pl-1">
          {message.toolCalls.map((tc) => (
            <ToolIndicator
              key={tc.id}
              toolName={tc.toolName}
              status={tc.status}
              durationMs={tc.durationMs}
            />
          ))}
        </div>
      )}

      {/* Message bubble */}
      {(message.content || message.isStreaming) && (
        <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
          <div
            className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
              isUser
                ? 'bg-blue-600 text-white rounded-br-sm'
                : 'bg-gray-100 text-gray-800 rounded-bl-sm'
            }`}
          >
            {message.content ? (
              <span
                dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
              />
            ) : (
              /* Typing indicator while streaming with no text yet */
              <span className="flex gap-1 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
