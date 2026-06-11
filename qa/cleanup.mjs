import { newBrowser, newContext, trackPage, login } from './lib.mjs';
const browser = await newBrowser();
const { context, events } = await newContext(browser);
const page = await context.newPage();
trackPage(page, events);
await login(page, 'gestao');
await page.locator('.app-sidebar-nav-button', { hasText: 'Pacientes' }).click();
await page.waitForTimeout(2500);
const search = page.locator('input[placeholder*="Buscar paciente"]');
let deleted = 0;
for (let i = 0; i < 15; i++) {
  await search.fill('QA Teste Paciente');
  await page.waitForTimeout(1800);
  const delBtn = page.locator('button[title="Excluir"]').first();
  if (!(await delBtn.count())) break;
  await delBtn.click({ force: true }).catch(()=>{});
  await page.waitForTimeout(800);
  const confirm = page.locator('button:not([title]):has-text("Excluir")').last();
  if (await confirm.count()) { await confirm.click().catch(()=>{}); await page.waitForTimeout(3000); deleted++; }
  else break;
}
console.log('cleanup deleted:', deleted);
await browser.close();
