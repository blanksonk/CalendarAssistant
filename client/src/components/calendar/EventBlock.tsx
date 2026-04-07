import type { CalendarEvent } from '../../api/calendar'
import { eventColorClass } from '../../utils/eventColors'
import { formatTime, parseEventDate } from '../../utils/dates'

interface EventBlockProps {
  event: CalendarEvent
  onClick?: (event: CalendarEvent) => void
  style?: React.CSSProperties
  className?: string
}

export function EventBlock({ event, onClick, style, className = '' }: EventBlockProps) {
  const colors = eventColorClass(event)
  const start = parseEventDate(event.start)
  const end = parseEventDate(event.end)

  const attendees = event.attendees ?? []
  const nonSelfAttendees = attendees.filter((a) => !a.self)

  return (
    <div
      data-testid={`event-block-${event.id}`}
      className={`rounded-md border-l-2 px-2 py-1 cursor-pointer overflow-hidden ${colors.bg} ${colors.border} ${colors.text} ${className}`}
      style={style}
      onClick={() => onClick?.(event)}
      role="button"
      aria-label={event.summary}
    >
      <p className="text-xs font-semibold truncate">{event.summary}</p>
      <p className="text-xs opacity-70">
        {formatTime(start)} – {formatTime(end)}
      </p>
      {nonSelfAttendees.length > 0 && (
        <div className="flex items-center gap-0.5 mt-1" data-testid="attendee-avatars">
          {nonSelfAttendees.slice(0, 4).map((a) => (
            <AttendeeAvatar key={a.email} email={a.email} displayName={a.displayName} />
          ))}
          {nonSelfAttendees.length > 4 && (
            <span className="text-xs opacity-60">+{nonSelfAttendees.length - 4}</span>
          )}
        </div>
      )}
    </div>
  )
}

function AttendeeAvatar({
  email,
  displayName,
}: {
  email: string
  displayName?: string
}) {
  // Use Google's profile photo via people API URL pattern; fall back to initials
  const initial = (displayName ?? email)[0].toUpperCase()

  return (
    <div
      title={displayName ?? email}
      data-testid={`avatar-${email}`}
      className="w-4 h-4 rounded-full bg-white/60 border border-white flex items-center justify-center text-[8px] font-medium"
    >
      {initial}
    </div>
  )
}
