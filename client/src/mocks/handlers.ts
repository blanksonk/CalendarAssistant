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

  // Chat (stub — returns a static greeting stream)
  http.post('/api/chat', () =>
    new HttpResponse(
      'data: {"type":"text","delta":"Hi! I\'m your calendar assistant. Chat is coming soon — auth and calendar are live! Try switching between Week, Month, and Radial views."}\n\ndata: {"type":"done"}\n\n',
      { headers: { 'Content-Type': 'text/event-stream' } }
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
