import type { AtAGlance, MeetingQuality, TimeBreakdown } from '../../api/insights'

interface StatCardProps {
  label: string
  value: string | number
  sub?: string
  highlight?: boolean
}

function StatCard({ label, value, sub, highlight }: StatCardProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`rounded-xl p-3 flex flex-col gap-1 ${
        highlight ? 'bg-blue-50 border border-blue-100' : 'bg-white border border-gray-100'
      } shadow-sm`}
    >
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-xl font-bold text-gray-800">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

interface StatGridProps {
  atAGlance: AtAGlance
  timeBreakdown: TimeBreakdown
  meetingQuality: MeetingQuality
  isLoading?: boolean
}

export function StatGrid({ atAGlance, timeBreakdown, meetingQuality, isLoading }: StatGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 animate-pulse">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-200 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* At a glance */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          At a glance
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="Total meetings"
            value={atAGlance.total_meetings}
            sub={`${atAGlance.new_meetings} new`}
          />
          <StatCard
            label="Avg duration"
            value={formatMins(atAGlance.avg_duration_mins)}
            sub={`Longest: ${formatMins(atAGlance.longest_meeting_mins)}`}
          />
          <StatCard
            label="Busiest day"
            value={atAGlance.busiest_day || '—'}
          />
          <StatCard
            label="New meetings"
            value={atAGlance.new_meetings}
          />
        </div>
      </div>

      {/* Time breakdown */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Time breakdown
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="Meeting time"
            value={formatMins(timeBreakdown.total_meeting_mins)}
          />
          <StatCard
            label="Focus blocks"
            value={timeBreakdown.focus_block_count}
            sub="≥90 min uninterrupted"
            highlight={timeBreakdown.focus_block_count > 0}
          />
          <StatCard
            label="Back-to-back"
            value={timeBreakdown.back_to_back_count}
            sub="<5 min gap"
          />
          <StatCard
            label="Morning / Afternoon"
            value={`${timeBreakdown.morning_meetings} / ${timeBreakdown.afternoon_meetings}`}
          />
        </div>
      </div>

      {/* Meeting quality */}
      <div>
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Meeting quality
        </h4>
        <div className="grid grid-cols-2 gap-2">
          <StatCard
            label="No agenda"
            value={meetingQuality.no_agenda_count}
            sub="missing description"
          />
          <StatCard
            label="Recurring / One-off"
            value={`${meetingQuality.recurring_count} / ${meetingQuality.one_off_count}`}
          />
          <StatCard
            label="Organized / Invited"
            value={`${meetingQuality.organized_count} / ${meetingQuality.invited_count}`}
          />
          <StatCard
            label="1:1 / Group"
            value={`${meetingQuality.one_on_one_count} / ${meetingQuality.group_count}`}
          />
        </div>
      </div>
    </div>
  )
}
