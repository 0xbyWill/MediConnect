import { newBrowser, newContext, trackPage, login, shot, logBlock } from './lib.mjs';

function genCpf() {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 9));
  const calc = (len) => { let s=0; for(let i=0;i<len;i++) s+=n[i]*(len+1-i); const m=(s*10)%11; return m===10?0:m; };
  n.push(calc(9)); n.push(calc(10));
  const s = n.join('');
  return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9)}`;
}
const STAMP = Date.now().toString().slice(-6);
const CRM = String(100000 + Math.floor(Math.random()*899999));
const out = { stamp: STAMP, crm: CRM, steps: {} };

const browser = await newBrowser();
const { context, events } = await newContext(browser);
const page = await context.newPage();
trackPage(page, events);

logBlock('BLOCO 3 — CRUD de médico (perfil Gestor)');
await login(page, 'gestao');
await page.locator('.app-sidebar-nav-button', { hasText: 'Usuários' }).click();
await page.waitForTimeout(2500);

const novo = page.getByRole('button', { name: /Novo Usuário/i }).first();
const saveBtn = () => page.getByRole('button', { name: /Criar Usuário/i });
const formErr = () => page.locator('[role="alert"]').first();
const search = page.locator('input[placeholder*="Pesquisar"]');

async function openNew() { await novo.click(); await page.waitForTimeout(900); }
async function setRoleMedico() {
  await page.locator('#usuario-perfil-acesso').selectOption('medico');
  await page.waitForTimeout(600);
}
async function fillMedico({ nome, email, cpf, crm, uf='SP', specialty, senha='Teste@123' }) {
  await page.locator('#usuario-nome-completo').fill(nome);
  await page.locator('#usuario-e-mail').fill(email);
  await page.locator('#usuario-telefone').fill('11988887777');
  await setRoleMedico();
  await page.locator('#usuario-cpf').fill(cpf);
  await page.locator('#usuario-crm').fill(crm);
  await page.locator('#usuario-crm-uf').selectOption(uf);
  if (specialty !== undefined) await page.locator('#usuario-especialidade').selectOption(specialty);
  await page.locator('#usuario-senha-inicial').fill(senha);
}
async function errText() { return (await formErr().innerText().catch(()=> '')).trim(); }
async function closeModal() {
  const c = page.getByRole('button', { name: /^Cancelar$/ }).first();
  if (await c.count()) await c.click().catch(()=>{});
  await page.waitForTimeout(500);
}

// Step 1 — empty
await openNew();
await saveBtn().click();
await page.waitForTimeout(600);
out.steps.empty = await errText();
console.log('[1] empty ->', out.steps.empty);

// Step 2 — role medico shows CRM/UF/specialty
await setRoleMedico();
const hasCrm = await page.locator('#usuario-crm').count();
const hasUf = await page.locator('#usuario-crm-uf').count();
const hasSpec = await page.locator('#usuario-especialidade').count();
out.steps.medicoFields = { hasCrm: !!hasCrm, hasUf: !!hasUf, hasSpec: !!hasSpec };
console.log('[2] medico fields:', JSON.stringify(out.steps.medicoFields));
await shot(page, 'b3-medico-form');

// Step 3a — invalid CPF
await fillMedico({ nome: `QA Med Invalido ${STAMP}`, email: `qa.med.inv.${STAMP}@example.com`, cpf: '123.456.789-00', crm: CRM, specialty: 'Cardiologista' });
await saveBtn().click();
await page.waitForTimeout(600);
out.steps.invalidCpf = await errText();
console.log('[3a] invalid cpf ->', out.steps.invalidCpf);

// Step 3b — short password
await page.locator('#usuario-cpf').fill(genCpf());
await page.locator('#usuario-senha-inicial').fill('123');
await saveBtn().click();
await page.waitForTimeout(600);
out.steps.shortPwd = await errText();
console.log('[3b] short pwd ->', out.steps.shortPwd);

// Step 3c — empty specialty: fill valid everything but specialty empty
await page.locator('#usuario-senha-inicial').fill('Teste@123');
await page.locator('#usuario-especialidade').selectOption('');
await page.waitForTimeout(300);
// don't submit yet; just check validateForm would block? We submit to observe (creates doctor if allowed)
const cpfNoSpec = genCpf();
await page.locator('#usuario-cpf').fill(cpfNoSpec);
await page.locator('#usuario-nome-completo').fill(`QA Med SemEsp ${STAMP}`);
await page.locator('#usuario-e-mail').fill(`qa.med.noesp.${STAMP}@example.com`);
await page.locator('#usuario-crm').fill(String(Number(CRM)+1));
await saveBtn().click();
await page.waitForTimeout(5000);
const modalAfterNoSpec = await saveBtn().count();
out.steps.emptySpecialtyAllowed = modalAfterNoSpec === 0; // modal closed = created
out.steps.emptySpecialtyErr = await errText();
console.log('[3c] empty specialty allowed (created):', out.steps.emptySpecialtyAllowed, '| err:', out.steps.emptySpecialtyErr);
await closeModal();

// Step 3d — existing email (backend uniqueness)
await openNew();
await fillMedico({ nome: `QA Med DupMail ${STAMP}`, email: 'francisco.squad04@gmail.com', cpf: genCpf(), crm: String(Number(CRM)+2), specialty: 'Cardiologista' });
await saveBtn().click();
await page.waitForTimeout(5000);
out.steps.dupEmail = { err: await errText(), modalOpen: (await saveBtn().count())>0 };
console.log('[3d] existing email ->', JSON.stringify(out.steps.dupEmail));
await closeModal();

// Step 4 — create valid complete doctor A
await openNew();
await fillMedico({ nome: `QA Med Valido ${STAMP}`, email: `qa.med.${STAMP}@example.com`, cpf: genCpf(), crm: CRM, uf: 'SP', specialty: 'Pneumologista' });
await saveBtn().click();
await page.waitForTimeout(5000);
await search.fill(`QA Med Valido ${STAMP}`);
await page.waitForTimeout(1500);
const rowText = await page.locator('table').innerText().catch(()=> '');
out.steps.createdA = { visible: rowText.includes(`QA Med Valido ${STAMP}`), showsCrm: rowText.includes(CRM), showsSpec: /Pneumologista/i.test(rowText) };
console.log('[4] created A:', JSON.stringify(out.steps.createdA));
await shot(page, 'b3-created');

// Step 6 — duplicate CRM same UF
await openNew();
await fillMedico({ nome: `QA Med DupCRM ${STAMP}`, email: `qa.med.dupcrm.${STAMP}@example.com`, cpf: genCpf(), crm: CRM, uf: 'SP', specialty: 'Cardiologista' });
await saveBtn().click();
await page.waitForTimeout(5000);
out.steps.dupCrm = { err: await errText(), modalOpen: (await saveBtn().count())>0 };
// check if a second row with that CRM exists
await closeModal();
await search.fill(CRM);
await page.waitForTimeout(1500);
const dupRows = await page.locator('tbody tr').count();
out.steps.dupCrm.rowsWithCrm = dupRows;
console.log('[6] dup CRM:', JSON.stringify(out.steps.dupCrm));
await shot(page, 'b3-dupcrm');

// Cleanup — delete all QA Med from this run
async function cleanup() {
  let deleted = 0;
  for (let i=0;i<10;i++) {
    await search.fill('QA Med');
    await page.waitForTimeout(1500);
    const del = page.locator('button[title="Excluir usuário"]').first();
    if (!(await del.count())) break;
    await del.click().catch(()=>{});
    await page.waitForTimeout(700);
    const confirm = page.locator('button:not([title]):has-text("Excluir")').last();
    if (await confirm.count()) { await confirm.click().catch(()=>{}); await page.waitForTimeout(3000); deleted++; }
    else break;
  }
  return deleted;
}
out.steps.cleanupDeleted = await cleanup();
console.log('[cleanup] deleted:', out.steps.cleanupDeleted);

out.events = { consoleErrors: events.consoleErrors.slice(0,8), bad: events.badResponses.slice(0,12) };
await browser.close();
console.log('\n===== JSON =====');
console.log(JSON.stringify(out, null, 2));
