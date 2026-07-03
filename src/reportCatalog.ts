export type ReportId =
  | 'scale-consolidated'
  | 'scale-operations'
  | 'workload-by-collaborator'
  | 'scale-irregularities'
  | 'extras'
  | 'availability'
  | 'coverage'
  | 'hour-exposure'
  | 'schedule-usage'
  | 'user-access'
  | 'audit-trail'
  | 'comment-activity'

export const reportOptions: Array<{ id: ReportId; label: string }> = [
  { id: 'scale-consolidated', label: 'Escala consolidada' },
  { id: 'scale-operations', label: 'Operacao da escala' },
  { id: 'workload-by-collaborator', label: 'Carga horaria por colaborador' },
  { id: 'scale-irregularities', label: 'Irregularidades da escala' },
  { id: 'extras', label: 'Relatorio de extras' },
  { id: 'availability', label: 'Disponibilidade e inativacoes' },
  { id: 'coverage', label: 'Cobertura por setor e funcao' },
  { id: 'hour-exposure', label: 'Exposicao de jornada' },
  { id: 'schedule-usage', label: 'Mapa de horarios utilizados' },
  { id: 'user-access', label: 'Quadro de usuarios e acessos' },
  { id: 'audit-trail', label: 'Auditoria operacional' },
  { id: 'comment-activity', label: 'Atividade de comentarios' },
]
