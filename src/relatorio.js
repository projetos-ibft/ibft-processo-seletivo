// src/relatorio.js
// Função 2 — Relatório/Dashboard. Lê o Kanban do Asana (estado e tempo por
// etapa) e a aba 📊 Candidatos, calcula os 5 blocos do dashboard, escreve no
// 📈 Dashboard e gera um resumo narrativo via Claude.
//
// runRelatorio({ dryRun }) — se dryRun, não escreve na planilha; só imprime.

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const asana = require('./asana');
const sheets = require('./sheets');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const asanaIds = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, 'config', 'asana-ids.json'), 'utf8')
);
const FIELDS = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, 'config', 'asana-fields.json'), 'utf8')
);
const SECTIONS = asanaIds.sections;
const DASH = '📈 Dashboard';
const CAND_TAB = '📊 Candidatos';
const DATA_ENTREVISTA_GID = FIELDS.campos.data_entrevista;

// Ordem das linhas do funil no dashboard (L9..L20) → chave da seção em asana-ids.
const FUNIL_ORDER = [
  '👤 Candidaturas Recebidas',
  '🔍 Em Análise (IA)',
  '🔍 Em Análise (Humano)',
  '🗣️Contato inicial',
  '🖋️ Desafio',
  '🖋️ Avaliar Desafio',
  '📞 Entrevista',
  '⏳ Em Decisão Final',
  '📩 Aprovado (Aguardando Início)',
  '🧭 Onboarding - Treinamento',
  '🎉 Contratação Concluída',
  '❌Candidatos recusados',
];

const VAGA_ORDER = [
  'Copywriter',
  'Designer e Web Designer',
  'Gestor de Tráfego',
  'Social Media',
  'Supervisor Comercial',
  'Vendedor',
  'Gestor de Comunidade',
  'Analista de Suporte e Atendimento',
];

const MOTIVO_ORDER = [
  'Pretensão acima do budget',
  'Sem disponibilidade presencial',
  'Portfólio ou requisito técnico ausente',
  'Perfil fora do esperado',
  'Sem resposta ao contato',
  'Desafio não entregue',
  'Desafio ou entrevista reprovado',
  'Desistiu do processo',
];

// Gargalos: prazos por seção (em dias). tipo 'uteis' ou 'corridos'.
const GARGALO_REGRAS = {
  '🔍 Em Análise (Humano)': { prazo: 2, tipo: 'uteis' },
  '🗣️Contato inicial': { prazo: 3, tipo: 'corridos' },
  '🖋️ Desafio': { prazo: 6, tipo: 'corridos' },
  '📞 Entrevista': { prazo: 5, tipo: 'corridos', exigeSemEntrevista: true },
};

const GID = {
  recusados: SECTIONS['❌Candidatos recusados'],
  contratado: SECTIONS['🎉 Contratação Concluída'],
};

function calendarDays(from, to) {
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

function businessDays(from, to) {
  let count = 0;
  const cur = new Date(from);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  while (cur < end) {
    cur.setDate(cur.getDate() + 1);
    const d = cur.getDay();
    if (d !== 0 && d !== 6) count++;
  }
  return count;
}

function parseMoveTarget(text) {
  const m = (text || '').match(/to "([^"]+)" in /);
  return m ? m[1] : null;
}

function sectionOf(task) {
  const mem = (task.memberships || []).find(m => m.section);
  return mem ? mem.section : null;
}

function customFieldValue(task, fieldGid) {
  const cf = (task.custom_fields || []).find(c => c.gid === fieldGid);
  return cf ? cf.display_value : null;
}

// Data em que a tarefa entrou na seção atual (via stories). Fallback: created_at.
async function entrouNaSecaoEm(taskGid, sectionName, createdAt) {
  const stories = await asana.getTaskStories(taskGid);
  let entered = new Date(createdAt);
  for (const s of stories) {
    if (s.resource_subtype !== 'section_changed') continue;
    if (parseMoveTarget(s.text) === sectionName) {
      const t = new Date(s.created_at);
      if (t > entered) entered = t;
    }
  }
  return entered;
}

function alertaPara(dias, prazo) {
  if (dias > prazo + 1) return '🔴';
  if (dias >= prazo) return '🟡';
  return null;
}

async function coletarDados() {
  const projectGid = process.env.ASANA_PROJECT_GID;
  const tasks = await asana.getProjectTasks(
    projectGid,
    'name,completed,created_at,permalink_url,memberships.section.name,memberships.section.gid,custom_fields.gid,custom_fields.display_value'
  );
  const rows = await sheets.readRange(`'${CAND_TAB}'!A2:Y`);
  return { tasks, rows };
}

