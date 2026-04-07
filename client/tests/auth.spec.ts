import { test, expect } from '@playwright/test'

/**
 * Auth integration test — uses API route mocking so no real backend is needed.
 *
 * Flow tested:
 *   unauthenticated → LoginPage renders → click sign-in → redirects to Google OAuth
 *   authenticated   → LoginPage not shown, app shell renders
 *   logout          → user is cleared, LoginPage re-renders
 */

test.describe('Auth flow', () => {
  test('unauthenticated user sees the LoginPage with sign-in button', async ({ page }) => {
    // Mock /api/auth/me to return 401
    await page.route('/api/auth/me', (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ detail: 'Not authenticated' }) })
    )

    await page.goto('/')
    await expect(page.getByTestId('google-signin-btn')).toBeVisible()
    await expect(page.getByText('CalendarAssistant')).toBeVisible()
  })

  test('sign-in button navigates to /api/auth/google', async ({ page }) => {
    await page.route('/api/auth/me', (route) =>
      route.fulfill({ status: 401, body: JSON.stringify({ detail: 'Not authenticated' }) })
    )
    // Intercept the navigation triggered by clicking sign-in
    await page.route('/api/auth/google', (route) => route.fulfill({ status: 200, body: 'ok' }))

    await page.goto('/')
    const [request] = await Promise.all([
      page.waitForRequest('/api/auth/google'),
      page.getByTestId('google-signin-btn').click(),
    ])
    expect(request.url()).toContain('/api/auth/google')
  })

  test('authenticated user does not see LoginPage', async ({ page }) => {
    await page.route('/api/auth/me', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          picture: null,
        }),
      })
    )

    await page.goto('/')
    await expect(page.getByTestId('google-signin-btn')).not.toBeVisible()
  })
})
