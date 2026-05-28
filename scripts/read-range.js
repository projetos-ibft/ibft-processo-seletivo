// scripts/read-range.js
// Ferramenta de debug: lê e imprime um range de qualquer aba da planilha.
// Uso: node scripts/read-range.js "'📈 Dashboard'!A1:H60"

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const sheets = require('../src/sheets');

async function main() {
  const range = process.argv[2];
  if (!range) {
    console.error('Uso: node scripts/read-range.js "<range>"');
    process.exit(1);
  }
  const rows = await sheets.readRange(range);
  console.log(`Range: ${range} | linhas: ${rows.length}\n`);
  rows.forEach((row, i) => {
    const cells = row.map((c, j) => `${String.fromCharCode(65 + j)}=${String(c).slice(0, 40)}`);
    console.log(`L${String(i + 1).padStart(2, '0')}: ${cells.join(' | ')}`);
  });
}

main().catch(e => {
  console.error(`ERRO: ${e.message}`);
  process.exit(1);
});
