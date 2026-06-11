import { newBrowser, newContext, trackPage, login, shot, logBlock } from './lib.mjs';

function genCpf() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += n[i] * (len + 1 - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  n.push(calc(9));
  n.push(calc(10));
  const s = n.join('');
  return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9)}`;
}

const STAMP = Date.now().toString().slice(-6);
const NAME = `QA Teste Paciente ${STAMP}`;
const CPF = genCpf();
const out = { stamp: STAMP, name: NAME, cpf: CPF, steps: {} };

const browser = await newBrowser();
const { context, events } = await newContext(browser);
const page = await context.newPage();
trackPage(page, events);

logBlock('BLOCO 2 — CRUD de paciente (perfil Gestor)');
const r = await login(page, 'gestao');
console.log('login gestao:', r);

// go to Pacientes
await page.locator('.app-sidebar-nav-button', { hasText: 'Pacientes' }).click();
await page.waitForTimeout(2500);

const novo = page.getByRole('button', { name: /Novo Paciente/i }).first();
async function openNew() {
  await novo.click();
  await page.locator('div', { hasText: 'Dados do Paciente' }).first().waitFor({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
}
const saveBtn = () => page.getByRole('button', { name: /Salvar Paciente/i });
async function collectErrors() {
  return await page.locator('[role="alert"]').allInnerTexts().catch(() => []);
}

// Step 2 — save empty
await openNew();
await saveBtn().click();
await page.waitForTimeout(800);
const emptyErrors = await collectErrors();
console.log('\n[2] Save empty -> errors:', JSON.stringify(emptyErrors));
await shot(page, 'b2-empty-errors');
out.steps.emptyErrors = emptyErrors;

// Step 3 — invalid CPF + email without @
const cpfInput = page.locator('input[placeholder="000.000.000-00"]').first();
const emailInput = page.locator('input[placeholder="paciente@exemplo.com"]').first();
const phoneInput = page.locator('input[placeholder="(79) 99000-0000"]').first();
const nomeInput = page.locator('input[placeholder="Ex: Maria Oliveira da Silva"]').first();
await cpfInput.fill('123.456.789-00');
await emailInput.fill('emailsemarroba');
await saveBtn().click();
await page.waitForTimeout(800);
const invalidErrors = await collectErrors();
console.log('[3] Invalid CPF/email -> errors:', JSON.stringify(invalidErrors));
out.steps.invalidErrors = invalidErrors;

// Step 4 — masks: type only digits
await cpfInput.fill('');
await cpfInput.type('39053344705', { delay: 10 });
await phoneInput.fill('');
await phoneInput.type('11988887777', { delay: 10 });
const cpfMasked = await cpfInput.inputValue();
const phoneMasked = await phoneInput.inputValue();
console.log('[4] CPF mask:', cpfMasked, '| phone mask:', phoneMasked);
out.steps.masks = { cpfMasked, phoneMasked };

// Step 6 — minimal valid create
await nomeInput.fill(NAME);
await cpfInput.fill(CPF);
await emailInput.fill(`qa.teste.${STAMP}@example.com`);
await phoneInput.fill('11988887777');
await page.getByLabel(/Data de Nascimento/i).fill('1990-05-20');
await saveBtn().click();
await page.waitForTimeout(4000);
// verify appears: search
const search = page.locator('input[placeholder*="Buscar paciente"]');
await search.fill(NAME);
await page.waitForTimeout(2000);
const createdVisible = await page.locator('table', { hasText: NAME }).count() > 0 || (await page.locator(`text=${NAME}`).count()) > 0;
console.log('[6] Minimal create visible in list:', createdVisible);
await shot(page, 'b2-created');
out.steps.created = createdVisible;

// Step 5 — duplicate CPF
await openNew();
await page.locator('input[placeholder="Ex: Maria Oliveira da Silva"]').first().fill(`${NAME} DUP`);
await page.locator('input[placeholder="000.000.000-00"]').first().fill(CPF);
await page.locator('input[placeholder="paciente@exemplo.com"]').first().fill(`qa.dup.${STAMP}@example.com`);
await page.locator('input[placeholder="(79) 99000-0000"]').first().fill('11988887777');
await page.getByLabel(/Data de Nascimento/i).fill('1990-05-20');
await saveBtn().click();
await page.waitForTimeout(1500);
const dupWarn = (await page.locator('text=/Já existe um paciente com este CPF/i').count()) > 0;
console.log('[5] Duplicate CPF warning shown:', dupWarn);
await shot(page, 'b2-dup-warning');
// Confirm "mesmo assim" to test backend enforcement
let dupCreated = null;
if (dupWarn) {
  await page.getByRole('button', { name: /Confirmar mesmo assim/i }).click();
  await page.waitForTimeout(4000);
  const submitErr = await page.locator('[role="alert"]').allInnerTexts().catch(() => []);
  // if modal closed => created; if error => backend blocked
  const modalOpen = (await page.locator('text=/Confirmar mesmo assim/i').count()) > 0 || (await saveBtn().count()) > 0;
  await search.fill(NAME);
  await page.waitForTimeout(1500);
  const count = await page.locator(`text=${NAME}`).count();
  dupCreated = { modalStillOpen: modalOpen, submitErr, listMatches: count };
  console.log('[5] After confirm duplicate:', JSON.stringify(dupCreated));
  await shot(page, 'b2-dup-after');
  // close modal if still open
  await page.keyboard.press('Escape').catch(() => {});
}
out.steps.duplicate = { dupWarn, dupCreated };

// Step 8 — edit
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(500);
await search.fill(NAME);
await page.waitForTimeout(1500);
const editBtn = page.locator('button[title="Editar"]').first();
let editMaskOk = null, editSaved = null;
if (await editBtn.count()) {
  await editBtn.click();
  await page.waitForTimeout(1500);
  const editCpfVal = await page.locator('input[placeholder="000.000.000-00"]').first().inputValue();
  editMaskOk = /\d{3}\.\d{3}\.\d{3}-\d{2}/.test(editCpfVal);
  // change profissao or nome
  const nomeEdit = page.locator('input[placeholder="Ex: Maria Oliveira da Silva"]').first();
  await nomeEdit.fill(`${NAME} EDIT`);
  await page.getByRole('button', { name: /Salvar Alterações/i }).click();
  await page.waitForTimeout(4000);
  await search.fill(`${NAME} EDIT`);
  await page.waitForTimeout(1500);
  editSaved = (await page.locator(`text=${NAME} EDIT`).count()) > 0;
  console.log('[8] Edit mask kept:', editMaskOk, '| edit saved:', editSaved);
}
out.steps.edit = { editMaskOk, editSaved };

// Step 9 / cleanup — delete all QA patients from this run
await page.keyboard.press('Escape').catch(() => {});
await search.fill(`QA Teste Paciente ${STAMP}`);
await page.waitForTimeout(1500);
let deleted = 0;
for (let i = 0; i < 5; i++) {
  const delBtn = page.locator('button[title="Excluir"]').first();
  if (!(await delBtn.count())) break;
  await delBtn.click();
  await page.waitForTimeout(800);
  const confirm = page.getByRole('button', { name: /^Excluir$/ });
  if (await confirm.count()) {
    await confirm.click();
    await page.waitForTimeout(3000);
    deleted++;
  } else break;
  await search.fill(`QA Teste Paciente ${STAMP}`);
  await page.waitForTimeout(1500);
}
console.log('[9/cleanup] deleted count:', deleted);
out.steps.deleted = deleted;

console.log('\nconsole errors:', events.consoleErrors.slice(0,5));
console.log('bad responses:', events.badResponses.slice(0,10));
out.events = { consoleErrors: events.consoleErrors.slice(0,8), bad: events.badResponses.slice(0,12) };

await browser.close();
console.log('\n===== JSON =====');
console.log(JSON.stringify(out, null, 2));
