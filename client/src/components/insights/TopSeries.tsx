import { TopSeries as TopSeriesData } from '../../api/insights'

interface TopSeriesProps {
  series: TopSeriesData[]
  onSeriesClick?: (series: TopSeriesData) => void
  isLoading?: boolean
}

function formatMins(mins: number): string {
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

export function TopSeries({ series, onSeriesClick, isLoading }: TopSeriesProps) {
  return (
    <section aria-label="Top meeting series" className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Top meeting series
      </h4>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 h-4 bg-gray-200 rounded" />
              <div className="w-12 h-4 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      ) : series.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No recurring meetings found this week.</p>
      ) : (
        <ol className="space-y-2">
          {series.map((s, i) => (
            <li key={s.title}>
              <button
                onClick={() => onSeriesClick?.(s)}
                className="w-full flex items-center gap-3 hover:bg-gray-50 rounded-lg px-1 py-1.5 transition-colors text-left"
                aria-label={`${s.title}, ${s.count} meetings, ${formatMins(s.total_mins)} total`}
              >
                <span className="text-xs text-gray-400 w-4 shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 truncate">{s.title}</p>
                  <p className="text-xs text-gray-400">{s.count}× · {formatMins(s.total_mins)} total</p>
                </div>
                {/* Mini bar representing time relative to top series */}
                <div className="w-16 h-1.5 rounded-full bg-gray-100 shrink-0">
                  <div
                    className="h-full rounded-full bg-blue-400"
                    style={{
                      width: `${Math.min(100, (s.total_mins / (series[0]?.total_mins || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
