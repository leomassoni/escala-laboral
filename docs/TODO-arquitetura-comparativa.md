# A Fazer: Evolucao Arquitetural Inspirada no `gestor-estoque`

## Objetivo

Transformar o `escala-laboral` de um app funcional com backend de snapshot/modulos genericos em um sistema com:

- persistencia real por entidade
- memberships por empresa no banco
- documentacao viva de estado e decisoes
- infraestrutura local melhor para validar mudancas sem arriscar o ambiente principal

Este documento traduz, para o `escala-laboral`, os pontos do `gestor-estoque` que valem ser reaproveitados.

## O que copiar do `gestor-estoque`

- modelagem Prisma por entidade com camada de transicao
- endpoints especificos por recurso, sem `unknown[]` generico
- membership por empresa persistido no backend
- documentacao de `status`, `decisoes` e `worklog`
- rotina de sincronizacao entre ambiente remoto e ambiente local
- preparacao para operacao local com banco e validacao repetivel
- refinamentos de performance por tela ativa, em vez de sync global cego

## Ordem recomendada

### Bloco 1: Documentacao estrutural

- [ ] criar `docs/STATUS.md`
  - registrar o estado real do sistema por modulo
  - separar o que ja esta em API modular, o que ainda depende do snapshot e o que ainda e local-first
- [ ] criar `docs/DECISIONS.md`
  - registrar decisoes ativas sobre login multiempresa, permissoes, auditoria, relatorios e persistencia
- [ ] criar `docs/WORKLOG.md`
  - manter um historico resumido de alteracoes, regressos e pendencias reais

### Bloco 2: Endurecer o backend atual

- [ ] substituir validacao generica de arrays `unknown[]` por schemas reais em `server/stateRoutes.js`
- [ ] criar schemas zod por entidade do dominio atual:
  - `CompanyRecord`
  - `CollectiveAgreementRecord`
  - `SectorRecord`
  - `FunctionRecord`
  - `CollaboratorProfileRecord`
  - `CollaboratorRecord`
  - `ScheduleRecord`
  - `ScaleAssignmentRecord`
  - `ScaleCommentThreadRecord`
  - `ScaleExtraRosterRecord`
  - `CompanyUserRecord`
  - `AuditLogRecord`
- [ ] impedir que payload invalido ou incompleto chegue ao banco sem erro claro
- [ ] centralizar normalizacao de leitura/escrita do estado no backend, em vez de depender quase totalmente do frontend

### Bloco 3: Modelagem Prisma de transicao

- [ ] manter `AppState` apenas como camada de compatibilidade temporaria
- [ ] criar tabelas por entidade do app atual no Prisma, em paralelo ao snapshot:
  - `AppCompanyRecord`
  - `AppCollectiveAgreementRecord`
  - `AppSectorRecord`
  - `AppFunctionRecord`
  - `AppCollaboratorProfileRecord`
  - `AppCollaboratorRecord`
  - `AppScheduleRecord`
  - `AppScaleAssignmentRecord`
  - `AppScaleCommentThreadRecord`
  - `AppScaleExtraRosterRecord`
  - `AppUserRecord`
  - `AppAuditLogRecord`
- [ ] adicionar migrations reais, em vez de depender so de `db push`
- [ ] definir quais entidades migram primeiro e quais continuam no snapshot durante a transicao

### Bloco 4: Membership por empresa no banco

- [ ] sair do modelo atual de usuarios replicados por empresa como estrutura principal
- [ ] criar `AppUserCompanyMembershipRecord`
  - campos minimos:
    - `userId`
    - `companyId`
    - `role`
    - `sectors`
    - `sectionAccess`
    - `linkedCollaboratorId`
    - `isActive`
- [ ] ajustar login para montar sessao a partir de memberships persistidos no backend
- [ ] manter compatibilidade temporaria com os usuarios atuais enquanto a migracao roda
- [ ] definir estrategia de migracao dos registros existentes de `users` para memberships

### Bloco 5: Endpoints por recurso

- [ ] manter `/api/state` apenas como fallback e sincronizacao de legado
- [ ] criar rotas explicitas por entidade com payloads tipados:
  - `/api/companies`
  - `/api/agreements`
  - `/api/sectors`
  - `/api/functions`
  - `/api/collaborator-profiles`
  - `/api/collaborators`
  - `/api/schedules`
  - `/api/scale-assignments`
  - `/api/scale-comments`
  - `/api/scale-extra-roster`
  - `/api/users`
  - `/api/user-company-memberships`
  - `/api/audit-logs`
- [ ] mover primeiro os modulos com menor risco de concorrencia:
  - `Empresa`
  - `Convencoes`
  - `Setores`
  - `Funcoes`
  - `Usuarios`
- [ ] mover depois os modulos operacionais:
  - `Colaboradores`
  - `Horarios`
  - `Escala`
  - `Comentarios`
  - `Extras`

### Bloco 6: Infraestrutura local e sincronizacao

