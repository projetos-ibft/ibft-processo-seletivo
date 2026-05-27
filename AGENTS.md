# AGENTS.md — Agente de Triagem e Relatórios | Processos Seletivos IBFT/Onion

Este arquivo é lido automaticamente pelo Claude Code ao iniciar. Ele descreve o projeto,
a arquitetura, as responsabilidades do agente, as regras que nunca devem ser violadas
e o mapa completo de arquivos do repositório.

---

## 1. O que é este projeto

Sistema automatizado de triagem de candidatos e geração de relatórios para o processo
seletivo do IBFT (Instituto Brasileiro de Formação de Terapeutas) e do Onion.

O agente tem duas funções principais:

**Função 1 — Triagem de candidatos**
Quando um candidato preenche o formulário de inscrição no Asana, o agente é acionado
automaticamente via webhook. Ele lê as respostas do formulário, o currículo anexado,
o perfil do LinkedIn (quando disponível) e aplica critérios estruturados de avaliação.
Com base nisso, pontua o candidato de 0 a 10, posta um comentário na tarefa do Asana,
move a tarefa para a seção correta do Kanban e registra tudo na planilha Google Sheets.

**Função 2 — Relatórios**
Diariamente às 7h30, o agente lê o estado do Kanban no Asana, consolida os dados da
planilha e atualiza o bloco de gargalos do dashboard. Também pode ser acionado
manualmente via botão na planilha Google Sheets a qualquer momento.

---

## 2. Arquitetura do sistema

```
Formulário Asana (candidato preenche)
        ↓
👤 Candidaturas Recebidas (seção do Kanban)
        ↓ webhook
src/webhook.js (recebe o evento)
        ↓
src/queue.js (enfileira para processamento sequencial)
        ↓
src/triagem.js (orquestrador da Função 1)
    ↓           ↓           ↓           ↓
src/           src/        src/        src/
parser.js    curriculo.js linkedin.js  context.js
(formulário) (PDF/DOCX)   (perfil)    (CONTEXT.md)
        ↓
src/analise.js (chama API do Claude com o prompt)
        ↓
src/asana.js (posta comentário, move tarefa, atualiza campos)
        ↓
src/sheets.js (grava linha na planilha)

────────────────────────────────────────

src/relatorio.js (Função 2 — agendamento e acionamento manual)
    ↓               ↓
src/asana.js    src/sheets.js
(lê Kanban)     (lê e atualiza dashboard)
        ↓
src/analise.js (chama API do Claude com prompt de relatório)
```

---

## 3. Estrutura de arquivos do repositório

```
ibft-processo-seletivo/
│
├── AGENTS.md                  # Este arquivo — lido pelo Claude Code ao iniciar
├── CONTEXT.md                 # Contexto completo do processo seletivo (vagas, budgets,
│                              # critérios, campos do Asana com GIDs, planilha)
├── .env                       # Credenciais — NUNCA versionar, NUNCA compartilhar
├── .env.example               # Exemplo de .env sem valores reais — versionar
├── .gitignore                 # Deve incluir .env e node_modules
├── package.json
│
├── src/
│   ├── webhook.js             # Servidor Express: recebe eventos do Asana e endpoint manual
│   ├── queue.js               # Fila sequencial de processamento (FIFO)
│   ├── triagem.js             # Orquestrador da Função 1
│   ├── relatorio.js           # Orquestrador da Função 2 + cron 7h30
│   ├── parser.js              # Extrai campos estruturados da descrição da tarefa Asana
│   ├── curriculo.js           # Baixa e extrai texto de PDF e DOCX
│   ├── linkedin.js            # Acessa perfil público do LinkedIn e extrai informações
│   ├── context.js             # Carrega e valida o CONTEXT.md no início da execução
│   ├── analise.js             # Monta prompt e chama API do Claude (Sonnet)
│   ├── asana.js               # Todas as chamadas à API do Asana
│   └── sheets.js              # Todas as chamadas à API do Google Sheets
│
├── prompts/
│   ├── triagem.md             # Prompt completo da Função 1 com placeholders documentados
│   └── relatorio.md           # Prompt completo da Função 2 com placeholders documentados
│
├── config/
│   ├── asana-ids.json         # GIDs de seções do Kanban (obtidos no setup via API)
│   └── drive-folders.json     # IDs de pastas do Google Drive (referência futura)
│
├── scripts/
│   └── setup.js               # Script de validação de conexões (roda uma vez no início)
│
└── logs/
    └── .gitkeep               # Pasta de logs — nunca versionar os arquivos .log
```

