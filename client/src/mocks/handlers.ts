import { http, HttpResponse } from 'msw'
import { MOCK_USER, MOCK_EVENTS } from './data'

export const handlers = [
  // Auth
  http.get('/api/auth/me', () => HttpResponse.json(MOCK_USER)),

  // Calendar events
  http.get('/api/calendar/events', () =>
    HttpResponse.json({ events: MOCK_EVENTS })
  ),

  // Freebusy
  http.get('/api/calendar/freebusy', () =>
    HttpResponse.json({ calendars: { primary: { busy: [] } } })
  ),

  // Create event
  http.post('/api/calendar/events', async ({ request }) => {
    const url = new URL(request.url)
    return HttpResponse.json({
      id: `created-${Date.now()}`,
      summary: url.searchParams.get('title') ?? 'New Event',
      start: { dateTime: url.searchParams.get('start') },
      end: { dateTime: url.searchParams.get('end') },
    })
  }),

  // Health check
  http.get('/api/health', () => HttpResponse.json({ status: 'ok (mocked)' })),

  // Chat — returns a realistic mock SSE stream
  http.post('/api/chat', () =>
    new HttpResponse(
      [
        'data: {"type":"tool_start","tool_name":"list_events","tool_use_id":"tc1"}\n\n',
        'data: {"type":"tool_result","tool_name":"list_events","tool_use_id":"tc1","duration_ms":120}\n\n',
        'data: {"type":"text","delta":"You have "}\n\n',
        'data: {"type":"text","delta":"13 meetings"}\n\n',
        'data: {"type":"text","delta":" this week. Your best focus block is **Tuesday 10am–1pm**."}\n\n',
        'data: {"type":"done"}\n\n',
      ].join(''),
      {
        headers: {
          'Content-Type': 'text/event-stream',
          'X-Chat-Session-Id': 'mock-session-id',
        },
      }
    )
  ),

  // Insights — full structured response
  http.get('/api/insights', () =>
    HttpResponse.json({
      week_start: '2026-04-06',
      total_meetings: 13,
      at_a_glance: {
        total_meetings: 13,
        new_meetings: 5,
        avg_duration_mins: 45,
        longest_meeting_mins: 90,
        busiest_day: 'Tuesday',
      },
      time_breakdown: {
        total_meeting_mins: 585,
        focus_block_count: 2,
        back_to_back_count: 1,
        morning_meetings: 8,
        afternoon_meetings: 5,
      },
      meeting_quality: {
        no_agenda_count: 3,
        recurring_count: 7,
        one_off_count: 6,
        organized_count: 4,
        invited_count: 9,
        one_on_one_count: 5,
        group_count: 8,
      },
      top_people: [
        { email: 'alice@example.com', count: 5 },
        { email: 'bob@example.com', count: 3 },
      ],
      top_series: [
        { title: 'Weekly standup', count: 5, total_mins: 150 },
        { title: '1:1 with manager', count: 2, total_mins: 120 },
      ],
    })
  ),
]
