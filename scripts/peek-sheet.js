// scripts/peek-sheet.js
// Ferramenta de debug: imprime as linhas da aba 📊 Candidatos.
// Uso: node scripts/peek-sheet.js

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const sheets = require('../src/sheets');

async function main() {
  const rows = await sheets.readRange("'📊 Candidatos'!A1:Y10");
  console.log(`Total de linhas lidas: ${rows.length}\n`);
  rows.forEach((row, i) => {
    const label = i === 0 ? 'HEADER' : `linha ${i}`;
    console.log(`[${label}] ${row.slice(0, 6).join(' | ')} ...`);
  });
  if (rows.length > 1) {
    console.log('\n=== ÚLTIMA LINHA DE DADOS (completa) ===');
    const last = rows[rows.length - 1];
    last.forEach((v, i) => console.log(`  col ${i + 1}: ${String(v).slice(0, 80)}`));
  }
}

main().catch(e => {
  console.error(`ERRO: ${e.message}`);
  process.exit(1);
});
