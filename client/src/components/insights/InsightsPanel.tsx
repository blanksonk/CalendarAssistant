import { useState, useEffect, useCallback } from 'react'
import { fetchInsights, InsightsData, TopPerson, TopSeries as TopSeriesData } from '../../api/insights'
import { WeeklyFocus } from './WeeklyFocus'
import { StatGrid } from './StatGrid'
import { TopPeople } from './TopPeople'
import { TopSeries } from './TopSeries'

type WeekToggle = 'this' | 'last'

function getWeekStart(which: WeekToggle): string {
  const today = new Date()
  const day = today.getDay()
  const monday = new Date(today)
  monday.setDate(today.getDate() - ((day + 6) % 7))
  if (which === 'last') {
    monday.setDate(monday.getDate() - 7)
  }
  return monday.toISOString().slice(0, 10)
}

interface InsightsPanelProps {
  onPromptAgent?: (message: string) => void
}

export function InsightsPanel({ onPromptAgent }: InsightsPanelProps) {
  const [week, setWeek] = useState<WeekToggle>('this')
  const [data, setData] = useState<InsightsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (which: WeekToggle) => {
    setIsLoading(true)
    setError(null)
    try {
      const weekStart = getWeekStart(which)
      const insights = await fetchInsights(weekStart)
      setData(insights)
    } catch (e) {
      setError('Failed to load insights. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load(week)
  }, [week])

  const handlePersonClick = (person: TopPerson) => {
    onPromptAgent?.(`Tell me about my meetings with ${person.email} this week`)
  }

  const handleSeriesClick = (series: TopSeriesData) => {
    onPromptAgent?.(`Tell me about the "${series.title}" recurring meeting series`)
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-4 flex flex-col gap-4">
      {/* Header + week toggle */}
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-sm font-semibold text-gray-800">Insights</h2>
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {(['this', 'last'] as WeekToggle[]).map((w) => (
            <button
              key={w}
              onClick={() => setWeek(w)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                week === w
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {w === 'this' ? 'This week' : 'Last week'}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Weekly Focus */}
      <WeeklyFocus
        narrative={data?.at_a_glance ? null : null}
        isLoading={isLoading}
      />

      {/* Stats grid */}
      {data ? (
        <StatGrid
          atAGlance={data.at_a_glance}
          timeBreakdown={data.time_breakdown}
          meetingQuality={data.meeting_quality}
          isLoading={isLoading}
        />
      ) : (
        <StatGrid
          atAGlance={{
            total_meetings: 0,
            new_meetings: 0,
            avg_duration_mins: 0,
            longest_meeting_mins: 0,
            busiest_day: '',
          }}
          timeBreakdown={{
            total_meeting_mins: 0,
            focus_block_count: 0,
            back_to_back_count: 0,
            morning_meetings: 0,
            afternoon_meetings: 0,
          }}
          meetingQuality={{
            no_agenda_count: 0,
            recurring_count: 0,
            one_off_count: 0,
            organized_count: 0,
            invited_count: 0,
            one_on_one_count: 0,
            group_count: 0,
          }}
          isLoading={isLoading}
        />
      )}

      {/* Top People */}
      <TopPeople
        people={data?.top_people ?? []}
        onPersonClick={handlePersonClick}
        isLoading={isLoading}
      />

      {/* Top Series */}
      <TopSeries
        series={data?.top_series ?? []}
        onSeriesClick={handleSeriesClick}
        isLoading={isLoading}
      />
    </div>
  )
}
