// scripts/test-triagem.js
// Roda a triagem completa em uma tarefa. Por padrão em DRY-RUN (não altera nada).
// Passe --real para executar de verdade (move tarefa, posta comentário, grava planilha).
//
// Uso:
//   node scripts/test-triagem.js <task_gid>           # simulação
//   node scripts/test-triagem.js <task_gid> --real    # execução real

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const triagem = require('../src/triagem');

async function main() {
  const taskGid = process.argv[2];
  if (!taskGid) {
    console.error('Uso: node scripts/test-triagem.js <task_gid> [--real]');
    process.exit(1);
  }
  const dryRun = !process.argv.includes('--real');

  const result = await triagem.processarTarefa(taskGid, { dryRun });

  console.log('\n=== RESULTADO FINAL ===');
  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => {
  console.error(`ERRO FATAL: ${e.message}`);
  console.error(e.stack);
  process.exit(1);
});
