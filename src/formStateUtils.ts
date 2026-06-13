type InactiveSectionAccessUser = {
  id: number
  companyId: number
  fullName: string
  username: string
  password: string
  role: string
  sectors: string[]
  linkedCollaboratorId: number | null
  sectionAccess?: Record<string, boolean> | undefined
  isActive: boolean
}

type CompanyLike = {
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
  collectiveAgreementId: number | null
}

type FunctionLike = {
  id: number
  name: string
  sector: string
  description: string
  baseSalary: string
  serviceQuota: string
  extraPayValue: string
}

type ScheduleLike = {
  id: number
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

type AgreementLike = {
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
  rules: {
    standardMealBreakAfterSixHoursMinutes: number
    shortShiftBreakMinutes: number
    standardBreakMaxMinutes: number
    healthPlanBreakMaxMinutes: number
    specialBreakMinMinutes: number
    specialBreakMaxMinutes: number
    maxDailyMinutes: number
    bankHoursMaxDailyMinutes: number
    rotatingDayOffNoticeDays: number
    allowTwelveByThirtySix: boolean
  }
}

export function buildCompanyFormSnapshot(
  company: CompanyLike | null,
  emptyCompanyForm: Record<string, string>,
) {
  if (!company) {
    return emptyCompanyForm
  }

  return {
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
  }
}

export function buildFunctionFormSnapshot(
  functionId: number | null,
  functions: FunctionLike[],
  emptyFunctionForm: Record<string, string>,
) {
  const targetFunction = functionId === null ? null : functions.find((item) => item.id === functionId) ?? null
  if (!targetFunction) {
    return emptyFunctionForm
  }

  return {
    name: targetFunction.name,
    sector: targetFunction.sector,
    description: targetFunction.description,
    baseSalary: targetFunction.baseSalary,
    serviceQuota: targetFunction.serviceQuota,
    extraPayValue: targetFunction.extraPayValue,
  }
}

export function buildScheduleFormSnapshot<T extends Omit<ScheduleLike, 'id'>>(
  scheduleId: number | null,
  schedules: ScheduleLike[],
  emptyScheduleForm: T,
) {
  const targetSchedule = scheduleId === null ? null : schedules.find((item) => item.id === scheduleId) ?? null
  if (!targetSchedule) {
    return emptyScheduleForm
  }

  return {
    shiftName: targetSchedule.shiftName,
    startTime: targetSchedule.startTime,
    startPeriod: targetSchedule.startPeriod,
    breakStart: targetSchedule.breakStart,
    breakStartPeriod: targetSchedule.breakStartPeriod,
    breakEnd: targetSchedule.breakEnd,
    breakEndPeriod: targetSchedule.breakEndPeriod,
    endTime: targetSchedule.endTime,
    endPeriod: targetSchedule.endPeriod,
  } as T
}

export function buildUserFormSnapshot<TSectionAccess extends Record<string, boolean>>(
  userId: number | null,
  users: InactiveSectionAccessUser[],
  emptyUserForm: {
    fullName: string
    username: string
    password: string
    role: string
    sectors: string[]
    sectionAccess: Partial<TSectionAccess>
    linkedCollaboratorId: string
    additionalCompanyIds: string[]
  },
  normalizeSectionAccess: (role: string, sectionAccess?: Partial<TSectionAccess>) => TSectionAccess,
  getCompanyUserMembershipsForUser: (
    users: InactiveSectionAccessUser[],
    user: InactiveSectionAccessUser,
  ) => InactiveSectionAccessUser[],
) {
  const targetUser = userId === null ? null : users.find((item) => item.id === userId) ?? null
  if (!targetUser) {
    return emptyUserForm
  }

  return {
    fullName: targetUser.fullName,
    username: targetUser.username,
    password: targetUser.password,
    role: targetUser.role,
    sectors: targetUser.sectors,
    sectionAccess: normalizeSectionAccess(targetUser.role, targetUser.sectionAccess as Partial<TSectionAccess>),
    linkedCollaboratorId: targetUser.linkedCollaboratorId ? String(targetUser.linkedCollaboratorId) : '',
    additionalCompanyIds: getCompanyUserMembershipsForUser(users, targetUser)
      .filter((item) => item.companyId !== targetUser.companyId)
      .map((item) => String(item.companyId)),
  }
}

export function buildAgreementFormSnapshot(
  agreementId: number | null,
  agreements: AgreementLike[],
  emptyAgreementForm: Record<string, string | boolean>,
) {
  const targetAgreement = agreementId === null ? null : agreements.find((item) => item.id === agreementId) ?? null
  if (!targetAgreement) {
    return emptyAgreementForm
  }

  return {
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
  }
}

export function hasUnsavedChangesInCurrentView(args: {
  companyForm: unknown
  companySnapshot: unknown
  companyAgreementFeedback: string
  functionForm: unknown
  functionSnapshot: unknown
  collaboratorForm: unknown
  emptyCollaboratorForm: unknown
  scheduleForm: unknown
  scheduleSnapshot: unknown
  userForm: unknown
  userSnapshot: unknown
  agreementForm: unknown
  agreementSnapshot: unknown
  scaleCommentDraft: string
  editingScaleCommentDraft: string
}) {
  const hasCompanyChanges =
    JSON.stringify(args.companyForm) !== JSON.stringify(args.companySnapshot) || !!args.companyAgreementFeedback
  const hasFunctionChanges = JSON.stringify(args.functionForm) !== JSON.stringify(args.functionSnapshot)
  const hasCollaboratorChanges =
    JSON.stringify(args.collaboratorForm) !== JSON.stringify(args.emptyCollaboratorForm)
  const hasScheduleChanges = JSON.stringify(args.scheduleForm) !== JSON.stringify(args.scheduleSnapshot)
  const hasUserChanges = JSON.stringify(args.userForm) !== JSON.stringify(args.userSnapshot)
  const hasAgreementChanges = JSON.stringify(args.agreementForm) !== JSON.stringify(args.agreementSnapshot)
  const hasCommentChanges = !!args.scaleCommentDraft.trim() || !!args.editingScaleCommentDraft.trim()

  return (
    hasCompanyChanges ||
    hasFunctionChanges ||
    hasCollaboratorChanges ||
    hasScheduleChanges ||
    hasUserChanges ||
    hasAgreementChanges ||
    hasCommentChanges
  )
}
