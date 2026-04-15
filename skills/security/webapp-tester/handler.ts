// ---------------------------------------------------------------------------
// Webapp Tester Skill — Generate test scripts and audit checklists
// ---------------------------------------------------------------------------

export default async function handler(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const action = input.action as string;

  switch (action) {
    case 'generate_tests': {
      const url = (input.url as string) || 'https://example.com';
      const description = (input.page_description as string) || 'web page';
      const interactions = (input.interactions as Interaction[]) || [];
      const framework = (input.framework as string) || 'playwright';

      const tests = framework === 'cypress'
        ? generateCypressTests(url, description, interactions)
        : generatePlaywrightTests(url, description, interactions);

      return {
        result: {
          framework,
          test_code: tests,
          test_count: countTests(tests),
          url,
          description,
          interaction_count: interactions.length,
        },
      };
    }

    case 'accessibility_check': {
      const description = (input.page_description as string) || '';
      const url = (input.url as string) || '';

      const checks = [
        { rule: 'Images have alt text', priority: 'critical', selector: 'img:not([alt])' },
        { rule: 'Form inputs have labels', priority: 'critical', selector: 'input:not([aria-label]):not([id])' },
        { rule: 'Buttons have accessible names', priority: 'critical', selector: 'button:empty:not([aria-label])' },
        { rule: 'Links have descriptive text', priority: 'high', selector: 'a:empty:not([aria-label])' },
        { rule: 'Colour contrast 4.5:1 min', priority: 'critical', check: 'manual' },
        { rule: 'Heading hierarchy (no skips)', priority: 'high', check: 'DOM inspection' },
        { rule: 'Focus indicators visible', priority: 'high', check: 'keyboard navigation' },
        { rule: 'ARIA roles used correctly', priority: 'high', check: 'axe-core scan' },
        { rule: 'Skip navigation link', priority: 'medium', selector: 'a[href="#main"], a[href="#content"]' },
        { rule: 'Language attribute on <html>', priority: 'medium', selector: 'html[lang]' },
        { rule: 'No auto-playing media', priority: 'medium', selector: 'video[autoplay], audio[autoplay]' },
        { rule: 'Touch targets ≥ 44x44px', priority: 'high', check: 'mobile viewport' },
      ];

      const playwrightA11y = `import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('accessibility scan for ${esc(description || url)}', async ({ page }) => {
  await page.goto('${esc(url)}');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});`;

      return {
        result: { checks, automated_test: playwrightA11y, standard: 'WCAG 2.1 AA' },
      };
    }

    case 'performance_checklist': {
      return {
        result: {
          checklist: [
            { area: 'Core Web Vitals', items: ['LCP < 2.5s', 'INP < 200ms', 'CLS < 0.1'] },
            { area: 'Loading', items: ['Gzip/Brotli compression', 'Image optimization (WebP/AVIF)', 'Lazy load below-fold images', 'Preload critical resources', 'Minimize render-blocking CSS/JS'] },
            { area: 'JavaScript', items: ['Bundle size < 250KB gzipped', 'Code splitting by route', 'Tree shaking unused exports', 'Defer non-critical scripts'] },
            { area: 'Caching', items: ['Cache-Control headers set', 'Service worker for offline', 'CDN for static assets', 'ETag / Last-Modified headers'] },
            { area: 'Network', items: ['HTTP/2 or HTTP/3 enabled', 'DNS prefetch for external domains', 'Connection preconnect', 'Minimize third-party scripts'] },
            { area: 'Rendering', items: ['Avoid layout thrashing', 'Use CSS containment', 'Virtualize long lists', 'requestAnimationFrame for animations'] },
          ],
          tools: ['Lighthouse', 'WebPageTest', 'Chrome DevTools Performance tab', 'Playwright trace viewer'],
        },
      };
    }

    case 'smoke_test': {
      const url = (input.url as string) || 'https://example.com';

      const test = `import { test, expect } from '@playwright/test';

test.describe('Smoke tests for ${esc(url)}', () => {
  test('page loads successfully', async ({ page }) => {
    const response = await page.goto('${esc(url)}');
    expect(response?.status()).toBeLessThan(400);
  });

  test('no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('${esc(url)}');
    await page.waitForLoadState('networkidle');
    expect(errors).toEqual([]);
  });

  test('page has title', async ({ page }) => {
    await page.goto('${esc(url)}');
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });

  test('no broken images', async ({ page }) => {
    await page.goto('${esc(url)}');
    const images = await page.$$('img');
    for (const img of images) {
      const src = await img.getAttribute('src');
      if (src) {
        const natural = await img.evaluate((el: HTMLImageElement) => el.naturalWidth);
        expect(natural, \`Image \${src} is broken\`).toBeGreaterThan(0);
      }
    }
  });

  test('page responds within 5s', async ({ page }) => {
    const start = Date.now();
    await page.goto('${esc(url)}');
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });
});`;

      return { result: { framework: 'playwright', test_code: test, test_count: 5 } };
    }

    default:
      return { error: `Unknown action "${action}". Available: generate_tests, accessibility_check, performance_checklist, smoke_test` };
  }
}