- [ ] criar `docker-compose.yml` para PostgreSQL local
- [ ] adicionar `server/.env.example` se ainda nao existir
- [ ] trocar a dependencia implícita do SQLite local por um fluxo local padrao com Postgres
- [ ] criar script de sincronizacao remoto -> local para apoio a testes
  - objetivo: espelhar o estado do ambiente principal no banco local antes de testar mudancas
- [ ] documentar um roteiro de validacao local minima para:
  - login
  - troca de empresa
  - cadastro de usuario
  - cadastro de colaborador
  - cadastro de horario
  - atribuicao de escala
  - comentarios
  - relatorios

### Bloco 7: Refatoracao do frontend por dominio

- [ ] extrair de `src/App.tsx` os hooks de sessao
  - `useSessionState`
  - `useCompanySelection`
  - `useEffectiveAccess`
- [ ] extrair a camada de persistencia
  - `usePersistenceBootstrap`
  - `useModuleSync`
  - `useLocalFallbackStorage`
- [ ] extrair o dominio de escala
  - `useScaleAssignments`
  - `useScaleValidation`
  - `useScaleComments`
  - `useScaleExtras`
- [ ] extrair o dominio de relatorios
  - dataset builder
  - filtros
  - colunas visiveis
  - exportacao
- [ ] depois quebrar a UI em telas:
  - `Painel`
  - `PainelMaster`
  - `Empresa`
  - `Convencoes`
  - `Colaboradores`
  - `Funcoes`
  - `Horarios`
  - `Escala`
  - `Usuarios`

### Bloco 8: Performance e sincronizacao mais inteligente

- [ ] reduzir sync global baseado em snapshot completo
- [ ] sincronizar por modulo/tela ativa quando possivel
- [ ] evitar `fetch` redundante de todos os modulos em cascata no bootstrap
- [ ] lazy load de exportacoes pesadas se o bundle continuar crescendo
- [ ] revisar listas e relatorios para prever virtualizacao se o volume operacional subir

## Ordem de execucao recomendada em sprints

## Frente operacional da escala

- [~] refinar a tela `Escala` para uso diario antes da migracao estrutural completa
- [x] replicacao individual por colaborador com confirmacao de irregularidades
- [x] recorrencia semanal da replicacao
- [x] previa visual das datas afetadas
- [x] destaque previo de risco semanal na replicacao
- [x] filtros por busca, funcao e somente linhas irregulares
- [x] resumo da previa por semana de destino
- [~] operacoes em lote por semana e por grupo de colaboradores
  - [x] aplicar horario ou folga na semana visivel por escopo e dias selecionados
  - [ ] aplicar lote por setor/funcao fora da semana corrente
  - [ ] aplicar lote multicolaborador a partir de filtros salvos
- [~] relatorio operacional da escala com cobertura, extras previstos e lacunas
  - [x] adicionar leitura diaria de cobertura, lacunas e custo de extras por setor/funcao
  - [ ] incluir comparativo entre demanda planejada e escala realizada
  - [ ] destacar dias/linhas criticas direto no painel de relatorios
- [ ] historico/versionamento da escala com diff e restauracao

### Sprint 1

- [ ] criar `docs/STATUS.md`, `docs/DECISIONS.md` e `docs/WORKLOG.md`
- [ ] endurecer validacao do backend atual com schemas reais
- [ ] criar `server/.env.example`

### Sprint 2

- [ ] introduzir tabelas Prisma de transicao para `companies`, `agreements`, `sectors`, `functions`, `users` e `auditLogs`
- [ ] criar migrations
- [ ] expor endpoints reais para esses modulos

### Sprint 3

- [ ] introduzir `AppUserCompanyMembershipRecord`
- [ ] migrar login e troca de empresa para memberships persistidos
- [ ] adaptar sessao do frontend

### Sprint 4

- [ ] migrar `collaborators`, `schedules` e `scaleAssignments`
- [ ] manter snapshot apenas para o que ainda nao migrou

### Sprint 5

- [ ] migrar `scaleComments` e `scaleExtraRoster`
- [ ] revisar trilha de auditoria e relatorios dependentes

### Sprint 6

- [ ] quebrar `App.tsx` por hooks e telas
- [ ] revisar sync por modulo/tela ativa

## Criterios de seguranca

- [ ] nao remover o snapshot global antes de existir cobertura funcional equivalente por entidade
- [ ] nao mexer em login, memberships e persistencia no mesmo passo em que tambem mudar UI grande
- [ ] sempre validar:
  - login master
  - login de usuario comum
  - usuario com uma empresa
  - usuario com varias empresas
  - visualizador vinculado a colaborador
  - criacao e edicao de horarios
  - atribuicao de escala com alerta
  - comentarios e leitura de notificacoes

## Resultado esperado

Ao final dessa trilha, o `escala-laboral` deve manter a funcionalidade atual, mas com:

- backend mais confiavel
- persistencia menos fragil
- evolucao multiempresa correta no banco
- base melhor para concorrencia real
- manutencao mais segura do frontend
