import { Fragment, startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import './App.css'
import {
  appSections,
  buildDefaultSectionAccessByRole,
  companyRoles,
  masterPanelSections,
  normalizeSectionAccess,
} from './accessControl'
import type { AppSection, CompanyRole, MasterPanelSection, UserSectionAccess } from './accessControl'
import { reportOptions } from './reportCatalog'
import type { ReportId } from './reportCatalog'
import { buildReportPrintHtml, buildReportWorksheetRows } from './reportExportUtils'
import {
  buildInvalidCollaboratorWarning,
  buildInvalidFunctionWarning,
  buildDeletedScheduleFeedback,
  buildDuplicateScheduleFeedback,
  buildInvalidScheduleWarning,
  buildInvalidUserWarning,
  buildSuccessfulScheduleFeedback,
} from './feedbackUtils'
import {
  buildCollaboratorModalClosedState,
  buildCollaboratorModalOpenState,
  buildCompanyModalClosedState,
  buildFunctionModalClosedState,
  buildScaleCommentModalClosedState,
  buildScaleCommentModalOpenState,
} from './modalStateUtils'
import { buildResetFormState } from './resetUtils'
import {
  clearReportColumnFilterSelection,
  resetReportTableFilters,
  resetReportTableVisibleColumns,
  showVisibleReportColumn,
  toggleReportColumnFilterSelection,
  toggleVisibleReportColumn,
} from './reportTableStateUtils'
import {
  filterReportRows,
  getReportColumnDistinctValues,
  getReportPreviewRows,
  getVisibleReportColumnKeys,
  splitReportColumnsByVisibility,
} from './reportViewUtils'
import {
  addResolvedSectorToUserForm,
  ensureCompanySectorInCollection,
  resolveCompanySectorName,
  toggleUserSectorSelection,
} from './sectorUtils'
import {
  apiBaseUrl,
  appStateVersion,
  readStoredValue,
  storageKeys,
  writeStoredValue,
} from './persistence'
import type { ModularStateKey } from './persistence'
import {
  filterAuditLogs,
  getAuditAlertLogs,
  getAuditImpactLogs,
  getCurrentCompanyAuditLogs,
  normalizeAuditLogs,
} from './auditUtils'
import {
  escapeHtml,
  formatCurrency,
  formatDateTimeLabel,
  formatMonthDateLabel,
  formatWorkedHours,
  getShortDisplayName,
  parseCurrencyValue,
  slugifyFilePart,
} from './formatters'
import {
  buildSchedulePreview,
  buildUniqueScheduleAbbreviation,
  formatCnpj,
  formatCpf,
  formatZipCode,
  normalizeLocationValue,
  normalizeSequentialTimes,
  normalizeTypedTime,
  parseTime,
} from './formUtils'
import {
  buildAgreementFormSnapshot,
  buildCompanyFormSnapshot,
  buildFunctionFormSnapshot,
  buildScheduleFormSnapshot,
  buildUserFormSnapshot,
} from './formStateUtils'
import {
  updateCompanyCollectiveProfileInCollection,
  updateCompanyOperationalSettingsInCollection,
  removeFunctionFromCollaborators,
} from './companyFunctionUtils'
import {
  buildCollaboratorCpfLookupState,
  buildCollaboratorCpfMissingProfileState,
  changeCollaboratorEmploymentTypeState,
  toggleCollaboratorFunctionSelection,
} from './collaboratorFormUtils'
import {
  buildCollaboratorEditState,
  buildFunctionEditState,
  buildFunctionModalOpenState,
  buildScheduleEditState,
  buildUserEditState,
} from './formEditUtils'
import {
  areMembershipListsEqual,
  getCompanyUserMembershipsForUser,
  getCompanyUserMembershipsFromCredentials,
  getSectorNamesForCompany,
} from './sessionUtils'
import { EntityListTable } from './entityListTable'
import {
  findCompanyById,
  findSystemAdminByCredentials,
  getActiveCompanyUserMemberships,
  resolveCompanyLoginResult,
} from './sessionFlowUtils'
import {
  formatDateLabel,
  formatDayHeader,
  formatWeekLabel,
  getMonthLabel,
  getMonthWeeks,
  getWeekDates,
  startOfWeek,
  toIsoDate,
} from './dateUtils'

const collaboratorEmploymentTypes = ['CLT', 'PJ', 'EXTRA'] as const
const scaleEmploymentOrder = ['CLT', 'PJ', 'EXTRA'] as const

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

type CollaboratorEmploymentType = (typeof collaboratorEmploymentTypes)[number]
const coverageDayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type CoverageDayKey = (typeof coverageDayKeys)[number]
type CompanyPublicServiceDay = {
  isOpen: boolean
  start: string
  breakStart: string
  breakEnd: string
  end: string
}
type CompanyPublicServiceHours = Record<CoverageDayKey, CompanyPublicServiceDay>
type CoverageFunctionTarget = {
  functionName: string
  minimumStaff: string
}
type CoverageTimeTarget = {
  id: string
  start: string
  end: string
  minimumStaff: string
  functionTargets: CoverageFunctionTarget[]
}
type CoverageDayTarget = {
  defaultMinimumStaff: string
  timeTargets: CoverageTimeTarget[]
}
type CompanyCoverageTargets = Record<CoverageDayKey, CoverageDayTarget>
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
  defaultScaleViewMode?: ScaleViewMode
  defaultReportId?: ReportId
  defaultPrintIncludeExtras?: boolean
  allowPastScaleEdits?: boolean
  linkedCompanyIds: number[]
  publicServiceHours: CompanyPublicServiceHours
  coverageTargets: CompanyCoverageTargets
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

type ScaleReplicationModalState = {
  collaboratorId: number
  mode: 'sequence' | 'weekly'
  sourceStartDate: string
  sourceEndDate: string
  targetStartDate: string
  weeklyRepeatCount: string
  overwriteExisting: boolean
  copyDaysOff: boolean
}

type ScaleBatchModalState = {
  weekStart: string
  employmentScope: 'TODOS' | CollaboratorEmploymentType
  scheduleIdValue: string
  selectedDates: string[]
  overwriteExisting: boolean
}

type ScaleBatchRuntimeState = {
  weekDates: Date[]
  targetRows: CollaboratorRecord[]
  errorMessage: string | null
}

type ImpactWarningState = {
  title: string
  messages: string[]
  confirmLabel: string
  replacementLabel?: string
  replacementPlaceholder?: string
  replacementValue: string
  replacementOptions: Array<{ value: string; label: string }>
}

type FunctionCloneModalState = {
  sourceFunctionId: number
  name: string
  sector: string
  description: string
  baseSalary: string
  serviceQuota: string
  extraPayValue: string
}

type ScheduleCloneModalState = {
  sourceScheduleId: number
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

const collaboratorListDefaultColumnOrder = [
  'nome',
  'cpf',
  'vinculo',
  'funcoes',
  'principal',
  'contato',
  'pix',
  'status',
]

const functionListDefaultColumnOrder = [
  'funcao',
  'origem',
  'setor',
  'salario',
  'cota',
  'extra',
  'descricao',
  'status',
]

const scheduleListDefaultColumnOrder = [
  'turno',
  'origem',
  'sigla',
  'entrada',
  'pausa',
  'retorno',
  'saida',
  'jornada',
  'status',
  'validacao',
]

function isValidIsoDateValue(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime())
}

function getSafeWeekDates(dateValue: string | null | undefined) {
  if (!dateValue || !isValidIsoDateValue(dateValue)) {
    return []
  }

  const weekDates = getWeekDates(dateValue).filter((date) => !Number.isNaN(date.getTime()))
  return weekDates.length === 7 ? weekDates : []
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
  sectionAccess?: Partial<UserSectionAccess>
  linkedCollaboratorId: number | null
  isActive: boolean
}

type AuditLogRecord = {
  id: number
  companyId: number | null
  actorName: string
  actorRole: string
  module: string
  action: string
  targetType: string
  targetLabel: string
  severity: 'info' | 'warning' | 'critical'
  impactSummary: string
  createdAt: string
  relatedCompanyIds: number[]
}

type ScaleViewMode = 'week' | 'month' | 'coverage'

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
  canOverride?: boolean
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
  auditLogs: AuditLogRecord[]
}

type CompanyUserSession = {
  kind: 'companyUser'
  user: CompanyUserRecord
  memberships: CompanyUserRecord[]
}

type CollaboratorModalSource = 'scale' | 'user'
type ActiveSection = AppSection | 'PainelMaster'

const appSectionLabels: Record<AppSection, string> = {
  Painel: 'Painel',
  Escala: 'Escala',
  Cobertura: 'Cobertura operacional',
  Colaboradores: 'Colaboradores',
  Funcoes: 'Funcoes',
  Horarios: 'Horarios',
  Usuarios: 'Usuarios',
  Empresa: 'Empresa',
  Convencoes: 'Convencoes',
}

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
  | CompanyUserSession

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

function formatScaleCoverageShortcutLabel(date: Date) {
  const weekday = ['Dom.', 'Seg.', 'Ter.', 'Qua.', 'Qui.', 'Sex.', 'Sab.'][date.getDay()]
  return `${weekday} ${String(date.getDate()).padStart(2, '0')}`
}

const coverageDayLabels: Record<CoverageDayKey, string> = {
  monday: 'Segunda',
  tuesday: 'Terca',
  wednesday: 'Quarta',
  thursday: 'Quinta',
  friday: 'Sexta',
  saturday: 'Sabado',
  sunday: 'Domingo',
}

function buildEmptyPublicServiceHours(): CompanyPublicServiceHours {
  return coverageDayKeys.reduce((accumulator, dayKey) => {
    accumulator[dayKey] = {
      isOpen: false,
      start: '',
      breakStart: '',
      breakEnd: '',
      end: '',
    }
    return accumulator
  }, {} as CompanyPublicServiceHours)
}

function normalizeTextEntry(value: string) {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
}

function buildEmptyCoverageTargets(): CompanyCoverageTargets {
  return coverageDayKeys.reduce((accumulator, dayKey) => {
    accumulator[dayKey] = {
      defaultMinimumStaff: '1',
      timeTargets: [],
    }
    return accumulator
  }, {} as CompanyCoverageTargets)
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
  sectionAccess: {} as Partial<UserSectionAccess>,
  linkedCollaboratorId: '',
  additionalCompanyIds: [] as string[],
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

function computeScheduleNetMinutes(values: ScheduleFormState) {
  return buildSchedulePreview(values).netMinutes
}

function getNextNumericId<T extends { id: number }>(items: T[]) {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1
}

function normalizeLinkedCompanyIdsInCollection(
  companies: Array<CompanyRecord & { linkedCompanyIds?: number[] }>,
) {
  const companyIds = new Set(companies.map((item) => item.id))

  return companies.map((item) => ({
    ...item,
    linkedCompanyIds: Array.from(
      new Set(
        (Array.isArray(item.linkedCompanyIds) ? item.linkedCompanyIds : []).filter(
          (linkedCompanyId) => linkedCompanyId !== item.id && companyIds.has(linkedCompanyId),
        ),
      ),
    ).sort((left, right) => left - right),
  }))
}

function buildUniqueLocalCloneName(baseValue: string, existingValues: string[]) {
  const trimmedBaseValue = baseValue.trim() || 'Copia local'
  const blockedValues = new Set(existingValues.map((item) => item.trim().toLowerCase()))

  const firstCandidate = `${trimmedBaseValue} (Local)`
  if (!blockedValues.has(firstCandidate.toLowerCase())) {
    return firstCandidate
  }

  for (let index = 2; index <= 99; index += 1) {
    const candidate = `${trimmedBaseValue} (Local ${index})`
    if (!blockedValues.has(candidate.toLowerCase())) {
      return candidate
    }
  }

  return `${trimmedBaseValue} (${Date.now()})`
}

function normalizePublicServiceHours(
  publicServiceHours?: Partial<Record<CoverageDayKey, Partial<CompanyPublicServiceDay>>> | null,
): CompanyPublicServiceHours {
  const emptyHours = buildEmptyPublicServiceHours()

  return coverageDayKeys.reduce((accumulator, dayKey) => {
    const source = publicServiceHours?.[dayKey]
    accumulator[dayKey] = {
      isOpen: source?.isOpen ?? emptyHours[dayKey].isOpen,
      start: source?.start ?? emptyHours[dayKey].start,
      breakStart: source?.breakStart ?? emptyHours[dayKey].breakStart,
      breakEnd: source?.breakEnd ?? emptyHours[dayKey].breakEnd,
      end: source?.end ?? emptyHours[dayKey].end,
    }
    return accumulator
  }, {} as CompanyPublicServiceHours)
}

function normalizeCoverageTargets(
  coverageTargets?: Partial<Record<CoverageDayKey, Partial<CoverageDayTarget>>> | null,
): CompanyCoverageTargets {
  const emptyTargets = buildEmptyCoverageTargets()

  return coverageDayKeys.reduce((accumulator, dayKey) => {
    const source = coverageTargets?.[dayKey]
    accumulator[dayKey] = {
      defaultMinimumStaff:
        typeof source?.defaultMinimumStaff === 'string' && source.defaultMinimumStaff.trim().length > 0
          ? source.defaultMinimumStaff
          : emptyTargets[dayKey].defaultMinimumStaff,
      timeTargets: Array.isArray(source?.timeTargets)
        ? source.timeTargets.map((timeTarget, index) => ({
            id: typeof timeTarget?.id === 'string' && timeTarget.id.trim().length > 0 ? timeTarget.id : dayKey + '-target-' + String(index + 1),
            start: typeof timeTarget?.start === 'string' ? timeTarget.start : '',
            end: typeof timeTarget?.end === 'string' ? timeTarget.end : '',
            minimumStaff:
              typeof timeTarget?.minimumStaff === 'string' && timeTarget.minimumStaff.trim().length > 0
                ? timeTarget.minimumStaff
                : emptyTargets[dayKey].defaultMinimumStaff,
            functionTargets: Array.isArray(timeTarget?.functionTargets)
              ? timeTarget.functionTargets.map((functionTarget) => ({
                  functionName: typeof functionTarget?.functionName === 'string' ? functionTarget.functionName : '',
                  minimumStaff:
                    typeof functionTarget?.minimumStaff === 'string' && functionTarget.minimumStaff.trim().length > 0
                      ? functionTarget.minimumStaff
                      : '1',
                }))
              : [],
          }))
        : [],
    }
    return accumulator
  }, {} as CompanyCoverageTargets)
}

function getCoverageDayKey(date: Date): CoverageDayKey {
  return coverageDayKeys[(date.getDay() + 6) % 7]
}

function parseTwentyFourHourValue(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return null
  }

  const [hours, minutes] = value.split(':').map(Number)
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }

  return hours * 60 + minutes
}

function formatCoverageMinuteLabel(totalMinutes: number) {
  const normalizedMinutes = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60)
  const dayOffset = Math.floor(totalMinutes / (24 * 60))
  const hours = Math.floor(normalizedMinutes / 60)
  const minutes = normalizedMinutes % 60
  const baseLabel = String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0')

  return dayOffset > 0 ? baseLabel + '+' + String(dayOffset) : baseLabel
}

function floorCoverageSlot(value: number) {
  return Math.floor(value / 30) * 30
}

function ceilCoverageSlot(value: number) {
  return Math.ceil(value / 30) * 30
}

function buildPublicServiceSegments(daySettings: CompanyPublicServiceDay) {
  if (!daySettings.isOpen) {
    return [] as Array<{ start: number; end: number }>
  }

  const start = parseTwentyFourHourValue(daySettings.start)
  const end = parseTwentyFourHourValue(daySettings.end)
  if (start === null || end === null) {
    return [] as Array<{ start: number; end: number }>
  }

  const hasBreakStart = daySettings.breakStart.trim().length > 0
  const hasBreakEnd = daySettings.breakEnd.trim().length > 0
  if (hasBreakStart !== hasBreakEnd) {
    return [] as Array<{ start: number; end: number }>
  }

  if (!hasBreakStart) {
    const [normalizedStart, normalizedEnd] = normalizeSequentialTimes([start, end])
    return normalizedEnd > normalizedStart ? [{ start: normalizedStart, end: normalizedEnd }] : []
  }

  const breakStart = parseTwentyFourHourValue(daySettings.breakStart)
  const breakEnd = parseTwentyFourHourValue(daySettings.breakEnd)
  if (breakStart === null || breakEnd === null) {
    return [] as Array<{ start: number; end: number }>
  }

  const [normalizedStart, normalizedBreakStart, normalizedBreakEnd, normalizedEnd] =
    normalizeSequentialTimes([start, breakStart, breakEnd, end])

  if (!(normalizedStart < normalizedBreakStart && normalizedBreakStart < normalizedBreakEnd && normalizedBreakEnd < normalizedEnd)) {
    return [] as Array<{ start: number; end: number }>
  }

  return [
    { start: normalizedStart, end: normalizedBreakStart },
    { start: normalizedBreakEnd, end: normalizedEnd },
  ]
}

function buildScheduleCoverageSegments(schedule: ScheduleRecord) {
  const start = parseTime(schedule.startTime, schedule.startPeriod)
  const end = parseTime(schedule.endTime, schedule.endPeriod)
  if (start === null || end === null) {
    return [] as Array<{ start: number; end: number }>
  }

  const hasBreak = schedule.breakStart.trim().length > 0 && schedule.breakEnd.trim().length > 0
  if (!hasBreak) {
    const [normalizedStart, normalizedEnd] = normalizeSequentialTimes([start, end])
    return normalizedEnd > normalizedStart ? [{ start: normalizedStart, end: normalizedEnd }] : []
  }

  const breakStart = parseTime(schedule.breakStart, schedule.breakStartPeriod)
  const breakEnd = parseTime(schedule.breakEnd, schedule.breakEndPeriod)
  if (breakStart === null || breakEnd === null) {
    return [] as Array<{ start: number; end: number }>
  }

  const [normalizedStart, normalizedBreakStart, normalizedBreakEnd, normalizedEnd] =
    normalizeSequentialTimes([start, breakStart, breakEnd, end])

  if (!(normalizedStart < normalizedBreakStart && normalizedBreakStart < normalizedBreakEnd && normalizedBreakEnd < normalizedEnd)) {
    return [] as Array<{ start: number; end: number }>
  }

  return [
    { start: normalizedStart, end: normalizedBreakStart },
    { start: normalizedBreakEnd, end: normalizedEnd },
  ]
}

function buildSuggestedCoverageTimeTarget(
  dayKey: CoverageDayKey,
  daySettings: CompanyPublicServiceDay,
  currentTargets: CoverageTimeTarget[],
): CoverageTimeTarget {
  const nextIndex = currentTargets.length + 1
  const baseTarget: CoverageTimeTarget = {
    id: dayKey + '-target-' + String(nextIndex),
    start: '',
    end: '',
    minimumStaff: '1',
    functionTargets: [],
  }

  if (!daySettings.isOpen || !daySettings.start || !daySettings.end) {
    return baseTarget
  }

  if (daySettings.breakStart && daySettings.breakEnd) {
    const hasPreBreakTarget = currentTargets.some(
      (item) => item.start === daySettings.start && item.end === daySettings.breakStart,
    )
    if (!hasPreBreakTarget) {
      return {
        ...baseTarget,
        start: daySettings.start,
        end: daySettings.breakStart,
      }
    }

    const hasPostBreakTarget = currentTargets.some(
      (item) => item.start === daySettings.breakEnd && item.end === daySettings.end,
    )
    if (!hasPostBreakTarget) {
      return {
        ...baseTarget,
        start: daySettings.breakEnd,
        end: daySettings.end,
      }
    }
  }

  return {
    ...baseTarget,
    start: daySettings.start,
    end: daySettings.end,
  }
}

function findActiveCoverageTimeTarget(
  dayTarget: CoverageDayTarget,
  slotStart: number,
  slotEnd: number,
) {
  return dayTarget.timeTargets.find((timeTarget) => {
    const start = parseTwentyFourHourValue(timeTarget.start)
    const end = parseTwentyFourHourValue(timeTarget.end)
    if (start === null || end === null) {
      return false
    }

    const [normalizedStart, normalizedEnd] = normalizeSequentialTimes([start, end])
    return normalizedStart < slotEnd && normalizedEnd > slotStart
  }) ?? null
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
    companies: normalizeLinkedCompanyIdsInCollection(state.companies).map((item) => ({
      ...item,
      suggestedCollectiveAgreementId: item.suggestedCollectiveAgreementId ?? null,
      defaultScaleViewMode: item.defaultScaleViewMode ?? 'week',
      defaultReportId: item.defaultReportId ?? 'scale-consolidated',
      defaultPrintIncludeExtras: item.defaultPrintIncludeExtras ?? false,
      allowPastScaleEdits: item.allowPastScaleEdits ?? false,
      publicServiceHours: normalizePublicServiceHours(item.publicServiceHours),
      coverageTargets: normalizeCoverageTargets(item.coverageTargets),
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
      sectionAccess: normalizeSectionAccess(item.role, item.sectionAccess),
      linkedCollaboratorId: item.linkedCollaboratorId ?? null,
      isActive: item.isActive ?? true,
    })),
    auditLogs: normalizeAuditLogs(state.auditLogs),
  }
}

