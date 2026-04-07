export type ToolStatus = 'running' | 'done' | 'error'

interface ToolIndicatorProps {
  toolName: string
  status: ToolStatus
  durationMs?: number
}

const TOOL_LABELS: Record<string, string> = {
  list_events: 'Reading calendar',
  get_free_slots: 'Finding free time',
  propose_event: 'Proposing event',
  create_gmail_draft: 'Creating draft',
  switch_tab: 'Switching view',
  compute_insights: 'Computing insights',
  generate_weekly_focus: 'Generating focus',
}

export function ToolIndicator({ toolName, status, durationMs }: ToolIndicatorProps) {
  const label = TOOL_LABELS[toolName] ?? toolName.replace(/_/g, ' ')

  return (
    <div
      role="status"
      aria-label={`${label}: ${status}`}
      className="flex items-center gap-2 text-xs text-gray-500 py-1"
    >
      {status === 'running' && (
        <span className="w-3 h-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin shrink-0" />
      )}
      {status === 'done' && (
        <span className="w-3 h-3 rounded-full bg-green-400 flex items-center justify-center shrink-0">
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 8 8" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M1.5 4l1.5 1.5L6.5 2" />
          </svg>
        </span>
      )}
      {status === 'error' && (
        <span className="w-3 h-3 rounded-full bg-red-400 flex items-center justify-center shrink-0">
          <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 8 8" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2 2l4 4M6 2l-4 4" />
          </svg>
        </span>
      )}
      <span className={status === 'error' ? 'text-red-500' : ''}>
        {label}
        {status === 'running' && '…'}
        {status === 'done' && durationMs !== undefined && (
          <span className="ml-1 text-gray-400">({durationMs}ms)</span>
        )}
        {status === 'error' && ' failed'}
      </span>
    </div>
  )
}
