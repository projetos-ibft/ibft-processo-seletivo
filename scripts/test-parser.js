// scripts/test-parser.js
// Ferramenta de debug: busca uma tarefa real, roda o parser e imprime o
// resultado estruturado. Útil para validar o parsing da descrição.
//
// Uso:
//   node scripts/test-parser.js <task_gid>

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const asana = require('../src/asana');
const parser = require('../src/parser');

async function main() {
  const taskGid = process.argv[2];
  if (!taskGid) {
    console.error('Uso: node scripts/test-parser.js <task_gid>');
    process.exit(1);
  }

  const task = await asana.getTask(taskGid, 'name,notes');
  const parsed = parser.parseForm(task.notes);

  console.log('=== CAMPOS ESTRUTURADOS EXTRAÍDOS ===\n');
  console.log(`Vaga (do rodapé):       ${parsed.vaga}`);
  console.log(`Nome:                   ${parsed.nome}`);
  console.log(`E-mail:                 ${parsed.email}`);
  console.log(`WhatsApp:               ${parsed.whatsapp}`);
  console.log(`LinkedIn:               ${parsed.linkedin_url}`);
  console.log(`Cidade/disponibilidade: ${parsed.cidade}`);
  console.log(`Pretensão (parseada):   R$ ${parsed.pretensao}`);
  console.log(`Pretensão (texto bruto):${parsed.pretensao_raw}`);
  console.log(`Disponib. início:       ${parsed.disponibilidade_inicio}`);
  console.log(`Presencial aceito:      ${parsed.presencial_aceito} (raw: "${parsed.presencial_raw}")`);
  console.log(`Link portfólio:         ${parsed.link_portfolio}`);

  console.log('\n=== RESPOSTA FIT CULTURAL (D3) ===\n');
  console.log(parsed.resposta_fit_cultural || '(não encontrada)');

  console.log('\n=== RESPOSTAS TÉCNICAS (D2 — bloco completo) ===\n');
  console.log(parsed.respostas_tecnicas || '(nenhuma)');
}

main().catch(e => {
  console.error(`ERRO: ${e.message}`);
  process.exit(1);
});
