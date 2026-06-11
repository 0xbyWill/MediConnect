import { newBrowser, newContext, trackPage, login, shot, logBlock, DATA_BASE } from './lib.mjs';
const out = { baseDate: DATA_BASE, steps: {} };
const browser = await newBrowser();

// patient name from list (secretary)
const { context: s, events: se } = await newContext(browser);
const sp = await s.newPage();
trackPage(sp, se);
await login(sp, 'secretaria');
await sp.locator('.app-sidebar-nav-button', { hasText: 'Pacientes' }).click();
await sp.waitForTimeout(3000);
const patientName = (await sp.locator('table tbody tr td button').first().innerText().catch(()=> '')).trim();
const pFirst = patientName.split(' ')[0] || patientName;
out.patient = patientName;
console.log('patient:', patientName);

async function pickFrancisco() {
  const fv = await sp.$$eval('#agenda-medico option', o => { const x=o.find(e=>/Francisco Barreto/i.test(e.textContent)); return x?x.value:''; });
  if (fv) await sp.locator('#agenda-medico').selectOption(fv);
  return fv;
}
async function pickPatient() {
  const modal = sp.locator('div[style*="position: fixed"]').last();
  await sp.locator('#agenda-paciente-search').fill(pFirst);
  await sp.waitForTimeout(1800);
  const opt = modal.locator('button', { hasText: patientName }).first();
  await opt.waitFor({ state: 'visible', timeout: 6000 });
  await opt.click();
  // confirm selected: search input should disappear (pill replaces it)
  await sp.locator('#agenda-paciente-search').waitFor({ state: 'detached', timeout: 5000 }).catch(()=>{});
  await sp.waitForTimeout(500);
}
async function closeAgModal() {
  const c = sp.locator('div[style*="position: fixed"] button', { hasText: /^Cancelar$/ }).last();
  if (await c.count()) await c.click({ force: true }).catch(()=>{});
  await sp.locator('#agenda-data').waitFor({ state: 'detached', timeout: 5000 }).catch(()=>{});
  await sp.waitForTimeout(500);
}

logBlock('BLOCO 5A — Secretária agenda');
await sp.locator('.app-sidebar-nav-button', { hasText: 'Agenda' }).click();
await sp.waitForTimeout(2500);
await sp.getByRole('button', { name: /Novo Agendamento/i }).first().click();
await sp.waitForTimeout(1500);
await pickPatient();
const fv = await pickFrancisco();
console.log('francisco barreto value:', fv);
await sp.locator('#agenda-data').fill(DATA_BASE);
await sp.waitForTimeout(7000);
const slots = await sp.$$eval('#agenda-hora option', o=>o.map(x=>({v:x.value,t:x.textContent,d:x.disabled})));
out.steps.slots = slots.filter(o=>o.v).map(o=>o.t);
console.log('[5A] slots:', JSON.stringify(out.steps.slots));
await shot(sp, 'b5-slots');
const free = slots.find(o=>o.v && !o.d);
let booked = null;
if (free) {
  await sp.locator('#agenda-hora').selectOption(free.v);
  await sp.getByRole('button', { name: /^Salvar$/ }).click();
  await sp.waitForTimeout(6000);
  const modalClosed = (await sp.locator('#agenda-hora').count()) === 0;
  out.steps.bookSaved = modalClosed;
  if (modalClosed) booked = free.v;
  else { out.steps.bookError = await sp.locator('div[style*="position: fixed"]').last().innerText().catch(()=> ''); await closeAgModal(); }
}
out.steps.booked = booked;
console.log('[5A] booked:', booked, '| saved:', out.steps.bookSaved);
await shot(sp, 'b5-after');

logBlock('BLOCO 6 — conflito + fora da disponibilidade');
await sp.getByRole('button', { name: /Novo Agendamento/i }).first().click();
await sp.waitForTimeout(1200);
await pickPatient();
await pickFrancisco();
await sp.locator('#agenda-data').fill(DATA_BASE);
await sp.waitForTimeout(7000);
const slots2 = await sp.$$eval('#agenda-hora option', o=>o.map(x=>({v:x.value,t:x.textContent,d:x.disabled})));
out.steps.conflict = slots2.find(o=>o.v===booked) || null;
out.steps.secretaryDoctorCount = await sp.locator('#agenda-medico option').count() - 1;
console.log('[6.1] booked slot now:', JSON.stringify(out.steps.conflict));
// out-of-availability: pick a doctor with no availability
const noAvail = await sp.$$eval('#agenda-medico option', o => { const x=o.find(e=>/Francisco Junior/i.test(e.textContent)); return x?x.value:''; });
if (noAvail) {
  await sp.locator('#agenda-medico').selectOption(noAvail);
  await sp.waitForTimeout(6000);
  out.steps.outOfAvail = { disabled: await sp.locator('#agenda-hora').isDisabled(), placeholder: await sp.locator('#agenda-hora option').first().innerText() };
  console.log('[6.2] out-of-availability:', JSON.stringify(out.steps.outOfAvail));
  await shot(sp, 'b6-noavail');
}
await closeAgModal();

logBlock('BLOCO 5A.2 — médico vê a consulta');
const { context: m, events: me } = await newContext(browser);
const mp = await m.newPage();
trackPage(mp, me);
await login(mp, 'medico');
await mp.locator('.app-sidebar-nav-button', { hasText: 'Agenda' }).click();
await mp.waitForTimeout(3000);
await mp.getByRole('button', { name: /^Todos$/ }).first().click().catch(()=>{});
await mp.waitForTimeout(2000);
const docBody = (await mp.locator('body').innerText());
out.steps.doctorSeesAppt = booked ? (docBody.includes(booked) && docBody.includes(patientName.split(' ')[0])) : null;
console.log('[5A.2] doctor sees appt:', out.steps.doctorSeesAppt);
await shot(mp, 'b5-doctor');
await m.close();

logBlock('BLOCO 5B — paciente');
const { context: p, events: pe } = await newContext(browser);
const pp = await p.newPage();
trackPage(pp, pe);
await login(pp, 'paciente');
await pp.locator('.app-sidebar-nav-button', { hasText: 'Agenda' }).click();
await pp.waitForTimeout(3500);
await shot(pp, 'b5-patient');
out.steps.patientAgenda = (await pp.locator('body').innerText()).replace(/\s+/g,' ').slice(0,500);
out.steps.patientBad = pe.badResponses.slice(0,8);
console.log('[5B] patient bad responses:', JSON.stringify(out.steps.patientBad));
console.log('[5B] patient snippet:', out.steps.patientAgenda.slice(0,250));
await p.close();

// CLEANUP: cancel the test appointment as secretary
logBlock('CLEANUP — cancelar consulta de teste');
if (booked) {
  await sp.getByRole('button', { name: /^Todos$/ }).first().click().catch(()=>{});
  await sp.waitForTimeout(2500);
  const row = sp.locator('tr', { hasText: patientName.split(' ')[0] }).filter({ hasText: booked }).first();
  if (await row.count()) {
    await row.locator('button[title="Cancelar"]').first().click().catch(()=>{});
    await sp.waitForTimeout(800);
    await sp.getByRole('button', { name: /Cancelar consulta/i }).click().catch(()=>{});
    await sp.waitForTimeout(3000);
    out.steps.cleanupCancelled = true;
  } else {
    out.steps.cleanupCancelled = false;
  }
  console.log('cleanup cancelled appt:', out.steps.cleanupCancelled);
}
await s.close();

await browser.close();
console.log('\n===== JSON =====');
console.log(JSON.stringify(out, null, 2));
