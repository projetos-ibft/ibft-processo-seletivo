// src/parser.js
// Extrai campos estruturados da descrição (notes) de uma tarefa do Asana.
// A vaga é identificada pelo rodapé do formulário (definido pelo RH), nunca
// pelo dropdown preenchido pelo candidato. O fit cultural é a pergunta logo
// antes do campo opcional "Tem algo mais que você gostaria de compartilhar".

const FIXED_LABELS = {
  nome: 'Nome completo',
  email: 'Endereço de e-mail',
  whatsapp: 'Telefone com DDD (WhatsApp)',
  linkedin_url: 'LinkedIn (opcional)',
  pretensao_raw: 'Qual sua pretensão salarial mensal (PJ)?',
  disponibilidade_inicio: 'Disponibilidade para início',
  presencial_raw:
    'A vaga é 100% presencial em São José dos Campos, SP. Você está ciente e de acordo?',
  cidade_disponibilidade:
    'Cidade atual e disponibilidade para trabalho presencial em São José dos Campos, SP',
  link_portfolio: 'Link do portfólio',
};

const VAGA_DROPDOWN_LABEL = 'Para qual vaga você está aplicando?';
const EXTRA_OPTIONAL_LABEL = 'Tem algo mais que você gostaria de compartilhar conosco?';

// Linha de traços que separa o corpo do rodapé do formulário.
const SEPARATOR_RE = /\n[—–\-_]{5,}\n/;

function splitBodyFooter(notes) {
  const parts = notes.split(SEPARATOR_RE);
  if (parts.length < 2) return { body: notes, footer: '' };
  return { body: parts[0], footer: parts.slice(1).join('\n') };
}

function extractVaga(footer) {
  // O rodapé real do Asana usa "Processo Seletivo" (singular, sem "s"):
  //   "Esta tarefa foi enviada através de 🟢[Processo Seletivo] Copywriter (mai-26)"
  const m = footer.match(/\[Processo Seletivo\]\s*(.+?)\s*\(\w{3}-\d{2}\)/);
  return m ? m[1].trim() : null;
}

// Normaliza um nome de vaga para comparação: remove o sufixo de rodada
// "(mai-26)" e a anotação "(3 vagas)", tira espaços e baixa a caixa. Usado
// para comparar a vaga do rodapé (fonte confiável) com a vaga declarada pelo
// candidato no dropdown, que pode vir com o sufixo da rodada.
function normalizeVaga(s) {
  if (!s) return null;
  return s
    .replace(/\s*\(\d+\s+vagas?\)\s*$/i, '') // "(3 vagas)"
    .replace(/\s*\(\w{3}-\d{2}\)\s*$/i, '') // "(mai-26)" / "(jun-26)"
    .trim()
    .toLowerCase();
}

// Divergência: o candidato acessou o formulário de uma vaga (rodapé) mas
// declarou outra no campo "Para qual vaga você está aplicando?". Só acusa
// divergência quando os dois valores existem e são diferentes — campo em
// branco não bloqueia a triagem.
function vagasDivergem(vagaRodape, vagaDeclarada) {
  const a = normalizeVaga(vagaRodape);
  const b = normalizeVaga(vagaDeclarada);
  if (!a || !b) return false;
  return a !== b;
}

function parseQAPairs(body) {
  const lines = body.split('\n');
  const pairs = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (line === '') {
      i++;
      continue;
    }
    if (line.endsWith(':')) {
      const label = line.slice(0, -1).trim();
      i++;
      const answerLines = [];
      while (i < lines.length && lines[i].trim() !== '') {
        answerLines.push(lines[i].trim());
        i++;
      }
      pairs.push({ label, answer: answerLines.join('\n').trim() });
    } else {
      i++;
    }
  }
  return pairs;
}

function findPair(pairs, label) {
  return pairs.find(p => p.label === label) || null;
}

function parsePretensao(raw) {
  if (!raw) return null;
  const cleaned = raw
    .replace(/r\$/i, '')
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}(\D|$))/g, '') // remove pontos de milhar
    .replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isNaN(num) ? null : Math.round(num);
}

function parsePresencial(raw) {
  if (!raw) return null;
  return /^sim/i.test(raw.trim());
}

function parseForm(notes) {
  const { body, footer } = splitBodyFooter(notes || '');
  const vaga = extractVaga(footer);
  const pairs = parseQAPairs(body);

  // Vaga que o candidato declarou no dropdown (pode divergir do rodapé).
  const vagaDeclaradaPair = findPair(pairs, VAGA_DROPDOWN_LABEL);
  const vagaDeclarada = vagaDeclaradaPair ? vagaDeclaradaPair.answer : null;

  const fixed = {};
  for (const [key, label] of Object.entries(FIXED_LABELS)) {
    const pair = findPair(pairs, label);
    fixed[key] = pair ? pair.answer : null;
  }

  // Fit cultural: pergunta imediatamente antes de "Tem algo mais...".
  const extraIdx = pairs.findIndex(p => p.label.startsWith(EXTRA_OPTIONAL_LABEL));
  let respostaFitCultural = null;
  let fitLabel = null;
  if (extraIdx > 0) {
    const fitPair = pairs[extraIdx - 1];
    respostaFitCultural = `${fitPair.label}\n${fitPair.answer}`;
    fitLabel = fitPair.label;
  } else if (pairs.length > 0) {
    const fitPair = pairs[pairs.length - 1];
    respostaFitCultural = `${fitPair.label}\n${fitPair.answer}`;
    fitLabel = fitPair.label;
    console.warn(
      '[PARSER] AVISO: "Tem algo mais..." não encontrado; usando a última pergunta como fit cultural.'
    );
  }

  // Respostas técnicas: tudo que não é campo fixo, dropdown de vaga ou fit cultural.
  const exclude = new Set([...Object.values(FIXED_LABELS), VAGA_DROPDOWN_LABEL, fitLabel]);
  const respostasTecnicas = pairs
    .filter(p => !exclude.has(p.label))
    .map(p => `${p.label}:\n${p.answer}`)
    .join('\n\n');

  return {
    vaga,
    vaga_declarada: vagaDeclarada,
    nome: fixed.nome,
    email: fixed.email,
    whatsapp: fixed.whatsapp,
    linkedin_url: fixed.linkedin_url || null,
    cidade: fixed.cidade_disponibilidade,
    pretensao: parsePretensao(fixed.pretensao_raw),
    pretensao_raw: fixed.pretensao_raw,
    disponibilidade_inicio: fixed.disponibilidade_inicio,
    presencial_aceito: parsePresencial(fixed.presencial_raw),
    presencial_raw: fixed.presencial_raw,
    link_portfolio: fixed.link_portfolio || null,
    resposta_fit_cultural: respostaFitCultural,
    respostas_tecnicas: respostasTecnicas,
  };
}

module.exports = {
  parseForm,
  parseQAPairs,
  extractVaga,
  normalizeVaga,
  vagasDivergem,
  parsePretensao,
  parsePresencial,
  splitBodyFooter,
  FIXED_LABELS,
};
