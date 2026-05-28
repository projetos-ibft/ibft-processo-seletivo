// scripts/inspect-task.js
// Ferramenta de debug: inspeciona uma tarefa do Asana e mostra estrutura
// (descrição, custom_fields, attachments, seção). Útil para calibrar o parser.
//
// Uso:
//   node scripts/inspect-task.js <task_gid>

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const asana = require('../src/asana');

async function main() {
  const taskGid = process.argv[2];
  if (!taskGid) {
    console.error('Uso: node scripts/inspect-task.js <task_gid>');
    process.exit(1);
  }

  const fields = [
    'name',
    'notes',
    'html_notes',
    'permalink_url',
    'created_at',
    'completed',
    'memberships.section.name',
    'memberships.section.gid',
    'custom_fields.name',
    'custom_fields.gid',
    'custom_fields.display_value',
    'custom_fields.text_value',
    'custom_fields.number_value',
    'custom_fields.enum_value',
    'custom_fields.multi_enum_values',
    'custom_fields.type',
    'custom_fields.resource_subtype',
  ].join(',');

  console.log(`[INSPECT] Buscando tarefa ${taskGid}...\n`);
  const task = await asana.getTask(taskGid, fields);

  console.log('=== INFORMAÇÕES BÁSICAS ===');
  console.log(`Nome:       ${task.name}`);
  console.log(`URL:        ${task.permalink_url}`);
  console.log(`Criada em:  ${task.created_at}`);
  console.log(`Concluída:  ${task.completed}`);

  console.log('\n=== SEÇÃO ATUAL ===');
  const mem = (task.memberships || []).find(m => m.section);
  if (mem) {
    console.log(`Nome: ${mem.section.name}`);
    console.log(`GID:  ${mem.section.gid}`);
  } else {
    console.log('(sem seção)');
  }

  console.log('\n=== DESCRIÇÃO (notes — texto puro) ===');
  console.log(task.notes || '(vazia)');

  console.log('\n=== CUSTOM FIELDS ===');
  if (!task.custom_fields || task.custom_fields.length === 0) {
    console.log('(nenhum custom field preenchido)');
  } else {
    for (const cf of task.custom_fields) {
      const value =
        cf.display_value ??
        cf.text_value ??
        cf.number_value ??
        cf.enum_value?.name ??
        (cf.multi_enum_values || []).map(v => v.name).join(', ') ??
        '(vazio)';
      console.log(`  [${cf.gid}] ${cf.name} (${cf.resource_subtype}): ${value}`);
    }
  }

  console.log('\n=== ATTACHMENTS ===');
  const attachments = await asana.getTaskAttachments(taskGid);
  if (attachments.length === 0) {
    console.log('(sem anexos)');
  } else {
    for (const a of attachments) {
      console.log(`  [${a.gid}] ${a.name} (${a.resource_type})`);
    }
  }
}

main().catch(e => {
  console.error(`ERRO: ${e.message}`);
  if (e.response?.data) console.error(JSON.stringify(e.response.data, null, 2));
  process.exit(1);
});
