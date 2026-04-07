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

  // Insights
  http.get('/api/insights', () =>
    HttpResponse.json({
      total_meetings: 13,
      focus_blocks: 2,
      back_to_back: 1,
      avg_duration_mins: 48,
    })
  ),
]
