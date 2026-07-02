# A Fazer

## Escala Laboral

### Fase 1
- [x] implementar `login unico + memberships por empresa`
- [x] manter compatibilidade com usuarios atuais de empresa unica
- [x] introduzir `empresa ativa` para usuarios com acesso a mais de uma empresa
- [x] recalcular acesso efetivo por empresa ativa

### Fase 2
- [x] substituir papeis fixos por matriz granular de acessos por modulo
- [x] manter `Administrativo`, `Gestor` e `Visualizador` como atalhos de preenchimento inicial
- [x] controlar visualizacao e edicao por modulo antes de evoluir para acoes finas

### Fase 3
- [x] criar trilha de auditoria persistida
- [x] criar `Painel master` por empresa ativa
- [x] registrar login, troca de empresa e principais acoes operacionais

### Fase 4
- [x] adicionar avisos de sair sem salvar em modais e formularios
- [x] unificar comportamento de cancelar, fechar e voltar

### Fase 5
- [x] sair do snapshot unico para CRUD por modulo
- [x] comecar por `setores`, `funcoes`, `convencoes` e `usuarios`
- [x] avancar para `colaboradores` e `horarios`
- [x] cobrir tambem `escalas`, `comentarios` e `extras` em modo hibrido

### Fase 6
- [x] ampliar relatorios operacionais
- [x] incluir filtros mais fortes no `Painel master` por empresa ativa
- [ ] ampliar historico de alteracoes e filtros fortes tambem nos demais relatorios operacionais

### Fase 7
- [x] centralizar configuracoes operacionais por empresa

### Fase 8
- [~] modularizar frontend e backend progressivamente
- [x] extrair `accessControl`, `reportCatalog`, `persistence`, `formatters`
- [x] extrair `dateUtils` e `formUtils`
- [x] extrair `stateStore` e `stateRoutes` no backend
- [ ] continuar quebrando `App.tsx` por dominios de tela e hooks

### Fase 9
- [ ] executar trilha de evolucao arquitetural inspirada no `gestor-estoque`
- [ ] criar `docs/STATUS.md`, `docs/DECISIONS.md` e `docs/WORKLOG.md`
- [ ] migrar de persistencia generica para persistencia tipada por entidade
- [ ] introduzir `membership` por empresa no backend
- [ ] preparar ambiente local com banco e sincronizacao remota -> local

Documento detalhado:

- [`docs/TODO-arquitetura-comparativa.md`](/home/leomassoni/Documentos/Igarapé/Projetos/TCC-SP/escala-laboral/docs/TODO-arquitetura-comparativa.md)
