import { newBrowser, newContext, trackPage, gotoLogin, login, logout, getSidebar, getTopbarRole, shot, BASE, USERS, logBlock } from './lib.mjs';

const out = {};

const browser = await newBrowser();

// ---- BLOCK 0 ----
logBlock('BLOCO 0 — Primeira impressão e acentuação');
{
  const { context, events } = await newContext(browser);
  const page = await context.newPage();
  trackPage(page, events);

  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  const landingText = await page.locator('body').innerText();
  await shot(page, 'b0-landing');

  // accent words to verify
  const expectWords = ['Gestão', 'Saúde', 'Comunicação', 'Relatórios', 'Configurações'];
  const accentFindings = {};
  for (const w of expectWords) accentFindings[w] = landingText.includes(w);
  // detect mojibake / broken accents
  const mojibake = /Ã|Â|�|GestÃ|SaÃºde/.test(landingText);
  console.log('Landing accent words present:', accentFindings);
  console.log('Mojibake on landing:', mojibake);

  // login page accent: "Não tem uma conta"
  await gotoLogin(page);
  await page.waitForTimeout(1000);
  const loginText = await page.locator('body').innerText();
  const naoTem = /Não tem uma conta/i.test(loginText);
  console.log('Login "Não tem uma conta" present:', naoTem);
  await shot(page, 'b0-login');

  // Block 0.3 — refresh on internal route
  // Login first then try deep link refresh
  const r = await login(page, 'secretaria');
  console.log('Login secretaria for refresh test:', r);
  // Try direct deep-link to /agenda and refresh
  const resp = await page.goto(BASE + '/agenda', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);
  const status = resp ? resp.status() : 'n/a';
  const afterText = (await page.locator('body').innerText()).slice(0, 400);
  const is404 = /404|NOT_FOUND|not found|page could not be found/i.test(afterText);
  console.log('Deeplink /agenda HTTP status:', status, '| looks like 404:', is404);
  await shot(page, 'b0-deeplink-agenda');

  out.block0 = { accentFindings, mojibake, naoTem, deeplinkStatus: status, deeplink404: is404, events };
  await context.close();
}

// ---- BLOCK 1 ----
logBlock('BLOCO 1 — Login e RBAC por perfil');
out.block1 = {};
for (const role of ['medico', 'secretaria', 'gestao', 'paciente']) {
  const { context, events } = await newContext(browser);
  const page = await context.newPage();
  trackPage(page, events);
  const r = await login(page, role);
  let sidebar = [], topbar = '';
  if (r.ok) {
    await page.waitForTimeout(2500);
    sidebar = await getSidebar(page);
    topbar = await getTopbarRole(page);
    await shot(page, `b1-${role}`);
  }
  // logout test
  let logoutOk = false, afterLogoutText = '';
  if (r.ok) {
    await logout(page);
    afterLogoutText = (await page.locator('body').innerText()).slice(0, 200);
    logoutOk = /Entrar no Sistema|Bem-vindo de volta|E-mail/i.test(afterLogoutText) || (await page.locator('#login-email').count()) > 0 || /MediConnect/.test(afterLogoutText);
  }
  console.log(`\n[${role}] login:`, r.ok ? 'OK' : 'FAIL ' + (r.error || ''));
  console.log(`[${role}] sidebar:`, sidebar.join(' | '));
  console.log(`[${role}] topbar:`, topbar.slice(0, 160));
  console.log(`[${role}] logout returns to login/landing:`, logoutOk);
  console.log(`[${role}] console errors:`, events.consoleErrors.length, '| bad responses:', events.badResponses.length);
  out.block1[role] = { login: r, sidebar, topbar, logoutOk, errors: events.consoleErrors.slice(0, 5), bad: events.badResponses.slice(0, 8) };
  await context.close();
}

await browser.close();
console.log('\n\n===== JSON RESULTS =====');
console.log(JSON.stringify(out, null, 2));
