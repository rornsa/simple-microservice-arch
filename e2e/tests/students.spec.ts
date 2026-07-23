import { test, expect } from '@playwright/test';

test.describe('Students and Payments', () => {
    const demoEmail = 'admin@gmail.com';
    const demoPassword = '123456';

    test.beforeEach(async ({ page }) => {
        // Clear localStorage and login before each test
        await page.goto('/');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.getByPlaceholder('admin@example.com').fill(demoEmail);
        await page.getByPlaceholder('••••••••').fill(demoPassword);
        await page.getByRole('button', { name: 'Sign in' }).click();
        await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible();
    });

    test('should display list of students', async ({ page }) => {
        // Verify students list is visible
        await expect(page.locator('#students-list')).toBeVisible();
        // Verify at least one student card exists
        await expect(page.locator('[id^="student-"]').first()).toBeVisible();
    });

    test('should select a student and show payment panel', async ({ page }) => {
        // Click first student card
        const firstStudentCard = page.locator('[id^="student-"]').first();
        await firstStudentCard.click();
        // Verify payment panel is visible
        await expect(page.getByText('Initiate Payment', { exact: true })).toBeVisible();
        await expect(page.getByText('Payment History', { exact: true })).toBeVisible();
    });

    test('should refresh students list', async ({ page }) => {
        const refreshBtn = page.getByRole('button', { name: '↺ Refresh' }).first();
        await refreshBtn.click();
        // Verify list is still visible after refresh
        await expect(page.locator('#students-list')).toBeVisible();
    });
});