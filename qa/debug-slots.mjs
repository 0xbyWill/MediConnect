import { newBrowser, newContext, trackPage, login } from './lib.mjs';
const browser = await newBrowser();
const { context: s, events } = await newContext(browser);
const sp = await s.newPage();
trackPage(sp, events);
// capture availability responses
sp.on('response', async (res) => {
  const u = res.url();
  if (/availability|available_slots|doctor_availability|get_available/i.test(u)) {
    let body = '';
    try { body = (await res.text()).slice(0, 300); } catch {}
    console.log('RESP', res.status(), u.slice(0,120), '=>', body);
  }
});
await login(sp, 'secretaria');
await sp.locator('.app-sidebar-nav-button', { hasText: 'Agenda' }).click();
await sp.waitForTimeout(2500);

async function trySchedule(date) {
  await sp.getByRole('button', { name: /Novo Agendamento/i }).first().click();
  await sp.waitForTimeout(1200);
  const fv = await sp.$$eval('#agenda-medico option', o => { const x=o.find(e=>/Francisco Barreto/i.test(e.textContent)); return x?x.value:''; });
  await sp.locator('#agenda-medico').selectOption(fv);
  await sp.waitForTimeout(600);
  await sp.locator('#agenda-data').fill(date);
  await sp.waitForTimeout(6000);
  const opts = await sp.$$eval('#agenda-hora option', o=>o.map(x=>x.textContent));
  const disabled = await sp.locator('#agenda-hora').isDisabled();
  console.log(`DATE ${date} (weekday ${new Date(date+'T00:00:00').getDay()}): disabled=${disabled} opts=${JSON.stringify(opts)}`);
  await sp.getByRole('button', { name: /^Cancelar$/ }).first().click().catch(()=>{});
  await sp.waitForTimeout(800);
}

for (const d of ['2026-06-12','2026-06-15','2026-06-16','2026-06-17']) {
  await trySchedule(d);
}
await browser.close();
