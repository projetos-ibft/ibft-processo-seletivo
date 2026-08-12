// src/context.js
// Carrega e valida o CONTEXT.md no início da execução.
// Extrai: data de última atualização, vagas ativas, budgets, requisito técnico
// mínimo e flag portfolio_obrigatorio por vaga.

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONTEXT_PATH = path.join(PROJECT_ROOT, 'CONTEXT.md');

function loadContext() {
  if (!fs.existsSync(CONTEXT_PATH)) {
    throw new Error(`CONTEXT.md não encontrado em ${CONTEXT_PATH}`);
  }
  const text = fs.readFileSync(CONTEXT_PATH, 'utf8');

  const dateMatch = text.match(/Última atualização:\s*(\d{4}-\d{2}-\d{2})/);
  if (!dateMatch) {
    throw new Error('CONTEXT.md sem campo "Última atualização: YYYY-MM-DD"');
  }
  const lastUpdate = new Date(dateMatch[1]);
  const daysSinceUpdate = Math.floor(
    (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return { text, lastUpdate, daysSinceUpdate };
}

function validateContextFreshness(ctx, maxDays = 7) {
  if (ctx.daysSinceUpdate > maxDays) {
    console.warn(
      `[CONTEXT] AVISO: CONTEXT.md tem ${ctx.daysSinceUpdate} dias ` +
        `(limite ${maxDays}). Notificar Charles antes de processar.`
    );
    return false;
  }
  return true;
}

function parseVagasAtivas(text) {
  // A seção "Vagas ativas" pode conter mais de um bloco de código (ex.: o
  // exemplo do rodapé do formulário antes da lista). Selecionar o bloco que
  // de fato é a lista — o que tem itens iniciados por "- ".
  const sec = text.match(/### Vagas ativas desta rodada([\s\S]*?)(?=^## )/m);
  if (!sec) throw new Error('CONTEXT.md: seção de vagas ativas não encontrada');
  const blocks = [...sec[1].matchAll(/```([\s\S]*?)```/g)].map(b => b[1]);
  const listBlock = blocks.find(b => /^\s*-\s+/m.test(b));
  if (!listBlock) throw new Error('CONTEXT.md: lista de vagas ativas não encontrada');
  return listBlock
    .split('\n')
    .map(line =>
      line
        .replace(/^\s*-\s*/, '')
        .replace(/\s*\(\d+\s+vagas?\)\s*$/i, '') // "(3 vagas)"
        .replace(/\s*\(\w{3}-\d{2}\)\s*$/i, '') // "(mai-26)" / "(jun-26)"
        .trim()
    )
    .filter(Boolean);
}

function parseBudgets(text) {
  const section = text.match(/## 4\. Budgets[\s\S]*?(?=## 5\.)/);
  if (!section) throw new Error('CONTEXT.md: seção 4 (Budgets) não encontrada');

  const budgets = {};
  const lineRe = /^\|\s*([^|]+?)\s*\|\s*R\$\s*([\d.,]+)[^|]*\|/gm;
  let m;
  while ((m = lineRe.exec(section[0])) !== null) {
    const vaga = m[1].trim();
    if (vaga === 'Vaga' || vaga.startsWith('---')) continue;
    const budget = parseInt(m[2].replace(/[.,]/g, ''), 10);
    if (!Number.isNaN(budget)) budgets[vaga] = budget;
  }
  return budgets;
}

function parseDescritivos(text, vagas) {
  const descritivos = {};
  for (const vaga of vagas) {
    const escaped = vaga.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const blockRe = new RegExp(`### ${escaped}\\b[\\s\\S]*?(?=^### |^## 4\\.)`, 'm');
    const m = text.match(blockRe);
    if (!m) {
      console.warn(`[CONTEXT] AVISO: descritivo de "${vaga}" não encontrado`);
      continue;
    }
    const block = m[0];

    const reqMatch = block.match(/\*\*Requisito técnico mínimo eliminatório:\*\*\s*([^\n]+)/);
    const requisitoTecnicoMinimo = reqMatch ? reqMatch[1].trim() : null;

    const portfolioObrigatorio =
      requisitoTecnicoMinimo != null &&
      /portf[óo]lio[^.]*ausente/i.test(requisitoTecnicoMinimo);

    descritivos[vaga] = {
      descritivo_vaga: block.trim(),
      requisito_tecnico_minimo: requisitoTecnicoMinimo,
      portfolio_obrigatorio: portfolioObrigatorio,
    };
  }
  return descritivos;
}

function loadVagas() {
  const ctx = loadContext();
  const vagas = parseVagasAtivas(ctx.text);
  const budgets = parseBudgets(ctx.text);
  const descritivos = parseDescritivos(ctx.text, vagas);

  const result = {};
  for (const vaga of vagas) {
    result[vaga] = {
      nome_vaga: vaga,
      budget: budgets[vaga] ?? null,
      budget_maximo: budgets[vaga] != null ? budgets[vaga] + 1500 : null,
      ...descritivos[vaga],
    };
  }
  return result;
}

module.exports = {
  CONTEXT_PATH,
  loadContext,
  validateContextFreshness,
  parseVagasAtivas,
  parseBudgets,
  parseDescritivos,
  loadVagas,
};
