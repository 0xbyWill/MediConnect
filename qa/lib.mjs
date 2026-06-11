import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const BASE = 'https://medi-connect-virid.vercel.app';

export const USERS = {
  medico: { email: 'francisco.squad04@gmail.com', password: 'Teste@123', label: 'Médico' },
  secretaria: { email: 'secretaria.squad04@gmail.com', password: 'Teste@123', label: 'Secretária' },
  gestao: { email: 'hugo@popcode.com.br', password: 'hdoria', label: 'Gestor' },
  paciente: { email: 'patrickestrela@popcode.com', password: 'Teste@123', label: 'Paciente' },
};

export const DATA_BASE = '2026-06-12';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ART = join(__dirname, 'artifacts');
mkdirSync(ART, { recursive: true });

export async function newBrowser() {
  const browser = await chromium.launch({ headless: true });
  return browser;
}

export async function newContext(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const events = { consoleErrors: [], pageErrors: [], failedRequests: [], badResponses: [] };
  context.on('console', () => {});
  return { context, events };
}

export function trackPage(page, events) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') events.consoleErrors.push(msg.text().slice(0, 300));
  });
  page.on('pageerror', (err) => events.pageErrors.push(String(err).slice(0, 300)));
  page.on('requestfailed', (req) => {
    events.failedRequests.push(`${req.method()} ${req.url().slice(0, 160)} :: ${req.failure()?.errorText}`);
  });
  page.on('response', (res) => {
    const s = res.status();
    if (s >= 400) events.badResponses.push(`${s} ${res.request().method()} ${res.url().slice(0, 160)}`);
  });
}

export async function gotoLogin(page) {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  // Landing -> click "Entrar no Sistema"
  const enter = page.getByRole('button', { name: /Entrar no Sistema/i }).first();
  try {
    await enter.waitFor({ timeout: 8000 });
    await enter.click();
  } catch {
    // maybe already on login
  }
  await page.locator('#login-email').waitFor({ timeout: 15000 });
}

export async function login(page, role) {
  const u = USERS[role];
  await gotoLogin(page);
  await page.fill('#login-email', u.email);
  await page.fill('#login-password', u.password);
  await page.click('.login-submit');
  // Wait for either sidebar (success) or login error
  const result = await Promise.race([
    page.locator('.app-sidebar').waitFor({ timeout: 25000 }).then(() => 'ok').catch(() => null),
    page.locator('.login-error').waitFor({ timeout: 25000 }).then(() => 'error').catch(() => null),
  ]);
  await page.waitForTimeout(1500);
  if (result === 'error') {
    const msg = await page.locator('.login-error').innerText().catch(() => '');
    return { ok: false, error: msg };
  }
  const ok = await page.locator('.app-sidebar').count();
  return { ok: ok > 0 };
}

export async function getSidebar(page) {
  return await page.locator('.app-sidebar-nav-button .app-sidebar-label').allInnerTexts().catch(() => []);
}

export async function getTopbarRole(page) {
  // role label shown under user name in topbar
  const txt = await page.locator('.app-topbar').innerText().catch(() => '');
  return txt.replace(/\s+/g, ' ').trim();
}

export async function logout(page) {
  await page.click('.app-sidebar-logout').catch(() => {});
  await page.waitForTimeout(1500);
}

export async function shot(page, name) {
  const p = join(ART, name + '.png');
  await page.screenshot({ path: p, fullPage: false }).catch(() => {});
  return p;
}

export async function navTo(page, label) {
  const btn = page.locator('.app-sidebar-nav-button', { hasText: label }).first();
  await btn.click();
  await page.waitForTimeout(1800);
}

export function logBlock(title) {
  console.log('\n========================================');
  console.log(title);
  console.log('========================================');
}
