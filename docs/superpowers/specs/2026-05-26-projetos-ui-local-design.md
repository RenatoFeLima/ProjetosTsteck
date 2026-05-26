# Especificacao de Design - Sprint UI Local (Tela 2 + Tela 3)

Data: 2026-05-26
Projeto: Sistema web de controle de projetos de cabines TSTECK
Fase: Primeira entrega funcional sem Supabase

## 1. Contexto e objetivo

Esta sprint entrega uma primeira versao funcional da experiencia de operacao de projetos, substituindo o fluxo manual de planilhas na parte de interface e regras de negocio locais.

Escopo funcional desta sprint:
- Tela 2 (Projetos): visualizacoes Tabela, Kanban e Alertas.
- Tela 3 (Cadastro/Detalhe): modal grande central para criar/editar/excluir.
- Estado totalmente local em memoria.
- Regras principais de negocio aplicadas na interface.
- Registro append-only de historico de alteracoes de status.

Fora de escopo desta sprint:
- Integracao Supabase.
- Controle de perfis (GESTOR/VENDEDOR).
- Exportacao CSV.

## 2. Decisoes de produto aprovadas

1. Abordagem tecnica: modular por dominio (recomendacao aprovada).
2. Primeiras telas: Tela 2 + Tela 3.
3. Persistencia: somente em memoria (reseta ao recarregar).
4. Tela 3: modal grande central.
5. Kanban: drag and drop ativo com bloqueios de regra.
6. Perfis de acesso: nao implementar nesta fase.
7. CSV: nao implementar nesta fase.
8. Incluir log de alteracoes de status com timestamp e origem.
9. URGENTE tratado como badge (flag booleana), nao como coluna de status.

## 3. Arquitetura proposta

Arquitetura frontend orientada a dominio, separando regras de negocio da camada visual.

### 3.1 Camadas

- Dominio de projetos:
  - Tipos, enumeracoes de status, validacoes e funcoes de regra.
- Estado local:
  - Store central com projetos, observacoes, historico de status e filtros.
- UI:
  - Componentes de Tela 2 e modal da Tela 3.
- Utilitarios:
  - Datas, prazos, badges, busca e formatacao.

### 3.2 Estrutura de pastas sugerida

- app
- features/projects/domain
- features/projects/state
- features/projects/components
- shared/ui
- shared/lib

## 4. Modelo de dados local

### 4.1 Entidade Projeto

A entidade local segue os campos do modelo de negocio para reduzir retrabalho na migracao para backend:
- id
- construtora
- obra
- engenheiro_nome
- engenheiro_celular
- equipamento
- tipo_cabine
- codigo_projeto
- vendedor
- proj_obra_recebido
- local_cabine_definido
- alinhamento
- data_lancamento
- data_alinhamento
- status_atual
- data_previsao
- data_envio
- data_aprovacao
- data_prazo_ap
- variacao_cabine
- projeto_base
- aprovacao_final
- local_cabine_final
- data_final
- urgente
- created_at
- updated_at

Campos derivados em runtime:
- prazo_entrega = data_alinhamento + 45 dias (quando houver data_alinhamento)
- badge_prazo (atrasado, atencao, no_prazo, sem_prazo)

### 4.2 Observacoes (append-only)

- id
- projeto_id
- usuario (temporario local)
- texto
- criado_em

Regra: nunca sobrescrever observacoes existentes.

### 4.3 Historico de status (append-only)

- id
- projeto_id
- status_de
- status_para
- alterado_em
- origem (kanban | formulario | acao-rapida)

Regra: toda mudanca de status gera novo registro.

## 5. Tela 2 - Projetos

### 5.1 Cabecalho e controles

- Busca global por codigo, construtora e obra.
- Filtros combinados:
  - status
  - construtora
  - vendedor
  - equipamento
  - atrasado
  - urgente
- Botao Novo Projeto (abre modal Tela 3 em modo criacao).
- Abas de visualizacao: Tabela, Kanban, Alertas.

### 5.2 Visualizacao Tabela

- Linhas clicaveis para abrir modal em edicao.
- Colunas principais: codigo, construtora, obra, vendedor, status, prazo, urgente.
- Acoes rapidas por linha: marcar urgente e abrir detalhe.

### 5.3 Visualizacao Kanban

- 6 colunas fixas do pipeline:
  - ELABORAR ANTE-PROJETO
  - ANTE-PROJETO ENVIADO
  - ANTE-PROJETO APROVADO
  - PROJETO APROVADO
  - PROJETO FINAL ENVIADO
  - REVISAO DE ESTUDO
- Drag and drop com dnd-kit.
- URGENTE representado por campo booleano `urgente` com badge visual no card.
- Marcar urgente nao altera `status_atual`.
- Validacao de bloqueio no movimento:
  - Se alinhamento = false, bloquear avancos no pipeline.
  - Exibir feedback de bloqueio na UI.
- Regras automaticas ao transitar:
  - Para ANTE-PROJETO ENVIADO: preencher data_envio (se vazia).
  - Para ANTE-PROJETO APROVADO: preencher data_aprovacao (se vazia).
- Toda transicao deve registrar historico.

### 5.4 Visualizacao Alertas

- Lista priorizada por severidade:
  1. Urgentes (`urgente = true`, independente do prazo)
  2. Atrasados
  3. Atencao (<= 10 dias)
- Item abre modal da Tela 3.

## 6. Tela 3 - Cadastro/Detalhe (modal grande central)

### 6.1 Estrutura

- Um unico modal para criar e editar.
- Header com codigo, badge de status, badge de prazo e indicador de urgente.
- Rolagem interna com blocos de formulario.
- Responsividade:
  - Em viewport < 768px: modal em tela cheia (full-screen drawer/pagina dedicada).
  - Em viewport >= 768px: modal grande central.

