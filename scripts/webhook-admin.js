// scripts/webhook-admin.js
// Gerencia webhooks do Asana para o projeto PE-007.
//
// Uso:
//   node scripts/webhook-admin.js list
//   node scripts/webhook-admin.js register <https_url_base>   # ex: https://abc123.ngrok-free.app
//   node scripts/webhook-admin.js delete <webhook_gid>
//
// O endpoint registrado é <url_base>/webhook/asana. O servidor (npm start)
// precisa estar rodando e acessível pela URL antes de registrar (handshake).

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const asana = require('../src/asana');

const PROJECT_GID = process.env.ASANA_PROJECT_GID;
const WORKSPACE_GID = process.env.ASANA_WORKSPACE_GID;

async function list() {
  const hooks = await asana.getWebhooks(WORKSPACE_GID);
  if (hooks.length === 0) {
    console.log('Nenhum webhook registrado neste workspace.');
    return;
  }
  console.log(`Webhooks no workspace (${hooks.length}):`);
  for (const h of hooks) {
    console.log(`  - GID ${h.gid} | recurso ${h.resource?.gid} | target ${h.target} | ativo: ${h.active}`);
  }
}

async function register(urlBase) {
  if (!urlBase || !/^https:\/\//i.test(urlBase)) {
    throw new Error('Informe uma URL https válida. Ex: register https://abc.ngrok-free.app');
  }
  const target = `${urlBase.replace(/\/$/, '')}/webhook/asana`;
  console.log(`Registrando webhook do projeto ${PROJECT_GID} → ${target}`);
  console.log('(O Asana fará o handshake agora; o servidor precisa estar rodando.)');
  const hook = await asana.createWebhook(PROJECT_GID, target);
  console.log(`Webhook criado: GID ${hook.gid} | ativo: ${hook.active}`);
}

async function remove(gid) {
  if (!gid) throw new Error('Informe o GID do webhook a deletar.');
  await asana.deleteWebhook(gid);
  console.log(`Webhook ${gid} deletado.`);
}

async function main() {
  const [cmd, arg] = process.argv.slice(2);
  switch (cmd) {
    case 'list':
      await list();
      break;
    case 'register':
      await register(arg);
      break;
    case 'delete':
      await remove(arg);
      break;
    default:
      console.log('Uso: node scripts/webhook-admin.js <list|register <url>|delete <gid>>');
      process.exit(1);
  }
}

main().catch(e => {
  console.error(`ERRO: ${e.response?.data ? JSON.stringify(e.response.data) : e.message}`);
  process.exit(1);
});
