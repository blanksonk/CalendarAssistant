import { test, expect } from '@playwright/test'

/**
 * Auth flow E2E — uses page.route() to mock /api/auth/me.
 * No real backend or Google account needed.
 */

test.describe('Auth flow', () => {
  test('unauthenticated user sees LoginPage with sign-in button', async ({ page }) => {
    await page.route('/api/auth/me', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Not authenticated' }) })
    )
    await page.goto('/')
    await expect(page.getByTestId('google-signin-btn')).toBeVisible()
    await expect(page.getByText('CalendarAssistant')).toBeVisible()
  })

  test('sign-in button triggers navigation to /api/auth/google', async ({ page }) => {
    await page.route('/api/auth/me', (route) =>
      route.fulfill({ status: 401, contentType: 'application/json', body: JSON.stringify({ detail: 'Not authenticated' }) })
    )
    // Intercept the redirect that clicking sign-in triggers
    await page.route('/api/auth/google', (route) => route.fulfill({ status: 200, body: 'ok' }))

    await page.goto('/')
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/api/auth/google')),
      page.getByTestId('google-signin-btn').click(),
    ])
    expect(request.url()).toContain('/api/auth/google')
  })

  test('authenticated user does not see LoginPage', async ({ page }) => {
    await page.route('/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'user-1', email: 'test@example.com', name: 'Test User', picture: null }),
      })
    )
    await page.route('/api/calendar/events**', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ events: [] }) })
    )
    await page.goto('/')
    await expect(page.getByTestId('google-signin-btn')).not.toBeVisible()
    await expect(page.getByTestId('calendar-view')).toBeVisible()
  })
})