function gidToFunilIndex() {
  const map = {};
  FUNIL_ORDER.forEach((key, i) => {
    if (SECTIONS[key]) map[SECTIONS[key]] = i;
  });
  return map;
}

function computarFunilEVisaoGeral(tasks) {
  const funil = new Array(FUNIL_ORDER.length).fill(0);
  const map = gidToFunilIndex();
  let recebidas = 0;
  let recusados = 0;
  let contratados = 0;
  for (const task of tasks) {
    recebidas++;
    const sec = sectionOf(task);
    if (sec && map[sec.gid] != null) funil[map[sec.gid]]++;
    if (sec && sec.gid === GID.recusados) recusados++;
    if (sec && sec.gid === GID.contratado) contratados++;
  }
  const ativos = recebidas - recusados - contratados;
  return { funil, visaoGeral: { recebidas, ativos, contratados, recusados } };
}

async function computarGargalos(tasks) {
  const agora = new Date();
  const candidatos = [];
  for (const task of tasks) {
    if (task.completed) continue;
    const sec = sectionOf(task);
    if (!sec) continue;
    const regra = GARGALO_REGRAS[sec.name];
    if (!regra) continue;
    if (regra.exigeSemEntrevista && customFieldValue(task, DATA_ENTREVISTA_GID)) continue;

    const entered = await entrouNaSecaoEm(task.gid, sec.name, task.created_at);
    const dias =
      regra.tipo === 'uteis' ? businessDays(entered, agora) : calendarDays(entered, agora);
    const alerta = alertaPara(dias, regra.prazo);
    if (!alerta) continue;
    candidatos.push({
      secao: sec.name,
      candidato: task.name,
      vaga: '',
      dias,
      alerta,
      link: task.permalink_url,
    });
  }
  candidatos.sort((a, b) => b.dias - a.dias);
  return candidatos.slice(0, 6);
}

function num(v) {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
}

function computarQualidade(rows) {
  const porVaga = {};
  for (const vaga of VAGA_ORDER) porVaga[vaga] = { recebidos: 0, somaScore: 0, comScore: 0, noBudget: 0 };
  for (const r of rows) {
    const vaga = r[3];
    if (!porVaga[vaga]) continue;
    porVaga[vaga].recebidos++;
    const score = num(r[18]);
    if (score != null) {
      porVaga[vaga].somaScore += score;
      porVaga[vaga].comScore++;
    }
    const desvio = num(r[11]);
    if (desvio != null && desvio <= 0) porVaga[vaga].noBudget++;
  }
  return VAGA_ORDER.map(vaga => {
    const v = porVaga[vaga];
    const scoreMedio = v.comScore > 0 ? Math.round((v.somaScore / v.comScore) * 10) / 10 : '';
    const pctBudget = v.recebidos > 0 ? Math.round((v.noBudget / v.recebidos) * 100) + '%' : '';
    return [v.recebidos, scoreMedio, pctBudget];
  });
}

function computarMotivos(rows) {
  const contagem = {};
  for (const m of MOTIVO_ORDER) contagem[m] = 0;
  let total = 0;
  for (const r of rows) {
    const motivo = r[24];
    if (motivo && contagem[motivo] != null) {
      contagem[motivo]++;
      total++;
    }
  }
  const linhas = MOTIVO_ORDER.map(m => {
    const c = contagem[m];
    const pct = total > 0 ? Math.round((c / total) * 100) : 0;
    const barra = '█'.repeat(Math.round(pct / 5));
    return [m, c, `${pct}%`, barra];
  });
  return { linhas, total };
}

function montarUpdates(dados) {
  const { visaoGeral, funil, gargalos, qualidade, motivos } = dados;
  const agora = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  const updates = [];
  updates.push({ range: `'${DASH}'!D2`, values: [[`Atualizado: ${agora}`]] });
  updates.push({
    range: `'${DASH}'!B6:E6`,
    values: [[visaoGeral.recebidas, visaoGeral.ativos, visaoGeral.contratados, visaoGeral.recusados]],
  });
  updates.push({ range: `'${DASH}'!C9:C20`, values: funil.map(c => [c]) });

  // Gargalos: 6 linhas x 5 colunas (B24:F29), preenchendo vazias.
  const gargalosRows = [];
  for (let i = 0; i < 6; i++) {
    const g = gargalos[i];
    gargalosRows.push(g ? [g.secao, g.candidato, g.vaga, g.dias, g.alerta] : ['', '', '', '', '']);
  }
  updates.push({ range: `'${DASH}'!B24:F29`, values: gargalosRows });

  // Qualidade por vaga: C34:E41 (recebidos, score médio, % budget).
  updates.push({ range: `'${DASH}'!C34:E41`, values: qualidade });

  // Motivos: B45:E55 (8 motivos + limpar 3 linhas antigas), TOTAL em C56:D56.
  const motivoRows = [];
  for (let i = 0; i < 11; i++) {
    const l = motivos.linhas[i];
    motivoRows.push(l ? l : ['', '', '', '']);
  }
  updates.push({ range: `'${DASH}'!B45:E55`, values: motivoRows });
  updates.push({ range: `'${DASH}'!C56:D56`, values: [[motivos.total, '100%']] });

  return updates;
}

