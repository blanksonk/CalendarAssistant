export interface AtAGlance {
  total_meetings: number
  new_meetings: number
  avg_duration_mins: number
  longest_meeting_mins: number
  busiest_day: string
}

export interface TimeBreakdown {
  total_meeting_mins: number
  focus_block_count: number
  back_to_back_count: number
  morning_meetings: number
  afternoon_meetings: number
}

export interface MeetingQuality {
  no_agenda_count: number
  recurring_count: number
  one_off_count: number
  organized_count: number
  invited_count: number
  one_on_one_count: number
  group_count: number
}

export interface TopPerson {
  email: string
  count: number
}

export interface TopSeries {
  title: string
  count: number
  total_mins: number
}

export interface InsightsData {
  week_start: string
  total_meetings: number
  at_a_glance: AtAGlance
  time_breakdown: TimeBreakdown
  meeting_quality: MeetingQuality
  top_people: TopPerson[]
  top_series: TopSeries[]
}

export async function fetchInsights(week?: string): Promise<InsightsData> {
  const params = week ? `?week=${week}` : ''
  const res = await fetch(`/api/insights${params}`, { credentials: 'include' })
  if (!res.ok) throw new Error(`Insights fetch failed: ${res.status}`)
  return res.json()
}
