# Prompt de Inicialização — Claude Code
# Processo Seletivo IBFT/Onion

Cole este prompt na primeira mensagem ao abrir o Claude Code.

---

Olá! Vamos construir juntos um sistema automatizado de triagem de candidatos
e geração de relatórios para o processo seletivo do IBFT e do Onion.

## Contexto do projeto

O IBFT (Instituto Brasileiro de Formação de Terapeutas) é o maior instituto
de formação de terapeutas em TRG do Brasil, com mais de 70.000 alunos formados.
Estamos abrindo um escritório em São José dos Campos e precisamos contratar
8 posições simultaneamente, o que deve gerar centenas de candidaturas.

Para dar escala ao processo seletivo sem aumentar a carga do time de RH,
estamos construindo um agente que faz a triagem inicial automaticamente.

## O que o sistema faz

**Função 1 — Triagem automática:**
Quando um candidato preenche o formulário de inscrição no Asana, o agente
é acionado via webhook. Ele lê as respostas do formulário, o currículo em PDF
ou DOCX, o perfil do LinkedIn (quando disponível), e aplica critérios
estruturados de avaliação. Pontua o candidato de 0 a 10, posta um comentário
na tarefa do Asana, move a tarefa para a seção correta do Kanban
(aprovado ou reprovado) e registra tudo em uma planilha Google Sheets.

**Função 2 — Relatórios diários:**
Todos os dias às 7h30, o agente lê o estado do Kanban no Asana, identifica
candidatos parados além do prazo em cada etapa, consolida scores e motivos
de recusa, e atualiza o dashboard na planilha Google Sheets. Também pode
ser acionado manualmente via botão na planilha a qualquer momento.

## Documentação disponível no projeto

O repositório já tem os seguintes arquivos que você deve ler antes de começar:

- **AGENTS.md** — arquitetura completa, estrutura de arquivos, regras,
  fluxos detalhados das duas funções e tratamento de erros
- **CONTEXT.md** — contexto do processo seletivo: vagas, budgets, critérios
  de triagem, GIDs reais dos campos personalizados do Asana, identificadores
  do projeto e referência da planilha Google Sheets
- **prompts/triagem.md** — prompt completo para a Função 1, com placeholders,
  estrutura de retorno JSON e notas para implementação
- **prompts/relatorio.md** — prompt completo para a Função 2, com placeholders,
  estrutura de retorno JSON e notas para implementação

Leia esses quatro arquivos antes de escrever qualquer linha de código.

## Stack e integrações

- **Runtime:** Node.js
- **Asana API:** para leitura de tarefas, movimentação no Kanban,
  postagem de comentários e atualização de campos personalizados
- **Google Sheets API:** para gravação de dados dos candidatos e
  atualização do dashboard
- **Anthropic API:** Claude Sonnet para análise de candidatos e
  geração de relatórios
- **Express:** servidor HTTP para receber webhook do Asana e
  endpoint de acionamento manual
- **node-cron:** agendamento do relatório diário às 7h30 (Brasília)
- **pdf-parse + mammoth:** extração de texto de currículos PDF e DOCX
- **ngrok:** túnel local para desenvolvimento (o sistema roda
  na minha máquina por enquanto)
- **Railway:** hospedagem em nuvem para quando sairmos do piloto

## Credenciais que tenho disponíveis

- Token pessoal do Asana (Personal Access Token)
- Chave da API do Anthropic
- Conta Google (vou criar a service account durante o setup)

## Como quero que você me guie

Seja didático e paciente. Não tenho experiência com desenvolvimento,
então preciso que você:

1. Explique o que cada passo faz antes de executar
2. Me diga exatamente o que preciso fazer na minha máquina
   (instalar, clicar, colar) antes de você escrever código
3. Valide cada etapa antes de avançar para a próxima —
   só siga em frente quando eu confirmar que funcionou
4. Quando algo der erro, me ajude a entender o que aconteceu
   e como corrigir, sem pular etapas
5. Me avise quando uma ação for irreversível ou exigir atenção especial

## Ordem de construção

Siga exatamente as fases descritas no AGENTS.md:

**Fase 1 — Preparação do ambiente**
Setup do projeto, instalação de dependências, configuração de credenciais,
mapeamento dos GIDs das seções do Kanban e validação de todas as conexões.

**Fase 2 — Função 1: Triagem**
Parser do formulário, leitor de currículo, leitor de LinkedIn,
motor de análise com a API do Claude, ações no Asana e registro na planilha.
Testar manualmente com candidatos simulados antes de ativar o webhook.

**Fase 3 — Automação via webhook**
Servidor Express, fila de processamento, registro do webhook no Asana
e teste de ponta a ponta.

**Fase 4 — Função 2: Relatórios**
Leitor do Kanban, consolidador de dados, gerador de relatório,
atualizador do dashboard, agendamento às 7h30 e endpoint manual.

## Regras que nunca devem ser quebradas

Estas regras estão no AGENTS.md — reforço aqui as mais críticas:

- Nunca mover uma tarefa no Asana sem antes ter gravado a linha na planilha
- Nunca reprovar um candidato sem preencher o campo de motivo de recusa
- Nunca versionar o arquivo .env
- Nunca logar credenciais ou dados pessoais de candidatos
- Nunca processar uma vaga não listada no CONTEXT.md como ativa
- O retorno da API do Claude deve ser sempre JSON — rejeitar se não for parseável

## Para começar

Leia os quatro arquivos de documentação listados acima e me diga:

1. Confirmação de que leu e entendeu o AGENTS.md e o CONTEXT.md
2. O que você vai fazer no Passo 1.1 (criar estrutura do projeto)
3. O que eu preciso ter instalado na minha máquina antes de começar
   (Node.js, ngrok, etc.) e como verificar se já tenho

Vamos um passo de cada vez.
