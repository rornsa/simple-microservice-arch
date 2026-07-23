import { test, expect } from '@playwright/test';

test.describe('Auth Flow', () => {
  // Demo credentials from UI
  const demoEmail = 'admin@gmail.com';
  const demoPassword = '123456';

  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test to ensure clean state
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
    });
    await page.reload();
    await page.waitForLoadState('domcontentloaded');
  });

  test('should login with demo credentials', async ({ page }) => {
    await page.goto('/');

    // Fill login form using placeholder
    await page.getByPlaceholder('admin@example.com').fill(demoEmail);
    await page.getByPlaceholder('••••••••').fill(demoPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Verify we're logged in (check for "Students" heading)
    await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible();
  });

  test('should logout', async ({ page }) => {
    // First login
    await page.goto('/');
    await page.getByPlaceholder('admin@example.com').fill(demoEmail);
    await page.getByPlaceholder('••••••••').fill(demoPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible();

    // Now logout
    await page.getByRole('button', { name: 'Sign out' }).click();

    // Verify we're logged out (back to login form)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });
});
