// scripts/setup.js
// Setup do projeto.
//
// Uso:
//   node scripts/setup.js              # busca seções do Kanban e grava config/asana-ids.json
//   node scripts/setup.js --validate   # valida conexões: Asana, Sheets, Anthropic, CONTEXT.md

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const fs = require('fs');
const asana = require('../src/asana');
const sheetsApi = require('../src/sheets');
const contextLib = require('../src/context');
const Anthropic = require('@anthropic-ai/sdk');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(PROJECT_ROOT, 'config', 'asana-ids.json');

async function discoverSections() {
  const projectGid = process.env.ASANA_PROJECT_GID;
  if (!projectGid) throw new Error('ASANA_PROJECT_GID não definido no .env');

  console.log(`[SETUP] Buscando seções do projeto ${projectGid}...`);
  const sections = await asana.getProjectSections(projectGid);

  console.log(`[SETUP] Encontradas ${sections.length} seções:`);
  const map = {};
  for (const s of sections) {
    console.log(`  - ${s.name}: ${s.gid}`);
    map[s.name] = s.gid;
  }

  const current = fs.existsSync(CONFIG_PATH)
    ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))
    : {};
  const output = {
    _comentario:
      current._comentario ||
      'Arquivo gerado por scripts/setup.js. Não editar manualmente. ' +
        'Contém os GIDs das seções do Kanban do projeto 👥 Kanban Processo Seletivo (1209988064308562).',
    sections: map,
    updated_at: new Date().toISOString(),
  };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`[SETUP] Salvo em ${path.relative(PROJECT_ROOT, CONFIG_PATH)}`);
  return map;
}

async function validateAsana() {
  try {
    const me = await asana.getMe();
    return `OK — autenticado como ${me.name} <${me.email}>`;
  } catch (e) {
    return `ERRO — ${e.response?.data?.errors?.[0]?.message ?? e.message}`;
  }
}

async function validateSheets() {
  try {
    const meta = await sheetsApi.getSheetMetadata();
    return `OK — planilha "${meta.title}" | abas: ${meta.tabs.join(', ')}`;
  } catch (e) {
    return `ERRO — ${e.message}`;
  }
}

async function validateAnthropic() {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY não definido no .env');
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Responda apenas: ok' }],
    });
    const text = res.content[0]?.text?.trim() ?? '(vazio)';
    return `OK — modelo ${res.model}, resposta: "${text}"`;
  } catch (e) {
    return `ERRO — ${e.message}`;
  }
}

function validateContext() {
  try {
    const ctx = contextLib.loadContext();
    const fresh = contextLib.validateContextFreshness(ctx);
    return fresh
      ? `OK — última atualização há ${ctx.daysSinceUpdate} dia(s)`
      : `AVISO — desatualizado há ${ctx.daysSinceUpdate} dias`;
  } catch (e) {
    return `ERRO — ${e.message}`;
  }
}

async function validateAll() {
  console.log('[SETUP] Validando conexões...\n');
  const [asanaR, sheetsR, anthropicR] = await Promise.all([
    validateAsana(),
    validateSheets(),
    validateAnthropic(),
  ]);
  const contextR = validateContext();

  console.log(`  Asana:     ${asanaR}`);
  console.log(`  Sheets:    ${sheetsR}`);
  console.log(`  Anthropic: ${anthropicR}`);
  console.log(`  Context:   ${contextR}`);

  const all = [asanaR, sheetsR, anthropicR, contextR];
  const hasError = all.some(r => r.startsWith('ERRO'));
  if (hasError) {
    console.error('\n[SETUP] Uma ou mais validações falharam.');
    process.exit(1);
  }
  console.log('\n[SETUP] Tudo OK ✓');
}

async function main() {
  const mode = process.argv.includes('--validate') ? 'validate' : 'sections';
  try {
    if (mode === 'sections') {
      await discoverSections();
    } else {
      await validateAll();
    }
  } catch (e) {
    console.error(`[SETUP] ERRO FATAL: ${e.message}`);
    if (e.response?.data) {
      console.error('Detalhes da API:', JSON.stringify(e.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
