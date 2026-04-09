import { test, expect, type Page } from '@playwright/test'

/**
 * Full app E2E — uses page.route() to intercept all /api/* calls.
 * No real backend, no Google account, no service worker needed.
 * The full React app runs in a real Chromium browser against mock data.
 */

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const MOCK_USER = { id: 'user-1', email: 'kwesi@example.com', name: 'Kwesi Demo', picture: null }

/** Generate 3 mock events in the current week so they always show in the default view. */
function mockEvents() {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - now.getDay() + 1) // this Monday
  monday.setHours(0, 0, 0, 0)

  const evt = (offsetDays: number, hour: number, durationMins: number, title: string, attendees: string[]) => {
    const start = new Date(monday)
    start.setDate(monday.getDate() + offsetDays)
    start.setHours(hour, 0, 0, 0)
    const end = new Date(start)
    end.setMinutes(durationMins)
    return {
      id: `evt-${offsetDays}-${hour}`,
      summary: title,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees: attendees.map((email) => ({ email, self: email === MOCK_USER.email })),
      description: '',
    }
  }

  return [
    evt(0, 9, 30, 'Team standup', [MOCK_USER.email, 'alice@example.com']),
    evt(1, 14, 60, '1:1 with Alice', [MOCK_USER.email, 'alice@example.com']),
    evt(2, 10, 45, 'Product review', [MOCK_USER.email, 'bob@example.com', 'carol@example.com']),
  ]
}

const MOCK_INSIGHTS = {
  week_start: '2026-04-07',
  total_meetings: 3,
  at_a_glance: {
    total_meetings: 3,
    new_meetings: 1,
    avg_duration_mins: 45,
    longest_meeting_mins: 60,
    busiest_day: 'Tuesday',
  },
  time_breakdown: {
    total_meeting_mins: 135,
    focus_block_count: 2,
    back_to_back_count: 0,
    morning_meetings: 2,
    afternoon_meetings: 1,
  },
  meeting_quality: {
    no_agenda_count: 1,
    recurring_count: 1,
    one_off_count: 2,
    organized_count: 1,
    invited_count: 2,
    one_on_one_count: 1,
    group_count: 2,
  },
  top_people: [{ email: 'alice@example.com', count: 2 }],
  top_series: [],
}

const SSE_CHAT_RESPONSE = [
  `data: {"type":"text","delta":"You have 3 meetings this week."}\n\n`,
  `data: {"type":"done"}\n\n`,
].join('')

// ---------------------------------------------------------------------------
// Setup helper
// ---------------------------------------------------------------------------

async function setupMocks(page: Page) {
  await page.route('/api/auth/me', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_USER) })
  )
  await page.route('/api/calendar/events**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: mockEvents() }) })
  )
  await page.route('/api/calendar/freebusy**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ busy: [] }) })
  )
  await page.route('/api/insights**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_INSIGHTS) })
  )
  await page.route('/api/chat', (route) =>
    route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream', 'X-Chat-Session-Id': 'test-session-1' },
      body: SSE_CHAT_RESPONSE,
    })
  )
  await page.route('/api/people/search**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ results: [{ name: 'Alice Smith', email: 'alice@example.com' }] }),
    })
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe('App shell', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page)
    await page.goto('/')
    await expect(page.getByTestId('calendar-view')).toBeVisible({ timeout: 10000 })
  })

  test('renders calendar view and chat panel side by side', async ({ page }) => {
    await expect(page.getByTestId('calendar-view')).toBeVisible()
    await expect(page.getByTestId('chat-panel')).toBeVisible()
    await expect(page.getByTestId('stats-bar')).toBeVisible()
  })

  test('radial view is shown by default', async ({ page }) => {
    await expect(page.getByTestId('radial-view')).toBeVisible()
  })

  test('app header shows app name', async ({ page }) => {
    await expect(page.getByText('CalendarAssistant')).toBeVisible()
  })
})

test.describe('Calendar navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page)
    await page.goto('/')
    await expect(page.getByTestId('calendar-view')).toBeVisible({ timeout: 10000 })
  })

  test('switching to Calendar display shows week grid', async ({ page }) => {
    await page.getByTestId('display-toggle-calendar').click()
    await expect(page.getByTestId('week-grid')).toBeVisible()
    await expect(page.locator('[data-testid="radial-view"]')).not.toBeVisible()
  })

  test('time range toggle switches to month grid', async ({ page }) => {
    await page.getByTestId('display-toggle-calendar').click()
    await expect(page.getByTestId('week-grid')).toBeVisible()

    await page.getByTestId('time-toggle-month').click()
    await expect(page.getByTestId('month-grid')).toBeVisible()
    await expect(page.locator('[data-testid="week-grid"]')).not.toBeVisible()
  })

  test('prev/next navigation changes the range label', async ({ page }) => {
    const label = page.getByTestId('stats-bar').locator('span').filter({ hasText: /–|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/ }).first()
    const initial = await label.textContent()

    await page.getByTestId('next-btn').click()
    const next = await label.textContent()
    expect(next).not.toBe(initial)

    await page.getByTestId('prev-btn').click()
    await expect(label).toHaveText(initial!)
  })
})

