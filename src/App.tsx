import { Fragment, useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

const collaboratorEmploymentTypes = ['CLT', 'PJ', 'EXTRA'] as const
const scaleEmploymentOrder = ['CLT', 'PJ', 'EXTRA'] as const
const companyRoles = ['Administrativo', 'Gestor', 'Visualizador'] as const
const appSections = [
  'Painel',
  'Escala',
  'Colaboradores',
  'Funcoes',
  'Horarios',
  'Usuarios',
  'Empresa',
  'Convencoes',
] as const

const brazilianStates = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const

const reportOptions: Array<{ id: ReportId; label: string }> = [
  { id: 'scale-consolidated', label: 'Escala consolidada' },
  { id: 'workload-by-collaborator', label: 'Carga horaria por colaborador' },
  { id: 'scale-irregularities', label: 'Irregularidades da escala' },
  { id: 'extras', label: 'Relatorio de extras' },
  { id: 'availability', label: 'Disponibilidade e inativacoes' },
  { id: 'coverage', label: 'Cobertura por setor e funcao' },
  { id: 'hour-exposure', label: 'Exposicao de jornada' },
  { id: 'schedule-usage', label: 'Mapa de horarios utilizados' },
  { id: 'user-access', label: 'Quadro de usuarios e acessos' },
]

type CollaboratorEmploymentType = (typeof collaboratorEmploymentTypes)[number]
type CompanyRole = (typeof companyRoles)[number]
type AppSection = (typeof appSections)[number]
type InactivePeriod = {
  from: string
  to: string | null
}

type CompanyRecord = {
  id: number
  status: 'ATIVA' | 'INATIVA'
  collectiveAgreementId: number | null
  suggestedCollectiveAgreementId: number | null
  collectiveProfile: 'padrao' | 'plano-saude' | 'regramento-especifico'
  tradeName: string
  legalName: string
  cnpj: string
  zipCode: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
}

type FunctionRecord = {
  id: number
  companyId: number
  name: string
  sector: string
  description: string
  baseSalary: string
  serviceQuota: string
  extraPayValue: string
  isActive: boolean
  inactivePeriods: InactivePeriod[]
}

type SectorRecord = {
  id: number
  companyId: number
  name: string
}

type CollaboratorRecord = {
  id: number
  companyId: number
  cpf: string
  employmentType: CollaboratorEmploymentType
  isActive: boolean
  inactiveSince: string | null
  inactivePeriods: InactivePeriod[]
  functions: string[]
  primaryFunction: string
}

type CollaboratorProfileRecord = {
  cpf: string
  fullName: string
  pixKey: string
  contact: string
  knownFunctions: string[]
}

type ScheduleRecord = {
  id: number
  companyId: number
  isActive: boolean
  inactivePeriods: InactivePeriod[]
  shiftName: string
  abbreviation: string
  startTime: string
  startPeriod: 'AM' | 'PM'
  breakStart: string
  breakStartPeriod: 'AM' | 'PM'
  breakEnd: string
  breakEndPeriod: 'AM' | 'PM'
  endTime: string
  endPeriod: 'AM' | 'PM'
  netMinutes: number
  validationMessage: string
}

type ScaleAssignmentRecord = {
  id: number
  companyId: number
  collaboratorId: number
  date: string
  scheduleId: number
}

type ScaleCommentMessage = {
  id: number
  authorName: string
  authorRole: string
  authorKey?: string
  body: string
  createdAt: string
  recipientKeys: string[]
  readByKeys: string[]
}

type ScaleCommentThreadRecord = {
  id: number
  companyId: number
  collaboratorId: number
  date: string
  messages: ScaleCommentMessage[]
}

type ScaleExtraRosterRecord = {
  id: number
  companyId: number
  collaboratorId: number
  weekStart: string
}

type CompanyUserRecord = {
  id: number
  companyId: number
  fullName: string
  username: string
  password: string
  role: CompanyRole
  sectors: string[]
  linkedCollaboratorId: number | null
  isActive: boolean
}

type ScaleViewMode = 'week' | 'month'
type ReportId =
  | 'scale-consolidated'
  | 'workload-by-collaborator'
  | 'scale-irregularities'
  | 'extras'
  | 'availability'
  | 'coverage'
  | 'hour-exposure'
  | 'schedule-usage'
  | 'user-access'

type ReportColumn = {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
}

type ReportSummaryMetric = {
  label: string
  value: string
}

type ReportRowValue = string | number

type ReportDataset = {
  id: ReportId
  title: string
  description: string
  filenameSuffix: string
  columns: ReportColumn[]
  rows: Array<Record<string, ReportRowValue>>
  summary: ReportSummaryMetric[]
}

type SystemAdmin = {
  id: number
  fullName: string
  username: string
  password: string
  role: 'Administrador do sistema'
}

type ValidationResult = {
  valid: boolean
  errors: string[]
  notes: string[]
  netMinutes?: number
}

type ScheduleFormState = {
  shiftName: string
  startTime: string
  startPeriod: 'AM' | 'PM'
  breakStart: string
  breakStartPeriod: 'AM' | 'PM'
  breakEnd: string
  breakEndPeriod: 'AM' | 'PM'
  endTime: string
  endPeriod: 'AM' | 'PM'
}

const storageKeys = {
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
} as const

const appStateVersion = 1
const apiBaseUrl = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')

type AppStateSnapshot = {
  version: number
  companies: CompanyRecord[]
  agreements: CollectiveAgreementRecord[]
  sectors: SectorRecord[]
  functions: FunctionRecord[]
  collaboratorProfiles: CollaboratorProfileRecord[]
  collaborators: CollaboratorRecord[]
  schedules: ScheduleRecord[]
  scaleAssignments: ScaleAssignmentRecord[]
  scaleComments: ScaleCommentThreadRecord[]
  scaleExtraRoster: ScaleExtraRosterRecord[]
  users: CompanyUserRecord[]
}

type CollaboratorModalSource = 'scale' | 'user'

type CollectiveAgreementRecord = {
  id: number
  name: string
  employerUnion: string
  employeeUnion: string
  coveredState: string
  coveredCity: string
  category: string
  validFrom: string
  validTo: string
  sourceUrl: string
  sourceLabel: string
  notes: string
  isActive: boolean
  rules: {
    standardMealBreakAfterSixHoursMinutes: number
    shortShiftBreakMinutes: number
    standardBreakMaxMinutes: number
    healthPlanBreakMaxMinutes: number
    specialBreakMinMinutes: number
    specialBreakMaxMinutes: number
    maxDailyMinutes: number
    allowTwelveByThirtySix: boolean
    bankHoursMaxDailyMinutes: number
    rotatingDayOffNoticeDays: number
  }
}

type Session =
  | {
      kind: 'systemAdmin'
      user: SystemAdmin
    }
  | {
      kind: 'companyUser'
      user: CompanyUserRecord
    }

const systemAdmins: SystemAdmin[] = [
  {
    id: 1,
    fullName: 'Administrador Master',
    username: 'igarape.aeb',
    password: 'Leo180613*',
    role: 'Administrador do sistema',
  },
]

const initialCollectiveAgreements: CollectiveAgreementRecord[] = [
  {
    id: 1,
    name: 'CCT Bares e Restaurantes 2025-2027 - Sao Paulo Capital e Regiao',
    employerUnion: 'Sindresbar',
    employeeUnion: 'Sinthoresp',
    coveredState: 'SP',
    coveredCity: 'Sao Paulo',
    category: 'Bares, restaurantes e similares',
    validFrom: '2025-07-01',
    validTo: '2027-06-30',
    sourceUrl:
      'https://sinthoresp.com.br/site/wp-content/uploads/2025/05/CCT-SINDRESBAR-2025.pdf',
    sourceLabel: 'PDF oficial da CCT 2025-2027',
    notes:
      'Clausula 18: intervalo padrao de 15 min entre 4h e 6h, 1h apos 6h, com ampliacoes condicionadas pela propria CCT. Clausula 17: jornada 12x36 permitida para empresa habilitada. Clausula 43: escalas de folgas com antecedencia minima de 15 dias.',
    isActive: true,
    rules: {
      standardMealBreakAfterSixHoursMinutes: 60,
      shortShiftBreakMinutes: 15,
      standardBreakMaxMinutes: 120,
      healthPlanBreakMaxMinutes: 240,
      specialBreakMinMinutes: 30,
      specialBreakMaxMinutes: 240,
      maxDailyMinutes: 600,
      allowTwelveByThirtySix: true,
      bankHoursMaxDailyMinutes: 600,
      rotatingDayOffNoticeDays: 15,
    },
  },
  {
    id: 2,
    name: 'CCT Refeicoes, Fast Food, Lanchonetes e Afins 2025-2026 - Rio de Janeiro',
    employerUnion: 'SindRio',
    employeeUnion: 'SindiRefeicoes-RJ',
    coveredState: 'RJ',
    coveredCity: 'Rio de Janeiro',
    category: 'Restaurantes, bares, lanchonetes, fast food e afins',
    validFrom: '2025-01-01',
    validTo: '2026-12-31',
    sourceUrl:
      'https://sindrio.com.br/wp-content/uploads/2025/06/CCT-SINDIREFEICOES-REGISTRADA.pdf',
    sourceLabel: 'Extrato oficial no Mediador publicado pelo SindRio',
    notes:
      'Fonte oficial sindical com registro RJ001622/2025. Seed parametrizada com baseline CLT para jornada e intervalo ate extracao completa das clausulas especificas de tempo de trabalho.',
    isActive: true,
    rules: {
      standardMealBreakAfterSixHoursMinutes: 60,
      shortShiftBreakMinutes: 15,
      standardBreakMaxMinutes: 120,
      healthPlanBreakMaxMinutes: 120,
      specialBreakMinMinutes: 30,
      specialBreakMaxMinutes: 120,
      maxDailyMinutes: 600,
      allowTwelveByThirtySix: false,
      bankHoursMaxDailyMinutes: 600,
      rotatingDayOffNoticeDays: 7,
    },
  },
  {
    id: 3,
    name: 'CCT Bares, Restaurantes e Similares 2025-2026 - Goiania',
    employerUnion: 'Sindibares Goiania',
    employeeUnion: 'Sindicato Intermunicipal dos Empregados no Comercio Hoteleiro do Estado de Goias',
    coveredState: 'GO',
    coveredCity: 'Goiania',
    category: 'Bares, restaurantes e similares',
    validFrom: '2025-03-01',
    validTo: '2026-02-28',
    sourceUrl:
      'https://sindibaresgoiania.com.br/site/wp-content/uploads/2025/04/Convencao-Coletiva-de-Trabalho-2025-A-2026-sindibares-4.pdf',
    sourceLabel: 'Extrato oficial no Mediador publicado pelo Sindibares Goiania',
    notes:
      'Fonte oficial sindical com registro GO000160/2025. Seed parametrizada com baseline CLT para jornada e intervalo ate extracao completa das clausulas especificas de tempo de trabalho.',
    isActive: true,
    rules: {
      standardMealBreakAfterSixHoursMinutes: 60,
      shortShiftBreakMinutes: 15,
      standardBreakMaxMinutes: 120,
      healthPlanBreakMaxMinutes: 120,
      specialBreakMinMinutes: 30,
      specialBreakMaxMinutes: 120,
      maxDailyMinutes: 600,
      allowTwelveByThirtySix: false,
      bankHoursMaxDailyMinutes: 600,
      rotatingDayOffNoticeDays: 7,
    },
  },
  {
    id: 4,
    name: 'CCT Hoteis, Restaurantes, Bares e Similares 2025-2026 - Curitiba e RMC',
    employerUnion: 'Sindicato de Hoteis, Restaurantes, Bares e Similares de Curitiba',
    employeeUnion: 'Sindicato dos Trabalhadores no Comercio Hoteleiro, Meios de Hospedagem e Gastronomia de Curitiba e Regiao',
    coveredState: 'PR',
    coveredCity: 'Curitiba',
    category: 'Hoteis, restaurantes, bares e similares',
    validFrom: '2025-06-01',
    validTo: '2026-05-31',
    sourceUrl: 'https://seha.com.br/wp-content/uploads/2025/06/CCT-CURITIBA-E-RMC-2025_2026.pdf',
    sourceLabel: 'PDF oficial publicado pelo SEHA Curitiba',
    notes:
      'Fonte patronal oficial. Abrangencia da capital e regiao metropolitana. Seed parametrizada com baseline CLT para jornada e intervalo ate extracao consolidada das clausulas especificas de tempo de trabalho.',
    isActive: true,
    rules: {
      standardMealBreakAfterSixHoursMinutes: 60,
      shortShiftBreakMinutes: 15,
      standardBreakMaxMinutes: 120,
      healthPlanBreakMaxMinutes: 120,
      specialBreakMinMinutes: 30,
      specialBreakMaxMinutes: 120,
      maxDailyMinutes: 600,
      allowTwelveByThirtySix: false,
      bankHoursMaxDailyMinutes: 600,
      rotatingDayOffNoticeDays: 7,
    },
  },
  {
    id: 5,
    name: 'CCT Hoteis, Restaurantes, Bares e Similares 2025-2026 - Grande Florianopolis',
    employerUnion: 'Sind de Hoteis, Restaurantes, Bares e Similares de Florianopolis',
    employeeUnion: 'SITRATUH',
    coveredState: 'SC',
    coveredCity: 'Florianopolis',
    category: 'Hoteis, restaurantes, bares, lanchonetes e similares',
    validFrom: '2025-06-01',
    validTo: '2026-05-31',
    sourceUrl: 'https://sites.diretasistemas.com.br/sites/343/wp-content/uploads/2025/09/01135152/HOTELEIROS-2025-2026.pdf',
    sourceLabel: 'PDF oficial listado na pagina de convencoes do SITRATUH',
    notes:
      'Fonte laboral oficial via pagina de convencoes do SITRATUH. Seed parametrizada com baseline CLT para jornada e intervalo ate extracao consolidada das clausulas especificas de tempo de trabalho.',
    isActive: true,
    rules: {
      standardMealBreakAfterSixHoursMinutes: 60,
      shortShiftBreakMinutes: 15,
      standardBreakMaxMinutes: 120,
      healthPlanBreakMaxMinutes: 120,
      specialBreakMinMinutes: 30,
      specialBreakMaxMinutes: 120,
      maxDailyMinutes: 600,
      allowTwelveByThirtySix: false,
      bankHoursMaxDailyMinutes: 600,
      rotatingDayOffNoticeDays: 7,
    },
  },
  {
    id: 6,
    name: 'CCT Hoteis, Restaurantes, Bares e Similares 2025-2026 - Jaboatao dos Guararapes e Regiao',
    employerUnion: 'Sindicato de Hoteis Restaurantes Bares e Similares do Estado',
    employeeUnion: 'Sind dos Trabalhadores Com Hoteleiro Sim Jaboatao dos Guararapes e Regiao',
    coveredState: 'PE',
    coveredCity: 'Jaboatao dos Guararapes',
    category: 'Hoteis, restaurantes, bares e similares',
    validFrom: '2025-09-01',
    validTo: '2026-08-31',
    sourceUrl:
      'https://sinthoresjpe.org.br/wp-content/uploads/2025/11/Convencao-Coletiva-de-Trabalho-SINDHOTEIS-BARES-E-RESTAURANTES-2025.2026.pdf',
    sourceLabel: 'PDF oficial publicado pelo sindicato laboral da base',
    notes:
      'Fonte laboral oficial para Jaboatao dos Guararapes e municipios da base. Seed parametrizada com baseline CLT para jornada e intervalo ate extracao consolidada das clausulas especificas de tempo de trabalho.',
    isActive: true,
    rules: {
      standardMealBreakAfterSixHoursMinutes: 60,
      shortShiftBreakMinutes: 15,
      standardBreakMaxMinutes: 120,
      healthPlanBreakMaxMinutes: 120,
      specialBreakMinMinutes: 30,
      specialBreakMaxMinutes: 120,
      maxDailyMinutes: 600,
      allowTwelveByThirtySix: false,
      bankHoursMaxDailyMinutes: 600,
      rotatingDayOffNoticeDays: 7,
    },
  },
]

const emptyCompanyForm = {
  tradeName: '',
  legalName: '',
  cnpj: '',
  zipCode: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  state: '',
  collectiveAgreementId: '',
}

const emptyFunctionForm = {
  name: '',
  sector: '',
  description: '',
  baseSalary: '',
  serviceQuota: '',
  extraPayValue: '',
}

const emptyCollaboratorForm = {
  cpf: '',
  fullName: '',
  pixKey: '',
  contact: '',
  employmentType: 'CLT' as CollaboratorEmploymentType,
  functions: [] as string[],
  primaryFunction: '',
}

const emptyScheduleForm: ScheduleFormState = {
  shiftName: '',
  startTime: '',
  startPeriod: 'AM',
  breakStart: '',
  breakStartPeriod: 'AM',
  breakEnd: '',
  breakEndPeriod: 'AM',
  endTime: '',
  endPeriod: 'AM',
}

const emptyUserForm = {
  fullName: '',
  username: '',
  password: '',
  role: 'Gestor' as CompanyRole,
  sectors: [] as string[],
  linkedCollaboratorId: '',
}

const emptyAgreementForm = {
  name: '',
  employerUnion: '',
  employeeUnion: '',
  coveredState: 'SP',
  coveredCity: '',
  category: 'Bares, restaurantes e similares',
  validFrom: '',
  validTo: '',
  sourceUrl: '',
  sourceLabel: '',
  notes: '',
  standardMealBreakAfterSixHoursMinutes: '60',
  shortShiftBreakMinutes: '15',
  standardBreakMaxMinutes: '120',
  healthPlanBreakMaxMinutes: '240',
  specialBreakMinMinutes: '30',
  specialBreakMaxMinutes: '240',
  maxDailyMinutes: '600',
  bankHoursMaxDailyMinutes: '600',
  rotatingDayOffNoticeDays: '15',
  allowTwelveByThirtySix: true,
}

function normalizeAbbreviation(value: string) {
  const compact = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .trim()
    .toUpperCase()

  if (compact.length >= 3) {
    return compact.slice(0, 3)
  }

  return (compact + 'XXX').slice(0, 3)
}

function formatCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)

  return digits
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

function formatZipCode(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8)
  return digits.replace(/^(\d{5})(\d)/, '$1-$2')
}

function formatCpf(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1-$2')
}

function formatTimeInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length <= 1) {
    return digits
  }

  if (digits.length === 2) {
    return digits
  }

  if (digits.length === 3) {
    return `${digits.slice(0, 2)}:${digits.slice(2)}`
  }

  return `${digits.slice(0, 2)}:${digits.slice(2)}`
}

function normalizeTypedTime(value: string, currentPeriod: 'AM' | 'PM') {
  const digits = value.replace(/\D/g, '').slice(0, 4)

  if (digits.length < 4) {
    return {
      time: formatTimeInput(digits),
      period: currentPeriod,
    }
  }

  const rawHours = Number(digits.slice(0, 2))
  const rawMinutes = Number(digits.slice(2))

  if (rawMinutes > 59 || rawHours > 24 || (rawHours === 24 && rawMinutes > 0)) {
    return {
      time: formatTimeInput(digits),
      period: currentPeriod,
    }
  }

  if (rawHours <= 12) {
    return {
      time: `${digits.slice(0, 2)}:${digits.slice(2)}`,
      period: 'AM' as const,
    }
  }

  const normalizedHour = rawHours === 24 ? 12 : rawHours - 12

  return {
    time: `${String(normalizedHour).padStart(2, '0')}:${digits.slice(2)}`,
    period: 'PM' as const,
  }
}

function isCompleteTimeInput(value: string) {
  return /^\d{2}:\d{2}$/.test(value)
}

function normalizeLocationValue(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
}

function resolveCollectiveAgreementId(
  agreements: CollectiveAgreementRecord[],
  state: string,
  city: string,
) {
  const matches = findCollectiveAgreementMatches(agreements, state, city)
  return matches.length === 1 ? matches[0].id : null
}

function reconcileCompanyAgreementLink(
  company: CompanyRecord,
  agreements: CollectiveAgreementRecord[],
): Pick<CompanyRecord, 'collectiveAgreementId' | 'suggestedCollectiveAgreementId'> {
  const suggestedCollectiveAgreementId = resolveCollectiveAgreementId(agreements, company.state, company.city)
  const selectedStillExists =
    company.collectiveAgreementId !== null &&
    agreements.some((item) => item.id === company.collectiveAgreementId)
  const usesAutomaticSelection =
    company.collectiveAgreementId === null ||
    company.collectiveAgreementId === company.suggestedCollectiveAgreementId

  return {
    collectiveAgreementId:
      !selectedStillExists || usesAutomaticSelection
        ? suggestedCollectiveAgreementId
        : company.collectiveAgreementId,
    suggestedCollectiveAgreementId,
  }
}

function findCollectiveAgreementMatches(
  agreements: CollectiveAgreementRecord[],
  state: string,
  city: string,
) {
  const normalizedState = normalizeLocationValue(state)
  const normalizedCity = normalizeLocationValue(city)

  return agreements.filter(
    (item) =>
      normalizeLocationValue(item.coveredState) === normalizedState &&
      normalizeLocationValue(item.coveredCity) === normalizedCity,
  )
}

function normalizeInactivePeriods(
  periods: InactivePeriod[] | undefined,
  isActive: boolean | undefined,
  fallbackInactiveSince?: string | null,
) {
  if (periods && periods.length > 0) {
    return periods
      .map((item) => ({
        from: item.from,
        to: item.to ?? null,
      }))
      .sort((left, right) => left.from.localeCompare(right.from))
  }

  if (fallbackInactiveSince) {
    return [{ from: fallbackInactiveSince, to: null }]
  }

  if (isActive === false) {
    return [{ from: '1900-01-01', to: null }]
  }

  return []
}

function isInactiveOnDate(periods: InactivePeriod[], date: string) {
  return periods.some((period) => date >= period.from && (period.to === null || date < period.to))
}

function startInactivePeriod(periods: InactivePeriod[], from: string) {
  if (periods.some((period) => period.to === null)) {
    return periods
  }

  return [...periods, { from, to: null }]
}

function endInactivePeriod(periods: InactivePeriod[], to: string) {
  let closed = false
  return periods.map((period) => {
    if (closed || period.to !== null) {
      return period
    }

    closed = true
    return { ...period, to }
  })
}

function parseTime(value: string, period: 'AM' | 'PM') {
  if (!isCompleteTimeInput(value)) {
    return null
  }

  const [hours, minutes] = value.split(':').map(Number)
  if (hours < 0 || hours > 24 || minutes > 59) {
    return null
  }

  if (hours === 24 && minutes > 0) {
    return null
  }

  if (period === 'AM') {
    if (hours === 0 && minutes === 0) {
      return null
    }

    if (hours > 12) {
      return null
    }

    if (hours === 12 && minutes > 0) {
      return null
    }

    return hours * 60 + minutes
  }

  if (hours >= 13 && hours <= 24) {
    return hours * 60 + minutes
  }

  if (hours === 0 || hours > 12) {
    return null
  }

  if (hours === 12) {
    if (minutes === 0) {
      return 24 * 60
    }

    return hours * 60 + minutes
  }

  return (hours + 12) * 60 + minutes
}

function buildSchedulePreview(values: ScheduleFormState) {
  const issues: string[] = []
  const labels = [
    ['startTime', 'Horario de inicio'],
    ['breakStart', 'Inicio de pausa'],
    ['breakEnd', 'Fim de pausa'],
    ['endTime', 'Fim do turno'],
  ] as const

  labels.forEach(([field, label]) => {
    if (!isCompleteTimeInput(values[field])) {
      issues.push(`${label}: digite exatamente 4 numeros no formato 0000.`)
    }
  })

  const start = parseTime(values.startTime, values.startPeriod)
  const breakStart = parseTime(values.breakStart, values.breakStartPeriod)
  const breakEnd = parseTime(values.breakEnd, values.breakEndPeriod)
  const end = parseTime(values.endTime, values.endPeriod)

  if (isCompleteTimeInput(values.startTime) && start === null) {
    issues.push('Horario de inicio invalido para o periodo selecionado.')
  }

  if (isCompleteTimeInput(values.breakStart) && breakStart === null) {
    issues.push('Inicio de pausa invalido para o periodo selecionado.')
  }

  if (isCompleteTimeInput(values.breakEnd) && breakEnd === null) {
    issues.push('Fim de pausa invalido para o periodo selecionado.')
  }

  if (isCompleteTimeInput(values.endTime) && end === null) {
    issues.push('Fim do turno invalido para o periodo selecionado.')
  }

  if ([start, breakStart, breakEnd, end].some((item) => item === null)) {
    return { netMinutes: undefined, issues }
  }

  const safeStart = start as number
  const safeBreakStart = breakStart as number
  const safeBreakEnd = breakEnd as number
  const safeEnd = end as number

  const [normalizedStart, normalizedBreakStart, normalizedBreakEnd, normalizedEnd] =
    normalizeSequentialTimes([safeStart, safeBreakStart, safeBreakEnd, safeEnd])

  if (
    !(
      normalizedStart < normalizedBreakStart &&
      normalizedBreakStart < normalizedBreakEnd &&
      normalizedBreakEnd < normalizedEnd
    )
  ) {
    issues.push('A sequencia de inicio, pausa e fim do turno esta invalida.')
    return { netMinutes: undefined, issues }
  }

  const netMinutes =
    normalizedEnd - normalizedStart - (normalizedBreakEnd - normalizedBreakStart)

  if (netMinutes <= 0) {
    issues.push('A jornada liquida precisa ser maior que zero.')
    return { netMinutes: undefined, issues }
  }

  return { netMinutes, issues }
}

function normalizeSequentialTimes(values: number[]) {
  const result: number[] = []

  values.forEach((value, index) => {
    if (index === 0) {
      result.push(value)
      return
    }

    let candidate = value
    while (candidate <= result[index - 1]) {
      candidate += 24 * 60
    }
    result.push(candidate)
  })

  return result
}

function formatWorkedHours(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function parseCurrencyValue(value: string) {
  const normalized = value
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '')

  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10)
}

function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate)
  nextDate.setDate(nextDate.getDate() + days)
  return nextDate
}

function startOfWeek(dateValue: string | Date) {
  const sourceDate = typeof dateValue === 'string' ? new Date(`${dateValue}T12:00:00`) : new Date(dateValue)
  const day = sourceDate.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  return addDays(sourceDate, mondayOffset)
}

function endOfWeek(dateValue: string | Date) {
  return addDays(startOfWeek(dateValue), 6)
}

function getWeekDates(dateValue: string | Date) {
  const weekStart = startOfWeek(dateValue)
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index))
}

function getMonthWeeks(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number)
  const firstDay = new Date(year, month - 1, 1, 12)
  const lastDay = new Date(year, month, 0, 12)
  const cursor = startOfWeek(firstDay)
  const finalWeekEnd = endOfWeek(lastDay)
  const weeks: Date[][] = []

  while (cursor <= finalWeekEnd) {
    weeks.push(getWeekDates(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }

  return weeks
}

function getMonthLabel(monthValue: string) {
  const [year, month] = monthValue.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', {
    month: 'long',
    year: 'numeric',
  }).format(new Date(year, month - 1, 1))
}

function formatWeekLabel(weekDates: Date[]) {
  const formatter = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })

  return `${formatter.format(weekDates[0])} a ${formatter.format(weekDates[6])}`
}

function formatDayHeader(date: Date) {
  return new Intl.DateTimeFormat('pt-BR', {
    weekday: 'short',
    day: '2-digit',
  }).format(date)
}

function formatDateLabel(dateValue: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(`${dateValue}T12:00:00`))
}

function slugifyFilePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function getShortDisplayName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) {
    return fullName.trim()
  }

  return `${parts[0]} ${parts[parts.length - 1]}`
}

function normalizeScaleCommentThreads(
  threads: unknown,
) {
  if (!Array.isArray(threads)) {
    return [] as ScaleCommentThreadRecord[]
  }

  return threads.map((thread) => {
    const safeThread = thread as ScaleCommentThreadRecord & {
      messages?: Array<
        ScaleCommentMessage & {
          recipientKeys?: string[]
          readByKeys?: string[]
        }
      >
    }

    return {
      ...safeThread,
      messages: Array.isArray(safeThread.messages)
        ? safeThread.messages.map((message) => ({
            ...message,
            authorKey: typeof message.authorKey === 'string' ? message.authorKey : undefined,
            recipientKeys: Array.isArray(message.recipientKeys) ? message.recipientKeys : [],
            readByKeys: Array.isArray(message.readByKeys) ? message.readByKeys : [],
          }))
        : [],
    }
  })
}

function formatDateTimeLabel(dateValue: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(dateValue))
}

function formatMonthDateLabel(dateValue: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
  }).format(new Date(`${dateValue}T12:00:00`))
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function computeScheduleNetMinutes(values: ScheduleFormState) {
  return buildSchedulePreview(values).netMinutes
}

