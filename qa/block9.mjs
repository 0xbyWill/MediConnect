import { newBrowser, newContext, trackPage, login, navTo, logout, shot, logBlock } from './lib.mjs';

const STAMP = String(Date.now()).slice(-6);
const MARKER = `QA9 ${STAMP}`;
const out = { stamp: STAMP, steps: {}, events: {} };

function rec(events, tag) {
  return {
    consoleErrors: events.consoleErrors.slice(),
    pageErrors: events.pageErrors.slice(),
    badResponses: events.badResponses.filter(r => !r.includes('favicon')).slice(),
  };
}

const browser = await newBrowser();
try {
  logBlock('BLOCO 9 — Laudo médico (rascunho -> liberado -> PDF)');

  // ---------- Médico cria o laudo ----------
  const { context, events } = await newContext(browser);
  const page = await context.newPage();
  trackPage(page, events);

  const li = await login(page, 'medico');
  out.steps.medicoLogin = li.ok;
  await navTo(page, 'Laudos');
  await page.waitForTimeout(1500);

  // Novo Laudo
  await page.getByRole('button', { name: /Novo Laudo/i }).first().click();
  await page.waitForTimeout(1500);
  out.steps.editorOpen = (await page.locator('div[contenteditable="true"]').count()) > 0;

  // 1) Salvar vazio -> bloqueia por paciente ausente
  await page.getByRole('button', { name: /^Salvar Laudo$/i }).click();
  await page.waitForTimeout(1200);
  out.steps.emptyError = await page.locator('text=Selecione um paciente').first().innerText().catch(() => '');

  // 2) Selecionar paciente
  const pacSearch = page.locator('input[placeholder="Buscar paciente..."]').first();
  await pacSearch.click();
  await pacSearch.fill('a');
  await page.waitForTimeout(1200);
  // dropdown é o div irmão logo após o input
  const pacOption = pacSearch.locator('xpath=following-sibling::div//button').first();
  await pacOption.waitFor({ state: 'visible', timeout: 6000 });
  const pacName = (await pacOption.innerText().catch(() => '')).split('\n')[0];
  await pacOption.click();
  await page.waitForTimeout(1200);
  // confirma seleção: input de busca some quando há paciente
  const stillSearching = await page.locator('input[placeholder="Buscar paciente..."]').count();
  out.steps.pacienteSelecionado = stillSearching === 0 ? (pacName || 'selecionado') : '';

  // 3) Campos clínicos: CID + Técnica (marcador) + conteúdo
  const cidInput = page.locator('label:text-is("CID")').locator('xpath=following-sibling::input').first();
  await cidInput.fill('M54.5').catch(() => {});
  const techInput = page.locator('label:text-is("Técnica/Exame")').locator('xpath=following-sibling::input').first();
  await techInput.fill(MARKER).catch(() => {});

  const editor = page.locator('div[contenteditable="true"]').first();
  await editor.click();
  await editor.type('ACHADOS:\nExame clínico realizado sem intercorrências relevantes.\n\nANALISE:\nDados compatíveis com quadro estável.\n\nCONCLUSAO:\nPaciente apto. Laudo de teste automatizado QA.');
  await page.waitForTimeout(800);
  await shot(page, `b9-editor-${STAMP}`);

  // 4) Salvar como rascunho
  await page.getByRole('button', { name: /^Salvar Laudo$/i }).click();
  await page.waitForTimeout(3500);
  const backToList = (await page.locator('div[contenteditable="true"]').count()) === 0;
  out.steps.rascunhoSalvo = backToList;

  // 5) Verifica na lista (busca pelo marcador)
  await page.locator('input[placeholder="Buscar paciente/pedido..."]').fill(MARKER).catch(() => {});
  await page.waitForTimeout(1500);
  let rows = await page.locator('table tbody tr').count();
  out.steps.aparecaNaLista = rows;
  await shot(page, `b9-lista-rascunho-${STAMP}`);

  // 6) Reabrir e pré-visualizar
  await page.locator('button[title="Editar"]').first().click().catch(() => {});
  await page.waitForTimeout(1500);
  const inEditor = (await page.locator('div[contenteditable="true"]').count()) > 0;
  if (inEditor) {
    await page.getByRole('button', { name: /Pré-visualizar/i }).click().catch(() => {});
    await page.waitForTimeout(1500);
    out.steps.previewMostraConteudo = await page.locator('text=CONCLUSAO').first().isVisible().catch(() => false);
    await shot(page, `b9-preview-${STAMP}`);
    await page.getByRole('button', { name: /^Voltar$/ }).click().catch(() => {});
    await page.waitForTimeout(800);
    // fecha editor
    await page.getByRole('button', { name: /^Cancelar$/ }).click().catch(() => {});
    await page.waitForTimeout(1000);
  }

  // 7) Liberar laudo a partir da lista
  await page.locator('input[placeholder="Buscar paciente/pedido..."]').fill(MARKER).catch(() => {});
  await page.waitForTimeout(1200);
  await page.locator('button[title="Liberar laudo"]').first().click().catch(() => {});
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /^Liberar$/ }).click().catch(() => {});
  await page.waitForTimeout(3500);
  out.steps.liberado = await page.locator('text=Liberado').first().isVisible().catch(() => false);
  await shot(page, `b9-liberado-${STAMP}`);

  // 8) PDF: tenta baixar
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }).catch(() => null),
    page.locator('button:has-text("Baixar PDF")').first().click().catch(() => {}),
  ]);
  out.steps.pdfDownload = download ? (await download.suggestedFilename()) : 'sem download (provável janela de impressão)';
  await page.waitForTimeout(1500);

  out.events.medico = rec(events);
  await context.close();

  // ---------- Paciente vê em Meus Laudos ----------
  const c2 = await newContext(browser);
  const pg2 = c2.context;
  const ppage = await pg2.newPage();
  trackPage(ppage, c2.events);
  const pl = await login(ppage, 'paciente');
  out.steps.pacienteLogin = pl.ok;
  await navTo(ppage, 'Laudos').catch(() => {});
  await ppage.waitForTimeout(2500);
  const pacLaudoCount = await ppage.locator('table tbody tr').count().catch(() => 0);
  out.steps.pacienteVeLaudos = pacLaudoCount;
  out.steps.pacienteTituloMeusLaudos = await ppage.locator('text=Meus Laudos').first().isVisible().catch(() => false);
  await shot(ppage, `b9-paciente-laudos-${STAMP}`);
  out.events.paciente = rec(c2.events);
  await pg2.close();

  // ---------- Gestor vê na listagem global + tenta excluir ----------
  const c3 = await newContext(browser);
  const gpage = await c3.context.newPage();
  trackPage(gpage, c3.events);
  const gl = await login(gpage, 'gestao');
  out.steps.gestorLogin = gl.ok;
  await navTo(gpage, 'Laudos').catch(() => {});
  await gpage.waitForTimeout(1500);
  // aba Todos
  await gpage.getByRole('button', { name: /^Todos$/ }).first().click().catch(() => {});
  await gpage.waitForTimeout(800);
  await gpage.locator('input[placeholder="Buscar paciente/pedido..."]').fill(MARKER).catch(() => {});
  await gpage.waitForTimeout(1500);
  out.steps.gestorVeNaLista = await gpage.locator('table tbody tr').count().catch(() => 0);
  await shot(gpage, `b9-gestor-lista-${STAMP}`);
  out.events.gestor = rec(c3.events);
  await c3.context.close();

  // ---------- Limpeza: médico exclui o laudo de teste ----------
  const c4 = await newContext(browser);
  const dpage = await c4.context.newPage();
  trackPage(dpage, c4.events);
  await login(dpage, 'medico');
  await navTo(dpage, 'Laudos').catch(() => {});
  await dpage.waitForTimeout(1200);
  await dpage.getByRole('button', { name: /^Todos$/ }).first().click().catch(() => {});
  await dpage.waitForTimeout(600);
  let deleted = 0;
  for (let i = 0; i < 4; i++) {
    await dpage.locator('input[placeholder="Buscar paciente/pedido..."]').fill(MARKER).catch(() => {});
    await dpage.waitForTimeout(1200);
    const trash = dpage.locator('button[title="Excluir"]').first();
    if (await trash.count() === 0) break;
    // o teste do plano: laudo liberado deve bloquear/exigir justificativa
    await trash.click().catch(() => {});
    await dpage.waitForTimeout(800);
    const confirm = dpage.getByRole('button', { name: /^Excluir$/ }).first();
    if (await confirm.count() > 0) {
      out.steps.exclusaoLiberadoPermitida = true; // confirma sem bloqueio = possível bug
      await confirm.click().catch(() => {});
      deleted++;
      await dpage.waitForTimeout(2500);
    } else break;
  }
  out.steps.laudosExcluidos = deleted;
  out.events.cleanup = rec(c4.events);
  await c4.context.close();

  console.log('\n[9] empty error:', out.steps.emptyError);
  console.log('[9] paciente:', out.steps.pacienteSelecionado);
  console.log('[9] rascunho salvo:', out.steps.rascunhoSalvo, '| aparece na lista:', out.steps.aparecaNaLista);
  console.log('[9] preview ok:', out.steps.previewMostraConteudo, '| liberado:', out.steps.liberado);
  console.log('[9] pdf:', out.steps.pdfDownload);
  console.log('[9] paciente vê laudos:', out.steps.pacienteVeLaudos, '| título Meus Laudos:', out.steps.pacienteTituloMeusLaudos);
  console.log('[9] gestor vê na lista:', out.steps.gestorVeNaLista);
  console.log('[9] exclusão liberado permitida (possível bug):', !!out.steps.exclusaoLiberadoPermitida, '| excluídos:', out.steps.laudosExcluidos);
  console.log('\n===== JSON =====');
  console.log(JSON.stringify(out, null, 2));
} catch (err) {
  console.error('ERRO BLOCO 9:', err);
  console.log('\n===== JSON (parcial) =====');
  console.log(JSON.stringify(out, null, 2));
} finally {
  await browser.close();
}
