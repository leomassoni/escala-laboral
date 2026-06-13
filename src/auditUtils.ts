const maxAuditLogEntries = 1500

export function normalizeAuditLogs<
  T extends {
    companyId?: number | null
    relatedCompanyIds?: number[]
    createdAt: string
  },
>(logs: T[] | undefined) {
  return (logs ?? [])
    .map((item) => ({
      ...item,
      companyId: item.companyId ?? null,
      relatedCompanyIds: item.relatedCompanyIds ?? [],
    }))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, maxAuditLogEntries)
}

export function getCurrentCompanyAuditLogs<
  T extends {
    companyId: number | null
    relatedCompanyIds: number[]
  },
>(auditLogs: T[], currentCompanyId: number | null) {
  if (currentCompanyId === null) {
    return [] as T[]
  }

  return auditLogs.filter(
    (item) => item.companyId === currentCompanyId || item.relatedCompanyIds.includes(currentCompanyId),
  )
}

export function getAuditAlertLogs<
  T extends {
    severity: string
  },
>(auditLogs: T[]) {
  return auditLogs.filter((item) => item.severity !== 'info').slice(0, 20)
}

export function getAuditImpactLogs<
  T extends {
    module: string
  },
>(auditLogs: T[]) {
  return auditLogs
    .filter(
      (item) =>
        item.module === 'Usuarios' ||
        item.module === 'Empresa' ||
        item.module === 'Escala' ||
        item.module === 'Comentarios',
    )
    .slice(0, 30)
}

export function filterAuditLogs<
  T extends {
    action: string
    module: string
    targetLabel: string
    actorName: string
    actorRole: string
    impactSummary: string
    severity: string
  },
>(
  auditLogs: T[],
  filters: {
    search: string
    module: string
    severity: string
  },
) {
  const normalizedSearch = filters.search.trim().toLowerCase()

  return auditLogs.filter((item) => {
    if (filters.module !== 'Todos' && item.module !== filters.module) {
      return false
    }

    if (filters.severity !== 'Todas' && item.severity !== filters.severity) {
      return false
    }

    if (!normalizedSearch) {
      return true
    }

    const haystack = [
      item.action,
      item.module,
      item.targetLabel,
      item.actorName,
      item.actorRole,
      item.impactSummary,
    ]
      .join(' ')
      .toLowerCase()

    return haystack.includes(normalizedSearch)
  })
}