/* -------- Types -------- */

interface Interaction {
  action: string;
  selector?: string;
  value?: string;
  expected?: string;
}

/* -------- Helpers -------- */

function esc(s: string): string {
  return s.replace(/'/g, "\\'").replace(/\\/g, '\\\\');
}

function countTests(code: string): number {
  return (code.match(/\btest\(/g) || []).length;
}

function generatePlaywrightTests(url: string, description: string, interactions: Interaction[]): string {
  let code = `import { test, expect } from '@playwright/test';\n\n`;
  code += `test.describe('${esc(description)}', () => {\n`;
  code += `  test.beforeEach(async ({ page }) => {\n`;
  code += `    await page.goto('${esc(url)}');\n`;
  code += `  });\n\n`;

  code += `  test('page loads', async ({ page }) => {\n`;
  code += `    await expect(page).toHaveURL(/.*/);\n`;
  code += `  });\n\n`;

  for (let i = 0; i < interactions.length; i++) {
    const ix = interactions[i];
    code += `  test('interaction ${i + 1}: ${esc(ix.action)}', async ({ page }) => {\n`;
    switch (ix.action) {
      case 'click':
        code += `    await page.click('${esc(ix.selector || 'button')}');\n`;
        if (ix.expected) code += `    await expect(page.locator('${esc(ix.expected)}')).toBeVisible();\n`;
        break;
      case 'fill':
        code += `    await page.fill('${esc(ix.selector || 'input')}', '${esc(ix.value || '')}');\n`;
        break;
      case 'navigate':
        code += `    await page.click('${esc(ix.selector || 'a')}');\n`;
        if (ix.expected) code += `    await expect(page).toHaveURL(/${esc(ix.expected)}/);\n`;
        break;
      default:
        code += `    // Custom: ${ix.action}\n`;
    }
    code += `  });\n\n`;
  }

  code += `});\n`;
  return code;
}

function generateCypressTests(url: string, description: string, interactions: Interaction[]): string {
  let code = `describe('${esc(description)}', () => {\n`;
  code += `  beforeEach(() => {\n`;
  code += `    cy.visit('${esc(url)}');\n`;
  code += `  });\n\n`;

  code += `  it('page loads', () => {\n`;
  code += `    cy.url().should('include', '/');\n`;
  code += `  });\n\n`;

  for (let i = 0; i < interactions.length; i++) {
    const ix = interactions[i];
    code += `  it('interaction ${i + 1}: ${esc(ix.action)}', () => {\n`;
    switch (ix.action) {
      case 'click':
        code += `    cy.get('${esc(ix.selector || 'button')}').click();\n`;
        if (ix.expected) code += `    cy.get('${esc(ix.expected)}').should('be.visible');\n`;
        break;
      case 'fill':
        code += `    cy.get('${esc(ix.selector || 'input')}').type('${esc(ix.value || '')}');\n`;
        break;
      default:
        code += `    // Custom: ${ix.action}\n`;
    }
    code += `  });\n\n`;
  }

  code += `});\n`;
  return code;
}
