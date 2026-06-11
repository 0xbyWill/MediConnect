import { newBrowser, newContext, trackPage, login, navTo, shot } from './lib.mjs';

const browser = await newBrowser();
const { context, events } = await newContext(browser);
const page = await context.newPage();
trackPage(page, events);
await login(page, 'medico');
await navTo(page, 'Laudos');
await page.waitForTimeout(1500);
await page.getByRole('button', { name: /Novo Laudo/i }).first().click();
await page.waitForTimeout(1500);

const search = page.locator('input[placeholder="Buscar paciente..."]');
console.log('search count:', await search.count());
await search.first().click();
await search.first().fill('a');
await page.waitForTimeout(1500);
await shot(page, 'debug9-dropdown');

// dump siblings
const sib = await page.evaluate(() => {
  const inp = document.querySelector('input[placeholder="Buscar paciente..."]');
  if (!inp) return 'no input';
  const parent = inp.parentElement;
  return parent ? parent.outerHTML.slice(0, 1500) : 'no parent';
});
console.log('PARENT HTML:\n', sib);

const absButtons = await page.locator('div[style*="position: absolute"] button').count();
console.log('abs buttons:', absButtons);
await browser.close();
