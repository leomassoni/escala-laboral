export const companyRoles = ['Administrativo', 'Gestor', 'Visualizador'] as const

export const appSections = [
  'Painel',
  'Escala',
  'Cobertura',
  'Colaboradores',
  'Funcoes',
  'Horarios',
  'Usuarios',
  'Empresa',
  'Convencoes',
] as const

export const masterPanelSections = ['Auditoria', 'Alertas', 'Impactos'] as const

export type CompanyRole = (typeof companyRoles)[number]
export type AppSection = (typeof appSections)[number]
export type MasterPanelSection = (typeof masterPanelSections)[number]
export type UserSectionAccess = Record<AppSection, boolean>

export function buildDefaultSectionAccessByRole(role: CompanyRole): UserSectionAccess {
  if (role === 'Visualizador') {
    return {
      Painel: false,
      Escala: true,
      Cobertura: false,
      Colaboradores: false,
      Funcoes: false,
      Horarios: false,
      Usuarios: false,
      Empresa: false,
      Convencoes: false,
    }
  }

  if (role === 'Gestor') {
    return {
      Painel: true,
      Escala: true,
      Cobertura: true,
      Colaboradores: true,
      Funcoes: true,
      Horarios: true,
      Usuarios: false,
      Empresa: false,
      Convencoes: false,
    }
  }

  return {
    Painel: true,
    Escala: true,
    Cobertura: true,
    Colaboradores: true,
    Funcoes: true,
    Horarios: true,
    Usuarios: true,
    Empresa: true,
    Convencoes: true,
  }
}

export function normalizeSectionAccess(
  role: CompanyRole,
  sectionAccess?: Partial<UserSectionAccess>,
): UserSectionAccess {
  return {
    ...buildDefaultSectionAccessByRole(role),
    ...(sectionAccess ?? {}),
  }
}
