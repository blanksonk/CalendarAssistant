import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { CalendarView } from '../calendar/CalendarView'
import { InsightsPanel } from '../insights/InsightsPanel'
import { ChatPanel } from '../chat/ChatPanel'
import { usePendingEventsStore } from '../../store/pendingEventsStore'

type MainTab = 'calendar' | 'insights'

export function AppShell() {
  const { user, logout } = useAuth()
  const [activeTab, setActiveTab] = useState<MainTab>('calendar')
  const [chatInput, setChatInput] = useState('')
  const pendingEvents = usePendingEventsStore((s) => s.events)

  // Warn before leaving with pending events
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (pendingEvents.length > 0) {
        e.preventDefault()
        e.returnValue = 'You have unconfirmed events — are you sure you want to leave?'
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [pendingEvents.length])

  // Allow the InsightsPanel to pre-fill the chat input
  const handlePromptAgent = (message: string) => {
    setChatInput(message)
    // No need to switch tabs — chat panel is always visible
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <span className="font-semibold text-gray-800 text-sm">CalendarAssistant</span>

          {/* Pending events badge */}
          {pendingEvents.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              {pendingEvents.length} pending
            </span>
          )}

          {/* Main tabs */}
          <div className="flex items-center gap-1 ml-4">
            {(['calendar', 'insights'] as MainTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* User menu */}
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">{user?.email}</span>
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Calendar or Insights */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'calendar' && <CalendarView />}
          {activeTab === 'insights' && (
            <InsightsPanel onPromptAgent={handlePromptAgent} />
          )}
        </div>

        {/* Right panel — Chat (always visible) */}
        <div className="w-[380px] shrink-0 border-l border-gray-200 bg-white overflow-hidden">
          <ChatPanel
            onTabSwitch={setActiveTab}
            initialInput={chatInput}
            onInputConsumed={() => setChatInput('')}
          />
        </div>
      </div>
    </div>
  )
}
