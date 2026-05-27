// src/webhook.js
// Servidor Express. Recebe eventos do webhook do Asana e expõe o endpoint manual /relatorio.
// Valida o evento, identifica tarefas novas em 👤 Candidaturas Recebidas e enfileira via queue.js.
// Também inicia o cron de 7h30 (Brasília) que dispara src/relatorio.js.

// TODO: implementar na Fase 3.
