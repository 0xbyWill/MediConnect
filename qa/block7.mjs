import { newBrowser, newContext, trackPage, login, gotoLogin, shot, logBlock, BASE } from './lib.mjs';
function genCpf(){const n=Array.from({length:9},()=>Math.floor(Math.random()*9));const c=l=>{let s=0;for(let i=0;i<l;i++)s+=n[i]*(l+1-i);const m=(s*10)%11;return m===10?0:m;};n.push(c(9));n.push(c(10));const s=n.join('');return `${s.slice(0,3)}.${s.slice(3,6)}.${s.slice(6,9)}-${s.slice(9)}`;}
const STAMP=Date.now().toString().slice(-6);
const NAME=`QA Signup ${STAMP}`;
const EMAIL=`qa.signup.${STAMP}@example.com`;
const CPF=genCpf();
const out={ stamp:STAMP, email:EMAIL, steps:{} };

const browser=await newBrowser();
const { context, events }=await newContext(browser);
const page=await context.newPage();
trackPage(page, events);

logBlock('BLOCO 7 — Signup público de paciente');
await gotoLogin(page);
await page.getByRole('button', { name: /Criar Conta/i }).click();
await page.waitForTimeout(1500);
await page.locator('#patient-full-name').waitFor({ timeout: 8000 });
const bodyText = await page.locator('body').innerText();
out.steps.patientOnly = /Criar conta de paciente/i.test(bodyText) && !/perfil|m[eé]dico|secretaria|gestor/i.test(bodyText.replace(/MediConnect/g,''));
out.steps.hasRoleSelector = (await page.locator('select').count()) > 0;
console.log('[7] patient-only title:', /Criar conta de paciente/i.test(bodyText), '| role selectors:', out.steps.hasRoleSelector);
await shot(page, 'b7-signup-form');

// empty submit
await page.getByRole('button', { name: /Criar conta/i }).click();
await page.waitForTimeout(800);
out.steps.emptyErr = await page.locator('.patient-signup-message-error, [role="alert"]').first().innerText().catch(()=> '');
console.log('[7] empty submit:', out.steps.emptyErr);

// invalid: bad cpf + mismatched password
await page.locator('#patient-full-name').fill(NAME);
await page.locator('#patient-email').fill(EMAIL);
await page.locator('#patient-cpf').fill('123.456.789-00');
await page.locator('#patient-phone').fill('11988887777');
await page.locator('#patient-birth-date').fill('1990-05-20');
await page.locator('#patient-password').fill('Teste@123');
await page.locator('#patient-password-confirm').fill('Outra@123');
await page.getByRole('button', { name: /Criar conta/i }).click();
await page.waitForTimeout(800);
out.steps.invalidErrs = await page.locator('[role="alert"]').allInnerTexts().catch(()=>[]);
console.log('[7] invalid errors:', JSON.stringify(out.steps.invalidErrs));

// fix and submit (real creation)
await page.locator('#patient-cpf').fill(CPF);
await page.locator('#patient-password-confirm').fill('Teste@123');
await page.getByRole('button', { name: /Criar conta/i }).click();
await page.waitForTimeout(7000);
out.steps.successMsg = await page.locator('.patient-signup-message-success, [role="status"]').first().innerText().catch(()=> '');
out.steps.anyError = await page.locator('.patient-signup-message-error').first().innerText().catch(()=> '');
console.log('[7] success:', out.steps.successMsg, '| error:', out.steps.anyError);
await shot(page, 'b7-signup-result');

// verify can login with new account
let loginWorks=false;
if (out.steps.successMsg) {
  await gotoLogin(page);
  await page.fill('#login-email', EMAIL);
  await page.fill('#login-password', 'Teste@123');
  await page.click('.login-submit');
  await page.waitForTimeout(6000);
  loginWorks = (await page.locator('.app-sidebar').count())>0;
  const roleText = await page.locator('.app-topbar').innerText().catch(()=> '');
  out.steps.newAccountRole = roleText.replace(/\s+/g,' ');
}
out.steps.loginWorks = loginWorks;
console.log('[7] login with new account:', loginWorks, '| role:', out.steps.newAccountRole);
await context.close();

// cleanup patient record via gestor
const { context: g, events: ge }=await newContext(browser);
const gp=await g.newPage();
trackPage(gp, ge);
await login(gp, 'gestao');
await gp.locator('.app-sidebar-nav-button', { hasText: 'Pacientes' }).click();
await gp.waitForTimeout(2500);
const search=gp.locator('input[placeholder*="Buscar paciente"]');
let deleted=0;
for(let i=0;i<3;i++){
  await search.fill('QA Signup');
  await gp.waitForTimeout(1500);
  const del=gp.locator('button[title="Excluir"]').first();
  if(!(await del.count())) break;
  await del.click().catch(()=>{});
  await gp.waitForTimeout(700);
  const c=gp.locator('button:not([title]):has-text("Excluir")').last();
  if(await c.count()){ await c.click().catch(()=>{}); await gp.waitForTimeout(3000); deleted++; } else break;
}
out.steps.cleanupDeleted=deleted;
console.log('[7] cleanup deleted patient records:', deleted);
await g.close();

await browser.close();
console.log('\n===== JSON =====');
console.log(JSON.stringify(out,null,2));
