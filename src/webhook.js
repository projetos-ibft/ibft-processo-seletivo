// src/webhook.js
// Servidor Express. Recebe eventos do webhook do Asana, valida a assinatura,
// identifica tarefas novas em 👤 Candidaturas Recebidas e enfileira a triagem
// via queue.js (processamento sequencial). Expõe também /relatorio (manual).

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env') });

const fs = require('fs');
const crypto = require('crypto');
const express = require('express');
const asana = require('./asana');
const { Queue } = require('./queue');
const triagem = require('./triagem');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const SECRET_FILE = path.join(PROJECT_ROOT, 'config', '.webhook-secret');
const PORT = process.env.PORT || 3000;

const asanaIds = JSON.parse(
  fs.readFileSync(path.join(PROJECT_ROOT, 'config', 'asana-ids.json'), 'utf8')
);
const CANDIDATURAS_GID = asanaIds.sections['👤 Candidaturas Recebidas'];
if (!CANDIDATURAS_GID) {
  console.error('[WEBHOOK] GID de "👤 Candidaturas Recebidas" não encontrado. Rode: npm run setup');
  process.exit(1);
}

function loadSecret() {
  try {
    return fs.readFileSync(SECRET_FILE, 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function saveSecret(secret) {
  try {
    fs.writeFileSync(SECRET_FILE, secret, 'utf8');
  } catch (e) {
    console.warn(`[WEBHOOK] Não foi possível persistir o secret: ${e.message}`);
  }
}

let hookSecret = loadSecret();
const enqueued = new Set();

const queue = new Queue(async taskGid => {
  try {
    await triagem.processarTarefa(taskGid, { dryRun: false });
  } finally {
    enqueued.delete(taskGid);
  }
});

async function handleTaskEvent(taskGid) {
  if (enqueued.has(taskGid)) return;
  // Reserva síncrona ANTES de qualquer await, para evitar corrida entre
  // múltiplos eventos do mesmo task chegando quase ao mesmo tempo.
  enqueued.add(taskGid);
  try {
    const task = await asana.getTask(taskGid, 'memberships.section.gid,completed');
    const inSection = (task.memberships || []).some(
      m => m.section && m.section.gid === CANDIDATURAS_GID
    );
    if (!inSection || task.completed) {
      enqueued.delete(taskGid);
      return;
    }
    console.log(`[WEBHOOK] Tarefa ${taskGid} em Candidaturas Recebidas — enfileirando (fila: ${queue.size() + 1})`);
    queue.enqueue(taskGid);
  } catch (e) {
    enqueued.delete(taskGid);
    console.error(`[WEBHOOK] Erro ao avaliar tarefa ${taskGid}: ${e.message}`);
  }
}

const app = express();
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get('/', (_req, res) => {
  res.json({ status: 'ok', servico: 'PE-007 triagem', fila: queue.size() });
});

app.post('/webhook/asana', (req, res) => {
  // Handshake: Asana envia X-Hook-Secret na criação do webhook.
  const incomingSecret = req.header('X-Hook-Secret');
  if (incomingSecret) {
    hookSecret = incomingSecret;
    saveSecret(incomingSecret);
    res.set('X-Hook-Secret', incomingSecret);
    console.log('[WEBHOOK] Handshake recebido — secret armazenado.');
    return res.status(200).send();
  }

  // Validação de assinatura HMAC-SHA256.
  const sig = req.header('X-Hook-Signature');
  if (hookSecret && sig) {
    const computed = crypto
      .createHmac('sha256', hookSecret)
      .update(req.rawBody)
      .digest('hex');
    const a = Buffer.from(computed);
    const b = Buffer.from(sig);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      console.warn('[WEBHOOK] Assinatura inválida — evento ignorado.');
      return res.status(401).send();
    }
  } else if (hookSecret && !sig) {
    console.warn('[WEBHOOK] Evento sem assinatura — ignorado.');
    return res.status(401).send();
  }

  // Responder rápido; processar de forma assíncrona.
  res.status(200).send();

  const events = (req.body && req.body.events) || [];
  for (const ev of events) {
    if (ev.resource && ev.resource.resource_type === 'task') {
      handleTaskEvent(ev.resource.gid);
    }
  }
});

// Endpoint manual de relatório — implementação completa na Fase 4.
app.post('/relatorio', (_req, res) => {
  res.status(501).json({ erro: 'Relatório ainda não implementado (Fase 4).' });
});
app.get('/relatorio', (_req, res) => {
  res.status(501).json({ erro: 'Relatório ainda não implementado (Fase 4).' });
});

app.listen(PORT, () => {
  console.log(`[WEBHOOK] Servidor ouvindo na porta ${PORT}`);
  console.log(`[WEBHOOK] Secret: ${hookSecret ? 'carregado' : 'aguardando handshake'}`);
  console.log(`[WEBHOOK] Candidaturas Recebidas GID: ${CANDIDATURAS_GID}`);
});
