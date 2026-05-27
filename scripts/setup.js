// scripts/setup.js
// Script de inicialização — roda uma vez antes do primeiro uso e quando solicitado.
//
// Tarefas:
//   1. Obter GIDs das seções do Kanban (GET /projects/{gid}/sections) e salvar
//      em config/asana-ids.json.
//   2. Validar todas as conexões: Asana, Google Sheets e Anthropic.
//
// Uso:
//   node scripts/setup.js              -> obtém GIDs e salva
//   node scripts/setup.js --validate   -> só valida as conexões

// TODO: implementar na Fase 1 (Passo 1.4).