### 6.2 Blocos

- Identificacao.
- Equipamento.
- Alinhamento.
- Fluxo/status.
- Datas e prazos.
- Observacoes (append-only).
- Historico de status (append-only).

### 6.3 Acoes

- Salvar (criar/atualizar).
- Excluir (com confirmacao).
- Marcar urgente (toggle).
- Avancar/voltar status com validacao.

### 6.4 Validacoes

- Campos obrigatorios na criacao:
  - construtora
  - obra
  - codigo_projeto
  - vendedor
  - equipamento
  - data_lancamento
- Campos opcionais na criacao:
  - engenheiro_nome
  - engenheiro_celular
  - tipo_cabine
- codigo_projeto unico no estado local.
- Bloqueio de avancos sem alinhamento.
- Confirmacao ao fechar com alteracoes nao salvas.

### 6.5 Automacao do bloco Alinhamento

- Quando `proj_obra_recebido = true` e `local_cabine_definido = true`, o sistema deve sugerir (ou aplicar diretamente) `alinhamento = true`.
- Ao aplicar alinhamento e `data_alinhamento` estiver vazia, preencher `data_alinhamento = hoje`.
- Esse fluxo representa o processo real: alinhamento so acontece apos recebimento dos dois pre-requisitos.

## 7. Regras de negocio implementadas nesta sprint

Mapeamento objetivo para a fase local:

- RN-01: status inicial em criacao = ELABORAR ANTE-PROJETO.
- RN-02: prazo somente com alinhamento/data_alinhamento.
- RN-03: badge ATRASADO quando hoje > prazo.
- RN-04: badge ATENCAO quando hoje >= prazo - 10.
- RN-05: badge NO PRAZO quando hoje < prazo - 10.
- RN-06: bloquear avancos de status com alinhamento = false.
- RN-07: codigo_projeto unico com validacao em tempo real.
- RN-09: ao ir para ANTE-PROJETO ENVIADO, setar data_envio.
- RN-10: ao ir para ANTE-PROJETO APROVADO, setar data_aprovacao.
- RN-13: observacoes append-only.
- URGENTE e flag visual de prioridade (badge), sem mudar status_atual.
- Historico de status append-only (adicionado por solicitacao no design).

Regras dependentes de backend e fora desta sprint:
- RN-11 e RN-12 (controle por perfil).

## 8. Fluxos principais

1. Criar projeto
- Usuario abre Novo Projeto.
- Preenche formulario.
- Sistema valida codigo e obrigatorios.
- Salva no store com status inicial.

2. Editar projeto
- Usuario abre item por tabela/kanban/alertas.
- Ajusta campos e salva.
- UI sincroniza nas tres visualizacoes.

3. Mudar status
- Origem: kanban, formulario ou acao rapida.
- Sistema valida bloqueio.
- Se permitido, aplica transicao e side effects de data.
- Registra historico de status.

4. Inserir observacao
- Usuario adiciona nova observacao.
- Sistema appenda no historico de observacoes.

## 9. Erros e feedback

- Mensagens inline por campo invalido.
- Toast para sucesso/falha de acao de dominio.
- Mensagem explicita em bloqueio de transicao sem alinhamento.
- Confirmacao para exclusao e para descarte de alteracoes nao salvas.

## 10. Testes da sprint

### 10.1 Unitarios de dominio

- Calculo de prazo e badges.
- Validacao de transicao de status.
- Bloqueio por alinhamento.
- Side effects de data_envio e data_aprovacao.
- Unicidade de codigo_projeto.
- Alteracao de data_alinhamento em projeto existente deve recalcular prazo_entrega imediatamente.
- Badge de prazo deve refletir o novo prazo em todas as visualizacoes.

### 10.2 Integracao de UI

- CRUD completo no modal.
- Sincronizacao entre Tabela, Kanban e Alertas.
- Drag and drop com bloqueio.
- Registro de historico a cada transicao.
- Inclusao append-only de observacoes.

### 10.3 Seed local de testes

- Volume: 20 a 30 projetos representativos (nao usar base real de 613 registros nesta fase).
- Cobertura minima do seed:
  - Projetos em cada um dos 6 status do pipeline.
  - Projetos com `alinhamento = false` (sem prazo ativo).
  - Projetos atrasados, em atencao e no prazo.
  - Pelo menos 1 projeto urgente.
  - Projetos de construtoras e vendedores diferentes.

## 11. Criterios de aceite da sprint

1. Usuario cria, edita e exclui projetos no modal.
2. Tela 2 alterna entre Tabela, Kanban e Alertas sem perder filtros.
3. Kanban move cartoes e respeita bloqueio por alinhamento.
4. Datas automaticas de envio/aprovacao funcionam nas transicoes.
5. Badges de prazo refletem estado real da data.
6. Historico de status registra transicoes com timestamp e origem.
7. Observacoes sao append-only.
8. Urgente funciona como badge de prioridade sem alterar status_atual.
9. Em mobile (< 768px), Tela 3 abre em tela cheia.
10. Nenhuma dependencia de Supabase para executar a sprint.

## 12. Riscos e mitigacoes

- Risco: divergencia entre regras locais e futuras regras no backend.
  - Mitigacao: concentrar regras no dominio com funcoes puras reutilizaveis.

- Risco: complexidade crescente do store local.
  - Mitigacao: separar acoes por modulo e manter contratos claros.

- Risco: regressao em transicoes de status.
  - Mitigacao: cobertura unitaria das transicoes e side effects.

## 13. Proxima etapa

Com esta especificacao aprovada, a proxima etapa e gerar o plano detalhado de implementacao (writing-plans), quebrando em tarefas pequenas e verificaveis.
