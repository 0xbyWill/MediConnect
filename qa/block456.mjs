import { newBrowser, newContext, trackPage, login, shot, logBlock, DATA_BASE } from './lib.mjs';

const WD = new Date(`${DATA_BASE}T00:00:00`).getDay(); // weekday of base date
const NOAVAIL_DATE = '2026-06-13'; // Saturday (likely no availability)
const out = { baseDate: DATA_BASE, weekday: WD, steps: {} };

const browser = await newBrowser();

// ---------- BLOCK 4: doctor availability ----------
logBlock('BLOCO 4 — Disponibilidade do médico (Francisco)');
{
  const { context, events } = await newContext(browser);
  const page = await context.newPage();
  trackPage(page, events);
  await login(page, 'medico');
  await page.locator('.app-sidebar-nav-button', { hasText: 'Agenda' }).click();
  await page.waitForTimeout(2500);
  await page.getByRole('button', { name: /Disponibilidade/i }).first().click();
  await page.waitForTimeout(1500);
  // set faixa
  await page.locator('#availability-weekday').selectOption(String(WD));
  await page.locator('#availability-type').selectOption('presencial');
  await page.locator('#availability-start').fill('08:00');
  await page.locator('#availability-end').fill('12:00');
  await page.locator('#availability-slot').selectOption({ index: 0 }).catch(()=>{});
  const activeCb = page.locator('#availability-active');
  if (!(await activeCb.isChecked())) await activeCb.check();
  await shot(page, 'b4-availability-form');
  await page.getByRole('button', { name: /Salvar disponibilidade|Salvar altera/i }).click();
  await page.waitForTimeout(4000);
  const listText = await page.locator('text=Disponibilidades cadastradas').locator('xpath=ancestor::*[1]').innerText().catch(()=> '');
  out.steps.availabilitySaved = /08:00/.test(listText) || /Ativa/.test(listText);
  console.log('[4] availability saved/listed:', out.steps.availabilitySaved);
  console.log('   list snippet:', listText.replace(/\s+/g,' ').slice(0,260));
  await shot(page, 'b4-availability-list');
  out.b4events = { bad: events.badResponses.slice(0,8) };
  await context.close();
}

// ---------- get a real patient name as secretary ----------
let patientName = '';
const { context: sctx, events: sevents } = await newContext(browser);
const spage = await sctx.newPage();
trackPage(spage, sevents);
await login(spage, 'secretaria');
await spage.locator('.app-sidebar-nav-button', { hasText: 'Pacientes' }).click();
await spage.waitForTimeout(3000);
const firstName = await spage.locator('table tbody tr td button').first().innerText().catch(()=> '');
patientName = firstName.trim();
console.log('Using patient:', patientName);
out.patient = patientName;

// ---------- BLOCK 5A: secretary schedules ----------
logBlock('BLOCO 5A — Secretária agenda em horário livre');
await spage.locator('.app-sidebar-nav-button', { hasText: 'Agenda' }).click();
await spage.waitForTimeout(2500);
await spage.getByRole('button', { name: /Novo Agendamento/i }).first().click();
await spage.waitForTimeout(1500);
// pick patient
await spage.locator('#agenda-paciente-search').fill(patientName.split(' ')[0] || patientName);
await spage.waitForTimeout(1500);
await spage.locator('div[style*="overflow"] button', { hasText: patientName.split(' ')[0] || patientName }).first().click().catch(async ()=>{
  await spage.locator('button', { hasText: patientName }).first().click().catch(()=>{});
});
await spage.waitForTimeout(800);
// pick doctor Francisco
await spage.locator('#agenda-medico').selectOption({ label: /Francisco/ }).catch(async ()=> {
  // fallback: choose by partial via evaluate
  const val = await spage.$$eval('#agenda-medico option', opts => { const o = opts.find(x=>/Francisco/i.test(x.textContent)); return o? o.value : ''; });
  if (val) await spage.locator('#agenda-medico').selectOption(val);
});
await spage.waitForTimeout(800);
await spage.locator('#agenda-data').fill(DATA_BASE);
await spage.waitForTimeout(2500);
// read slot options
const slotOpts = await spage.$$eval('#agenda-hora option', opts => opts.map(o => ({ v: o.value, t: o.textContent, disabled: o.disabled })));
out.steps.slotsGenerated = slotOpts.filter(o=>o.v).map(o=>o.t);
console.log('[5A] slots offered:', JSON.stringify(out.steps.slotsGenerated));
await shot(page=spage, 'b5-slots');
// choose first free slot
const firstFree = slotOpts.find(o => o.v && !o.disabled);
let bookedSlot = null;
if (firstFree) {
  await spage.locator('#agenda-hora').selectOption(firstFree.v);
  bookedSlot = firstFree.v;
  await spage.getByRole('button', { name: /^Salvar$/ }).click();
  await spage.waitForTimeout(5000);
}
out.steps.bookedSlot = bookedSlot;
// verify appears in agenda
const agendaText = await spage.locator('body').innerText();
out.steps.apptVisibleSecretary = bookedSlot ? agendaText.includes(bookedSlot) : false;
console.log('[5A] booked slot:', bookedSlot, '| visible:', out.steps.apptVisibleSecretary);
await shot(spage, 'b5-after-book');

