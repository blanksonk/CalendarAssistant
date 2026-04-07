interface Action {
  label: string
  text: string
}

const QUICK_ACTIONS: Action[] = [
  { label: 'Schedule a meeting', text: 'Help me schedule a meeting' },
  { label: "This week's summary", text: "What does my week look like?" },
  { label: 'Find free time', text: 'Find me a 1-hour free slot this week' },
  { label: 'Draft a follow-up email', text: 'Draft a follow-up email for my last meeting' },
  { label: 'Show my insights', text: 'Show me my meeting insights for this week' },
]

interface CommandPaletteProps {
  onSelect: (text: string) => void
  onClose: () => void
}

export function CommandPalette({ onSelect, onClose }: CommandPaletteProps) {
  return (
    <div
      role="listbox"
      aria-label="Quick actions"
      className="mx-3 mb-2 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
    >
      <p className="px-3 py-2 text-xs font-medium text-gray-400 border-b border-gray-100">
        Quick actions
      </p>
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.label}
          role="option"
          aria-selected={false}
          onClick={() => {
            onSelect(action.text)
            onClose()
          }}
          className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors"
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}
