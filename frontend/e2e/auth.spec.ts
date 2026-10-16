import { test, expect } from '@playwright/test'

test('sign in page renders', async ({ page }) => {
  await page.goto('/auth/sign-in')
  await expect(page.getByText('Welcome back')).toBeVisible()
  await expect(page.getByLabel('Email address')).toBeVisible()
})
