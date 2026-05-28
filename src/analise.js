// src/analise.js
// Monta o prompt a partir de prompts/triagem.md, chama a API da Anthropic
// (claude-sonnet-4-6, temperatura 0.2), valida que o retorno é JSON e faz
// retry 3x com backoff. Grava prompt+resposta em logs/ para auditoria.

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PROMPT_PATH = path.join(PROJECT_ROOT, 'prompts', 'triagem.md');
const LOGS_DIR = path.join(PROJECT_ROOT, 'logs');

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2000;
const TEMPERATURE = 0.2;

let client = null;
function getClient() {
  if (client) return client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY não definido no .env');
  client = new Anthropic({ apiKey });
  return client;
}

function extractFencedBlock(text, heading) {
  const re = new RegExp(`##\\s*${heading}\\s*\\n+\`\`\`([\\s\\S]*?)\`\`\``, 'i');
  const m = text.match(re);
  if (!m) throw new Error(`Bloco "${heading}" não encontrado em triagem.md`);
  return m[1].trim();
}

function loadPromptTemplates() {
  const text = fs.readFileSync(PROMPT_PATH, 'utf8');
  return {
    system: extractFencedBlock(text, 'System prompt'),
    user: extractFencedBlock(text, 'User prompt'),
  };
}

function fillTemplate(template, values) {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    if (key in values && values[key] != null && values[key] !== '') {
      return String(values[key]);
    }
    return '(não informado)';
  });
}

function montarValores({ vagaInfo, dados, textoCurriculo, dadosLinkedin }) {
  return {
    nome_vaga: vagaInfo.nome_vaga,
    budget: vagaInfo.budget,
    budget_maximo: vagaInfo.budget_maximo,
    requisito_tecnico_minimo: vagaInfo.requisito_tecnico_minimo,
    portfolio_obrigatorio: vagaInfo.portfolio_obrigatorio,
    descritivo_vaga: vagaInfo.descritivo_vaga,
    nome: dados.nome,
    email: dados.email,
    whatsapp: dados.whatsapp,
    cidade: dados.cidade,
    disponibilidade_presencial: dados.presencial_raw,
    pretensao: dados.pretensao,
    disponibilidade_inicio: dados.disponibilidade_inicio,
    link_portfolio: dados.link_portfolio,
    linkedin_url: dados.linkedin_url,
    texto_curriculo: textoCurriculo,
    dados_linkedin: dadosLinkedin,
    respostas_tecnicas: dados.respostas_tecnicas,
    resposta_fit_cultural: dados.resposta_fit_cultural,
  };
}

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Resposta não contém JSON parseável');
  }
}

function logAuditoria(nome, system, user, raw) {
  try {
    if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const safe = (nome || 'candidato').replace(/[^\w]/g, '_');
    const file = path.join(LOGS_DIR, `triagem-${safe}-${ts}.log`);
    fs.writeFileSync(
      file,
      `=== SYSTEM ===\n${system}\n\n=== USER ===\n${user}\n\n=== RESPOSTA ===\n${raw}\n`,
      'utf8'
    );
  } catch (e) {
    console.warn(`[ANALISE] Não foi possível gravar log de auditoria: ${e.message}`);
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function analisarCandidato(input) {
  const templates = loadPromptTemplates();
  const valores = montarValores(input);
  const userPrompt = fillTemplate(templates.user, valores);
  const systemPrompt = templates.system;

  let lastErr = null;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const response = await getClient().messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const raw = response.content[0]?.text ?? '';
      logAuditoria(input.dados?.nome, systemPrompt, userPrompt, raw);
      const resultado = extractJson(raw);
      return { ok: true, resultado, raw };
    } catch (e) {
      lastErr = e;
      console.error(`[ANALISE] Tentativa ${tentativa}/3 falhou: ${e.message}`);
      if (tentativa < 3) await sleep(5000 * tentativa);
    }
  }
  return { ok: false, erro: lastErr ? lastErr.message : 'desconhecido', resultado: null };
}

module.exports = {
  analisarCandidato,
  loadPromptTemplates,
  fillTemplate,
  extractJson,
  montarValores,
};
