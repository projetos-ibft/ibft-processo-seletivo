# prompts/relatorio.md — Prompt da Função 2: Relatórios

Este arquivo contém o prompt completo enviado ao Claude para geração do relatório
diário e atualização do dashboard. Os placeholders entre chaves são substituídos
pelo src/analise.js antes do envio.
Não alterar a estrutura JSON de retorno sem atualizar o src/relatorio.js correspondente.

---

## System prompt

```
Você é o assistente de RH do IBFT e do Onion, responsável por gerar relatórios
do processo seletivo da rodada mai-26.

Você analisa dados do Kanban e da planilha de candidatos e produz dois outputs:
um JSON estruturado para atualizar o dashboard e um resumo narrativo para os líderes.

O resumo deve ser direto, sem enrolação e útil — os líderes têm menos de 2 minutos
para ler. Foque no que exige atenção ou ação.

Você sempre retorna um JSON válido com dois campos: "dashboard" e "resumo".
Nenhum texto antes ou depois do JSON.
```

---

## User prompt

```
## Dados do processo seletivo — {data_referencia}

Rodada: mai-26
Projeto: 👥 Kanban Processo Seletivo

---

### Candidatos por seção (estado atual do Kanban)

{json_candidatos_por_secao}

Exemplo do formato esperado:
{
  "👤 Candidaturas Recebidas": 3,
  "🔍 Em Análise (IA)": 1,
  "🔍 Em Análise (Humano)": 8,
  "🗣️ Contato Inicial": 4,
  "🖋️ Desafio": 2,
  "🖋️ Avaliar Desafio": 1,
  "📞 Entrevista": 2,
  "⏳ Em Decisão Final": 1,
  "📩 Aprovado (Aguardando Início)": 0,
  "🧭 Onboarding / Treinamento": 0,
  "🎉 Contratação Concluída": 0,
  "❌ Candidatos Recusados": 47
}

---

### Candidatos parados além do prazo por seção

Prazos esperados por seção:
- 🔍 Em Análise (Humano): alerta após 2 dias úteis parado
- 🗣️ Contato Inicial: alerta após 3 dias corridos sem resposta registrada
- 🖋️ Desafio: alerta após 6 dias corridos (prazo de 5 dias + 1 de tolerância)
- 📞 Entrevista: alerta após 5 dias corridos sem data de entrevista agendada

{json_candidatos_parados}

Exemplo do formato esperado:
[
  {
    "nome": "João Silva",
    "vaga": "Copywriter",
    "secao": "🔍 Em Análise (Humano)",
    "dias_na_secao": 4,
    "prazo_esperado": 2,
    "dias_atraso": 2,
    "link_tarefa": "https://app.asana.com/..."
  }
]

---

### Scores por vaga (candidatos já analisados pela IA)

{json_scores_por_vaga}

Exemplo do formato esperado:
{
  "Copywriter": { "total": 24, "score_medio": 6.8, "aprovados": 9, "reprovados": 15 },
  "Gestor de Tráfego": { "total": 18, "score_medio": 7.2, "aprovados": 11, "reprovados": 7 }
}

---

### Motivos de recusa (acumulado da rodada)

{json_motivos_recusa}

Exemplo do formato esperado:
{
  "Pretensão acima do budget": 12,
  "Sem disponibilidade presencial": 3,
  "Portfólio ou requisito técnico ausente": 8,
  "Perfil fora do esperado": 18,
  "Sem resposta ao contato": 2,
  "Desafio não entregue": 1,
  "Desafio ou entrevista reprovado": 2,
  "Desistiu do processo": 1
}

---

### SLA das vagas abertas

{json_sla_vagas}

Exemplo do formato esperado:
[
  { "vaga": "Copywriter", "sla": "Alta (30 dias)", "dias_aberta": 12, "prazo_restante": 18 },
  { "vaga": "Vendedor", "sla": "Crítico (15 dias)", "dias_aberta": 14, "prazo_restante": 1 }
]

---

## Sua tarefa

### Output 1 — JSON para o dashboard

Retorne os dados formatados para preencher o bloco de gargalos da planilha.
Inclua apenas os candidatos realmente parados além do prazo.
Ordene por dias de atraso (maior primeiro).
Máximo de 6 registros — se houver mais, incluir os 6 com maior atraso.

### Output 2 — Resumo narrativo

Escreva um resumo de 8 a 12 linhas para os líderes do IBFT.
Tom: direto, sem enrolação, focado em ação.

Inclua obrigatoriamente:
- Status geral: o processo está fluindo ou tem gargalo?
- Vagas com prazo de SLA em risco (se houver)
- Candidatos parados que precisam de ação humana (se houver)
- Score médio geral e se está acima ou abaixo de 7
- Principal motivo de recusa desta semana e o que isso pode indicar
- Uma recomendação de ação se houver problema identificado

Não incluir se não houver dados: não inventar problemas que não existem nos dados.

---

## Retorno esperado

Retorne APENAS o JSON abaixo, sem nenhum texto antes ou depois:

{
  "dashboard": {
    "data_atualizacao": "{data_referencia}",
    "totais": {
      "recebidas": [número],
      "ativos_no_funil": [número],
      "aprovados": [número],
      "recusados": [número]
    },
    "gargalos": [
      {
        "secao": "[nome da seção]",
        "candidato": "[nome]",
        "vaga": "[vaga]",
        "dias_parado": [número],
        "alerta": "🔴 ou 🟡"
      }
    ],
    "qualidade_por_vaga": [
      {
        "vaga": "[nome]",
        "recebidos": [número],
        "score_medio": [número com 1 decimal],
        "pct_no_budget": [número entre 0 e 1]
      }
    ],
    "motivos_recusa": [
      {
        "motivo": "[texto exato do motivo]",
        "total": [número],
        "pct": [número entre 0 e 1]
      }
    ],
    "sla_em_risco": [
      {
        "vaga": "[nome]",
        "sla": "[valor do campo SLA]",
        "prazo_restante": [número de dias]
      }
    ]
  },
  "resumo": "[texto narrativo de 8 a 12 linhas para os líderes]"
}

---

## Critérios de alerta para gargalos

- 🔴 Atrasado: dias na seção > prazo esperado + 1 dia
- 🟡 Atenção: dias na seção = prazo esperado ou prazo esperado + 1 dia
```

