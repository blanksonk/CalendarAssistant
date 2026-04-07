import { test, expect } from '@playwright/test'

/**
 * Full app E2E integration test — uses MSW mock service worker so no real
 * backend or credentials are needed. The dev server must be running.
 *
 * Flow tested:
 *   load → calendar renders → chat panel visible → send message → response appears
 *   → switch to Insights tab → insights data renders
 *   → switch back to Calendar → toggle display modes → prev/next navigation
 */

test.describe('App integration', () => {
  test.beforeEach(async ({ page }) => {
    // MSW intercepts all API calls automatically via service worker
    await page.goto('/')
    // Wait for the app shell to appear (authenticated state via MSW mock)
    await expect(page.getByText('CalendarAssistant')).toBeVisible({ timeout: 10000 })
  })

  test('authenticated user sees the app shell with calendar and chat', async ({ page }) => {
    await expect(page.getByTestId('calendar-view')).toBeVisible()
    await expect(page.getByTestId('chat-panel')).toBeVisible()
    await expect(page.getByTestId('stats-bar')).toBeVisible()
  })

  test('radial view is shown by default', async ({ page }) => {
    await expect(page.getByTestId('radial-view')).toBeVisible()
  })

  test('stats bar shows meeting count from mock data', async ({ page }) => {
    // 13 mock events — stats bar should show > 0 meetings
    const stat = page.getByTestId('stat-meeting-count')
    await expect(stat).toBeVisible()
    const text = await stat.textContent()
    expect(Number(text)).toBeGreaterThan(0)
  })

  test('switching to Calendar display shows week grid', async ({ page }) => {
    await page.getByTestId('display-toggle-calendar').click()
    await expect(page.getByTestId('week-grid')).toBeVisible()
    await expect(page.queryByTestId?.('radial-view') ?? page.locator('[data-testid="radial-view"]')).not.toBeVisible()
  })

  test('time range toggle switches between week and month grid', async ({ page }) => {
    await page.getByTestId('display-toggle-calendar').click()
    await expect(page.getByTestId('week-grid')).toBeVisible()

    await page.getByTestId('time-toggle-month').click()
    await expect(page.getByTestId('month-grid')).toBeVisible()
    await expect(page.locator('[data-testid="week-grid"]')).not.toBeVisible()
  })

  test('prev/next navigation updates the range label', async ({ page }) => {
    const label = page.getByTestId('stats-bar').locator('span.text-sm.font-medium')
    const initialLabel = await label.textContent()

    await page.getByTestId('next-btn').click()
    const nextLabel = await label.textContent()
    expect(nextLabel).not.toBe(initialLabel)

    await page.getByTestId('prev-btn').click()
    await expect(label).toHaveText(initialLabel!)
  })

  test('switching to Insights tab shows the insights panel', async ({ page }) => {
    await page.getByTestId('main-tab-insights').click()
    await expect(page.getByTestId('insights-panel')).toBeVisible()
    await expect(page.locator('[data-testid="calendar-view"]')).not.toBeVisible()
  })

  test('insights panel loads mock data (meeting count)', async ({ page }) => {
    await page.getByTestId('main-tab-insights').click()
    // The mock returns total_meetings: 13
    await expect(page.getByText('13')).toBeVisible({ timeout: 5000 })
  })

  test('chat panel is visible on both Calendar and Insights tabs', async ({ page }) => {
    await expect(page.getByTestId('chat-panel')).toBeVisible()
    await page.getByTestId('main-tab-insights').click()
    await expect(page.getByTestId('chat-panel')).toBeVisible()
  })

  test('sending a chat message triggers a response', async ({ page }) => {
    const input = page.locator('textarea, input[type="text"]').last()
    await input.fill('What is on my calendar?')
    await input.press('Enter')

    // MSW streams a mock response mentioning "13 meetings"
    await expect(page.getByText(/13 meetings/i)).toBeVisible({ timeout: 8000 })
  })

  test('switching back to Calendar tab restores calendar view', async ({ page }) => {
    await page.getByTestId('main-tab-insights').click()
    await expect(page.getByTestId('insights-panel')).toBeVisible()

    await page.getByTestId('main-tab-calendar').click()
    await expect(page.getByTestId('calendar-view')).toBeVisible()
    await expect(page.locator('[data-testid="insights-panel"]')).not.toBeVisible()
  })
})
