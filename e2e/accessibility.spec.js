/**
 * Accessibility E2E Tests
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Accessibility Tests', () => {
  test('should not have any automatically detectable accessibility issues', async ({
    page,
  }) => {
    await page.goto('http://localhost:3000');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test('should have proper color contrast', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .analyze();

    const contrastViolations = accessibilityScanResults.violations.filter(
      (v) => v.id === 'color-contrast'
    );
    expect(contrastViolations).toEqual([]);
  });

  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('http://localhost:3000');

    const buttons = page.locator('button');
    const count = await buttons.count();

    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const text = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      const ariaLabelledBy = await button.getAttribute('aria-labelledby');

      // Button should have accessible name
      expect(text || ariaLabel || ariaLabelledBy).toBeTruthy();
    }
  });

  test('should support screen readers', async ({ page }) => {
    await page.goto('http://localhost:3000');

    // Check for semantic HTML
    const main = page.locator('main, [role="main"]');
    await expect(main.first()).toBeVisible();

    // Check for landmarks
    const landmarks = page.locator('header, nav, main, footer, [role="banner"], [role="navigation"], [role="contentinfo"]');
    const landmarkCount = await landmarks.count();
    expect(landmarkCount).toBeGreaterThan(0);
  });
});

