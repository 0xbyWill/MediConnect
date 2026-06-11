import { newBrowser, newContext, trackPage, login, shot } from './lib.mjs';
const out = {};
const browser = await newBrowser();

// Doctor sees appointment
const { context: m, events: me } = await newContext(browser);
const mp = await m.newPage();
trackPage(mp, me);
await login(mp, 'medico');
await mp.locator('.app-sidebar-nav-button', { hasText: 'Agenda' }).click();
await mp.waitForTimeout(3000);
await mp.getByRole('button', { name: /^Lista$/ }).first().click().catch(()=>{});
await mp.waitForTimeout(2500);
const body = await mp.locator('body').innerText();
out.doctorSeesAppt = body.includes('Alicia') && body.includes('08:00');
console.log('doctor sees Alicia 08:00:', out.doctorSeesAppt);
await shot(mp, 'b5-doctor-list');
await m.close();

// Secretary cancel cleanup
const { context: s, events: se } = await newContext(browser);
const sp = await s.newPage();
trackPage(sp, se);
await login(sp, 'secretaria');
await sp.locator('.app-sidebar-nav-button', { hasText: 'Agenda' }).click();
await sp.waitForTimeout(2500);
await sp.getByRole('button', { name: /^Lista$/ }).first().click().catch(()=>{});
await sp.waitForTimeout(2500);
let cancelled = 0;
for (let i=0;i<3;i++){
  const row = sp.locator('tr', { hasText: 'Alicia' }).filter({ hasText: '08:00' }).first();
  if (!(await row.count())) break;
  const cancelBtn = row.locator('button[title="Cancelar"]').first();
  if (!(await cancelBtn.count())) break;
  await cancelBtn.click().catch(()=>{});
  await sp.waitForTimeout(800);
  await sp.getByRole('button', { name: /Cancelar consulta/i }).click().catch(()=>{});
  await sp.waitForTimeout(3000);
  cancelled++;
  await sp.getByRole('button', { name: /^Lista$/ }).first().click().catch(()=>{});
  await sp.waitForTimeout(2000);
}
out.cancelled = cancelled;
console.log('cancelled appts:', cancelled);
await s.close();
await browser.close();
console.log(JSON.stringify(out));