async function gerarResumo(dados) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return '(resumo não gerado: ANTHROPIC_API_KEY ausente)';
  const system =
    'Você é o assistente de RH do IBFT e do Onion. Gere um resumo narrativo direto e ' +
    'útil do processo seletivo para os líderes lerem em menos de 2 minutos. ' +
    'Responda APENAS com o texto do resumo, em prosa — sem JSON, sem markdown, sem títulos.';
  const vg = dados.visaoGeral;
  const funilTxt = FUNIL_ORDER.map((s, i) => `${s}: ${dados.funil[i]}`).join('\n');
  const gargalosTxt = dados.gargalos.length
    ? dados.gargalos.map(g => `${g.alerta} ${g.candidato} (${g.secao}) — ${g.dias} dias`).join('\n')
    : 'Nenhum gargalo identificado.';
  const motivosTxt = dados.motivos.linhas
    .filter(l => l[1] > 0)
    .map(l => `${l[0]}: ${l[1]}`)
    .join('\n') || 'Nenhuma recusa registrada.';

  const user = `Dados do processo seletivo (rodada mai-26) em ${new Date().toLocaleDateString('pt-BR')}:

VISÃO GERAL: ${vg.recebidas} candidaturas, ${vg.ativos} ativos no funil, ${vg.contratados} contratados, ${vg.recusados} recusados.

FUNIL POR ETAPA:
${funilTxt}

GARGALOS (parados além do prazo):
${gargalosTxt}

MOTIVOS DE RECUSA:
${motivosTxt}

Escreva um resumo de 8 a 12 linhas para os líderes do IBFT: status geral, gargalos que exigem ação, e uma recomendação se houver problema. Tom direto, sem enrolação. Não invente dados que não estão acima. Responda apenas com o texto do resumo.`;

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      temperature: 0.3,
      system,
      messages: [{ role: 'user', content: user }],
    });
    return res.content[0]?.text?.trim() ?? '(resumo vazio)';
  } catch (e) {
    return `(falha ao gerar resumo: ${e.message})`;
  }
}

async function runRelatorio(opts = {}) {
  const dryRun = !!opts.dryRun;
  console.log(`\n[RELATÓRIO] === Gerando ${dryRun ? '(DRY-RUN) ' : ''}===`);

  const { tasks, rows } = await coletarDados();
  console.log(`[RELATÓRIO] ${tasks.length} tarefas no Kanban, ${rows.length} candidatos na planilha`);

  const { funil, visaoGeral } = computarFunilEVisaoGeral(tasks);
  const gargalos = await computarGargalos(tasks);
  const qualidade = computarQualidade(rows);
  const motivos = computarMotivos(rows);

  const dados = { visaoGeral, funil, gargalos, qualidade, motivos };
  const updates = montarUpdates(dados);

  console.log(`[RELATÓRIO] Visão geral: ${JSON.stringify(visaoGeral)}`);
  console.log(`[RELATÓRIO] Gargalos: ${gargalos.length}`);

  if (dryRun) {
    console.log('[DRY-RUN] Escreveria no dashboard:');
    for (const u of updates) {
      console.log(`  ${u.range} = ${JSON.stringify(u.values)}`);
    }
  } else {
    await sheets.batchUpdate(updates);
    console.log('[RELATÓRIO] Dashboard atualizado.');
  }

  const resumo = await gerarResumo(dados);
  console.log('\n[RELATÓRIO] Resumo narrativo:\n' + resumo + '\n');

  return { visaoGeral, gargalos, resumo };
}

module.exports = { runRelatorio };

// Permite rodar direto: node src/relatorio.js [--dry-run]
if (require.main === module) {
  require('dotenv').config({ path: path.join(PROJECT_ROOT, '.env') });
  runRelatorio({ dryRun: process.argv.includes('--dry-run') })
    .then(() => {
      process.exitCode = 0;
    })
    .catch(e => {
      console.error(`[RELATÓRIO] ERRO FATAL: ${e.message}`);
      console.error(e.stack);
      process.exitCode = 1;
    });
}
