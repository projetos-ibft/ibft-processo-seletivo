// src/triagem.js
// Orquestrador da Função 1 (triagem). Coordena parser → curriculo → linkedin →
// analise → asana → sheets, aplicando as regras do AGENTS.md §6.
//
// processarTarefa(taskGid, { dryRun }) — se dryRun=true, executa toda a análise
// mas NÃO move a tarefa, não posta comentário, não escreve campos nem planilha;
// apenas retorna/loga o que faria. Útil para validar antes de ativar de verdade.

const fs = require('fs');
const path = require('path');
const asana = require('./asana');
const sheets = require('./sheets');
const parser = require('./parser');
const curriculo = require('./curriculo');
const linkedin = require('./linkedin');
const analise = require('./analise');
const contextLib = require('./context');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const FIELDS = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, 'config', 'asana-fields.json'), 'utf8')
);
const SHEET_TAB = '📊 Candidatos';
const MES_ANO = 'mai-26';

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function colLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

async function moverPara(taskGid, destinoKey, dryRun) {
  const d = FIELDS.destinos[destinoKey];
  if (!d) throw new Error(`Destino "${destinoKey}" não definido em asana-fields.json`);
  if (dryRun) {
    console.log(`[DRY-RUN] Moveria para ${d._nome_secao} e setaria [Etapas] RH correspondente`);
    return;
  }
  await asana.moveTaskToSection(taskGid, d.secao_gid);
  await asana.updateCustomFieldEnum(taskGid, FIELDS.campos.etapas_rh, d.etapa_rh_gid);
}

function montarLinha({ id, task, dados, vagaInfo, r, statusAtual }) {
  const reprovadoD1 = r.resultado === 'REPROVADO_D1';
  const d1 = reprovadoD1 ? `Reprovado: ${r.motivo_d1 || ''}`.trim() : 'Passou';
  const desvio = dados.pretensao != null && vagaInfo.budget != null
    ? dados.pretensao - vagaInfo.budget
    : '';
  const agora = formatDate(new Date().toISOString());
  return [
    id,                                  // 1  ID
    MES_ANO,                             // 2  Mês/Ano
    formatDate(task.created_at),         // 3  Data de entrada
    dados.vaga || '',                    // 4  Vaga
    dados.nome || '',                    // 5  Nome
    dados.email || '',                   // 6  E-mail
    dados.whatsapp || '',                // 7  WhatsApp
    dados.cidade || '',                  // 8  Cidade
    dados.presencial_raw || '',          // 9  Disponibilidade presencial
    dados.pretensao ?? '',               // 10 Pretensão salarial
    vagaInfo.budget ?? '',               // 11 Budget da vaga
    desvio,                              // 12 Desvio da pretensão (R$)
    dados.disponibilidade_inicio || '',  // 13 Disponibilidade de início
    dados.link_portfolio || '',          // 14 Link do portfólio
    d1,                                  // 15 D1 — Eliminatório
    r.score_d2 ?? '',                    // 16 Score D2
    r.score_d3 ?? '',                    // 17 Score D3
    r.score_d4 ?? '',                    // 18 Score D4
    r.score_total ?? '',                 // 19 Score total
    statusAtual,                         // 20 Status atual
    r.comentario_asana || '',            // 21 Comentário IA
    task.permalink_url || '',            // 22 Link da tarefa Asana
    agora,                               // 23 Data da análise IA
    agora,                               // 24 Data de atualização do status
    r.motivo_recusa_asana || '',         // 25 Motivo da recusa
  ];
}

async function gravarPlanilha({ taskGid, task, dados, vagaInfo, r, statusAtual, dryRun }) {
  const numCols = 25;
  const lastCol = colLetter(numCols);
  const rangeAll = `'${SHEET_TAB}'!A:${lastCol}`;

  const rows = await sheets.readRange(rangeAll);
  const dataRows = rows.slice(1); // pula header

  // Procurar candidato existente pelo link da tarefa (coluna 22, índice 21)
  let existingIdx = -1;
  for (let i = 0; i < dataRows.length; i++) {
    const link = dataRows[i][21] || '';
    if (link.includes(taskGid)) {
      existingIdx = i;
      break;
    }
  }

  let id;
  if (existingIdx >= 0) {
    id = dataRows[existingIdx][0] || gerarProximoId(dataRows);
  } else {
    id = gerarProximoId(dataRows);
  }

  const linha = montarLinha({ id, task, dados, vagaInfo, r, statusAtual });

  if (dryRun) {
    console.log(`[DRY-RUN] Gravaria na planilha (ID ${id}, ${existingIdx >= 0 ? 'atualizar' : 'nova linha'}):`);
    console.log('[DRY-RUN] ' + JSON.stringify(linha));
    return id;
  }

  if (existingIdx >= 0) {
    const sheetRow = existingIdx + 2; // +1 header, +1 base-1
    await sheets.updateRow(`'${SHEET_TAB}'!A${sheetRow}:${lastCol}${sheetRow}`, linha);
  } else {
    await sheets.appendRow(rangeAll, linha);
  }
  return id;
}

