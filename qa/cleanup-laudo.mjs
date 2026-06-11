import { newBrowser, newContext, trackPage, login, navTo, shot } from './lib.mjs';

const browser = await newBrowser();
const { context, events } = await newContext(browser);
const page = await context.newPage();
trackPage(page, events);
await login(page, 'medico');
await navTo(page, 'Laudos');
await page.waitForTimeout(1200);
// aba "Todos" (tem badge com número), não o filtro de período
await page.getByRole('button', { name: /Todos\s+\d+/ }).first().click().catch(() => {});
await page.waitForTimeout(800);
await page.locator('input[placeholder="Buscar paciente/pedido..."]').fill('QA9').catch(() => {});
await page.waitForTimeout(1500);
const realRows = () => page.locator('table tbody tr:not(:has(td[colspan]))').count();
const rows = await realRows();
console.log('QA9 real rows found:', rows);
await shot(page, 'cleanup-laudo-before');

let deleted = 0;
for (let i = 0; i < 5; i++) {
  if (await realRows() === 0) break;
  const trash = page.locator('button[title="Excluir"]').first();
  if (await trash.count() === 0) { console.log('no trash button (delete blocked for released?)'); break; }
  await trash.click();
  await page.waitForTimeout(900);
  // o confirm está no modal: botão SEM title, texto exato "Excluir"
  const confirm = page.locator('button:not([title])').filter({ hasText: /^Excluir$/ }).last();
  const blocked = await page.locator('text=/justificativa|não é possível|bloquead/i').first().isVisible().catch(() => false);
  console.log('iter', i, 'modal confirm present:', await confirm.count(), '| blocked text:', blocked);
  if (await confirm.count() > 0) {
    await confirm.click();
    deleted++;
    await page.waitForTimeout(3000);
    await page.locator('input[placeholder="Buscar paciente/pedido..."]').fill('QA9').catch(() => {});
    await page.waitForTimeout(1500);
  } else break;
}
console.log('deleted:', deleted);
await page.locator('input[placeholder="Buscar paciente/pedido..."]').fill('QA9').catch(() => {});
await page.waitForTimeout(1200);
console.log('remaining QA9 real rows:', await realRows());
console.log('badResponses:', JSON.stringify(events.badResponses.filter(r => !r.includes('favicon')), null, 2));
console.log('consoleErrors:', JSON.stringify(events.consoleErrors.slice(0, 8), null, 2));
await browser.close();
