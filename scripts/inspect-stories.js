// scripts/inspect-stories.js
// Debug: lista o histórico (stories) de uma tarefa para entender se dá para
// extrair a data de entrada na seção atual (necessário para os gargalos).
// Uso: node scripts/inspect-stories.js <task_gid>

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });
const axios = require('axios');

async function main() {
  const taskGid = process.argv[2];
  if (!taskGid) {
    console.error('Uso: node scripts/inspect-stories.js <task_gid>');
    process.exit(1);
  }
  const token = process.env.ASANA_TOKEN;
  const { data } = await axios.get(
    `https://app.asana.com/api/1.0/tasks/${taskGid}/stories`,
    {
      headers: { Authorization: `Bearer ${token}` },
      params: { opt_fields: 'created_at,resource_subtype,type,text' },
    }
  );
  console.log(`Stories da tarefa ${taskGid}: ${data.data.length}\n`);
  for (const s of data.data) {
    console.log(`[${s.created_at}] (${s.resource_subtype}) ${s.text}`);
  }
}

main().catch(e => {
  console.error(`ERRO: ${e.response?.data ? JSON.stringify(e.response.data) : e.message}`);
  process.exit(1);
});