test.describe('Tab switching', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page)
    await page.goto('/')
    await expect(page.getByTestId('calendar-view')).toBeVisible({ timeout: 10000 })
  })

  test('switching to Insights tab shows insights panel', async ({ page }) => {
    await page.getByTestId('main-tab-insights').click()
    await expect(page.getByTestId('insights-panel')).toBeVisible()
    await expect(page.locator('[data-testid="calendar-view"]')).not.toBeVisible()
  })

  test('switching back to Calendar tab restores calendar view', async ({ page }) => {
    await page.getByTestId('main-tab-insights').click()
    await page.getByTestId('main-tab-calendar').click()
    await expect(page.getByTestId('calendar-view')).toBeVisible()
    await expect(page.locator('[data-testid="insights-panel"]')).not.toBeVisible()
  })

  test('chat panel remains visible on both tabs', async ({ page }) => {
    await expect(page.getByTestId('chat-panel')).toBeVisible()
    await page.getByTestId('main-tab-insights').click()
    await expect(page.getByTestId('chat-panel')).toBeVisible()
  })
})

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    await setupMocks(page)
    await page.goto('/')
    await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 10000 })
  })

  test('proactive greeting appears on load', async ({ page }) => {
    await expect(page.getByTestId('chat-panel').getByText(/good morning|good afternoon|good evening/i)).toBeVisible()
  })

  test('sending a message shows the streamed response', async ({ page }) => {
    const input = page.getByRole('textbox', { name: /chat message/i })
    await input.fill('What is on my calendar?')
    await input.press('Enter')
    await expect(page.getByText('What is on my calendar?')).toBeVisible()
    await expect(page.getByText(/3 meetings this week/i)).toBeVisible({ timeout: 8000 })
  })

  test('@ mention shows contact dropdown', async ({ page }) => {
    const input = page.getByRole('textbox', { name: /chat message/i })
    await input.fill('@alice')
    // Trigger change event so the debounce fires
    await input.dispatchEvent('input')
    await expect(page.getByText('Alice Smith')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('alice@example.com')).toBeVisible()
  })
})

test.describe('Pending events (ghost flow)', () => {
  test('agent-proposed event appears as ghost and can be confirmed', async ({ page }) => {
    // Override chat route to return a propose_event SSE event
    const start = new Date()
    start.setHours(start.getHours() + 2, 0, 0, 0)
    const end = new Date(start)
    end.setMinutes(30)

    const proposedEvent = {
      id: 'ghost-1',
      title: 'Demo meeting',
      start: start.toISOString(),
      end: end.toISOString(),
      attendees: ['alice@example.com'],
    }

    const sseWithProposal = [
      `data: {"type":"text","delta":"I've proposed a meeting for you."}\n\n`,
      `data: {"type":"propose_event","id":"ghost-1","title":"Demo meeting","start":"${start.toISOString()}","end":"${end.toISOString()}","attendees":["alice@example.com"]}\n\n`,
      `data: {"type":"done"}\n\n`,
    ].join('')

    await setupMocks(page)
    await page.route('/api/chat', (route) =>
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'X-Chat-Session-Id': 'test-session-2' },
        body: sseWithProposal,
      })
    )

    await page.goto('/')
    await expect(page.getByTestId('calendar-view')).toBeVisible({ timeout: 10000 })

    // Send message to trigger proposal
    const input = page.getByRole('textbox', { name: /chat message/i })
    await input.fill('Schedule a meeting with Alice')
    await input.press('Enter')

    // Proposal card appears in chat
    await expect(page.getByText('Demo meeting')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('Proposed', { exact: true })).toBeVisible()

    // ChatPanel's SSE handler already added the event to the pending store,
    // so isPending=true → button says "Save to calendar". Click it.
    await page.getByRole('button', { name: /confirm event/i }).click()
    // Status transitions to 'added' → shows the "On calendar" indicator
    await expect(page.getByText(/on calendar/i)).toBeVisible({ timeout: 5000 })
  })
})
