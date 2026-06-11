import { newBrowser, newContext, trackPage, login, shot, DATA_BASE } from './lib.mjs';
const WD = new Date(`${DATA_BASE}T00:00:00`).getDay();
console.log('weekday of', DATA_BASE, '=', WD);

const browser = await newBrowser();

// medico: save availability and dump modal text
const { context: m, events: me } = await newContext(browser);
const mp = await m.newPage();
trackPage(mp, me);
await login(mp, 'medico');
await mp.locator('.app-sidebar-nav-button', { hasText: 'Agenda' }).click();
await mp.waitForTimeout(2500);
await mp.getByRole('button', { name: /Disponibilidade/i }).first().click();
await mp.waitForTimeout(1500);
await mp.locator('#availability-weekday').selectOption(String(WD));
await mp.locator('#availability-start').fill('08:00');
await mp.locator('#availability-end').fill('12:00');
const cb = mp.locator('#availability-active');
if (!(await cb.isChecked())) await cb.check();
console.log('slot options:', await mp.$$eval('#availability-slot option', o=>o.map(x=>x.value)));
await mp.getByRole('button', { name: /Salvar disponibilidade|Salvar altera/i }).click();
await mp.waitForTimeout(4500);
const modalText = await mp.locator('div[style*="position: fixed"]').last().innerText().catch(()=> '');
console.log('=== availability modal text ===\n', modalText.slice(0, 900));
await shot(mp, 'dbg-avail');
await m.close();

// secretary: open new agendamento, select Francisco + date, dump
const { context: s, events: se } = await newContext(browser);
const sp = await s.newPage();
trackPage(sp, se);
await login(sp, 'secretaria');
await sp.locator('.app-sidebar-nav-button', { hasText: 'Agenda' }).click();
await sp.waitForTimeout(2500);
await sp.getByRole('button', { name: /Novo Agendamento/i }).first().click();
await sp.waitForTimeout(1500);
const docOptions = await sp.$$eval('#agenda-medico option', o=>o.map(x=>({v:x.value,t:x.textContent})));
console.log('doctor options count:', docOptions.length);
console.log('francisco option:', JSON.stringify(docOptions.find(o=>/Francisco/i.test(o.t))));
const fv = (docOptions.find(o=>/Francisco/i.test(o.t))||{}).v;
if (fv) await sp.locator('#agenda-medico').selectOption(fv);
await sp.waitForTimeout(800);
await sp.locator('#agenda-data').fill(DATA_BASE);
await sp.waitForTimeout(3500);
const horaDisabled = await sp.locator('#agenda-hora').isDisabled();
const horaOpts = await sp.$$eval('#agenda-hora option', o=>o.map(x=>({v:x.value,t:x.textContent,d:x.disabled})));
console.log('hora disabled:', horaDisabled);
console.log('hora options:', JSON.stringify(horaOpts));
// any helper/error text near hora
const modalText2 = await sp.locator('div[style*="position: fixed"]').last().innerText().catch(()=> '');
console.log('=== agendamento modal text ===\n', modalText2.replace(/\s+/g,' ').slice(0, 600));
await shot(sp, 'dbg-sched');
await s.close();

await browser.close();