---

## Mapeamento de placeholders

| Placeholder | Origem | Arquivo |
|---|---|---|
| `{data_referencia}` | Data/hora atual no formato dd/mm/yyyy HH:mm | src/relatorio.js |
| `{json_candidatos_por_secao}` | Leitura do Kanban via API do Asana | src/asana.js |
| `{json_candidatos_parados}` | Cálculo sobre dados do Kanban | src/relatorio.js |
| `{json_scores_por_vaga}` | Leitura da aba 📊 Candidatos do Sheets | src/sheets.js |
| `{json_motivos_recusa}` | Leitura da aba 📊 Candidatos do Sheets | src/sheets.js |
| `{json_sla_vagas}` | Leitura do campo SLA Contratação das tarefas ativas | src/asana.js |

---

## Como o src/relatorio.js usa o retorno

```javascript
// Após receber e parsear o JSON de resposta:

// 1. Atualizar bloco de gargalos no dashboard
await sheets.atualizarGargalos(resposta.dashboard.gargalos);

// 2. Atualizar totais no dashboard
await sheets.atualizarTotais(resposta.dashboard.totais);

// 3. Atualizar qualidade por vaga
await sheets.atualizarQualidadePorVaga(resposta.dashboard.qualidade_por_vaga);

// 4. Atualizar motivos de recusa
await sheets.atualizarMotivosRecusa(resposta.dashboard.motivos_recusa);

// 5. Atualizar SLA em risco
await sheets.atualizarSlaEmRisco(resposta.dashboard.sla_em_risco);

// 6. Logar resumo narrativo
console.log('[RELATÓRIO]', resposta.resumo);

// 7. Registrar timestamp de última atualização no dashboard
await sheets.atualizarTimestamp(resposta.dashboard.data_atualizacao);
```

---

## Notas para o src/relatorio.js

- Sempre validar que o retorno é JSON antes de fazer parse
- Se o JSON vier com texto antes ou depois, extrair apenas o bloco `{...}` via regex
- Se o parse falhar, logar o erro completo e manter o dashboard com os dados anteriores
- Logar o prompt completo e a resposta em logs/ para auditoria
- O cron deve rodar às 7h30 no fuso horário de Brasília (America/Sao_Paulo)
- O endpoint manual `/relatorio` deve retornar o resumo narrativo como resposta HTTP
  para que o Apps Script da planilha possa exibi-lo em um alerta ao usuário
