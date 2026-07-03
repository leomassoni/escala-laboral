export const storageKeys = {
  companies: 'escala-laboral:companies',
  agreements: 'escala-laboral:agreements',
  sectors: 'escala-laboral:sectors',
  functions: 'escala-laboral:functions',
  collaboratorProfiles: 'escala-laboral:collaborator-profiles',
  collaborators: 'escala-laboral:collaborators',
  schedules: 'escala-laboral:schedules',
  scaleAssignments: 'escala-laboral:scale-assignments',
  scaleComments: 'escala-laboral:scale-comments',
  scaleExtraRoster: 'escala-laboral:scale-extra-roster',
  users: 'escala-laboral:users',
  auditLogs: 'escala-laboral:audit-logs',
  session: 'escala-laboral:session',
  currentCompanyId: 'escala-laboral:current-company-id',
} as const

export const appStateVersion = 1
export const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')
export const modularStateKeys = [
  'agreements',
  'sectors',
  'functions',
  'collaboratorProfiles',
  'collaborators',
  'schedules',
  'scaleAssignments',
  'scaleComments',
  'scaleExtraRoster',
  'users',
  'auditLogs',
] as const

export type ModularStateKey = (typeof modularStateKeys)[number]

export function readStoredValue<T>(key: string, fallback: T) {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const rawValue = window.localStorage.getItem(key)
    if (!rawValue) {
      return fallback
    }

    return JSON.parse(rawValue) as T
  } catch {
    return fallback
  }
}

export function writeStoredValue<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}