function readStoredValue<T>(key: string, fallback: T) {
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

function writeStoredValue<T>(key: string, value: T) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

function mergeSeedAgreements(storedAgreements: Array<CollectiveAgreementRecord & { isActive?: boolean }>) {
  if (storedAgreements.length === 0) {
    return initialCollectiveAgreements.map((item) => ({ ...item, isActive: item.isActive ?? true }))
  }

  const combinedAgreements = storedAgreements.map((item) => ({
    ...item,
    isActive: item.isActive ?? true,
  }))

  initialCollectiveAgreements.forEach((seedAgreement) => {
    if (!combinedAgreements.some((item) => item.id === seedAgreement.id)) {
      combinedAgreements.push({ ...seedAgreement, isActive: seedAgreement.isActive ?? true })
    }
  })

  return combinedAgreements
}

function normalizePersistedState(state: AppStateSnapshot) {
  return {
    companies: state.companies.map((item) => ({
      ...item,
      suggestedCollectiveAgreementId: item.suggestedCollectiveAgreementId ?? null,
    })),
    agreements: mergeSeedAgreements(state.agreements),
    sectors: state.sectors,
    functions: state.functions.map((item) => ({
      ...item,
      isActive: item.isActive ?? true,
      inactivePeriods: normalizeInactivePeriods(item.inactivePeriods, item.isActive),
    })),
    collaboratorProfiles: state.collaboratorProfiles,
    collaborators: state.collaborators.map((item) => ({
      ...item,
      inactiveSince: item.inactiveSince ?? null,
      inactivePeriods: normalizeInactivePeriods(item.inactivePeriods, item.isActive, item.inactiveSince),
    })),
    schedules: state.schedules.map((item) => ({
      ...item,
      inactivePeriods: normalizeInactivePeriods(item.inactivePeriods, item.isActive),
    })),
    scaleAssignments: state.scaleAssignments,
    scaleComments: normalizeScaleCommentThreads(state.scaleComments),
    scaleExtraRoster: state.scaleExtraRoster,
    users: state.users.map((item) => ({
      ...item,
      sectors: item.sectors && item.sectors.length > 0 ? item.sectors : [],
      linkedCollaboratorId: item.linkedCollaboratorId ?? null,
      isActive: item.isActive ?? true,
    })),
  }
}

function validateSchedule(
  values: ScheduleFormState,
  company: CompanyRecord | null,
  agreement: CollectiveAgreementRecord | null,
): ValidationResult {
  const errors: string[] = []
  const notes: string[] = []
  const start = parseTime(values.startTime, values.startPeriod)
  const breakStart = parseTime(values.breakStart, values.breakStartPeriod)
  const breakEnd = parseTime(values.breakEnd, values.breakEndPeriod)
  const end = parseTime(values.endTime, values.endPeriod)
  const schedulePreview = buildSchedulePreview(values)

  if (!values.shiftName.trim()) {
    errors.push('Informe o nome do turno.')
  }

  errors.push(...schedulePreview.issues)

  if (
    schedulePreview.netMinutes !== undefined &&
    start !== null &&
    breakStart !== null &&
    breakEnd !== null &&
    end !== null
  ) {
    const [normalizedStart, normalizedBreakStart, normalizedBreakEnd, normalizedEnd] =
      normalizeSequentialTimes([start, breakStart, breakEnd, end])

    const grossDuration = normalizedEnd - normalizedStart
    const breakDuration = normalizedBreakEnd - normalizedBreakStart
    const netDuration = grossDuration - breakDuration

    if (!(normalizedStart < normalizedBreakStart && normalizedBreakStart < normalizedBreakEnd && normalizedBreakEnd < normalizedEnd)) {
      errors.push('A sequencia de inicio, pausa e fim do turno esta invalida.')
    }

    if (netDuration <= 0) {
      errors.push('A jornada liquida precisa ser maior que zero.')
    }

    const longShiftThreshold = 360
    const midShiftThreshold = 240
    const standardLongBreak = agreement?.rules.standardMealBreakAfterSixHoursMinutes ?? 60
    const shortBreak = agreement?.rules.shortShiftBreakMinutes ?? 15
    const standardBreakMax = agreement?.rules.standardBreakMaxMinutes ?? 120
    const healthPlanBreakMax = agreement?.rules.healthPlanBreakMaxMinutes ?? 120
    const specialBreakMin = agreement?.rules.specialBreakMinMinutes ?? 30
    const specialBreakMax = agreement?.rules.specialBreakMaxMinutes ?? 240
    const maxDailyMinutes = agreement?.rules.maxDailyMinutes ?? 600

    if (grossDuration > longShiftThreshold) {
      if (company?.collectiveProfile === 'regramento-especifico') {
        if (breakDuration < specialBreakMin || breakDuration > specialBreakMax) {
          errors.push(
            `Para empresa habilitada em regramento especifico, o intervalo deve ficar entre ${specialBreakMin} e ${specialBreakMax} minutos.`,
          )
        }
      } else {
        if (breakDuration < standardLongBreak) {
          errors.push(
            `Jornadas acima de 6 horas exigem ao menos ${standardLongBreak} minutos de intervalo intrajornada.`,
          )
        }

        const maxBreakAllowed =
          company?.collectiveProfile === 'plano-saude' ? healthPlanBreakMax : standardBreakMax

        if (breakDuration > maxBreakAllowed) {
          errors.push(
            company?.collectiveProfile === 'plano-saude'
              ? `Com perfil de plano de saude, o intervalo nao pode exceder ${healthPlanBreakMax} minutos nesta CCT.`
              : `Nesta CCT, intervalos acima de ${standardBreakMax} minutos exigem habilitacao especifica da empresa.`,
          )
        }
      }
    }

    if (grossDuration > midShiftThreshold && grossDuration <= longShiftThreshold && breakDuration < shortBreak) {
      errors.push(`Jornadas entre 4 e 6 horas exigem ao menos ${shortBreak} minutos de intervalo.`)
    }

    if (netDuration > 480) {
      notes.push('Jornadas liquidas acima de 8 horas pedem verificacao de compensacao, acordo ou horas extras.')
    }

    if (netDuration > maxDailyMinutes) {
      errors.push(
        `A jornada liquida ultrapassa ${Math.floor(maxDailyMinutes / 60)} horas e precisa de revisao antes do uso.`,
      )
    }
  }

  if (!company) {
    errors.push('Selecione uma empresa antes de cadastrar horarios.')
  } else if (!agreement) {
    errors.push(
      `Nao ha convencao coletiva parametrizada para ${company.city}/${company.state}. Cadastre ou vincule uma CCT antes de validar horarios.`,
    )
  } else {
    notes.push(
      `CCT aplicada: ${agreement.name} (${agreement.validFrom} a ${agreement.validTo}).`,
    )
    if (company.collectiveProfile === 'regramento-especifico') {
      notes.push('Empresa marcada como habilitada em regramento especifico da CCT para intervalo reduzido/ampliado.')
    } else if (company.collectiveProfile === 'plano-saude') {
      notes.push('Empresa marcada com perfil de plano de saude para ampliacao de intervalo prevista na CCT.')
    }
  }

  return { valid: errors.length === 0, errors, notes, netMinutes: errors.length === 0 ? (() => {
    if (schedulePreview.netMinutes === undefined) {
      return undefined
    }
    return schedulePreview.netMinutes
  })() : undefined }
}

function App() {
  const [activeSection, setActiveSection] = useState<AppSection>('Painel')
  const [companies, setCompanies] = useState<CompanyRecord[]>(() =>
    readStoredValue<Array<CompanyRecord & { suggestedCollectiveAgreementId?: number | null }>>(storageKeys.companies, []).map((item) => ({
      ...item,
      suggestedCollectiveAgreementId: item.suggestedCollectiveAgreementId ?? null,
    })),
  )
  const [agreements, setAgreements] = useState<CollectiveAgreementRecord[]>(() =>
    mergeSeedAgreements(
      readStoredValue<Array<CollectiveAgreementRecord & { isActive?: boolean }>>(storageKeys.agreements, []),
    ),
  )
  const [sectors, setSectors] = useState<SectorRecord[]>(() => {
    const storedSectors = readStoredValue<SectorRecord[]>(storageKeys.sectors, [])
    if (storedSectors.length > 0) {
      return storedSectors
    }

    const storedFunctions = readStoredValue<FunctionRecord[]>(storageKeys.functions, [])
    const storedUsers = readStoredValue<Array<CompanyUserRecord & { sector?: string }>>(storageKeys.users, [])
    const inferredEntries = new Map<string, SectorRecord>()

    storedFunctions.forEach((item) => {
      const trimmedSector = item.sector?.trim()
      if (!trimmedSector) {
        return
      }

      inferredEntries.set(`${item.companyId}:${trimmedSector.toLowerCase()}`, {
        id: inferredEntries.size + 1,
        companyId: item.companyId,
        name: trimmedSector,
      })
    })

    storedUsers.forEach((item) => {
      const userSectors = item.sectors && item.sectors.length > 0 ? item.sectors : item.sector ? [item.sector] : []
      userSectors.forEach((sectorName) => {
        const trimmedSector = sectorName.trim()
        if (!trimmedSector) {
          return
        }

        inferredEntries.set(`${item.companyId}:${trimmedSector.toLowerCase()}`, {
          id: inferredEntries.size + 1,
          companyId: item.companyId,
          name: trimmedSector,
        })
      })
    })

    return Array.from(inferredEntries.values())
  })
  const [functions, setFunctions] = useState<FunctionRecord[]>(() =>
    readStoredValue<Array<FunctionRecord & { paysExtra?: boolean; isActive?: boolean }>>(storageKeys.functions, []).map(
      (item) => ({
        ...item,
        extraPayValue:
          typeof item.extraPayValue === 'string'
            ? item.extraPayValue
            : item.paysExtra
              ? 'Sim'
              : '',
        isActive: item.isActive ?? true,
        inactivePeriods: normalizeInactivePeriods(
          (item as FunctionRecord & { inactivePeriods?: InactivePeriod[] }).inactivePeriods,
          item.isActive,
        ),
      }),
    ),
  )
  const [collaboratorProfiles, setCollaboratorProfiles] = useState<CollaboratorProfileRecord[]>(() =>
    readStoredValue(storageKeys.collaboratorProfiles, []),
  )
  const [collaborators, setCollaborators] = useState<CollaboratorRecord[]>(() =>
    readStoredValue<Array<CollaboratorRecord & { inactiveSince?: string | null; inactivePeriods?: InactivePeriod[] }>>(storageKeys.collaborators, []).map(
      (item) => ({
        ...item,
        inactiveSince: item.inactiveSince ?? null,
        inactivePeriods: normalizeInactivePeriods(item.inactivePeriods, item.isActive, item.inactiveSince),
      }),
    ),
  )
  const [schedules, setSchedules] = useState<ScheduleRecord[]>(() =>
    readStoredValue<Array<ScheduleRecord & { inactivePeriods?: InactivePeriod[] }>>(storageKeys.schedules, []).map((item) => ({
      ...item,
      inactivePeriods: normalizeInactivePeriods(item.inactivePeriods, item.isActive),
    })),
  )
  const [scaleAssignments, setScaleAssignments] = useState<ScaleAssignmentRecord[]>(() =>
    readStoredValue(storageKeys.scaleAssignments, []),
  )
  const [scaleComments, setScaleComments] = useState<ScaleCommentThreadRecord[]>(() =>
    normalizeScaleCommentThreads(readStoredValue(storageKeys.scaleComments, [])),
  )
  const [scaleExtraRoster, setScaleExtraRoster] = useState<ScaleExtraRosterRecord[]>(() =>
    readStoredValue(storageKeys.scaleExtraRoster, []),
  )
  const [users, setUsers] = useState<CompanyUserRecord[]>(() =>
    readStoredValue<
      Array<CompanyUserRecord & { sector?: string; isActive?: boolean; linkedCollaboratorId?: number | null }>
    >(storageKeys.users, []).map((item) => ({
      ...item,
      sectors:
        item.sectors && item.sectors.length > 0
          ? item.sectors
          : item.sector
            ? [item.sector]
            : [],
      linkedCollaboratorId: item.linkedCollaboratorId ?? null,
      isActive: item.isActive ?? true,
    })),
  )
  const [persistenceMode, setPersistenceMode] = useState<'pending' | 'local' | 'api'>('pending')
  const [isPersistenceReady, setIsPersistenceReady] = useState(false)
  const skipNextRemoteSyncRef = useRef(false)
  const remoteSyncTimeoutRef = useRef<number | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(null)
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm)
  const [functionForm, setFunctionForm] = useState(emptyFunctionForm)
  const [collaboratorForm, setCollaboratorForm] = useState(emptyCollaboratorForm)
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm)
  const [userForm, setUserForm] = useState(emptyUserForm)
  const [agreementForm, setAgreementForm] = useState(emptyAgreementForm)
  const [editingAgreementId, setEditingAgreementId] = useState<number | null>(null)
  const [scheduleFeedback, setScheduleFeedback] = useState<ValidationResult | null>(null)
  const [scheduleWarning, setScheduleWarning] = useState<{ title: string; messages: string[] } | null>(null)
  const [userWarning, setUserWarning] = useState<{ title: string; messages: string[] } | null>(null)
  const [editingFunctionId, setEditingFunctionId] = useState<number | null>(null)
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [isLoginPasswordVisible, setIsLoginPasswordVisible] = useState(false)
  const [isUserFormPasswordVisible, setIsUserFormPasswordVisible] = useState(false)
  const [visibleUserPasswords, setVisibleUserPasswords] = useState<Record<number, boolean>>({})
  const [scaleViewMode, setScaleViewMode] = useState<ScaleViewMode>('week')
  const [scaleAnchorDate, setScaleAnchorDate] = useState(toIsoDate(new Date()))
  const [scaleMonth, setScaleMonth] = useState(toIsoDate(new Date()).slice(0, 7))
  const [scaleSectorFilter, setScaleSectorFilter] = useState('Todos')
  const [selectedReportId, setSelectedReportId] = useState<ReportId>('scale-consolidated')
  const [reportStartDate, setReportStartDate] = useState(`${toIsoDate(new Date()).slice(0, 7)}-01`)
  const [reportEndDate, setReportEndDate] = useState(toIsoDate(new Date()))
  const [reportSectorFilter, setReportSectorFilter] = useState('Todos')
  const [reportVisibleColumnsByReport, setReportVisibleColumnsByReport] = useState<Partial<Record<ReportId, string[]>>>({})
  const [reportColumnFiltersByReport, setReportColumnFiltersByReport] = useState<
    Partial<Record<ReportId, Record<string, string[]>>>
  >({})
  const [openReportColumnMenu, setOpenReportColumnMenu] = useState<string | null>(null)
  const [printIncludeExtras, setPrintIncludeExtras] = useState(false)
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false)
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false)
  const [extraSearchByWeek, setExtraSearchByWeek] = useState<Record<string, string>>({})
  const [scaleWarning, setScaleWarning] = useState<{ title: string; messages: string[] } | null>(null)
  const [scaleCommentModal, setScaleCommentModal] = useState<{
    collaboratorId: number
    date: string
  } | null>(null)
  const [scaleCommentDraft, setScaleCommentDraft] = useState('')
  const [editingScaleCommentId, setEditingScaleCommentId] = useState<number | null>(null)
  const [editingScaleCommentDraft, setEditingScaleCommentDraft] = useState('')
  const [isFunctionModalOpen, setIsFunctionModalOpen] = useState(false)
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false)
  const [isCollaboratorModalOpen, setIsCollaboratorModalOpen] = useState(false)
  const [collaboratorModalSource, setCollaboratorModalSource] = useState<CollaboratorModalSource>('scale')
  const [functionSuggestion, setFunctionSuggestion] = useState('')
  const [userSectorInput, setUserSectorInput] = useState('')
  const [zipCodeFeedback, setZipCodeFeedback] = useState('')
  const [collaboratorLookupFeedback, setCollaboratorLookupFeedback] = useState('')
  const [companyAgreementFeedback, setCompanyAgreementFeedback] = useState('')

  const currentCompany =
    currentCompanyId === null ? null : companies.find((item) => item.id === currentCompanyId) ?? null
  const currentAgreement =
    currentCompany?.collectiveAgreementId === null || currentCompany?.collectiveAgreementId === undefined
      ? null
      : agreements.find((item) => item.id === currentCompany.collectiveAgreementId) ?? null
  const companyAgreementMatches = findCollectiveAgreementMatches(
    agreements,
    companyForm.state,
    companyForm.city,
  )
  const companyAgreementSuggestion =
    companyAgreementMatches.length === 1 ? companyAgreementMatches[0] : null
  const companyAgreementConflict = companyAgreementMatches.length > 1
  const selectedCompanyAgreement =
    companyForm.collectiveAgreementId === ''
      ? null
      : agreements.find((item) => item.id === Number(companyForm.collectiveAgreementId)) ?? null
  const sortedAgreementOptions = [...agreements].sort((left, right) => left.name.localeCompare(right.name))
  const compatibleAgreementIds = new Set(companyAgreementMatches.map((item) => item.id))
  const compatibleAgreementOptions = sortedAgreementOptions.filter((item) => compatibleAgreementIds.has(item.id))
  const otherAgreementOptions = sortedAgreementOptions.filter((item) => !compatibleAgreementIds.has(item.id))
  const companySectors = currentCompanyId === null ? [] : sectors.filter((item) => item.companyId === currentCompanyId)
  const companyFunctions = currentCompanyId === null ? [] : functions.filter((item) => item.companyId === currentCompanyId)
  const companyCollaborators =
    currentCompanyId === null ? [] : collaborators.filter((item) => item.companyId === currentCompanyId)
  const companySchedules = currentCompanyId === null ? [] : schedules.filter((item) => item.companyId === currentCompanyId)
  const companyScaleAssignments =
    currentCompanyId === null ? [] : scaleAssignments.filter((item) => item.companyId === currentCompanyId)
  const companyScaleComments =
    currentCompanyId === null ? [] : scaleComments.filter((item) => item.companyId === currentCompanyId)
  const companyScaleExtraRoster =
    currentCompanyId === null ? [] : scaleExtraRoster.filter((item) => item.companyId === currentCompanyId)
  const companyUsers = currentCompanyId === null ? [] : users.filter((item) => item.companyId === currentCompanyId)
  const currentCollaboratorProfile =
    collaboratorProfiles.find(
      (item) => item.cpf.replace(/\D/g, '') === collaboratorForm.cpf.replace(/\D/g, ''),
    ) ?? null
  const availableFunctionNames = Array.from(
    new Set([
      ...companyFunctions.filter((item) => item.isActive).map((item) => item.name),
      ...(currentCollaboratorProfile?.knownFunctions ?? []),
      ...collaboratorForm.functions,
    ]),
  )
  const availableSectorNames = Array.from(new Set(companySectors.map((item) => item.name))).sort((left, right) =>
    left.localeCompare(right),
  )
  const activeFunctionLimit = collaboratorForm.employmentType === 'EXTRA' ? 6 : 1
  const selectedFunctions = collaboratorForm.functions
  const currentCompanyCollaborator =
    currentCompanyId === null
      ? null
      : collaborators.find(
          (item) =>
            item.companyId === currentCompanyId &&
            item.cpf.replace(/\D/g, '') === collaboratorForm.cpf.replace(/\D/g, ''),
        ) ?? null
  const isSystemAdmin = session?.kind === 'systemAdmin'
  const isViewer = session?.kind === 'companyUser' && session.user.role === 'Visualizador'
  const currentSessionKey =
    session === null
      ? null
      : session.kind === 'systemAdmin'
        ? `system:${session.user.id}`
        : `company:${session.user.id}`
  const currentViewerCollaboratorId =
    session?.kind === 'companyUser' && session.user.role === 'Visualizador'
      ? session.user.linkedCollaboratorId
      : null
  const currentViewerCollaborator =
    currentViewerCollaboratorId === null
      ? null
      : companyCollaborators.find((item) => item.id === currentViewerCollaboratorId) ?? null
  const sessionSectorAccess =
    session?.kind === 'systemAdmin' || session?.user.role === 'Administrativo'
      ? availableSectorNames
      : session?.kind === 'companyUser'
        ? session.user.sectors
        : []
  const canManageData = !!currentCompany && !isViewer
  const canViewScale = !!currentCompany
  const canEditScale =
    !!currentCompany &&
    (session?.kind === 'systemAdmin' || (session?.kind === 'companyUser' && session.user.role !== 'Visualizador'))
  const todayIso = toIsoDate(new Date())
  const visibleScaleSectorOptions =
    session?.kind === 'companyUser' ? session.user.sectors : availableSectorNames
  const effectiveScaleSectorFilter =
    scaleSectorFilter === 'Todos' || !visibleScaleSectorOptions.includes(scaleSectorFilter)
      ? 'Todos'
      : scaleSectorFilter
  const visibleAppSections: AppSection[] = isViewer ? ['Escala'] : [...appSections]
  const canManageCollaboratorActivation =
    session?.kind === 'systemAdmin' ||
    session?.user.role === 'Administrativo' ||
    session?.user.role === 'Gestor'
  const currentSessionActor =
    session === null
      ? null
      : {
          name: session.user.fullName,
          role: session.kind === 'systemAdmin' ? 'Master' : session.user.role,
        }
  const scaleNotificationItems =
    currentSessionKey === null
      ? []
      : companyScaleComments
          .flatMap((thread) => {
            const collaborator = companyCollaborators.find((item) => item.id === thread.collaboratorId) ?? null
            return thread.messages
              .filter(
                (message) =>
                  message.recipientKeys.includes(currentSessionKey) &&
                  !message.readByKeys.includes(currentSessionKey),
              )
              .map((message) => ({
                threadId: thread.id,
                collaboratorId: thread.collaboratorId,
                collaboratorName: collaborator
                  ? getCollaboratorProfile(collaborator.cpf)?.fullName ?? collaborator.cpf
                  : 'Colaborador',
                date: thread.date,
                messageId: message.id,
                authorName: message.authorName,
                authorRole: message.authorRole,
                body: message.body,
                createdAt: message.createdAt,
              }))
          })
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
  const dashboardMetrics = [
    { label: 'Colaboradores ativos', value: companyCollaborators.filter((item) => item.isActive).length },
    { label: 'Funcoes cadastradas', value: companyFunctions.length },
    { label: 'Horarios validados', value: companySchedules.length },
    { label: 'Usuarios da empresa', value: companyUsers.length },
  ]
  const activeScaleCommentThread =
    scaleCommentModal === null
      ? null
      : getScaleCommentThread(scaleCommentModal.collaboratorId, scaleCommentModal.date)
  const activeScaleCommentCollaborator =
    scaleCommentModal === null
      ? null
      : companyCollaborators.find((item) => item.id === scaleCommentModal.collaboratorId) ?? null
  const companyAgreementField = (
    <>
      <div className="field-span agreement-panel">
        <strong>Convencao coletiva sugerida</strong>
        {companyAgreementSuggestion ? (
          <>
            <span>
              {companyAgreementSuggestion.name} • {companyAgreementSuggestion.validFrom} a {companyAgreementSuggestion.validTo}
            </span>
            <span>
              Base: {companyAgreementSuggestion.coveredCity}/{companyAgreementSuggestion.coveredState} •{' '}
              {companyAgreementSuggestion.employeeUnion} x {companyAgreementSuggestion.employerUnion}
            </span>
          </>
        ) : companyAgreementConflict ? (
          <span>Mais de uma CCT corresponde a esta cidade/UF. Escolha manualmente a convenção aplicável.</span>
        ) : (
          <span>Nenhuma CCT cadastrada cobre esta cidade/UF.</span>
        )}
        {selectedCompanyAgreement && selectedCompanyAgreement.id !== companyAgreementSuggestion?.id ? (
          <>
            <span>
              CCT selecionada manualmente: {selectedCompanyAgreement.name} • {selectedCompanyAgreement.validFrom} a{' '}
              {selectedCompanyAgreement.validTo}
            </span>
            <span>
              Base: {selectedCompanyAgreement.coveredCity}/{selectedCompanyAgreement.coveredState} •{' '}
              {selectedCompanyAgreement.employeeUnion} x {selectedCompanyAgreement.employerUnion}
            </span>
            <a href={selectedCompanyAgreement.sourceUrl} target="_blank" rel="noreferrer">
              {selectedCompanyAgreement.sourceLabel}
            </a>
          </>
        ) : null}
        {companyAgreementFeedback ? <span>{companyAgreementFeedback}</span> : null}
        {!companyAgreementSuggestion && !companyAgreementConflict && session ? (
          <button type="button" className="secondary-button" onClick={startAgreementFromCompanyContext}>
            Cadastrar convencao para esta base
          </button>
        ) : null}
      </div>
      <label className="field-span">
        CCT vinculada a empresa
        <select
          value={companyForm.collectiveAgreementId}
          onChange={(event) => {
            setCompanyAgreementFeedback('')
            setCompanyForm({ ...companyForm, collectiveAgreementId: event.target.value })
          }}
        >
          <option value="">
            {companyAgreementConflict ? 'Selecione a convenção correta' : 'Usar sugestão automática ou nenhuma'}
          </option>
          {compatibleAgreementOptions.length > 0 ? (
            <optgroup label="Compatíveis com a base da empresa">
              {compatibleAgreementOptions.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.name} • {agreement.coveredCity}/{agreement.coveredState}
                </option>
              ))}
            </optgroup>
          ) : null}
          {otherAgreementOptions.length > 0 ? (
            <optgroup label="Outras convenções cadastradas">
              {otherAgreementOptions.map((agreement) => (
                <option key={agreement.id} value={agreement.id}>
                  {agreement.name} • {agreement.coveredCity}/{agreement.coveredState}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </label>
    </>
  )
  const scaleWeeks = buildScaleWeeks()
  const scaleSectorOptions = ['Todos', ...visibleScaleSectorOptions]
  const visibleScaleCollaborators = companyCollaborators.filter((item) => {
    if (isViewer && currentViewerCollaboratorId !== item.id) {
      return false
    }

    const sectorName = getCollaboratorSector(item)
    if (effectiveScaleSectorFilter !== 'Todos' && sectorName !== effectiveScaleSectorFilter) {
      return false
    }

    return visibleScaleSectorOptions.length === 0 || visibleScaleSectorOptions.includes(sectorName)
  })
  const visibleScaleExtras = visibleScaleCollaborators.filter((item) => item.employmentType === 'EXTRA')
  const scaleSchedulesForSelect = companySchedules
    .sort((left, right) => left.shiftName.localeCompare(right.shiftName))
  const scheduleRules = currentAgreement
    ? [
        `CCT ativa: ${currentAgreement.name}. Vigencia de ${currentAgreement.validFrom} a ${currentAgreement.validTo}.`,
        `Jornadas entre 4h e 6h exigem no minimo ${currentAgreement.rules.shortShiftBreakMinutes} minutos de intervalo.`,
        currentCompany?.collectiveProfile === 'regramento-especifico'
          ? `Perfil da empresa: regramento especifico. Intervalo acima de 6h deve ficar entre ${currentAgreement.rules.specialBreakMinMinutes} e ${currentAgreement.rules.specialBreakMaxMinutes} minutos.`
          : currentCompany?.collectiveProfile === 'plano-saude'
            ? `Perfil da empresa: plano de saude. Intervalo acima de 6h exige no minimo ${currentAgreement.rules.standardMealBreakAfterSixHoursMinutes} minutos e pode ir ate ${currentAgreement.rules.healthPlanBreakMaxMinutes} minutos.`
            : `Perfil da empresa: padrao. Intervalo acima de 6h exige no minimo ${currentAgreement.rules.standardMealBreakAfterSixHoursMinutes} minutos e no maximo ${currentAgreement.rules.standardBreakMaxMinutes} minutos.`,
        `Banco de horas: limite diario parametrizado de ${Math.floor(currentAgreement.rules.bankHoursMaxDailyMinutes / 60)} horas.`,
        `Escala de folgas: antecedencia minima de ${currentAgreement.rules.rotatingDayOffNoticeDays} dias.`,
        currentAgreement.rules.allowTwelveByThirtySix
          ? 'A CCT admite jornada 12x36 para empresa habilitada.'
          : 'A CCT cadastrada nao admite 12x36.',
      ]
    : [
        'CLT: jornadas entre 4h e 6h exigem no minimo 15 minutos de intervalo.',
        'CLT: jornadas acima de 6h exigem no minimo 60 minutos de intervalo.',
        'Cadastre ou vincule uma CCT para liberar a validacao final do horario.',
      ]
  const liveSchedulePreview = buildSchedulePreview(scheduleForm)
  const liveWorkedMinutes = computeScheduleNetMinutes(scheduleForm)
  const activeReportDataset = getActiveReportDataset()
  const activeVisibleReportColumnKeys =
    reportVisibleColumnsByReport[selectedReportId] ?? activeReportDataset.columns.map((column) => column.key)
  const visibleReportColumns = activeReportDataset.columns.filter((column) =>
    activeVisibleReportColumnKeys.includes(column.key),
  )
  const hiddenReportColumns = activeReportDataset.columns.filter(
    (column) => !activeVisibleReportColumnKeys.includes(column.key),
  )
  const activeReportColumnFilters = reportColumnFiltersByReport[selectedReportId] ?? {}
  const reportColumnDistinctValues = Object.fromEntries(
    activeReportDataset.columns.map((column) => [
      column.key,
      Array.from(new Set(activeReportDataset.rows.map((row) => String(row[column.key] ?? '')))).sort((left, right) =>
        left.localeCompare(right),
      ),
    ]),
  ) as Record<string, string[]>
  const filteredReportRows = activeReportDataset.rows.filter((row) => {
    return activeReportDataset.columns.every((column) => {
      const selectedValues = activeReportColumnFilters[column.key] ?? []
      if (selectedValues.length === 0) {
        return true
      }

      return selectedValues.includes(String(row[column.key] ?? ''))
    })
  })
  const reportPreviewRows = filteredReportRows.slice(0, 24)
  const reportSectorOptions = ['Todos', ...availableSectorNames]
  const workloadBySectorChart = Array.from(
    getAssignmentsInReportRange().reduce((accumulator, assignment) => {
      const collaborator = companyCollaborators.find((item) => item.id === assignment.collaboratorId) ?? null
      const schedule = getScheduleById(assignment.scheduleId)
      if (!collaborator || !schedule || !matchesReportSector(collaborator)) {
        return accumulator
      }

      const sectorName = getReportSectorName(collaborator)
      accumulator.set(sectorName, (accumulator.get(sectorName) ?? 0) + schedule.netMinutes)
      return accumulator
    }, new Map<string, number>()),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value, displayValue: formatWorkedHours(value) }))
  const extrasBySectorChart = Array.from(
    getAssignmentsInReportRange().reduce((accumulator, assignment) => {
      const collaborator = companyCollaborators.find((item) => item.id === assignment.collaboratorId) ?? null
      if (!collaborator || collaborator.employmentType !== 'EXTRA' || !matchesReportSector(collaborator)) {
        return accumulator
      }

      const sectorName = getReportSectorName(collaborator)
      const cost = parseCurrencyValue(getFunctionByName(collaborator.primaryFunction)?.extraPayValue ?? '')
      accumulator.set(sectorName, (accumulator.get(sectorName) ?? 0) + cost)
      return accumulator
    }, new Map<string, number>()),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([label, value]) => ({ label, value, displayValue: formatCurrency(value) }))
  const usersByProfileChart = Array.from(
    companyUsers.reduce((accumulator, user) => {
      accumulator.set(user.role, (accumulator.get(user.role) ?? 0) + 1)
      return accumulator
    }, new Map<string, number>()),
  )
    .sort((left, right) => right[1] - left[1])
    .map(([label, value]) => ({ label, value, displayValue: String(value) }))

  function resetForms() {
    setFunctionForm(emptyFunctionForm)
    setCollaboratorForm(emptyCollaboratorForm)
    setScheduleForm(emptyScheduleForm)
    setUserForm(emptyUserForm)
    setAgreementForm(emptyAgreementForm)
    setEditingAgreementId(null)
    setScheduleFeedback(null)
    setEditingFunctionId(null)
    setEditingScheduleId(null)
    setEditingUserId(null)
    setFunctionSuggestion('')
    setUserSectorInput('')
    setCollaboratorLookupFeedback('')
  }

  function toggleReportColumnVisibility(columnKey: string) {
    setReportVisibleColumnsByReport((current) => {
      const currentKeys = current[selectedReportId] ?? activeReportDataset.columns.map((column) => column.key)
      const hasColumn = currentKeys.includes(columnKey)
      if (hasColumn && currentKeys.length === 1) {
        return current
      }

      const nextKeys = hasColumn
        ? currentKeys.filter((key) => key !== columnKey)
        : [...currentKeys, columnKey]

      return {
        ...current,
        [selectedReportId]: activeReportDataset.columns
          .map((column) => column.key)
          .filter((key) => nextKeys.includes(key)),
      }
    })
  }

  function showReportColumn(columnKey: string) {
    setReportVisibleColumnsByReport((current) => {
      const baseKeys = current[selectedReportId] ?? activeReportDataset.columns.map((column) => column.key)
      if (baseKeys.includes(columnKey)) {
        return current
      }

      const nextKeys = activeReportDataset.columns
        .map((column) => column.key)
        .filter((key) => key === columnKey || baseKeys.includes(key))

      return {
        ...current,
        [selectedReportId]: nextKeys,
      }
    })
  }

  function toggleReportColumnFilterValue(columnKey: string, value: string) {
    setReportColumnFiltersByReport((current) => {
      const currentReportFilters = current[selectedReportId] ?? {}
      const currentValues = currentReportFilters[columnKey] ?? []
      const nextValues = currentValues.includes(value)
        ? currentValues.filter((item) => item !== value)
        : [...currentValues, value]

      return {
        ...current,
        [selectedReportId]: {
          ...currentReportFilters,
          [columnKey]: nextValues,
        },
      }
    })
  }

  function clearReportColumnFilter(columnKey: string) {
    setReportColumnFiltersByReport((current) => {
      const currentReportFilters = current[selectedReportId] ?? {}
      return {
        ...current,
        [selectedReportId]: {
          ...currentReportFilters,
          [columnKey]: [],
        },
      }
    })
  }

  function resetReportTablePreferences() {
    setReportVisibleColumnsByReport((current) => ({
      ...current,
      [selectedReportId]: activeReportDataset.columns.map((column) => column.key),
    }))
    setReportColumnFiltersByReport((current) => ({
      ...current,
      [selectedReportId]: {},
    }))
    setOpenReportColumnMenu(null)
  }

  async function exportReportToXlsx() {
    if (!currentCompany) {
      return
    }

    const XLSX = await import('xlsx')

    const aoa: Array<Array<string | number>> = [
      [activeReportDataset.title],
      [`Empresa: ${currentCompany.tradeName}`],
      [`Periodo: ${formatMonthDateLabel(reportStartDate)} a ${formatMonthDateLabel(reportEndDate)}`],
      [],
      ['Resumo'],
      ...activeReportDataset.summary.map((item) => [item.label, item.value]),
      ['Linhas filtradas', String(filteredReportRows.length)],
      [],
      visibleReportColumns.map((column) => column.label),
      ...filteredReportRows.map((row) =>
        visibleReportColumns.map((column) => row[column.key] ?? ''),
      ),
    ]

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Relatorio')
    XLSX.writeFile(
      workbook,
      `relatorio-${slugifyFilePart(currentCompany.tradeName)}-${activeReportDataset.filenameSuffix}.xlsx`,
    )
  }

  function openReportPrintView(mode: 'print' | 'pdf') {
    if (!currentCompany || typeof window === 'undefined') {
      return
    }

    const reportWindow = window.open('', '_blank', 'width=1280,height=900')
    if (!reportWindow) {
      return
    }

    const html = `<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(`relatorio-${currentCompany.tradeName}-${activeReportDataset.filenameSuffix}`)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #1f1713; }
            h1, h2 { margin: 0 0 8px; }
            p { margin: 0 0 8px; }
            .meta { margin-bottom: 18px; color: #5d514a; }
            .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
            .summary-card { border: 1px solid #d9c5b3; border-radius: 10px; padding: 12px; }
            .summary-card strong { display: block; margin-top: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12px; }
            th, td { border: 1px solid #d9c5b3; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f6e8d9; }
            .right { text-align: right; }
            .center { text-align: center; }
            @media print { body { margin: 12mm; } }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(activeReportDataset.title)}</h1>
          <p class="meta"><strong>Empresa:</strong> ${escapeHtml(currentCompany.tradeName)} | <strong>Periodo:</strong> ${escapeHtml(
            `${formatMonthDateLabel(reportStartDate)} a ${formatMonthDateLabel(reportEndDate)}`,
          )} | <strong>Destino:</strong> ${mode === 'pdf' ? 'Salvar como PDF' : 'Impressao'}</p>
          <section class="summary">
            ${activeReportDataset.summary
              .map(
                (item) =>
                  `<div class="summary-card"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(
                    item.value,
                  )}</strong></div>`,
              )
              .join('')}
          </section>
          <table>
            <thead>
              <tr>
                ${visibleReportColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${filteredReportRows
                .map(
                  (row) =>
                    `<tr>${visibleReportColumns
                      .map((column) => {
                        const value = row[column.key] ?? ''
                        const className =
                          column.align === 'right' ? 'right' : column.align === 'center' ? 'center' : ''
                        return `<td class="${className}">${escapeHtml(String(value))}</td>`
                      })
                      .join('')}</tr>`,
                )
                .join('')}
            </tbody>
          </table>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>`

    reportWindow.document.open()
    reportWindow.document.write(html)
    reportWindow.document.close()
  }

  function ensureCompanySector(companyId: number, sectorName: string) {
    const trimmedSector = sectorName.trim()
    if (!trimmedSector) {
      return
    }

    setSectors((current) => {
      const alreadyExists = current.some(
        (item) =>
          item.companyId === companyId &&
          item.name.trim().toLowerCase() === trimmedSector.toLowerCase(),
      )

      if (alreadyExists) {
        return current
      }

      return [
        ...current,
        {
          id: current.reduce((max, item) => Math.max(max, item.id), 0) + 1,
          companyId,
          name: trimmedSector,
        },
      ]
    })
  }

  function resolveCompanySectorName(companyId: number, sectorName: string) {
    const trimmedSector = sectorName.trim()
    if (!trimmedSector) {
      return ''
    }

    const existingSector = sectors.find(
      (item) =>
        item.companyId === companyId &&
        item.name.trim().toLowerCase() === trimmedSector.toLowerCase(),
    )

    return existingSector?.name ?? trimmedSector
  }

  function toggleUserSector(sectorName: string) {
    setUserForm((current) => {
      const exists = current.sectors.includes(sectorName)
      return {
        ...current,
        sectors: exists
          ? current.sectors.filter((item) => item !== sectorName)
          : [...current.sectors, sectorName],
      }
    })
  }

  function addUserSector() {
    if (!currentCompanyId) {
      return
    }

    const trimmedSector = userSectorInput.trim()
    if (!trimmedSector) {
      return
    }

    const resolvedSector = resolveCompanySectorName(currentCompanyId, trimmedSector)
    ensureCompanySector(currentCompanyId, resolvedSector)
    setUserForm((current) => ({
      ...current,
      sectors: current.sectors.includes(resolvedSector)
        ? current.sectors
        : [...current.sectors, resolvedSector],
    }))
    setUserSectorInput('')
  }

  function getCollaboratorProfile(cpf: string) {
    return collaboratorProfiles.find((item) => item.cpf === cpf) ?? null
  }

  function getFunctionByName(functionName: string) {
    return companyFunctions.find((item) => item.name === functionName) ?? null
  }

  function getCollaboratorSector(collaborator: CollaboratorRecord) {
    return getFunctionByName(collaborator.primaryFunction)?.sector ?? ''
  }

  function isCollaboratorActiveOnDate(collaborator: CollaboratorRecord, date: string) {
    return !isInactiveOnDate(collaborator.inactivePeriods, date)
  }

  function isScheduleActiveOnDate(schedule: ScheduleRecord | null, date: string) {
    if (!schedule) {
      return false
    }

    return !isInactiveOnDate(schedule.inactivePeriods, date)
  }

  function getScaleCommentThread(collaboratorId: number, date: string) {
    return companyScaleComments.find(
      (item) => item.collaboratorId === collaboratorId && item.date === date,
    ) ?? null
  }

  function openScaleCommentModal(collaboratorId: number, date: string) {
    markScaleThreadAsRead(collaboratorId, date)
    setScaleCommentModal({ collaboratorId, date })
    setScaleCommentDraft('')
    setEditingScaleCommentId(null)
    setEditingScaleCommentDraft('')
  }

  function closeScaleCommentModal() {
    setScaleCommentModal(null)
    setScaleCommentDraft('')
    setEditingScaleCommentId(null)
    setEditingScaleCommentDraft('')
  }

  function getCommentRecipientKeys(collaboratorId: number) {
    if (!session || !currentCompanyId) {
      return []
    }

    if (session.kind === 'companyUser' && session.user.role === 'Visualizador') {
      const viewerSectors = new Set(session.user.sectors)
      const managerKeys = users
        .filter(
          (item) =>
            item.companyId === currentCompanyId &&
            item.isActive &&
            item.role === 'Gestor' &&
            item.sectors.some((sectorName) => viewerSectors.has(sectorName)),
        )
        .map((item) => `company:${item.id}`)
      const masterKeys = systemAdmins.map((item) => `system:${item.id}`)
      return Array.from(new Set([...managerKeys, ...masterKeys]))
    }

    return users
      .filter(
        (item) =>
          item.companyId === currentCompanyId &&
          item.isActive &&
          item.role === 'Visualizador' &&
          item.linkedCollaboratorId === collaboratorId,
      )
      .map((item) => `company:${item.id}`)
  }

  function markScaleThreadAsRead(collaboratorId: number, date: string) {
    if (!currentSessionKey) {
      return
    }

    setScaleComments((current) =>
      current.map((thread) => {
        if (
          thread.companyId !== currentCompanyId ||
          thread.collaboratorId !== collaboratorId ||
          thread.date !== date
        ) {
          return thread
        }

        return {
          ...thread,
          messages: thread.messages.map((message) =>
            message.recipientKeys.includes(currentSessionKey) && !message.readByKeys.includes(currentSessionKey)
              ? {
                  ...message,
                  readByKeys: [...message.readByKeys, currentSessionKey],
                }
              : message,
          ),
        }
      }),
    )
  }

  function openScaleNotification(collaboratorId: number, date: string) {
    setScaleViewMode('week')
    setScaleAnchorDate(date)
    setScaleMonth(date.slice(0, 7))
    setIsNotificationModalOpen(false)
    openScaleCommentModal(collaboratorId, date)
  }

  function canManageScaleCommentMessage(message: ScaleCommentMessage) {
    if (!currentSessionActor || !currentSessionKey) {
      return false
    }

    return (
      message.authorKey === currentSessionKey ||
      (!message.authorKey &&
        message.authorName === currentSessionActor.name &&
        message.authorRole === currentSessionActor.role)
    )
  }

  function startScaleCommentEdit(message: ScaleCommentMessage) {
    if (!canManageScaleCommentMessage(message)) {
      return
    }

    setEditingScaleCommentId(message.id)
    setEditingScaleCommentDraft(message.body)
  }

  function cancelScaleCommentEdit() {
    setEditingScaleCommentId(null)
    setEditingScaleCommentDraft('')
  }

  function saveScaleCommentEdit() {
    if (!scaleCommentModal || editingScaleCommentId === null) {
      return
    }

    const trimmedBody = editingScaleCommentDraft.trim()
    if (!trimmedBody) {
      return
    }

    setScaleComments((current) =>
      current.map((thread) => {
        if (
          thread.companyId !== currentCompanyId ||
          thread.collaboratorId !== scaleCommentModal.collaboratorId ||
          thread.date !== scaleCommentModal.date
        ) {
          return thread
        }

        return {
          ...thread,
          messages: thread.messages.map((message) =>
            message.id === editingScaleCommentId && canManageScaleCommentMessage(message)
              ? {
                  ...message,
                  body: trimmedBody,
                }
              : message,
          ),
        }
      }),
    )

    cancelScaleCommentEdit()
  }

  function deleteScaleCommentMessage(messageId: number) {
    if (!scaleCommentModal) {
      return
    }

    setScaleComments((current) =>
      current.flatMap((thread) => {
        if (
          thread.companyId !== currentCompanyId ||
          thread.collaboratorId !== scaleCommentModal.collaboratorId ||
          thread.date !== scaleCommentModal.date
        ) {
          return [thread]
        }

        const nextMessages = thread.messages.filter(
          (message) => !(message.id === messageId && canManageScaleCommentMessage(message)),
        )

        return nextMessages.length > 0 ? [{ ...thread, messages: nextMessages }] : []
      }),
    )

    if (editingScaleCommentId === messageId) {
      cancelScaleCommentEdit()
    }
  }

  function submitScaleComment() {
    if (!currentCompanyId || !currentSessionActor || !scaleCommentModal) {
      return
    }

    const trimmedBody = scaleCommentDraft.trim()
    if (!trimmedBody) {
      return
    }

    const nextMessage: ScaleCommentMessage = {
      id: Date.now(),
      authorName: currentSessionActor.name,
      authorRole: currentSessionActor.role,
      authorKey: currentSessionKey ?? undefined,
      body: trimmedBody,
      createdAt: new Date().toISOString(),
      recipientKeys: getCommentRecipientKeys(scaleCommentModal.collaboratorId),
      readByKeys: currentSessionKey ? [currentSessionKey] : [],
    }

    setScaleComments((current) => {
      const existingThread = current.find(
        (item) =>
          item.companyId === currentCompanyId &&
          item.collaboratorId === scaleCommentModal.collaboratorId &&
          item.date === scaleCommentModal.date,
      )

      if (existingThread) {
        return current.map((item) =>
          item.id === existingThread.id
            ? {
                ...item,
                messages: [...item.messages, nextMessage],
              }
            : item,
        )
      }

      return [
        ...current,
        {
          id: current.reduce((max, item) => Math.max(max, item.id), 0) + 1,
          companyId: currentCompanyId,
          collaboratorId: scaleCommentModal.collaboratorId,
          date: scaleCommentModal.date,
          messages: [nextMessage],
        },
      ]
    })

    setScaleCommentDraft('')
  }

  function getScaleSchedulesForDate(date: string, currentScheduleId?: number) {
    return scaleSchedulesForSelect.filter(
      (schedule) => isScheduleActiveOnDate(schedule, date) || schedule.id === currentScheduleId,
    )
  }

  function formatAffectedDates(dates: string[]) {
    return dates
      .slice(0, 6)
      .map((date) => formatDateLabel(date))
      .join(', ')
  }

  function confirmCollaboratorActivationChange(collaborator: CollaboratorRecord) {
    if (!collaborator.isActive || typeof window === 'undefined') {
      return true
    }

    const today = toIsoDate(new Date())
    const affectedScaleDates = companyScaleAssignments
      .filter((item) => item.collaboratorId === collaborator.id && item.date >= today)
      .map((item) => item.date)
      .sort()
    const affectedWeeks = companyScaleExtraRoster
      .filter((item) => item.collaboratorId === collaborator.id && item.weekStart >= today)
      .map((item) => item.weekStart)
      .sort()
    const messages = [
      `Inativar este colaborador o retira das novas escolhas na Escala a partir de ${formatDateLabel(today)}.`,
    ]

    if (affectedScaleDates.length > 0) {
      messages.push(
        `Escala afetada: existem turnos ja lancados em ${formatAffectedDates(affectedScaleDates)}${affectedScaleDates.length > 6 ? '...' : ''}.`,
      )
    }

    if (affectedWeeks.length > 0) {
      messages.push(
        `Escala afetada: ele tambem esta listado como EXTRA nas semanas de ${formatAffectedDates(affectedWeeks)}${affectedWeeks.length > 6 ? '...' : ''}.`,
      )
    }

    return window.confirm(messages.join('\n\n'))
  }

  function confirmScheduleActivationChange(schedule: ScheduleRecord) {
    if (!schedule.isActive || typeof window === 'undefined') {
      return true
    }

    const today = toIsoDate(new Date())
    const affectedScaleDates = companyScaleAssignments
      .filter((item) => item.scheduleId === schedule.id && item.date >= today)
      .map((item) => item.date)
      .sort()
    const messages = [
      `Inativar este horario o retira das novas escolhas na Escala a partir de ${formatDateLabel(today)}.`,
    ]

    if (affectedScaleDates.length > 0) {
      messages.push(
        `Escala afetada: este horario ja foi escolhido em ${formatAffectedDates(affectedScaleDates)}${affectedScaleDates.length > 6 ? '...' : ''}.`,
      )
    }

    return window.confirm(messages.join('\n\n'))
  }

  function confirmFunctionActivationChange(targetFunction: FunctionRecord) {
    if (!targetFunction.isActive || typeof window === 'undefined') {
      return true
    }

    const affectedCollaborators = companyCollaborators
      .filter((item) => item.functions.includes(targetFunction.name))
      .map((item) => getCollaboratorProfile(item.cpf)?.fullName ?? item.cpf)
      .sort((left, right) => left.localeCompare(right))
    const messages = [
      'Inativar esta funcao a retira das novas escolhas no cadastro de colaboradores.',
    ]

    if (affectedCollaborators.length > 0) {
      messages.push(
        `Cadastros afetados: ${affectedCollaborators.slice(0, 6).join(', ')}${affectedCollaborators.length > 6 ? '...' : ''}.`,
      )
    }

    return window.confirm(messages.join('\n\n'))
  }

  function getAssignmentForDay(collaboratorId: number, date: string) {
    return companyScaleAssignments.find(
      (item) => item.collaboratorId === collaboratorId && item.date === date,
    )
  }

  function getScheduleById(scheduleId: number) {
    return companySchedules.find((item) => item.id === scheduleId) ?? null
  }

  function isDateWithinReportRange(dateValue: string) {
    return dateValue >= reportStartDate && dateValue <= reportEndDate
  }

  function getReportSectorName(collaborator: CollaboratorRecord) {
    return getCollaboratorSector(collaborator) || 'Sem setor'
  }

  function getReportFunctionName(collaborator: CollaboratorRecord) {
    return collaborator.primaryFunction || 'Sem funcao'
  }

  function getReportCollaboratorName(collaborator: CollaboratorRecord) {
    return getCollaboratorProfile(collaborator.cpf)?.fullName ?? collaborator.cpf
  }

  function matchesReportSector(collaborator: CollaboratorRecord) {
    return reportSectorFilter === 'Todos' || getReportSectorName(collaborator) === reportSectorFilter
  }

  function getReportCollaborators() {
    return companyCollaborators.filter((item) => matchesReportSector(item))
  }

  function getAssignmentsInReportRange() {
    return companyScaleAssignments.filter((item) => isDateWithinReportRange(item.date))
  }

  function buildReportWeeks() {
    const weeks: Date[][] = []
    let cursor = getWeekDates(reportStartDate)[0]
    const rangeEnd = new Date(`${reportEndDate}T12:00:00`)

    while (cursor <= rangeEnd) {
      weeks.push(getWeekDates(cursor))
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 7, 12)
    }

    return weeks
  }

  function buildScaleConsolidatedReport(): ReportDataset {
    const rows: Array<Record<string, ReportRowValue>> = []

    getAssignmentsInReportRange().forEach((assignment) => {
      const collaborator = companyCollaborators.find((item) => item.id === assignment.collaboratorId) ?? null
      if (!collaborator || !matchesReportSector(collaborator)) {
        return
      }

      const schedule = getScheduleById(assignment.scheduleId)
      if (!schedule) {
        return
      }

      rows.push({
          data: formatMonthDateLabel(assignment.date),
          colaborador: getReportCollaboratorName(collaborator),
          setor: getReportSectorName(collaborator),
          funcao: getReportFunctionName(collaborator),
          vinculo: collaborator.employmentType,
          horario: schedule.shiftName,
          sigla: schedule.abbreviation,
          entrada: `${schedule.startTime} ${schedule.startPeriod}`,
          pausa: `${schedule.breakStart} ${schedule.breakStartPeriod}`,
          retorno: `${schedule.breakEnd} ${schedule.breakEndPeriod}`,
          saida: `${schedule.endTime} ${schedule.endPeriod}`,
          horas: formatWorkedHours(schedule.netMinutes),
          ativoNoDia: isCollaboratorActiveOnDate(collaborator, assignment.date) ? 'Sim' : 'Nao',
      })
    })

    rows.sort((left, right) =>
      `${left.data}-${left.colaborador}`.localeCompare(`${right.data}-${right.colaborador}`),
    )

    const totalMinutes = getAssignmentsInReportRange().reduce((sum, assignment) => {
      const collaborator = companyCollaborators.find((item) => item.id === assignment.collaboratorId) ?? null
      if (!collaborator || !matchesReportSector(collaborator)) {
        return sum
      }
      return sum + (getScheduleById(assignment.scheduleId)?.netMinutes ?? 0)
    }, 0)

    return {
      id: 'scale-consolidated',
      title: 'Escala consolidada',
      description: '',
      filenameSuffix: 'escala-consolidada',
      summary: [
        { label: 'Lancamentos', value: String(rows.length) },
        { label: 'Colaboradores', value: String(new Set(rows.map((item) => item.colaborador)).size) },
        { label: 'Horas previstas', value: formatWorkedHours(totalMinutes) },
      ],
      columns: [
        { key: 'data', label: 'Data' },
        { key: 'colaborador', label: 'Colaborador' },
        { key: 'setor', label: 'Setor' },
        { key: 'funcao', label: 'Funcao' },
        { key: 'vinculo', label: 'Vinculo' },
        { key: 'horario', label: 'Horario' },
        { key: 'sigla', label: 'Sigla' },
        { key: 'entrada', label: 'Entrada' },
        { key: 'pausa', label: 'Pausa' },
        { key: 'retorno', label: 'Retorno' },
        { key: 'saida', label: 'Saida' },
        { key: 'horas', label: 'Horas', align: 'right' },
        { key: 'ativoNoDia', label: 'Ativo no dia', align: 'center' },
      ],
      rows,
    }
  }

  function buildWorkloadByCollaboratorReport(): ReportDataset {
    const rows = getReportCollaborators()
      .map((collaborator) => {
        const assignments = getAssignmentsInReportRange().filter((item) => item.collaboratorId === collaborator.id)
        const totalMinutes = assignments.reduce((sum, item) => sum + (getScheduleById(item.scheduleId)?.netMinutes ?? 0), 0)
        const workedDays = assignments.length

        return {
          colaborador: getReportCollaboratorName(collaborator),
          setor: getReportSectorName(collaborator),
          funcao: getReportFunctionName(collaborator),
          vinculo: collaborator.employmentType,
          diasTrabalhados: workedDays,
          horasTotais: formatWorkedHours(totalMinutes),
          mediaDiaria: workedDays > 0 ? formatWorkedHours(Math.round(totalMinutes / workedDays)) : '00:00',
          status: collaborator.isActive ? 'Ativo' : 'Inativo',
          totalMinutesRaw: totalMinutes,
        }
      })
      .sort((left, right) =>
        Number(right.totalMinutesRaw) - Number(left.totalMinutesRaw) ||
        String(left.colaborador).localeCompare(String(right.colaborador)),
      )
      .map(({ totalMinutesRaw, ...row }) => row)

    const totalMinutes = getAssignmentsInReportRange().reduce((sum, assignment) => {
      const collaborator = companyCollaborators.find((item) => item.id === assignment.collaboratorId) ?? null
      if (!collaborator || !matchesReportSector(collaborator)) {
        return sum
      }
      return sum + (getScheduleById(assignment.scheduleId)?.netMinutes ?? 0)
    }, 0)

    return {
      id: 'workload-by-collaborator',
      title: 'Carga horaria por colaborador',
      description: 'Horas, dias trabalhados e media diaria por colaborador no periodo.',
      filenameSuffix: 'carga-horaria-colaborador',
      summary: [
        { label: 'Colaboradores', value: String(rows.length) },
        { label: 'Horas totais', value: formatWorkedHours(totalMinutes) },
        {
          label: 'Media por colaborador',
          value: rows.length > 0 ? formatWorkedHours(Math.round(totalMinutes / rows.length)) : '00:00',
        },
      ],
      columns: [
        { key: 'colaborador', label: 'Colaborador' },
        { key: 'setor', label: 'Setor' },
        { key: 'funcao', label: 'Funcao' },
        { key: 'vinculo', label: 'Vinculo' },
        { key: 'diasTrabalhados', label: 'Dias trabalhados', align: 'right' },
        { key: 'horasTotais', label: 'Horas totais', align: 'right' },
        { key: 'mediaDiaria', label: 'Media diaria', align: 'right' },
        { key: 'status', label: 'Status', align: 'center' },
      ],
      rows,
    }
  }

  function buildScaleIrregularitiesReport(): ReportDataset {
    const rows = buildReportWeeks()
      .flatMap((weekDates) =>
        getReportCollaborators().flatMap((collaborator) => {
          const rowValidation = validateScaleRow(collaborator, weekDates)
          if (rowValidation.issues.length === 0) {
            return []
          }

          const weekStart = toIsoDate(weekDates[0])
          const weekEnd = toIsoDate(weekDates[6])
          if (weekEnd < reportStartDate || weekStart > reportEndDate) {
            return []
          }

          return [
            {
              semana: `${formatMonthDateLabel(weekStart)} a ${formatMonthDateLabel(weekEnd)}`,
              colaborador: getReportCollaboratorName(collaborator),
              setor: getReportSectorName(collaborator),
              funcao: getReportFunctionName(collaborator),
              vinculo: collaborator.employmentType,
              horasSemana: formatWorkedHours(rowValidation.totalMinutes),
              irregularidades: rowValidation.issues.join(' | '),
              issuesCount: rowValidation.issues.length,
            },
          ]
        }),
      )
      .sort((left, right) =>
        Number(right.issuesCount) - Number(left.issuesCount) ||
        String(left.semana).localeCompare(String(right.semana)) ||
        String(left.colaborador).localeCompare(String(right.colaborador)),
      )
      .map(({ issuesCount, ...row }) => row)

    return {
      id: 'scale-irregularities',
      title: 'Irregularidades da escala',
      description: 'Alertas encontrados nas validacoes semanais da escala.',
      filenameSuffix: 'irregularidades-escala',
      summary: [
        { label: 'Ocorrencias', value: String(rows.length) },
        { label: 'Semanas analisadas', value: String(buildReportWeeks().length) },
      ],
      columns: [
        { key: 'semana', label: 'Semana' },
        { key: 'colaborador', label: 'Colaborador' },
        { key: 'setor', label: 'Setor' },
        { key: 'funcao', label: 'Funcao' },
        { key: 'vinculo', label: 'Vinculo' },
        { key: 'horasSemana', label: 'Horas semana', align: 'right' },
        { key: 'irregularidades', label: 'Irregularidades' },
      ],
      rows,
    }
  }

  function buildExtrasReport(): ReportDataset {
    const rows = getAssignmentsInReportRange()
      .flatMap((assignment) => {
        const collaborator = companyCollaborators.find((item) => item.id === assignment.collaboratorId) ?? null
        if (!collaborator || collaborator.employmentType !== 'EXTRA' || !matchesReportSector(collaborator)) {
          return []
        }

        const functionRecord = getFunctionByName(collaborator.primaryFunction)
        const extraCost = parseCurrencyValue(functionRecord?.extraPayValue ?? '')
        const schedule = getScheduleById(assignment.scheduleId)

        return [
          {
            data: formatMonthDateLabel(assignment.date),
            colaborador: getReportCollaboratorName(collaborator),
            setor: getReportSectorName(collaborator),
            funcao: getReportFunctionName(collaborator),
            horario: schedule?.shiftName ?? 'Sem horario',
            horas: formatWorkedHours(schedule?.netMinutes ?? 0),
            custo: formatCurrency(extraCost),
            custoRaw: extraCost,
          },
        ]
      })
      .sort((left, right) =>
        Number(right.custoRaw) - Number(left.custoRaw) ||
        String(left.data).localeCompare(String(right.data)) ||
        String(left.colaborador).localeCompare(String(right.colaborador)),
      )
      .map(({ custoRaw, ...row }) => row)

    const totalCost = rows.reduce((sum, item) => sum + parseCurrencyValue(String(item.custo)), 0)

    return {
      id: 'extras',
      title: 'Relatorio de extras',
      description: 'Lancamentos de colaboradores EXTRA e custo previsto no periodo.',
      filenameSuffix: 'relatorio-extras',
      summary: [
        { label: 'Lancamentos EXTRA', value: String(rows.length) },
        { label: 'Colaboradores EXTRA', value: String(new Set(rows.map((item) => item.colaborador)).size) },
        { label: 'Custo previsto', value: formatCurrency(totalCost) },
      ],
      columns: [
        { key: 'data', label: 'Data' },
        { key: 'colaborador', label: 'Colaborador' },
        { key: 'setor', label: 'Setor' },
        { key: 'funcao', label: 'Funcao' },
        { key: 'horario', label: 'Horario' },
        { key: 'horas', label: 'Horas', align: 'right' },
        { key: 'custo', label: 'Custo previsto', align: 'right' },
      ],
      rows,
    }
  }

  function buildAvailabilityReport(): ReportDataset {
    const collaboratorRows = companyCollaborators
      .filter((item) => matchesReportSector(item))
      .flatMap((collaborator) =>
        collaborator.inactivePeriods.map((period) => ({
          tipo: 'Colaborador',
          nome: getReportCollaboratorName(collaborator),
          setor: getReportSectorName(collaborator),
          referencia: getReportFunctionName(collaborator),
          inicio: formatMonthDateLabel(period.from),
          fim: period.to ? formatMonthDateLabel(period.to) : 'Em aberto',
          statusAtual: collaborator.isActive ? 'Ativo' : 'Inativo',
        })),
      )
    const functionRows = companyFunctions
      .filter((item) => reportSectorFilter === 'Todos' || item.sector === reportSectorFilter)
      .flatMap((item) =>
        item.inactivePeriods.map((period) => ({
          tipo: 'Funcao',
          nome: item.name,
          setor: item.sector || 'Sem setor',
          referencia: item.description || '-',
          inicio: formatMonthDateLabel(period.from),
          fim: period.to ? formatMonthDateLabel(period.to) : 'Em aberto',
          statusAtual: item.isActive ? 'Ativa' : 'Inativa',
        })),
      )
    const scheduleRows = companySchedules.flatMap((item) =>
      item.inactivePeriods.map((period) => ({
        tipo: 'Horario',
        nome: item.shiftName,
        setor: '-',
        referencia: item.abbreviation,
        inicio: formatMonthDateLabel(period.from),
        fim: period.to ? formatMonthDateLabel(period.to) : 'Em aberto',
        statusAtual: item.isActive ? 'Ativo' : 'Inativo',
      })),
    )
    const rows = [...collaboratorRows, ...functionRows, ...scheduleRows]
      .sort((left, right) =>
        String(left.tipo).localeCompare(String(right.tipo)) ||
        String(right.inicio).localeCompare(String(left.inicio)) ||
        String(left.nome).localeCompare(String(right.nome)),
      )

    return {
      id: 'availability',
      title: 'Disponibilidade e inativacoes',
      description: 'Historico de indisponibilidade de colaboradores, funcoes e horarios.',
      filenameSuffix: 'disponibilidade-inativacoes',
      summary: [
        { label: 'Colaboradores com historico', value: String(collaboratorRows.length) },
        { label: 'Funcoes com historico', value: String(functionRows.length) },
        { label: 'Horarios com historico', value: String(scheduleRows.length) },
      ],
      columns: [
        { key: 'tipo', label: 'Tipo' },
        { key: 'nome', label: 'Nome' },
        { key: 'setor', label: 'Setor' },
        { key: 'referencia', label: 'Referencia' },
        { key: 'inicio', label: 'Inicio' },
        { key: 'fim', label: 'Fim' },
        { key: 'statusAtual', label: 'Status atual', align: 'center' },
      ],
      rows,
    }
  }

  function buildCoverageReport(): ReportDataset {
    const grouped = new Map<
      string,
      {
        data: string
        setor: string
        funcao: string
        colaboradores: number
        horasTotais: number
      }
    >()

    getAssignmentsInReportRange().forEach((assignment) => {
      const collaborator = companyCollaborators.find((item) => item.id === assignment.collaboratorId) ?? null
      const schedule = getScheduleById(assignment.scheduleId)
      if (!collaborator || !schedule || !matchesReportSector(collaborator)) {
        return
      }

      const key = [assignment.date, getReportSectorName(collaborator), getReportFunctionName(collaborator)].join('|')
      const current = grouped.get(key) ?? {
        data: formatMonthDateLabel(assignment.date),
        setor: getReportSectorName(collaborator),
        funcao: getReportFunctionName(collaborator),
        colaboradores: 0,
        horasTotais: 0,
      }

      current.colaboradores = Number(current.colaboradores) + 1
      current.horasTotais = Number(current.horasTotais) + schedule.netMinutes
      grouped.set(key, current)
    })

    const rows: Array<Record<string, ReportRowValue>> = Array.from(grouped.values())
      .map((item) => ({
        ...item,
        horasTotaisRaw: item.horasTotais,
        horasTotais: formatWorkedHours(Number(item.horasTotais)),
      }))
      .sort((left, right) =>
        Number(right.horasTotaisRaw) - Number(left.horasTotaisRaw) ||
        `${left.data}-${left.setor}-${left.funcao}`.localeCompare(`${right.data}-${right.setor}-${right.funcao}`),
      )
      .map(({ horasTotaisRaw, ...row }) => row)

    return {
      id: 'coverage',
      title: 'Cobertura por setor e funcao',
      description: 'Quantidade de pessoas e horas previstas por data, setor e funcao.',
      filenameSuffix: 'cobertura-setor-funcao',
      summary: [
        { label: 'Linhas de cobertura', value: String(rows.length) },
        { label: 'Setores', value: String(new Set(rows.map((item) => item.setor)).size) },
        { label: 'Funcoes', value: String(new Set(rows.map((item) => item.funcao)).size) },
      ],
      columns: [
        { key: 'data', label: 'Data' },
        { key: 'setor', label: 'Setor' },
        { key: 'funcao', label: 'Funcao' },
        { key: 'colaboradores', label: 'Colaboradores', align: 'right' },
        { key: 'horasTotais', label: 'Horas totais', align: 'right' },
      ],
      rows,
    }
  }

  function buildHourExposureReport(): ReportDataset {
    const rows = buildReportWeeks().flatMap((weekDates) =>
      getReportCollaborators().map((collaborator) => {
        const weekAssignments = getWeeklyRowAssignments(
          collaborator,
          weekDates,
          companyScaleAssignments.filter((item) => isDateWithinReportRange(item.date)),
        )
        const workedEntries = weekAssignments.filter((item) => item.assignment && item.schedule)
        const totalMinutes = workedEntries.reduce((sum, item) => sum + item.workedMinutes, 0)
        const exposureMinutes = collaborator.employmentType === 'CLT' ? Math.max(totalMinutes - 44 * 60, 0) : 0

        return {
          semana: `${formatMonthDateLabel(toIsoDate(weekDates[0]))} a ${formatMonthDateLabel(toIsoDate(weekDates[6]))}`,
          colaborador: getReportCollaboratorName(collaborator),
          setor: getReportSectorName(collaborator),
          funcao: getReportFunctionName(collaborator),
          vinculo: collaborator.employmentType,
          horasSemana: formatWorkedHours(totalMinutes),
          excessoCLT: formatWorkedHours(exposureMinutes),
          diasEscalados: workedEntries.length,
          totalMinutesRaw: totalMinutes,
          exposureMinutesRaw: exposureMinutes,
        }
      }),
    )
    .sort((left, right) =>
      Number(right.exposureMinutesRaw) - Number(left.exposureMinutesRaw) ||
      Number(right.totalMinutesRaw) - Number(left.totalMinutesRaw) ||
      String(left.colaborador).localeCompare(String(right.colaborador)),
    )
    .map(({ totalMinutesRaw, exposureMinutesRaw, ...row }) => row)

    return {
      id: 'hour-exposure',
      title: 'Exposicao de jornada',
      description: 'Leitura semanal de horas escaladas e excesso potencial em CLT.',
      filenameSuffix: 'exposicao-jornada',
      summary: [
        { label: 'Linhas semanais', value: String(rows.length) },
        {
          label: 'Semanas com excesso CLT',
          value: String(rows.filter((item) => item.excessoCLT !== '00:00').length),
        },
      ],
      columns: [
        { key: 'semana', label: 'Semana' },
        { key: 'colaborador', label: 'Colaborador' },
        { key: 'setor', label: 'Setor' },
        { key: 'funcao', label: 'Funcao' },
        { key: 'vinculo', label: 'Vinculo' },
        { key: 'diasEscalados', label: 'Dias escalados', align: 'right' },
        { key: 'horasSemana', label: 'Horas semana', align: 'right' },
        { key: 'excessoCLT', label: 'Excesso CLT', align: 'right' },
      ],
      rows,
    }
  }

  function buildScheduleUsageReport(): ReportDataset {
    const grouped = new Map<
      string,
      {
        row: {
          horario: string
          sigla: string
          setor: string
          funcao: string
          usos: number
          colaboradores: number
          horasAlocadas: number
        }
        collaboratorIds: Set<number>
      }
    >()

    getAssignmentsInReportRange().forEach((assignment) => {
      const collaborator = companyCollaborators.find((item) => item.id === assignment.collaboratorId) ?? null
      const schedule = getScheduleById(assignment.scheduleId)
      if (!collaborator || !schedule || !matchesReportSector(collaborator)) {
        return
      }

      const key = [schedule.id, getReportSectorName(collaborator), getReportFunctionName(collaborator)].join('|')
      const current = grouped.get(key) ?? {
        row: {
          horario: schedule.shiftName,
          sigla: schedule.abbreviation,
          setor: getReportSectorName(collaborator),
          funcao: getReportFunctionName(collaborator),
          usos: 0,
          colaboradores: 0,
          horasAlocadas: 0,
        },
        collaboratorIds: new Set<number>(),
      }

      current.row.usos = Number(current.row.usos) + 1
      current.row.horasAlocadas = Number(current.row.horasAlocadas) + schedule.netMinutes
      current.collaboratorIds.add(collaborator.id)
      grouped.set(key, current)
    })

    const rows: Array<Record<string, ReportRowValue>> = Array.from(grouped.values())
      .map((entry) => ({
        ...entry.row,
        colaboradores: entry.collaboratorIds.size,
        horasAlocadasRaw: entry.row.horasAlocadas,
        horasAlocadas: formatWorkedHours(Number(entry.row.horasAlocadas)),
      }))
      .sort((left, right) =>
        Number(right.usos) - Number(left.usos) ||
        Number(right.horasAlocadasRaw) - Number(left.horasAlocadasRaw) ||
        `${left.horario}`.localeCompare(`${right.horario}`),
      )
      .map(({ horasAlocadasRaw, ...row }) => row)

    return {
      id: 'schedule-usage',
      title: 'Mapa de horarios utilizados',
      description: 'Uso dos turnos cadastrados por setor e funcao no periodo.',
      filenameSuffix: 'mapa-horarios-utilizados',
      summary: [
        { label: 'Horarios usados', value: String(rows.length) },
        { label: 'Setores', value: String(new Set(rows.map((item) => item.setor)).size) },
        { label: 'Funcoes', value: String(new Set(rows.map((item) => item.funcao)).size) },
      ],
      columns: [
        { key: 'horario', label: 'Horario' },
        { key: 'sigla', label: 'Sigla' },
        { key: 'setor', label: 'Setor' },
        { key: 'funcao', label: 'Funcao' },
        { key: 'usos', label: 'Usos', align: 'right' },
        { key: 'colaboradores', label: 'Colaboradores', align: 'right' },
        { key: 'horasAlocadas', label: 'Horas alocadas', align: 'right' },
      ],
      rows,
    }
  }

  function buildUserAccessReport(): ReportDataset {
    const rows = companyUsers
      .map((user) => {
        const linkedCollaborator =
          user.linkedCollaboratorId === null
            ? null
            : companyCollaborators.find((item) => item.id === user.linkedCollaboratorId) ?? null

        return {
          usuario: user.fullName,
          login: user.username,
          perfil: user.role,
          status: user.isActive ? 'Ativo' : 'Inativo',
          setores: user.sectors.join(', ') || '-',
          colaboradorVinculado:
            linkedCollaborator === null ? '-' : getReportCollaboratorName(linkedCollaborator),
          setorColaborador:
            linkedCollaborator === null ? '-' : getReportSectorName(linkedCollaborator),
          podeEditarEscala: user.role === 'Visualizador' ? 'Nao' : 'Sim',
        }
      })
      .sort((left, right) =>
        String(left.perfil).localeCompare(String(right.perfil)) ||
        String(left.usuario).localeCompare(String(right.usuario)),
      )

    return {
      id: 'user-access',
      title: 'Quadro de usuarios e acessos',
      description: 'Perfis, status, setores permitidos e vinculo entre visualizador e colaborador.',
      filenameSuffix: 'usuarios-acessos',
      summary: [
        { label: 'Usuarios', value: String(rows.length) },
        { label: 'Visualizadores', value: String(rows.filter((item) => item.perfil === 'Visualizador').length) },
        { label: 'Gestores', value: String(rows.filter((item) => item.perfil === 'Gestor').length) },
      ],
      columns: [
        { key: 'usuario', label: 'Usuario' },
        { key: 'login', label: 'Login' },
        { key: 'perfil', label: 'Perfil' },
        { key: 'status', label: 'Status' },
        { key: 'setores', label: 'Setores' },
        { key: 'colaboradorVinculado', label: 'Colaborador vinculado' },
        { key: 'setorColaborador', label: 'Setor do colaborador' },
        { key: 'podeEditarEscala', label: 'Pode editar escala', align: 'center' },
      ],
      rows,
    }
  }

  function getActiveReportDataset(): ReportDataset {
    switch (selectedReportId) {
      case 'workload-by-collaborator':
        return buildWorkloadByCollaboratorReport()
      case 'scale-irregularities':
        return buildScaleIrregularitiesReport()
      case 'extras':
        return buildExtrasReport()
      case 'availability':
        return buildAvailabilityReport()
      case 'coverage':
        return buildCoverageReport()
      case 'hour-exposure':
        return buildHourExposureReport()
      case 'schedule-usage':
        return buildScheduleUsageReport()
      case 'user-access':
        return buildUserAccessReport()
      case 'scale-consolidated':
      default:
        return buildScaleConsolidatedReport()
    }
  }

  function getWeeklyRowAssignments(
    collaborator: CollaboratorRecord,
    weekDates: Date[],
    assignmentSource = companyScaleAssignments,
  ) {
    return weekDates.map((date) => {
      const isoDate = toIsoDate(date)
      const assignment = assignmentSource.find(
        (item) => item.collaboratorId === collaborator.id && item.date === isoDate,
      )
      const schedule = assignment ? getScheduleById(assignment.scheduleId) : null
      return {
        date: isoDate,
        assignment,
        schedule,
        workedMinutes: schedule?.netMinutes ?? 0,
      }
    })
  }

  function collectMonthlySundayOffIssue(
    collaborator: CollaboratorRecord,
    referenceDate: string,
    assignmentSource = companyScaleAssignments,
  ) {
    if (collaborator.employmentType !== 'CLT') {
      return null
    }

    const [year, month] = referenceDate.slice(0, 7).split('-').map(Number)
    const monthDates = Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) =>
      toIsoDate(new Date(year, month - 1, index + 1, 12)),
    )
    const sundays = monthDates.filter((date) => new Date(`${date}T12:00:00`).getDay() === 0)
    const workedSundays = sundays.filter((date) =>
      assignmentSource.some(
        (item) => item.collaboratorId === collaborator.id && item.date === date,
      ),
    )

    return workedSundays.length === sundays.length && sundays.length > 0
      ? 'Colaborador CLT precisa ter pelo menos um domingo de folga no mes.'
      : null
  }

  function validateScaleRow(collaborator: CollaboratorRecord, weekDates: Date[], assignmentSource = companyScaleAssignments) {
    const issues: string[] = []
    const rowAssignments = getWeeklyRowAssignments(collaborator, weekDates, assignmentSource)
    const workedEntries = rowAssignments.filter((item) => item.assignment && item.schedule)
    const totalMinutes = workedEntries.reduce((sum, item) => sum + item.workedMinutes, 0)

    if (collaborator.employmentType === 'EXTRA' && workedEntries.length > 3) {
      issues.push('Colaborador EXTRA nao pode trabalhar mais de 3 dias na mesma semana.')
    }

    if (collaborator.employmentType === 'CLT' && totalMinutes > 44 * 60) {
      issues.push('Colaborador CLT nao pode ultrapassar 44 horas semanais.')
    }

    workedEntries.forEach((entry) => {
      if (currentAgreement && entry.workedMinutes > currentAgreement.rules.maxDailyMinutes) {
        issues.push('A jornada escolhida ultrapassa o limite diario parametrizado para a empresa.')
      }
    })

    const workedDates = rowAssignments.map((item) => !!item.assignment)
    let consecutiveWorkedDays = 0
    workedDates.forEach((worked) => {
      consecutiveWorkedDays = worked ? consecutiveWorkedDays + 1 : 0
      if (consecutiveWorkedDays > 6) {
        issues.push('Colaborador nao pode trabalhar por 7 dias consecutivos sem descanso.')
      }
    })

    for (let index = 0; index < workedEntries.length - 1; index += 1) {
      const currentEntry = workedEntries[index]
      const nextEntry = workedEntries[index + 1]
      const currentEnd = parseTime(
        currentEntry.schedule?.endTime ?? '',
        currentEntry.schedule?.endPeriod ?? 'AM',
      )
      const nextStart = parseTime(
        nextEntry.schedule?.startTime ?? '',
        nextEntry.schedule?.startPeriod ?? 'AM',
      )

      if (currentEnd === null || nextStart === null) {
        continue
      }

      const currentEndAbsolute = new Date(`${currentEntry.date}T00:00:00`).getTime() + currentEnd * 60_000
      const nextStartAbsolute =
        new Date(`${nextEntry.date}T00:00:00`).getTime() + nextStart * 60_000
      const restMinutes = Math.round((nextStartAbsolute - currentEndAbsolute) / 60_000)

      if (restMinutes < 11 * 60) {
        issues.push('O descanso entre o fim de um turno e o inicio do seguinte nao pode ser menor que 11 horas.')
      }
    }

    const sundayIssue = collectMonthlySundayOffIssue(
      collaborator,
      weekDates[0].toISOString().slice(0, 10),
      assignmentSource,
    )
    if (sundayIssue) {
      issues.push(sundayIssue)
    }

    return {
      issues: Array.from(new Set(issues)),
      totalMinutes,
    }
  }

  function buildScaleWeeks() {
    if (scaleViewMode === 'week') {
      return [getWeekDates(scaleAnchorDate)]
    }

    return getMonthWeeks(scaleMonth)
  }

  function addExtraToWeek(weekStartValue: string, collaboratorId: number) {
    if (!currentCompanyId) {
      return
    }

    const alreadyExists = companyScaleExtraRoster.some(
      (item) => item.weekStart === weekStartValue && item.collaboratorId === collaboratorId,
    )

    if (alreadyExists) {
      return
    }

    setScaleExtraRoster((current) => [
      {
        id: current.reduce((max, item) => Math.max(max, item.id), 0) + 1,
        companyId: currentCompanyId,
        collaboratorId,
        weekStart: weekStartValue,
      },
      ...current,
    ])
    setExtraSearchByWeek((current) => ({ ...current, [weekStartValue]: '' }))
  }

  function removeExtraFromWeek(weekStartValue: string, collaboratorId: number) {
    setScaleExtraRoster((current) =>
      current.filter(
        (item) => !(item.weekStart === weekStartValue && item.collaboratorId === collaboratorId),
      ),
    )
    setScaleAssignments((current) =>
      current.filter((item) => {
        if (item.collaboratorId !== collaboratorId) {
          return true
        }

        const itemWeekStart = toIsoDate(startOfWeek(item.date))
        return itemWeekStart !== weekStartValue
      }),
    )
  }

  function updateScaleAssignment(
    collaborator: CollaboratorRecord,
    date: string,
    scheduleIdValue: string,
    weekDates: Date[],
  ) {
    if (!currentCompanyId || !canEditScale) {
      return
    }

    const numericScheduleId = Number(scheduleIdValue)
    const nextAssignments = companyScaleAssignments.filter(
      (item) => !(item.collaboratorId === collaborator.id && item.date === date),
    )

    if (!Number.isNaN(numericScheduleId) && numericScheduleId > 0) {
      nextAssignments.push({
        id: scaleAssignments.reduce((max, item) => Math.max(max, item.id), 0) + 1,
        companyId: currentCompanyId,
        collaboratorId: collaborator.id,
        date,
        scheduleId: numericScheduleId,
      })
    }

    const validation = validateScaleRow(collaborator, weekDates, nextAssignments)
    if (validation.issues.length > 0) {
      setScaleWarning({
        title: `Irregularidade detectada para ${getCollaboratorProfile(collaborator.cpf)?.fullName ?? collaborator.cpf}`,
        messages: validation.issues,
      })
    }

    setScaleAssignments((current) => {
      const withoutCurrentDay = current.filter(
        (item) => !(item.collaboratorId === collaborator.id && item.date === date),
      )

      if (Number.isNaN(numericScheduleId) || numericScheduleId <= 0) {
        return withoutCurrentDay
      }

      return [
        ...withoutCurrentDay,
        {
          id: current.reduce((max, item) => Math.max(max, item.id), 0) + 1,
          companyId: currentCompanyId,
          collaboratorId: collaborator.id,
          date,
          scheduleId: numericScheduleId,
        },
      ]
    })
  }

  function handleScalePrint() {
    if (typeof window === 'undefined') {
      return
    }

    const originalTitle = document.title
    const companyName = slugifyFilePart(currentCompany?.tradeName ?? 'empresa')
    const referencePeriod =
      scaleViewMode === 'month'
        ? scaleMonth
        : `${toIsoDate(scaleWeeks[0]?.[0] ?? new Date())}_a_${toIsoDate(scaleWeeks[0]?.[6] ?? new Date())}`

    document.title = `escala-${companyName}-${referencePeriod}`
    window.print()
    window.setTimeout(() => {
      document.title = originalTitle
    }, 0)
  }

  function populateCompanyForm(company: CompanyRecord) {
    setCompanyForm({
      tradeName: company.tradeName,
      legalName: company.legalName,
      cnpj: company.cnpj,
      zipCode: company.zipCode,
      street: company.street,
      number: company.number,
      complement: company.complement,
      district: company.district,
      city: company.city,
      state: company.state,
      collectiveAgreementId: company.collectiveAgreementId ? String(company.collectiveAgreementId) : '',
    })
  }

  function switchCompany(companyId: number) {
    const targetCompany = companies.find((item) => item.id === companyId)
    if (!targetCompany) {
      return
    }

    setCurrentCompanyId(companyId)
    populateCompanyForm(targetCompany)
    resetForms()
    setActiveSection('Painel')
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const systemAdmin = systemAdmins.find(
      (item) => item.username === loginForm.username.trim() && item.password === loginForm.password,
    )

    if (systemAdmin) {
      setSession({ kind: 'systemAdmin', user: systemAdmin })
      setLoginError('')
      if (companies.length > 0) {
        setCurrentCompanyId(null)
        setIsCompanyModalOpen(false)
      }
      return
    }

    const companyUser = users.find(
      (item) =>
        item.username === loginForm.username.trim() &&
        item.password === loginForm.password &&
        item.isActive,
    )

    if (!companyUser) {
      setLoginError('Usuario ou senha invalidos.')
      return
    }

    const targetCompany = companies.find((item) => item.id === companyUser.companyId)
    if (!targetCompany) {
      setLoginError('A empresa vinculada a este usuario nao esta disponivel.')
      return
    }

    if (targetCompany.status === 'INATIVA') {
      setLoginError('A empresa vinculada a este usuario esta inativa.')
      return
    }

    setSession({ kind: 'companyUser', user: companyUser })
    setCurrentCompanyId(companyUser.companyId)
    populateCompanyForm(targetCompany)
    setLoginError('')
  }

  function logout() {
    setSession(null)
    setCurrentCompanyId(null)
    setLoginForm({ username: '', password: '' })
    setLoginError('')
    setIsCompanyModalOpen(false)
  }

  function startAgreementFromCompanyContext() {
    setAgreementForm((current) => ({
      ...current,
      coveredState: companyForm.state,
      coveredCity: companyForm.city,
    }))
    setEditingAgreementId(null)
    setActiveSection('Convencoes')
    setIsCompanyModalOpen(false)
  }

  function submitCompany(event: FormEvent<HTMLFormElement>, mode: 'create' | 'update') {
    event.preventDefault()
    setCompanyAgreementFeedback('')

    if (!companyForm.tradeName.trim() || !companyForm.legalName.trim() || !companyForm.city.trim() || !companyForm.state.trim()) {
      return
    }

    if (companyAgreementConflict && !companyForm.collectiveAgreementId) {
      setCompanyAgreementFeedback('Existe mais de uma CCT compatível para esta cidade/UF. Escolha manualmente a convenção da empresa.')
      return
    }

    const collectiveAgreementId =
      companyForm.collectiveAgreementId === ''
        ? companyAgreementSuggestion?.id ?? null
        : Number(companyForm.collectiveAgreementId)
    const suggestedCollectiveAgreementId = companyAgreementSuggestion?.id ?? null

    if (mode === 'create') {
      const newCompany: CompanyRecord = {
        id: Date.now(),
        status: 'ATIVA',
        collectiveAgreementId,
        suggestedCollectiveAgreementId,
        collectiveProfile: 'padrao',
        tradeName: companyForm.tradeName.trim(),
        legalName: companyForm.legalName.trim(),
        cnpj: companyForm.cnpj.trim(),
        zipCode: companyForm.zipCode.trim(),
        street: companyForm.street.trim(),
        number: companyForm.number.trim(),
        complement: companyForm.complement.trim(),
        district: companyForm.district.trim(),
        city: companyForm.city.trim(),
        state: companyForm.state.trim(),
      }

      setCompanies((current) => [newCompany, ...current])
      populateCompanyForm(newCompany)
      setCurrentCompanyId(newCompany.id)
      setIsCompanyModalOpen(false)
      resetForms()
      setActiveSection('Painel')
      return
    }

    if (!currentCompanyId) {
      return
    }

    setCompanies((current) =>
      current.map((item) =>
        item.id === currentCompanyId
          ? {
              ...item,
              collectiveAgreementId,
              suggestedCollectiveAgreementId,
              tradeName: companyForm.tradeName.trim(),
              legalName: companyForm.legalName.trim(),
              cnpj: companyForm.cnpj.trim(),
              zipCode: companyForm.zipCode.trim(),
              street: companyForm.street.trim(),
              number: companyForm.number.trim(),
              complement: companyForm.complement.trim(),
              district: companyForm.district.trim(),
              city: companyForm.city.trim(),
              state: companyForm.state.trim(),
            }
          : item,
      ),
    )
  }

  function deleteCompany(companyId: number) {
    const targetCompany = companies.find((item) => item.id === companyId)
    if (!targetCompany || targetCompany.status !== 'INATIVA') {
      return
    }

    setCompanies((current) => current.filter((item) => item.id !== companyId))
    setSectors((current) => current.filter((item) => item.companyId !== companyId))
    setFunctions((current) => current.filter((item) => item.companyId !== companyId))
    setCollaborators((current) => current.filter((item) => item.companyId !== companyId))
    setSchedules((current) => current.filter((item) => item.companyId !== companyId))
    setScaleAssignments((current) => current.filter((item) => item.companyId !== companyId))
    setScaleExtraRoster((current) => current.filter((item) => item.companyId !== companyId))
    setUsers((current) => current.filter((item) => item.companyId !== companyId))

    if (currentCompanyId === companyId) {
      setCurrentCompanyId(null)
      setCompanyForm(emptyCompanyForm)
      resetForms()
    }
  }

  function toggleCompanyStatus(companyId: number) {
    setCompanies((current) =>
      current.map((item) =>
        item.id === companyId
          ? {
              ...item,
              status: item.status === 'ATIVA' ? 'INATIVA' : 'ATIVA',
            }
          : item,
      ),
    )
  }

  function updateCompanyCollectiveProfile(
    companyId: number,
    collectiveProfile: CompanyRecord['collectiveProfile'],
  ) {
    setCompanies((current) =>
      current.map((item) =>
        item.id === companyId
          ? {
              ...item,
              collectiveProfile,
            }
          : item,
      ),
    )
  }

  function handleAgreementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!agreementForm.name.trim() || !agreementForm.coveredState.trim() || !agreementForm.coveredCity.trim()) {
      return
    }

    const newAgreement: CollectiveAgreementRecord = {
      id: editingAgreementId ?? Date.now(),
      name: agreementForm.name.trim(),
      employerUnion: agreementForm.employerUnion.trim(),
      employeeUnion: agreementForm.employeeUnion.trim(),
      coveredState: agreementForm.coveredState.trim(),
      coveredCity: agreementForm.coveredCity.trim(),
      category: agreementForm.category.trim(),
      validFrom: agreementForm.validFrom,
      validTo: agreementForm.validTo,
      sourceUrl: agreementForm.sourceUrl.trim(),
      sourceLabel: agreementForm.sourceLabel.trim(),
      notes: agreementForm.notes.trim(),
      isActive: true,
      rules: {
        standardMealBreakAfterSixHoursMinutes: Number(agreementForm.standardMealBreakAfterSixHoursMinutes),
        shortShiftBreakMinutes: Number(agreementForm.shortShiftBreakMinutes),
        standardBreakMaxMinutes: Number(agreementForm.standardBreakMaxMinutes),
        healthPlanBreakMaxMinutes: Number(agreementForm.healthPlanBreakMaxMinutes),
        specialBreakMinMinutes: Number(agreementForm.specialBreakMinMinutes),
        specialBreakMaxMinutes: Number(agreementForm.specialBreakMaxMinutes),
        maxDailyMinutes: Number(agreementForm.maxDailyMinutes),
        bankHoursMaxDailyMinutes: Number(agreementForm.bankHoursMaxDailyMinutes),
        rotatingDayOffNoticeDays: Number(agreementForm.rotatingDayOffNoticeDays),
        allowTwelveByThirtySix: agreementForm.allowTwelveByThirtySix,
      },
    }

    const nextAgreements =
      editingAgreementId === null
        ? [newAgreement, ...agreements]
        : agreements.map((item) => (item.id === editingAgreementId ? newAgreement : item))

    setAgreements(nextAgreements)
    setCompanies((current) =>
      current.map((item) => ({
        ...item,
        ...reconcileCompanyAgreementLink(item, nextAgreements),
      })),
    )
    setAgreementForm(emptyAgreementForm)
    setEditingAgreementId(null)
  }

  function handleFunctionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentCompanyId) {
      return
    }

    const resolvedSector = resolveCompanySectorName(currentCompanyId, functionForm.sector)
    const existingFunction = functions.find((item) => item.id === editingFunctionId) ?? null

    const newItem: FunctionRecord = {
      id: editingFunctionId ?? Date.now(),
      companyId: currentCompanyId,
      name: functionForm.name.trim(),
      sector: resolvedSector,
      description: functionForm.description.trim(),
      baseSalary: functionForm.baseSalary.trim(),
      serviceQuota: functionForm.serviceQuota.trim(),
      extraPayValue: functionForm.extraPayValue.trim(),
      isActive: existingFunction?.isActive ?? true,
      inactivePeriods: existingFunction?.inactivePeriods ?? [],
    }

    if (!newItem.name || !newItem.sector || !newItem.description) {
      return
    }

    ensureCompanySector(currentCompanyId, newItem.sector)
    setFunctions((current) =>
      editingFunctionId === null
        ? [newItem, ...current]
        : current.map((item) => (item.id === editingFunctionId ? newItem : item)),
    )
    setCollaboratorForm((current) => {
      const shouldLink =
        !!functionSuggestion.trim() &&
        functionSuggestion.trim().toLowerCase() === newItem.name.toLowerCase()

      if (!shouldLink) {
        return current
      }

      const nextFunctions =
        current.employmentType === 'EXTRA'
          ? [...current.functions, newItem.name].slice(0, 6)
          : [newItem.name]

      return {
        ...current,
        functions: nextFunctions,
        primaryFunction:
          current.primaryFunction && nextFunctions.includes(current.primaryFunction)
            ? current.primaryFunction
            : nextFunctions[0] ?? '',
      }
    })
    setFunctionForm(emptyFunctionForm)
    setEditingFunctionId(null)
    setFunctionSuggestion('')
    setIsFunctionModalOpen(false)
  }

  function editAgreement(agreementId: number) {
    const targetAgreement = agreements.find((item) => item.id === agreementId)
    if (!targetAgreement) {
      return
    }

    setEditingAgreementId(agreementId)
    setAgreementForm({
      name: targetAgreement.name,
      employerUnion: targetAgreement.employerUnion,
      employeeUnion: targetAgreement.employeeUnion,
      coveredState: targetAgreement.coveredState,
      coveredCity: targetAgreement.coveredCity,
      category: targetAgreement.category,
      validFrom: targetAgreement.validFrom,
      validTo: targetAgreement.validTo,
      sourceUrl: targetAgreement.sourceUrl,
      sourceLabel: targetAgreement.sourceLabel,
      notes: targetAgreement.notes,
      standardMealBreakAfterSixHoursMinutes: String(targetAgreement.rules.standardMealBreakAfterSixHoursMinutes),
      shortShiftBreakMinutes: String(targetAgreement.rules.shortShiftBreakMinutes),
      standardBreakMaxMinutes: String(targetAgreement.rules.standardBreakMaxMinutes),
      healthPlanBreakMaxMinutes: String(targetAgreement.rules.healthPlanBreakMaxMinutes),
      specialBreakMinMinutes: String(targetAgreement.rules.specialBreakMinMinutes),
      specialBreakMaxMinutes: String(targetAgreement.rules.specialBreakMaxMinutes),
      maxDailyMinutes: String(targetAgreement.rules.maxDailyMinutes),
      bankHoursMaxDailyMinutes: String(targetAgreement.rules.bankHoursMaxDailyMinutes),
      rotatingDayOffNoticeDays: String(targetAgreement.rules.rotatingDayOffNoticeDays),
      allowTwelveByThirtySix: targetAgreement.rules.allowTwelveByThirtySix,
    })
  }

  function deleteAgreement(agreementId: number) {
    const nextAgreements = agreements.filter((item) => item.id !== agreementId)
    setAgreements(nextAgreements)
    setCompanies((current) =>
      current.map((item) => ({
        ...item,
        ...reconcileCompanyAgreementLink(item, nextAgreements),
      })),
    )

    if (editingAgreementId === agreementId) {
      setAgreementForm(emptyAgreementForm)
      setEditingAgreementId(null)
    }
  }

  function handleCollaboratorSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentCompanyId) {
      return
    }

    const normalizedFunctions =
      collaboratorForm.employmentType === 'EXTRA'
        ? collaboratorForm.functions.slice(0, 6)
        : collaboratorForm.functions.slice(0, 1)

    const cpfDigits = collaboratorForm.cpf.replace(/\D/g, '')
    if (
      cpfDigits.length !== 11 ||
      !collaboratorForm.fullName.trim() ||
      normalizedFunctions.length === 0 ||
      (normalizedFunctions.length > 1 && !collaboratorForm.primaryFunction)
    ) {
      return
    }

    const primaryFunction =
      normalizedFunctions.length === 1
        ? normalizedFunctions[0]
        : collaboratorForm.primaryFunction
    const nextCollaboratorId =
      currentCompanyCollaborator?.id ??
      collaborators.reduce((max, item) => Math.max(max, item.id), 0) + 1

    const nextCollaboratorRecord: CollaboratorRecord = {
      id: nextCollaboratorId,
      companyId: currentCompanyId,
      cpf: collaboratorForm.cpf.trim(),
      employmentType: collaboratorForm.employmentType,
      isActive: currentCompanyCollaborator?.isActive ?? true,
      inactiveSince: currentCompanyCollaborator?.inactiveSince ?? null,
      inactivePeriods: currentCompanyCollaborator?.inactivePeriods ?? [],
      functions: normalizedFunctions,
      primaryFunction,
    }

    setCollaboratorProfiles((current) => {
      const nextKnownFunctions = Array.from(
        new Set([
          ...(currentCollaboratorProfile?.knownFunctions ?? []),
          ...normalizedFunctions,
        ]),
      )

      const nextProfile: CollaboratorProfileRecord = {
        cpf: collaboratorForm.cpf.trim(),
        fullName: collaboratorForm.fullName.trim(),
        pixKey: collaboratorForm.pixKey.trim(),
        contact: collaboratorForm.contact.trim(),
        knownFunctions: nextKnownFunctions,
      }

      const exists = current.some((item) => item.cpf.replace(/\D/g, '') === cpfDigits)
      if (!exists) {
        return [nextProfile, ...current]
      }

      return current.map((item) =>
        item.cpf.replace(/\D/g, '') === cpfDigits ? nextProfile : item,
      )
    })
    setCollaborators((current) =>
      currentCompanyCollaborator
        ? current.map((item) =>
            item.id === currentCompanyCollaborator.id ? nextCollaboratorRecord : item,
          )
        : [nextCollaboratorRecord, ...current],
    )
    if (collaboratorModalSource === 'user') {
      setUserForm((current) => ({
        ...current,
        linkedCollaboratorId: String(nextCollaboratorId),
      }))
    }
    setCollaboratorForm(emptyCollaboratorForm)
    setCollaboratorLookupFeedback(
      currentCompanyCollaborator
        ? 'Cadastro deste colaborador foi atualizado nesta empresa.'
        : 'Colaborador vinculado com sucesso a esta empresa.',
    )
    setCollaboratorModalSource('scale')
    setIsCollaboratorModalOpen(false)
  }

  function handleScheduleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validation = validateSchedule(scheduleForm, currentCompany, currentAgreement)
    if (!validation.valid || !currentCompanyId) {
      setScheduleFeedback(validation)
      if (!validation.valid) {
        setScheduleWarning({
          title: 'Horario invalido',
          messages: [
            ...validation.errors,
            ...validation.notes,
          ],
        })
      }
      return
    }

    const duplicateSchedule = companySchedules.find(
      (item) =>
        item.id !== editingScheduleId &&
        item.shiftName.trim().toLowerCase() === scheduleForm.shiftName.trim().toLowerCase() &&
        item.startTime === scheduleForm.startTime &&
        item.startPeriod === scheduleForm.startPeriod &&
        item.breakStart === scheduleForm.breakStart &&
        item.breakStartPeriod === scheduleForm.breakStartPeriod &&
        item.breakEnd === scheduleForm.breakEnd &&
        item.breakEndPeriod === scheduleForm.breakEndPeriod &&
        item.endTime === scheduleForm.endTime &&
        item.endPeriod === scheduleForm.endPeriod,
    )

    if (duplicateSchedule) {
      const duplicateFeedback = {
        valid: false,
        errors: ['Ja existe um horario cadastrado com essa mesma composicao de turno e pausa.'],
        notes: ['Edite o horario existente ou altere o novo cadastro para evitar duplicidade.'],
      }
      setScheduleFeedback(duplicateFeedback)
      setScheduleWarning({
        title: 'Horario invalido',
        messages: [...duplicateFeedback.errors, ...duplicateFeedback.notes],
      })
      return
    }

    const nextScheduleId =
      editingScheduleId ?? schedules.reduce((max, item) => Math.max(max, item.id), 0) + 1

    const newItem: ScheduleRecord = {
      id: nextScheduleId,
      companyId: currentCompanyId,
      isActive:
        schedules.find((item) => item.id === editingScheduleId)?.isActive ?? true,
      inactivePeriods:
        schedules.find((item) => item.id === editingScheduleId)?.inactivePeriods ?? [],
      shiftName: scheduleForm.shiftName.trim(),
      abbreviation: normalizeAbbreviation(scheduleForm.shiftName),
      startTime: scheduleForm.startTime,
      startPeriod: scheduleForm.startPeriod,
      breakStart: scheduleForm.breakStart,
      breakStartPeriod: scheduleForm.breakStartPeriod,
      breakEnd: scheduleForm.breakEnd,
      breakEndPeriod: scheduleForm.breakEndPeriod,
      endTime: scheduleForm.endTime,
      endPeriod: scheduleForm.endPeriod,
      netMinutes: validation.netMinutes ?? 0,
      validationMessage: validation.notes.join(' '),
    }

    setSchedules((current) =>
      editingScheduleId === null
        ? [newItem, ...current]
        : current.map((item) => (item.id === editingScheduleId ? newItem : item)),
    )
    setScheduleFeedback({
      valid: true,
      errors: [],
      notes: [
        editingScheduleId === null
          ? 'Horario cadastrado com sucesso.'
          : 'Horario atualizado com sucesso.',
        ...validation.notes,
      ],
      netMinutes: validation.netMinutes,
    })
    setScheduleForm(emptyScheduleForm)
    setEditingScheduleId(null)
  }

  function editSchedule(scheduleId: number) {
    const targetSchedule = schedules.find((item) => item.id === scheduleId)
    if (!targetSchedule) {
      return
    }

    setEditingScheduleId(scheduleId)
    setScheduleForm({
      shiftName: targetSchedule.shiftName,
      startTime: targetSchedule.startTime,
      startPeriod: targetSchedule.startPeriod,
      breakStart: targetSchedule.breakStart,
      breakStartPeriod: targetSchedule.breakStartPeriod,
      breakEnd: targetSchedule.breakEnd,
      breakEndPeriod: targetSchedule.breakEndPeriod,
      endTime: targetSchedule.endTime,
      endPeriod: targetSchedule.endPeriod,
    })
    setScheduleFeedback({
      valid: true,
      errors: [],
      notes: ['Modo de edicao ativo para este horario.'],
      netMinutes: targetSchedule.netMinutes,
    })
  }

  function toggleScheduleActivation(scheduleId: number) {
    const targetSchedule = schedules.find((item) => item.id === scheduleId)
    if (!targetSchedule) {
      return
    }

    if (!confirmScheduleActivationChange(targetSchedule)) {
      return
    }

    const today = toIsoDate(new Date())
    setSchedules((current) =>
      current.map((item) =>
        item.id === scheduleId
          ? {
              ...item,
              isActive: !item.isActive,
              inactivePeriods: item.isActive
                ? startInactivePeriod(item.inactivePeriods, today)
                : endInactivePeriod(item.inactivePeriods, today),
            }
          : item,
      ),
    )
  }

  function deleteSchedule(scheduleId: number) {
    setSchedules((current) => current.filter((item) => item.id !== scheduleId))
    if (editingScheduleId === scheduleId) {
      setScheduleForm(emptyScheduleForm)
      setEditingScheduleId(null)
    }
    setScheduleFeedback({
      valid: true,
      errors: [],
      notes: ['Horario excluido com sucesso.'],
    })
  }

  function handleUserSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentCompanyId) {
      return
    }

    const validationMessages: string[] = []

    if (!userForm.fullName.trim()) {
      validationMessages.push('Informe o nome completo do usuario.')
    }

    if (!userForm.username.trim()) {
      validationMessages.push('Informe o login do usuario.')
    }

    if (!userForm.password.trim()) {
      validationMessages.push('Informe a senha do usuario.')
    }

    if (userForm.role === 'Visualizador' && !userForm.linkedCollaboratorId) {
      validationMessages.push('Associe o usuario visualizador a um colaborador cadastrado.')
    }

    if (userForm.role !== 'Visualizador' && userForm.sectors.length === 0) {
      validationMessages.push('Selecione ao menos um setor para este usuario.')
    }

    const linkedCollaborator =
      userForm.role === 'Visualizador' && userForm.linkedCollaboratorId
        ? companyCollaborators.find((item) => item.id === Number(userForm.linkedCollaboratorId)) ?? null
        : null
    const linkedCollaboratorSector =
      linkedCollaborator === null ? '' : getCollaboratorSector(linkedCollaborator)

    if (userForm.role === 'Visualizador' && linkedCollaborator !== null && !linkedCollaboratorSector) {
      validationMessages.push('O colaborador vinculado precisa ter uma funcao principal com setor definido.')
    }

    const duplicateUsername = users.find(
      (item) =>
        item.id !== editingUserId &&
        item.username.trim().toLowerCase() === userForm.username.trim().toLowerCase(),
    )
    if (duplicateUsername) {
      validationMessages.push('Ja existe outro usuario cadastrado com esse login.')
    }

    if (validationMessages.length > 0) {
      setUserWarning({
        title: 'Usuario invalido',
        messages: validationMessages,
      })
      return
    }

    const resolvedUserSectors =
      userForm.role === 'Visualizador' && linkedCollaboratorSector
        ? [resolveCompanySectorName(currentCompanyId, linkedCollaboratorSector)]
        : userForm.sectors.map((sectorName) => resolveCompanySectorName(currentCompanyId, sectorName))

    resolvedUserSectors.forEach((sectorName) => ensureCompanySector(currentCompanyId, sectorName))

    const newItem: CompanyUserRecord = {
      id: editingUserId ?? Date.now(),
      companyId: currentCompanyId,
      fullName: userForm.fullName.trim(),
      username: userForm.username.trim(),
      password: userForm.password,
      role: userForm.role,
      sectors: resolvedUserSectors,
      linkedCollaboratorId:
        userForm.role === 'Visualizador' && userForm.linkedCollaboratorId
          ? Number(userForm.linkedCollaboratorId)
          : null,
      isActive: users.find((item) => item.id === editingUserId)?.isActive ?? true,
    }

    setUsers((current) =>
      editingUserId === null
        ? [newItem, ...current]
        : current.map((item) => (item.id === editingUserId ? newItem : item)),
    )
    setUserForm(emptyUserForm)
    setIsUserFormPasswordVisible(false)
    setUserSectorInput('')
    setEditingUserId(null)
  }

  function editUser(userId: number) {
    const targetUser = users.find((item) => item.id === userId)
    if (!targetUser) {
      return
    }

    setEditingUserId(userId)
    setUserForm({
      fullName: targetUser.fullName,
      username: targetUser.username,
      password: targetUser.password,
      role: targetUser.role,
      sectors: targetUser.sectors,
      linkedCollaboratorId: targetUser.linkedCollaboratorId ? String(targetUser.linkedCollaboratorId) : '',
    })
    setIsUserFormPasswordVisible(false)
  }

  function toggleUserActivation(userId: number) {
    setUsers((current) =>
      current.map((item) =>
        item.id === userId
          ? {
              ...item,
              isActive: !item.isActive,
            }
          : item,
      ),
    )
  }

  function deleteUser(userId: number) {
    setUsers((current) => current.filter((item) => item.id !== userId))
    if (editingUserId === userId) {
      setUserForm(emptyUserForm)
      setUserSectorInput('')
      setEditingUserId(null)
    }
  }

  function toggleCollaboratorFunction(functionName: string) {
    setCollaboratorForm((current) => {
      const exists = current.functions.includes(functionName)
      if (exists) {
        const nextFunctions = current.functions.filter((item) => item !== functionName)
        return {
          ...current,
          functions: nextFunctions,
          primaryFunction:
            current.primaryFunction === functionName
              ? nextFunctions[0] ?? ''
              : current.primaryFunction,
        }
      }

      const nextFunctions =
        current.employmentType === 'EXTRA'
          ? [...current.functions, functionName].slice(0, 6)
          : [functionName]

      return {
        ...current,
        functions: nextFunctions,
        primaryFunction:
          current.primaryFunction && nextFunctions.includes(current.primaryFunction)
            ? current.primaryFunction
            : nextFunctions[0] ?? '',
      }
    })
  }

  function changeCollaboratorEmploymentType(employmentType: CollaboratorEmploymentType) {
    setCollaboratorForm((current) => ({
      ...current,
      employmentType,
      functions:
        employmentType === 'EXTRA' ? current.functions.slice(0, 6) : current.functions.slice(0, 1),
      primaryFunction:
        employmentType === 'EXTRA'
          ? current.primaryFunction
          : current.functions.slice(0, 1)[0] ?? current.primaryFunction,
    }))
  }

  function toggleCollaboratorActivation(collaboratorId: number) {
    if (!canManageCollaboratorActivation) {
      return
    }

    const targetCollaborator = collaborators.find((item) => item.id === collaboratorId)
    if (!targetCollaborator) {
      return
    }

    if (!confirmCollaboratorActivationChange(targetCollaborator)) {
      return
    }

    const today = toIsoDate(new Date())
    setCollaborators((current) =>
      current.map((item) =>
        item.id === collaboratorId
          ? {
              ...item,
              isActive: !item.isActive,
              inactiveSince: item.isActive ? today : null,
              inactivePeriods: item.isActive
                ? startInactivePeriod(item.inactivePeriods, today)
                : endInactivePeriod(item.inactivePeriods, today),
            }
          : item,
      ),
    )
  }

  function editCollaborator(collaboratorId: number) {
    const targetCollaborator = collaborators.find((item) => item.id === collaboratorId)
    if (!targetCollaborator) {
      return
    }

    const targetProfile =
      collaboratorProfiles.find((profile) => profile.cpf.replace(/\D/g, '') === targetCollaborator.cpf.replace(/\D/g, '')) ?? null

    setCollaboratorForm({
      cpf: targetCollaborator.cpf,
      fullName: targetProfile?.fullName ?? '',
      pixKey: targetProfile?.pixKey ?? '',
      contact: targetProfile?.contact ?? '',
      employmentType: targetCollaborator.employmentType,
      functions: targetCollaborator.functions,
      primaryFunction: targetCollaborator.primaryFunction,
    })
    setCollaboratorLookupFeedback('Cadastro carregado para edicao.')
  }

  function deleteCollaborator(collaboratorId: number) {
    const targetCollaborator = collaborators.find((item) => item.id === collaboratorId)
    if (!targetCollaborator) {
      return
    }

    setCollaborators((current) => current.filter((item) => item.id !== collaboratorId))
    setScaleAssignments((current) => current.filter((item) => item.collaboratorId !== collaboratorId))
    setScaleExtraRoster((current) => current.filter((item) => item.collaboratorId !== collaboratorId))

    if (currentCompanyCollaborator?.id === collaboratorId) {
      setCollaboratorForm(emptyCollaboratorForm)
      setCollaboratorLookupFeedback('')
    }
  }

  function openFunctionModal(prefillName = '') {
    setFunctionSuggestion(prefillName)
    setFunctionForm((current) => ({
      ...current,
      name: prefillName || current.name,
    }))
    setIsFunctionModalOpen(true)
  }

  function editFunction(functionId: number) {
    const targetFunction = functions.find((item) => item.id === functionId)
    if (!targetFunction) {
      return
    }

    setEditingFunctionId(functionId)
    setFunctionForm({
      name: targetFunction.name,
      sector: targetFunction.sector,
      description: targetFunction.description,
      baseSalary: targetFunction.baseSalary,
      serviceQuota: targetFunction.serviceQuota,
      extraPayValue: targetFunction.extraPayValue,
    })
  }

  function toggleFunctionActivation(functionId: number) {
    const targetFunction = functions.find((item) => item.id === functionId)
    if (!targetFunction) {
      return
    }

    if (!confirmFunctionActivationChange(targetFunction)) {
      return
    }

    const today = toIsoDate(new Date())
    setFunctions((current) =>
      current.map((item) =>
        item.id === functionId
          ? {
              ...item,
              isActive: !item.isActive,
              inactivePeriods: item.isActive
                ? startInactivePeriod(item.inactivePeriods, today)
                : endInactivePeriod(item.inactivePeriods, today),
            }
          : item,
      ),
    )
  }

  function deleteFunction(functionId: number) {
    const targetFunction = functions.find((item) => item.id === functionId)
    if (!targetFunction) {
      return
    }

    setFunctions((current) => current.filter((item) => item.id !== functionId))
    setCollaborators((current) =>
      current.map((item) => {
        if (item.companyId !== targetFunction.companyId || !item.functions.includes(targetFunction.name)) {
          return item
        }

        const nextFunctions = item.functions.filter((functionName) => functionName !== targetFunction.name)
        return {
          ...item,
          functions: nextFunctions,
          primaryFunction:
            item.primaryFunction === targetFunction.name ? nextFunctions[0] ?? '' : item.primaryFunction,
        }
      }),
    )

    if (editingFunctionId === functionId) {
      setFunctionForm(emptyFunctionForm)
      setEditingFunctionId(null)
      setFunctionSuggestion('')
      setIsFunctionModalOpen(false)
    }
  }

  function changeCollaboratorCpf(value: string) {
    const formattedCpf = formatCpf(value)
    const cpfDigits = formattedCpf.replace(/\D/g, '')
    const existingProfile =
      collaboratorProfiles.find((item) => item.cpf.replace(/\D/g, '') === cpfDigits) ?? null
    const existingCompanyCollaborator =
      currentCompanyId === null
        ? null
        : collaborators.find(
            (item) => item.companyId === currentCompanyId && item.cpf.replace(/\D/g, '') === cpfDigits,
          ) ?? null

    if (!existingProfile) {
      setCollaboratorForm((current) => ({
        ...current,
        cpf: formattedCpf,
        fullName: current.cpf === formattedCpf ? current.fullName : '',
        contact: current.cpf === formattedCpf ? current.contact : '',
        pixKey: current.cpf === formattedCpf ? current.pixKey : '',
        functions: current.cpf === formattedCpf ? current.functions : [],
        primaryFunction: current.cpf === formattedCpf ? current.primaryFunction : '',
      }))
      setCollaboratorLookupFeedback(
        cpfDigits.length === 11 ? 'CPF nao encontrado em outras empresas. Cadastre os dados deste colaborador.' : '',
      )
      return
    }

    setCollaboratorForm((current) => ({
      ...current,
      cpf: formattedCpf,
      fullName: existingProfile.fullName,
      contact: existingProfile.contact,
      pixKey: existingProfile.pixKey,
      functions: existingCompanyCollaborator?.functions ?? current.functions,
      primaryFunction: existingCompanyCollaborator?.primaryFunction ?? current.primaryFunction,
      employmentType: existingCompanyCollaborator?.employmentType ?? current.employmentType,
    }))

    setCollaboratorLookupFeedback(
      existingCompanyCollaborator
        ? 'Este colaborador ja possui cadastro nesta empresa. Os dados globais foram carregados.'
        : 'Colaborador localizado por CPF em outra empresa. Dados basicos carregados automaticamente.',
    )
  }

  function changeCompanyZipCode(value: string) {
    setZipCodeFeedback('')
    setCompanyForm((current) => ({
      ...current,
      zipCode: formatZipCode(value),
    }))
  }

  function openCollaboratorModal(source: CollaboratorModalSource) {
    setCollaboratorModalSource(source)
    setCollaboratorLookupFeedback('')
    setCollaboratorForm(
      source === 'user'
        ? {
            ...emptyCollaboratorForm,
            fullName: userForm.fullName,
          }
        : emptyCollaboratorForm,
    )
    setIsCollaboratorModalOpen(true)
  }

  function buildAppStateSnapshot(): AppStateSnapshot {
    return {
      version: appStateVersion,
      companies,
      agreements,
      sectors,
      functions,
      collaboratorProfiles,
      collaborators,
      schedules,
      scaleAssignments,
      scaleComments,
      scaleExtraRoster,
      users,
    }
  }

  function applyAppStateSnapshot(snapshot: AppStateSnapshot) {
    const normalizedState = normalizePersistedState(snapshot)
    setCompanies(normalizedState.companies)
    setAgreements(normalizedState.agreements)
    setSectors(normalizedState.sectors)
    setFunctions(normalizedState.functions)
    setCollaboratorProfiles(normalizedState.collaboratorProfiles)
    setCollaborators(normalizedState.collaborators)
    setSchedules(normalizedState.schedules)
    setScaleAssignments(normalizedState.scaleAssignments)
    setScaleComments(normalizedState.scaleComments)
    setScaleExtraRoster(normalizedState.scaleExtraRoster)
    setUsers(normalizedState.users)
  }

  useEffect(() => {
    let cancelled = false

    async function hydrateFromApi() {
      try {
        const response = await fetch(`${apiBaseUrl}/state`)
        if (!response.ok) {
          throw new Error('remote-state-unavailable')
        }

        const payload = (await response.json()) as { state: AppStateSnapshot | null }
        if (cancelled) {
          return
        }

        setPersistenceMode('api')

        if (payload.state) {
          skipNextRemoteSyncRef.current = true
          applyAppStateSnapshot(payload.state)
        }
      } catch {
        if (!cancelled) {
          setPersistenceMode('local')
        }
      } finally {
        if (!cancelled) {
          setIsPersistenceReady(true)
        }
      }
    }

    void hydrateFromApi()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!isPersistenceReady || persistenceMode !== 'api') {
      return
    }

    if (skipNextRemoteSyncRef.current) {
      skipNextRemoteSyncRef.current = false
      return
    }

    if (remoteSyncTimeoutRef.current !== null) {
      window.clearTimeout(remoteSyncTimeoutRef.current)
    }

    const snapshot = buildAppStateSnapshot()
    remoteSyncTimeoutRef.current = window.setTimeout(() => {
      void fetch(`${apiBaseUrl}/state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(snapshot),
      }).catch(() => {
        setPersistenceMode('local')
      })
    }, 600)

    return () => {
      if (remoteSyncTimeoutRef.current !== null) {
        window.clearTimeout(remoteSyncTimeoutRef.current)
      }
    }
  }, [
    agreements,
    collaboratorProfiles,
    collaborators,
    companies,
    functions,
    isPersistenceReady,
    persistenceMode,
    scaleAssignments,
    scaleComments,
    scaleExtraRoster,
    schedules,
    sectors,
    users,
  ])

  useEffect(() => {
    const zipDigits = companyForm.zipCode.replace(/\D/g, '')
    if (zipDigits.length !== 8) {
      return
    }

    let cancelled = false

    async function lookupZipCode() {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${zipDigits}/json/`)
        const data = (await response.json()) as {
          erro?: boolean
          logradouro?: string
          complemento?: string
          bairro?: string
          localidade?: string
          uf?: string
        }

        if (cancelled) {
          return
        }

        if (data.erro) {
          setZipCodeFeedback('CEP nao encontrado.')
          return
        }

        setCompanyForm((current) => ({
          ...current,
          street: data.logradouro ?? current.street,
          complement: data.complemento ?? current.complement,
          district: data.bairro ?? current.district,
          city: data.localidade ?? current.city,
          state: data.uf ?? current.state,
        }))
        setZipCodeFeedback('Endereco localizado pelo CEP.')
      } catch {
        if (!cancelled) {
          setZipCodeFeedback('Nao foi possivel consultar o CEP agora.')
        }
      }
    }

    void lookupZipCode()

    return () => {
      cancelled = true
    }
  }, [companyForm.zipCode])

  useEffect(() => {
    writeStoredValue(storageKeys.companies, companies)
  }, [companies])

  useEffect(() => {
    writeStoredValue(storageKeys.agreements, agreements)
  }, [agreements])

  useEffect(() => {
    writeStoredValue(storageKeys.sectors, sectors)
  }, [sectors])

  useEffect(() => {
    writeStoredValue(storageKeys.functions, functions)
  }, [functions])

  useEffect(() => {
    writeStoredValue(storageKeys.collaboratorProfiles, collaboratorProfiles)
  }, [collaboratorProfiles])

  useEffect(() => {
    writeStoredValue(storageKeys.collaborators, collaborators)
  }, [collaborators])

  useEffect(() => {
    writeStoredValue(storageKeys.schedules, schedules)
  }, [schedules])

  useEffect(() => {
    writeStoredValue(storageKeys.scaleAssignments, scaleAssignments)
  }, [scaleAssignments])

  useEffect(() => {
    writeStoredValue(storageKeys.scaleComments, scaleComments)
  }, [scaleComments])

  useEffect(() => {
    writeStoredValue(storageKeys.scaleExtraRoster, scaleExtraRoster)
  }, [scaleExtraRoster])

  useEffect(() => {
    writeStoredValue(storageKeys.users, users)
  }, [users])

  useEffect(() => {
    if (session?.kind !== 'companyUser') {
      return
    }

    const refreshedUser = users.find((item) => item.id === session.user.id)
    if (!refreshedUser) {
      setSession(null)
      return
    }

    if (
      refreshedUser.fullName !== session.user.fullName ||
      refreshedUser.username !== session.user.username ||
      refreshedUser.password !== session.user.password ||
      refreshedUser.role !== session.user.role ||
      refreshedUser.isActive !== session.user.isActive ||
      refreshedUser.linkedCollaboratorId !== session.user.linkedCollaboratorId ||
      refreshedUser.sectors.join('|') !== session.user.sectors.join('|')
    ) {
      setSession({ kind: 'companyUser', user: refreshedUser })
    }
  }, [session, users])

  useEffect(() => {
    if (companyAgreementSuggestion && !companyForm.collectiveAgreementId) {
      setCompanyForm((current) => ({
        ...current,
        collectiveAgreementId: String(companyAgreementSuggestion.id),
      }))
    }
  }, [companyAgreementSuggestion, companyForm.collectiveAgreementId])

  useEffect(() => {
    if (!visibleAppSections.includes(activeSection)) {
      setActiveSection(visibleAppSections[0] ?? 'Escala')
    }
  }, [activeSection, visibleAppSections])

  useEffect(() => {
    if (!openReportColumnMenu) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }

      if (target.closest('.report-column-menu') || target.closest('.report-column-menu-button')) {
        return
      }

      setOpenReportColumnMenu(null)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenReportColumnMenu(null)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openReportColumnMenu])

  if (!session) {
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow auth-eyebrow">Gestor de Escala Laboral</p>
          <p className="brand-signature">by Igarape A&amp;B</p>

          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              Usuario
              <input
                value={loginForm.username}
                onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
              />
            </label>
            <label>
              Senha
              <div className="password-input-row">
                <input
                  type={isLoginPasswordVisible ? 'text' : 'password'}
                  value={loginForm.password}
                  onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
                />
                <button
                  type="button"
                  className="icon-button password-toggle"
                  aria-label={isLoginPasswordVisible ? 'Ocultar senha' : 'Exibir senha'}
                  title={isLoginPasswordVisible ? 'Ocultar senha' : 'Exibir senha'}
                  onClick={() => setIsLoginPasswordVisible((current) => !current)}
                >
                  {isLoginPasswordVisible ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.8 2.8M9.9 5.1A10.9 10.9 0 0 1 12 5c5.5 0 9.5 5.1 10 7-.2.7-.9 1.8-2 3M6.7 6.7C4.2 8.2 2.5 10.7 2 12c.5 1.9 4.5 7 10 7 1.6 0 3-.3 4.2-.9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="3"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </label>
            <button type="submit" className="primary-button auth-button">
              Entrar
            </button>
          </form>

          {loginError && <div className="feedback error compact-feedback">{loginError}</div>}
        </section>
      </div>
    )
  }

  if (isSystemAdmin && companies.length === 0) {
    return (
      <div className="auth-shell">
        <section className="auth-card onboarding-card">
          <p className="eyebrow">Primeiro acesso</p>
          <h1>Cadastre a primeira empresa antes de usar o sistema</h1>
          <p className="sidebar-copy">
            Sem empresa cadastrada, nao existe contexto para colaboradores, funcoes, horarios ou
            usuarios.
          </p>

          <form className="form-grid" onSubmit={(event) => submitCompany(event, 'create')}>
            <label>
              Nome fantasia
              <input
                value={companyForm.tradeName}
                onChange={(event) => setCompanyForm({ ...companyForm, tradeName: event.target.value })}
              />
            </label>
            <label>
              Razao social
              <input
                value={companyForm.legalName}
                onChange={(event) => setCompanyForm({ ...companyForm, legalName: event.target.value })}
              />
            </label>
            <label>
              CNPJ
              <input
                value={companyForm.cnpj}
                onChange={(event) =>
                  setCompanyForm({ ...companyForm, cnpj: formatCnpj(event.target.value) })
                }
              />
            </label>
            <label>
              CEP
              <input
                value={companyForm.zipCode}
                onChange={(event) => changeCompanyZipCode(event.target.value)}
              />
            </label>
            <div className="field-span helper-banner">{zipCodeFeedback || 'Digite o CEP para sugerir o logradouro.'}</div>
            <label>
              Logradouro
              <input
                value={companyForm.street}
                onChange={(event) => setCompanyForm({ ...companyForm, street: event.target.value })}
              />
            </label>
            <label>
              Numero
              <input
                value={companyForm.number}
                onChange={(event) => setCompanyForm({ ...companyForm, number: event.target.value })}
              />
            </label>
            <label>
              Complemento
              <input
                value={companyForm.complement}
                onChange={(event) => setCompanyForm({ ...companyForm, complement: event.target.value })}
              />
            </label>
            <label>
              Bairro
              <input
                value={companyForm.district}
                onChange={(event) => setCompanyForm({ ...companyForm, district: event.target.value })}
              />
            </label>
            <label>
              Estado
              <select
                value={companyForm.state}
                onChange={(event) => setCompanyForm({ ...companyForm, state: event.target.value })}
              >
                <option value="">Selecione</option>
                {brazilianStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cidade
              <input
                value={companyForm.city}
                onChange={(event) => setCompanyForm({ ...companyForm, city: event.target.value })}
              />
            </label>
            {companyAgreementField}
            <div className="form-actions">
              <button type="submit" className="primary-button">
                Salvar primeira empresa
              </button>
            </div>
          </form>
        </section>
      </div>
    )
  }

  if (isSystemAdmin && currentCompanyId === null) {
    return (
      <div className="auth-shell">
        <section className="auth-card selector-card">
          <div className="selector-header">
            <div>
              <p className="eyebrow">Administrador do sistema</p>
              <h1 className="selector-title">Selecione uma empresa</h1>
            </div>
            <button type="button" className="ghost-button" onClick={logout}>
              Sair
            </button>
          </div>

          <div className="selector-list">
            {companies.map((company) => (
              <article key={company.id} className="selector-item">
                <button type="button" className="selector-main" onClick={() => switchCompany(company.id)}>
                  <strong>{company.tradeName}</strong>
                  <span>
                    {company.city}/{company.state}
                  </span>
                  <span>Status: {company.status}</span>
                  <span>{company.cnpj || 'CNPJ nao informado'}</span>
                </button>
                <div className="selector-row">
                  <button
                    type="button"
                    className={company.status === 'ATIVA' ? 'warning-button' : 'secondary-button'}
                    onClick={() => toggleCompanyStatus(company.id)}
                  >
                    {company.status === 'ATIVA' ? 'Inativar empresa' : 'Ativar empresa'}
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => deleteCompany(company.id)}
                    disabled={company.status !== 'INATIVA'}
                  >
                    Excluir empresa
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="selector-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                setCompanyForm(emptyCompanyForm)
                setIsCompanyModalOpen(true)
              }}
            >
              Cadastrar nova empresa
            </button>
          </div>
        </section>

        {isCompanyModalOpen && (
          <div className="modal-backdrop" role="presentation" onClick={() => setIsCompanyModalOpen(false)}>
            <section
              className="modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="company-modal-title"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="section-header modal-header">
                <div>
                  <p className="eyebrow">Nova empresa</p>
                  <h2 id="company-modal-title">Cadastro de empresa</h2>
                </div>
                <button type="button" className="ghost-button" onClick={() => setIsCompanyModalOpen(false)}>
                  Fechar
                </button>
              </div>

              <form className="form-grid" onSubmit={(event) => submitCompany(event, 'create')}>
                <label>
                  Nome fantasia
                  <input
                    value={companyForm.tradeName}
                    onChange={(event) => setCompanyForm({ ...companyForm, tradeName: event.target.value })}
                  />
                </label>
                <label>
                  Razao social
                  <input
                    value={companyForm.legalName}
                    onChange={(event) => setCompanyForm({ ...companyForm, legalName: event.target.value })}
                  />
                </label>
                <label>
                  CNPJ
                  <input
                    value={companyForm.cnpj}
                    onChange={(event) =>
                      setCompanyForm({ ...companyForm, cnpj: formatCnpj(event.target.value) })
                    }
                  />
                </label>
                <label>
                  CEP
                  <input
                    value={companyForm.zipCode}
                    onChange={(event) => changeCompanyZipCode(event.target.value)}
                  />
                </label>
                <div className="field-span helper-banner">{zipCodeFeedback || 'Digite o CEP para sugerir o logradouro.'}</div>
                <label>
                  Logradouro
                  <input
                    value={companyForm.street}
                    onChange={(event) => setCompanyForm({ ...companyForm, street: event.target.value })}
                  />
                </label>
                <label>
                  Numero
                  <input
                    value={companyForm.number}
                    onChange={(event) => setCompanyForm({ ...companyForm, number: event.target.value })}
                  />
                </label>
                <label>
                  Complemento
                  <input
                    value={companyForm.complement}
                    onChange={(event) => setCompanyForm({ ...companyForm, complement: event.target.value })}
                  />
                </label>
                <label>
                  Bairro
                  <input
                    value={companyForm.district}
                    onChange={(event) => setCompanyForm({ ...companyForm, district: event.target.value })}
                  />
                </label>
                <label>
                  Estado
                  <select
                    value={companyForm.state}
                    onChange={(event) => setCompanyForm({ ...companyForm, state: event.target.value })}
                  >
                    <option value="">Selecione</option>
                    {brazilianStates.map((state) => (
                      <option key={state} value={state}>
                        {state}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Cidade
                  <input
                    value={companyForm.city}
                    onChange={(event) => setCompanyForm({ ...companyForm, city: event.target.value })}
                  />
                </label>
                {companyAgreementField}
                <div className="form-actions">
                  <button type="submit" className="primary-button">
                    Salvar empresa
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-inner">
          <div>
            <p className="eyebrow">Gestor de Escala Laboral</p>
          </div>

          <nav className="sidebar-nav" aria-label="Navegacao principal">
            {visibleAppSections.map((section) => (
              <button
                key={section}
                type="button"
                className={section === activeSection ? 'nav-item active' : 'nav-item'}
                onClick={() => setActiveSection(section)}
              >
                {section}
              </button>
            ))}
            <button type="button" className="nav-item sidebar-logout" onClick={logout}>
              Sair
            </button>
          </nav>
        </div>
      </aside>

      <main className="content">
        <section className="hero-panel">
          <div>
            <p className="eyebrow">
              {session.kind === 'systemAdmin' ? 'Administrador do sistema' : session.user.role}
            </p>
            <h2>{currentCompany ? currentCompany.tradeName : 'Nenhuma empresa selecionada'}</h2>
            <div className="hero-details">
              <span>{session.user.fullName}</span>
              <span>{currentCompany ? currentCompany.status : 'Sem empresa ativa'}</span>
              {!isViewer ? (
                <span>{currentCompany ? currentCompany.cnpj || 'CNPJ pendente' : 'Sem empresa ativa'}</span>
              ) : null}
            </div>
          </div>
          <div className="hero-meta">
            {session.kind === 'systemAdmin' ? (
              <button type="button" className="secondary-button" onClick={() => setCurrentCompanyId(null)}>
                Trocar empresa
              </button>
            ) : null}
          </div>
        </section>

        {activeSection === 'Painel' && (
          <>
            <section className="panel-grid">
              {dashboardMetrics.map((metric) => (
                <article key={metric.label} className="metric-card">
                  <p>{metric.label}</p>
                  <strong>{metric.value}</strong>
                </article>
              ))}
            </section>

            <section className="panel-grid panel-chart-grid">
              <article className="highlight-card chart-card">
                <div className="section-header compact-section-header">
                  <div>
                    <p className="eyebrow">Horas previstas</p>
                    <h3>Carga por setor</h3>
                  </div>
                </div>
                <div className="mini-chart">
                  {workloadBySectorChart.length > 0 ? (
                    workloadBySectorChart.map((item) => {
                      const maxValue = workloadBySectorChart[0]?.value ?? 1
                      return (
                        <div key={item.label} className="mini-chart-row">
                          <div className="mini-chart-labels">
                            <strong>{item.label}</strong>
                            <span>{item.displayValue}</span>
                          </div>
                          <div className="mini-chart-track">
                            <div
                              className="mini-chart-bar"
                              style={{ width: `${Math.max((item.value / maxValue) * 100, 8)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="section-note">Sem dados no periodo filtrado.</p>
                  )}
                </div>
              </article>

              <article className="highlight-card chart-card">
                <div className="section-header compact-section-header">
                  <div>
                    <p className="eyebrow">Custo previsto</p>
                    <h3>Extras por setor</h3>
                  </div>
                </div>
                <div className="mini-chart">
                  {extrasBySectorChart.length > 0 ? (
                    extrasBySectorChart.map((item) => {
                      const maxValue = extrasBySectorChart[0]?.value ?? 1
                      return (
                        <div key={item.label} className="mini-chart-row">
                          <div className="mini-chart-labels">
                            <strong>{item.label}</strong>
                            <span>{item.displayValue}</span>
                          </div>
                          <div className="mini-chart-track">
                            <div
                              className="mini-chart-bar accent"
                              style={{ width: `${Math.max((item.value / maxValue) * 100, 8)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="section-note">Sem extras no periodo filtrado.</p>
                  )}
                </div>
              </article>

              <article className="highlight-card chart-card">
                <div className="section-header compact-section-header">
                  <div>
                    <p className="eyebrow">Acessos</p>
                    <h3>Usuarios por perfil</h3>
                  </div>
                </div>
                <div className="mini-chart">
                  {usersByProfileChart.length > 0 ? (
                    usersByProfileChart.map((item) => {
                      const maxValue = usersByProfileChart[0]?.value ?? 1
                      return (
                        <div key={item.label} className="mini-chart-row">
                          <div className="mini-chart-labels">
                            <strong>{item.label}</strong>
                            <span>{item.displayValue}</span>
                          </div>
                          <div className="mini-chart-track">
                            <div
                              className="mini-chart-bar neutral"
                              style={{ width: `${Math.max((item.value / maxValue) * 100, 8)}%` }}
                            />
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="section-note">Nenhum usuario cadastrado.</p>
                  )}
                </div>
              </article>
            </section>

            <section className="section-card reports-hub">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Relatorios</p>
                  <h2>Centro de relatorios</h2>
                </div>
                <div className="report-actions">
                  <button type="button" className="secondary-button" onClick={exportReportToXlsx}>
                    Exportar XLSX
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openReportPrintView('pdf')}
                  >
                    Exportar PDF
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => openReportPrintView('print')}
                  >
                    Imprimir
                  </button>
                </div>
              </div>

              <div className="form-grid report-filter-grid">
                <label>
                  Relatorio
                  <select
                    value={selectedReportId}
                    onChange={(event) => setSelectedReportId(event.target.value as ReportId)}
                  >
                    {reportOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Inicio do periodo
                  <input
                    type="date"
                    value={reportStartDate}
                    onChange={(event) => setReportStartDate(event.target.value)}
                  />
                </label>
                <label>
                  Fim do periodo
                  <input
                    type="date"
                    value={reportEndDate}
                    onChange={(event) => setReportEndDate(event.target.value)}
                  />
                </label>
                <div className="report-sector-row">
                  <label>
                    Setor
                    <select
                      value={reportSectorFilter}
                      onChange={(event) => setReportSectorFilter(event.target.value)}
                    >
                      {reportSectorOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-actions report-filter-actions">
                    <button type="button" className="secondary-button" onClick={resetReportTablePreferences}>
                      Restaurar tabela
                    </button>
                  </div>
                </div>
              </div>

              <div className="report-summary-grid">
                {activeReportDataset.summary.map((item) => (
                  <article key={item.label} className="metric-card report-summary-card">
                    <p>{item.label}</p>
                    <strong>{item.value}</strong>
                  </article>
                ))}
              </div>

              {hiddenReportColumns.length > 0 ? (
                <div className="report-hidden-columns">
                  <span className="field-title">Colunas ocultas</span>
                  <div className="report-hidden-column-list">
                    {hiddenReportColumns.map((column) => (
                      <button
                        key={column.key}
                        type="button"
                        className="secondary-button report-hidden-column-chip"
                        onClick={() => showReportColumn(column.key)}
                      >
                        {column.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="report-table-wrap">
                <table className="report-table">
                  <thead>
                    <tr>
                      {visibleReportColumns.map((column) => (
                        <th
                          key={column.key}
                          className={[
                            column.align ? `align-${column.align}` : '',
                            openReportColumnMenu === column.key ? 'menu-open' : '',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <div className="report-column-header">
                            <span>{column.label}</span>
                            <div className="report-column-header-actions">
                              {(activeReportColumnFilters[column.key] ?? []).length > 0 ? (
                                <span className="report-column-filter-count">
                                  {(activeReportColumnFilters[column.key] ?? []).length}
                                </span>
                              ) : null}
                              <button
                                type="button"
                                className="report-column-menu-button"
                                onClick={() =>
                                  setOpenReportColumnMenu((current) =>
                                    current === column.key ? null : column.key,
                                  )
                                }
                                aria-label={`Filtrar coluna ${column.label}`}
                                title={`Filtrar coluna ${column.label}`}
                              >
                                ▼
                              </button>
                            </div>
                            {openReportColumnMenu === column.key ? (
                              <div className="report-column-menu">
                                <div className="report-column-menu-actions">
                                  <button
                                    type="button"
                                    className="ghost-button"
                                    onClick={() => clearReportColumnFilter(column.key)}
                                  >
                                    limpar
                                  </button>
                                  <button
                                    type="button"
                                    className="ghost-button"
                                    onClick={() => {
                                      toggleReportColumnVisibility(column.key)
                                      setOpenReportColumnMenu(null)
                                    }}
                                  >
                                    ocultar
                                  </button>
                                </div>
                                <div className="report-column-menu-list">
                                  {reportColumnDistinctValues[column.key].map((value) => {
                                    const checked = (activeReportColumnFilters[column.key] ?? []).includes(value)
                                    return (
                                      <label key={`${column.key}-${value}`} className="report-column-option">
                                        <span>{value || '(vazio)'}</span>
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => toggleReportColumnFilterValue(column.key, value)}
                                        />
                                      </label>
                                    )
                                  })}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportPreviewRows.length > 0 ? (
                      reportPreviewRows.map((row, index) => (
                        <tr
                          key={`${activeReportDataset.id}-${index}`}
                          className={
                            activeReportDataset.id === 'scale-irregularities' ? 'report-row-alert' : ''
                          }
                        >
                          {visibleReportColumns.map((column) => (
                            <td
                              key={`${activeReportDataset.id}-${index}-${column.key}`}
                              className={column.align ? `align-${column.align}` : ''}
                            >
                              {String(row[column.key] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={visibleReportColumns.length}>Nenhum dado encontrado para este relatorio.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="section-note">
                {filteredReportRows.length} linha(s) apos os filtros.
              </p>

              {filteredReportRows.length > reportPreviewRows.length ? (
                <p className="section-note">
                  Exibindo as primeiras {reportPreviewRows.length} linhas de {filteredReportRows.length}. Use a exportacao para obter o relatorio completo.
                </p>
              ) : null}
            </section>
          </>
        )}

        {activeSection === 'Empresa' && currentCompany && (
          <section className="section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Cadastro</p>
                <h2>Empresa</h2>
              </div>
              <div className="section-actions">
                {session.kind === 'systemAdmin' ? (
                  <>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => {
                        setCompanyForm(emptyCompanyForm)
                        setIsCompanyModalOpen(true)
                      }}
                    >
                      Nova empresa
                    </button>
                    <button
                      type="button"
                      className={currentCompany?.status === 'ATIVA' ? 'warning-button' : 'secondary-button'}
                      onClick={() => {
                        if (currentCompanyId !== null) {
                          toggleCompanyStatus(currentCompanyId)
                        }
                      }}
                    >
                      {currentCompany?.status === 'ATIVA' ? 'Inativar empresa' : 'Ativar empresa'}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => {
                        if (currentCompanyId !== null && currentCompany?.status === 'INATIVA') {
                          deleteCompany(currentCompanyId)
                        }
                      }}
                      disabled={currentCompany?.status !== 'INATIVA'}
                    >
                      Excluir empresa
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <form className="form-grid" onSubmit={(event) => submitCompany(event, 'update')}>
              <label>
                Nome fantasia
                <input
                  value={companyForm.tradeName}
                  onChange={(event) => setCompanyForm({ ...companyForm, tradeName: event.target.value })}
                />
              </label>
              <label>
                Razao social
                <input
                  value={companyForm.legalName}
                  onChange={(event) => setCompanyForm({ ...companyForm, legalName: event.target.value })}
                />
              </label>
              <label>
                CNPJ
                <input
                  value={companyForm.cnpj}
                  onChange={(event) =>
                    setCompanyForm({ ...companyForm, cnpj: formatCnpj(event.target.value) })
                  }
                />
              </label>
              <label>
                CEP
                <input
                  value={companyForm.zipCode}
                  onChange={(event) => changeCompanyZipCode(event.target.value)}
                />
              </label>
              <div className="field-span helper-banner">{zipCodeFeedback || 'Digite o CEP para sugerir o logradouro.'}</div>
              <label>
                Logradouro
                <input
                  value={companyForm.street}
                  onChange={(event) => setCompanyForm({ ...companyForm, street: event.target.value })}
                />
              </label>
              <label>
                Numero
                <input
                  value={companyForm.number}
                  onChange={(event) => setCompanyForm({ ...companyForm, number: event.target.value })}
                />
              </label>
              <label>
                Complemento
                <input
                  value={companyForm.complement}
                  onChange={(event) => setCompanyForm({ ...companyForm, complement: event.target.value })}
                />
              </label>
              <label>
                Bairro
                <input
                  value={companyForm.district}
                  onChange={(event) => setCompanyForm({ ...companyForm, district: event.target.value })}
                />
              </label>
              <label>
                Estado
                <select
                  value={companyForm.state}
                  onChange={(event) => setCompanyForm({ ...companyForm, state: event.target.value })}
                >
                  <option value="">Selecione</option>
                  {brazilianStates.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cidade
                <input
                  value={companyForm.city}
                  onChange={(event) => setCompanyForm({ ...companyForm, city: event.target.value })}
                />
              </label>
              {companyAgreementField}
              <label>
                Perfil de aplicacao da CCT
                <select
                  value={currentCompany.collectiveProfile}
                  onChange={(event) =>
                    updateCompanyCollectiveProfile(
                      currentCompany.id,
                      event.target.value as CompanyRecord['collectiveProfile'],
                    )
                  }
                >
                  <option value="padrao">Padrao</option>
                  <option value="plano-saude">Empresa com plano de saude para intervalo ampliado</option>
                  <option value="regramento-especifico">Empresa habilitada no regramento especifico</option>
                </select>
              </label>
              <div className="form-actions">
                <button type="submit" className="primary-button">
                  Atualizar empresa
                </button>
              </div>
            </form>
          </section>
        )}

        {activeSection === 'Convencoes' && canManageData && (
          <section className="section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Norma coletiva</p>
                <h2>Convencoes</h2>
              </div>
              <p className="section-note">
                O cadastro abaixo alimenta o vinculo automatico da empresa por cidade e estado.
              </p>
            </div>

            {currentAgreement ? (
              <div className="legal-banner">
                <strong>CCT vinculada a empresa atual</strong>
                <ul>
                  <li>
                    {currentAgreement.name} - vigencia de {currentAgreement.validFrom} a {currentAgreement.validTo}
                  </li>
                  <li>
                    Base sindical: {currentAgreement.employeeUnion} x {currentAgreement.employerUnion}
                  </li>
                  <li>
                    Regras principais: intervalo padrao apos 6h de {currentAgreement.rules.standardMealBreakAfterSixHoursMinutes} min; jornada maxima parametrizada de {Math.floor(currentAgreement.rules.maxDailyMinutes / 60)}h; folgas com antecedencia minima de {currentAgreement.rules.rotatingDayOffNoticeDays} dias.
                  </li>
                </ul>
              </div>
            ) : (
              <div className="feedback error">
                Nenhuma convencao coletiva cadastrada cobre {currentCompany.city}/{currentCompany.state}.
              </div>
            )}

            <form className="form-grid" onSubmit={handleAgreementSubmit}>
              <label>
                Nome da convencao
                <input
                  value={agreementForm.name}
                  onChange={(event) => setAgreementForm({ ...agreementForm, name: event.target.value })}
                />
              </label>
              <label>
                Sindicato patronal
                <input
                  value={agreementForm.employerUnion}
                  onChange={(event) =>
                    setAgreementForm({ ...agreementForm, employerUnion: event.target.value })
                  }
                />
              </label>
              <label>
                Sindicato laboral
                <input
                  value={agreementForm.employeeUnion}
                  onChange={(event) =>
                    setAgreementForm({ ...agreementForm, employeeUnion: event.target.value })
                  }
                />
              </label>
              <label>
                Estado coberto
                <select
                  value={agreementForm.coveredState}
                  onChange={(event) =>
                    setAgreementForm({ ...agreementForm, coveredState: event.target.value })
                  }
                >
                  {brazilianStates.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cidade coberta
                <input
                  value={agreementForm.coveredCity}
                  onChange={(event) =>
                    setAgreementForm({ ...agreementForm, coveredCity: event.target.value })
                  }
                />
              </label>
              <label>
                Categoria
                <input
                  value={agreementForm.category}
                  onChange={(event) => setAgreementForm({ ...agreementForm, category: event.target.value })}
                />
              </label>
              <label>
                Vigencia inicial
                <input
                  type="date"
                  value={agreementForm.validFrom}
                  onChange={(event) => setAgreementForm({ ...agreementForm, validFrom: event.target.value })}
                />
              </label>
              <label>
                Vigencia final
                <input
                  type="date"
                  value={agreementForm.validTo}
                  onChange={(event) => setAgreementForm({ ...agreementForm, validTo: event.target.value })}
                />
              </label>
              <label>
                Fonte
                <input
                  value={agreementForm.sourceLabel}
                  onChange={(event) => setAgreementForm({ ...agreementForm, sourceLabel: event.target.value })}
                />
              </label>
              <label>
                Link da fonte
                <input
                  value={agreementForm.sourceUrl}
                  onChange={(event) => setAgreementForm({ ...agreementForm, sourceUrl: event.target.value })}
                />
              </label>
              <label>
                Intervalo apos 6h
                <input
                  value={agreementForm.standardMealBreakAfterSixHoursMinutes}
                  onChange={(event) =>
                    setAgreementForm({
                      ...agreementForm,
                      standardMealBreakAfterSixHoursMinutes: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Intervalo entre 4h e 6h
                <input
                  value={agreementForm.shortShiftBreakMinutes}
                  onChange={(event) =>
                    setAgreementForm({ ...agreementForm, shortShiftBreakMinutes: event.target.value })
                  }
                />
              </label>
              <label>
                Maximo padrao de intervalo
                <input
                  value={agreementForm.standardBreakMaxMinutes}
                  onChange={(event) =>
                    setAgreementForm({ ...agreementForm, standardBreakMaxMinutes: event.target.value })
                  }
                />
              </label>
              <label>
                Maximo com plano de saude
                <input
                  value={agreementForm.healthPlanBreakMaxMinutes}
                  onChange={(event) =>
                    setAgreementForm({
                      ...agreementForm,
                      healthPlanBreakMaxMinutes: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Minimo no regramento especifico
                <input
                  value={agreementForm.specialBreakMinMinutes}
                  onChange={(event) =>
                    setAgreementForm({ ...agreementForm, specialBreakMinMinutes: event.target.value })
                  }
                />
              </label>
              <label>
                Maximo no regramento especifico
                <input
                  value={agreementForm.specialBreakMaxMinutes}
                  onChange={(event) =>
                    setAgreementForm({ ...agreementForm, specialBreakMaxMinutes: event.target.value })
                  }
                />
              </label>
              <label>
                Jornada maxima diaria
                <input
                  value={agreementForm.maxDailyMinutes}
                  onChange={(event) =>
                    setAgreementForm({ ...agreementForm, maxDailyMinutes: event.target.value })
                  }
                />
              </label>
              <label>
                Limite diario no banco de horas
                <input
                  value={agreementForm.bankHoursMaxDailyMinutes}
                  onChange={(event) =>
                    setAgreementForm({
                      ...agreementForm,
                      bankHoursMaxDailyMinutes: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Antecedencia minima da escala de folgas
                <input
                  value={agreementForm.rotatingDayOffNoticeDays}
                  onChange={(event) =>
                    setAgreementForm({
                      ...agreementForm,
                      rotatingDayOffNoticeDays: event.target.value,
                    })
                  }
                />
              </label>
              <label className="toggle-field">
                <span>Permite 12x36</span>
                <input
                  type="checkbox"
                  checked={agreementForm.allowTwelveByThirtySix}
                  onChange={(event) =>
                    setAgreementForm({
                      ...agreementForm,
                      allowTwelveByThirtySix: event.target.checked,
                    })
                  }
                />
              </label>
              <label className="field-span">
                Observacoes
                <textarea
                  rows={5}
                  value={agreementForm.notes}
                  onChange={(event) => setAgreementForm({ ...agreementForm, notes: event.target.value })}
                />
              </label>
              <div className="form-actions agreement-form-actions">
                <button type="submit" className="primary-button">
                  {editingAgreementId === null ? 'Cadastrar convencao' : 'Salvar alteracoes da convencao'}
                </button>
              </div>
            </form>

            <div className="table-list">
              {agreements.map((item) => (
                <article key={item.id} className="list-row user-list-row">
                  <div className="user-row-header">
                    <div className="user-title-group">
                      <strong>{item.name}</strong>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => editAgreement(item.id)}
                      >
                        Editar
                      </button>
                      {isSystemAdmin ? (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => deleteAgreement(item.id)}
                        >
                          Excluir
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="row-meta user-row-meta">
                    <div className="user-meta-line">
                      <span><strong className="meta-label">Cidade/UF:</strong> {item.coveredCity}/{item.coveredState}</span>
                      <span><strong className="meta-label">Vigencia:</strong> {item.validFrom} a {item.validTo}</span>
                      <span><strong className="meta-label">Sindicato laboral:</strong> {item.employeeUnion}</span>
                      <span><strong className="meta-label">Sindicato patronal:</strong> {item.employerUnion}</span>
                      <span><strong className="meta-label">Categoria:</strong> {item.category}</span>
                      <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                        Fonte
                      </a>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeSection === 'Colaboradores' && canManageData && (
          <section className="section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Cadastro</p>
                <h2>Colaboradores</h2>
              </div>
              <p className="section-note">
                Os colaboradores exibidos abaixo pertencem apenas a {currentCompany?.tradeName}.
              </p>
            </div>

            <form className="form-grid" onSubmit={handleCollaboratorSubmit}>
              <label>
                CPF
                <input
                  placeholder="000.000.000-00"
                  value={collaboratorForm.cpf}
                  onChange={(event) => changeCollaboratorCpf(event.target.value)}
                />
              </label>
              <label>
                Nome completo
                <input
                  value={collaboratorForm.fullName}
                  onChange={(event) =>
                    setCollaboratorForm({ ...collaboratorForm, fullName: event.target.value })
                  }
                />
              </label>
              <label>
                Chave PIX
                <input
                  value={collaboratorForm.pixKey}
                  onChange={(event) =>
                    setCollaboratorForm({ ...collaboratorForm, pixKey: event.target.value })
                  }
                />
              </label>
              <label>
                Contato
                <input
                  value={collaboratorForm.contact}
                  onChange={(event) =>
                    setCollaboratorForm({ ...collaboratorForm, contact: event.target.value })
                  }
                />
              </label>

              {collaboratorLookupFeedback && (
                <div className="field-span helper-banner">{collaboratorLookupFeedback}</div>
              )}

              <div className="field-span">
                <span className="field-title">Vinculo</span>
                <div className="pill-row">
                  {collaboratorEmploymentTypes.map((employmentType) => (
                    <button
                      key={employmentType}
                      type="button"
                      className={
                        collaboratorForm.employmentType === employmentType ? 'pill active' : 'pill'
                      }
                      onClick={() => changeCollaboratorEmploymentType(employmentType)}
                    >
                      {employmentType}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-span">
                <div className="field-heading">
                  <span className="field-title">Funcao</span>
                  <span className="field-helper">
                    Selecionadas: {selectedFunctions.length}/{activeFunctionLimit}
                  </span>
                </div>
                <div className="selector-grid">
                  {availableFunctionNames.map((functionName) => (
                    <label key={functionName} className="checkbox-card">
                      <input
                        type="checkbox"
                        checked={selectedFunctions.includes(functionName)}
                        onChange={() => toggleCollaboratorFunction(functionName)}
                      />
                      <span>{functionName}</span>
                    </label>
                  ))}
                </div>
                {currentCollaboratorProfile?.knownFunctions.length ? (
                  <div className="field-helper">
                    Funcoes ja registradas para este CPF no web app: {currentCollaboratorProfile.knownFunctions.join(', ')}
                  </div>
                ) : null}
                <div className="inline-create">
                  <input
                    placeholder="Funcao nao encontrada? Digite o nome"
                    value={functionSuggestion}
                    onChange={(event) => setFunctionSuggestion(event.target.value)}
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openFunctionModal(functionSuggestion.trim())}
                  >
                    Cadastrar funcao
                  </button>
                </div>
              </div>

              {selectedFunctions.length > 1 && (
                <label className="field-span">
                  Funcao principal nesta empresa
                  <select
                    value={collaboratorForm.primaryFunction}
                    onChange={(event) =>
                      setCollaboratorForm({
                        ...collaboratorForm,
                        primaryFunction: event.target.value,
                      })
                    }
                  >
                    <option value="">Selecione a funcao base da escala</option>
                    {selectedFunctions.map((functionName) => (
                      <option key={functionName} value={functionName}>
                        {functionName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="form-actions collaborator-form-actions">
                <button type="submit" className="primary-button">
                  {currentCompanyCollaborator ? 'Atualizar colaborador' : 'Adicionar colaborador'}
                </button>
              </div>
            </form>

            <div className="table-list">
              {companyCollaborators.map((item) => (
                <article key={item.id} className="list-row user-list-row">
                  <div className="user-row-header">
                    <div className="user-title-group">
                      <strong>
                        {collaboratorProfiles.find((profile) => profile.cpf === item.cpf)?.fullName ?? item.cpf}
                      </strong>
                      <span className={item.isActive ? 'status-pill status-active' : 'status-pill status-inactive'}>
                        {item.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => editCollaborator(item.id)}
                      >
                        Editar
                      </button>
                      {canManageCollaboratorActivation ? (
                        <button
                          type="button"
                          className={item.isActive ? 'warning-button' : 'secondary-button'}
                          onClick={() => toggleCollaboratorActivation(item.id)}
                        >
                          {item.isActive ? 'Inativar' : 'Ativar'}
                        </button>
                      ) : null}
                      {isSystemAdmin ? (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => deleteCollaborator(item.id)}
                        >
                          Excluir
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="row-meta user-row-meta">
                    <div className="user-meta-line">
                      <span><strong className="meta-label">CPF:</strong> {item.cpf}</span>
                      <span><strong className="meta-label">Vinculo:</strong> {item.employmentType}</span>
                      <span><strong className="meta-label">Funcoes:</strong> {item.functions.join(', ')}</span>
                      <span><strong className="meta-label">Principal:</strong> {item.primaryFunction}</span>
                      <span>
                        <strong className="meta-label">Contato:</strong> {collaboratorProfiles.find((profile) => profile.cpf === item.cpf)?.contact ?? 'Contato pendente'}
                      </span>
                      <span>
                        <strong className="meta-label">PIX:</strong> {collaboratorProfiles.find((profile) => profile.cpf === item.cpf)?.pixKey ?? 'PIX pendente'}
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeSection === 'Funcoes' && canManageData && (
          <section className="section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Cadastro</p>
                <h2>Funcoes</h2>
              </div>
              <p className="section-note">
                As funcoes abaixo estao vinculadas apenas a {currentCompany?.tradeName}.
              </p>
            </div>
            <form className="form-grid" onSubmit={handleFunctionSubmit}>
              <label>
                Funcao
                <input
                  value={functionForm.name}
                  onChange={(event) => setFunctionForm({ ...functionForm, name: event.target.value })}
                />
              </label>
              <label>
                Setor
                <input
                  list="company-sector-options-main"
                  placeholder="Selecione ou digite um novo setor"
                  value={functionForm.sector}
                  onChange={(event) => setFunctionForm({ ...functionForm, sector: event.target.value })}
                />
              </label>
              <label>
                Base salarial
                <input
                  value={functionForm.baseSalary}
                  onChange={(event) =>
                    setFunctionForm({ ...functionForm, baseSalary: event.target.value })
                  }
                />
              </label>
              <label>
                Cota no servico
                <input
                  value={functionForm.serviceQuota}
                  onChange={(event) =>
                    setFunctionForm({ ...functionForm, serviceQuota: event.target.value })
                  }
                />
              </label>
              <label>
                Paga extra
                <input
                  placeholder="Valor pago ao colaborador Extra"
                  value={functionForm.extraPayValue}
                  onChange={(event) =>
                    setFunctionForm({ ...functionForm, extraPayValue: event.target.value })
                  }
                />
              </label>
              <label className="field-span">
                Descritivo
                <textarea
                  rows={5}
                  value={functionForm.description}
                  onChange={(event) =>
                    setFunctionForm({ ...functionForm, description: event.target.value })
                  }
                />
              </label>
              <div className="form-actions function-form-actions">
                <button type="submit" className="primary-button">
                  {editingFunctionId === null ? 'Adicionar funcao' : 'Salvar alteracoes da funcao'}
                </button>
              </div>
            </form>

            <datalist id="company-sector-options-main">
              {availableSectorNames.map((sectorName) => (
                <option key={sectorName} value={sectorName} />
              ))}
            </datalist>

            <div className="table-list">
              {companyFunctions.map((item) => (
                <article key={item.id} className="list-row user-list-row">
                  <div className="user-row-header">
                    <div className="user-title-group">
                      <strong>{item.name}</strong>
                      <span className={item.isActive ? 'status-pill status-active' : 'status-pill status-inactive'}>
                        {item.isActive ? 'Ativa' : 'Inativa'}
                      </span>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => editFunction(item.id)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className={item.isActive ? 'warning-button' : 'secondary-button'}
                        onClick={() => toggleFunctionActivation(item.id)}
                      >
                        {item.isActive ? 'Inativar' : 'Ativar'}
                      </button>
                      {(isSystemAdmin || session?.user.role === 'Gestor') ? (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => deleteFunction(item.id)}
                        >
                          Excluir
                        </button>
                      ) : null}
                    </div>
                  </div>
                  <div className="row-meta user-row-meta">
                    <div className="user-meta-line">
                      <span><strong className="meta-label">Setor:</strong> {item.sector}</span>
                      <span><strong className="meta-label">Salario:</strong> {formatCurrency(parseCurrencyValue(item.baseSalary || '0'))}</span>
                      <span><strong className="meta-label">Cota:</strong> {item.serviceQuota || 'Nao informada'}</span>
                      <span>
                        <strong className="meta-label">Pagamento extra:</strong>{' '}
                        {item.extraPayValue
                          ? formatCurrency(parseCurrencyValue(item.extraPayValue))
                          : 'Nao informado'}
                      </span>
                      <span><strong className="meta-label">Descricao:</strong> {item.description}</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeSection === 'Horarios' && canManageData && (
          <section className="section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Cadastro</p>
                <h2>Horarios</h2>
              </div>
              <p className="section-note">
                Os horarios validados aqui ficam disponiveis apenas para {currentCompany?.tradeName}.
              </p>
            </div>

            <form className="form-grid schedule-form" onSubmit={handleScheduleSubmit}>
                <label>
                  Turno
                  <input
                    placeholder="Ex.: Almoco executivo"
                    value={scheduleForm.shiftName}
                    onChange={(event) =>
                      setScheduleForm({ ...scheduleForm, shiftName: event.target.value })
                    }
                  />
                </label>
                <label>
                  Abreviacao
                  <input value={normalizeAbbreviation(scheduleForm.shiftName)} readOnly />
                </label>
                <label className="time-row">
                  Horario de inicio
                  <div className="time-control">
                    <input
                      placeholder="0000"
                      inputMode="numeric"
                      maxLength={5}
                      value={scheduleForm.startTime}
                      onChange={(event) => {
                        const normalized = normalizeTypedTime(
                          event.target.value,
                          scheduleForm.startPeriod,
                        )
                        setScheduleForm({
                          ...scheduleForm,
                          startTime: normalized.time,
                          startPeriod: normalized.period,
                        })
                      }}
                    />
                    <select
                      value={scheduleForm.startPeriod}
                      onChange={(event) =>
                        setScheduleForm({ ...scheduleForm, startPeriod: event.target.value as 'AM' | 'PM' })
                      }
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </label>
                <label className="time-row">
                  Inicio de pausa
                  <div className="time-control">
                    <input
                      placeholder="0000"
                      inputMode="numeric"
                      maxLength={5}
                      value={scheduleForm.breakStart}
                      onChange={(event) => {
                        const normalized = normalizeTypedTime(
                          event.target.value,
                          scheduleForm.breakStartPeriod,
                        )
                        setScheduleForm({
                          ...scheduleForm,
                          breakStart: normalized.time,
                          breakStartPeriod: normalized.period,
                        })
                      }}
                    />
                    <select
                      value={scheduleForm.breakStartPeriod}
                      onChange={(event) =>
                        setScheduleForm({
                          ...scheduleForm,
                          breakStartPeriod: event.target.value as 'AM' | 'PM',
                        })
                      }
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </label>
                <label className="time-row">
                  Fim de pausa
                  <div className="time-control">
                    <input
                      placeholder="0000"
                      inputMode="numeric"
                      maxLength={5}
                      value={scheduleForm.breakEnd}
                      onChange={(event) => {
                        const normalized = normalizeTypedTime(
                          event.target.value,
                          scheduleForm.breakEndPeriod,
                        )
                        setScheduleForm({
                          ...scheduleForm,
                          breakEnd: normalized.time,
                          breakEndPeriod: normalized.period,
                        })
                      }}
                    />
                    <select
                      value={scheduleForm.breakEndPeriod}
                      onChange={(event) =>
                        setScheduleForm({
                          ...scheduleForm,
                          breakEndPeriod: event.target.value as 'AM' | 'PM',
                        })
                      }
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </label>
                <label className="time-row">
                  Fim do turno
                  <div className="time-control">
                    <input
                      placeholder="0000"
                      inputMode="numeric"
                      maxLength={5}
                      value={scheduleForm.endTime}
                      onChange={(event) => {
                        const normalized = normalizeTypedTime(
                          event.target.value,
                          scheduleForm.endPeriod,
                        )
                        setScheduleForm({
                          ...scheduleForm,
                          endTime: normalized.time,
                          endPeriod: normalized.period,
                        })
                      }}
                    />
                    <select
                      value={scheduleForm.endPeriod}
                      onChange={(event) =>
                        setScheduleForm({ ...scheduleForm, endPeriod: event.target.value as 'AM' | 'PM' })
                      }
                    >
                      <option value="AM">AM</option>
                      <option value="PM">PM</option>
                    </select>
                  </div>
                </label>

              <div className="field-span helper-banner live-metric">
                <strong>Horas trabalhadas calculadas em tempo real</strong>
                <span>{liveWorkedMinutes !== undefined ? formatWorkedHours(liveWorkedMinutes) : '--:--'}</span>
                {liveSchedulePreview.issues.length > 0 ? (
                  <ul>
                    {liveSchedulePreview.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : (
                  <small>Preencha os quatro horarios para liberar o calculo da jornada liquida.</small>
                )}
              </div>

              <div className="form-actions schedule-form-actions">
                <button type="submit" className="primary-button">
                  {editingScheduleId === null ? 'Validar e adicionar horario' : 'Salvar alteracoes do horario'}
                </button>
              </div>

              {scheduleFeedback && (
                <div className={`field-span ${scheduleFeedback.valid ? 'feedback success' : 'feedback error'}`}>
                  <strong>{scheduleFeedback.valid ? 'Horario salvo' : 'Horario nao salvo'}</strong>
                  {scheduleFeedback.errors.length > 0 && (
                    <ul>
                      {scheduleFeedback.errors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  )}
                  {scheduleFeedback.notes.length > 0 && (
                    <ul>
                      {scheduleFeedback.notes.map((note) => (
                        <li key={note}>{note}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </form>

            <div className="rules-grid">
              <div className="legal-banner warning">
                <strong>Regras aplicadas neste cadastro</strong>
                <ul>
                  {scheduleRules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
              </div>

              <div className="legal-banner">
                <strong>Boas praticas de preenchimento</strong>
                <ul>
                  <li>Use nomes de turno curtos e distintos. A abreviacao sempre sera gerada com 3 letras.</li>
                  <li>Digite sempre 4 numeros por horario, sem pontuacao. O app aplica a mascara hh:mm.</li>
                  <li>Ao completar 4 numeros, o sistema identifica automaticamente AM ou PM e ajusta o horario exibido no campo.</li>
                  <li>AM cobre horarios entre 00:01 e 12:00. PM cobre horarios entre 12:01 e 24:00.</li>
                  <li>Preencha os horarios em sequencia cronologica para reduzir erro operacional.</li>
                  <li>Valide primeiro o turno padrao da casa e depois cadastre variacoes.</li>
                </ul>
              </div>
            </div>

            <div className="legal-banner warning">
              <strong>Base juridica visivel</strong>
              <ul>
                <li>CLT arts. 58, 59, 66 e 71 para jornada, compensacao, descanso e intervalo.</li>
                <li>Cidade da empresa usada para localizar automaticamente a CCT cadastrada.</li>
                <li>O perfil de aplicacao da empresa altera a regra de intervalo quando a CCT permite.</li>
              </ul>
            </div>

            {scheduleFeedback && (
              <div className={scheduleFeedback.valid ? 'feedback success' : 'feedback error'}>
                <strong>{scheduleFeedback.valid ? 'Horario salvo' : 'Horario nao salvo'}</strong>
                {scheduleFeedback.errors.length > 0 && (
                  <ul>
                    {scheduleFeedback.errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}
                {scheduleFeedback.notes.length > 0 && (
                  <ul>
                    {scheduleFeedback.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="section-header compact-header">
              <div>
                <p className="eyebrow">Gestao</p>
                <h3>Horarios ja cadastrados</h3>
              </div>
              <p className="section-note">
                Revise antes de cadastrar um novo turno para evitar duplicidade.
              </p>
            </div>

            {companySchedules.length === 0 ? (
              <div className="empty-state">
                Nenhum horario cadastrado ainda para esta empresa.
              </div>
            ) : (
              <div className="table-list">
                {companySchedules.map((item) => (
                  <article key={item.id} className="list-row">
                    <div className="schedule-summary">
                      <div className="schedule-summary-header">
                        <strong>
                          {item.shiftName} ({item.abbreviation})
                        </strong>
                        <span className={item.isActive ? 'status-pill status-active' : 'status-pill status-inactive'}>
                          {item.isActive ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="schedule-summary-times">
                        <p className="schedule-summary-line">
                          Entrada: {item.startTime} {item.startPeriod} | Pausa: {item.breakStart}{' '}
                          {item.breakStartPeriod}
                        </p>
                        <p className="schedule-summary-line">
                          Retorno: {item.breakEnd} {item.breakEndPeriod} | Saida: {item.endTime}{' '}
                          {item.endPeriod}
                        </p>
                        <p className="schedule-summary-line">
                          Horas trabalhadas: {formatWorkedHours(item.netMinutes)}
                        </p>
                      </div>
                    </div>
                    <div className="row-meta">
                      <div className="row-actions">
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => editSchedule(item.id)}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className={item.isActive ? 'warning-button' : 'secondary-button'}
                          onClick={() => toggleScheduleActivation(item.id)}
                        >
                          {item.isActive ? 'Inativar' : 'Ativar'}
                        </button>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => deleteSchedule(item.id)}
                        >
                          Excluir
                        </button>
                      </div>
                      <div className="schedule-validation">
                        <span>{item.validationMessage}</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}

          </section>
        )}

        {activeSection === 'Escala' && currentCompany && (
          <section
            className={
              printIncludeExtras
                ? 'section-card print-scale-section print-with-extras'
                : 'section-card print-scale-section'
            }
          >
            <div className="section-header no-print">
              <div>
                <p className="eyebrow">Operacao</p>
                <h2>Escala</h2>
              </div>
            </div>

            {!canViewScale ? (
              <div className="feedback error">
                <strong>Perfil sem acesso a este painel.</strong>
                <ul>
                  <li>O painel de escala fica disponivel para `master`, `Administrativo` e `Gestor`.</li>
                </ul>
              </div>
            ) : isViewer && currentViewerCollaborator === null ? (
              <div className="feedback error">
                <strong>Visualizador sem colaborador vinculado.</strong>
                <ul>
                  <li>Associe este usuario a um colaborador cadastrado no painel `Usuarios`.</li>
                </ul>
              </div>
            ) : (
              <>
                <div className="scale-toolbar no-print">
                  <label>
                    Visualizacao
                    <select
                      value={scaleViewMode}
                      onChange={(event) => setScaleViewMode(event.target.value as ScaleViewMode)}
                    >
                      <option value="week">Semana</option>
                      <option value="month">Mes</option>
                    </select>
                  </label>
                  {scaleViewMode === 'week' ? (
                    <label>
                      Semana de referencia
                      <input
                        type="date"
                        value={scaleAnchorDate}
                        onChange={(event) => {
                          setScaleAnchorDate(event.target.value)
                          setScaleMonth(event.target.value.slice(0, 7))
                        }}
                      />
                    </label>
                  ) : (
                    <>
                      <label>
                        Data de referencia do mes
                        <input
                          type="date"
                          value={`${scaleMonth}-01`}
                          onChange={(event) => setScaleMonth(event.target.value.slice(0, 7))}
                        />
                      </label>
                      <label>
                        Mes de referencia
                        <input value={getMonthLabel(scaleMonth)} readOnly />
                      </label>
                    </>
                  )}
                  <label>
                    Setor
                    <select
                      value={effectiveScaleSectorFilter}
                      onChange={(event) => setScaleSectorFilter(event.target.value)}
                    >
                      {scaleSectorOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="scale-toolbar-actions">
                    <button
                      type="button"
                      className={[
                        'ghost-button',
                        'notification-button',
                        scaleNotificationItems.length > 0 ? 'has-notifications' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => setIsNotificationModalOpen(true)}
                      aria-label={`Notificacoes${scaleNotificationItems.length > 0 ? `: ${scaleNotificationItems.length}` : ''}`}
                      title={`Notificacoes${scaleNotificationItems.length > 0 ? `: ${scaleNotificationItems.length}` : ''}`}
                    >
                      <span aria-hidden="true">🔔</span>
                      {scaleNotificationItems.length > 0 ? (
                        <span className="notification-badge">
                          {scaleNotificationItems.length}
                        </span>
                      ) : null}
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setIsPrintModalOpen(true)}
                    >
                      Imprimir
                    </button>
                  </div>
                </div>

                {scaleViewMode === 'month' ? (
                  <div className="helper-banner field-span no-print">
                    Exibindo {getMonthLabel(scaleMonth)} em blocos semanais sucessivos.
                  </div>
                ) : null}

                <div className="print-only print-summary no-print">
                  <strong>{currentCompany.tradeName}</strong>
                  <span>
                    {scaleViewMode === 'month'
                      ? `Escala mensal de ${getMonthLabel(scaleMonth)}`
                      : `Escala semanal de ${formatWeekLabel(scaleWeeks[0] ?? getWeekDates(scaleAnchorDate))}`}
                  </span>
                  {effectiveScaleSectorFilter !== 'Todos' ? (
                    <span>Setor: {effectiveScaleSectorFilter}</span>
                  ) : null}
                </div>

                <div className="scale-stack">
                  {scaleWeeks.map((weekDates) => {
                    const weekStartValue = toIsoDate(weekDates[0])
                    const monthReference = scaleViewMode === 'month' ? scaleMonth : weekStartValue.slice(0, 7)
                    const autoRows = visibleScaleCollaborators.filter((item) => {
                      if (item.employmentType === 'EXTRA') {
                        return false
                      }

                      return weekDates.some((date) => isCollaboratorActiveOnDate(item, toIsoDate(date)))
                    })
                    const extraRows = companyScaleExtraRoster
                      .filter((item) => item.weekStart === weekStartValue)
                      .map((item) => visibleScaleCollaborators.find((collaborator) => collaborator.id === item.collaboratorId) ?? null)
                      .filter(
                        (item): item is CollaboratorRecord =>
                          item !== null &&
                          weekDates.some((date) => isCollaboratorActiveOnDate(item, toIsoDate(date))),
                      )
                    const weekRows = [...autoRows, ...extraRows]
                    const dayExtraCosts = weekDates.map((date) => {
                      const isoDate = toIsoDate(date)
                      return weekRows.reduce((sum, collaborator) => {
                        if (collaborator.employmentType !== 'EXTRA') {
                          return sum
                        }

                        const assignment = getAssignmentForDay(collaborator.id, isoDate)
                        if (!assignment) {
                          return sum
                        }

                        const extraPayValue = getFunctionByName(collaborator.primaryFunction)?.extraPayValue ?? ''
                        return sum + parseCurrencyValue(extraPayValue)
                      }, 0)
                    })

                    return (
                      <section key={weekStartValue} className="scale-week-card">
                        <div className="scale-week-header">
                          <div>
                            <p className="eyebrow">Semana</p>
                            <h3>{formatWeekLabel(weekDates)}</h3>
                          </div>
                          <div className="scale-week-meta">
                            <span>{weekRows.length} linhas visiveis</span>
                          </div>
                        </div>

                        <div className="scale-grid-wrap">
                          <table className="scale-grid">
                            <tbody>
                              {Array.from(new Set(weekRows.map((item) => getCollaboratorSector(item)).filter(Boolean)))
                                .sort((left, right) => left.localeCompare(right))
                                .map((sectorName) => {
                                  const sectorRows = weekRows.filter(
                                    (item) => getCollaboratorSector(item) === sectorName,
                                  )
                                  const functionNames = Array.from(
                                    new Set(sectorRows.map((item) => item.primaryFunction).filter(Boolean)),
                                  ).sort((left, right) => left.localeCompare(right))

                                  return (
                                    <Fragment key={`${weekStartValue}-${sectorName}`}>
                                      <tr key={`${weekStartValue}-${sectorName}-sector`} className="scale-group-row">
                                        <td className="scale-sticky-cell">
                                          <strong>Setor: {sectorName}</strong>
                                        </td>
                                        {weekDates.map((date) => (
                                          <td
                                            key={`${weekStartValue}-${sectorName}-sector-${toIsoDate(date)}`}
                                            className={[
                                              scaleViewMode === 'month' &&
                                              toIsoDate(date).slice(0, 7) !== monthReference
                                                ? 'muted-cell'
                                                : '',
                                              toIsoDate(date) < todayIso ? 'past-day-cell' : '',
                                            ]
                                              .filter(Boolean)
                                              .join(' ')}
                                          />
                                        ))}
                                        <td className="no-print" />
                                      </tr>

                                      {functionNames.map((functionName) => {
                                        const functionRows = sectorRows.filter(
                                          (item) => item.primaryFunction === functionName,
                                        )

                                        return (
                                          <Fragment key={`${weekStartValue}-${sectorName}-${functionName}`}>
                                            <tr
                                              key={`${weekStartValue}-${sectorName}-${functionName}-function`}
                                              className="scale-subgroup-row"
                                            >
                                              <td className="scale-sticky-cell">
                                                <strong>Funcao: {functionName}</strong>
                                              </td>
                                              {weekDates.map((date) => (
                                                <td
                                                  key={`${weekStartValue}-${sectorName}-${functionName}-${toIsoDate(date)}`}
                                                  className={[
                                                    scaleViewMode === 'month' &&
                                                    toIsoDate(date).slice(0, 7) !== monthReference
                                                      ? 'muted-cell'
                                                      : '',
                                                    toIsoDate(date) < todayIso ? 'past-day-cell' : '',
                                                  ]
                                                    .filter(Boolean)
                                                    .join(' ')}
                                                />
                                              ))}
                                              <td className="no-print" />
                                            </tr>

                                            {scaleEmploymentOrder.map((employmentType) => {
                                              const statusRows = functionRows.filter(
                                                (item) => item.employmentType === employmentType,
                                              )
                                              const extraSearchKey = `${weekStartValue}:${sectorName}:${functionName}`
                                              const extraSearch = extraSearchByWeek[extraSearchKey] ?? ''
                                              const filteredExtraCandidates =
                                                employmentType === 'EXTRA' && canEditScale
                                                  ? visibleScaleExtras.filter((item) => {
                                                      if (extraSearch.trim().length === 0) {
                                                        return false
                                                      }

                                                      const alreadyAdded = statusRows.some((row) => row.id === item.id)
                                                      if (alreadyAdded) {
                                                        return false
                                                      }

                                                      if (
                                                        getCollaboratorSector(item) !== sectorName ||
                                                        item.primaryFunction !== functionName
                                                      ) {
                                                        return false
                                                      }

                                                      if (!weekDates.some((date) => isCollaboratorActiveOnDate(item, toIsoDate(date)))) {
                                                        return false
                                                      }

                                                      const profile = getCollaboratorProfile(item.cpf)
                                                      const candidateText = [
                                                        profile?.fullName ?? '',
                                                        item.cpf,
                                                        item.primaryFunction,
                                                        getCollaboratorSector(item),
                                                      ]
                                                        .join(' ')
                                                        .toLowerCase()

                                                      return candidateText.includes(extraSearch.toLowerCase())
                                                    })
                                                  : []
                                              const extraCandidateOptions = filteredExtraCandidates.map((item) => {
                                                const profile = getCollaboratorProfile(item.cpf)
                                                return {
                                                  id: item.id,
                                                  label: `${profile?.fullName ?? item.cpf} • ${item.cpf}`,
                                                  helper: item.primaryFunction,
                                                }
                                              })
                                              const hasScheduledExtras = statusRows.length > 0

                                              const shouldRenderStatusBlock =
                                                employmentType === 'EXTRA'
                                                  ? canEditScale || hasScheduledExtras
                                                  : statusRows.length > 0

                                              if (!shouldRenderStatusBlock) {
                                                return null
                                              }

                                              return (
                                                <Fragment
                                                  key={`${weekStartValue}-${sectorName}-${functionName}-${employmentType}`}
                                                >
                                                  <tr
                                                    key={`${weekStartValue}-${sectorName}-${functionName}-${employmentType}-status`}
                                                    className={
                                                      employmentType === 'EXTRA'
                                                        ? statusRows.length > 0
                                                          ? 'scale-status-row print-extra-optional'
                                                          : 'scale-status-row print-extra-optional no-print'
                                                        : 'scale-status-row'
                                                    }
                                                  >
                                                    <td className="scale-sticky-cell">
                                                      <strong>{employmentType}</strong>
                                                    </td>
                                                    {weekDates.map((date) => (
                                                      <td
                                                        key={`${weekStartValue}-${sectorName}-${functionName}-${employmentType}-${toIsoDate(date)}`}
                                                        className={[
                                                          scaleViewMode === 'month' &&
                                                          toIsoDate(date).slice(0, 7) !== monthReference
                                                            ? 'muted-cell'
                                                            : '',
                                                          toIsoDate(date) < todayIso ? 'past-day-cell' : '',
                                                        ]
                                                          .filter(Boolean)
                                                          .join(' ')}
                                                      >
                                                        <strong>{formatDayHeader(date)}</strong>
                                                      </td>
                                                    ))}
                                                    <td className="no-print">
                                                      <strong>Total semana</strong>
                                                    </td>
                                                  </tr>

                                                  {statusRows.map((collaborator) => {
                                                    const profile = getCollaboratorProfile(collaborator.cpf)
                                                    const rowAssignments = getWeeklyRowAssignments(collaborator, weekDates)
                                                    const rowValidation = validateScaleRow(collaborator, weekDates)
                                                    const extraPayValue = parseCurrencyValue(
                                                      getFunctionByName(collaborator.primaryFunction)?.extraPayValue ?? '',
                                                    )
                                                    const hasIssues = rowValidation.issues.length > 0
                                                    const stripedClass = statusRows.findIndex((item) => item.id === collaborator.id) % 2 === 0
                                                      ? 'scale-row even'
                                                      : 'scale-row odd'

                                                    return (
                                                      <tr
                                                        key={`${weekStartValue}-${collaborator.id}`}
                                                        className={
                                                          collaborator.employmentType === 'EXTRA'
                                                            ? hasIssues
                                                              ? `${stripedClass} irregular print-extra-optional`
                                                              : `${stripedClass} print-extra-optional`
                                                            : hasIssues
                                                              ? `${stripedClass} irregular`
                                                              : stripedClass
                                                        }
                                                      >
                                                        <td className="scale-sticky-cell scale-person-cell">
                                                          <div className="scale-person-card">
                                                            <div className="scale-person-header">
                                                              <strong className="scale-print-name">
                                                                {getShortDisplayName(
                                                                  profile?.fullName ?? collaborator.cpf
                                                                )}
                                                              </strong>
                                                              {collaborator.employmentType === 'EXTRA' && canEditScale ? (
                                                                <button
                                                                  type="button"
                                                                  className="scale-remove-extra"
                                                                  aria-label="Remover colaborador extra"
                                                                  title="Remover EXTRA desta semana"
                                                                  onClick={() =>
                                                                    removeExtraFromWeek(weekStartValue, collaborator.id)
                                                                  }
                                                                >
                                                                  x
                                                                </button>
                                                              ) : null}
                                                            </div>
                                                            {hasIssues ? <small>{rowValidation.issues[0]}</small> : null}
                                                          </div>
                                                        </td>
                                                        {rowAssignments.map((entry) => (
                                                          <td
                                                            key={`${collaborator.id}-${entry.date}`}
                                                            className={[
                                                              scaleViewMode === 'month' &&
                                                              entry.date.slice(0, 7) !== monthReference
                                                                ? 'muted-cell'
                                                                : '',
                                                              entry.date < todayIso ? 'past-day-cell' : '',
                                                            ]
                                                              .filter(Boolean)
                                                              .join(' ')}
                                                          >
                                                            {(() => {
                                                              const collaboratorActiveOnDate = isCollaboratorActiveOnDate(
                                                                collaborator,
                                                                entry.date,
                                                              )
                                                              const scheduleActiveOnDate = isScheduleActiveOnDate(
                                                                entry.schedule,
                                                                entry.date,
                                                              )
                                                              const scheduleChoices = getScaleSchedulesForDate(
                                                                entry.date,
                                                                entry.assignment?.scheduleId,
                                                              )
                                                              const commentThread = getScaleCommentThread(
                                                                collaborator.id,
                                                                entry.date,
                                                              )
                                                              const hasInactiveScheduleSelection =
                                                                !!entry.schedule && !scheduleActiveOnDate

                                                              return (
                                                                <div className="scale-day-cell">
                                                                  {entry.schedule ? (
                                                                    <div className="scale-time-detail">
                                                                      <div className="scale-time-select-block">
                                                                        <select
                                                                          className={[
                                                                            collaborator.employmentType === 'EXTRA'
                                                                              ? 'scale-day-select extra-select'
                                                                              : 'scale-day-select',
                                                                            hasInactiveScheduleSelection ? 'stale-selection' : '',
                                                                          ]
                                                                            .filter(Boolean)
                                                                            .join(' ')}
                                                                          value={entry.assignment?.scheduleId ?? ''}
                                                                          onChange={(event) =>
                                                                            updateScaleAssignment(
                                                                              collaborator,
                                                                              entry.date,
                                                                              event.target.value,
                                                                              weekDates,
                                                                            )
                                                                          }
                                                                          disabled={
                                                                            !canEditScale ||
                                                                            !collaboratorActiveOnDate ||
                                                                            (!isSystemAdmin && entry.date < todayIso) ||
                                                                            (scaleViewMode === 'month' &&
                                                                              entry.date.slice(0, 7) !== monthReference)
                                                                          }
                                                                        >
                                                                          <option value="">
                                                                            Folga
                                                                          </option>
                                                                          {scheduleChoices.map((schedule) => (
                                                                            <option key={schedule.id} value={schedule.id}>
                                                                              {schedule.abbreviation}
                                                                            </option>
                                                                          ))}
                                                                        </select>
                                                                        {collaborator.employmentType === 'EXTRA' && canEditScale ? (
                                                                          <span className="no-print">{formatCurrency(extraPayValue)}</span>
                                                                        ) : null}
                                                                      </div>
                                                                      <div>
                                                                        <small>Entrada</small>
                                                                        <span>
                                                                          {entry.schedule.startTime} {entry.schedule.startPeriod}
                                                                        </span>
                                                                      </div>
                                                                      <div>
                                                                        <small>Pausa</small>
                                                                        <span>
                                                                          {entry.schedule.breakStart} {entry.schedule.breakStartPeriod}
                                                                        </span>
                                                                      </div>
                                                                      <div>
                                                                        <small>Retorno</small>
                                                                        <span>
                                                                          {entry.schedule.breakEnd} {entry.schedule.breakEndPeriod}
                                                                        </span>
                                                                      </div>
                                                                      <div>
                                                                        <small>Saida</small>
                                                                        <span>
                                                                          {entry.schedule.endTime} {entry.schedule.endPeriod}
                                                                        </span>
                                                                      </div>
                                                                      <div className="scale-time-total no-print">
                                                                        <small>Horas</small>
                                                                        <span>
                                                                          {formatWorkedHours(entry.workedMinutes)}
                                                                        </span>
                                                                      </div>
                                                                      <button
                                                                        type="button"
                                                                        className={[
                                                                          'ghost-button',
                                                                          'scale-comment-button',
                                                                          commentThread?.messages.length ? 'has-comments' : '',
                                                                          'no-print',
                                                                        ]
                                                                          .filter(Boolean)
                                                                          .join(' ')}
                                                                        onClick={() =>
                                                                          openScaleCommentModal(collaborator.id, entry.date)
                                                                        }
                                                                        aria-label={
                                                                          commentThread?.messages.length
                                                                            ? `${commentThread.messages.length} comentario${commentThread.messages.length > 1 ? 's' : ''}`
                                                                            : 'Adicionar comentario'
                                                                        }
                                                                        title={
                                                                          commentThread?.messages.length
                                                                            ? `${commentThread.messages.length} comentario${commentThread.messages.length > 1 ? 's' : ''}`
                                                                            : 'Adicionar comentario'
                                                                        }
                                                                      >
                                                                        <span className="scale-comment-icon" aria-hidden="true">
                                                                          ✉
                                                                        </span>
                                                                        {commentThread?.messages.length ? (
                                                                          <span className="scale-comment-count">
                                                                            {commentThread.messages.length}
                                                                          </span>
                                                                        ) : null}
                                                                      </button>
                                                                    </div>
                                                                  ) : (
                                                                    <div className="scale-day-entry-row">
                                                                      <select
                                                                        className={[
                                                                          collaborator.employmentType === 'EXTRA'
                                                                            ? 'scale-day-select extra-select'
                                                                            : 'scale-day-select',
                                                                          hasInactiveScheduleSelection ? 'stale-selection' : '',
                                                                        ]
                                                                          .filter(Boolean)
                                                                          .join(' ')}
                                                                        value={entry.assignment?.scheduleId ?? ''}
                                                                        onChange={(event) =>
                                                                          updateScaleAssignment(
                                                                            collaborator,
                                                                            entry.date,
                                                                            event.target.value,
                                                                            weekDates,
                                                                          )
                                                                        }
                                                                        disabled={
                                                                          !canEditScale ||
                                                                          !collaboratorActiveOnDate ||
                                                                          (!isSystemAdmin && entry.date < todayIso) ||
                                                                          (scaleViewMode === 'month' &&
                                                                            entry.date.slice(0, 7) !== monthReference)
                                                                        }
                                                                      >
                                                                        <option value="">
                                                                          Folga
                                                                        </option>
                                                                        {scheduleChoices.map((schedule) => (
                                                                          <option key={schedule.id} value={schedule.id}>
                                                                            {schedule.abbreviation}
                                                                          </option>
                                                                        ))}
                                                                      </select>
                                                                    </div>
                                                                  )}
                                                                  {!isViewer && !collaboratorActiveOnDate ? (
                                                                    <small className="scale-inline-warning no-print">
                                                                      Colaborador inativo nesta data
                                                                    </small>
                                                                  ) : null}
                                                                  {!isViewer && hasInactiveScheduleSelection ? (
                                                                    <small className="scale-inline-warning no-print">
                                                                      Horario inativo nesta data
                                                                    </small>
                                                                  ) : null}
                                                                </div>
                                                              )
                                                            })()}
                                                          </td>
                                                        ))}
                                                        <td className="scale-total-cell no-print">
                                                          <strong>{formatWorkedHours(rowValidation.totalMinutes)}</strong>
                                                        </td>
                                                      </tr>
                                                    )
                                                  })}

                                                  {employmentType === 'EXTRA' && canEditScale ? (
                                                    <tr
                                                      key={`${weekStartValue}-${sectorName}-${functionName}-${employmentType}-add`}
                                                      className="scale-extra-row no-print"
                                                    >
                                                      <td className="scale-sticky-cell">
                                                        <div className="scale-extra-bar">
                                                          <input
                                                            placeholder="Buscar EXTRA por nome ou CPF"
                                                            value={extraSearch}
                                                            onChange={(event) =>
                                                              setExtraSearchByWeek((current) => ({
                                                                ...current,
                                                                [extraSearchKey]: event.target.value,
                                                              }))
                                                            }
                                                          />
                                                        </div>
                                                        {extraCandidateOptions.length > 0 ? (
                                                          <div className="scale-suggestion-list">
                                                            {extraCandidateOptions.slice(0, 6).map((option) => (
                                                              <button
                                                                key={option.id}
                                                                type="button"
                                                                className="scale-suggestion-item"
                                                                onClick={() => {
                                                                  addExtraToWeek(weekStartValue, option.id)
                                                                  setExtraSearchByWeek((current) => ({
                                                                    ...current,
                                                                    [extraSearchKey]: '',
                                                                  }))
                                                                }}
                                                              >
                                                                <strong>{option.label}</strong>
                                                                <span>{option.helper}</span>
                                                              </button>
                                                            ))}
                                                          </div>
                                                        ) : null}
                                                      </td>
                                                      {weekDates.map((date) => (
                                                        <td
                                                          key={`${weekStartValue}-${sectorName}-${functionName}-${employmentType}-add-${toIsoDate(date)}`}
                                                          className={
                                                            scaleViewMode === 'month' &&
                                                            toIsoDate(date).slice(0, 7) !== monthReference
                                                              ? 'muted-cell'
                                                              : ''
                                                          }
                                                        />
                                                      ))}
                                                      <td className="no-print" />
                                                    </tr>
                                                  ) : null}
                                                </Fragment>
                                              )
                                            })}

                                            <tr className="scale-gap-row function-gap" aria-hidden="true">
                                              <td colSpan={weekDates.length + 2} />
                                            </tr>
                                          </Fragment>
                                        )
                                      })}

                                      <tr className="scale-gap-row sector-gap" aria-hidden="true">
                                        <td colSpan={weekDates.length + 2} />
                                      </tr>
                                    </Fragment>
                                  )
                                })}
                            </tbody>
                            {canEditScale || dayExtraCosts.some((value) => value > 0) ? (
                              <tfoot>
                                <tr>
                                  <td className="scale-sticky-cell">Custos de extras no dia</td>
                                  {dayExtraCosts.map((dayCost, index) => (
                                    <td key={`${weekStartValue}-cost-${weekDates[index].toISOString()}`}>
                                      {formatCurrency(dayCost)}
                                    </td>
                                  ))}
                                  <td className="no-print">{formatCurrency(dayExtraCosts.reduce((sum, value) => sum + value, 0))}</td>
                                </tr>
                              </tfoot>
                            ) : null}
                          </table>
                        </div>

                        {canEditScale ? (
                          <>
                            <div className="scale-week-actions no-print">
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => {
                                  openCollaboratorModal('scale')
                                }}
                              >
                                Cadastro rapido de colaborador
                              </button>
                            </div>

                            <div className="legal-banner no-print">
                              <strong>Validacoes automaticas da escala</strong>
                              <ul>
                                <li>CLT: descanso minimo de 11h entre jornadas, conforme art. 66.</li>
                                <li>CLT/Constituicao: jornada semanal de CLT limitada a 44h.</li>
                                <li>CLT: descanso semanal e alerta para 7 dias consecutivos sem folga.</li>
                                <li>Escala de extras: limite de 3 dias trabalhados por semana.</li>
                                <li>Regra mensal para CLT: destaque quando o colaborador fica sem domingo de folga no mes.</li>
                              </ul>
                            </div>
                          </>
                        ) : null}
                      </section>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        )}

        {activeSection === 'Usuarios' && canManageData && (
          <section className="section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Cadastro</p>
                <h2>Usuarios</h2>
              </div>
              <p className="section-note">
                Os logins cadastrados aqui acessam automaticamente apenas {currentCompany?.tradeName}.
              </p>
            </div>

            <div className="helper-banner field-span">
              {isSystemAdmin
                ? `Usuario master com acesso automatico a todos os setores desta empresa: ${sessionSectorAccess.join(', ') || 'nenhum setor cadastrado ainda'}.`
                : `Setores liberados para o usuario atual: ${sessionSectorAccess.join(', ') || 'nenhum setor vinculado'}.`}
            </div>

            <form className="form-grid" onSubmit={handleUserSubmit}>
              <label>
                Nome completo
                <input
                  value={userForm.fullName}
                  onChange={(event) => setUserForm({ ...userForm, fullName: event.target.value })}
                />
              </label>
              <label>
                Usuario
                <input
                  value={userForm.username}
                  onChange={(event) => setUserForm({ ...userForm, username: event.target.value })}
                />
              </label>
              <label>
                Senha
                <div className="password-input-row">
                  <input
                    type={isUserFormPasswordVisible ? 'text' : 'password'}
                    value={userForm.password}
                    onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
                  />
                  <button
                    type="button"
                    className="icon-button password-toggle"
                    aria-label={isUserFormPasswordVisible ? 'Ocultar senha' : 'Exibir senha'}
                    title={isUserFormPasswordVisible ? 'Ocultar senha' : 'Exibir senha'}
                    onClick={() => setIsUserFormPasswordVisible((current) => !current)}
                  >
                    {isUserFormPasswordVisible ? (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.8 2.8M9.9 5.1A10.9 10.9 0 0 1 12 5c5.5 0 9.5 5.1 10 7-.2.7-.9 1.8-2 3M6.7 6.7C4.2 8.2 2.5 10.7 2 12c.5 1.9 4.5 7 10 7 1.6 0 3-.3 4.2-.9"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path
                          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="3"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        />
                      </svg>
                    )}
                  </button>
                </div>
              </label>
              <label>
                Funcao no sistema
                <select
                  value={userForm.role}
                  onChange={(event) =>
                    setUserForm({
                      ...userForm,
                      role: event.target.value as CompanyRole,
                      linkedCollaboratorId:
                        event.target.value === 'Visualizador' ? userForm.linkedCollaboratorId : '',
                    })
                  }
                >
                  {companyRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              {userForm.role === 'Visualizador' ? (
                <div className="field-span">
                  <label>
                    Colaborador vinculado
                    <select
                      value={userForm.linkedCollaboratorId}
                      onChange={(event) =>
                        setUserForm({ ...userForm, linkedCollaboratorId: event.target.value })
                      }
                    >
                      <option value="">Selecione o colaborador</option>
                      {companyCollaborators
                        .filter((item) => item.employmentType !== 'EXTRA')
                        .sort((left, right) => {
                          const leftName = getCollaboratorProfile(left.cpf)?.fullName ?? left.cpf
                          const rightName = getCollaboratorProfile(right.cpf)?.fullName ?? right.cpf
                          return leftName.localeCompare(rightName)
                        })
                        .map((item) => (
                          <option key={item.id} value={item.id}>
                            {(getCollaboratorProfile(item.cpf)?.fullName ?? item.cpf)} • {getCollaboratorSector(item)}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="inline-create">
                    <div className="field-helper">
                      Se o colaborador ainda nao existir, crie-o sem sair deste cadastro.
                    </div>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => openCollaboratorModal('user')}
                    >
                      Novo colaborador
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="field-span">
                <div className="field-heading">
                  <span className="field-title">Setores do usuario</span>
                  <span className="field-helper">
                    {userForm.role === 'Visualizador'
                      ? 'Para visualizador, o setor segue automaticamente o colaborador vinculado.'
                      : 'O usuario pode ver ou editar apenas as escalas desses setores.'}
                  </span>
                </div>

                {availableSectorNames.length > 0 ? (
                  <div className="selector-grid">
                    {availableSectorNames.map((sectorName) => (
                      <label key={sectorName} className="checkbox-card">
                        <input
                          type="checkbox"
                          checked={userForm.sectors.includes(sectorName)}
                          disabled={userForm.role === 'Visualizador'}
                          onChange={() => toggleUserSector(sectorName)}
                        />
                        <span>{sectorName}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="field-helper">
                    Nenhum setor cadastrado ainda. Digite o primeiro setor abaixo.
                  </div>
                )}

                <div className="inline-create">
                    <input
                    list="company-sector-options-user"
                    placeholder="Adicionar novo setor ao usuario"
                    value={userSectorInput}
                    disabled={userForm.role === 'Visualizador'}
                    onChange={(event) => setUserSectorInput(event.target.value)}
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={addUserSector}
                    disabled={userForm.role === 'Visualizador'}
                  >
                    Adicionar setor
                  </button>
                </div>
              </div>

              <div className="form-actions user-form-actions">
                <button type="submit" className="primary-button">
                  {editingUserId === null ? 'Adicionar usuario' : 'Salvar alteracoes do usuario'}
                </button>
              </div>
            </form>

            <datalist id="company-sector-options-user">
              {availableSectorNames.map((sectorName) => (
                <option key={sectorName} value={sectorName} />
              ))}
            </datalist>

            <div className="table-list">
              {companyUsers.map((item) => (
                <article key={item.id} className="list-row user-list-row">
                  {(() => {
                    const linkedCollaborator =
                      item.linkedCollaboratorId === null
                        ? null
                        : companyCollaborators.find((collaborator) => collaborator.id === item.linkedCollaboratorId) ?? null
                    const linkedCollaboratorName =
                      linkedCollaborator === null
                        ? ''
                        : getCollaboratorProfile(linkedCollaborator.cpf)?.fullName ?? linkedCollaborator.cpf

                    return (
                      <>
                  <div className="user-row-header">
                    <div className="user-title-group">
                      <strong>{item.fullName}</strong>
                      <span className={item.isActive ? 'status-pill status-active' : 'status-pill status-inactive'}>
                        {item.isActive ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => editUser(item.id)}
                      >
                        Editar
                      </button>
                      {(session?.kind === 'systemAdmin' || session?.user.role === 'Gestor') && (
                        <button
                          type="button"
                          className={item.isActive ? 'warning-button' : 'secondary-button'}
                          onClick={() => toggleUserActivation(item.id)}
                        >
                          {item.isActive ? 'Inativar' : 'Ativar'}
                        </button>
                      )}
                      {session?.kind === 'systemAdmin' && (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => deleteUser(item.id)}
                        >
                          Excluir
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="row-meta user-row-meta">
                    <div className="user-meta-line">
                      <span><strong className="meta-label">Login:</strong> {item.username}</span>
                      <div className="password-row">
                        <span><strong className="meta-label">Senha:</strong> {visibleUserPasswords[item.id] ? item.password : '••••••••'}</span>
                        <button
                          type="button"
                          className="icon-button password-toggle"
                          aria-label={visibleUserPasswords[item.id] ? 'Ocultar senha' : 'Exibir senha'}
                          title={visibleUserPasswords[item.id] ? 'Ocultar senha' : 'Exibir senha'}
                          onClick={() =>
                            setVisibleUserPasswords((current) => ({
                              ...current,
                              [item.id]: !current[item.id],
                            }))
                          }
                        >
                          {visibleUserPasswords[item.id] ? (
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                d="M3 3l18 18M10.6 10.7a2 2 0 0 0 2.8 2.8M9.9 5.1A10.9 10.9 0 0 1 12 5c5.5 0 9.5 5.1 10 7-.2.7-.9 1.8-2 3M6.7 6.7C4.2 8.2 2.5 10.7 2 12c.5 1.9 4.5 7 10 7 1.6 0 3-.3 4.2-.9"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <circle
                                cx="12"
                                cy="12"
                                r="3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                      <span><strong className="meta-label">Setores:</strong> {item.sectors.join(', ')}</span>
                      <span><strong className="meta-label">Perfil:</strong> {item.role}</span>
                      {item.role === 'Visualizador' && linkedCollaboratorName ? (
                        <span><strong className="meta-label">Colaborador:</strong> {linkedCollaboratorName}</span>
                      ) : null}
                    </div>
                  </div>
                      </>
                    )
                  })()}
                </article>
              ))}
            </div>
          </section>
        )}
      </main>

      {scheduleWarning && (
        <div className="modal-backdrop" role="presentation" onClick={() => setScheduleWarning(null)}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-warning-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Validacao de horario</p>
                <h2 id="schedule-warning-title">{scheduleWarning.title}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setScheduleWarning(null)}>
                Fechar
              </button>
            </div>

            <div className="feedback error">
              <strong>O horario nao pode ser cadastrado.</strong>
              <ul>
                {scheduleWarning.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}

      {userWarning && (
        <div className="modal-backdrop" role="presentation" onClick={() => setUserWarning(null)}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-warning-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Validacao de usuario</p>
                <h2 id="user-warning-title">{userWarning.title}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setUserWarning(null)}>
                Fechar
              </button>
            </div>

            <div className="feedback error">
              <strong>O usuario nao pode ser cadastrado.</strong>
              <ul>
                {userWarning.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}

      {scaleCommentModal && (
        <div className="modal-backdrop" role="presentation" onClick={closeScaleCommentModal}>
          <section
            className="modal-card scale-comment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scale-comment-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Comentarios da escala</p>
                <h2 id="scale-comment-title">
                  {activeScaleCommentCollaborator
                    ? getCollaboratorProfile(activeScaleCommentCollaborator.cpf)?.fullName ??
                      activeScaleCommentCollaborator.cpf
                    : 'Colaborador'}
                </h2>
                <p className="section-note">{formatDateLabel(scaleCommentModal.date)}</p>
              </div>
              <button type="button" className="ghost-button" onClick={closeScaleCommentModal}>
                Fechar
              </button>
            </div>

            <div className="scale-comment-thread">
              {activeScaleCommentThread?.messages.length ? (
                activeScaleCommentThread.messages.map((message) => (
                  <article key={message.id} className="scale-comment-entry">
                    <div className="scale-comment-entry-top">
                      <div className="scale-comment-entry-header">
                        <strong>{message.authorName}</strong>
                        <span>{message.authorRole}</span>
                        <span>{formatDateTimeLabel(message.createdAt)}</span>
                      </div>
                      {canManageScaleCommentMessage(message) ? (
                        <div className="scale-comment-actions">
                          <button
                            type="button"
                            className="scale-comment-action-button edit"
                            aria-label="Editar comentario"
                            title="Editar comentario"
                            onClick={() => startScaleCommentEdit(message)}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                d="M4 20h4l10-10-4-4L4 16v4Z"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                              <path
                                d="M13 7l4 4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="scale-comment-action-button delete"
                            aria-label="Excluir comentario"
                            title="Excluir comentario"
                            onClick={() => deleteScaleCommentMessage(message.id)}
                          >
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                              <path
                                d="M5 7h14M9 7V5h6v2m-8 0 1 12h8l1-12"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </button>
                        </div>
                      ) : null}
                    </div>
                    {editingScaleCommentId === message.id ? (
                      <div className="scale-comment-edit-block">
                        <textarea
                          rows={3}
                          value={editingScaleCommentDraft}
                          onChange={(event) => setEditingScaleCommentDraft(event.target.value)}
                        />
                        <div className="scale-comment-edit-actions">
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={cancelScaleCommentEdit}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="primary-button"
                            onClick={saveScaleCommentEdit}
                            disabled={!editingScaleCommentDraft.trim()}
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p>{message.body}</p>
                    )}
                  </article>
                ))
              ) : (
                <div className="helper-banner">Nenhum comentario registrado para este dia.</div>
              )}
            </div>

            <div className="form-grid scale-comment-form">
              <label className="field-span">
                {activeScaleCommentThread?.messages.length ? 'Responder' : 'Novo comentario'}
                <textarea
                  rows={4}
                  value={scaleCommentDraft}
                  onChange={(event) => setScaleCommentDraft(event.target.value)}
                  placeholder="Escreva um comentario sobre esta escala"
                />
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="primary-button"
                onClick={submitScaleComment}
                disabled={!scaleCommentDraft.trim()}
              >
                {activeScaleCommentThread?.messages.length ? 'Responder comentario' : 'Salvar comentario'}
              </button>
            </div>
          </section>
        </div>
      )}

      {scaleWarning && (
        <div className="modal-backdrop" role="presentation" onClick={() => setScaleWarning(null)}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scale-warning-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Escala irregular</p>
                <h2 id="scale-warning-title">{scaleWarning.title}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setScaleWarning(null)}>
                Fechar
              </button>
            </div>

            <div className="feedback error">
              <strong>Revise esta linha da escala.</strong>
              <ul>
                {scaleWarning.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}

      {isNotificationModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsNotificationModalOpen(false)}>
          <section
            className="modal-card scale-comment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="notification-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Notificacoes</p>
                <h2 id="notification-modal-title">Comentarios recebidos</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setIsNotificationModalOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="scale-comment-thread">
              {scaleNotificationItems.length > 0 ? (
                scaleNotificationItems.map((item) => (
                  <button
                    key={item.messageId}
                    type="button"
                    className="scale-notification-card"
                    onClick={() => openScaleNotification(item.collaboratorId, item.date)}
                  >
                    <div className="scale-comment-entry-header">
                      <strong>{item.collaboratorName}</strong>
                      <span>{formatDateLabel(item.date)}</span>
                      <span>{item.authorName} • {item.authorRole}</span>
                      <span>{formatDateTimeLabel(item.createdAt)}</span>
                    </div>
                    <p>{item.body}</p>
                  </button>
                ))
              ) : (
                <div className="helper-banner">Nenhuma notificacao pendente.</div>
              )}
            </div>
          </section>
        </div>
      )}

      {isPrintModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsPrintModalOpen(false)}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="print-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Impressao</p>
                <h2 id="print-modal-title">Configurar impressao da escala</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setIsPrintModalOpen(false)}>
                Fechar
              </button>
            </div>

            <div className="form-grid">
              <label className="field-span print-option-row">
                <span>Incluir colaboradores extras na impressao</span>
                <input
                  type="checkbox"
                  checked={printIncludeExtras}
                  onChange={(event) => setPrintIncludeExtras(event.target.checked)}
                />
              </label>
            </div>
            
            <div className="form-actions">
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setIsPrintModalOpen(false)
                  handleScalePrint()
                }}
              >
                Imprimir agora
              </button>
            </div>

            <div className="helper-banner field-span print-helper-banner">
              CLT e PJ sempre entram na impressao. Extras so entram quando esta opcao estiver marcada.
            </div>
          </section>
        </div>
      )}

      {isCollaboratorModalOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => {
            setCollaboratorModalSource('scale')
            setIsCollaboratorModalOpen(false)
          }}
        >
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="collaborator-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Cadastro rapido</p>
                <h2 id="collaborator-modal-title">Novo colaborador</h2>
              </div>
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setCollaboratorModalSource('scale')
                  setIsCollaboratorModalOpen(false)
                }}
              >
                Fechar
              </button>
            </div>

            <p className="section-note">
              {collaboratorModalSource === 'user'
                ? 'O cadastro salva na empresa ativa e o novo colaborador fica disponivel para vinculo imediato ao usuario visualizador.'
                : 'O cadastro salva na empresa ativa e atualiza a escala imediatamente.'}
            </p>

            <form className="form-grid" onSubmit={handleCollaboratorSubmit}>
              <label>
                CPF
                <input
                  value={collaboratorForm.cpf}
                  onChange={(event) => changeCollaboratorCpf(event.target.value)}
                  placeholder="000.000.000-00"
                />
              </label>
              <label>
                Nome completo
                <input
                  value={collaboratorForm.fullName}
                  onChange={(event) =>
                    setCollaboratorForm({ ...collaboratorForm, fullName: event.target.value })
                  }
                />
              </label>
              <label>
                Chave PIX
                <input
                  value={collaboratorForm.pixKey}
                  onChange={(event) =>
                    setCollaboratorForm({ ...collaboratorForm, pixKey: event.target.value })
                  }
                />
              </label>
              <label>
                Contato
                <input
                  value={collaboratorForm.contact}
                  onChange={(event) =>
                    setCollaboratorForm({ ...collaboratorForm, contact: event.target.value })
                  }
                />
              </label>

              {collaboratorLookupFeedback && (
                <div className="field-span helper-banner">{collaboratorLookupFeedback}</div>
              )}

              <div className="field-span">
                <span className="field-title">Vinculo</span>
                <div className="pill-row">
                  {collaboratorEmploymentTypes.map((employmentType) => (
                    <button
                      key={employmentType}
                      type="button"
                      className={
                        collaboratorForm.employmentType === employmentType ? 'pill active' : 'pill'
                      }
                      onClick={() => changeCollaboratorEmploymentType(employmentType)}
                    >
                      {employmentType}
                    </button>
                  ))}
                </div>
              </div>

              <div className="field-span">
                <div className="field-heading">
                  <span className="field-title">Funcao</span>
                  <span className="field-helper">
                    Selecionadas: {selectedFunctions.length}/{activeFunctionLimit}
                  </span>
                </div>
                <div className="selector-grid">
                  {availableFunctionNames.map((functionName) => (
                    <label key={functionName} className="checkbox-card">
                      <input
                        type="checkbox"
                        checked={selectedFunctions.includes(functionName)}
                        onChange={() => toggleCollaboratorFunction(functionName)}
                      />
                      <span>{functionName}</span>
                    </label>
                  ))}
                </div>
                {currentCollaboratorProfile?.knownFunctions.length ? (
                  <div className="field-helper">
                    Funcoes ja registradas para este CPF no web app: {currentCollaboratorProfile.knownFunctions.join(', ')}
                  </div>
                ) : null}
                <div className="inline-create">
                  <input
                    placeholder="Funcao nao encontrada? Digite o nome"
                    value={functionSuggestion}
                    onChange={(event) => setFunctionSuggestion(event.target.value)}
                  />
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => openFunctionModal(functionSuggestion.trim())}
                  >
                    Cadastrar funcao
                  </button>
                </div>
              </div>

              {selectedFunctions.length > 1 && (
                <label className="field-span">
                  Funcao principal nesta empresa
                  <select
                    value={collaboratorForm.primaryFunction}
                    onChange={(event) =>
                      setCollaboratorForm({
                        ...collaboratorForm,
                        primaryFunction: event.target.value,
                      })
                    }
                  >
                    <option value="">Selecione a funcao base da escala</option>
                    {selectedFunctions.map((functionName) => (
                      <option key={functionName} value={functionName}>
                        {functionName}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="form-actions">
                <button type="submit" className="primary-button">
                  {currentCompanyCollaborator ? 'Atualizar colaborador' : 'Adicionar colaborador'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isFunctionModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsFunctionModalOpen(false)}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="function-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Cadastro rapido</p>
                <h2 id="function-modal-title">Nova funcao</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setIsFunctionModalOpen(false)}>
                Fechar
              </button>
            </div>

            <p className="section-note">
              Esta funcao sera criada dentro da empresa atualmente selecionada.
            </p>

            <form className="form-grid" onSubmit={handleFunctionSubmit}>
              <label>
                Funcao
                <input
                  value={functionForm.name}
                  onChange={(event) => setFunctionForm({ ...functionForm, name: event.target.value })}
                />
              </label>
              <label>
                Setor
                <input
                  list="company-sector-options-modal"
                  placeholder="Selecione ou digite um novo setor"
                  value={functionForm.sector}
                  onChange={(event) => setFunctionForm({ ...functionForm, sector: event.target.value })}
                />
              </label>
              <label>
                Base salarial
                <input
                  value={functionForm.baseSalary}
                  onChange={(event) =>
                    setFunctionForm({ ...functionForm, baseSalary: event.target.value })
                  }
                />
              </label>
              <label>
                Cota no servico
                <input
                  value={functionForm.serviceQuota}
                  onChange={(event) =>
                    setFunctionForm({ ...functionForm, serviceQuota: event.target.value })
                  }
                />
              </label>
              <label>
                Paga extra
                <input
                  placeholder="Valor pago ao colaborador Extra"
                  value={functionForm.extraPayValue}
                  onChange={(event) =>
                    setFunctionForm({ ...functionForm, extraPayValue: event.target.value })
                  }
                />
              </label>
              <label className="field-span">
                Descritivo
                <textarea
                  rows={5}
                  value={functionForm.description}
                  onChange={(event) =>
                    setFunctionForm({ ...functionForm, description: event.target.value })
                  }
                />
              </label>
              <div className="form-actions">
                <button type="submit" className="primary-button">
                  Salvar funcao
                </button>
              </div>
            </form>

            <datalist id="company-sector-options-modal">
              {availableSectorNames.map((sectorName) => (
                <option key={sectorName} value={sectorName} />
              ))}
            </datalist>
          </section>
        </div>
      )}

      {isCompanyModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => setIsCompanyModalOpen(false)}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-company-inline-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Nova empresa</p>
                <h2 id="new-company-inline-title">Cadastro de empresa</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setIsCompanyModalOpen(false)}>
                Fechar
              </button>
            </div>

            <form className="form-grid" onSubmit={(event) => submitCompany(event, 'create')}>
              <label>
                Nome fantasia
                <input
                  value={companyForm.tradeName}
                  onChange={(event) => setCompanyForm({ ...companyForm, tradeName: event.target.value })}
                />
              </label>
              <label>
                Razao social
                <input
                  value={companyForm.legalName}
                  onChange={(event) => setCompanyForm({ ...companyForm, legalName: event.target.value })}
                />
              </label>
              <label>
                CNPJ
                <input
                  value={companyForm.cnpj}
                  onChange={(event) =>
                    setCompanyForm({ ...companyForm, cnpj: formatCnpj(event.target.value) })
                  }
                />
              </label>
              <label>
                CEP
                <input
                  value={companyForm.zipCode}
                  onChange={(event) => changeCompanyZipCode(event.target.value)}
                />
              </label>
              <div className="field-span helper-banner">{zipCodeFeedback || 'Digite o CEP para sugerir o logradouro.'}</div>
              <label>
                Logradouro
                <input
                  value={companyForm.street}
                  onChange={(event) => setCompanyForm({ ...companyForm, street: event.target.value })}
                />
              </label>
              <label>
                Numero
                <input
                  value={companyForm.number}
                  onChange={(event) => setCompanyForm({ ...companyForm, number: event.target.value })}
                />
              </label>
              <label>
                Complemento
                <input
                  value={companyForm.complement}
                  onChange={(event) => setCompanyForm({ ...companyForm, complement: event.target.value })}
                />
              </label>
              <label>
                Bairro
                <input
                  value={companyForm.district}
                  onChange={(event) => setCompanyForm({ ...companyForm, district: event.target.value })}
                />
              </label>
              <label>
                Estado
                <select
                  value={companyForm.state}
                  onChange={(event) => setCompanyForm({ ...companyForm, state: event.target.value })}
                >
                  <option value="">Selecione</option>
                  {brazilianStates.map((state) => (
                    <option key={state} value={state}>
                      {state}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Cidade
                <input
                  value={companyForm.city}
                  onChange={(event) => setCompanyForm({ ...companyForm, city: event.target.value })}
                />
              </label>
              {companyAgreementField}
              <div className="form-actions">
                <button type="submit" className="primary-button">
                  Salvar empresa
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