function validateSchedule(
  values: ScheduleFormState,
  company: CompanyRecord | null,
  agreement: CollectiveAgreementRecord | null,
): ValidationResult {
  const blockingErrors: string[] = []
  const infractions: string[] = []
  const notes: string[] = []
  const schedulePreview = buildSchedulePreview(values)

  if (!values.shiftName.trim()) {
    blockingErrors.push('Informe o nome do turno.')
  }

  blockingErrors.push(...schedulePreview.issues)

  if (schedulePreview.netMinutes !== undefined) {
    const start = parseTime(values.startTime, values.startPeriod)
    const end = parseTime(values.endTime, values.endPeriod)
    const grossDuration =
      schedulePreview.grossMinutes ??
      (start !== null && end !== null ? normalizeSequentialTimes([start, end])[1] - normalizeSequentialTimes([start, end])[0] : undefined)
    const breakDuration = schedulePreview.breakDurationMinutes ?? 0
    const netDuration = schedulePreview.netMinutes

    if (grossDuration !== undefined) {
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
            infractions.push(
              `Para empresa habilitada em regramento especifico, o intervalo deve ficar entre ${specialBreakMin} e ${specialBreakMax} minutos.`,
            )
          }
        } else {
          if (breakDuration < standardLongBreak) {
            infractions.push(
              `Jornadas acima de 6 horas exigem ao menos ${standardLongBreak} minutos de intervalo intrajornada.`,
            )
          }

          const maxBreakAllowed =
            company?.collectiveProfile === 'plano-saude' ? healthPlanBreakMax : standardBreakMax

          if (breakDuration > maxBreakAllowed) {
            infractions.push(
              company?.collectiveProfile === 'plano-saude'
                ? `Com perfil de plano de saude, o intervalo nao pode exceder ${healthPlanBreakMax} minutos nesta CCT.`
                : `Nesta CCT, intervalos acima de ${standardBreakMax} minutos exigem habilitacao especifica da empresa.`,
            )
          }
        }
      }

      if (grossDuration > midShiftThreshold && grossDuration <= longShiftThreshold && breakDuration < shortBreak) {
        infractions.push(`Jornadas entre 4 e 6 horas exigem ao menos ${shortBreak} minutos de intervalo.`)
      }

      if (netDuration > 480) {
        notes.push('Jornadas liquidas acima de 8 horas pedem verificacao de compensacao, acordo ou horas extras.')
      }

      if (netDuration > maxDailyMinutes) {
        infractions.push(
          `A jornada liquida ultrapassa ${Math.floor(maxDailyMinutes / 60)} horas e precisa de revisao antes do uso.`,
        )
      }
    }
  }

  if (!company) {
    blockingErrors.push('Selecione uma empresa antes de cadastrar horarios.')
  } else if (!agreement) {
    infractions.push(
      `Nao ha convencao coletiva parametrizada para ${company.city}/${company.state}. O horario pode ser salvo, mas ficara sem validacao regulatoria automatica.`,
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

  const canOverride = blockingErrors.length === 0 && infractions.length > 0

  return {
    valid: blockingErrors.length === 0 && infractions.length === 0,
    errors: blockingErrors.length > 0 ? blockingErrors : infractions,
    notes,
    netMinutes: blockingErrors.length === 0 ? schedulePreview.netMinutes : undefined,
    canOverride,
  }
}

function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('Painel')
  const [companies, setCompanies] = useState<CompanyRecord[]>(() =>
    normalizeLinkedCompanyIdsInCollection(
      readStoredValue<Array<CompanyRecord & { suggestedCollectiveAgreementId?: number | null; linkedCompanyIds?: number[] }>>(storageKeys.companies, []),
    ).map((item) => ({
      ...item,
      suggestedCollectiveAgreementId: item.suggestedCollectiveAgreementId ?? null,
      publicServiceHours: normalizePublicServiceHours(item.publicServiceHours),
      coverageTargets: normalizeCoverageTargets(item.coverageTargets),
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
  const [auditLogs, setAuditLogs] = useState<AuditLogRecord[]>(() =>
    normalizeAuditLogs(readStoredValue<AuditLogRecord[]>(storageKeys.auditLogs, [])),
  )
  const [persistenceMode, setPersistenceMode] = useState<'pending' | 'local' | 'api'>('pending')
  const [isPersistenceReady, setIsPersistenceReady] = useState(false)
  const skipNextRemoteSyncRef = useRef(false)
  const skipNextModuleSyncRef = useRef<Record<ModularStateKey, boolean>>({
    companies: false,
    agreements: false,
    sectors: false,
    functions: false,
    collaboratorProfiles: false,
    collaborators: false,
    schedules: false,
    scaleAssignments: false,
    scaleComments: false,
    scaleExtraRoster: false,
    users: false,
    auditLogs: false,
  })
  const remoteSyncTimeoutRef = useRef<number | null>(null)
  const pendingDiscardActionRef = useRef<(() => void) | null>(null)
  const pendingScaleReplicationRef = useRef<(() => void) | null>(null)
  const pendingScaleBatchRef = useRef<(() => void) | null>(null)
  const pendingImpactActionRef = useRef<((replacementValue: string) => void) | null>(null)
  const initialLocalDataPresenceRef = useRef({
    companies: companies.length,
    users: users.length,
    collaborators: collaborators.length,
    functions: functions.length,
    schedules: schedules.length,
    scaleAssignments: scaleAssignments.length,
  })
  const [session, setSession] = useState<Session | null>(() =>
    readStoredValue<Session | null>(storageKeys.session, null),
  )
  const [currentCompanyId, setCurrentCompanyId] = useState<number | null>(() =>
    readStoredValue<number | null>(storageKeys.currentCompanyId, null),
  )
  const [loginForm, setLoginForm] = useState({ username: '', password: '' })
  const [loginError, setLoginError] = useState('')
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm)
  const [companyLinkedCompanyIds, setCompanyLinkedCompanyIds] = useState<number[]>([])
  const [companyPublicServiceHours, setCompanyPublicServiceHours] = useState<CompanyPublicServiceHours>(buildEmptyPublicServiceHours())
  const [companyCoverageTargets, setCompanyCoverageTargets] = useState<CompanyCoverageTargets>(buildEmptyCoverageTargets())
  const [functionForm, setFunctionForm] = useState(emptyFunctionForm)
  const [collaboratorForm, setCollaboratorForm] = useState(emptyCollaboratorForm)
  const [scheduleForm, setScheduleForm] = useState(emptyScheduleForm)
  const [userForm, setUserForm] = useState(emptyUserForm)
  const [agreementForm, setAgreementForm] = useState(emptyAgreementForm)
  const [editingAgreementId, setEditingAgreementId] = useState<number | null>(null)
  const [scheduleFeedback, setScheduleFeedback] = useState<ValidationResult | null>(null)
  const pendingScheduleOverrideRef = useRef<(() => void) | null>(null)
  const [scheduleWarning, setScheduleWarning] = useState<{
    title: string
    messages: string[]
    confirmLabel?: string
  } | null>(null)
  const [collaboratorWarning, setCollaboratorWarning] = useState<{ title: string; messages: string[] } | null>(null)
  const [functionWarning, setFunctionWarning] = useState<{ title: string; messages: string[] } | null>(null)
  const [functionCloneModal, setFunctionCloneModal] = useState<FunctionCloneModalState | null>(null)
  const [scheduleCloneModal, setScheduleCloneModal] = useState<ScheduleCloneModalState | null>(null)
  const [userWarning, setUserWarning] = useState<{ title: string; messages: string[] } | null>(null)
  const [impactWarning, setImpactWarning] = useState<ImpactWarningState | null>(null)
  const [discardWarning, setDiscardWarning] = useState<{ title: string; message: string } | null>(null)
  const [collaboratorListSearch, setCollaboratorListSearch] = useState('')
  const [functionListSearch, setFunctionListSearch] = useState('')
  const [scheduleListSearch, setScheduleListSearch] = useState('')
  const [collaboratorListColumnOrder, setCollaboratorListColumnOrder] = useState(
    collaboratorListDefaultColumnOrder,
  )
  const [functionListColumnOrder, setFunctionListColumnOrder] = useState(functionListDefaultColumnOrder)
  const [scheduleListColumnOrder, setScheduleListColumnOrder] = useState(scheduleListDefaultColumnOrder)
  const [editingFunctionId, setEditingFunctionId] = useState<number | null>(null)
  const [editingScheduleId, setEditingScheduleId] = useState<number | null>(null)
  const [editingUserId, setEditingUserId] = useState<number | null>(null)
  const [isLoginPasswordVisible, setIsLoginPasswordVisible] = useState(false)
  const [isUserFormPasswordVisible, setIsUserFormPasswordVisible] = useState(false)
  const [visibleUserPasswords, setVisibleUserPasswords] = useState<Record<number, boolean>>({})
  const [scaleViewMode, setScaleViewMode] = useState<ScaleViewMode>('week')
  const [lastScalePlanningViewMode, setLastScalePlanningViewMode] = useState<'week' | 'month'>('week')
  const [scaleCoverageDate, setScaleCoverageDate] = useState(toIsoDate(new Date()))
  const [scaleAnchorDate, setScaleAnchorDate] = useState(toIsoDate(new Date()))
  const [scaleMonth, setScaleMonth] = useState(toIsoDate(new Date()).slice(0, 7))
  const [scaleSectorFilter, setScaleSectorFilter] = useState('Todos')
  const [scaleFunctionFilter, setScaleFunctionFilter] = useState('Todos')
  const [scaleSearch, setScaleSearch] = useState('')
  const [scaleShowIrregularOnly, setScaleShowIrregularOnly] = useState(false)
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
  const [scaleBatchModal, setScaleBatchModal] = useState<ScaleBatchModalState | null>(null)
  const [scaleBatchWarning, setScaleBatchWarning] = useState<{
    title: string
    messages: string[]
    confirmLabel: string
  } | null>(null)
  const [scaleReplicationModal, setScaleReplicationModal] = useState<ScaleReplicationModalState | null>(null)
  const [scaleReplicationWarning, setScaleReplicationWarning] = useState<{
    title: string
    messages: string[]
    confirmLabel: string
  } | null>(null)
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
  const [coverageSettingsFeedback, setCoverageSettingsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [activeMasterPanelSection, setActiveMasterPanelSection] = useState<MasterPanelSection>('Auditoria')
  const [masterPanelSearch, setMasterPanelSearch] = useState('')
  const [masterPanelSeverityFilter, setMasterPanelSeverityFilter] =
    useState<'Todas' | 'info' | 'warning' | 'critical'>('Todas')
  const [masterPanelModuleFilter, setMasterPanelModuleFilter] = useState('Todos')

  const currentCompany =
    currentCompanyId === null ? null : companies.find((item) => item.id === currentCompanyId) ?? null
  const currentCompanyUserMemberships = session?.kind === 'companyUser' ? session.memberships : []
  const currentCompanyMembershipCompanies =
    session?.kind === 'companyUser'
      ? session.memberships
          .map((membership) => companies.find((item) => item.id === membership.companyId) ?? null)
          .filter((item): item is CompanyRecord => item !== null)
      : []
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
  function getCompanyLinkScopeIds(companyId: number | null) {
    if (companyId === null) {
      return [] as number[]
    }

    const directLinkedCompanyIds =
      companies.find((item) => item.id === companyId)?.linkedCompanyIds.filter((linkedCompanyId) => linkedCompanyId !== companyId) ?? []
    const reverseLinkedCompanyIds = companies
      .filter((item) => item.id !== companyId && item.linkedCompanyIds.includes(companyId))
      .map((item) => item.id)

    return Array.from(new Set([companyId, ...directLinkedCompanyIds, ...reverseLinkedCompanyIds])).sort(
      (left, right) => left - right,
    )
  }

  const currentCompanyLinkScopeIds = getCompanyLinkScopeIds(currentCompanyId)
  const companySectors = currentCompanyId === null ? [] : sectors.filter((item) => item.companyId === currentCompanyId)
  const companyFunctions =
    currentCompanyId === null ? [] : functions.filter((item) => currentCompanyLinkScopeIds.includes(item.companyId))
  const localCompanyFunctions = currentCompanyId === null ? [] : functions.filter((item) => item.companyId === currentCompanyId)
  const companyCollaborators =
    currentCompanyId === null ? [] : collaborators.filter((item) => item.companyId === currentCompanyId)
  const companySchedules =
    currentCompanyId === null ? [] : schedules.filter((item) => currentCompanyLinkScopeIds.includes(item.companyId))
  const localCompanySchedules = currentCompanyId === null ? [] : schedules.filter((item) => item.companyId === currentCompanyId)
  const companyScaleAssignments =
    currentCompanyId === null ? [] : scaleAssignments.filter((item) => item.companyId === currentCompanyId)
  const companyScaleComments =
    currentCompanyId === null ? [] : scaleComments.filter((item) => item.companyId === currentCompanyId)
  const companyScaleExtraRoster =
    currentCompanyId === null ? [] : scaleExtraRoster.filter((item) => item.companyId === currentCompanyId)
  const companyUsers = currentCompanyId === null ? [] : users.filter((item) => item.companyId === currentCompanyId)
  const companyLinkableOptions =
    currentCompanyId === null
      ? companies.filter((item) => item.status === 'ATIVA')
      : companies.filter((item) => item.id !== currentCompanyId && item.status === 'ATIVA')
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
  const getCompanyTradeNameById = useCallback(
    (companyId: number) => companies.find((item) => item.id === companyId)?.tradeName ?? String(companyId),
    [companies],
  )
  const openScaleCoverageForDate = useCallback((dateValue: string) => {
    setScaleCoverageDate(dateValue)
    setScaleAnchorDate(dateValue)
    setScaleMonth(dateValue.slice(0, 7))
    setScaleViewMode('coverage')
  }, [])
  const collaboratorProfileByCpf = useMemo(
    () =>
      collaboratorProfiles.reduce<Record<string, CollaboratorProfileRecord>>((accumulator, profile) => {
        accumulator[profile.cpf.replace(/\D/g, '')] = profile
        return accumulator
      }, {}),
    [collaboratorProfiles],
  )
  const collaboratorListColumns = useMemo(
    () => [
      {
        key: 'nome',
        label: 'Nome',
        getValue: (item: CollaboratorRecord) =>
          collaboratorProfileByCpf[item.cpf.replace(/\D/g, '')]?.fullName ?? item.cpf,
        renderCell: (item: CollaboratorRecord) => (
          <strong>{collaboratorProfileByCpf[item.cpf.replace(/\D/g, '')]?.fullName ?? item.cpf}</strong>
        ),
      },
      { key: 'cpf', label: 'CPF', getValue: (item: CollaboratorRecord) => item.cpf },
      { key: 'vinculo', label: 'Vinculo', getValue: (item: CollaboratorRecord) => item.employmentType },
      { key: 'funcoes', label: 'Funcoes', getValue: (item: CollaboratorRecord) => item.functions.join(', ') },
      { key: 'principal', label: 'Principal', getValue: (item: CollaboratorRecord) => item.primaryFunction },
      {
        key: 'contato',
        label: 'Contato',
        getValue: (item: CollaboratorRecord) =>
          collaboratorProfileByCpf[item.cpf.replace(/\D/g, '')]?.contact ?? 'Contato pendente',
      },
      {
        key: 'pix',
        label: 'PIX',
        getValue: (item: CollaboratorRecord) =>
          collaboratorProfileByCpf[item.cpf.replace(/\D/g, '')]?.pixKey ?? 'PIX pendente',
      },
      {
        key: 'status',
        label: 'Status',
        getValue: (item: CollaboratorRecord) => (item.isActive ? 'Ativo' : 'Inativo'),
      },
    ],
    [collaboratorProfileByCpf],
  )
  const functionListColumns = useMemo(
    () => [
      {
        key: 'funcao',
        label: 'Funcao',
        getValue: (item: FunctionRecord) => item.name,
        renderCell: (item: FunctionRecord) => <strong>{item.name}</strong>,
      },
      {
        key: 'origem',
        label: 'Origem',
        getValue: (item: FunctionRecord) =>
          item.companyId === currentCompanyId ? 'Empresa atual' : getCompanyTradeNameById(item.companyId),
      },
      { key: 'setor', label: 'Setor', getValue: (item: FunctionRecord) => item.sector },
      {
        key: 'salario',
        label: 'Base salarial',
        getValue: (item: FunctionRecord) => formatCurrency(parseCurrencyValue(item.baseSalary || '0')),
      },
      { key: 'cota', label: 'Cota', getValue: (item: FunctionRecord) => item.serviceQuota || 'Nao informada' },
      {
        key: 'extra',
        label: 'Paga extra',
        getValue: (item: FunctionRecord) =>
          item.extraPayValue ? formatCurrency(parseCurrencyValue(item.extraPayValue)) : 'Nao informado',
      },
      { key: 'descricao', label: 'Descritivo', getValue: (item: FunctionRecord) => item.description },
      {
        key: 'status',
        label: 'Status',
        getValue: (item: FunctionRecord) => (item.isActive ? 'Ativa' : 'Inativa'),
      },
    ],
    [currentCompanyId, getCompanyTradeNameById],
  )
  const scheduleListColumns = useMemo(
    () => [
      {
        key: 'turno',
        label: 'Turno',
        getValue: (item: ScheduleRecord) => item.shiftName,
        renderCell: (item: ScheduleRecord) => <strong>{item.shiftName}</strong>,
      },
      {
        key: 'origem',
        label: 'Origem',
        getValue: (item: ScheduleRecord) =>
          item.companyId === currentCompanyId ? 'Empresa atual' : getCompanyTradeNameById(item.companyId),
      },
      { key: 'sigla', label: 'Sigla', getValue: (item: ScheduleRecord) => item.abbreviation },
      { key: 'entrada', label: 'Entrada', getValue: (item: ScheduleRecord) => item.startTime + ' ' + item.startPeriod },
      {
        key: 'pausa',
        label: 'Inicio pausa',
        getValue: (item: ScheduleRecord) =>
          item.breakStart && item.breakEnd ? item.breakStart + ' ' + item.breakStartPeriod : 'Sem pausa',
      },
      {
        key: 'retorno',
        label: 'Fim pausa',
        getValue: (item: ScheduleRecord) =>
          item.breakStart && item.breakEnd ? item.breakEnd + ' ' + item.breakEndPeriod : 'Nao se aplica',
      },
      { key: 'saida', label: 'Saida', getValue: (item: ScheduleRecord) => item.endTime + ' ' + item.endPeriod },
      { key: 'jornada', label: 'Horas', getValue: (item: ScheduleRecord) => formatWorkedHours(item.netMinutes) },
      {
        key: 'status',
        label: 'Status',
        getValue: (item: ScheduleRecord) => (item.isActive ? 'Ativo' : 'Inativo'),
      },
      { key: 'validacao', label: 'Validacao', getValue: (item: ScheduleRecord) => item.validationMessage },
    ],
    [currentCompanyId, getCompanyTradeNameById],
  )
  const additionalUserCompanyOptions =
    currentCompanyId === null
      ? []
      : companies
          .filter(
            (item) => item.id !== currentCompanyId && item.status === 'ATIVA' && currentCompanyLinkScopeIds.includes(item.id),
          )
          .sort((left, right) => left.tradeName.localeCompare(right.tradeName))
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
  const effectiveSectionAccess =
    session?.kind === 'systemAdmin'
      ? appSections.reduce(
          (accumulator, section) => {
            accumulator[section] = true
            return accumulator
          },
          {} as UserSectionAccess,
        )
      : session?.kind === 'companyUser'
        ? normalizeSectionAccess(session.user.role, session.user.sectionAccess)
        : buildDefaultSectionAccessByRole('Visualizador')
  const sessionSectorAccess =
    session?.kind === 'systemAdmin' || session?.user.role === 'Administrativo'
      ? availableSectorNames
      : session?.kind === 'companyUser'
        ? session.user.sectors
        : []
  const canManageData = !!currentCompany && !isViewer
  const canViewScale = !!currentCompany && effectiveSectionAccess.Escala
  const canEditScale =
    !!currentCompany &&
    effectiveSectionAccess.Escala &&
    (session?.kind === 'systemAdmin' || (session?.kind === 'companyUser' && session.user.role !== 'Visualizador'))
  const scalePanelMode = scaleViewMode === 'coverage' ? 'coverage' : 'planning'

  const todayIso = toIsoDate(new Date())
  const visibleScaleSectorOptions =
    session?.kind === 'companyUser' ? session.user.sectors : availableSectorNames
  const effectiveScaleSectorFilter =
    scaleSectorFilter === 'Todos' || !visibleScaleSectorOptions.includes(scaleSectorFilter)
      ? 'Todos'
      : scaleSectorFilter
  const visibleScaleFunctionOptions = Array.from(
    new Set(
      companyCollaborators
        .filter((item) => {
          const sectorName = getCollaboratorSector(item)
          return effectiveScaleSectorFilter === 'Todos' || sectorName === effectiveScaleSectorFilter
        })
        .map((item) => item.primaryFunction)
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right))
  const effectiveScaleFunctionFilter =
    scaleFunctionFilter === 'Todos' || visibleScaleFunctionOptions.includes(scaleFunctionFilter)
      ? scaleFunctionFilter
      : 'Todos'
  const visibleAppSections: AppSection[] = appSections.filter((section) => effectiveSectionAccess[section])
  const canManageCollaboratorActivation =
    effectiveSectionAccess.Colaboradores &&
    (session?.kind === 'systemAdmin' ||
      session?.user.role === 'Administrativo' ||
      session?.user.role === 'Gestor')
  const currentSessionActor =
    session === null
      ? null
      : {
          name: session.user.fullName,
          role: session.kind === 'systemAdmin' ? 'Master' : session.user.role,
        }
  const currentCompanyAuditLogs = getCurrentCompanyAuditLogs(auditLogs, currentCompanyId)
  const auditAlertLogs = getAuditAlertLogs(currentCompanyAuditLogs)
  const auditImpactLogs = getAuditImpactLogs(currentCompanyAuditLogs)
  const masterPanelModuleOptions = [
    'Todos',
    ...Array.from(new Set(currentCompanyAuditLogs.map((item) => item.module))).sort((left, right) =>
      left.localeCompare(right),
    ),
  ]
  const activeMasterPanelLogs = filterAuditLogs(
    activeMasterPanelSection === 'Auditoria'
      ? currentCompanyAuditLogs
      : activeMasterPanelSection === 'Alertas'
        ? auditAlertLogs
        : auditImpactLogs,
    {
      search: masterPanelSearch,
      module: masterPanelModuleFilter,
      severity: masterPanelSeverityFilter,
    },
  )
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
  const activeScaleReplicationCollaborator =
    scaleReplicationModal === null
      ? null
      : companyCollaborators.find((item) => item.id === scaleReplicationModal.collaboratorId) ?? null
  const activeScaleReplicationPreview = (() => {
    if (
      scaleReplicationModal === null ||
      activeScaleReplicationCollaborator === null ||
      currentCompanyId === null
    ) {
      return []
    }

    const { replicationPlan } = buildScaleReplicationPlan(scaleReplicationModal)
    const sourceAssignmentByDate = new Map(
      companyScaleAssignments
        .filter(
          (assignment) =>
            assignment.companyId === currentCompanyId &&
            assignment.collaboratorId === activeScaleReplicationCollaborator.id,
        )
        .map((assignment) => [assignment.date, assignment]),
    )
    const currentMaxId = scaleAssignments.reduce((max, item) => Math.max(max, item.id), 0)
    let nextId = currentMaxId
    const simulatedAssignments = scaleAssignments.filter((assignment) => {
      if (
        assignment.companyId !== currentCompanyId ||
        assignment.collaboratorId !== activeScaleReplicationCollaborator.id
      ) {
        return true
      }

      const replicationTarget =
        replicationPlan.find((planItem) => planItem.targetDate === assignment.date) ?? null
      if (!replicationTarget) {
        return true
      }

      const sourceAssignment = sourceAssignmentByDate.get(replicationTarget.sourceDate) ?? null
      if (!scaleReplicationModal.overwriteExisting && sourceAssignment) {
        return true
      }

      if (!scaleReplicationModal.overwriteExisting && !sourceAssignment) {
        return true
      }

      if (!scaleReplicationModal.copyDaysOff && !sourceAssignment) {
        return true
      }

      return false
    })

    replicationPlan.forEach(({ sourceDate, targetDate }) => {
      const sourceAssignment = sourceAssignmentByDate.get(sourceDate) ?? null
      const hasExistingTarget = simulatedAssignments.some(
        (assignment) =>
          assignment.companyId === currentCompanyId &&
          assignment.collaboratorId === activeScaleReplicationCollaborator.id &&
          assignment.date === targetDate,
      )

      if (!sourceAssignment) {
        return
      }

      if (hasExistingTarget && !scaleReplicationModal.overwriteExisting) {
        return
      }

      nextId += 1
      simulatedAssignments.push({
        id: nextId,
        companyId: currentCompanyId,
        collaboratorId: activeScaleReplicationCollaborator.id,
        date: targetDate,
        scheduleId: sourceAssignment.scheduleId,
      })
    })

    const issuesByWeekStart = new Map<string, string[]>()
    Array.from(new Set(replicationPlan.map((item) => toIsoDate(startOfWeek(item.targetDate))))).forEach(
      (weekStart) => {
        issuesByWeekStart.set(
          weekStart,
          validateScaleRow(
            activeScaleReplicationCollaborator,
            getWeekDates(weekStart),
            simulatedAssignments.filter((assignment) => assignment.companyId === currentCompanyId),
          ).issues,
        )
      },
    )

    return replicationPlan.map((item) => {
      const targetAssignment =
        companyScaleAssignments.find(
          (assignment) =>
            assignment.collaboratorId === activeScaleReplicationCollaborator.id &&
            assignment.date === item.targetDate,
        ) ?? null
      const sourceAssignment = sourceAssignmentByDate.get(item.sourceDate) ?? null
      const sourceSchedule = sourceAssignment ? getScheduleById(sourceAssignment.scheduleId) : null
      const targetSchedule = targetAssignment ? getScheduleById(targetAssignment.scheduleId) : null
      const irregularityMessages =
        issuesByWeekStart.get(toIsoDate(startOfWeek(item.targetDate))) ?? []

      return {
        ...item,
        sourceLabel: sourceSchedule?.abbreviation ?? 'Folga',
        targetLabel: targetSchedule?.abbreviation ?? 'Sem escala',
        willOverwrite: !!targetAssignment && scaleReplicationModal.overwriteExisting,
        alreadyFilled: !!targetAssignment,
        hasIrregularityRisk: irregularityMessages.length > 0,
        irregularityMessages,
      }
    })
  })()
  const activeScaleReplicationPreviewSummary = Array.from(
    activeScaleReplicationPreview.reduce(
      (accumulator, item) => {
        const weekStart = toIsoDate(startOfWeek(item.targetDate))
        const current = accumulator.get(weekStart) ?? {
          weekStart,
          total: 0,
          overwrite: 0,
          fillEmpty: 0,
          keepExisting: 0,
          risk: 0,
        }

        current.total += 1
        if (item.willOverwrite) {
          current.overwrite += 1
        } else if (item.alreadyFilled) {
          current.keepExisting += 1
        } else {
          current.fillEmpty += 1
        }

        if (item.hasIrregularityRisk) {
          current.risk += 1
        }

        accumulator.set(weekStart, current)
        return accumulator
      },
      new Map<
        string,
        {
          weekStart: string
          total: number
          overwrite: number
          fillEmpty: number
          keepExisting: number
          risk: number
        }
      >(),
    ),
  )
    .map(([, value]) => value)
    .sort((left, right) => left.weekStart.localeCompare(right.weekStart))
  const activeScaleBatchState = scaleBatchModal
    ? resolveScaleBatchRuntimeState(scaleBatchModal)
    : { weekDates: [], targetRows: [], errorMessage: null as string | null }
  const activeScaleBatchWeekDates = activeScaleBatchState.weekDates
  const activeScaleBatchRows = activeScaleBatchState.targetRows
  const activeScaleBatchErrorMessage = activeScaleBatchState.errorMessage
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
  const companyLinksField = session?.kind === 'systemAdmin' ? (
    <div className="field-span">
      <span className="field-title">Empresas vinculadas</span>
      {companyLinkableOptions.length === 0 ? (
        <small>Nenhuma outra empresa ativa disponivel para vinculo.</small>
      ) : (
        <div className="selector-grid">
          {companyLinkableOptions.map((company) => {
            const checked = companyLinkedCompanyIds.includes(company.id)
            return (
              <label key={company.id} className="checkbox-card">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setCompanyLinkedCompanyIds((current) =>
                      checked ? current.filter((item) => item !== company.id) : [...current, company.id].sort((left, right) => left - right),
                    )
                  }
                />
                <span>{company.tradeName} • {company.city}/{company.state}</span>
              </label>
            )
          })}
        </div>
      )}
      <small>O vinculo autoriza compartilhamento de funcoes e horarios, mas nao mistura colaboradores nem escala.</small>
    </div>
  ) : null
  const companyPublicServiceField = (
    <div className="field-span company-public-service-panel">
      <div className="field-heading">
        <span className="field-title">Atendimento ao publico por dia da semana</span>
        <span className="field-helper">Usado apenas na visualizacao de cobertura diaria. Nao limita os horarios dos colaboradores.</span>
      </div>
      <div className="company-public-service-grid">
        {coverageDayKeys.map((dayKey) => {
          const daySettings = companyPublicServiceHours[dayKey]
          return (
            <article key={dayKey} className="company-public-service-card">
              <label className="toggle-field">
                <span>{coverageDayLabels[dayKey]}</span>
                <input
                  type="checkbox"
                  checked={daySettings.isOpen}
                  onChange={(event) =>
                    setCompanyPublicServiceHours((current) => ({
                      ...current,
                      [dayKey]: {
                        ...current[dayKey],
                        isOpen: event.target.checked,
                      },
                    }))
                  }
                />
              </label>
              <div className="company-public-service-times">
                <label>
                  Inicio
                  <input
                    type="time"
                    value={daySettings.start}
                    disabled={!daySettings.isOpen}
                    onChange={(event) =>
                      setCompanyPublicServiceHours((current) => ({
                        ...current,
                        [dayKey]: {
                          ...current[dayKey],
                          start: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Inicio pausa
                  <input
                    type="time"
                    value={daySettings.breakStart}
                    disabled={!daySettings.isOpen}
                    onChange={(event) =>
                      setCompanyPublicServiceHours((current) => ({
                        ...current,
                        [dayKey]: {
                          ...current[dayKey],
                          breakStart: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Fim pausa
                  <input
                    type="time"
                    value={daySettings.breakEnd}
                    disabled={!daySettings.isOpen}
                    onChange={(event) =>
                      setCompanyPublicServiceHours((current) => ({
                        ...current,
                        [dayKey]: {
                          ...current[dayKey],
                          breakEnd: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  Fim
                  <input
                    type="time"
                    value={daySettings.end}
                    disabled={!daySettings.isOpen}
                    onChange={(event) =>
                      setCompanyPublicServiceHours((current) => ({
                        ...current,
                        [dayKey]: {
                          ...current[dayKey],
                          end: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
              </div>
              <div className="company-coverage-targets-panel">
                <label>
                  Meta padrao do dia
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={companyCoverageTargets[dayKey].defaultMinimumStaff}
                    onChange={(event) =>
                      setCompanyCoverageTargets((current) => ({
                        ...current,
                        [dayKey]: {
                          ...current[dayKey],
                          defaultMinimumStaff: event.target.value.replace(/\D/g, '').slice(0, 2),
                        },
                      }))
                    }
                  />
                </label>
                <div className="company-coverage-time-targets">
                  {companyCoverageTargets[dayKey].timeTargets.map((timeTarget, targetIndex) => (
                    <article key={timeTarget.id} className="company-coverage-time-target-card">
                      <div className="company-coverage-time-target-header">
                        <div>
                          <strong>
                            {timeTarget.start && timeTarget.end
                              ? `${timeTarget.start} - ${timeTarget.end}`
                              : 'Faixa sem horario completo'}
                          </strong>
                          <small>
                            Meta total {timeTarget.minimumStaff || companyCoverageTargets[dayKey].defaultMinimumStaff || '0'}
                            {timeTarget.functionTargets.length > 0
                              ? ` • ${timeTarget.functionTargets.length} meta(s) por funcao`
                              : ' • sem meta por funcao'}
                          </small>
                        </div>
                      </div>
                      <div className="company-public-service-times compact">
                        <label>
                          Inicio
                          <input
                            type="time"
                            value={timeTarget.start}
                            onChange={(event) =>
                              setCompanyCoverageTargets((current) => ({
                                ...current,
                                [dayKey]: {
                                  ...current[dayKey],
                                  timeTargets: current[dayKey].timeTargets.map((item, itemIndex) =>
                                    itemIndex === targetIndex ? { ...item, start: event.target.value } : item,
                                  ),
                                },
                              }))
                            }
                          />
                        </label>
                        <label>
                          Fim
                          <input
                            type="time"
                            value={timeTarget.end}
                            onChange={(event) =>
                              setCompanyCoverageTargets((current) => ({
                                ...current,
                                [dayKey]: {
                                  ...current[dayKey],
                                  timeTargets: current[dayKey].timeTargets.map((item, itemIndex) =>
                                    itemIndex === targetIndex ? { ...item, end: event.target.value } : item,
                                  ),
                                },
                              }))
                            }
                          />
                        </label>
                        <label>
                          Meta total
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={timeTarget.minimumStaff}
                            onChange={(event) =>
                              setCompanyCoverageTargets((current) => ({
                                ...current,
                                [dayKey]: {
                                  ...current[dayKey],
                                  timeTargets: current[dayKey].timeTargets.map((item, itemIndex) =>
                                    itemIndex === targetIndex
                                      ? { ...item, minimumStaff: event.target.value.replace(/\D/g, '').slice(0, 2) }
                                      : item,
                                  ),
                                },
                              }))
                            }
                          />
                        </label>
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() =>
                            setCompanyCoverageTargets((current) => ({
                              ...current,
                              [dayKey]: {
                                ...current[dayKey],
                                timeTargets: current[dayKey].timeTargets.filter((_, itemIndex) => itemIndex !== targetIndex),
                              },
                            }))
                          }
                        >
                          Remover faixa
                        </button>
                      </div>
                      <div className="company-coverage-function-targets">
                        {timeTarget.functionTargets.map((functionTarget, functionIndex) => (
                          <div key={timeTarget.id + '-fn-' + String(functionIndex)} className="company-coverage-function-target-row">
                            <label>
                              Funcao
                              <input
                                list="company-function-options-main"
                                value={functionTarget.functionName}
                                onChange={(event) =>
                                  setCompanyCoverageTargets((current) => ({
                                    ...current,
                                    [dayKey]: {
                                      ...current[dayKey],
                                      timeTargets: current[dayKey].timeTargets.map((item, itemIndex) =>
                                        itemIndex === targetIndex
                                          ? {
                                              ...item,
                                              functionTargets: item.functionTargets.map((fnItem, fnIndex) =>
                                                fnIndex === functionIndex
                                                  ? { ...fnItem, functionName: event.target.value }
                                                  : fnItem,
                                              ),
                                            }
                                          : item,
                                      ),
                                    },
                                  }))
                                }
                              />
                            </label>
                            <label>
                              Meta
                              <input
                                type="number"
                                min="0"
                                step="1"
                                value={functionTarget.minimumStaff}
                                onChange={(event) =>
                                  setCompanyCoverageTargets((current) => ({
                                    ...current,
                                    [dayKey]: {
                                      ...current[dayKey],
                                      timeTargets: current[dayKey].timeTargets.map((item, itemIndex) =>
                                        itemIndex === targetIndex
                                          ? {
                                              ...item,
                                              functionTargets: item.functionTargets.map((fnItem, fnIndex) =>
                                                fnIndex === functionIndex
                                                  ? {
                                                      ...fnItem,
                                                      minimumStaff: event.target.value.replace(/\D/g, '').slice(0, 2),
                                                    }
                                                  : fnItem,
                                              ),
                                            }
                                          : item,
                                      ),
                                    },
                                  }))
                                }
                              />
                            </label>
                            <button
                              type="button"
                              className="ghost-button"
                              onClick={() =>
                                setCompanyCoverageTargets((current) => ({
                                  ...current,
                                  [dayKey]: {
                                    ...current[dayKey],
                                    timeTargets: current[dayKey].timeTargets.map((item, itemIndex) =>
                                      itemIndex === targetIndex
                                        ? {
                                            ...item,
                                            functionTargets: item.functionTargets.filter((_, fnIndex) => fnIndex !== functionIndex),
                                          }
                                        : item,
                                    ),
                                  },
                                }))
                              }
                            >
                              Remover funcao
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            setCompanyCoverageTargets((current) => ({
                              ...current,
                              [dayKey]: {
                                ...current[dayKey],
                                timeTargets: current[dayKey].timeTargets.map((item, itemIndex) =>
                                  itemIndex === targetIndex
                                    ? {
                                        ...item,
                                        functionTargets: [
                                          ...item.functionTargets,
                                          {
                                            functionName: '',
                                            minimumStaff: '1',
                                          },
                                        ],
                                      }
                                    : item,
                                ),
                              },
                            }))
                          }
                        >
                          Adicionar meta por funcao
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setCompanyCoverageTargets((current) => {
                      const suggestedTarget = buildSuggestedCoverageTimeTarget(
                        dayKey,
                        companyPublicServiceHours[dayKey],
                        current[dayKey].timeTargets,
                      )
                      return {
                        ...current,
                        [dayKey]: {
                          ...current[dayKey],
                          timeTargets: [
                            ...current[dayKey].timeTargets,
                            {
                              ...suggestedTarget,
                              minimumStaff: current[dayKey].defaultMinimumStaff || suggestedTarget.minimumStaff,
                            },
                          ],
                        },
                      }
                    })
                  }
                >
                  Adicionar faixa de cobertura
                </button>
              </div>
            </article>
          )
        })}
      </div>
      <datalist id="company-function-options-main">
        {availableFunctionNames.map((functionName) => (
          <option key={functionName} value={functionName} />
        ))}
      </datalist>
    </div>
  )
  const scaleWeeks = buildScaleWeeks()
  const scaleSectorOptions = ['Todos', ...visibleScaleSectorOptions]
  const scaleFunctionOptions = ['Todos', ...visibleScaleFunctionOptions]
  const visibleScaleCollaborators = companyCollaborators.filter((item) => {
    if (isViewer && currentViewerCollaboratorId !== item.id) {
      return false
    }

    const sectorName = getCollaboratorSector(item)
    if (effectiveScaleSectorFilter !== 'Todos' && sectorName !== effectiveScaleSectorFilter) {
      return false
    }

    if (
      effectiveScaleFunctionFilter !== 'Todos' &&
      item.primaryFunction !== effectiveScaleFunctionFilter
    ) {
      return false
    }

    if (scaleSearch.trim()) {
      const profile = getCollaboratorProfile(item.cpf)
      const haystack = [
        profile?.fullName ?? '',
        item.cpf,
        item.primaryFunction,
        item.employmentType,
        sectorName,
      ]
        .join(' ')
        .toLowerCase()

      if (!haystack.includes(scaleSearch.trim().toLowerCase())) {
        return false
      }
    }

    return visibleScaleSectorOptions.length === 0 || visibleScaleSectorOptions.includes(sectorName)
  })
  const visibleScaleExtras = visibleScaleCollaborators.filter((item) => item.employmentType === 'EXTRA')
  const scaleCoverageDayDate = new Date(scaleCoverageDate + 'T12:00:00')
  const scaleCoverageDayKey = getCoverageDayKey(scaleCoverageDayDate)
  const scaleCoveragePublicServiceSettings = currentCompany
    ? normalizePublicServiceHours(currentCompany.publicServiceHours)[scaleCoverageDayKey]
    : buildEmptyPublicServiceHours().monday
  const scaleCoverageDayTargets = currentCompany
    ? normalizeCoverageTargets(currentCompany.coverageTargets)[scaleCoverageDayKey]
    : buildEmptyCoverageTargets().monday
  const scaleCoveragePublicServiceSegments = buildPublicServiceSegments(scaleCoveragePublicServiceSettings)
  const scaleCoverageDefaultMinimumStaff = Math.max(
    0,
    Number(scaleCoverageDayTargets.defaultMinimumStaff || '0'),
  )
  const scaleCoverageRows = getVisibleWeekRows(getWeekDates(scaleCoverageDate))
    .filter(
      (item) => isCollaboratorActiveOnDate(item, scaleCoverageDate) || !!getAssignmentForDay(item.id, scaleCoverageDate),
    )
    .map((item) => {
      const assignment = getAssignmentForDay(item.id, scaleCoverageDate)
      const schedule = assignment ? getScheduleById(assignment.scheduleId) : null
      return {
        collaborator: item,
        profile: getCollaboratorProfile(item.cpf),
        sector: getCollaboratorSector(item),
        assignment,
        schedule,
        segments: schedule ? buildScheduleCoverageSegments(schedule) : [],
      }
    })
  const scaleCoverageAxisRange = (() => {
    const allSegments = [
      ...scaleCoveragePublicServiceSegments,
      ...scaleCoverageRows.flatMap((item) => item.segments),
    ]

    if (allSegments.length === 0) {
      return null
    }

    const minMinute = Math.min(...allSegments.map((item) => item.start))
    const maxMinute = Math.max(...allSegments.map((item) => item.end))

    return {
      start: Math.max(0, floorCoverageSlot(minMinute) - 30),
      end: ceilCoverageSlot(maxMinute) + 30,
    }
  })()
  const scaleCoverageSlots = (() => {
    if (!scaleCoverageAxisRange) {
      return [] as Array<{ start: number; end: number; label: string; isInPublicService: boolean }>
    }

    const slots = [] as Array<{ start: number; end: number; label: string; isInPublicService: boolean }>
    for (let slotStart = scaleCoverageAxisRange.start; slotStart < scaleCoverageAxisRange.end; slotStart += 30) {
      const slotEnd = slotStart + 30
      slots.push({
        start: slotStart,
        end: slotEnd,
        label: formatCoverageMinuteLabel(slotStart),
        isInPublicService: scaleCoveragePublicServiceSegments.some(
          (segment) => segment.start < slotEnd && segment.end > slotStart,
        ),
      })
    }

    return slots
  })()
  const scaleCoverageSummary = scaleCoverageSlots.map((slot) => {
    const coveredRows = scaleCoverageRows.filter((row) =>
      row.segments.some((segment) => segment.start < slot.end && segment.end > slot.start),
    )
    const count = coveredRows.length
    const activeTimeTarget = findActiveCoverageTimeTarget(scaleCoverageDayTargets, slot.start, slot.end)
    const minimumStaff = slot.isInPublicService
      ? Math.max(0, Number(activeTimeTarget?.minimumStaff || scaleCoverageDayTargets.defaultMinimumStaff || '0'))
      : 0
    const functionTargetStatuses = (activeTimeTarget?.functionTargets ?? []).map((functionTarget) => {
      const required = Math.max(0, Number(functionTarget.minimumStaff || '0'))
      const covered = coveredRows.filter(
        (row) => row.collaborator.primaryFunction === functionTarget.functionName,
      ).length

      return {
        functionName: functionTarget.functionName,
        required,
        covered,
        isBelowTarget: required > covered,
      }
    })
    const hasFunctionGap = functionTargetStatuses.some((item) => item.isBelowTarget)
    const targetLabel = activeTimeTarget
      ? formatCoverageMinuteLabel(slot.start) + ' usa faixa ' + formatCoverageMinuteLabel(parseTwentyFourHourValue(activeTimeTarget.start) ?? slot.start) + ' - ' + formatCoverageMinuteLabel(parseTwentyFourHourValue(activeTimeTarget.end) ?? slot.end)
      : scaleCoverageDefaultMinimumStaff > 0
        ? 'Meta padrao do dia'
        : 'Sem meta configurada'

    return {
      ...slot,
      count,
      minimumStaff,
      activeTimeTarget,
      functionTargetStatuses,
      hasFunctionGap,
      targetLabel,
      isBelowTarget: slot.isInPublicService && minimumStaff > 0 && count < minimumStaff,
    }
  })
  const scaleCoverageGroupedRows = Array.from(
    scaleCoverageRows.reduce((sectorMap, row) => {
      const sectorName = row.sector || 'Setor nao definido'
      const functionName = row.collaborator.primaryFunction || 'Funcao nao definida'
      if (!sectorMap.has(sectorName)) {
        sectorMap.set(sectorName, new Map<string, typeof scaleCoverageRows>())
      }
      const functionMap = sectorMap.get(sectorName)
      if (!functionMap?.has(functionName)) {
        functionMap?.set(functionName, [])
      }
      functionMap?.get(functionName)?.push(row)
      return sectorMap
    }, new Map<string, Map<string, typeof scaleCoverageRows>>()),
  )
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([sectorName, functionMap]) => ({
      sectorName,
      functions: Array.from(functionMap.entries())
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([functionName, rows]) => ({
          functionName,
          rows: rows.sort((left, right) =>
            (left.profile?.fullName ?? left.collaborator.cpf).localeCompare(right.profile?.fullName ?? right.collaborator.cpf),
          ),
        })),
    }))
  const scaleCoverageHasPublicService = scaleCoveragePublicServiceSegments.length > 0
  const scaleCoverageServiceLabel = scaleCoverageHasPublicService
    ? scaleCoveragePublicServiceSegments
        .map((segment) => formatCoverageMinuteLabel(segment.start) + ' - ' + formatCoverageMinuteLabel(segment.end))
        .join(' | ') +
      ' • meta padrao ' +
      String(scaleCoverageDefaultMinimumStaff)
    : 'Nao configurado para este dia da semana'
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
        'Sem CCT vinculada, o sistema permite o cadastro com aviso e sem validacao regulatoria automatica.',
      ]
  const liveSchedulePreview = buildSchedulePreview(scheduleForm)
  const liveWorkedMinutes = computeScheduleNetMinutes(scheduleForm)
  const scheduleClonePreview = scheduleCloneModal ? buildSchedulePreview(scheduleCloneModal) : null
  const scheduleCloneWorkedMinutes = scheduleCloneModal ? computeScheduleNetMinutes(scheduleCloneModal) : undefined
  const scheduleCloneAbbreviation = scheduleCloneModal
    ? buildUniqueScheduleAbbreviation(
        scheduleCloneModal.shiftName,
        companySchedules.map((item) => item.abbreviation),
      )
    : ''
  const liveScheduleAbbreviation = buildUniqueScheduleAbbreviation(
    scheduleForm.shiftName,
    companySchedules.map((item) => item.abbreviation),
    schedules.find((item) => item.id === editingScheduleId)?.abbreviation,
  )
  const activeReportDataset = getActiveReportDataset()
  const activeVisibleReportColumnKeys = getVisibleReportColumnKeys(
    selectedReportId,
    reportVisibleColumnsByReport,
    activeReportDataset.columns,
  )
  const { visibleColumns: visibleReportColumns, hiddenColumns: hiddenReportColumns } =
    splitReportColumnsByVisibility(activeReportDataset.columns, activeVisibleReportColumnKeys)
  const activeReportColumnFilters = reportColumnFiltersByReport[selectedReportId] ?? {}
  const reportColumnDistinctValues = getReportColumnDistinctValues(
    activeReportDataset.columns,
    activeReportDataset.rows,
  )
  const filteredReportRows = filterReportRows(
    activeReportDataset.columns,
    activeReportDataset.rows,
    activeReportColumnFilters,
  )
  const reportPreviewRows = getReportPreviewRows(filteredReportRows)
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
    const resetState = buildResetFormState({
      emptyFunctionForm,
      emptyCollaboratorForm,
      emptyScheduleForm,
      emptyUserForm,
      emptyAgreementForm,
    })
    setFunctionForm(resetState.functionForm)
    setCollaboratorForm(resetState.collaboratorForm)
    setScheduleForm(resetState.scheduleForm)
    setUserForm(resetState.userForm)
    setAgreementForm(resetState.agreementForm)
    setEditingAgreementId(resetState.editingAgreementId)
    setScheduleFeedback(resetState.scheduleFeedback)
    setEditingFunctionId(resetState.editingFunctionId)
    setEditingScheduleId(resetState.editingScheduleId)
    setEditingUserId(resetState.editingUserId)
    setFunctionSuggestion(resetState.functionSuggestion)
    setUserSectorInput(resetState.userSectorInput)
    setCollaboratorLookupFeedback(resetState.collaboratorLookupFeedback)
  }

  function hasUnsavedChangesInActiveContext() {
    if (scaleCommentModal) {
      return !!scaleCommentDraft.trim() || !!editingScaleCommentDraft.trim()
    }

    if (isFunctionModalOpen || activeSection === 'Funcoes') {
      return (
        JSON.stringify(functionForm) !== JSON.stringify(buildFunctionFormSnapshot(editingFunctionId, functions, emptyFunctionForm))
      )
    }

    if (isCollaboratorModalOpen || activeSection === 'Colaboradores') {
      return (
        JSON.stringify(collaboratorForm) !== JSON.stringify(emptyCollaboratorForm) ||
        !!collaboratorLookupFeedback
      )
    }

    if (activeSection === 'Horarios') {
      return (
        JSON.stringify(scheduleForm) !== JSON.stringify(buildScheduleFormSnapshot(editingScheduleId, schedules, emptyScheduleForm))
      )
    }

    if (activeSection === 'Usuarios') {
      return (
        JSON.stringify(userForm) !==
        JSON.stringify(
          buildUserFormSnapshot(
            editingUserId,
            users,
            emptyUserForm,
            (role, sectionAccess) => normalizeSectionAccess(role as CompanyRole, sectionAccess),
            getCompanyUserMembershipsForUser,
          ),
        )
      )
    }

    if (activeSection === 'Convencoes') {
      return (
        JSON.stringify(agreementForm) !== JSON.stringify(buildAgreementFormSnapshot(editingAgreementId, agreements, emptyAgreementForm))
      )
    }

    if (activeSection === 'Cobertura') {
      const normalizedCurrentPublicServiceHours = normalizePublicServiceHours(currentCompany?.publicServiceHours)
      const normalizedCurrentCoverageTargets = normalizeCoverageTargets(currentCompany?.coverageTargets)

      return (
        JSON.stringify(companyPublicServiceHours) !== JSON.stringify(normalizedCurrentPublicServiceHours) ||
        JSON.stringify(companyCoverageTargets) !== JSON.stringify(normalizedCurrentCoverageTargets)
      )
    }

    if (isCompanyModalOpen || activeSection === 'Empresa') {
      const currentCompanyLinkedIds = currentCompany?.linkedCompanyIds ?? []
      const normalizedCurrentLinkedIds = [...currentCompanyLinkedIds].sort((left, right) => left - right)
      const normalizedFormLinkedIds = [...companyLinkedCompanyIds].sort((left, right) => left - right)

      return (
        JSON.stringify(companyForm) !== JSON.stringify(buildCompanyFormSnapshot(currentCompany, emptyCompanyForm)) ||
        JSON.stringify(normalizedFormLinkedIds) !== JSON.stringify(normalizedCurrentLinkedIds) ||
        !!companyAgreementFeedback
      )
    }

    return false
  }

  function runWithDiscardGuard(action: () => void) {
    if (!hasUnsavedChangesInActiveContext()) {
      action()
      return
    }

    pendingDiscardActionRef.current = action
    setDiscardWarning({
      title: 'Descartar alteracoes',
      message: 'Existem alteracoes nao salvas neste painel. Deseja descartá-las e continuar?',
    })
  }

  function cancelDiscardWarning() {
    pendingDiscardActionRef.current = null
    setDiscardWarning(null)
  }

  function confirmDiscardWarning() {
    const nextAction = pendingDiscardActionRef.current
    pendingDiscardActionRef.current = null
    setDiscardWarning(null)
    nextAction?.()
  }

  function handleSectionSelection(section: ActiveSection) {
    if (section === activeSection) {
      return
    }

    runWithDiscardGuard(() => {
      if (section !== 'PainelMaster') {
        resetForms()
        closeScaleCommentModal(true)
      }

      setActiveSection(section)
    })
  }

  function toggleReportColumnVisibility(columnKey: string) {
    setReportVisibleColumnsByReport((current) => {
      return toggleVisibleReportColumn(
        current,
        selectedReportId,
        activeReportDataset.columns.map((column) => column.key),
        columnKey,
      )
    })
  }

  function showReportColumn(columnKey: string) {
    setReportVisibleColumnsByReport((current) => {
      return showVisibleReportColumn(
        current,
        selectedReportId,
        activeReportDataset.columns.map((column) => column.key),
        columnKey,
      )
    })
  }

  function toggleReportColumnFilterValue(columnKey: string, value: string) {
    setReportColumnFiltersByReport((current) => {
      return toggleReportColumnFilterSelection(current, selectedReportId, columnKey, value)
    })
  }

  function clearReportColumnFilter(columnKey: string) {
    setReportColumnFiltersByReport((current) => {
      return clearReportColumnFilterSelection(current, selectedReportId, columnKey)
    })
  }

  function resetReportTablePreferences() {
    setReportVisibleColumnsByReport((current) =>
      resetReportTableVisibleColumns(
        current,
        selectedReportId,
        activeReportDataset.columns.map((column) => column.key),
      ),
    )
    setReportColumnFiltersByReport((current) => resetReportTableFilters(current, selectedReportId))
    setOpenReportColumnMenu(null)
  }

  async function exportReportToXlsx() {
    if (!currentCompany) {
      return
    }

    const XLSX = await import('xlsx')
    const aoa = buildReportWorksheetRows({
      companyTradeName: currentCompany.tradeName,
      periodLabel: `${formatMonthDateLabel(reportStartDate)} a ${formatMonthDateLabel(reportEndDate)}`,
      dataset: activeReportDataset,
      visibleColumns: visibleReportColumns,
      filteredRows: filteredReportRows,
    })

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

    const html = buildReportPrintHtml({
      documentTitle: `relatorio-${currentCompany.tradeName}-${activeReportDataset.filenameSuffix}`,
      companyTradeName: currentCompany.tradeName,
      periodLabel: `${formatMonthDateLabel(reportStartDate)} a ${formatMonthDateLabel(reportEndDate)}`,
      mode,
      dataset: activeReportDataset,
      visibleColumns: visibleReportColumns,
      filteredRows: filteredReportRows,
      escapeHtml,
    })

    reportWindow.document.open()
    reportWindow.document.write(html)
    reportWindow.document.close()
  }

  function ensureCompanySector(companyId: number, sectorName: string) {
    setSectors((current) => ensureCompanySectorInCollection(current, companyId, sectorName))
  }

  function toggleUserSector(sectorName: string) {
    setUserForm((current) => toggleUserSectorSelection(current, sectorName))
  }

  function addUserSector() {
    if (!currentCompanyId) {
      return
    }

    const trimmedSector = userSectorInput.trim()
    if (!trimmedSector) {
      return
    }

    const resolvedSector = resolveCompanySectorName(sectors, currentCompanyId, trimmedSector)
    ensureCompanySector(currentCompanyId, resolvedSector)
    setUserForm((current) => addResolvedSectorToUserForm(current, resolvedSector))
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
    const nextState = buildScaleCommentModalOpenState(collaboratorId, date)
    setScaleCommentModal(nextState.scaleCommentModal)
    setScaleCommentDraft(nextState.scaleCommentDraft)
    setEditingScaleCommentId(nextState.editingScaleCommentId)
    setEditingScaleCommentDraft(nextState.editingScaleCommentDraft)
  }

  function closeScaleCommentModal(force = false) {
    if (!force) {
      runWithDiscardGuard(() => closeScaleCommentModal(true))
      return
    }

    const nextState = buildScaleCommentModalClosedState()
    setScaleCommentModal(nextState.scaleCommentModal)
    setScaleCommentDraft(nextState.scaleCommentDraft)
    setEditingScaleCommentId(nextState.editingScaleCommentId)
    setEditingScaleCommentDraft(nextState.editingScaleCommentDraft)
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
    setLastScalePlanningViewMode('week')
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

    if (currentSessionActor && currentCompanyId) {
      appendAuditLog({
        companyId: currentCompanyId,
        actorName: currentSessionActor.name,
        actorRole: currentSessionActor.role,
        module: 'Comentarios',
        action: 'Atualizacao',
        targetType: 'Comentario de escala',
        targetLabel: scaleCommentModal.date,
        severity: 'warning',
        impactSummary: 'Comentario de escala editado.',
        relatedCompanyIds: [currentCompanyId],
      })
    }

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

    if (currentSessionActor && currentCompanyId) {
      appendAuditLog({
        companyId: currentCompanyId,
        actorName: currentSessionActor.name,
        actorRole: currentSessionActor.role,
        module: 'Comentarios',
        action: 'Exclusao',
        targetType: 'Comentario de escala',
        targetLabel: scaleCommentModal.date,
        severity: 'warning',
        impactSummary: 'Comentario de escala excluido.',
        relatedCompanyIds: [currentCompanyId],
      })
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
      id: getNextNumericId(companyScaleComments.flatMap((thread) => thread.messages)),
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

    appendAuditLog({
      companyId: currentCompanyId,
      actorName: currentSessionActor.name,
      actorRole: currentSessionActor.role,
      module: 'Comentarios',
      action: 'Criacao',
      targetType: 'Comentario de escala',
      targetLabel: scaleCommentModal.date,
      severity: 'info',
      impactSummary: 'Novo comentario registrado na escala.',
      relatedCompanyIds: [currentCompanyId],
    })

    setScaleCommentDraft('')
  }

  function buildAuditTrailReport(): ReportDataset {
    const rows = currentCompanyAuditLogs
      .filter((item) => {
        const eventDate = item.createdAt.slice(0, 10)
        return eventDate >= reportStartDate && eventDate <= reportEndDate
      })
      .map((item) => ({
        dataHora: formatDateTimeLabel(item.createdAt),
        modulo: item.module,
        acao: item.action,
        alvo: item.targetLabel,
        ator: item.actorName,
        perfil: item.actorRole,
        severidade: item.severity,
        impacto: item.impactSummary,
      }))

    return {
      id: 'audit-trail',
      title: 'Auditoria operacional',
      description: 'Eventos administrativos e operacionais registrados na empresa ativa.',
      filenameSuffix: 'auditoria-operacional',
      summary: [
        { label: 'Eventos', value: String(rows.length) },
        { label: 'Alertas', value: String(rows.filter((item) => item.severidade !== 'info').length) },
        { label: 'Usuarios atores', value: String(new Set(rows.map((item) => item.ator)).size) },
      ],
      columns: [
        { key: 'dataHora', label: 'Data/hora' },
        { key: 'modulo', label: 'Modulo' },
        { key: 'acao', label: 'Acao' },
        { key: 'alvo', label: 'Alvo' },
        { key: 'ator', label: 'Ator' },
        { key: 'perfil', label: 'Perfil' },
        { key: 'severidade', label: 'Severidade', align: 'center' },
        { key: 'impacto', label: 'Impacto' },
      ],
      rows,
    }
  }

  function buildCommentActivityReport(): ReportDataset {
    const rows = companyScaleComments
      .filter((thread) => thread.date >= reportStartDate && thread.date <= reportEndDate)
      .flatMap((thread) => {
        const collaborator = companyCollaborators.find((item) => item.id === thread.collaboratorId) ?? null
        if (!collaborator || !matchesReportSector(collaborator)) {
          return []
        }

        return thread.messages.map((message) => ({
          dataEscala: formatMonthDateLabel(thread.date),
          colaborador: getReportCollaboratorName(collaborator),
          setor: getReportSectorName(collaborator),
          funcao: getReportFunctionName(collaborator),
          autor: message.authorName,
          perfil: message.authorRole,
          dataHora: formatDateTimeLabel(message.createdAt),
          mensagem: message.body,
        }))
      })
      .sort((left, right) => String(right.dataHora).localeCompare(String(left.dataHora)))

    return {
      id: 'comment-activity',
      title: 'Atividade de comentarios',
      description: 'Comentarios e respostas registrados na escala dentro do periodo.',
      filenameSuffix: 'atividade-comentarios',
      summary: [
        { label: 'Mensagens', value: String(rows.length) },
        { label: 'Colaboradores citados', value: String(new Set(rows.map((item) => item.colaborador)).size) },
        { label: 'Autores', value: String(new Set(rows.map((item) => item.autor)).size) },
      ],
      columns: [
        { key: 'dataEscala', label: 'Data da escala' },
        { key: 'colaborador', label: 'Colaborador' },
        { key: 'setor', label: 'Setor' },
        { key: 'funcao', label: 'Funcao' },
        { key: 'autor', label: 'Autor' },
        { key: 'perfil', label: 'Perfil' },
        { key: 'dataHora', label: 'Data/hora' },
        { key: 'mensagem', label: 'Mensagem' },
      ],
      rows,
    }
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

  function closeImpactWarning() {
    pendingImpactActionRef.current = null
    setImpactWarning(null)
  }

  function confirmImpactWarning() {
    const pendingAction = pendingImpactActionRef.current
    const replacementValue = impactWarning?.replacementValue ?? ''
    pendingImpactActionRef.current = null
    setImpactWarning(null)
    pendingAction?.(replacementValue)
  }

  function openImpactWarning(
    warning: Omit<ImpactWarningState, 'replacementValue'> & { replacementValue?: string },
    onConfirm: (replacementValue: string) => void,
  ) {
    pendingImpactActionRef.current = onConfirm
    setImpactWarning({
      ...warning,
      replacementValue: warning.replacementValue ?? '',
    })
  }

  function replaceFunctionOnCollaborators(
    current: CollaboratorRecord[],
    targetFunctionName: string,
    replacementFunctionName: string,
  ) {
    return current.map((item) => {
      if (item.companyId !== currentCompanyId || !item.functions.includes(targetFunctionName)) {
        return item
      }

      const nextFunctions = item.functions.map((functionName) =>
        functionName === targetFunctionName ? replacementFunctionName : functionName,
      )

      return {
        ...item,
        functions: Array.from(new Set(nextFunctions)),
        primaryFunction:
          item.primaryFunction === targetFunctionName ? replacementFunctionName : item.primaryFunction,
      }
    })
  }

  function replaceScheduleOnAssignments(
    current: ScaleAssignmentRecord[],
    targetScheduleId: number,
    replacementScheduleId: number,
    datePredicate?: (date: string) => boolean,
  ) {
    return current.map((item) => {
      if (item.companyId !== currentCompanyId || item.scheduleId !== targetScheduleId) {
        return item
      }

      if (datePredicate && !datePredicate(item.date)) {
        return item
      }

      return {
        ...item,
        scheduleId: replacementScheduleId,
      }
    })
  }

  function buildFunctionReplacementOptions(targetFunction: FunctionRecord) {
    return companyFunctions
      .filter((item) => item.id !== targetFunction.id && item.isActive)
      .sort((left, right) => left.name.localeCompare(right.name))
      .map((item) => ({ value: item.name, label: `${item.name} • ${item.sector || 'Sem setor'}` }))
  }

  function buildScheduleReplacementOptions(targetSchedule: ScheduleRecord) {
    return companySchedules
      .filter((item) => item.id !== targetSchedule.id && item.isActive)
      .sort((left, right) => left.shiftName.localeCompare(right.shiftName))
      .map((item) => ({ value: String(item.id), label: `${item.shiftName} (${item.abbreviation})` }))
  }

  function requestCollaboratorActivationImpact(collaborator: CollaboratorRecord, onConfirm: () => void) {
    const today = toIsoDate(new Date())
    const affectedScaleDates = companyScaleAssignments
      .filter((item) => item.collaboratorId === collaborator.id && item.date >= today)
      .map((item) => item.date)
      .sort()
    const affectedWeeks = companyScaleExtraRoster
      .filter((item) => item.collaboratorId === collaborator.id && item.weekStart >= today)
      .map((item) => item.weekStart)
      .sort()
    const linkedUsers = companyUsers
      .filter((item) => item.linkedCollaboratorId === collaborator.id)
      .map((item) => item.fullName)
      .sort((left, right) => left.localeCompare(right))
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

    if (linkedUsers.length > 0) {
      messages.push(
        `Usuarios vinculados: ${linkedUsers.slice(0, 6).join(', ')}${linkedUsers.length > 6 ? '...' : ''}. O vinculo sera mantido, mas sem novas escolhas para este colaborador.`,
      )
    }

    openImpactWarning(
      {
        title: 'Impacto da inativacao do colaborador',
        messages,
        confirmLabel: 'Continuar inativacao',
        replacementOptions: [],
      },
      () => onConfirm(),
    )
  }

  function requestCollaboratorDeletionImpact(collaborator: CollaboratorRecord, onConfirm: () => void) {
    const assignments = companyScaleAssignments
      .filter((item) => item.collaboratorId === collaborator.id)
      .map((item) => item.date)
      .sort()
    const extraWeeks = companyScaleExtraRoster
      .filter((item) => item.collaboratorId === collaborator.id)
      .map((item) => item.weekStart)
      .sort()
    const linkedUsers = companyUsers
      .filter((item) => item.linkedCollaboratorId === collaborator.id)
      .map((item) => item.fullName)
      .sort((left, right) => left.localeCompare(right))
    const messages = [
      'Excluir este colaborador remove o cadastro da empresa e tambem apaga suas escalas relacionadas.',
    ]

    if (assignments.length > 0) {
      messages.push(
        `Escalas removidas: ${formatAffectedDates(assignments)}${assignments.length > 6 ? '...' : ''}.`,
      )
    }

    if (extraWeeks.length > 0) {
      messages.push(
        `Semanas EXTRA removidas: ${formatAffectedDates(extraWeeks)}${extraWeeks.length > 6 ? '...' : ''}.`,
      )
    }

    if (linkedUsers.length > 0) {
      messages.push(
        `Usuarios desvinculados: ${linkedUsers.slice(0, 6).join(', ')}${linkedUsers.length > 6 ? '...' : ''}.`,
      )
    }

    openImpactWarning(
      {
        title: 'Impacto da exclusao do colaborador',
        messages,
        confirmLabel: 'Excluir colaborador',
        replacementOptions: [],
      },
      () => onConfirm(),
    )
  }

  function requestScheduleActivationImpact(schedule: ScheduleRecord, onConfirm: (replacementScheduleId: number | null) => void) {
    const today = toIsoDate(new Date())
    const affectedScaleDates = companyScaleAssignments
      .filter((item) => item.scheduleId === schedule.id && item.date >= today)
      .map((item) => item.date)
      .sort()
    const replacementOptions = buildScheduleReplacementOptions(schedule)
    const messages = [
      `Inativar este horario o retira das novas escolhas na Escala a partir de ${formatDateLabel(today)}.`,
    ]

    if (affectedScaleDates.length > 0) {
      messages.push(
        `Escala afetada: este horario ja foi escolhido em ${formatAffectedDates(affectedScaleDates)}${affectedScaleDates.length > 6 ? '...' : ''}.`,
      )
    }

    if (replacementOptions.length > 0) {
      messages.push('Se desejar, substitua agora esse horario nas escalas futuras que ainda o utilizam.')
    }

    openImpactWarning(
      {
        title: 'Impacto da inativacao do horario',
        messages,
        confirmLabel: 'Continuar inativacao',
        replacementLabel: replacementOptions.length > 0 ? 'Substituir horario futuro por' : undefined,
        replacementPlaceholder: replacementOptions.length > 0 ? 'Manter horarios ja lancados' : undefined,
        replacementOptions,
      },
      (replacementValue) => {
        const numericReplacementId = Number(replacementValue)
        onConfirm(Number.isNaN(numericReplacementId) || numericReplacementId <= 0 ? null : numericReplacementId)
      },
    )
  }

  function requestScheduleDeletionImpact(schedule: ScheduleRecord, onConfirm: (replacementScheduleId: number | null) => void) {
    const affectedScaleDates = companyScaleAssignments
      .filter((item) => item.scheduleId === schedule.id)
      .map((item) => item.date)
      .sort()
    const replacementOptions = buildScheduleReplacementOptions(schedule)
    const messages = [
      'Excluir este horario remove o cadastro e tambem limpa as escalas que ainda apontam para ele.',
    ]

    if (affectedScaleDates.length > 0) {
      messages.push(
        `Escalas afetadas: ${formatAffectedDates(affectedScaleDates)}${affectedScaleDates.length > 6 ? '...' : ''}.`,
      )
    }

    if (replacementOptions.length > 0) {
      messages.push('Se desejar, substitua agora esse horario nas escalas afetadas antes de concluir a exclusao.')
    }

    openImpactWarning(
      {
        title: 'Impacto da exclusao do horario',
        messages,
        confirmLabel: 'Excluir horario',
        replacementLabel: replacementOptions.length > 0 ? 'Substituir horario em escalas afetadas por' : undefined,
        replacementPlaceholder: replacementOptions.length > 0 ? 'Remover horario das escalas afetadas' : undefined,
        replacementOptions,
      },
      (replacementValue) => {
        const numericReplacementId = Number(replacementValue)
        onConfirm(Number.isNaN(numericReplacementId) || numericReplacementId <= 0 ? null : numericReplacementId)
      },
    )
  }

  function requestFunctionActivationImpact(targetFunction: FunctionRecord, onConfirm: (replacementFunctionName: string | null) => void) {
    const affectedCollaborators = companyCollaborators
      .filter((item) => item.functions.includes(targetFunction.name))
      .map((item) => getCollaboratorProfile(item.cpf)?.fullName ?? item.cpf)
      .sort((left, right) => left.localeCompare(right))
    const replacementOptions = buildFunctionReplacementOptions(targetFunction)
    const messages = [
      'Inativar esta funcao a retira das novas escolhas no cadastro de colaboradores.',
    ]

    if (affectedCollaborators.length > 0) {
      messages.push(
        `Cadastros afetados: ${affectedCollaborators.slice(0, 6).join(', ')}${affectedCollaborators.length > 6 ? '...' : ''}.`,
      )
    }

    if (replacementOptions.length > 0) {
      messages.push('Se desejar, substitua agora esta funcao nos colaboradores que ainda a utilizam.')
    }

    openImpactWarning(
      {
        title: 'Impacto da inativacao da funcao',
        messages,
        confirmLabel: 'Continuar inativacao',
        replacementLabel: replacementOptions.length > 0 ? 'Substituir funcao em colaboradores por' : undefined,
        replacementPlaceholder: replacementOptions.length > 0 ? 'Manter funcao atual nos colaboradores' : undefined,
        replacementOptions,
      },
      (replacementValue) => onConfirm(replacementValue || null),
    )
  }

  function requestFunctionDeletionImpact(targetFunction: FunctionRecord, onConfirm: (replacementFunctionName: string | null) => void) {
    const affectedCollaborators = companyCollaborators
      .filter((item) => item.functions.includes(targetFunction.name))
      .map((item) => getCollaboratorProfile(item.cpf)?.fullName ?? item.cpf)
      .sort((left, right) => left.localeCompare(right))
    const replacementOptions = buildFunctionReplacementOptions(targetFunction)
    const messages = [
      'Excluir esta funcao remove o cadastro e atualiza os colaboradores que ainda a utilizam.',
    ]

    if (affectedCollaborators.length > 0) {
      messages.push(
        `Colaboradores afetados: ${affectedCollaborators.slice(0, 6).join(', ')}${affectedCollaborators.length > 6 ? '...' : ''}.`,
      )
    }

    if (replacementOptions.length > 0) {
      messages.push('Se desejar, substitua agora esta funcao antes de concluir a exclusao.')
    }

    openImpactWarning(
      {
        title: 'Impacto da exclusao da funcao',
        messages,
        confirmLabel: 'Excluir funcao',
        replacementLabel: replacementOptions.length > 0 ? 'Substituir funcao em colaboradores por' : undefined,
        replacementPlaceholder: replacementOptions.length > 0 ? 'Remover funcao dos colaboradores afetados' : undefined,
        replacementOptions,
      },
      (replacementValue) => onConfirm(replacementValue || null),
    )
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

  function getReportRangeDates() {
    const dates: string[] = []
    const cursor = new Date(`${reportStartDate}T12:00:00`)
    const rangeEnd = new Date(`${reportEndDate}T12:00:00`)

    while (cursor <= rangeEnd) {
      dates.push(toIsoDate(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }

    return dates
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

  function buildScaleOperationsReport(): ReportDataset {
    const grouped = new Map<
      string,
      {
        data: string
        setor: string
        funcao: string
        ativos: number
        escalados: number
        lacunas: number
        extras: number
        custoExtras: number
      }
    >()

    getReportRangeDates().forEach((date) => {
      const activeCollaboratorsForDate = getReportCollaborators().filter((collaborator) =>
        isCollaboratorActiveOnDate(collaborator, date),
      )

      activeCollaboratorsForDate.forEach((collaborator) => {
        const sectorName = getReportSectorName(collaborator)
        const functionName = getReportFunctionName(collaborator)
        const key = [date, sectorName, functionName].join('|')
        const current = grouped.get(key) ?? {
          data: formatMonthDateLabel(date),
          setor: sectorName,
          funcao: functionName,
          ativos: 0,
          escalados: 0,
          lacunas: 0,
          extras: 0,
          custoExtras: 0,
        }
        const assignment = getAssignmentForDay(collaborator.id, date)
        const extraCost = parseCurrencyValue(getFunctionByName(collaborator.primaryFunction)?.extraPayValue ?? '')

        current.ativos += 1
        if (assignment) {
          current.escalados += 1
          if (collaborator.employmentType === 'EXTRA') {
            current.extras += 1
            current.custoExtras += extraCost
          }
        } else if (collaborator.employmentType !== 'EXTRA') {
          current.lacunas += 1
        }

        grouped.set(key, current)
      })
    })

    const rows: Array<Record<string, ReportRowValue>> = Array.from(grouped.values())
      .map((item) => ({
        ...item,
        custoExtrasRaw: item.custoExtras,
        coberturaPercentual:
          item.ativos > 0 ? `${Math.round((item.escalados / item.ativos) * 100)}%` : '0%',
        custoExtras: formatCurrency(item.custoExtras),
      }))
      .sort((left, right) =>
        Number(right.lacunas) - Number(left.lacunas) ||
        Number(right.custoExtrasRaw) - Number(left.custoExtrasRaw) ||
        `${left.data}-${left.setor}-${left.funcao}`.localeCompare(`${right.data}-${right.setor}-${right.funcao}`),
      )
      .map((row) => {
        const { custoExtrasRaw, ...reportRow } = row
        void custoExtrasRaw
        return reportRow
      })

    const totalLacunas = rows.reduce((sum, item) => sum + Number(item.lacunas), 0)
    const totalExtras = rows.reduce((sum, item) => sum + Number(item.extras), 0)
    const totalCustoExtras = rows.reduce(
      (sum, item) => sum + parseCurrencyValue(String(item.custoExtras)),
      0,
    )

    return {
      id: 'scale-operations',
      title: 'Operacao da escala',
      description: 'Leitura diaria de cobertura, lacunas e extras por setor e funcao.',
      filenameSuffix: 'operacao-escala',
      summary: [
        { label: 'Linhas operacionais', value: String(rows.length) },
        { label: 'Lacunas abertas', value: String(totalLacunas) },
        { label: 'Extras previstos', value: String(totalExtras) },
        { label: 'Custo extras', value: formatCurrency(totalCustoExtras) },
      ],
      columns: [
        { key: 'data', label: 'Data' },
        { key: 'setor', label: 'Setor' },
        { key: 'funcao', label: 'Funcao' },
        { key: 'ativos', label: 'Ativos na base', align: 'right' },
        { key: 'escalados', label: 'Escalados', align: 'right' },
        { key: 'lacunas', label: 'Sem escala', align: 'right' },
        { key: 'coberturaPercentual', label: 'Cobertura', align: 'right' },
        { key: 'extras', label: 'Extras', align: 'right' },
        { key: 'custoExtras', label: 'Custo extras', align: 'right' },
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
      .map((row) => {
        const { totalMinutesRaw, ...reportRow } = row
        void totalMinutesRaw
        return reportRow
      })

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
      .map((row) => {
        const { issuesCount, ...reportRow } = row
        void issuesCount
        return reportRow
      })

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
      .map((row) => {
        const { custoRaw, ...reportRow } = row
        void custoRaw
        return reportRow
      })

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
      .map((row) => {
        const { horasTotaisRaw, ...reportRow } = row
        void horasTotaisRaw
        return reportRow
      })

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
    .map((row) => {
      const { totalMinutesRaw, exposureMinutesRaw, ...reportRow } = row
      void totalMinutesRaw
      void exposureMinutesRaw
      return reportRow
    })

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
      .map((row) => {
        const { horasAlocadasRaw, ...reportRow } = row
        void horasAlocadasRaw
        return reportRow
      })

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
      case 'scale-operations':
        return buildScaleOperationsReport()
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
      case 'audit-trail':
        return buildAuditTrailReport()
      case 'comment-activity':
        return buildCommentActivityReport()
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

  function resolveScaleBatchRuntimeState(modalState: ScaleBatchModalState): ScaleBatchRuntimeState {
    const weekDates = getSafeWeekDates(modalState.weekStart)
    if (weekDates.length !== 7) {
      return {
        weekDates: [],
        targetRows: [],
        errorMessage: 'A semana selecionada ficou invalida para a operacao em lote.',
      }
    }

    try {
      const targetRows = getVisibleWeekRows(weekDates).filter((item) =>
        modalState.employmentScope === 'TODOS'
          ? true
          : item.employmentType === modalState.employmentScope,
      )

      return {
        weekDates,
        targetRows,
        errorMessage: null,
      }
    } catch (error) {
      return {
        weekDates,
        targetRows: [],
        errorMessage:
          error instanceof Error
            ? `Falha ao preparar a operacao em lote: ${error.message}`
            : 'Falha ao preparar a operacao em lote.',
      }
    }
  }

  function getVisibleWeekRows(weekDates: Date[]) {
    if (weekDates.length !== 7 || weekDates.some((date) => Number.isNaN(date.getTime()))) {
      return []
    }

    const weekStartValue = toIsoDate(weekDates[0])
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

    return [...autoRows, ...extraRows].filter((item) => {
      if (!scaleShowIrregularOnly) {
        return true
      }

      return validateScaleRow(item, weekDates).issues.length > 0
    })
  }

  function getDateRangeInclusive(startDate: string, endDate: string) {
    const dates: string[] = []
    const start = new Date(`${startDate}T12:00:00`)
    const end = new Date(`${endDate}T12:00:00`)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return dates
    }

    const cursor = new Date(start)
    while (cursor <= end) {
      dates.push(toIsoDate(cursor))
      cursor.setDate(cursor.getDate() + 1)
    }

    return dates
  }

  function addDaysToIsoDate(isoDate: string, daysToAdd: number) {
    const nextDate = new Date(`${isoDate}T12:00:00`)
    nextDate.setDate(nextDate.getDate() + daysToAdd)
    return toIsoDate(nextDate)
  }

  function closeScaleReplicationModal() {
    setScaleReplicationModal(null)
  }

  function closeScaleReplicationWarning() {
    pendingScaleReplicationRef.current = null
    setScaleReplicationWarning(null)
  }

  function confirmScaleReplicationWarning() {
    const pendingAction = pendingScaleReplicationRef.current
    pendingScaleReplicationRef.current = null
    setScaleReplicationWarning(null)
    pendingAction?.()
  }

  function openScaleReplicationModal(collaboratorId: number, weekDates: Date[]) {
    const sourceStartDate = toIsoDate(weekDates[0])
    const sourceEndDate = toIsoDate(weekDates[weekDates.length - 1])

    setScaleReplicationModal({
      collaboratorId,
      mode: 'sequence',
      sourceStartDate,
      sourceEndDate,
      targetStartDate: addDaysToIsoDate(sourceEndDate, 1),
      weeklyRepeatCount: '4',
      overwriteExisting: false,
      copyDaysOff: true,
    })
  }

  function closeScaleBatchModal() {
    setScaleBatchModal(null)
  }

  function closeScaleBatchWarning() {
    pendingScaleBatchRef.current = null
    setScaleBatchWarning(null)
  }

  function confirmScaleBatchWarning() {
    const pendingAction = pendingScaleBatchRef.current
    pendingScaleBatchRef.current = null
    setScaleBatchWarning(null)
    pendingAction?.()
  }

  function openScaleBatchModal(weekDates: Date[]) {
    if (weekDates.length !== 7 || weekDates.some((date) => Number.isNaN(date.getTime()))) {
      setScaleWarning({
        title: 'Semana indisponivel',
        messages: ['Nao foi possivel abrir a operacao em lote para esta semana. Recarregue a pagina e tente novamente.'],
      })
      return
    }

    setScaleBatchModal({
      weekStart: toIsoDate(weekDates[0]),
      employmentScope: 'TODOS',
      scheduleIdValue: '',
      selectedDates: weekDates.map((date) => toIsoDate(date)),
      overwriteExisting: false,
    })
  }

  function buildScaleReplicationPlan(modalState: ScaleReplicationModalState) {
    const sourceDates = getDateRangeInclusive(modalState.sourceStartDate, modalState.sourceEndDate)
    const weeklyRepeatCount = Number(modalState.weeklyRepeatCount)

    if (sourceDates.length === 0 || !modalState.targetStartDate) {
      return {
        sourceDates,
        weeklyRepeatCount,
        replicationPlan: [] as Array<{ sourceDate: string; targetDate: string }>,
      }
    }

    const replicationPlan =
      modalState.mode === 'weekly'
        ? !Number.isInteger(weeklyRepeatCount) || weeklyRepeatCount <= 0
          ? []
          : Array.from({ length: weeklyRepeatCount }).flatMap((_, repetitionIndex) =>
              sourceDates.map((sourceDate) => {
                const offsetDays =
                  Math.round(
                    (new Date(`${sourceDate}T12:00:00`).getTime() -
                      new Date(`${modalState.sourceStartDate}T12:00:00`).getTime()) /
                      86_400_000,
                  ) + repetitionIndex * 7

                return {
                  sourceDate,
                  targetDate: addDaysToIsoDate(modalState.targetStartDate, offsetDays),
                }
              }),
            )
        : sourceDates.map((sourceDate, index) => ({
            sourceDate,
            targetDate: addDaysToIsoDate(modalState.targetStartDate, index),
          }))

    return {
      sourceDates,
      weeklyRepeatCount,
      replicationPlan,
    }
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

    if (currentSessionActor) {
      appendAuditLog({
        companyId: currentCompanyId,
        actorName: currentSessionActor.name,
        actorRole: currentSessionActor.role,
        module: 'Escala',
        action: 'Atualizacao',
        targetType: 'Escala',
        targetLabel: `${getCollaboratorProfile(collaborator.cpf)?.fullName ?? collaborator.cpf} • ${date}`,
        severity: validation.issues.length > 0 ? 'warning' : 'info',
        impactSummary:
          validation.issues.length > 0
            ? 'Atribuicao de escala alterada com alerta de irregularidade.'
            : 'Atribuicao de escala alterada manualmente.',
        relatedCompanyIds: [currentCompanyId],
      })
    }
  }

  function applyScaleReplication(collaborator: CollaboratorRecord, allowIrregular: boolean) {
    if (!currentCompanyId || !canEditScale || !scaleReplicationModal) {
      return
    }

    const { sourceDates, weeklyRepeatCount, replicationPlan } = buildScaleReplicationPlan(scaleReplicationModal)
    if (sourceDates.length === 0) {
      setScaleWarning({
        title: 'Periodo de origem invalido',
        messages: ['Defina um periodo de origem valido para replicar a escala.'],
      })
      return
    }

    if (!scaleReplicationModal.targetStartDate) {
      setScaleWarning({
        title: 'Destino obrigatorio',
        messages: ['Informe a data inicial de destino para replicar a escala.'],
      })
      return
    }

    if (
      scaleReplicationModal.mode === 'weekly' &&
      (!Number.isInteger(weeklyRepeatCount) || weeklyRepeatCount <= 0)
    ) {
      setScaleWarning({
        title: 'Repeticoes invalidas',
        messages: ['Informe um numero inteiro de semanas para a replicacao recorrente.'],
      })
      return
    }

    const targetDates = replicationPlan.map((item) => item.targetDate)
    const sourceAssignmentByDate = new Map(
      companyScaleAssignments
        .filter(
          (item) =>
            item.collaboratorId === collaborator.id &&
            sourceDates.includes(item.date),
        )
        .map((item) => [item.date, item]),
    )

    const currentMaxId = scaleAssignments.reduce((max, item) => Math.max(max, item.id), 0)
    let nextId = currentMaxId
    const nextAssignments = scaleAssignments.filter((item) => {
      if (item.companyId !== currentCompanyId || item.collaboratorId !== collaborator.id) {
        return true
      }

      const replicationTarget = replicationPlan.find((planItem) => planItem.targetDate === item.date) ?? null
      if (!replicationTarget) {
        return true
      }

      const sourceAssignment = sourceAssignmentByDate.get(replicationTarget.sourceDate) ?? null
      if (!scaleReplicationModal.overwriteExisting && sourceAssignment) {
        return true
      }

      if (!scaleReplicationModal.overwriteExisting && !sourceAssignment) {
        return true
      }

      if (!scaleReplicationModal.copyDaysOff && !sourceAssignment) {
        return true
      }

      return false
    })

    replicationPlan.forEach(({ sourceDate, targetDate }) => {
      const sourceAssignment = sourceAssignmentByDate.get(sourceDate) ?? null
      const hasExistingTarget = nextAssignments.some(
        (item) =>
          item.companyId === currentCompanyId &&
          item.collaboratorId === collaborator.id &&
          item.date === targetDate,
      )

      if (!sourceAssignment) {
        return
      }

      if (hasExistingTarget && !scaleReplicationModal.overwriteExisting) {
        return
      }

      nextId += 1
      nextAssignments.push({
        id: nextId,
        companyId: currentCompanyId,
        collaboratorId: collaborator.id,
        date: targetDate,
        scheduleId: sourceAssignment.scheduleId,
      })
    })

    const affectedWeekStarts = Array.from(
      new Set(targetDates.map((date) => toIsoDate(startOfWeek(date)))),
    )
    const replicationIssues = affectedWeekStarts.flatMap((weekStart) =>
      validateScaleRow(collaborator, getWeekDates(weekStart), nextAssignments.filter((item) => item.companyId === currentCompanyId)).issues,
    )

    if (replicationIssues.length > 0 && !allowIrregular) {
      pendingScaleReplicationRef.current = () => applyScaleReplication(collaborator, true)
      setScaleReplicationWarning({
        title: 'Replicacao com irregularidades',
        messages: Array.from(new Set(replicationIssues)),
        confirmLabel: 'Replicar mesmo assim',
      })
      return
    }

    const changedTargetDates = Array.from(new Set(targetDates)).filter((targetDate) => {
      const currentAssignment = companyScaleAssignments.find(
        (item) => item.collaboratorId === collaborator.id && item.date === targetDate,
      ) ?? null
      const nextAssignment = nextAssignments.find(
        (item) =>
          item.companyId === currentCompanyId &&
          item.collaboratorId === collaborator.id &&
          item.date === targetDate,
      ) ?? null

      return (currentAssignment?.scheduleId ?? null) !== (nextAssignment?.scheduleId ?? null)
    })

    if (changedTargetDates.length === 0) {
      setScaleWarning({
        title: 'Nada para replicar',
        messages: [
          'Nenhuma alteracao foi aplicada. Revise se ja existe escala igual no destino ou habilite a sobrescrita.',
        ],
      })
      return
    }

    setScaleAssignments(nextAssignments)
    closeScaleReplicationModal()

    if (currentSessionActor) {
      appendAuditLog({
        companyId: currentCompanyId,
        actorName: currentSessionActor.name,
        actorRole: currentSessionActor.role,
        module: 'Escala',
        action: 'Atualizacao',
        targetType: 'Escala',
        targetLabel: `${getCollaboratorProfile(collaborator.cpf)?.fullName ?? collaborator.cpf} • replicacao ${scaleReplicationModal.sourceStartDate} a ${scaleReplicationModal.sourceEndDate}`,
        severity: replicationIssues.length > 0 ? 'warning' : 'info',
        impactSummary:
          replicationIssues.length > 0
            ? 'Replicacao de escala executada com alerta de irregularidade.'
            : scaleReplicationModal.mode === 'weekly'
              ? 'Replicacao de escala executada em recorrencia semanal.'
              : 'Replicacao de escala executada por periodo.',
        relatedCompanyIds: [currentCompanyId],
      })
    }

    if (replicationIssues.length > 0) {
      setScaleWarning({
        title: `Replicacao concluida para ${getCollaboratorProfile(collaborator.cpf)?.fullName ?? collaborator.cpf}`,
        messages: Array.from(new Set(replicationIssues)),
      })
      return
    }

    setScaleWarning({
      title: 'Replicacao concluida',
      messages: [
        `Escala replicada de ${formatDateLabel(scaleReplicationModal.sourceStartDate)} ate ${formatDateLabel(scaleReplicationModal.sourceEndDate)}.`,
        scaleReplicationModal.mode === 'weekly'
          ? `Recorrencia semanal iniciada em ${formatDateLabel(scaleReplicationModal.targetStartDate)} por ${weeklyRepeatCount} semana(s).`
          : `Novo periodo iniciado em ${formatDateLabel(scaleReplicationModal.targetStartDate)}.`,
      ],
    })
  }

  function submitScaleReplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!scaleReplicationModal) {
      return
    }

    const collaborator = companyCollaborators.find(
      (item) => item.id === scaleReplicationModal.collaboratorId,
    ) ?? null

    if (!collaborator) {
      setScaleWarning({
        title: 'Colaborador indisponivel',
        messages: ['O colaborador selecionado nao foi encontrado na empresa ativa.'],
      })
      return
    }

    applyScaleReplication(collaborator, false)
  }

  function applyScaleBatch(allowIrregular: boolean) {
    if (!currentCompanyId || !canEditScale || !scaleBatchModal) {
      return
    }

    const runtimeState = resolveScaleBatchRuntimeState(scaleBatchModal)
    if (runtimeState.errorMessage) {
      closeScaleBatchModal()
      setScaleWarning({
        title: 'Operacao em lote indisponivel',
        messages: [runtimeState.errorMessage, 'Abra novamente o modal e tente de novo.'],
      })
      return
    }

    const weekDates = runtimeState.weekDates
    const targetRows = runtimeState.targetRows

    if (targetRows.length === 0) {
      setScaleWarning({
        title: 'Nenhum colaborador elegivel',
        messages: ['Nao ha linhas visiveis que correspondam ao filtro escolhido para a operacao em lote.'],
      })
      return
    }

    if (scaleBatchModal.selectedDates.length === 0) {
      setScaleWarning({
        title: 'Dias nao selecionados',
        messages: ['Selecione ao menos um dia da semana para aplicar a operacao em lote.'],
      })
      return
    }

    const numericScheduleId = Number(scaleBatchModal.scheduleIdValue)
    const hasScheduleSelection = !Number.isNaN(numericScheduleId) && numericScheduleId > 0
    let nextId = scaleAssignments.reduce((max, item) => Math.max(max, item.id), 0)
    const nextAssignments = [...scaleAssignments]

    targetRows.forEach((collaborator) => {
      scaleBatchModal.selectedDates.forEach((date) => {
        const currentIndex = nextAssignments.findIndex(
          (item) =>
            item.companyId === currentCompanyId &&
            item.collaboratorId === collaborator.id &&
            item.date === date,
        )

        if (currentIndex >= 0 && !scaleBatchModal.overwriteExisting) {
          return
        }

        if (currentIndex >= 0) {
          nextAssignments.splice(currentIndex, 1)
        }

        if (!hasScheduleSelection) {
          return
        }

        nextId += 1
        nextAssignments.push({
          id: nextId,
          companyId: currentCompanyId,
          collaboratorId: collaborator.id,
          date,
          scheduleId: numericScheduleId,
        })
      })
    })

    const issues = targetRows.flatMap((collaborator) => validateScaleRow(collaborator, weekDates, nextAssignments.filter((item) => item.companyId === currentCompanyId)).issues)
    const uniqueIssues = Array.from(new Set(issues))

    if (uniqueIssues.length > 0 && !allowIrregular) {
      pendingScaleBatchRef.current = () => applyScaleBatch(true)
      setScaleBatchWarning({
        title: 'Operacao em lote com irregularidades',
        messages: uniqueIssues,
        confirmLabel: 'Aplicar mesmo assim',
      })
      return
    }

    setScaleAssignments(nextAssignments)
    closeScaleBatchModal()

    if (currentSessionActor) {
      appendAuditLog({
        companyId: currentCompanyId,
        actorName: currentSessionActor.name,
        actorRole: currentSessionActor.role,
        module: 'Escala',
        action: 'Atualizacao',
        targetType: 'Escala',
        targetLabel: `operacao em lote ${scaleBatchModal.weekStart}`,
        severity: uniqueIssues.length > 0 ? 'warning' : 'info',
        impactSummary:
          uniqueIssues.length > 0
            ? 'Operacao em lote na escala executada com alerta de irregularidade.'
            : 'Operacao em lote na escala executada com sucesso.',
        relatedCompanyIds: [currentCompanyId],
      })
    }

    setScaleWarning({
      title: 'Operacao em lote concluida',
      messages: uniqueIssues.length > 0
        ? uniqueIssues
        : [
            `${targetRows.length} colaborador(es) afetado(s) em ${scaleBatchModal.selectedDates.length} dia(s).`,
            hasScheduleSelection ? 'Horario aplicado em lote.' : 'Folgas aplicadas em lote.',
          ],
    })
  }

  function submitScaleBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    applyScaleBatch(false)
  }

  function handleScalePrint() {
    if (typeof window === 'undefined') {
      return
    }

    window.print()
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
    setCompanyLinkedCompanyIds(company.linkedCompanyIds ?? [])
    setCompanyPublicServiceHours(normalizePublicServiceHours(company.publicServiceHours))
    setCompanyCoverageTargets(normalizeCoverageTargets(company.coverageTargets))
    const nextDefaultScaleViewMode = company.defaultScaleViewMode ?? 'week'
    setScaleViewMode(nextDefaultScaleViewMode)
    if (nextDefaultScaleViewMode === 'week' || nextDefaultScaleViewMode === 'month') {
      setLastScalePlanningViewMode(nextDefaultScaleViewMode)
    }
    setPrintIncludeExtras(company.defaultPrintIncludeExtras ?? false)
    setSelectedReportId(company.defaultReportId ?? 'scale-consolidated')
  }

  function switchCompany(companyId: number) {
    runWithDiscardGuard(() => {
      const targetCompany = findCompanyById(companies, companyId)
      if (!targetCompany) {
        return
      }

      if (session?.kind === 'companyUser') {
        const targetMembership = session.memberships.find((item) => item.companyId === companyId)
        if (!targetMembership) {
          return
        }

        if (targetCompany.status === 'INATIVA') {
          setLoginError('A empresa selecionada esta inativa.')
          return
        }

        if (targetMembership.id !== session.user.id) {
          setSession({
            kind: 'companyUser',
            user: targetMembership,
            memberships: session.memberships,
          })
        }
      }

      setCurrentCompanyId(companyId)
      populateCompanyForm(targetCompany)
      resetForms()
      setActiveSection('Painel')
      setLoginError('')
      if (session) {
        appendAuditLog({
          companyId,
          actorName: session.user.fullName,
          actorRole: session.kind === 'systemAdmin' ? 'Master' : session.user.role,
          module: 'Sessao',
          action: 'Troca de empresa',
          targetType: 'Empresa',
          targetLabel: targetCompany.tradeName,
          severity: 'info',
          impactSummary: `Empresa ativa alterada para ${targetCompany.tradeName}.`,
          relatedCompanyIds: [companyId],
        })
      }
    })
  }

  function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const systemAdmin = findSystemAdminByCredentials(systemAdmins, loginForm.username, loginForm.password)

    if (systemAdmin) {
      appendAuditLog({
        companyId: null,
        actorName: systemAdmin.fullName,
        actorRole: 'Master',
        module: 'Sessao',
        action: 'Login',
        targetType: 'Sessao',
        targetLabel: 'Administrador do sistema',
        severity: 'info',
        impactSummary: 'Login master realizado com sucesso.',
        relatedCompanyIds: [],
      })
      setSession({ kind: 'systemAdmin', user: systemAdmin })
      setLoginError('')
      if (companies.length > 0) {
        setCurrentCompanyId(null)
        setIsCompanyModalOpen(false)
      }
      return
    }

    const companyUserMemberships = getActiveCompanyUserMemberships(
      getCompanyUserMembershipsFromCredentials(
        users,
        loginForm.username,
        loginForm.password,
      ),
      companies,
    )

    if (companyUserMemberships.length === 0) {
      setLoginError('Usuario ou senha invalidos.')
      return
    }

    const { primaryMembership, targetCompany, nextCompanyId, requiresCompanySelection } = resolveCompanyLoginResult(
      companyUserMemberships,
      companies,
    )
    if (!primaryMembership) {
      setLoginError('Usuario ou senha invalidos.')
      return
    }
    setSession({
      kind: 'companyUser',
      user: primaryMembership,
      memberships: companyUserMemberships,
    })
    appendAuditLog({
      companyId: companyUserMemberships.length === 1 ? primaryMembership.companyId : null,
      actorName: primaryMembership.fullName,
      actorRole: primaryMembership.role,
      module: 'Sessao',
      action: 'Login',
      targetType: 'Sessao',
      targetLabel: primaryMembership.username,
      severity: 'info',
      impactSummary:
        !requiresCompanySelection
          ? `Login realizado na empresa ${targetCompany?.tradeName ?? primaryMembership.companyId}.`
          : 'Login multiempresa realizado com selecao de empresa pendente.',
      relatedCompanyIds: companyUserMemberships.map((item) => item.companyId),
    })
    setCurrentCompanyId(nextCompanyId)
    if (targetCompany && !requiresCompanySelection) {
      populateCompanyForm(targetCompany)
    } else {
      setCompanyForm(emptyCompanyForm)
      setCompanyLinkedCompanyIds([])
      setCompanyPublicServiceHours(buildEmptyPublicServiceHours())
      setCompanyCoverageTargets(buildEmptyCoverageTargets())
    }
    setLoginError('')
  }

  function logout() {
    runWithDiscardGuard(() => {
      if (session) {
        appendAuditLog({
          companyId: currentCompanyId,
          actorName: session.user.fullName,
          actorRole: session.kind === 'systemAdmin' ? 'Master' : session.user.role,
          module: 'Sessao',
          action: 'Logout',
          targetType: 'Sessao',
          targetLabel: session.user.fullName,
          severity: 'info',
          impactSummary: 'Sessao encerrada manualmente.',
          relatedCompanyIds: currentCompanyId === null ? [] : [currentCompanyId],
        })
      }
      setSession(null)
      setCurrentCompanyId(null)
      setLoginForm({ username: '', password: '' })
      setLoginError('')
      setIsCompanyModalOpen(false)
    })
  }

  function startAgreementFromCompanyContext() {
    runWithDiscardGuard(() => {
      setAgreementForm((current) => ({
        ...current,
        coveredState: companyForm.state,
        coveredCity: companyForm.city,
      }))
      setEditingAgreementId(null)
      setActiveSection('Convencoes')
      setIsCompanyModalOpen(false)
    })
  }

  function validateCoverageConfiguration() {
    const invalidPublicServiceDay = coverageDayKeys.find((dayKey) => {
      const daySettings = companyPublicServiceHours[dayKey]
      if (!daySettings.isOpen) {
        return false
      }

      if (!daySettings.start || !daySettings.end) {
        return true
      }

      const hasBreakStart = daySettings.breakStart.trim().length > 0
      const hasBreakEnd = daySettings.breakEnd.trim().length > 0
      return hasBreakStart !== hasBreakEnd
    })
    if (invalidPublicServiceDay) {
      return (
        'Revise o atendimento ao publico de ' +
        coverageDayLabels[invalidPublicServiceDay] +
        '. Preencha inicio e fim e, se houver pausa, informe inicio e fim da pausa.'
      )
    }

    const invalidCoverageTargetDay = coverageDayKeys.find((dayKey) => {
      const dayTarget = companyCoverageTargets[dayKey]
      if (dayTarget.defaultMinimumStaff.trim().length > 0 && Number.isNaN(Number(dayTarget.defaultMinimumStaff))) {
        return true
      }

      const normalizedRanges = dayTarget.timeTargets
        .map((timeTarget) => {
          const start = parseTwentyFourHourValue(timeTarget.start)
          const end = parseTwentyFourHourValue(timeTarget.end)
          if (start === null || end === null) {
            return null
          }

          const [normalizedStart, normalizedEnd] = normalizeSequentialTimes([start, end])
          return { normalizedStart, normalizedEnd }
        })
        .filter((item): item is { normalizedStart: number; normalizedEnd: number } => item !== null)
        .sort((left, right) => left.normalizedStart - right.normalizedStart)

      for (const timeTarget of dayTarget.timeTargets) {
        if (!timeTarget.start || !timeTarget.end) {
          return true
        }

        if (Number.isNaN(Number(timeTarget.minimumStaff))) {
          return true
        }

        if (
          timeTarget.functionTargets.some(
            (functionTarget) => !functionTarget.functionName.trim() || Number.isNaN(Number(functionTarget.minimumStaff)),
          )
        ) {
          return true
        }
      }

      for (let index = 1; index < normalizedRanges.length; index += 1) {
        if (normalizedRanges[index - 1].normalizedEnd > normalizedRanges[index].normalizedStart) {
          return true
        }
      }

      return false
    })

    if (invalidCoverageTargetDay) {
      return (
        'Revise as metas de cobertura de ' +
        coverageDayLabels[invalidCoverageTargetDay] +
        '. Verifique metas numericas, horarios completos e faixas sem sobreposicao.'
      )
    }

    return null
  }

  function submitCoverageSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setCoverageSettingsFeedback(null)

    if (!currentCompanyId || !currentCompany) {
      setCoverageSettingsFeedback({ type: 'error', message: 'Selecione uma empresa antes de configurar a cobertura operacional.' })
      return
    }

    const coverageValidationMessage = validateCoverageConfiguration()
    if (coverageValidationMessage) {
      setCoverageSettingsFeedback({ type: 'error', message: coverageValidationMessage })
      return
    }

    const sanitizedPublicServiceHours = normalizePublicServiceHours(companyPublicServiceHours)
    const sanitizedCoverageTargets = normalizeCoverageTargets(companyCoverageTargets)

    const updatedCompany: CompanyRecord = {
      ...currentCompany,
      publicServiceHours: sanitizedPublicServiceHours,
      coverageTargets: sanitizedCoverageTargets,
    }

    setCompanies((current) =>
      current.map((item) => (item.id === currentCompanyId ? updatedCompany : item)),
    )
    populateCompanyForm(updatedCompany)

    if (currentSessionActor) {
      appendAuditLog({
        companyId: currentCompanyId,
        actorName: currentSessionActor.name,
        actorRole: currentSessionActor.role,
        module: 'Cobertura',
        action: 'Atualizacao',
        targetType: 'Cobertura operacional',
        targetLabel: currentCompany.tradeName,
        severity: 'warning',
        impactSummary: 'Janela de atendimento e metas de cobertura foram atualizadas.',
        relatedCompanyIds: [currentCompanyId],
      })
    }

    setCoverageSettingsFeedback({ type: 'success', message: 'Cobertura operacional atualizada com sucesso.' })
  }

  function submitCompany(event: FormEvent<HTMLFormElement>, mode: 'create' | 'update') {
    event.preventDefault()
    setCompanyAgreementFeedback('')

    const missingBaseFields = [
      !companyForm.tradeName.trim() ? 'nome fantasia' : null,
      !companyForm.legalName.trim() ? 'razao social' : null,
      !companyForm.city.trim() ? 'cidade' : null,
      !companyForm.state.trim() ? 'estado' : null,
    ].filter((item): item is string => item !== null)

    if (missingBaseFields.length > 0) {
      setCompanyAgreementFeedback(
        'Preencha os campos obrigatorios da empresa: ' + missingBaseFields.join(', ') + '.',
      )
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
    const nextCompanyId = getNextNumericId(companies)
    const companyIdForSanitization = mode === 'create' ? nextCompanyId : currentCompanyId
    const sanitizedLinkedCompanyIds = Array.from(
      new Set(companyLinkedCompanyIds.filter((companyId) => companyId !== null && companyId !== companyIdForSanitization)),
    )
    const sanitizedPublicServiceHours = normalizePublicServiceHours(companyPublicServiceHours)
    const sanitizedCoverageTargets = normalizeCoverageTargets(companyCoverageTargets)

    if (mode === 'create') {
      const newCompany: CompanyRecord = {
        id: nextCompanyId,
        status: 'ATIVA',
        collectiveAgreementId,
        suggestedCollectiveAgreementId,
        collectiveProfile: 'padrao',
        defaultScaleViewMode: 'week',
        defaultReportId: 'scale-consolidated',
        defaultPrintIncludeExtras: false,
        allowPastScaleEdits: false,
        linkedCompanyIds: sanitizedLinkedCompanyIds,
        publicServiceHours: sanitizedPublicServiceHours,
        coverageTargets: sanitizedCoverageTargets,
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
      if (currentSessionActor) {
        appendAuditLog({
          companyId: newCompany.id,
          actorName: currentSessionActor.name,
          actorRole: currentSessionActor.role,
          module: 'Empresa',
          action: 'Criacao',
          targetType: 'Empresa',
          targetLabel: newCompany.tradeName,
          severity: 'critical',
          impactSummary: 'Nova empresa cadastrada no sistema.',
          relatedCompanyIds: [newCompany.id],
        })
      }
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
              defaultScaleViewMode: item.defaultScaleViewMode ?? 'week',
              defaultReportId: item.defaultReportId ?? 'scale-consolidated',
              defaultPrintIncludeExtras: item.defaultPrintIncludeExtras ?? false,
              allowPastScaleEdits: item.allowPastScaleEdits ?? false,
              linkedCompanyIds: sanitizedLinkedCompanyIds,
              publicServiceHours: sanitizedPublicServiceHours,
              coverageTargets: sanitizedCoverageTargets,
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
    if (currentSessionActor && currentCompany) {
      appendAuditLog({
        companyId: currentCompanyId,
        actorName: currentSessionActor.name,
        actorRole: currentSessionActor.role,
        module: 'Empresa',
        action: 'Atualizacao',
        targetType: 'Empresa',
        targetLabel: currentCompany.tradeName,
        severity: 'warning',
        impactSummary: 'Dados cadastrais da empresa foram atualizados.',
        relatedCompanyIds: [currentCompanyId],
      })
    }
  }

  function deleteCompany(companyId: number) {
    const targetCompany = companies.find((item) => item.id === companyId)
    if (!targetCompany || targetCompany.status !== 'INATIVA') {
      return
    }

    setCompanies((current) =>
      current
        .filter((item) => item.id !== companyId)
        .map((item) => ({
          ...item,
          linkedCompanyIds: item.linkedCompanyIds.filter((linkedCompanyId) => linkedCompanyId !== companyId),
        })),
    )
    setSectors((current) => current.filter((item) => item.companyId !== companyId))
    setFunctions((current) => current.filter((item) => item.companyId !== companyId))
    setCollaborators((current) => current.filter((item) => item.companyId !== companyId))
    setSchedules((current) => current.filter((item) => item.companyId !== companyId))
    setScaleAssignments((current) => current.filter((item) => item.companyId !== companyId))
    setScaleExtraRoster((current) => current.filter((item) => item.companyId !== companyId))
    setUsers((current) => current.filter((item) => item.companyId !== companyId))
    if (currentSessionActor && targetCompany) {
      appendAuditLog({
        companyId,
        actorName: currentSessionActor.name,
        actorRole: currentSessionActor.role,
        module: 'Empresa',
        action: 'Exclusao',
        targetType: 'Empresa',
        targetLabel: targetCompany.tradeName,
        severity: 'critical',
        impactSummary: 'Empresa removida do sistema.',
        relatedCompanyIds: [companyId],
      })
    }

    if (currentCompanyId === companyId) {
      setCurrentCompanyId(null)
      setCompanyForm(emptyCompanyForm)
      setCompanyLinkedCompanyIds([])
      setCompanyPublicServiceHours(buildEmptyPublicServiceHours())
      setCompanyCoverageTargets(buildEmptyCoverageTargets())
      resetForms()
    }
  }

  function toggleCompanyStatus(companyId: number) {
    const targetCompany = companies.find((item) => item.id === companyId) ?? null
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
    if (currentSessionActor && targetCompany) {
      appendAuditLog({
        companyId,
        actorName: currentSessionActor.name,
        actorRole: currentSessionActor.role,
        module: 'Empresa',
        action: 'Status',
        targetType: 'Empresa',
        targetLabel: targetCompany.tradeName,
        severity: 'warning',
        impactSummary: `Empresa ${targetCompany.status === 'ATIVA' ? 'inativada' : 'ativada'}.`,
        relatedCompanyIds: [companyId],
      })
    }
  }

  function updateCompanyCollectiveProfile(
    companyId: number,
    collectiveProfile: CompanyRecord['collectiveProfile'],
  ) {
    setCompanies((current) => updateCompanyCollectiveProfileInCollection(current, companyId, collectiveProfile))
  }

  function updateCompanyOperationalSettings(
    companyId: number,
    updates: Partial<
      Pick<
        CompanyRecord,
        'defaultScaleViewMode' | 'defaultReportId' | 'defaultPrintIncludeExtras' | 'allowPastScaleEdits'
      >
    >,
  ) {
    const targetCompany = companies.find((item) => item.id === companyId) ?? null
    setCompanies((current) => updateCompanyOperationalSettingsInCollection(current, companyId, updates))

    if (targetCompany) {
      if (updates.defaultScaleViewMode) {
        setScaleViewMode(updates.defaultScaleViewMode)
        if (updates.defaultScaleViewMode === 'week' || updates.defaultScaleViewMode === 'month') {
          setLastScalePlanningViewMode(updates.defaultScaleViewMode)
        }
      }
      if (updates.defaultReportId) {
        setSelectedReportId(updates.defaultReportId)
      }
      if (typeof updates.defaultPrintIncludeExtras === 'boolean') {
        setPrintIncludeExtras(updates.defaultPrintIncludeExtras)
      }
      if (currentSessionActor) {
        appendAuditLog({
          companyId,
          actorName: currentSessionActor.name,
          actorRole: currentSessionActor.role,
          module: 'Empresa',
          action: 'Configuracoes operacionais',
          targetType: 'Empresa',
          targetLabel: targetCompany.tradeName,
          severity: 'warning',
          impactSummary: 'Configuracoes operacionais da empresa foram atualizadas.',
          relatedCompanyIds: [companyId],
        })
      }
    }
  }

  function handleAgreementSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!agreementForm.name.trim() || !agreementForm.coveredState.trim() || !agreementForm.coveredCity.trim()) {
      return
    }

    const newAgreement: CollectiveAgreementRecord = {
      id: editingAgreementId ?? getNextNumericId(agreements),
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

  function openFunctionCloneModal(functionId: number) {
    if (!currentCompanyId) {
      return
    }

    const sourceFunction = companyFunctions.find((item) => item.id === functionId && item.companyId !== currentCompanyId) ?? null
    if (!sourceFunction) {
      return
    }

    setFunctionCloneModal({
      sourceFunctionId: sourceFunction.id,
      name: buildUniqueLocalCloneName(sourceFunction.name, companyFunctions.map((item) => item.name)),
      sector: sourceFunction.sector,
      description: sourceFunction.description,
      baseSalary: sourceFunction.baseSalary,
      serviceQuota: sourceFunction.serviceQuota,
      extraPayValue: sourceFunction.extraPayValue,
    })
  }

  function closeFunctionCloneModal() {
    setFunctionCloneModal(null)
  }

  function submitFunctionClone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentCompanyId || !functionCloneModal) {
      return
    }

    const sourceFunction = companyFunctions.find((item) => item.id === functionCloneModal.sourceFunctionId) ?? null
    if (!sourceFunction) {
      setFunctionWarning(buildInvalidFunctionWarning(['A funcao de origem nao esta mais disponivel para clonagem.']))
      setFunctionCloneModal(null)
      return
    }

    const validationMessages: string[] = []
    const resolvedSector = resolveCompanySectorName(sectors, currentCompanyId, functionCloneModal.sector)
    const clonedFunction: FunctionRecord = {
      id: getNextNumericId(functions),
      companyId: currentCompanyId,
      name: functionCloneModal.name.trim(),
      sector: resolvedSector,
      description: functionCloneModal.description.trim(),
      baseSalary: functionCloneModal.baseSalary.trim(),
      serviceQuota: functionCloneModal.serviceQuota.trim(),
      extraPayValue: functionCloneModal.extraPayValue.trim(),
      isActive: true,
      inactivePeriods: [],
    }

    if (!clonedFunction.name) {
      validationMessages.push('Informe o nome da copia local da funcao.')
    }

    if (!clonedFunction.sector) {
      validationMessages.push('Informe o setor da copia local da funcao.')
    }

    if (!clonedFunction.description) {
      validationMessages.push('Informe o descritivo da copia local da funcao.')
    }

    const duplicatedFunction = localCompanyFunctions.find(
      (item) => item.name.trim().toLowerCase() === clonedFunction.name.toLowerCase(),
    )
    if (duplicatedFunction) {
      validationMessages.push('Ja existe uma funcao local nesta empresa com esse nome.')
    }

    if (validationMessages.length > 0) {
      setFunctionWarning(buildInvalidFunctionWarning(validationMessages))
      return
    }

    ensureCompanySector(currentCompanyId, clonedFunction.sector)
    setFunctions((current) => [clonedFunction, ...current])
    setFunctionCloneModal(null)
    setFunctionWarning(null)
    if (currentSessionActor) {
      appendAuditLog({
        companyId: currentCompanyId,
        actorName: currentSessionActor.name,
        actorRole: currentSessionActor.role,
        module: 'Funcao',
        action: 'Clonagem',
        targetType: 'Funcao',
        targetLabel: clonedFunction.name,
        severity: 'warning',
        impactSummary: `Funcao clonada de ${getCompanyTradeNameById(sourceFunction.companyId)} para ${currentCompany?.tradeName ?? currentCompanyId}.`,
        relatedCompanyIds: [sourceFunction.companyId, currentCompanyId],
      })
    }
  }

  function handleFunctionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationMessages: string[] = []

    if (!currentCompanyId) {
      validationMessages.push('Selecione uma empresa antes de cadastrar funcoes.')
      setFunctionWarning(buildInvalidFunctionWarning(validationMessages))
      return
    }

    const resolvedSector = resolveCompanySectorName(sectors, currentCompanyId, functionForm.sector)
    const existingFunction = functions.find((item) => item.id === editingFunctionId) ?? null

    const newItem: FunctionRecord = {
      id: editingFunctionId ?? getNextNumericId(functions),
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

    if (!newItem.name) {
      validationMessages.push('Informe o nome da funcao.')
    }

    if (!newItem.sector) {
      validationMessages.push('Informe o setor da funcao.')
    }

    if (!newItem.description) {
      validationMessages.push('Informe o descritivo da funcao.')
    }

    const duplicatedFunction = companyFunctions.find(
      (item) =>
        item.id !== editingFunctionId &&
        item.companyId === currentCompanyId &&
        item.name.trim().toLowerCase() === newItem.name.toLowerCase(),
    )
    if (duplicatedFunction) {
      validationMessages.push('Ja existe uma funcao cadastrada nesta empresa com esse nome.')
    }

    if (validationMessages.length > 0) {
      setFunctionWarning(buildInvalidFunctionWarning(validationMessages))
      return
    }

    setFunctionWarning(null)
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

    const validationMessages: string[] = []

    if (!currentCompanyId) {
      validationMessages.push('Selecione uma empresa antes de cadastrar colaboradores.')
      setCollaboratorWarning(buildInvalidCollaboratorWarning(validationMessages))
      return
    }

    const normalizedFunctions =
      collaboratorForm.employmentType === 'EXTRA'
        ? collaboratorForm.functions.slice(0, 6)
        : collaboratorForm.functions.slice(0, 1)

    const cpfDigits = collaboratorForm.cpf.replace(/\D/g, '')
    if (cpfDigits.length !== 11) {
      validationMessages.push('Informe um CPF completo com 11 digitos.')
    }

    if (!collaboratorForm.fullName.trim()) {
      validationMessages.push('Informe o nome completo do colaborador.')
    }

    if (normalizedFunctions.length === 0) {
      validationMessages.push('Selecione ao menos uma funcao para o colaborador.')
    }

    if (normalizedFunctions.length > 1 && !collaboratorForm.primaryFunction) {
      validationMessages.push('Defina a funcao principal quando houver mais de uma funcao selecionada.')
    }

    if (validationMessages.length > 0) {
      setCollaboratorWarning(buildInvalidCollaboratorWarning(validationMessages))
      return
    }

    setCollaboratorWarning(null)
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

  function openScheduleCloneModal(scheduleId: number) {
    if (!currentCompanyId) {
      return
    }

    const sourceSchedule = companySchedules.find((item) => item.id === scheduleId && item.companyId !== currentCompanyId) ?? null
    if (!sourceSchedule) {
      return
    }

    setScheduleCloneModal({
      sourceScheduleId: sourceSchedule.id,
      shiftName: buildUniqueLocalCloneName(sourceSchedule.shiftName, companySchedules.map((item) => item.shiftName)),
      startTime: sourceSchedule.startTime,
      startPeriod: sourceSchedule.startPeriod,
      breakStart: sourceSchedule.breakStart,
      breakStartPeriod: sourceSchedule.breakStartPeriod,
      breakEnd: sourceSchedule.breakEnd,
      breakEndPeriod: sourceSchedule.breakEndPeriod,
      endTime: sourceSchedule.endTime,
      endPeriod: sourceSchedule.endPeriod,
    })
  }

  function closeScheduleCloneModal() {
    setScheduleCloneModal(null)
  }

  function persistClonedScheduleRecord(
    sourceScheduleId: number,
    cloneValues: ScheduleCloneModalState,
    validation: ValidationResult,
    abbreviation: string,
  ) {
    if (!currentCompanyId) {
      return
    }

    const sourceSchedule = companySchedules.find((item) => item.id === sourceScheduleId) ?? null
    const newItem: ScheduleRecord = {
      id: schedules.reduce((max, item) => Math.max(max, item.id), 0) + 1,
      companyId: currentCompanyId,
      isActive: true,
      inactivePeriods: [],
      shiftName: cloneValues.shiftName.trim(),
      abbreviation,
      startTime: cloneValues.startTime,
      startPeriod: cloneValues.startPeriod,
      breakStart: cloneValues.breakStart,
      breakStartPeriod: cloneValues.breakStartPeriod,
      breakEnd: cloneValues.breakEnd,
      breakEndPeriod: cloneValues.breakEndPeriod,
      endTime: cloneValues.endTime,
      endPeriod: cloneValues.endPeriod,
      netMinutes: validation.netMinutes ?? 0,
      validationMessage: validation.notes.join(' '),
    }

    pendingScheduleOverrideRef.current = null
    setScheduleWarning(null)
    setSchedules((current) => [newItem, ...current])
    setScheduleCloneModal(null)
    setScheduleFeedback(
      buildSuccessfulScheduleFeedback(false, [
        `Horario clonado de ${sourceSchedule ? getCompanyTradeNameById(sourceSchedule.companyId) : 'empresa vinculada'}.`,
        ...validation.notes,
      ], validation.netMinutes),
    )
    if (currentSessionActor && sourceSchedule) {
      appendAuditLog({
        companyId: currentCompanyId,
        actorName: currentSessionActor.name,
        actorRole: currentSessionActor.role,
        module: 'Horario',
        action: 'Clonagem',
        targetType: 'Horario',
        targetLabel: newItem.shiftName,
        severity: 'warning',
        impactSummary: `Horario clonado de ${getCompanyTradeNameById(sourceSchedule.companyId)} para ${currentCompany?.tradeName ?? currentCompanyId}.`,
        relatedCompanyIds: [sourceSchedule.companyId, currentCompanyId],
      })
    }
  }

  function submitScheduleClone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!currentCompanyId || !scheduleCloneModal) {
      return
    }

    const sourceSchedule = companySchedules.find((item) => item.id === scheduleCloneModal.sourceScheduleId) ?? null
    if (!sourceSchedule) {
      setScaleWarning(buildInvalidScheduleWarning(['O horario de origem nao esta mais disponivel para clonagem.']))
      setScheduleCloneModal(null)
      return
    }

    const validation = validateSchedule(scheduleCloneModal, currentCompany, currentAgreement)
    const suggestedAbbreviation = buildUniqueScheduleAbbreviation(
      scheduleCloneModal.shiftName,
      companySchedules.map((item) => item.abbreviation),
    )
    const duplicateSchedule = companySchedules.find(
      (item) =>
        item.shiftName.trim().toLowerCase() === scheduleCloneModal.shiftName.trim().toLowerCase() &&
        item.startTime === scheduleCloneModal.startTime &&
        item.startPeriod === scheduleCloneModal.startPeriod &&
        item.breakStart === scheduleCloneModal.breakStart &&
        item.breakStartPeriod === scheduleCloneModal.breakStartPeriod &&
        item.breakEnd === scheduleCloneModal.breakEnd &&
        item.breakEndPeriod === scheduleCloneModal.breakEndPeriod &&
        item.endTime === scheduleCloneModal.endTime &&
        item.endPeriod === scheduleCloneModal.endPeriod,
    )

    if (duplicateSchedule) {
      const duplicateFeedback = buildDuplicateScheduleFeedback()
      setScheduleFeedback(duplicateFeedback)
      setScaleWarning(buildInvalidScheduleWarning([...duplicateFeedback.errors, ...duplicateFeedback.notes]))
      return
    }

    if (!validation.valid) {
      setScheduleFeedback(validation)
      if (validation.canOverride) {
        const cloneSnapshot = { ...scheduleCloneModal }
        pendingScheduleOverrideRef.current = () =>
          persistClonedScheduleRecord(sourceSchedule.id, cloneSnapshot, validation, suggestedAbbreviation)
        setScheduleWarning({
          title: 'Horario clonado fora da CCT',
          messages: [...validation.errors, ...validation.notes],
          confirmLabel: 'Clonar mesmo assim',
        })
      } else {
        pendingScheduleOverrideRef.current = null
        setScaleWarning(buildInvalidScheduleWarning([...validation.errors, ...validation.notes]))
      }
      return
    }

    persistClonedScheduleRecord(sourceSchedule.id, scheduleCloneModal, validation, suggestedAbbreviation)
  }

  function handleScheduleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validation = validateSchedule(scheduleForm, currentCompany, currentAgreement)
    if (!currentCompanyId) {
      setScheduleFeedback(validation)
      setScaleWarning(buildInvalidScheduleWarning(['Selecione uma empresa antes de cadastrar horarios.']))
      return
    }

    const currentEditingSchedule = localCompanySchedules.find((item) => item.id === editingScheduleId) ?? null
    const suggestedAbbreviation = buildUniqueScheduleAbbreviation(
      scheduleForm.shiftName,
      companySchedules.map((item) => item.abbreviation),
      currentEditingSchedule?.abbreviation,
    )
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
      const duplicateFeedback = buildDuplicateScheduleFeedback()
      setScheduleFeedback(duplicateFeedback)
      setScaleWarning(buildInvalidScheduleWarning([...duplicateFeedback.errors, ...duplicateFeedback.notes]))
      return
    }

    if (!validation.valid) {
      setScheduleFeedback(validation)
      if (validation.canOverride) {
        pendingScheduleOverrideRef.current = () =>
          persistScheduleRecord(currentCompanyId, validation, suggestedAbbreviation)
        setScheduleWarning({
          title: 'Horario fora da CCT',
          messages: [...validation.errors, ...validation.notes],
          confirmLabel: editingScheduleId === null ? 'Cadastrar mesmo assim' : 'Salvar mesmo assim',
        })
      } else {
        pendingScheduleOverrideRef.current = null
        setScaleWarning(buildInvalidScheduleWarning([...validation.errors, ...validation.notes]))
      }
      return
    }

    persistScheduleRecord(currentCompanyId, validation, suggestedAbbreviation)
  }

  function persistScheduleRecord(
    companyId: number,
    validation: ValidationResult,
    abbreviation: string,
  ) {
    const nextScheduleId =
      editingScheduleId ?? schedules.reduce((max, item) => Math.max(max, item.id), 0) + 1

    const newItem: ScheduleRecord = {
      id: nextScheduleId,
      companyId,
      isActive:
        schedules.find((item) => item.id === editingScheduleId)?.isActive ?? true,
      inactivePeriods:
        schedules.find((item) => item.id === editingScheduleId)?.inactivePeriods ?? [],
      shiftName: scheduleForm.shiftName.trim(),
      abbreviation,
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

    pendingScheduleOverrideRef.current = null
    setScheduleWarning(null)
    setSchedules((current) =>
      editingScheduleId === null
        ? [newItem, ...current]
        : current.map((item) => (item.id === editingScheduleId ? newItem : item)),
    )
    setScheduleFeedback(
      buildSuccessfulScheduleFeedback(editingScheduleId !== null, validation.notes, validation.netMinutes),
    )
    setScheduleForm(emptyScheduleForm)
    setEditingScheduleId(null)
  }

  function closeScheduleWarning() {
    pendingScheduleOverrideRef.current = null
    setScheduleWarning(null)
  }

  function confirmScheduleWarning() {
    const pendingAction = pendingScheduleOverrideRef.current
    pendingScheduleOverrideRef.current = null
    setScheduleWarning(null)
    pendingAction?.()
  }

  function editSchedule(scheduleId: number) {
    const targetSchedule = localCompanySchedules.find((item) => item.id === scheduleId)
    if (!targetSchedule) {
      return
    }

    const nextState = buildScheduleEditState(targetSchedule, emptyScheduleForm)
    setEditingScheduleId(scheduleId)
    setScheduleForm(nextState.scheduleForm)
    setScheduleFeedback(nextState.scheduleFeedback)
  }

  function toggleScheduleActivation(scheduleId: number) {
    const targetSchedule = localCompanySchedules.find((item) => item.id === scheduleId)
    if (!targetSchedule) {
      return
    }

    const today = toIsoDate(new Date())
    const applyToggle = (replacementScheduleId: number | null) => {
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

      if (targetSchedule.isActive && replacementScheduleId !== null) {
        setScaleAssignments((current) =>
          replaceScheduleOnAssignments(current, scheduleId, replacementScheduleId, (date) => date >= today),
        )
      }
    }

    if (!targetSchedule.isActive) {
      applyToggle(null)
      return
    }

    requestScheduleActivationImpact(targetSchedule, applyToggle)
  }

  function deleteSchedule(scheduleId: number) {
    const targetSchedule = localCompanySchedules.find((item) => item.id === scheduleId) ?? null
    if (!targetSchedule) {
      return
    }

    requestScheduleDeletionImpact(targetSchedule, (replacementScheduleId) => {
      if (replacementScheduleId !== null) {
        setScaleAssignments((current) => replaceScheduleOnAssignments(current, scheduleId, replacementScheduleId))
      } else {
        setScaleAssignments((current) => current.filter((item) => item.scheduleId !== scheduleId))
      }

      setSchedules((current) => current.filter((item) => item.id !== scheduleId))
      if (editingScheduleId === scheduleId) {
        setScheduleForm(emptyScheduleForm)
        setEditingScheduleId(null)
      }
      setScheduleFeedback(buildDeletedScheduleFeedback())
    })
  }

  function toggleUserAdditionalCompany(companyId: string) {
    setUserForm((current) => {
      const exists = current.additionalCompanyIds.includes(companyId)
      return {
        ...current,
        additionalCompanyIds: exists
          ? current.additionalCompanyIds.filter((item) => item !== companyId)
          : [...current.additionalCompanyIds, companyId],
      }
    })
  }

  function toggleUserSectionAccess(section: AppSection) {
    setUserForm((current) => {
      const currentValue = current.sectionAccess[section]
      return {
        ...current,
        sectionAccess: {
          ...current.sectionAccess,
          [section]: !currentValue,
        },
      }
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

    const resolvedSectionAccess = normalizeSectionAccess(userForm.role, userForm.sectionAccess)

    if (!resolvedSectionAccess.Escala) {
      validationMessages.push('O acesso a Escala e obrigatorio para este tipo de usuario.')
    }

    if (userForm.role === 'Visualizador' && userForm.additionalCompanyIds.length > 0) {
      validationMessages.push('Usuario visualizador nao pode ser vinculado automaticamente a outras empresas.')
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

    const duplicateUsername = users.filter(
      (item) =>
        item.id !== editingUserId &&
        item.username.trim().toLowerCase() === userForm.username.trim().toLowerCase(),
    )
    if (
      duplicateUsername.some(
        (item) =>
          item.fullName.trim().toLowerCase() !== userForm.fullName.trim().toLowerCase() || item.password !== userForm.password,
      )
    ) {
      validationMessages.push(
        'Ja existe outro usuario cadastrado com esse login. Para reaproveitar o login em varias empresas, mantenha o mesmo nome e a mesma senha.',
      )
    }

    const targetCompanyIds = Array.from(
      new Set([currentCompanyId, ...userForm.additionalCompanyIds.map((item) => Number(item)).filter(Boolean)]),
    )

    const invalidLinkedCompanies = targetCompanyIds.filter(
      (companyId) => !currentCompanyLinkScopeIds.includes(companyId),
    )
    if (invalidLinkedCompanies.length > 0) {
      validationMessages.push('O login so pode ser vinculado a empresas autorizadas pela rede de empresas vinculadas.')
    }

    if (userForm.role !== 'Visualizador') {
      const companiesWithoutSectors = targetCompanyIds
        .filter((companyId) => companyId !== currentCompanyId)
        .map((companyId) => ({
          companyId,
          sectors: getSectorNamesForCompany(sectors, companyId),
          company: companies.find((item) => item.id === companyId) ?? null,
        }))
        .filter((item) => item.sectors.length === 0)

      if (companiesWithoutSectors.length > 0) {
        validationMessages.push(
          `As empresas ${companiesWithoutSectors
            .map((item) => item.company?.tradeName ?? String(item.companyId))
            .join(', ')} precisam ter ao menos um setor cadastrado antes de receber este login.`,
        )
      }
    }

    if (validationMessages.length > 0) {
      setUserWarning(buildInvalidUserWarning(validationMessages))
      return
    }

    const resolvedUserSectors =
      userForm.role === 'Visualizador' && linkedCollaboratorSector
        ? [resolveCompanySectorName(sectors, currentCompanyId, linkedCollaboratorSector)]
        : userForm.sectors.map((sectorName) => resolveCompanySectorName(sectors, currentCompanyId, sectorName))

    resolvedUserSectors.forEach((sectorName) => ensureCompanySector(currentCompanyId, sectorName))

    const originalUser = editingUserId === null ? null : users.find((item) => item.id === editingUserId) ?? null
    const originalMembershipGroup =
      originalUser === null ? [] : getCompanyUserMembershipsForUser(users, originalUser)
    const originalMembershipIds = new Set(originalMembershipGroup.map((item) => item.id))
    const baseUserIdSeed = users.reduce((max, item) => Math.max(max, item.id), 0) + 1

    const nextMemberships = targetCompanyIds.map((companyId, index) => {
      const existingMembership = originalMembershipGroup.find((item) => item.companyId === companyId) ?? null
      const companySectorNames =
        companyId === currentCompanyId ? resolvedUserSectors : getSectorNamesForCompany(sectors, companyId)

      return {
        id: existingMembership?.id ?? baseUserIdSeed + index,
        companyId,
        fullName: userForm.fullName.trim(),
        username: userForm.username.trim(),
        password: userForm.password,
        role: userForm.role,
        sectors: companySectorNames,
        sectionAccess: resolvedSectionAccess,
        linkedCollaboratorId:
          companyId === currentCompanyId && userForm.role === 'Visualizador' && userForm.linkedCollaboratorId
            ? Number(userForm.linkedCollaboratorId)
            : null,
        isActive: existingMembership?.isActive ?? originalUser?.isActive ?? true,
      } satisfies CompanyUserRecord
    })

    setUsers((current) => {
      const preservedUsers = current.filter((item) => !originalMembershipIds.has(item.id))
      return [...nextMemberships, ...preservedUsers]
    })
    if (currentSessionActor) {
      appendAuditLog({
        companyId: currentCompanyId,
        actorName: currentSessionActor.name,
        actorRole: currentSessionActor.role,
        module: 'Usuarios',
        action: editingUserId === null ? 'Criacao' : 'Atualizacao',
        targetType: 'Usuario',
        targetLabel: userForm.username.trim(),
        severity: 'critical',
        impactSummary:
          editingUserId === null
            ? 'Novo login cadastrado.'
            : 'Configuracoes de acesso do usuario foram atualizadas.',
        relatedCompanyIds: targetCompanyIds,
      })
    }
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

    const nextState = buildUserEditState(
      targetUser,
      (role, sectionAccess) => normalizeSectionAccess(role as CompanyRole, sectionAccess),
      getCompanyUserMembershipsForUser(users, targetUser)
        .filter((item) => item.companyId !== targetUser.companyId)
        .map((item) => String(item.companyId)),
    )
    setEditingUserId(userId)
    setUserForm(nextState.userForm)
    setIsUserFormPasswordVisible(nextState.isUserFormPasswordVisible)
  }

  function toggleUserActivation(userId: number) {
    const targetUser = users.find((item) => item.id === userId) ?? null
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
    if (currentSessionActor && targetUser) {
      appendAuditLog({
        companyId: targetUser.companyId,
        actorName: currentSessionActor.name,
        actorRole: currentSessionActor.role,
        module: 'Usuarios',
        action: 'Status',
        targetType: 'Usuario',
        targetLabel: targetUser.username,
        severity: 'warning',
        impactSummary: `Usuario ${targetUser.isActive ? 'inativado' : 'ativado'}.`,
        relatedCompanyIds: [targetUser.companyId],
      })
    }
  }

  function deleteUser(userId: number) {
    const targetUser = users.find((item) => item.id === userId) ?? null
    setUsers((current) => current.filter((item) => item.id !== userId))
    if (currentSessionActor && targetUser) {
      appendAuditLog({
        companyId: targetUser.companyId,
        actorName: currentSessionActor.name,
        actorRole: currentSessionActor.role,
        module: 'Usuarios',
        action: 'Exclusao',
        targetType: 'Usuario',
        targetLabel: targetUser.username,
        severity: 'critical',
        impactSummary: 'Login removido do sistema.',
        relatedCompanyIds: [targetUser.companyId],
      })
    }
    if (editingUserId === userId) {
      setUserForm(emptyUserForm)
      setUserSectorInput('')
      setEditingUserId(null)
    }
  }

  function toggleCollaboratorFunction(functionName: string) {
    setCollaboratorForm((current) => toggleCollaboratorFunctionSelection(current, functionName))
  }

  function changeCollaboratorEmploymentType(employmentType: CollaboratorEmploymentType) {
    setCollaboratorForm((current) => changeCollaboratorEmploymentTypeState(current, employmentType))
  }

  function toggleCollaboratorActivation(collaboratorId: number) {
    if (!canManageCollaboratorActivation) {
      return
    }

    const targetCollaborator = collaborators.find((item) => item.id === collaboratorId)
    if (!targetCollaborator) {
      return
    }

    const today = toIsoDate(new Date())
    const applyToggle = () => {
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

    if (!targetCollaborator.isActive) {
      applyToggle()
      return
    }

    requestCollaboratorActivationImpact(targetCollaborator, applyToggle)
  }

  function editCollaborator(collaboratorId: number) {
    const targetCollaborator = collaborators.find((item) => item.id === collaboratorId)
    if (!targetCollaborator) {
      return
    }

    const targetProfile =
      collaboratorProfiles.find((profile) => profile.cpf.replace(/\D/g, '') === targetCollaborator.cpf.replace(/\D/g, '')) ?? null

    const nextState = buildCollaboratorEditState(targetCollaborator, targetProfile)
    setCollaboratorForm(nextState.collaboratorForm)
    setCollaboratorLookupFeedback(nextState.collaboratorLookupFeedback)
  }

  function deleteCollaborator(collaboratorId: number) {
    const targetCollaborator = collaborators.find((item) => item.id === collaboratorId)
    if (!targetCollaborator) {
      return
    }

    requestCollaboratorDeletionImpact(targetCollaborator, () => {
      setCollaborators((current) => current.filter((item) => item.id !== collaboratorId))
      setScaleAssignments((current) => current.filter((item) => item.collaboratorId !== collaboratorId))
      setScaleExtraRoster((current) => current.filter((item) => item.collaboratorId !== collaboratorId))
      setUsers((current) =>
        current.map((item) =>
          item.linkedCollaboratorId === collaboratorId
            ? {
                ...item,
                linkedCollaboratorId: null,
              }
            : item,
        ),
      )

      if (currentCompanyCollaborator?.id === collaboratorId) {
        setCollaboratorForm(emptyCollaboratorForm)
        setCollaboratorLookupFeedback('')
      }
    })
  }

  function openFunctionModal(prefillName = '') {
    const nextState = buildFunctionModalOpenState(functionForm, prefillName)
    setFunctionSuggestion(nextState.functionSuggestion)
    setFunctionForm(nextState.functionForm)
    setIsFunctionModalOpen(nextState.isFunctionModalOpen)
  }

  function editFunction(functionId: number) {
    const targetFunction = localCompanyFunctions.find((item) => item.id === functionId)
    if (!targetFunction) {
      return
    }

    const nextState = buildFunctionEditState(targetFunction)
    setEditingFunctionId(functionId)
    setFunctionForm(nextState.functionForm)
  }

  function toggleFunctionActivation(functionId: number) {
    const targetFunction = localCompanyFunctions.find((item) => item.id === functionId)
    if (!targetFunction) {
      return
    }

    const today = toIsoDate(new Date())
    const applyToggle = (replacementFunctionName: string | null) => {
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

      if (targetFunction.isActive && replacementFunctionName) {
        setCollaborators((current) =>
          replaceFunctionOnCollaborators(current, targetFunction.name, replacementFunctionName),
        )
      }
    }

    if (!targetFunction.isActive) {
      applyToggle(null)
      return
    }

    requestFunctionActivationImpact(targetFunction, applyToggle)
  }

  function deleteFunction(functionId: number) {
    const targetFunction = localCompanyFunctions.find((item) => item.id === functionId)
    if (!targetFunction) {
      return
    }

    requestFunctionDeletionImpact(targetFunction, (replacementFunctionName) => {
      setFunctions((current) => current.filter((item) => item.id !== functionId))
      setCollaborators((current) =>
        replacementFunctionName
          ? replaceFunctionOnCollaborators(current, targetFunction.name, replacementFunctionName)
          : removeFunctionFromCollaborators(current, targetFunction),
      )

      if (editingFunctionId === functionId) {
        setFunctionForm(emptyFunctionForm)
        setEditingFunctionId(null)
        setFunctionSuggestion('')
        setIsFunctionModalOpen(false)
      }
    })
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
      setCollaboratorForm((current) =>
        buildCollaboratorCpfMissingProfileState(current, formattedCpf, cpfDigits.length).collaboratorForm,
      )
      setCollaboratorLookupFeedback(
        buildCollaboratorCpfMissingProfileState(collaboratorForm, formattedCpf, cpfDigits.length).collaboratorLookupFeedback,
      )
      return
    }

    setCollaboratorForm((current) =>
      buildCollaboratorCpfLookupState(
        current,
        formattedCpf,
        existingProfile,
        existingCompanyCollaborator,
      ).collaboratorForm,
    )

    setCollaboratorLookupFeedback(
      buildCollaboratorCpfLookupState(
        collaboratorForm,
        formattedCpf,
        existingProfile,
        existingCompanyCollaborator,
      ).collaboratorLookupFeedback,
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
    const nextState = buildCollaboratorModalOpenState(source, emptyCollaboratorForm, userForm.fullName)
    setCollaboratorModalSource(nextState.collaboratorModalSource)
    setCollaboratorLookupFeedback(nextState.collaboratorLookupFeedback)
    setCollaboratorForm(nextState.collaboratorForm)
    setIsCollaboratorModalOpen(nextState.isCollaboratorModalOpen)
  }

  function closeFunctionModal(force = false) {
    if (!force) {
      runWithDiscardGuard(() => closeFunctionModal(true))
      return
    }

    const nextState = buildFunctionModalClosedState(emptyFunctionForm)
    setFunctionForm(nextState.functionForm)
    setEditingFunctionId(nextState.editingFunctionId)
    setFunctionSuggestion(nextState.functionSuggestion)
    setIsFunctionModalOpen(nextState.isFunctionModalOpen)
  }

  function closeCompanyModal(force = false) {
    if (!force) {
      runWithDiscardGuard(() => closeCompanyModal(true))
      return
    }

    const nextState = buildCompanyModalClosedState()
    setCompanyAgreementFeedback(nextState.companyAgreementFeedback)
    setIsCompanyModalOpen(nextState.isCompanyModalOpen)
  }

  function closeCollaboratorModal(force = false) {
    if (!force) {
      runWithDiscardGuard(() => closeCollaboratorModal(true))
      return
    }

    const nextState = buildCollaboratorModalClosedState(emptyCollaboratorForm)
    setCollaboratorForm(nextState.collaboratorForm)
    setCollaboratorLookupFeedback(nextState.collaboratorLookupFeedback)
    setIsCollaboratorModalOpen(nextState.isCollaboratorModalOpen)
  }

  function appendAuditLog(entry: Omit<AuditLogRecord, 'id' | 'createdAt'>) {
    setAuditLogs((current) =>
      normalizeAuditLogs([
        {
          ...entry,
          id: getNextNumericId(current),
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]),
    )
  }

  async function fetchModuleCollection<T>(moduleKey: ModularStateKey) {
    const response = await fetch(`${apiBaseUrl}/${moduleKey}`)
    if (!response.ok) {
      throw new Error(`module-${moduleKey}-unavailable`)
    }

    const payload = (await response.json()) as { items: T[] }
    return payload.items
  }

  async function persistModuleCollection<T>(moduleKey: ModularStateKey, items: T[]) {
    await fetch(`${apiBaseUrl}/${moduleKey}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ items }),
    })
  }

  const appStateSnapshot = useMemo<AppStateSnapshot>(
    () => ({
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
      auditLogs,
    }),
    [
      agreements,
      auditLogs,
      collaboratorProfiles,
      collaborators,
      companies,
      functions,
      scaleAssignments,
      scaleComments,
      scaleExtraRoster,
      schedules,
      sectors,
      users,
    ],
  )

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
    setAuditLogs(normalizedState.auditLogs)
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
          const localHasData =
            initialLocalDataPresenceRef.current.companies > 0 ||
            initialLocalDataPresenceRef.current.users > 0 ||
            initialLocalDataPresenceRef.current.collaborators > 0 ||
            initialLocalDataPresenceRef.current.functions > 0 ||
            initialLocalDataPresenceRef.current.schedules > 0 ||
            initialLocalDataPresenceRef.current.scaleAssignments > 0
          const remoteHasData =
            payload.state.companies.length > 0 ||
            payload.state.users.length > 0 ||
            payload.state.collaborators.length > 0 ||
            payload.state.functions.length > 0 ||
            payload.state.schedules.length > 0 ||
            payload.state.scaleAssignments.length > 0

          if (remoteHasData || !localHasData) {
            skipNextRemoteSyncRef.current = true
            applyAppStateSnapshot(payload.state)
            skipNextModuleSyncRef.current = {
              companies: true,
              agreements: true,
              sectors: true,
              functions: true,
              collaboratorProfiles: true,
              collaborators: true,
              schedules: true,
              scaleAssignments: true,
              scaleComments: true,
              scaleExtraRoster: true,
              users: true,
              auditLogs: true,
            }
            const [
              remoteCompanies,
              remoteAgreements,
              remoteSectors,
              remoteFunctions,
              remoteCollaboratorProfiles,
              remoteCollaborators,
              remoteSchedules,
              remoteScaleAssignments,
              remoteScaleComments,
              remoteScaleExtraRoster,
              remoteUsers,
              remoteAuditLogs,
            ] = await Promise.all([
              fetchModuleCollection<CompanyRecord>('companies'),
              fetchModuleCollection<CollectiveAgreementRecord>('agreements'),
              fetchModuleCollection<SectorRecord>('sectors'),
              fetchModuleCollection<FunctionRecord>('functions'),
              fetchModuleCollection<CollaboratorProfileRecord>('collaboratorProfiles'),
              fetchModuleCollection<CollaboratorRecord>('collaborators'),
              fetchModuleCollection<ScheduleRecord>('schedules'),
              fetchModuleCollection<ScaleAssignmentRecord>('scaleAssignments'),
              fetchModuleCollection<ScaleCommentThreadRecord>('scaleComments'),
              fetchModuleCollection<ScaleExtraRosterRecord>('scaleExtraRoster'),
              fetchModuleCollection<CompanyUserRecord>('users'),
              fetchModuleCollection<AuditLogRecord>('auditLogs'),
            ])
            if (!cancelled) {
              setCompanies(normalizeLinkedCompanyIdsInCollection(remoteCompanies))
              setAgreements(mergeSeedAgreements(remoteAgreements))
              setSectors(remoteSectors)
              setFunctions(
                remoteFunctions.map((item) => ({
                  ...item,
                  isActive: item.isActive ?? true,
                  inactivePeriods: normalizeInactivePeriods(item.inactivePeriods, item.isActive),
                })),
              )
              setCollaboratorProfiles(remoteCollaboratorProfiles)
              setCollaborators(
                remoteCollaborators.map((item) => ({
                  ...item,
                  inactiveSince: item.inactiveSince ?? null,
                  inactivePeriods: normalizeInactivePeriods(item.inactivePeriods, item.isActive, item.inactiveSince),
                })),
              )
              setSchedules(
                remoteSchedules.map((item) => ({
                  ...item,
                  inactivePeriods: normalizeInactivePeriods(item.inactivePeriods, item.isActive),
                })),
              )
              setScaleAssignments(remoteScaleAssignments)
              setScaleComments(normalizeScaleCommentThreads(remoteScaleComments))
              setScaleExtraRoster(remoteScaleExtraRoster)
              setUsers(
                remoteUsers.map((item) => ({
                  ...item,
                  sectors: item.sectors && item.sectors.length > 0 ? item.sectors : [],
                  sectionAccess: normalizeSectionAccess(item.role, item.sectionAccess),
                  linkedCollaboratorId: item.linkedCollaboratorId ?? null,
                  isActive: item.isActive ?? true,
                })),
              )
              setAuditLogs(normalizeAuditLogs(remoteAuditLogs))
            }
          }
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

    remoteSyncTimeoutRef.current = window.setTimeout(() => {
      void fetch(`${apiBaseUrl}/state`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(appStateSnapshot),
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
    appStateSnapshot,
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
    if (!isPersistenceReady || persistenceMode !== 'api') {
      return
    }

    if (skipNextModuleSyncRef.current.companies) {
      skipNextModuleSyncRef.current.companies = false
      return
    }

    void persistModuleCollection('companies', companies).catch(() => {
      setPersistenceMode('local')
    })
  }, [companies, isPersistenceReady, persistenceMode])

  useEffect(() => {
    writeStoredValue(storageKeys.agreements, agreements)
  }, [agreements])

  useEffect(() => {
    if (!isPersistenceReady || persistenceMode !== 'api') {
      return
    }

    if (skipNextModuleSyncRef.current.agreements) {
      skipNextModuleSyncRef.current.agreements = false
      return
    }

    void persistModuleCollection('agreements', agreements).catch(() => {
      setPersistenceMode('local')
    })
  }, [agreements, isPersistenceReady, persistenceMode])

  useEffect(() => {
    writeStoredValue(storageKeys.sectors, sectors)
  }, [sectors])

  useEffect(() => {
    if (!isPersistenceReady || persistenceMode !== 'api') {
      return
    }

    if (skipNextModuleSyncRef.current.sectors) {
      skipNextModuleSyncRef.current.sectors = false
      return
    }

    void persistModuleCollection('sectors', sectors).catch(() => {
      setPersistenceMode('local')
    })
  }, [isPersistenceReady, persistenceMode, sectors])

  useEffect(() => {
    writeStoredValue(storageKeys.functions, functions)
  }, [functions])

  useEffect(() => {
    if (!isPersistenceReady || persistenceMode !== 'api') {
      return
    }

    if (skipNextModuleSyncRef.current.functions) {
      skipNextModuleSyncRef.current.functions = false
      return
    }

    void persistModuleCollection('functions', functions).catch(() => {
      setPersistenceMode('local')
    })
  }, [functions, isPersistenceReady, persistenceMode])

  useEffect(() => {
    writeStoredValue(storageKeys.collaboratorProfiles, collaboratorProfiles)
  }, [collaboratorProfiles])

  useEffect(() => {
    if (!isPersistenceReady || persistenceMode !== 'api') {
      return
    }

    if (skipNextModuleSyncRef.current.collaboratorProfiles) {
      skipNextModuleSyncRef.current.collaboratorProfiles = false
      return
    }

    void persistModuleCollection('collaboratorProfiles', collaboratorProfiles).catch(() => {
      setPersistenceMode('local')
    })
  }, [collaboratorProfiles, isPersistenceReady, persistenceMode])

  useEffect(() => {
    writeStoredValue(storageKeys.collaborators, collaborators)
  }, [collaborators])

  useEffect(() => {
    if (!isPersistenceReady || persistenceMode !== 'api') {
      return
    }

    if (skipNextModuleSyncRef.current.collaborators) {
      skipNextModuleSyncRef.current.collaborators = false
      return
    }

    void persistModuleCollection('collaborators', collaborators).catch(() => {
      setPersistenceMode('local')
    })
  }, [collaborators, isPersistenceReady, persistenceMode])

  useEffect(() => {
    writeStoredValue(storageKeys.schedules, schedules)
  }, [schedules])

  useEffect(() => {
    if (!isPersistenceReady || persistenceMode !== 'api') {
      return
    }

    if (skipNextModuleSyncRef.current.schedules) {
      skipNextModuleSyncRef.current.schedules = false
      return
    }

    void persistModuleCollection('schedules', schedules).catch(() => {
      setPersistenceMode('local')
    })
  }, [isPersistenceReady, persistenceMode, schedules])

  useEffect(() => {
    writeStoredValue(storageKeys.scaleAssignments, scaleAssignments)
  }, [scaleAssignments])

  useEffect(() => {
    if (!isPersistenceReady || persistenceMode !== 'api') {
      return
    }

    if (skipNextModuleSyncRef.current.scaleAssignments) {
      skipNextModuleSyncRef.current.scaleAssignments = false
      return
    }

    void persistModuleCollection('scaleAssignments', scaleAssignments).catch(() => {
      setPersistenceMode('local')
    })
  }, [isPersistenceReady, persistenceMode, scaleAssignments])

  useEffect(() => {
    writeStoredValue(storageKeys.scaleComments, scaleComments)
  }, [scaleComments])

  useEffect(() => {
    if (!isPersistenceReady || persistenceMode !== 'api') {
      return
    }

    if (skipNextModuleSyncRef.current.scaleComments) {
      skipNextModuleSyncRef.current.scaleComments = false
      return
    }

    void persistModuleCollection('scaleComments', scaleComments).catch(() => {
      setPersistenceMode('local')
    })
  }, [isPersistenceReady, persistenceMode, scaleComments])

  useEffect(() => {
    writeStoredValue(storageKeys.scaleExtraRoster, scaleExtraRoster)
  }, [scaleExtraRoster])

  useEffect(() => {
    if (!isPersistenceReady || persistenceMode !== 'api') {
      return
    }

    if (skipNextModuleSyncRef.current.scaleExtraRoster) {
      skipNextModuleSyncRef.current.scaleExtraRoster = false
      return
    }

    void persistModuleCollection('scaleExtraRoster', scaleExtraRoster).catch(() => {
      setPersistenceMode('local')
    })
  }, [isPersistenceReady, persistenceMode, scaleExtraRoster])

  useEffect(() => {
    writeStoredValue(storageKeys.users, users)
  }, [users])

  useEffect(() => {
    if (!isPersistenceReady || persistenceMode !== 'api') {
      return
    }

    if (skipNextModuleSyncRef.current.users) {
      skipNextModuleSyncRef.current.users = false
      return
    }

    void persistModuleCollection('users', users).catch(() => {
      setPersistenceMode('local')
    })
  }, [isPersistenceReady, persistenceMode, users])

  useEffect(() => {
    writeStoredValue(storageKeys.auditLogs, auditLogs)
  }, [auditLogs])

  useEffect(() => {
    if (!isPersistenceReady || persistenceMode !== 'api') {
      return
    }

    if (skipNextModuleSyncRef.current.auditLogs) {
      skipNextModuleSyncRef.current.auditLogs = false
      return
    }

    void persistModuleCollection('auditLogs', auditLogs).catch(() => {
      setPersistenceMode('local')
    })
  }, [auditLogs, isPersistenceReady, persistenceMode])

  useEffect(() => {
    if (session?.kind !== 'companyUser') {
      return
    }

    const refreshedMemberships = getCompanyUserMembershipsForUser(users, session.user).filter((item) => {
      const company = companies.find((companyItem) => companyItem.id === item.companyId)
      return company?.status === 'ATIVA'
    })

    if (refreshedMemberships.length === 0) {
      startTransition(() => {
        setSession(null)
        setCurrentCompanyId(null)
      })
      return
    }

    const nextActiveUser =
      currentCompanyId === null
        ? refreshedMemberships.find((item) => item.id === session.user.id) ?? refreshedMemberships[0]
        : refreshedMemberships.find((item) => item.companyId === currentCompanyId) ?? refreshedMemberships[0]

    if (!nextActiveUser) {
      startTransition(() => {
        setSession(null)
        setCurrentCompanyId(null)
      })
      return
    }

    if (
      !areMembershipListsEqual(session.memberships, refreshedMemberships) ||
      nextActiveUser.id !== session.user.id
    ) {
      startTransition(() => {
        setSession({
          kind: 'companyUser',
          user: nextActiveUser,
          memberships: refreshedMemberships,
        })
      })
    }

    if (currentCompanyId !== null && nextActiveUser.companyId !== currentCompanyId) {
      const nextCompany = companies.find((item) => item.id === nextActiveUser.companyId) ?? null
      startTransition(() => {
        setCurrentCompanyId(nextActiveUser.companyId)
        if (nextCompany) {
          populateCompanyForm(nextCompany)
        }
      })
    }
  }, [companies, currentCompanyId, session, users])

  useEffect(() => {
    if (session === null) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(storageKeys.session)
      }
      return
    }

    writeStoredValue(storageKeys.session, session)
  }, [session])

  useEffect(() => {
    if (currentCompanyId === null) {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(storageKeys.currentCompanyId)
      }
      return
    }

    writeStoredValue(storageKeys.currentCompanyId, currentCompanyId)
  }, [currentCompanyId])

  useEffect(() => {
    if (companyAgreementSuggestion && !companyForm.collectiveAgreementId) {
      startTransition(() => {
        setCompanyForm((current) => ({
          ...current,
          collectiveAgreementId: String(companyAgreementSuggestion.id),
        }))
      })
    }
  }, [companyAgreementSuggestion, companyForm.collectiveAgreementId])

  useEffect(() => {
    if (activeSection === 'PainelMaster' && !isSystemAdmin) {
      startTransition(() => {
        setActiveSection(visibleAppSections[0] ?? 'Escala')
      })
      return
    }

    if (activeSection !== 'PainelMaster' && !visibleAppSections.includes(activeSection)) {
      startTransition(() => {
        setActiveSection(visibleAppSections[0] ?? 'Escala')
      })
    }
  }, [activeSection, isSystemAdmin, visibleAppSections])

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
              Usuario <span className="required-marker">*</span>
              <input
                value={loginForm.username}
                onChange={(event) => setLoginForm({ ...loginForm, username: event.target.value })}
              />
            </label>
            <label>
              Senha <span className="required-marker">*</span>
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
              Nome fantasia <span className="required-marker">*</span>
              <input
                value={companyForm.tradeName}
                onChange={(event) => setCompanyForm({ ...companyForm, tradeName: normalizeTextEntry(event.target.value) })}
              />
            </label>
            <label>
              Razao social <span className="required-marker">*</span>
              <input
                value={companyForm.legalName}
                onChange={(event) => setCompanyForm({ ...companyForm, legalName: normalizeTextEntry(event.target.value) })}
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
                onChange={(event) => setCompanyForm({ ...companyForm, street: normalizeTextEntry(event.target.value) })}
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
                onChange={(event) => setCompanyForm({ ...companyForm, complement: normalizeTextEntry(event.target.value) })}
              />
            </label>
            <label>
              Bairro
              <input
                value={companyForm.district}
                onChange={(event) => setCompanyForm({ ...companyForm, district: normalizeTextEntry(event.target.value) })}
              />
            </label>
            <label>
              Estado <span className="required-marker">*</span>
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
              Cidade <span className="required-marker">*</span>
              <input
                value={companyForm.city}
                onChange={(event) => setCompanyForm({ ...companyForm, city: normalizeTextEntry(event.target.value) })}
              />
            </label>
                {companyLinksField}
                {companyAgreementField}
            <div className="form-actions">
              <button type="submit" className="primary-button">
                Salvar primeira empresa
              </button>
            </div>
            <p className="field-helper">Campos marcados com <span className="required-marker">*</span> sao obrigatorios.</p>
          </form>
        </section>
      </div>
    )
  }

  if (session?.kind === 'companyUser' && currentCompanyId === null) {
    return (
      <div className="auth-shell">
        <section className="auth-card selector-card">
          <div className="selector-header">
            <div>
              <p className="eyebrow">{session.user.role}</p>
              <h1 className="selector-title">Selecione a empresa</h1>
            </div>
            <button type="button" className="ghost-button" onClick={logout}>
              Sair
            </button>
          </div>

          <div className="selector-list">
            {currentCompanyMembershipCompanies.map((company) => {
              const membership = currentCompanyUserMemberships.find((item) => item.companyId === company.id) ?? null
              return (
                <article key={company.id} className="selector-item">
                  <button type="button" className="selector-main" onClick={() => switchCompany(company.id)}>
                    <strong>{company.tradeName}</strong>
                    <span>
                      {company.city}/{company.state}
                    </span>
                    <span>{membership ? membership.role : session.user.role}</span>
                    <span>{company.cnpj || 'CNPJ nao informado'}</span>
                  </button>
                </article>
              )
            })}
          </div>
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
                setCompanyLinkedCompanyIds([])
                setCompanyPublicServiceHours(buildEmptyPublicServiceHours())
                setCompanyCoverageTargets(buildEmptyCoverageTargets())
                setIsCompanyModalOpen(true)
              }}
            >
              Cadastrar nova empresa
            </button>
          </div>
        </section>

        {isCompanyModalOpen && (
          <div className="modal-backdrop" role="presentation" onClick={() => closeCompanyModal()}>
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
                <button type="button" className="ghost-button" onClick={() => closeCompanyModal()}>
                  Fechar
                </button>
              </div>

              <form className="form-grid" onSubmit={(event) => submitCompany(event, 'create')}>
                <label>
                  Nome fantasia
                  <input
                    value={companyForm.tradeName}
                    onChange={(event) => setCompanyForm({ ...companyForm, tradeName: normalizeTextEntry(event.target.value) })}
                  />
                </label>
                <label>
                  Razao social
                  <input
                    value={companyForm.legalName}
                    onChange={(event) => setCompanyForm({ ...companyForm, legalName: normalizeTextEntry(event.target.value) })}
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
                    onChange={(event) => setCompanyForm({ ...companyForm, street: normalizeTextEntry(event.target.value) })}
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
                    onChange={(event) => setCompanyForm({ ...companyForm, complement: normalizeTextEntry(event.target.value) })}
                  />
                </label>
                <label>
                  Bairro
                  <input
                    value={companyForm.district}
                    onChange={(event) => setCompanyForm({ ...companyForm, district: normalizeTextEntry(event.target.value) })}
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
                    onChange={(event) => setCompanyForm({ ...companyForm, city: normalizeTextEntry(event.target.value) })}
                  />
                </label>
                {companyLinksField}
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
            {isSystemAdmin ? (
              <button
                type="button"
                className={activeSection === 'PainelMaster' ? 'nav-item active' : 'nav-item'}
                onClick={() => handleSectionSelection('PainelMaster')}
              >
                Painel master
              </button>
            ) : null}
            {visibleAppSections.map((section) => (
              <button
                key={section}
                type="button"
                className={section === activeSection ? 'nav-item active' : 'nav-item'}
                onClick={() => handleSectionSelection(section)}
              >
                {appSectionLabels[section]}
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
            </div>
          </div>
          <div className="hero-meta">
            {session.kind === 'systemAdmin' ? (
              <button type="button" className="secondary-button" onClick={() => setCurrentCompanyId(null)}>
                Trocar empresa
              </button>
            ) : currentCompanyUserMemberships.length > 1 ? (
              <button type="button" className="secondary-button" onClick={() => setCurrentCompanyId(null)}>
                Trocar empresa
              </button>
            ) : null}
          </div>
        </section>

        {activeSection === 'PainelMaster' && isSystemAdmin && currentCompany && (
          <>
            <section className="section-card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Administrador do sistema</p>
                  <h2>Painel master</h2>
                </div>
                <div className="selector-row">
                  {masterPanelSections.map((section) => (
                    <button
                      key={section}
                      type="button"
                      className={activeMasterPanelSection === section ? 'primary-button' : 'secondary-button'}
                      onClick={() => setActiveMasterPanelSection(section)}
                    >
                      {section}
                    </button>
                  ))}
                </div>
              </div>

              <div className="panel-grid">
                <article className="metric-card">
                  <p>Eventos da empresa ativa</p>
                  <strong>{currentCompanyAuditLogs.length}</strong>
                </article>
                <article className="metric-card">
                  <p>Alertas recentes</p>
                  <strong>{auditAlertLogs.length}</strong>
                </article>
                <article className="metric-card">
                  <p>Impactos monitorados</p>
                  <strong>{auditImpactLogs.length}</strong>
                </article>
              </div>
            </section>

            <section className="section-card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">{currentCompany.tradeName}</p>
                  <h3>
                    {activeMasterPanelSection === 'Auditoria'
                      ? 'Trilha de auditoria'
                      : activeMasterPanelSection === 'Alertas'
                        ? 'Alertas'
                        : 'Impactos'}
                  </h3>
                </div>
              </div>

              <div className="selector-row">
                <label className="form-field">
                  <span>Buscar</span>
                  <input
                    value={masterPanelSearch}
                    onChange={(event) => setMasterPanelSearch(event.target.value)}
                    placeholder="acao, ator, alvo ou impacto"
                  />
                </label>
                <label className="form-field">
                  <span>Severidade</span>
                  <select
                    value={masterPanelSeverityFilter}
                    onChange={(event) =>
                      setMasterPanelSeverityFilter(
                        event.target.value as 'Todas' | 'info' | 'warning' | 'critical',
                      )
                    }
                  >
                    <option value="Todas">Todas</option>
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </label>
                <label className="form-field">
                  <span>Modulo</span>
                  <select
                    value={masterPanelModuleFilter}
                    onChange={(event) => setMasterPanelModuleFilter(event.target.value)}
                  >
                    {masterPanelModuleOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="table-list">
                {activeMasterPanelLogs.map((item) => (
                  <article key={item.id} className="list-row">
                    <div className="user-row-header">
                      <div className="user-title-group">
                        <strong>{item.action}</strong>
                        <span
                          className={
                            item.severity === 'critical'
                              ? 'status-pill status-inactive'
                              : item.severity === 'warning'
                                ? 'status-pill'
                                : 'status-pill status-active'
                          }
                        >
                          {item.severity}
                        </span>
                      </div>
                    </div>
                    <div className="row-meta user-row-meta">
                      <span><strong className="meta-label">Modulo:</strong> {item.module}</span>
                      <span><strong className="meta-label">Alvo:</strong> {item.targetLabel}</span>
                      <span><strong className="meta-label">Ator:</strong> {item.actorName} • {item.actorRole}</span>
                      <span><strong className="meta-label">Impacto:</strong> {item.impactSummary}</span>
                      <span><strong className="meta-label">Quando:</strong> {formatDateTimeLabel(item.createdAt)}</span>
                    </div>
                  </article>
                ))}

                {activeMasterPanelLogs.length === 0 ? (
                  <p className="section-note">Nenhum evento corresponde aos filtros da empresa ativa.</p>
                ) : null}
              </div>
            </section>
          </>
        )}

        {activeSection === 'Painel' && effectiveSectionAccess.Painel && (
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

        {activeSection === 'Empresa' && currentCompany && effectiveSectionAccess.Empresa && (
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
                        setCompanyLinkedCompanyIds([])
                        setCompanyPublicServiceHours(buildEmptyPublicServiceHours())
                        setCompanyCoverageTargets(buildEmptyCoverageTargets())
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
                Nome fantasia <span className="required-marker">*</span>
                <input
                  value={companyForm.tradeName}
                  onChange={(event) => setCompanyForm({ ...companyForm, tradeName: normalizeTextEntry(event.target.value) })}
                />
              </label>
              <label>
                Razao social <span className="required-marker">*</span>
                <input
                  value={companyForm.legalName}
                  onChange={(event) => setCompanyForm({ ...companyForm, legalName: normalizeTextEntry(event.target.value) })}
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
                  onChange={(event) => setCompanyForm({ ...companyForm, street: normalizeTextEntry(event.target.value) })}
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
                  onChange={(event) => setCompanyForm({ ...companyForm, complement: normalizeTextEntry(event.target.value) })}
                />
              </label>
              <label>
                Bairro
                <input
                  value={companyForm.district}
                  onChange={(event) => setCompanyForm({ ...companyForm, district: normalizeTextEntry(event.target.value) })}
                />
              </label>
              <label>
                Estado <span className="required-marker">*</span>
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
                Cidade <span className="required-marker">*</span>
                <input
                  value={companyForm.city}
                  onChange={(event) => setCompanyForm({ ...companyForm, city: normalizeTextEntry(event.target.value) })}
                />
              </label>
                {companyLinksField}
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
              <label>
                Visualizacao padrao da escala
                <select
                  value={currentCompany.defaultScaleViewMode ?? 'week'}
                  onChange={(event) =>
                    updateCompanyOperationalSettings(currentCompany.id, {
                      defaultScaleViewMode: event.target.value as ScaleViewMode,
                    })
                  }
                >
                  <option value="week">Semanal</option>
                  <option value="month">Mensal</option>
                  <option value="coverage">Cobertura diaria</option>
                </select>
              </label>
              <label>
                Relatorio padrao
                <select
                  value={currentCompany.defaultReportId ?? 'scale-consolidated'}
                  onChange={(event) =>
                    updateCompanyOperationalSettings(currentCompany.id, {
                      defaultReportId: event.target.value as ReportId,
                    })
                  }
                >
                  {reportOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-span print-option-row">
                <span>Permitir edicao da escala em datas passadas</span>
                <input
                  type="checkbox"
                  checked={currentCompany.allowPastScaleEdits ?? false}
                  onChange={(event) =>
                    updateCompanyOperationalSettings(currentCompany.id, {
                      allowPastScaleEdits: event.target.checked,
                    })
                  }
                />
              </label>
              <label className="field-span print-option-row">
                <span>Incluir extras por padrao na impressao</span>
                <input
                  type="checkbox"
                  checked={currentCompany.defaultPrintIncludeExtras ?? false}
                  onChange={(event) =>
                    updateCompanyOperationalSettings(currentCompany.id, {
                      defaultPrintIncludeExtras: event.target.checked,
                    })
                  }
                />
              </label>
              <div className="field-span helper-banner">
                Atendimento ao publico e metas de cobertura agora ficam no painel `Cobertura operacional`.
              </div>
              <div className="form-actions">
                <button type="submit" className="primary-button">
                  Atualizar empresa
                </button>
              </div>
              <p className="field-helper">Campos marcados com <span className="required-marker">*</span> sao obrigatorios.</p>
            </form>
          </section>
        )}

        {activeSection === 'Cobertura' && currentCompany && effectiveSectionAccess.Cobertura && (
          <section className="section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Operacao</p>
                <h2>Cobertura operacional</h2>
              </div>
            </div>

            <div className="helper-banner field-span">
              Configure aqui a janela de atendimento ao publico e as metas usadas na visualizacao `Cobertura diaria` da escala.
              Isso nao limita os horarios que podem ser cadastrados para os colaboradores.
            </div>

            <form className="form-grid" onSubmit={submitCoverageSettings}>
              {coverageSettingsFeedback ? (
                <div className={coverageSettingsFeedback.type === 'success' ? 'feedback success field-span' : 'feedback error field-span'}>
                  <strong>{coverageSettingsFeedback.type === 'success' ? 'Cobertura salva' : 'Cobertura nao salva'}</strong>
                  <span>{coverageSettingsFeedback.message}</span>
                </div>
              ) : null}
              {companyPublicServiceField}
              {coverageSettingsFeedback ? (
                <div className={coverageSettingsFeedback.type === 'success' ? 'feedback success field-span' : 'feedback error field-span'}>
                  <strong>{coverageSettingsFeedback.type === 'success' ? 'Cobertura salva' : 'Cobertura nao salva'}</strong>
                  <span>{coverageSettingsFeedback.message}</span>
                </div>
              ) : null}
              <div className="form-actions">
                <button type="submit" className="primary-button">
                  Salvar cobertura operacional
                </button>
              </div>
            </form>
          </section>
        )}

        {activeSection === 'Convencoes' && canManageData && effectiveSectionAccess.Convencoes && (
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
                Nome da convencao <span className="required-marker">*</span>
                <input
                  value={agreementForm.name}
                  onChange={(event) => setAgreementForm({ ...agreementForm, name: normalizeTextEntry(event.target.value) })}
                />
              </label>
              <label>
                Sindicato patronal
                <input
                  value={agreementForm.employerUnion}
                  onChange={(event) =>
                    setAgreementForm({ ...agreementForm, employerUnion: normalizeTextEntry(event.target.value) })
                  }
                />
              </label>
              <label>
                Sindicato laboral
                <input
                  value={agreementForm.employeeUnion}
                  onChange={(event) =>
                    setAgreementForm({ ...agreementForm, employeeUnion: normalizeTextEntry(event.target.value) })
                  }
                />
              </label>
              <label>
                Estado coberto <span className="required-marker">*</span>
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
                Cidade coberta <span className="required-marker">*</span>
                <input
                  value={agreementForm.coveredCity}
                  onChange={(event) =>
                    setAgreementForm({ ...agreementForm, coveredCity: normalizeTextEntry(event.target.value) })
                  }
                />
              </label>
              <label>
                Categoria
                <input
                  value={agreementForm.category}
                  onChange={(event) => setAgreementForm({ ...agreementForm, category: normalizeTextEntry(event.target.value) })}
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
                  onChange={(event) => setAgreementForm({ ...agreementForm, sourceLabel: normalizeTextEntry(event.target.value) })}
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
                  onChange={(event) => setAgreementForm({ ...agreementForm, notes: normalizeTextEntry(event.target.value) })}
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

        {activeSection === 'Colaboradores' && canManageData && effectiveSectionAccess.Colaboradores && (
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
                CPF <span className="required-marker">*</span>
                <input
                  required
                  placeholder="000.000.000-00"
                  value={collaboratorForm.cpf}
                  onChange={(event) => changeCollaboratorCpf(event.target.value)}
                />
              </label>
              <label>
                Nome completo <span className="required-marker">*</span>
                <input
                  required
                  value={collaboratorForm.fullName}
                  onChange={(event) =>
                    setCollaboratorForm({ ...collaboratorForm, fullName: normalizeTextEntry(event.target.value) })
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
                  <span className="field-title">Funcao <span className="required-marker">*</span></span>
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
                  Funcao principal nesta empresa <span className="required-marker">*</span>
                  <select
                    required
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

            <p className="field-helper">Campos marcados com <span className="required-marker">*</span> sao obrigatorios.</p>

            <EntityListTable
              title="Colaboradores"
              rows={companyCollaborators}
              columns={collaboratorListColumns}
              searchTerm={collaboratorListSearch}
              onSearchTermChange={setCollaboratorListSearch}
              columnOrder={collaboratorListColumnOrder}
              onColumnOrderChange={setCollaboratorListColumnOrder}
              emptyMessage="Nenhum colaborador cadastrado ainda para esta empresa."
              exportFileName={`colaboradores-${slugifyFilePart(currentCompany?.tradeName ?? 'empresa')}.xlsx`}
              renderActions={(item) =>
                item.companyId !== currentCompanyId ? null : (
                  <div className="table-actions">
                  <button
                    type="button"
                    className="icon-button icon-edit"
                    onClick={() => editCollaborator(item.id)}
                    aria-label={`Editar colaborador ${getCollaboratorProfile(item.cpf)?.fullName ?? item.cpf}`}
                    title="Editar"
                  >
                    ✎
                  </button>
                  {canManageCollaboratorActivation ? (
                    <button
                      type="button"
                      className="icon-button icon-disable"
                      onClick={() => toggleCollaboratorActivation(item.id)}
                      aria-label={
                        item.isActive
                          ? `Inativar colaborador ${getCollaboratorProfile(item.cpf)?.fullName ?? item.cpf}`
                          : `Ativar colaborador ${getCollaboratorProfile(item.cpf)?.fullName ?? item.cpf}`
                      }
                      title={item.isActive ? 'Inativar' : 'Ativar'}
                    >
                      {item.isActive ? '◐' : '◑'}
                    </button>
                  ) : null}
                  {isSystemAdmin ? (
                    <button
                      type="button"
                      className="icon-button icon-delete"
                      onClick={() => deleteCollaborator(item.id)}
                      aria-label={`Excluir colaborador ${getCollaboratorProfile(item.cpf)?.fullName ?? item.cpf}`}
                      title="Excluir"
                    >
                      🗑
                    </button>
                  ) : null}
                  </div>
                )
              }
            />
          </section>
        )}

        {activeSection === 'Funcoes' && canManageData && effectiveSectionAccess.Funcoes && (
          <section className="section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Cadastro</p>
                <h2>Funcoes</h2>
              </div>
              <p className="section-note">
                As funcoes abaixo incluem a empresa atual e, quando houver, funcoes compartilhadas por empresas vinculadas.
              </p>
            </div>
            <form className="form-grid" onSubmit={handleFunctionSubmit}>
              <label>
                Funcao <span className="required-marker">*</span>
                <input
                  required
                  value={functionForm.name}
                  onChange={(event) => setFunctionForm({ ...functionForm, name: normalizeTextEntry(event.target.value) })}
                />
              </label>
              <label>
                Setor <span className="required-marker">*</span>
                <input
                  required
                  list="company-sector-options-main"
                  placeholder="Selecione ou digite um novo setor"
                  value={functionForm.sector}
                  onChange={(event) => setFunctionForm({ ...functionForm, sector: normalizeTextEntry(event.target.value) })}
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
                Descritivo <span className="required-marker">*</span>
                <textarea
                  required
                  rows={5}
                  value={functionForm.description}
                  onChange={(event) =>
                    setFunctionForm({ ...functionForm, description: normalizeTextEntry(event.target.value) })
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

            <p className="field-helper">Campos marcados com <span className="required-marker">*</span> sao obrigatorios.</p>

            <EntityListTable
              title="Funcoes"
              rows={companyFunctions}
              columns={functionListColumns}
              searchTerm={functionListSearch}
              onSearchTermChange={setFunctionListSearch}
              columnOrder={functionListColumnOrder}
              onColumnOrderChange={setFunctionListColumnOrder}
              emptyMessage="Nenhuma funcao cadastrada ainda para esta empresa."
              exportFileName={`funcoes-${slugifyFilePart(currentCompany?.tradeName ?? 'empresa')}.xlsx`}
              renderActions={(item) =>
                item.companyId !== currentCompanyId ? (
                  <div className="table-actions">
                    <button
                      type="button"
                      className="icon-button icon-edit"
                      onClick={() => openFunctionCloneModal(item.id)}
                      aria-label={`Clonar funcao ${item.name}`}
                      title="Clonar para esta empresa"
                    >
                      ⧉
                    </button>
                  </div>
                ) : (
                  <div className="table-actions">
                    <button
                      type="button"
                      className="icon-button icon-edit"
                      onClick={() => editFunction(item.id)}
                      aria-label={`Editar funcao ${item.name}`}
                      title="Editar"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-disable"
                      onClick={() => toggleFunctionActivation(item.id)}
                      aria-label={item.isActive ? `Inativar funcao ${item.name}` : `Ativar funcao ${item.name}`}
                      title={item.isActive ? 'Inativar' : 'Ativar'}
                    >
                      {item.isActive ? '◐' : '◑'}
                    </button>
                    {(isSystemAdmin || session?.user.role === 'Gestor') ? (
                      <button
                        type="button"
                        className="icon-button icon-delete"
                        onClick={() => deleteFunction(item.id)}
                        aria-label={`Excluir funcao ${item.name}`}
                        title="Excluir"
                      >
                        🗑
                      </button>
                    ) : null}
                  </div>
                )
              }
            />
          </section>
        )}

        {activeSection === 'Horarios' && canManageData && effectiveSectionAccess.Horarios && (
          <section className="section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Cadastro</p>
                <h2>Horarios</h2>
              </div>
              <p className="section-note">
                Os horarios validados aqui incluem a empresa atual e, quando houver, horarios compartilhados por empresas vinculadas.
              </p>
            </div>

            <form className="form-grid schedule-form" onSubmit={handleScheduleSubmit}>
                <label>
                  Turno <span className="required-marker">*</span>
                  <input
                    required
                    placeholder="Ex.: Almoco executivo"
                    value={scheduleForm.shiftName}
                    onChange={(event) =>
                      setScheduleForm({ ...scheduleForm, shiftName: event.target.value })
                    }
                  />
                </label>
                <label>
                  Abreviacao
                  <input value={liveScheduleAbbreviation} readOnly />
                </label>
                <label className="time-row">
                  Horario de inicio <span className="required-marker">*</span>
                  <div className="time-control">
                    <input
                      required
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
                  <small>Opcional. Se informar pausa, preencha inicio e fim.</small>
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
                  <small>Deixe os dois campos de pausa vazios para jornadas sem intervalo.</small>
                </label>
                <label className="time-row">
                  Fim do turno <span className="required-marker">*</span>
                  <div className="time-control">
                    <input
                      required
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
                  <small>
                    Preencha inicio e fim do turno. A pausa e opcional e, quando usada, precisa ter inicio e fim.
                  </small>
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

            <p className="field-helper">Campos marcados com <span className="required-marker">*</span> sao obrigatorios.</p>

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
                  <li>Use nomes de turno curtos e distintos. A abreviacao sugerida tenta resumir o nome inteiro sem repetir siglas da empresa.</li>
                  <li>A abreviacao sugerida considera o nome completo do turno e nunca repete uma sigla ja cadastrada.</li>
                  <li>Digite sempre 4 numeros por horario, sem pontuacao. O app aplica a mascara hh:mm.</li>
                  <li>Ao completar 4 numeros, o sistema identifica automaticamente AM ou PM e ajusta o horario exibido no campo.</li>
                  <li>AM cobre horarios entre 00:01 e 12:00. PM cobre horarios entre 12:01 e 24:00.</li>
                  <li>Preencha os horarios em sequencia cronologica para reduzir erro operacional.</li>
                  <li>Para jornadas curtas sem intervalo, deixe ambos os campos de pausa em branco.</li>
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

            <EntityListTable
              title="Horarios"
              rows={companySchedules}
              columns={scheduleListColumns}
              searchTerm={scheduleListSearch}
              onSearchTermChange={setScheduleListSearch}
              columnOrder={scheduleListColumnOrder}
              onColumnOrderChange={setScheduleListColumnOrder}
              emptyMessage="Nenhum horario cadastrado ainda para esta empresa."
              exportFileName={`horarios-${slugifyFilePart(currentCompany?.tradeName ?? 'empresa')}.xlsx`}
              renderActions={(item) =>
                item.companyId !== currentCompanyId ? (
                  <div className="table-actions">
                    <button
                      type="button"
                      className="icon-button icon-edit"
                      onClick={() => openScheduleCloneModal(item.id)}
                      aria-label={`Clonar horario ${item.shiftName}`}
                      title="Clonar para esta empresa"
                    >
                      ⧉
                    </button>
                  </div>
                ) : (
                  <div className="table-actions">
                    <button
                      type="button"
                      className="icon-button icon-edit"
                      onClick={() => editSchedule(item.id)}
                      aria-label={`Editar horario ${item.shiftName}`}
                      title="Editar"
                    >
                      ✎
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-disable"
                      onClick={() => toggleScheduleActivation(item.id)}
                      aria-label={item.isActive ? `Inativar horario ${item.shiftName}` : `Ativar horario ${item.shiftName}`}
                      title={item.isActive ? 'Inativar' : 'Ativar'}
                    >
                      {item.isActive ? '◐' : '◑'}
                    </button>
                    <button
                      type="button"
                      className="icon-button icon-delete"
                      onClick={() => deleteSchedule(item.id)}
                      aria-label={`Excluir horario ${item.shiftName}`}
                      title="Excluir"
                    >
                      🗑
                    </button>
                  </div>
                )
              }
            />

          </section>
        )}

        {activeSection === 'Escala' && currentCompany && effectiveSectionAccess.Escala && (
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
                <div className="scale-mode-tabs no-print" role="tablist" aria-label="Modos do painel de escala">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={scalePanelMode === 'planning'}
                    className={scalePanelMode === 'planning' ? 'scale-mode-tab active' : 'scale-mode-tab'}
                    onClick={() => setScaleViewMode(lastScalePlanningViewMode)}
                  >
                    Montagem da escala
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={scalePanelMode === 'coverage'}
                    className={scalePanelMode === 'coverage' ? 'scale-mode-tab active' : 'scale-mode-tab'}
                    onClick={() => setScaleViewMode('coverage')}
                  >
                    Cobertura diaria
                  </button>
                </div>

                {scalePanelMode === 'planning' ? (
                  <div className="scale-submode-tabs no-print" role="tablist" aria-label="Visualizacao da montagem da escala">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={(scaleViewMode === 'coverage' ? lastScalePlanningViewMode : scaleViewMode) === 'week'}
                      className={(scaleViewMode === 'coverage' ? lastScalePlanningViewMode : scaleViewMode) === 'week' ? 'scale-submode-tab active' : 'scale-submode-tab'}
                      onClick={() => {
                        setLastScalePlanningViewMode('week')
                        setScaleViewMode('week')
                      }}
                    >
                      Semana
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={(scaleViewMode === 'coverage' ? lastScalePlanningViewMode : scaleViewMode) === 'month'}
                      className={(scaleViewMode === 'coverage' ? lastScalePlanningViewMode : scaleViewMode) === 'month' ? 'scale-submode-tab active' : 'scale-submode-tab'}
                      onClick={() => {
                        setLastScalePlanningViewMode('month')
                        setScaleViewMode('month')
                      }}
                    >
                      Mes
                    </button>
                  </div>
                ) : null}

                <div className="scale-toolbar no-print">
                  {scaleViewMode === 'week' ? (
                    <label>
                      Semana de referencia
                      <input
                        type="date"
                        value={scaleAnchorDate}
                        onChange={(event) => {
                          setScaleAnchorDate(event.target.value)
                          setScaleCoverageDate(event.target.value)
                          setScaleMonth(event.target.value.slice(0, 7))
                        }}
                      />
                    </label>
                  ) : scaleViewMode === 'coverage' ? (
                    <>
                      <label>
                        Dia de referencia
                        <input
                          type="date"
                          value={scaleCoverageDate}
                          onChange={(event) => {
                            setScaleCoverageDate(event.target.value)
                            setScaleAnchorDate(event.target.value)
                            setScaleMonth(event.target.value.slice(0, 7))
                          }}
                        />
                      </label>
                      <label>
                        Atendimento ao publico
                        <input value={scaleCoverageServiceLabel} readOnly />
                      </label>
                    </>
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
                  <label>
                    Funcao
                    <select
                      value={effectiveScaleFunctionFilter}
                      onChange={(event) => setScaleFunctionFilter(event.target.value)}
                    >
                      {scaleFunctionOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Buscar colaborador
                    <input
                      type="search"
                      value={scaleSearch}
                      onChange={(event) => setScaleSearch(event.target.value)}
                      placeholder="Nome, CPF, funcao ou vinculo"
                    />
                  </label>
                  <label className="toggle-field">
                    <span>Mostrar apenas linhas com irregularidade</span>
                    <input
                      type="checkbox"
                      checked={scaleShowIrregularOnly}
                      onChange={(event) => setScaleShowIrregularOnly(event.target.checked)}
                    />
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

                {scaleViewMode === 'coverage' ? (
                  <section className="coverage-day-card">
                    <div className="section-header compact-header">
                      <div>
                        <p className="eyebrow">Cobertura diaria</p>
                        <h3>{formatDateLabel(scaleCoverageDate)}</h3>
                      </div>
                      <p className="section-note">
                        Atendimento ao publico: {scaleCoverageServiceLabel}
                      </p>
                    </div>

                    {!scaleCoverageHasPublicService ? (
                      <div className="feedback warning">
                        <strong>Atendimento ao publico nao configurado para este dia.</strong>
                        <ul>
                          <li>Configure a janela de atendimento no painel da empresa para comparar cobertura com a operacao aberta ao cliente.</li>
                        </ul>
                      </div>
                    ) : null}

                    {scaleCoverageSlots.length === 0 ? (
                      <div className="feedback error">
                        <strong>Sem dados para montar a cobertura diaria.</strong>
                        <ul>
                          <li>Nao ha atendimento ao publico nem horarios lancados que permitam desenhar a linha do tempo deste dia.</li>
                        </ul>
                      </div>
                    ) : (
                      <>
                        <div className="coverage-legend no-print">
                          <span className="coverage-legend-item service">Atendimento ao publico</span>
                          <span className="coverage-legend-item low">Abaixo da meta</span>
                          <span className="coverage-legend-item on-target">Meta atendida</span>
                          <span className="coverage-legend-item function-gap">Total ok, funcao abaixo</span>
                          <span className="coverage-legend-item gap">Sem cobertura</span>
                          <span className="coverage-legend-item outside">Pre-abertura / fechamento</span>
                        </div>

                        <div className="coverage-grid-wrap">
                          <div
                            className="coverage-grid"
                            style={{ '--coverage-slot-count': String(scaleCoverageSlots.length) } as CSSProperties}
                          >
                            <div className="coverage-sticky coverage-sticky-header">Colaborador</div>
                            {scaleCoverageSlots.map((slot) => (
                              <div
                                key={`header-${slot.start}`}
                                className={slot.isInPublicService ? 'coverage-slot-header service' : 'coverage-slot-header'}
                              >
                                {slot.label}
                              </div>
                            ))}

                            <div className="coverage-sticky coverage-summary-label">Cobertura</div>
                            {scaleCoverageSummary.map((slot) => (
                              <div
                                key={`summary-${slot.start}`}
                                className={[
                                  'coverage-summary-cell',
                                  slot.isInPublicService ? 'service' : 'outside',
                                  slot.isInPublicService && slot.count === 0 ? 'gap' : '',
                                  slot.isBelowTarget && slot.count > 0 ? 'below-target' : '',
                                  slot.hasFunctionGap && !slot.isBelowTarget ? 'function-gap' : '',
                                  slot.isInPublicService && slot.minimumStaff > 0 && slot.count >= slot.minimumStaff && !slot.hasFunctionGap ? 'on-target' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ')}
                                title={
                                  slot.isInPublicService
                                    ? [
                                        `Cobertura ${slot.count} de minimo ${slot.minimumStaff}`,
                                        slot.targetLabel,
                                        ...slot.functionTargetStatuses.map(
                                          (functionTarget) =>
                                            `${functionTarget.functionName}: ${functionTarget.covered}/${functionTarget.required}`,
                                        ),
                                      ].join(' • ')
                                    : `Cobertura ${slot.count}`
                                }
                              >
                                <strong>
                                  {slot.isInPublicService
                                    ? `${slot.count}/${slot.minimumStaff}${slot.hasFunctionGap ? ' *' : ''}`
                                    : String(slot.count)}
                                </strong>
                              </div>
                            ))}

                            {scaleCoverageGroupedRows.map((sectorGroup) => (
                              <Fragment key={`coverage-sector-${sectorGroup.sectorName}`}>
                                <div className="coverage-sticky coverage-group-card coverage-sector-card">
                                  <strong>Setor: {sectorGroup.sectorName}</strong>
                                </div>
                                {scaleCoverageSlots.map((slot) => (
                                  <div
                                    key={`coverage-sector-${sectorGroup.sectorName}-${slot.start}`}
                                    className={slot.isInPublicService ? 'coverage-group-cell service' : 'coverage-group-cell outside'}
                                  />
                                ))}

                                {sectorGroup.functions.map((functionGroup) => (
                                  <Fragment key={`coverage-function-${sectorGroup.sectorName}-${functionGroup.functionName}`}>
                                    <div className="coverage-sticky coverage-group-card coverage-function-card">
                                      <strong>Funcao: {functionGroup.functionName}</strong>
                                      <small>{functionGroup.rows.length} colaborador(es)</small>
                                    </div>
                                    {scaleCoverageSummary.map((slot) => {
                                      const coveredCount = functionGroup.rows.filter((row) =>
                                        row.segments.some((segment) => segment.start < slot.end && segment.end > slot.start),
                                      ).length
                                      const functionTarget = slot.functionTargetStatuses.find(
                                        (item) => item.functionName === functionGroup.functionName,
                                      )
                                      const isBelowFunctionTarget = !!functionTarget && functionTarget.covered < functionTarget.required
                                      return (
                                        <div
                                          key={`coverage-function-${sectorGroup.sectorName}-${functionGroup.functionName}-${slot.start}`}
                                          className={[
                                            'coverage-summary-cell',
                                            slot.isInPublicService ? 'service' : 'outside',
                                            slot.isInPublicService && coveredCount === 0 ? 'gap' : '',
                                            isBelowFunctionTarget && coveredCount > 0 ? 'below-target' : '',
                                            functionTarget && !isBelowFunctionTarget ? 'on-target' : '',
                                          ]
                                            .filter(Boolean)
                                            .join(' ')}
                                          title={
                                            functionTarget
                                              ? `${functionGroup.functionName}: ${functionTarget.covered}/${functionTarget.required}`
                                              : `${functionGroup.functionName}: ${coveredCount} colaborador(es)`
                                          }
                                        >
                                          <strong>{functionTarget ? `${functionTarget.covered}/${functionTarget.required}` : String(coveredCount)}</strong>
                                        </div>
                                      )
                                    })}

                                    {functionGroup.rows.map((row) => {
                                      const rowValidation = validateScaleRow(row.collaborator, getWeekDates(scaleCoverageDate))
                                      return (
                                        <Fragment key={`coverage-${row.collaborator.id}`}>
                                          <div className="coverage-sticky coverage-person-card">
                                            <strong>{getShortDisplayName(row.profile?.fullName ?? row.collaborator.cpf)}</strong>
                                            <span>{row.collaborator.primaryFunction} • {row.collaborator.employmentType}</span>
                                            <small>{row.sector || 'Setor nao definido'}</small>
                                            {rowValidation.issues.length > 0 ? <small>{rowValidation.issues[0]}</small> : null}
                                          </div>
                                          {scaleCoverageSlots.map((slot) => {
                                            const covered = row.segments.some(
                                              (segment) => segment.start < slot.end && segment.end > slot.start,
                                            )
                                            return (
                                              <div
                                                key={`${row.collaborator.id}-${slot.start}`}
                                                className={[
                                                  'coverage-slot-cell',
                                                  slot.isInPublicService ? 'service' : 'outside',
                                                  covered ? 'covered' : '',
                                                  slot.isInPublicService && !covered ? 'gap' : '',
                                                ]
                                                  .filter(Boolean)
                                                  .join(' ')}
                                                title={
                                                  covered
                                                    ? `${row.schedule?.shiftName ?? 'Horario'} • ${slot.label}`
                                                    : `${slot.label} sem cobertura`
                                                }
                                              />
                                            )
                                          })}
                                        </Fragment>
                                      )
                                    })}
                                  </Fragment>
                                ))}
                              </Fragment>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </section>
                ) : (
                  <>
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
                    const weekRows = getVisibleWeekRows(weekDates)
                    const irregularWeekRows = weekRows.filter(
                      (item) => validateScaleRow(item, weekDates).issues.length > 0,
                    )
                    const emptyAssignmentSlots = weekRows.reduce((sum, collaborator) => {
                      const unfilledDays = weekDates.filter(
                        (date) => !getAssignmentForDay(collaborator.id, toIsoDate(date)),
                      ).length
                      return sum + unfilledDays
                    }, 0)
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
                            <span>{irregularWeekRows.length} com irregularidade</span>
                            <span>{emptyAssignmentSlots} celulas sem escala</span>
                            <span>{formatCurrency(dayExtraCosts.reduce((sum, value) => sum + value, 0))} em extras</span>
                            {canEditScale ? (
                              <button
                                type="button"
                                className="secondary-button"
                                onClick={() => openScaleBatchModal(weekDates)}
                              >
                                Operacao em lote
                              </button>
                            ) : null}
                          </div>
                        </div>
                        <div className="scale-week-coverage-shortcuts no-print">
                          <span className="scale-week-coverage-shortcuts-title">Cobertura</span>
                          {weekDates.map((date) => {
                            const isoDate = toIsoDate(date)
                            return (
                              <button
                                key={`coverage-shortcut-${isoDate}`}
                                type="button"
                                className="ghost-button scale-week-coverage-shortcut-button"
                                onClick={() => openScaleCoverageForDate(isoDate)}
                              >
                                {formatScaleCoverageShortcutLabel(date)}
                              </button>
                            )
                          })}
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
                                                              <div className="scale-person-actions no-print">
                                                                {canEditScale ? (
                                                                  <button
                                                                    type="button"
                                                                    className="ghost-button scale-replicate-button"
                                                                    onClick={() =>
                                                                      openScaleReplicationModal(collaborator.id, weekDates)
                                                                    }
                                                                  >
                                                                    Replicar
                                                                  </button>
                                                                ) : null}
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
                                                                            (!isSystemAdmin &&
                                                                              !currentCompany?.allowPastScaleEdits &&
                                                                              entry.date < todayIso) ||
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
                                                                          (!isSystemAdmin &&
                                                                            !currentCompany?.allowPastScaleEdits &&
                                                                            entry.date < todayIso) ||
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
              </>
            )}
          </section>
        )}

        {activeSection === 'Usuarios' && canManageData && effectiveSectionAccess.Usuarios && (
          <section className="section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Cadastro</p>
                <h2>Usuarios</h2>
              </div>
              <p className="section-note">
                Os logins cadastrados aqui podem ficar restritos a {currentCompany?.tradeName} ou ser vinculados a outras empresas ativas do grupo.
              </p>
            </div>

            <div className="helper-banner field-span">
              {isSystemAdmin
                ? `Usuario master com acesso automatico a todos os setores desta empresa: ${sessionSectorAccess.join(', ') || 'nenhum setor cadastrado ainda'}.`
                : `Setores liberados para o usuario atual: ${sessionSectorAccess.join(', ') || 'nenhum setor vinculado'}.`}
            </div>

            <form className="form-grid" onSubmit={handleUserSubmit}>
              <label>
                Nome completo <span className="required-marker">*</span>
                <input
                  value={userForm.fullName}
                  onChange={(event) => setUserForm({ ...userForm, fullName: normalizeTextEntry(event.target.value) })}
                />
              </label>
              <label>
                Usuario <span className="required-marker">*</span>
                <input
                  value={userForm.username}
                  onChange={(event) => setUserForm({ ...userForm, username: event.target.value })}
                />
              </label>
              <label>
                Senha <span className="required-marker">*</span>
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
                      sectionAccess: buildDefaultSectionAccessByRole(event.target.value as CompanyRole),
                      linkedCollaboratorId:
                        event.target.value === 'Visualizador' ? userForm.linkedCollaboratorId : '',
                      additionalCompanyIds:
                        event.target.value === 'Visualizador' ? [] : userForm.additionalCompanyIds,
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

              {isSystemAdmin ? (
                <div className="field-span">
                  <div className="field-heading">
                    <span className="field-title">Empresas adicionais para este login</span>
                    <span className="field-helper">
                      O mesmo usuario podera escolher a empresa ativa no login. Para outras empresas, o sistema libera todos os setores ja cadastrados nelas. Esse atalho nao se aplica a visualizador.
                    </span>
                  </div>

                  {additionalUserCompanyOptions.length > 0 ? (
                    <div className="selector-grid">
                      {additionalUserCompanyOptions.map((company) => (
                        <label key={company.id} className="checkbox-card">
                          <input
                            type="checkbox"
                            checked={userForm.additionalCompanyIds.includes(String(company.id))}
                            disabled={userForm.role === 'Visualizador'}
                            onChange={() => toggleUserAdditionalCompany(String(company.id))}
                          />
                          <span>{company.tradeName}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="field-helper">Nao ha outras empresas ativas disponiveis.</div>
                  )}
                </div>
              ) : null}

              <div className="field-span">
                <div className="field-heading">
                  <span className="field-title">Acessos por modulo</span>
                  <span className="field-helper">
                    O papel define uma base inicial, mas voce pode ajustar os modulos liberados para este usuario nesta empresa.
                  </span>
                </div>

                <div className="selector-grid">
                  {appSections.map((section) => {
                    const checked = normalizeSectionAccess(userForm.role, userForm.sectionAccess)[section]
                    const isLocked = section === 'Escala'
                    return (
                      <label key={section} className="checkbox-card">
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={isLocked}
                          onChange={() => toggleUserSectionAccess(section)}
                        />
                        <span>{section}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              {userForm.role === 'Visualizador' ? (
                <div className="field-span">
                  <label>
                    Colaborador vinculado <span className="required-marker">*</span>
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
                    {(() => {
                      const relatedCompanies = getCompanyUserMembershipsForUser(users, item)
                        .filter((membership) => membership.companyId !== item.companyId)
                        .map((membership) => companies.find((company) => company.id === membership.companyId)?.tradeName)
                        .filter((companyName): companyName is string => !!companyName)

                      return relatedCompanies.length > 0 ? (
                        <div className="user-meta-line">
                          <span>
                            <strong className="meta-label">Outras empresas:</strong> {relatedCompanies.join(', ')}
                          </span>
                        </div>
                      ) : null
                    })()}
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
                      <span>
                        <strong className="meta-label">Modulos:</strong>{' '}
                        {appSections
                          .filter((section) => normalizeSectionAccess(item.role, item.sectionAccess)[section])
                          .join(', ')}
                      </span>
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
        <div className="modal-backdrop" role="presentation" onClick={closeScheduleWarning}>
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
              <button type="button" className="ghost-button" onClick={closeScheduleWarning}>
                Fechar
              </button>
            </div>

            <div className={`feedback ${scheduleWarning.confirmLabel ? 'warning' : 'error'}`}>
              <strong>
                {scheduleWarning.confirmLabel
                  ? 'O horario infringe a regra atual e precisa de confirmacao.'
                  : 'O horario nao pode ser cadastrado.'}
              </strong>
              <ul>
                {scheduleWarning.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>

            {scheduleWarning.confirmLabel ? (
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={closeScheduleWarning}>
                  Revisar horario
                </button>
                <button type="button" className="primary-button" onClick={confirmScheduleWarning}>
                  {scheduleWarning.confirmLabel}
                </button>
              </div>
            ) : null}
          </section>
        </div>
      )}

      {collaboratorWarning && (
        <div className="modal-backdrop" role="presentation" onClick={() => setCollaboratorWarning(null)}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="collaborator-warning-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Validacao de colaborador</p>
                <h2 id="collaborator-warning-title">{collaboratorWarning.title}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setCollaboratorWarning(null)}>
                Fechar
              </button>
            </div>

            <div className="feedback error">
              <strong>O colaborador nao pode ser salvo enquanto houver pendencias.</strong>
              <ul>
                {collaboratorWarning.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}

      {functionWarning && (
        <div className="modal-backdrop" role="presentation" onClick={() => setFunctionWarning(null)}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="function-warning-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Validacao de funcao</p>
                <h2 id="function-warning-title">{functionWarning.title}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setFunctionWarning(null)}>
                Fechar
              </button>
            </div>

            <div className="feedback error">
              <strong>A funcao nao pode ser salva enquanto houver pendencias.</strong>
              <ul>
                {functionWarning.messages.map((message) => (
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

      {discardWarning && (
        <div className="modal-backdrop" role="presentation" onClick={cancelDiscardWarning}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="discard-warning-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Alteracoes nao salvas</p>
                <h2 id="discard-warning-title">{discardWarning.title}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={cancelDiscardWarning}>
                Fechar
              </button>
            </div>

            <div className="feedback warning">
              <strong>O progresso atual sera perdido.</strong>
              <p>{discardWarning.message}</p>
            </div>

            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={cancelDiscardWarning}>
                Continuar editando
              </button>
              <button type="button" className="primary-button" onClick={confirmDiscardWarning}>
                Descartar e continuar
              </button>
            </div>
          </section>
        </div>
      )}

      {scaleCommentModal && (
        <div className="modal-backdrop" role="presentation" onClick={() => closeScaleCommentModal()}>
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
              <button type="button" className="ghost-button" onClick={() => closeScaleCommentModal()}>
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

      {scaleReplicationModal && activeScaleReplicationCollaborator && (
        <div className="modal-backdrop" role="presentation" onClick={closeScaleReplicationModal}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scale-replication-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Replicacao individual</p>
                <h2 id="scale-replication-title">Replicar escala do colaborador</h2>
              </div>
              <button type="button" className="ghost-button" onClick={closeScaleReplicationModal}>
                Fechar
              </button>
            </div>

            <p className="section-note">
              {getCollaboratorProfile(activeScaleReplicationCollaborator.cpf)?.fullName ?? activeScaleReplicationCollaborator.cpf}
            </p>

            <form className="form-grid" onSubmit={submitScaleReplication}>
              <div className="field-span">
                <span className="field-title">Modo de replicacao <span className="required-marker">*</span></span>
                <div className="pill-row">
                  <button
                    type="button"
                    className={scaleReplicationModal.mode === 'sequence' ? 'pill active' : 'pill'}
                    onClick={() =>
                      setScaleReplicationModal((current) =>
                        current === null
                          ? current
                          : { ...current, mode: 'sequence' },
                      )
                    }
                  >
                    Periodo corrido
                  </button>
                  <button
                    type="button"
                    className={scaleReplicationModal.mode === 'weekly' ? 'pill active' : 'pill'}
                    onClick={() =>
                      setScaleReplicationModal((current) =>
                        current === null
                          ? current
                          : { ...current, mode: 'weekly' },
                      )
                    }
                  >
                    Recorrencia semanal
                  </button>
                </div>
              </div>
              <label>
                Inicio da origem <span className="required-marker">*</span>
                <input
                  required
                  type="date"
                  value={scaleReplicationModal.sourceStartDate}
                  onChange={(event) =>
                    setScaleReplicationModal((current) =>
                      current === null
                        ? current
                        : { ...current, sourceStartDate: event.target.value },
                    )
                  }
                />
              </label>
              <label>
                Fim da origem <span className="required-marker">*</span>
                <input
                  required
                  type="date"
                  value={scaleReplicationModal.sourceEndDate}
                  onChange={(event) =>
                    setScaleReplicationModal((current) =>
                      current === null
                        ? current
                        : { ...current, sourceEndDate: event.target.value },
                    )
                  }
                />
              </label>
              <label>
                Inicio do destino <span className="required-marker">*</span>
                <input
                  required
                  type="date"
                  value={scaleReplicationModal.targetStartDate}
                  onChange={(event) =>
                    setScaleReplicationModal((current) =>
                      current === null
                        ? current
                        : { ...current, targetStartDate: event.target.value },
                    )
                  }
                />
              </label>
              {scaleReplicationModal.mode === 'weekly' ? (
                <label>
                  Quantidade de semanas <span className="required-marker">*</span>
                  <input
                    required
                    inputMode="numeric"
                    value={scaleReplicationModal.weeklyRepeatCount}
                    onChange={(event) =>
                      setScaleReplicationModal((current) =>
                        current === null
                          ? current
                          : {
                              ...current,
                              weeklyRepeatCount: event.target.value.replace(/\D/g, ''),
                            },
                      )
                    }
                  />
                </label>
              ) : null}
              <div className="field-span helper-banner">
                {scaleReplicationModal.mode === 'weekly'
                  ? 'A recorrencia semanal repete o bloco de origem preservando os mesmos deslocamentos de dias em cada semana.'
                  : 'O destino sempre tera a mesma quantidade de dias do periodo de origem. O sistema replica dia a dia, na mesma sequencia.'}
              </div>
              <div className="field-span replication-preview-panel">
                <strong>Previa das datas afetadas</strong>
                <span className="field-helper">
                  {activeScaleReplicationPreview.length} destino(s) planejado(s)
                </span>
                {activeScaleReplicationPreviewSummary.length > 0 ? (
                  <div className="replication-preview-summary">
                    {activeScaleReplicationPreviewSummary.map((item) => (
                      <article
                        key={item.weekStart}
                        className={item.risk > 0 ? 'replication-summary-card irregular' : 'replication-summary-card'}
                      >
                        <strong>{formatWeekLabel(getWeekDates(item.weekStart))}</strong>
                        <span>{item.total} destino(s)</span>
                        <span>{item.fillEmpty} preenche(m) dia vazio</span>
                        <span>{item.keepExisting} mantem dias ja preenchidos</span>
                        <span>{item.overwrite} sobrescreve(m)</span>
                        <span>{item.risk} com risco semanal</span>
                      </article>
                    ))}
                  </div>
                ) : null}
                {activeScaleReplicationPreview.length > 0 ? (
                  <div className="replication-preview-list">
                    {activeScaleReplicationPreview.map((item) => (
                      <article
                        key={`${item.sourceDate}-${item.targetDate}`}
                        className={item.hasIrregularityRisk ? 'replication-preview-row irregular' : 'replication-preview-row'}
                      >
                        <span>
                          <strong>Origem:</strong> {formatDateLabel(item.sourceDate)} ({item.sourceLabel})
                        </span>
                        <span>
                          <strong>Destino:</strong> {formatDateLabel(item.targetDate)} ({item.targetLabel})
                        </span>
                        <span>
                          <strong>Status:</strong>{' '}
                          {item.willOverwrite
                            ? 'Sobrescreve horario existente'
                            : item.alreadyFilled
                              ? 'Mantem horario existente'
                              : 'Preenche dia vazio'}
                        </span>
                        {item.hasIrregularityRisk ? (
                          <div className="replication-preview-warning">
                            <strong>Semana com risco:</strong> {item.irregularityMessages[0]}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="field-helper">
                    Defina um periodo de origem e um destino valido para visualizar a previa.
                  </div>
                )}
              </div>
              <label className="toggle-field field-span">
                <span>Sobrescrever dias do destino que ja possuem horario</span>
                <input
                  type="checkbox"
                  checked={scaleReplicationModal.overwriteExisting}
                  onChange={(event) =>
                    setScaleReplicationModal((current) =>
                      current === null
                        ? current
                        : { ...current, overwriteExisting: event.target.checked },
                    )
                  }
                />
              </label>
              <label className="toggle-field field-span">
                <span>Replicar folgas do periodo de origem quando houver sobrescrita</span>
                <input
                  type="checkbox"
                  checked={scaleReplicationModal.copyDaysOff}
                  onChange={(event) =>
                    setScaleReplicationModal((current) =>
                      current === null
                        ? current
                        : { ...current, copyDaysOff: event.target.checked },
                    )
                  }
                />
              </label>
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={closeScaleReplicationModal}>
                  Cancelar
                </button>
                <button type="submit" className="primary-button">
                  Replicar periodo
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {scaleReplicationWarning && (
        <div className="modal-backdrop" role="presentation" onClick={closeScaleReplicationWarning}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scale-replication-warning-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Validacao da replicacao</p>
                <h2 id="scale-replication-warning-title">{scaleReplicationWarning.title}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={closeScaleReplicationWarning}>
                Fechar
              </button>
            </div>

            <div className="feedback warning">
              <strong>A replicacao vai criar irregularidades na escala.</strong>
              <ul>
                {scaleReplicationWarning.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>

            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={closeScaleReplicationWarning}>
                Revisar periodo
              </button>
              <button type="button" className="primary-button" onClick={confirmScaleReplicationWarning}>
                {scaleReplicationWarning.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}

      {scaleBatchModal && (
        <div className="modal-backdrop" role="presentation" onClick={closeScaleBatchModal}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scale-batch-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Operacao em lote</p>
                <h2 id="scale-batch-title">Aplicar na semana visivel</h2>
              </div>
              <button type="button" className="ghost-button" onClick={closeScaleBatchModal}>
                Fechar
              </button>
            </div>

            <p className="section-note">
              {activeScaleBatchWeekDates.length === 7
                ? formatWeekLabel(activeScaleBatchWeekDates)
                : 'Semana visivel indisponivel. Feche o modal e abra novamente.'}
            </p>

            {activeScaleBatchErrorMessage ? (
              <div className="feedback error">
                <strong>Operacao em lote indisponivel</strong>
                <ul>
                  <li>{activeScaleBatchErrorMessage}</li>
                </ul>
              </div>
            ) : null}

            <form className="form-grid" onSubmit={submitScaleBatch}>
              <label>
                Escopo
                <select
                  value={scaleBatchModal.employmentScope}
                  disabled={activeScaleBatchErrorMessage !== null}
                  onChange={(event) =>
                    setScaleBatchModal((current) =>
                      current === null
                        ? current
                        : {
                            ...current,
                            employmentScope: event.target.value as 'TODOS' | CollaboratorEmploymentType,
                          },
                    )
                  }
                >
                  <option value="TODOS">Todas as linhas visiveis</option>
                  {scaleEmploymentOrder.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Horario
                <select
                  value={scaleBatchModal.scheduleIdValue}
                  disabled={activeScaleBatchErrorMessage !== null}
                  onChange={(event) =>
                    setScaleBatchModal((current) =>
                      current === null ? current : { ...current, scheduleIdValue: event.target.value },
                    )
                  }
                >
                  <option value="">Aplicar folga</option>
                  {scaleSchedulesForSelect.map((schedule) => (
                    <option key={schedule.id} value={schedule.id}>
                      {schedule.shiftName} ({schedule.abbreviation})
                    </option>
                  ))}
                </select>
              </label>
              <div className="field-span">
                <span className="field-title">Dias selecionados</span>
                <div className="selector-grid">
                  {activeScaleBatchWeekDates.map((date) => {
                    const isoDate = toIsoDate(date)
                    const isChecked = scaleBatchModal.selectedDates.includes(isoDate)

                    return (
                      <label key={isoDate} className="checkbox-card">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          disabled={activeScaleBatchErrorMessage !== null}
                          onChange={() =>
                            setScaleBatchModal((current) => {
                              if (current === null) {
                                return current
                              }

                              return {
                                ...current,
                                selectedDates: isChecked
                                  ? current.selectedDates.filter((item) => item !== isoDate)
                                  : [...current.selectedDates, isoDate].sort(),
                              }
                            })
                          }
                        />
                        <span>{formatDateLabel(isoDate)}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
              <label className="toggle-field field-span">
                <span>Sobrescrever dias que ja possuem horario</span>
                <input
                  type="checkbox"
                  checked={scaleBatchModal.overwriteExisting}
                  disabled={activeScaleBatchErrorMessage !== null}
                  onChange={(event) =>
                    setScaleBatchModal((current) =>
                      current === null
                        ? current
                        : { ...current, overwriteExisting: event.target.checked },
                    )
                  }
                />
              </label>
              <div className="field-span replication-preview-panel">
                <strong>Impacto previsto</strong>
                <span className="field-helper">
                  {activeScaleBatchRows.length} colaborador(es) no escopo atual
                </span>
                <div className="replication-preview-summary">
                  <article className="replication-summary-card">
                    <strong>Linhas alvo</strong>
                    <span>{activeScaleBatchRows.length}</span>
                  </article>
                  <article className="replication-summary-card">
                    <strong>Dias marcados</strong>
                    <span>{scaleBatchModal.selectedDates.length}</span>
                  </article>
                  <article className="replication-summary-card">
                    <strong>Acao</strong>
                    <span>{scaleBatchModal.scheduleIdValue ? 'Aplicar horario' : 'Aplicar folga'}</span>
                  </article>
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={closeScaleBatchModal}>
                  Cancelar
                </button>
                <button type="submit" className="primary-button" disabled={activeScaleBatchErrorMessage !== null}>
                  Aplicar lote
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {functionCloneModal && (
        <div className="modal-backdrop" role="presentation" onClick={closeFunctionCloneModal}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="function-clone-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Clonagem assistida</p>
                <h2 id="function-clone-title">Clonar funcao vinculada</h2>
              </div>
              <button type="button" className="ghost-button" onClick={closeFunctionCloneModal}>
                Fechar
              </button>
            </div>
            <form className="form-grid" onSubmit={submitFunctionClone}>
              <div className="field-span helper-banner">
                Esta copia sera criada como cadastro local editavel para {currentCompany?.tradeName ?? 'a empresa atual'}.
              </div>
              <label>
                Nome da funcao <span className="required-marker">*</span>
                <input
                  required
                  value={functionCloneModal.name}
                  onChange={(event) =>
                    setFunctionCloneModal((current) =>
                      current === null ? current : { ...current, name: event.target.value },
                    )
                  }
                />
              </label>
              <label>
                Setor <span className="required-marker">*</span>
                <input
                  required
                  value={functionCloneModal.sector}
                  onChange={(event) =>
                    setFunctionCloneModal((current) =>
                      current === null ? current : { ...current, sector: event.target.value },
                    )
                  }
                />
              </label>
              <label>
                Base salarial
                <input
                  value={functionCloneModal.baseSalary}
                  onChange={(event) =>
                    setFunctionCloneModal((current) =>
                      current === null ? current : { ...current, baseSalary: event.target.value },
                    )
                  }
                />
              </label>
              <label>
                Cota no servico
                <input
                  value={functionCloneModal.serviceQuota}
                  onChange={(event) =>
                    setFunctionCloneModal((current) =>
                      current === null ? current : { ...current, serviceQuota: event.target.value },
                    )
                  }
                />
              </label>
              <label>
                Paga extra
                <input
                  value={functionCloneModal.extraPayValue}
                  onChange={(event) =>
                    setFunctionCloneModal((current) =>
                      current === null ? current : { ...current, extraPayValue: event.target.value },
                    )
                  }
                />
              </label>
              <label className="field-span">
                Descritivo <span className="required-marker">*</span>
                <textarea
                  required
                  rows={5}
                  value={functionCloneModal.description}
                  onChange={(event) =>
                    setFunctionCloneModal((current) =>
                      current === null ? current : { ...current, description: event.target.value },
                    )
                  }
                />
              </label>
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={closeFunctionCloneModal}>
                  Cancelar
                </button>
                <button type="submit" className="primary-button">
                  Criar copia local
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {scheduleCloneModal && (
        <div className="modal-backdrop" role="presentation" onClick={closeScheduleCloneModal}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="schedule-clone-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Clonagem assistida</p>
                <h2 id="schedule-clone-title">Clonar horario vinculado</h2>
              </div>
              <button type="button" className="ghost-button" onClick={closeScheduleCloneModal}>
                Fechar
              </button>
            </div>
            <form className="form-grid schedule-form" onSubmit={submitScheduleClone}>
              <div className="field-span helper-banner">
                Esta copia sera criada como horario local editavel para {currentCompany?.tradeName ?? 'a empresa atual'}.
              </div>
              <label>
                Turno <span className="required-marker">*</span>
                <input
                  required
                  value={scheduleCloneModal.shiftName}
                  onChange={(event) =>
                    setScheduleCloneModal((current) =>
                      current === null ? current : { ...current, shiftName: event.target.value },
                    )
                  }
                />
              </label>
              <label>
                Abreviacao sugerida
                <input value={scheduleCloneAbbreviation} readOnly />
              </label>
              <label className="time-row">
                Horario de inicio <span className="required-marker">*</span>
                <div className="time-control">
                  <input
                    required
                    placeholder="0000"
                    inputMode="numeric"
                    maxLength={5}
                    value={scheduleCloneModal.startTime}
                    onChange={(event) => {
                      const normalized = normalizeTypedTime(event.target.value, scheduleCloneModal.startPeriod)
                      setScheduleCloneModal((current) =>
                        current === null
                          ? current
                          : { ...current, startTime: normalized.time, startPeriod: normalized.period },
                      )
                    }}
                  />
                  <select
                    value={scheduleCloneModal.startPeriod}
                    onChange={(event) =>
                      setScheduleCloneModal((current) =>
                        current === null ? current : { ...current, startPeriod: event.target.value as 'AM' | 'PM' },
                      )
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
                    value={scheduleCloneModal.breakStart}
                    onChange={(event) => {
                      const normalized = normalizeTypedTime(event.target.value, scheduleCloneModal.breakStartPeriod)
                      setScheduleCloneModal((current) =>
                        current === null
                          ? current
                          : { ...current, breakStart: normalized.time, breakStartPeriod: normalized.period },
                      )
                    }}
                  />
                  <select
                    value={scheduleCloneModal.breakStartPeriod}
                    onChange={(event) =>
                      setScheduleCloneModal((current) =>
                        current === null
                          ? current
                          : { ...current, breakStartPeriod: event.target.value as 'AM' | 'PM' },
                      )
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
                    value={scheduleCloneModal.breakEnd}
                    onChange={(event) => {
                      const normalized = normalizeTypedTime(event.target.value, scheduleCloneModal.breakEndPeriod)
                      setScheduleCloneModal((current) =>
                        current === null
                          ? current
                          : { ...current, breakEnd: normalized.time, breakEndPeriod: normalized.period },
                      )
                    }}
                  />
                  <select
                    value={scheduleCloneModal.breakEndPeriod}
                    onChange={(event) =>
                      setScheduleCloneModal((current) =>
                        current === null
                          ? current
                          : { ...current, breakEndPeriod: event.target.value as 'AM' | 'PM' },
                      )
                    }
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </label>
              <label className="time-row">
                Fim do turno <span className="required-marker">*</span>
                <div className="time-control">
                  <input
                    required
                    placeholder="0000"
                    inputMode="numeric"
                    maxLength={5}
                    value={scheduleCloneModal.endTime}
                    onChange={(event) => {
                      const normalized = normalizeTypedTime(event.target.value, scheduleCloneModal.endPeriod)
                      setScheduleCloneModal((current) =>
                        current === null
                          ? current
                          : { ...current, endTime: normalized.time, endPeriod: normalized.period },
                      )
                    }}
                  />
                  <select
                    value={scheduleCloneModal.endPeriod}
                    onChange={(event) =>
                      setScheduleCloneModal((current) =>
                        current === null ? current : { ...current, endPeriod: event.target.value as 'AM' | 'PM' },
                      )
                    }
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </label>
              <div className="field-span helper-banner live-metric">
                <strong>Horas trabalhadas calculadas em tempo real</strong>
                <span>{scheduleCloneWorkedMinutes !== undefined ? formatWorkedHours(scheduleCloneWorkedMinutes) : '--:--'}</span>
                {scheduleClonePreview && scheduleClonePreview.issues.length > 0 ? (
                  <ul>
                    {scheduleClonePreview.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                ) : (
                  <small>
                    Preencha inicio e fim do turno. A pausa e opcional e, quando usada, precisa ter inicio e fim.
                  </small>
                )}
              </div>
              <div className="form-actions">
                <button type="button" className="secondary-button" onClick={closeScheduleCloneModal}>
                  Cancelar
                </button>
                <button type="submit" className="primary-button">
                  Criar copia local
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {impactWarning && (
        <div className="modal-backdrop" role="presentation" onClick={closeImpactWarning}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="impact-warning-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Impacto da operacao</p>
                <h2 id="impact-warning-title">{impactWarning.title}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={closeImpactWarning}>
                Fechar
              </button>
            </div>

            <div className="feedback warning impact-warning-copy">
              <strong>Revise o impacto antes de continuar.</strong>
              <ul>
                {impactWarning.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>

            {impactWarning.replacementOptions.length > 0 ? (
              <label className="impact-warning-replacement">
                {impactWarning.replacementLabel ?? 'Substituir por'}
                <select
                  value={impactWarning.replacementValue}
                  onChange={(event) =>
                    setImpactWarning((current) =>
                      current === null
                        ? current
                        : {
                            ...current,
                            replacementValue: event.target.value,
                          },
                    )
                  }
                >
                  <option value="">{impactWarning.replacementPlaceholder ?? 'Nao substituir'}</option>
                  {impactWarning.replacementOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={closeImpactWarning}>
                Cancelar
              </button>
              <button type="button" className="primary-button" onClick={confirmImpactWarning}>
                {impactWarning.confirmLabel}
              </button>
            </div>
          </section>
        </div>
      )}

      {scaleBatchWarning && (
        <div className="modal-backdrop" role="presentation" onClick={closeScaleBatchWarning}>
          <section
            className="modal-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="scale-batch-warning-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header modal-header">
              <div>
                <p className="eyebrow">Validacao da operacao em lote</p>
                <h2 id="scale-batch-warning-title">{scaleBatchWarning.title}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={closeScaleBatchWarning}>
                Fechar
              </button>
            </div>

            <div className="feedback warning">
              <strong>A operacao em lote vai criar irregularidades na escala.</strong>
              <ul>
                {scaleBatchWarning.messages.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>

            <div className="form-actions">
              <button type="button" className="secondary-button" onClick={closeScaleBatchWarning}>
                Revisar lote
              </button>
              <button type="button" className="primary-button" onClick={confirmScaleBatchWarning}>
                {scaleBatchWarning.confirmLabel}
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
            closeCollaboratorModal()
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
                  closeCollaboratorModal()
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
                CPF <span className="required-marker">*</span>
                <input
                  required
                  value={collaboratorForm.cpf}
                  onChange={(event) => changeCollaboratorCpf(event.target.value)}
                  placeholder="000.000.000-00"
                />
              </label>
              <label>
                Nome completo <span className="required-marker">*</span>
                <input
                  required
                  value={collaboratorForm.fullName}
                  onChange={(event) =>
                    setCollaboratorForm({ ...collaboratorForm, fullName: normalizeTextEntry(event.target.value) })
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
                  <span className="field-title">Funcao <span className="required-marker">*</span></span>
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
                  Funcao principal nesta empresa <span className="required-marker">*</span>
                  <select
                    required
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
            <p className="field-helper">Campos marcados com <span className="required-marker">*</span> sao obrigatorios.</p>
          </section>
        </div>
      )}

      {isFunctionModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => closeFunctionModal()}>
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
              <button type="button" className="ghost-button" onClick={() => closeFunctionModal()}>
                Fechar
              </button>
            </div>

            <p className="section-note">
              Esta funcao sera criada dentro da empresa atualmente selecionada.
            </p>

            <form className="form-grid" onSubmit={handleFunctionSubmit}>
              <label>
                Funcao <span className="required-marker">*</span>
                <input
                  required
                  value={functionForm.name}
                  onChange={(event) => setFunctionForm({ ...functionForm, name: normalizeTextEntry(event.target.value) })}
                />
              </label>
              <label>
                Setor <span className="required-marker">*</span>
                <input
                  required
                  list="company-sector-options-modal"
                  placeholder="Selecione ou digite um novo setor"
                  value={functionForm.sector}
                  onChange={(event) => setFunctionForm({ ...functionForm, sector: normalizeTextEntry(event.target.value) })}
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
                Descritivo <span className="required-marker">*</span>
                <textarea
                  required
                  rows={5}
                  value={functionForm.description}
                  onChange={(event) =>
                    setFunctionForm({ ...functionForm, description: normalizeTextEntry(event.target.value) })
                  }
                />
              </label>
              <div className="form-actions">
                <button type="submit" className="primary-button">
                  Salvar funcao
                </button>
              </div>
            </form>
            <p className="field-helper">Campos marcados com <span className="required-marker">*</span> sao obrigatorios.</p>

            <datalist id="company-sector-options-modal">
              {availableSectorNames.map((sectorName) => (
                <option key={sectorName} value={sectorName} />
              ))}
            </datalist>
          </section>
        </div>
      )}

      {isCompanyModalOpen && (
        <div className="modal-backdrop" role="presentation" onClick={() => closeCompanyModal()}>
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
              <button type="button" className="ghost-button" onClick={() => closeCompanyModal()}>
                Fechar
              </button>
            </div>

            <form className="form-grid" onSubmit={(event) => submitCompany(event, 'create')}>
              <label>
                Nome fantasia <span className="required-marker">*</span>
                <input
                  value={companyForm.tradeName}
                  onChange={(event) => setCompanyForm({ ...companyForm, tradeName: normalizeTextEntry(event.target.value) })}
                />
              </label>
              <label>
                Razao social <span className="required-marker">*</span>
                <input
                  value={companyForm.legalName}
                  onChange={(event) => setCompanyForm({ ...companyForm, legalName: normalizeTextEntry(event.target.value) })}
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
                  onChange={(event) => setCompanyForm({ ...companyForm, street: normalizeTextEntry(event.target.value) })}
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
                  onChange={(event) => setCompanyForm({ ...companyForm, complement: normalizeTextEntry(event.target.value) })}
                />
              </label>
              <label>
                Bairro
                <input
                  value={companyForm.district}
                  onChange={(event) => setCompanyForm({ ...companyForm, district: normalizeTextEntry(event.target.value) })}
                />
              </label>
              <label>
                Estado <span className="required-marker">*</span>
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
                Cidade <span className="required-marker">*</span>
                <input
                  value={companyForm.city}
                  onChange={(event) => setCompanyForm({ ...companyForm, city: normalizeTextEntry(event.target.value) })}
                />
              </label>
                {companyLinksField}
                {companyAgreementField}
              <div className="form-actions">
                <button type="submit" className="primary-button">
                  Salvar empresa
                </button>
              </div>
              <p className="field-helper">Campos marcados com <span className="required-marker">*</span> sao obrigatorios.</p>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