---

## 4. Variáveis de ambiente (.env)

O arquivo `.env` deve conter exatamente estas variáveis. Nunca colocar valores reais
no código ou em qualquer outro arquivo.

```
# Asana
ASANA_TOKEN=                   # Personal Access Token do Asana
ASANA_PROJECT_GID=1209988064308562
ASANA_WORKSPACE_GID=1208104128529800

# Google
GOOGLE_SHEETS_ID=1CZKPf3_NvN6TmGfvHn9Zic9MxLTBwsJqcnPdmlV1YKY
GOOGLE_SERVICE_ACCOUNT_KEY=    # Caminho para o arquivo JSON da service account

# Anthropic
ANTHROPIC_API_KEY=             # Chave da API do Claude

# Servidor
PORT=3000
WEBHOOK_SECRET=                # Secret para validar requisições do Asana

# Ambiente
NODE_ENV=development           # development | production
```

---

## 5. Integrações externas

### Asana API
- Base URL: `https://app.asana.com/api/1.0`
- Autenticação: Bearer token no header `Authorization`
- Rate limit: 1.500 requisições por minuto — processar uma tarefa por vez para não estourar
- Referência: https://developers.asana.com/docs

**Endpoints utilizados:**
```
GET  /projects/{project_gid}/sections     # Obter GIDs das seções (setup)
GET  /tasks/{task_gid}                    # Ler dados da tarefa
GET  /tasks/{task_gid}/attachments        # Listar anexos
GET  /attachments/{attachment_gid}        # Baixar anexo (currículo)
POST /tasks/{task_gid}/stories            # Postar comentário
POST /sections/{section_gid}/addTask      # Mover tarefa de seção
PUT  /tasks/{task_gid}                    # Atualizar campos customizados
POST /webhooks                            # Registrar webhook
```

### Google Sheets API
- Autenticação: Service Account com permissão de editor na planilha
- Planilha: `1CZKPf3_NvN6TmGfvHn9Zic9MxLTBwsJqcnPdmlV1YKY`
- Aba de dados: `📊 Candidatos`
- Aba de dashboard: `📈 Dashboard` (atualizada via Apps Script, não pelo agente)

### Anthropic API
- Modelo: `claude-sonnet-4-6`
- Max tokens: 2.000 para triagem, 3.000 para relatório
- Temperatura: 0.2 (respostas consistentes e previsíveis)
- O retorno da triagem deve ser sempre JSON válido — usar system prompt para reforçar isso

### LinkedIn
- Acesso à página pública do perfil via HTTP
- Tratar como dado complementar: se inacessível, prosseguir sem ele
- Nunca travar o processo por falha no LinkedIn

---

## 6. Fluxo detalhado da Função 1 (triagem)

```
1. Webhook recebe evento de nova tarefa em 👤 Candidaturas Recebidas
2. Enfileirar tarefa na queue.js
3. Mover tarefa para 🔍 Em Análise (IA) via asana.js
4. Atualizar campo [Etapas] RH para 🔍 Em Análise (IA)
5. Carregar CONTEXT.md via context.js — validar data de atualização
6. Extrair campos do formulário via parser.js
7. Identificar a vaga — se não reconhecida, mover para 🔍 Em Análise (Humano) com erro
8. Baixar e extrair texto do currículo via curriculo.js
   → Se falhar: preencher 📝[RH] Status = "Currículo não lido", mover para
     🔍 Em Análise (Humano), postar comentário padrão e encerrar
9. Acessar LinkedIn via linkedin.js (se URL fornecida)
   → Se inacessível: registrar "Perfil não acessível" e continuar
10. Montar prompt com todos os dados via analise.js
11. Chamar API do Claude e receber JSON de resposta
12. Gravar linha na planilha via sheets.js
    → Se falhar: logar erro e NÃO mover a tarefa — encerrar com erro
13. Postar comentário na tarefa via asana.js
14. Preencher campo ⛔[RH] Motivo da recusa (se reprovado) via asana.js
15. Mover tarefa para seção correta via asana.js:
    Score >= 7 → 🔍 Em Análise (Humano)
    Score <= 6 → ❌ Candidatos Recusados
16. Atualizar campo [Etapas] RH para a seção de destino
17. Liberar próximo item da fila
```

---

## 7. Fluxo detalhado da Função 2 (relatórios)

