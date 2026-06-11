import { newBrowser, newContext, trackPage, login, shot, logBlock } from './lib.mjs';

function genCpf() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += n[i] * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  n.push(calc(9)); n.push(calc(10));
  const s = n.join('');
  return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9)}`;
}

const STAMP = Date.now().toString().slice(-6);
const NAME = `QA Teste Paciente ${STAMP}`;
const CPF = genCpf();
const out = { stamp: STAMP, cpf: CPF, steps: {} };

const browser = await newBrowser();
const { context, events } = await newContext(browser);
const page = await context.newPage();
trackPage(page, events);

logBlock('BLOCO 2b — duplicado (backend), editar, excluir, limpeza');
await login(page, 'gestao');
await page.locator('.app-sidebar-nav-button', { hasText: 'Pacientes' }).click();
await page.waitForTimeout(2500);

const search = page.locator('input[placeholder*="Buscar paciente"]');
const novo = page.getByRole('button', { name: /Novo Paciente/i }).first();
const saveBtn = () => page.getByRole('button', { name: /Salvar Paciente/i });

async function closeModal() {
  for (let i = 0; i < 3; i++) {
    const cancel = page.getByRole('button', { name: /^Cancelar$/ }).first();
    if (await cancel.count()) { await cancel.click().catch(()=>{}); await page.waitForTimeout(500); }
    else break;
  }
}
async function fillNew(name, cpf, mail) {
  await novo.click();
  await page.waitForTimeout(900);
  await page.locator('input[placeholder="Ex: Maria Oliveira da Silva"]').first().fill(name);
  await page.locator('input[placeholder="000.000.000-00"]').first().fill(cpf);
  await page.locator('input[placeholder="paciente@exemplo.com"]').first().fill(mail);
  await page.locator('input[placeholder="(79) 99000-0000"]').first().fill('11988887777');
  await page.getByLabel(/Data de Nascimento/i).fill('1990-05-20');
}

// First cleanup any leftover QA patients
async function cleanupAll(prefix) {
  await search.fill(prefix);
  await page.waitForTimeout(1500);
  let deleted = 0;
  for (let i = 0; i < 10; i++) {
    const delBtn = page.locator('button[title="Excluir"]').first();
    if (!(await delBtn.count())) break;
    await delBtn.click();
    await page.waitForTimeout(700);
    const confirm = page.locator('button:not([title]):has-text("Excluir")').last();
    if (await confirm.count()) { await confirm.click(); await page.waitForTimeout(3000); deleted++; }
    else break;
    await search.fill(prefix);
    await page.waitForTimeout(1500);
  }
  return deleted;
}
const preCleanup = await cleanupAll('QA Teste Paciente');
console.log('pre-cleanup deleted leftovers:', preCleanup);

// Create base patient
await fillNew(NAME, CPF, `qa.${STAMP}@example.com`);
await saveBtn().click();
await page.waitForTimeout(4000);
await search.fill(NAME);
await page.waitForTimeout(1500);
out.steps.created = (await page.locator(`text=${NAME}`).count()) > 0;
console.log('created:', out.steps.created);

// Duplicate CPF -> confirm mesmo assim -> observe backend
await fillNew(`${NAME} DUP`, CPF, `qa.dup.${STAMP}@example.com`);
await saveBtn().click();
await page.waitForTimeout(1500);
const dupWarn = (await page.locator('text=/Já existe um paciente com este CPF/i').count()) > 0;
await page.getByRole('button', { name: /Confirmar mesmo assim/i }).click().catch(()=>{});
await page.waitForTimeout(5000);
const submitErr = await page.locator('[role="alert"]').allInnerTexts().catch(() => []);
const modalStillOpen = (await saveBtn().count()) > 0;
await closeModal();
await search.fill('QA Teste Paciente');
await page.waitForTimeout(1500);
const totalAfterDup = await page.locator('button[title="Excluir"]').count();
out.steps.duplicate = { dupWarn, submitErr, modalStillOpen, rowsAfterDup: totalAfterDup };
console.log('duplicate test:', JSON.stringify(out.steps.duplicate));
await shot(page, 'b2b-dup');

// Edit base patient
await search.fill(NAME);
await page.waitForTimeout(1500);
const editBtn = page.locator('button[title="Editar"]').first();
if (await editBtn.count()) {
  await editBtn.click();
  await page.waitForTimeout(1500);
  const editCpfVal = await page.locator('input[placeholder="000.000.000-00"]').first().inputValue();
  out.steps.editMaskOk = /\d{3}\.\d{3}\.\d{3}-\d{2}/.test(editCpfVal);
  await page.locator('input[placeholder="Ex: Maria Oliveira da Silva"]').first().fill(`${NAME} EDIT`);
  await page.getByRole('button', { name: /Salvar Alterações/i }).click();
  await page.waitForTimeout(4000);
  await search.fill(`${NAME} EDIT`);
  await page.waitForTimeout(1500);
  out.steps.editSaved = (await page.locator(`text=${NAME} EDIT`).count()) > 0;
}
console.log('edit:', out.steps.editMaskOk, out.steps.editSaved);

// Final cleanup
const finalDeleted = await cleanupAll('QA Teste Paciente');
out.steps.finalDeleted = finalDeleted;
console.log('final cleanup deleted:', finalDeleted);

out.events = { consoleErrors: events.consoleErrors.slice(0,8), bad: events.badResponses.slice(0,12) };
await browser.close();
console.log('\n===== JSON =====');
console.log(JSON.stringify(out, null, 2));