function gerarProximoId(dataRows) {
  let max = 0;
  for (const row of dataRows) {
    const m = String(row[0] || '').match(/PS-(\d+)/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `PS-${String(max + 1).padStart(3, '0')}`;
}

async function postComment(taskGid, text, dryRun) {
  if (dryRun) {
    console.log(`[DRY-RUN] Postaria comentário:\n${text}\n`);
    return;
  }
  await asana.postComment(taskGid, text);
}

async function processarTarefa(taskGid, opts = {}) {
  const dryRun = !!opts.dryRun;
  console.log(`\n[TRIAGEM] === Tarefa ${taskGid}${dryRun ? ' (DRY-RUN)' : ''} ===`);

  const task = await asana.getTask(
    taskGid,
    'name,notes,permalink_url,created_at'
  );

  // Passo 3-4: mover para Em Análise (IA)
  await moverPara(taskGid, 'em_analise_ia', dryRun);

  // Passo 5: contexto
  const ctx = contextLib.loadContext();
  contextLib.validateContextFreshness(ctx);
  const vagas = contextLib.loadVagas();

  // Passo 6: parser
  const dados = parser.parseForm(task.notes);
  console.log(`[TRIAGEM] Candidato: ${dados.nome} | Vaga: ${dados.vaga} | Pretensão: R$ ${dados.pretensao}`);

  // Passo 7: identificar vaga
  const vagaInfo = vagas[dados.vaga];
  if (!vagaInfo) {
    const msg =
      `[TRIAGEM IA] Vaga não reconhecida\n` +
      `Resultado: Encaminhado para análise humana\n\n` +
      `Motivo: A vaga "${dados.vaga}" não consta na lista de vagas ativas desta rodada.`;
    await postComment(taskGid, msg, dryRun);
    await moverPara(taskGid, 'em_analise_humano', dryRun);
    return { status: 'vaga_nao_reconhecida', vaga: dados.vaga };
  }

  // Passo 8: currículo
  const cv = await curriculo.extrairCurriculo(taskGid);
  if (!cv.ok) {
    console.warn(`[TRIAGEM] Currículo não lido: ${cv.motivo}`);
    if (!dryRun) {
      await asana.updateCustomFieldEnum(
        taskGid,
        FIELDS.campos.status_rh,
        FIELDS.status_rh_opcoes['Currículo não lido']
      );
    } else {
      console.log('[DRY-RUN] Setaria 📝[RH] Status = "Currículo não lido"');
    }
    const msg =
      `[TRIAGEM IA] Currículo não lido\n` +
      `Resultado: Encaminhado para análise humana\n\n` +
      `Motivo: O currículo anexado não pôde ser processado (${cv.motivo}).\n` +
      `Ação necessária: revisar o currículo manualmente antes de prosseguir com a avaliação.\n` +
      `Dados do formulário estão disponíveis normalmente na descrição da tarefa.`;
    await postComment(taskGid, msg, dryRun);
    await moverPara(taskGid, 'em_analise_humano', dryRun);
    return { status: 'curriculo_nao_lido', motivo: cv.motivo };
  }
  console.log(`[TRIAGEM] Currículo lido: ${cv.nomeArquivo} (${cv.texto.length} chars)`);

  // Passo 9: LinkedIn (best-effort)
  const li = await linkedin.obterLinkedin(dados.linkedin_url);
  const dadosLinkedin = li.ok ? li.texto : `Perfil não acessível (${li.motivo})`;
  console.log(`[TRIAGEM] LinkedIn: ${li.ok ? 'acessado' : li.motivo}`);

  // Passo 10-11: análise via Claude
  const res = await analise.analisarCandidato({
    vagaInfo,
    dados,
    textoCurriculo: cv.texto,
    dadosLinkedin,
  });
  if (!res.ok) {
    const msg =
      `[TRIAGEM IA] Erro na análise automática\n` +
      `Resultado: Encaminhado para análise humana\n\n` +
      `Motivo: A análise por IA falhou após múltiplas tentativas (${res.erro}).`;
    await postComment(taskGid, msg, dryRun);
    await moverPara(taskGid, 'em_analise_humano', dryRun);
    return { status: 'erro_analise', erro: res.erro };
  }
  const r = res.resultado;
  console.log(`[TRIAGEM] Resultado IA: ${r.resultado} | Score: ${r.score_total ?? '—'}/10`);

  // Destino
  const aprovado = r.resultado === 'APROVADO' && (r.score_total ?? 0) >= 7;
  const destinoKey = aprovado ? 'em_analise_humano' : 'recusados';
  const statusAtual = FIELDS.destinos[destinoKey]._nome_secao;

  // Passo 12: gravar planilha ANTES de mover
  try {
    await gravarPlanilha({ taskGid, task, dados, vagaInfo, r, statusAtual, dryRun });
  } catch (e) {
    console.error(`[TRIAGEM] ERRO ao gravar planilha: ${e.message}. NÃO movendo a tarefa.`);
    return { status: 'erro_planilha', erro: e.message };
  }

  // Passo 13: comentário
  await postComment(taskGid, r.comentario_asana, dryRun);

  // Passo 14: motivo de recusa (se reprovado)
  if (!aprovado) {
    const motivoGid = FIELDS.motivo_recusa_opcoes[r.motivo_recusa_asana];
    if (!motivoGid) {
      console.warn(`[TRIAGEM] Motivo "${r.motivo_recusa_asana}" não mapeado em asana-fields.json`);
    } else if (dryRun) {
      console.log(`[DRY-RUN] Setaria ⛔[RH] Motivo da recusa = "${r.motivo_recusa_asana}"`);
    } else {
      await asana.updateCustomFieldEnum(taskGid, FIELDS.campos.motivo_recusa, motivoGid);
    }
  }

  // Passo 15-16: mover para destino
  await moverPara(taskGid, destinoKey, dryRun);

  console.log(`[TRIAGEM] Concluído: ${aprovado ? 'APROVADO → Análise Humana' : 'REPROVADO → Recusados'}`);
  return { status: 'ok', aprovado, resultado: r };
}

module.exports = { processarTarefa };