```
1. Acionado pelo cron (7h30) ou pelo endpoint manual /relatorio
2. Ler todas as tarefas do projeto via asana.js
3. Para cada tarefa: registrar seção atual, data de entrada na seção e campos relevantes
4. Calcular candidatos parados além do prazo esperado por seção:
   - 🔍 Em Análise (Humano): alerta após 2 dias úteis
   - 🗣️ Contato Inicial: alerta após 3 dias corridos
   - 🖋️ Desafio: alerta após 6 dias corridos (prazo de 5 dias + 1 de tolerância)
   - 📞 Entrevista: alerta após 5 dias corridos sem data agendada
5. Ler aba 📊 Candidatos da planilha para consolidar scores e motivos de recusa
6. Montar prompt de relatório via analise.js
7. Chamar API do Claude e receber JSON de gargalos + resumo narrativo
8. Atualizar bloco de gargalos na aba 📈 Dashboard via sheets.js
9. Logar resumo narrativo no console (canal de notificação a definir futuramente)
```

---

## 8. Regras que nunca devem ser violadas

**Sobre dados e consistência:**
- Nunca mover uma tarefa no Asana sem antes ter gravado a linha na planilha
- Nunca reprovar um candidato sem preencher o campo ⛔[RH] Motivo da recusa
- Nunca criar uma segunda linha para um candidato já registrado — atualizar a existente
- Nunca deletar uma tarefa do Asana — o histórico é permanente

**Sobre segurança:**
- Nunca logar o token do Asana, a chave da Anthropic ou qualquer credencial
- Nunca versionar o arquivo .env
- Nunca expor dados pessoais de candidatos em logs públicos

**Sobre o processo seletivo:**
- Nunca processar uma vaga não listada em CONTEXT.md como ativa
- Nunca alterar o campo 📝[RH] Status além do caso de currículo não lido
- Nunca usar variações dos valores de enum — usar sempre o texto exato e o GID correspondente
- O campo [Etapas] RH deve sempre refletir a seção atual da tarefa

**Sobre o modelo:**
- Sempre usar claude-sonnet-4-6 para análise
- O retorno da triagem deve ser sempre JSON — rejeitar e logar se não for parseável
- Temperatura 0.2 — não alterar sem aprovação

---

## 9. Tratamento de erros

| Erro | Comportamento |
|---|---|
| Webhook recebe evento duplicado | Verificar se tarefa já foi processada (campo [Etapas] RH != Candidaturas Recebidas) e ignorar |
| Currículo ilegível | Preencher status, mover para Em Análise Humano, encerrar sem score |
| LinkedIn inacessível | Registrar no comentário, continuar análise sem esse dado |
| Vaga não reconhecida | Mover para Em Análise Humano com comentário de erro, não reprovar |
| Gravação na planilha falha | Não mover tarefa, logar erro, liberar fila para próximo candidato |
| API do Claude retorna não-JSON | Logar erro completo, mover tarefa para Em Análise Humano |
| API do Claude indisponível | Retry 3x com backoff de 5s, depois mover para Em Análise Humano |
| Rate limit do Asana | Aguardar 60s e tentar novamente, máximo 3 tentativas |
| Asana API indisponível | Logar erro, manter tarefa na seção atual, liberar fila |

---

## 10. Setup inicial (rodar uma vez antes de tudo)

```bash
# 1. Instalar dependências
npm install

# 2. Criar .env a partir do exemplo
cp .env.example .env
# Preencher os valores no .env

# 3. Obter GIDs das seções do Kanban e salvar em config/asana-ids.json
node scripts/setup.js

# 4. Validar todas as conexões
node scripts/setup.js --validate

# 5. Iniciar o servidor
npm start

# 6. Expor localmente com ngrok (desenvolvimento)
ngrok http 3000
# Copiar a URL gerada e registrar o webhook no Asana
```

---

## 11. Referências rápidas

| Recurso | Localização |
|---|---|
| Contexto completo do processo seletivo | `CONTEXT.md` (este repositório) |
| Prompt de triagem | `prompts/triagem.md` |
| Prompt de relatório | `prompts/relatorio.md` |
| GIDs das seções do Kanban | `config/asana-ids.json` |
| Planilha de candidatos | https://docs.google.com/spreadsheets/d/1CZKPf3_NvN6TmGfvHn9Zic9MxLTBwsJqcnPdmlV1YKY |
| Kanban no Asana | https://app.asana.com/1/1208104128529800/project/1209988064308562 |
| Documentação da API do Asana | https://developers.asana.com/docs |
| Documentação da API do Claude | https://docs.anthropic.com |
