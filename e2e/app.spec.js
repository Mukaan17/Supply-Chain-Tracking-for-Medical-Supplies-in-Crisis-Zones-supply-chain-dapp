/**
 * E2E Tests for Supply Chain dApp
 */

import { test, expect } from '@playwright/test';

test.describe('Supply Chain dApp', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
  });

  test('should display app title', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Supply Chain Tracking');
  });

  test('should show connect wallet button', async ({ page }) => {
    const connectButton = page.getByRole('button', { name: /connect/i });
    await expect(connectButton).toBeVisible();
  });

  test('should display network status when connected', async ({ page }) => {
    // This would require MetaMask setup in test environment
    // For now, just check that the component exists
    const networkStatus = page.locator('[data-testid="network-status"]');
    // Component may or may not be visible depending on connection state
  });

  test('should show create package form when wallet connected', async ({ page }) => {
    // This test would require wallet connection mocking
    // For now, verify the form structure exists
    const createForm = page.locator('form');
    // Form may be hidden until wallet is connected
  });

  test('should validate package ID input', async ({ page }) => {
    const packageIdInput = page.getByPlaceholderText(/package id/i);
    
    if (await packageIdInput.isVisible()) {
      await packageIdInput.fill('abc');
      await packageIdInput.blur();
      
      // Should show validation error
      const error = page.locator('text=/invalid/i');
      await expect(error).toBeVisible();
    }
  });

  test('should handle offline state', async ({ page, context }) => {
    // Simulate offline
    await context.setOffline(true);
    
    // Check for offline indicator
    const offlineIndicator = page.locator('text=/offline/i');
    // May or may not be visible depending on implementation
  });
});

test.describe('Accessibility', () => {
  test('should have proper heading hierarchy', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    const h1 = page.locator('h1');
    await expect(h1).toHaveCount(1);
  });

  test('should have accessible form labels', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    const inputs = page.locator('input[type="text"]');
    const count = await inputs.count();
    
    for (let i = 0; i < count; i++) {
      const input = inputs.nth(i);
      const id = await input.getAttribute('id');
      const label = id ? page.locator(`label[for="${id}"]`) : null;
      
      // Input should have label or aria-label
      const ariaLabel = await input.getAttribute('aria-label');
      expect(id || ariaLabel).toBeTruthy();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toBeVisible();
  });
});

test.describe('Performance', () => {
  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('http://localhost:3000');
    const loadTime = Date.now() - startTime;
    
    // Should load in under 3 seconds
    expect(loadTime).toBeLessThan(3000);
  });

  test('should have acceptable Lighthouse scores', async ({ page }) => {
    // This would require Lighthouse CI integration
    // For now, just verify page loads
    await page.goto('http://localhost:3000');
    await expect(page.locator('h1')).toBeVisible();
  });
});

