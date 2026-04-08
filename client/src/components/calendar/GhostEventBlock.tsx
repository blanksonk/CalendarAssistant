import { type PendingEvent } from '../../store/pendingEventsStore'
import { formatTime } from '../../utils/dates'

type GhostVariant = 'week' | 'month' | 'radial'

interface GhostEventBlockProps {
  event: PendingEvent
  variant?: GhostVariant
  onClick?: (event: PendingEvent) => void
  style?: React.CSSProperties
  className?: string
}

export function GhostEventBlock({
  event,
  variant = 'week',
  onClick,
  style,
  className = '',
}: GhostEventBlockProps) {
  const startTime = formatTime(event.start)
  const endTime = formatTime(event.end)

  if (variant === 'month') {
    return (
      <div
        role="button"
        aria-label={`Pending: ${event.title}`}
        data-testid={`ghost-month-${event.id}`}
        onClick={() => onClick?.(event)}
        style={style}
        className={`rounded px-1 py-0.5 text-xs truncate cursor-pointer
          bg-blue-100/60 text-blue-600 border border-dashed border-blue-300
          opacity-70 hover:opacity-90 transition-opacity ${className}`}
      >
        {event.title}
      </div>
    )
  }

  if (variant === 'radial') {
    // Radial ghost: pulsing arc placeholder (rendered as a small badge)
    return (
      <div
        role="button"
        aria-label={`Pending: ${event.title}`}
        data-testid={`ghost-radial-${event.id}`}
        onClick={() => onClick?.(event)}
        style={style}
        className={`rounded-full px-2 py-0.5 text-xs truncate cursor-pointer
          bg-blue-200/50 text-blue-600 border border-dashed border-blue-300
          animate-pulse ${className}`}
      >
        {event.title}
      </div>
    )
  }

  // Default: week grid ghost
  return (
    <div
      role="button"
      aria-label={`Pending: ${event.title}`}
      data-testid={`ghost-week-${event.id}`}
      onClick={() => onClick?.(event)}
      style={style}
      className={`rounded-md border-l-2 border-dashed border-blue-400 px-2 py-1
        bg-blue-50/70 text-blue-700 cursor-pointer overflow-hidden
        opacity-75 hover:opacity-95 transition-opacity ${className}`}
    >
      <p className="text-xs font-semibold truncate">{event.title}</p>
      <p className="text-xs opacity-70">
        {startTime} – {endTime}
      </p>
      {event.attendees && event.attendees.length > 0 && (
        <p className="text-xs opacity-60 truncate mt-0.5">
          {event.attendees.slice(0, 2).join(', ')}
          {event.attendees.length > 2 && ` +${event.attendees.length - 2}`}
        </p>
      )}
    </div>
  )
}