// ---------- BLOCK 6: conflict + out-of-availability ----------
logBlock('BLOCO 6 — Casos de erro de agendamento');
await spage.getByRole('button', { name: /Novo Agendamento/i }).first().click();
await spage.waitForTimeout(1200);
await spage.locator('#agenda-paciente-search').fill(patientName.split(' ')[0] || patientName);
await spage.waitForTimeout(1200);
await spage.locator('button', { hasText: patientName.split(' ')[0] || patientName }).first().click().catch(()=>{});
await spage.waitForTimeout(500);
const val2 = await spage.$$eval('#agenda-medico option', opts => { const o = opts.find(x=>/Francisco/i.test(x.textContent)); return o? o.value : ''; });
if (val2) await spage.locator('#agenda-medico').selectOption(val2);
await spage.locator('#agenda-data').fill(DATA_BASE);
await spage.waitForTimeout(2500);
const slotOpts2 = await spage.$$eval('#agenda-hora option', opts => opts.map(o => ({ v: o.value, t: o.textContent, disabled: o.disabled })));
const bookedNowDisabled = slotOpts2.find(o => o.v === bookedSlot);
out.steps.conflictSlotMarked = bookedNowDisabled ? { text: bookedNowDisabled.t, disabled: bookedNowDisabled.disabled } : null;
console.log('[6.1] booked slot now in dropdown:', JSON.stringify(out.steps.conflictSlotMarked));
// out-of-availability date
await spage.locator('#agenda-data').fill(NOAVAIL_DATE);
await spage.waitForTimeout(2500);
const slotOpts3 = await spage.$$eval('#agenda-hora option', opts => opts.map(o => ({ v: o.value, t: o.textContent })));
const horaDisabled = await spage.locator('#agenda-hora').isDisabled();
out.steps.outOfAvailability = { placeholder: slotOpts3[0]?.t, disabled: horaDisabled, count: slotOpts3.filter(o=>o.v).length };
console.log('[6.2] out-of-availability:', JSON.stringify(out.steps.outOfAvailability));
await shot(spage, 'b6-no-availability');
await spage.getByRole('button', { name: /^Cancelar$/ }).first().click().catch(()=>{});

// ---------- BLOCK 5A.2: doctor sees the appointment ----------
const { context: mctx, events: mevents } = await newContext(browser);
const mpage = await mctx.newPage();
trackPage(mpage, mevents);
await login(mpage, 'medico');
await mpage.locator('.app-sidebar-nav-button', { hasText: 'Agenda' }).click();
await mpage.waitForTimeout(3000);
const docText = await mpage.locator('body').innerText();
out.steps.apptVisibleDoctor = bookedSlot ? docText.includes(bookedSlot) : false;
console.log('[5A.2] appointment visible for doctor:', out.steps.apptVisibleDoctor);
await shot(mpage, 'b5-doctor-view');
await mctx.close();

// ---------- BLOCK 5B: patient scheduling + doctor list parity ----------
logBlock('BLOCO 5B — Paciente agenda / lista de médicos');
// secretary doctor list
const secDoctors = await spage.evaluate(async () => {
  return null; // placeholder, captured below differently
});
// reopen secretary modal to capture doctor option labels
await spage.getByRole('button', { name: /Novo Agendamento/i }).first().click();
await spage.waitForTimeout(1200);
const secDoctorLabels = await spage.$$eval('#agenda-medico option', opts => opts.filter(o=>o.value).map(o=>o.textContent.replace(/ - sem horários.*/,'').trim()));
out.steps.secretaryDoctors = secDoctorLabels;
await spage.getByRole('button', { name: /^Cancelar$/ }).first().click().catch(()=>{});
console.log('[5B] secretary doctor count:', secDoctorLabels.length);
await sctx.close();

const { context: pctx, events: pevents } = await newContext(browser);
const ppage = await pctx.newPage();
trackPage(ppage, pevents);
await login(ppage, 'paciente');
await ppage.locator('.app-sidebar-nav-button', { hasText: 'Agenda' }).click();
await ppage.waitForTimeout(3500);
await shot(ppage, 'b5-patient-agenda');
const patientAgendaText = (await ppage.locator('body').innerText()).replace(/\s+/g,' ');
out.steps.patientSchedulingText = patientAgendaText.slice(0, 600);
out.steps.patientBadResponses = pevents.badResponses.slice(0, 8);
console.log('[5B] patient agenda snippet:', patientAgendaText.slice(0,300));
console.log('[5B] patient bad responses:', JSON.stringify(out.steps.patientBadResponses));
await pctx.close();

await browser.close();
console.log('\n===== JSON =====');
console.log(JSON.stringify(out, null, 2));
