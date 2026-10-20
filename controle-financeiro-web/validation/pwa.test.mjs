import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.PLANEJA_VALIDATION_URL || 'http://127.0.0.1:4174/');
  await page.locator('form').getByRole('button', { name: 'Entrar', exact: true }).waitFor();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await page.locator('form').getByRole('button', { name: 'Entrar', exact: true }).waitFor();
  const names = await page.evaluate(() => caches.keys());
  assert.ok(!names.includes('auth-cache') && !names.includes('firestore-cache'));
  assert.equal(errors.length, 0, errors.join('\n'));
  console.log('PASS: build publicado inicia, service worker controla, recarrega offline e não guarda cache de autenticação/Firestore');
} finally { await browser.close(); }
