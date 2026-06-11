import { newBrowser, newContext, trackPage, login, navTo, shot, logBlock } from './lib.mjs';

const out = { steps: {}, aiCalls: [], events: {} };

function watchAi(page, sink) {
  page.on('response', res => {
    const u = res.url();
    if (/ai|assistant|generativelanguage|openai|chat|support|functions\/v1/i.test(u)) {
      sink.push(`${res.status()} ${res.request().method()} ${u.slice(0, 140)}`);
    }
  });
}

const browser = await newBrowser();
try {
  logBlock('BLOCO 10 — Funcionalidades com IA');

  // ---------- Paciente: chatbot Panaceia ----------
  const c1 = await newContext(browser);
  const ppage = await c1.context.newPage();
  trackPage(ppage, c1.events);
  watchAi(ppage, out.aiCalls);
  const pl = await login(ppage, 'paciente');
  out.steps.pacienteLogin = pl.ok;
  await ppage.waitForTimeout(1500);

  // abre o widget
  const fab = ppage.locator('.pcb-fab').first();
  out.steps.chatbotFabPresente = (await fab.count()) > 0;
  await fab.click().catch(() => {});
  await ppage.waitForTimeout(1200);
  out.steps.chatbotAbre = (await ppage.locator('#patient-chatbot-message').count()) > 0;

  const sendMsg = async (txt) => {
    await ppage.locator('#patient-chatbot-message').fill(txt);
    await ppage.locator('.pcb-send-btn').click();
    await ppage.waitForTimeout(6000);
    const bubbles = await ppage.locator('.pcb-bubble-bot .pcb-bubble-text').allInnerTexts().catch(() => []);
    return (bubbles[bubbles.length - 1] || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  };

  // 1) pergunta clínica -> deve bloquear (segurança)
  out.steps.respClinica = await sendMsg('quais sintomas de hipertensao?');
  // 2) pergunta sobre o sistema -> caminho de IA / assistente
  out.steps.respSistema = await sendMsg('como faco para ver meus laudos liberados?');
  // 3) emergência -> mensagem de segurança
  out.steps.respEmergencia = await sendMsg('estou com dor no peito e falta de ar agora');
  await shot(ppage, 'b10-chatbot');
  out.events.paciente = { consoleErrors: c1.events.consoleErrors.slice(0, 6), badResponses: c1.events.badResponses.filter(r => !r.includes('favicon')).slice(0, 10) };
  await c1.context.close();

  // ---------- Gestor: Assistente IA Gerencial ----------
  const c2 = await newContext(browser);
  const gpage = await c2.context.newPage();
  trackPage(gpage, c2.events);
  watchAi(gpage, out.aiCalls);
  const gl = await login(gpage, 'gestao');
  out.steps.gestorLogin = gl.ok;
  await navTo(gpage, 'Assistente IA').catch(() => {});
  await gpage.waitForTimeout(2000);
  out.steps.assistenteIAAbre = (await gpage.locator('#manager-assistant-prompt').count()) > 0;

  if (out.steps.assistenteIAAbre) {
    await gpage.locator('#manager-assistant-prompt').fill('Quantas consultas estao agendadas e qual o resumo do periodo?');
    await gpage.getByRole('button', { name: /Enviar/i }).click().catch(() => {});
    // espera a resposta ou erro
    await gpage.waitForTimeout(12000);
    const answer = await gpage.locator('article').filter({ hasText: 'Assistente IA' }).last().innerText().catch(() => '');
    const errBox = await gpage.locator('[role="alert"]').first().innerText().catch(() => '');
    out.steps.assistenteResposta = (answer || '').replace(/\s+/g, ' ').trim().slice(0, 500);
    out.steps.assistenteErro = (errBox || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    await shot(gpage, 'b10-assistente-ia');
  }
  out.events.gestor = { consoleErrors: c2.events.consoleErrors.slice(0, 6), badResponses: c2.events.badResponses.filter(r => !r.includes('favicon')).slice(0, 10) };
  await c2.context.close();

  // ---------- Gestor: Fila de Prioridade (IA de ordenação / no-show) ----------
  const c3 = await newContext(browser);
  const fpage = await c3.context.newPage();
  trackPage(fpage, c3.events);
  watchAi(fpage, out.aiCalls);
  await login(fpage, 'gestao');
  await navTo(fpage, 'Fila Prioridade').catch(() => {});
  await fpage.waitForTimeout(2500);
  out.steps.filaPrioridadeTexto = (await fpage.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
  await shot(fpage, 'b10-fila-prioridade');
  await c3.context.close();

  console.log('\n[10] chatbot FAB:', out.steps.chatbotFabPresente, '| abre:', out.steps.chatbotAbre);
  console.log('[10] resp clínica (deve bloquear):', out.steps.respClinica);
  console.log('[10] resp sistema (IA):', out.steps.respSistema);
  console.log('[10] resp emergência:', out.steps.respEmergencia);
  console.log('[10] assistente IA abre:', out.steps.assistenteIAAbre);
  console.log('[10] assistente resposta:', out.steps.assistenteResposta);
  console.log('[10] assistente erro:', out.steps.assistenteErro);
  console.log('[10] chamadas IA observadas:\n', out.aiCalls.join('\n'));
  console.log('\n===== JSON =====');
  console.log(JSON.stringify(out, null, 2));
} catch (err) {
  console.error('ERRO BLOCO 10:', err);
  console.log(JSON.stringify(out, null, 2));
} finally {
  await browser.close();
}
