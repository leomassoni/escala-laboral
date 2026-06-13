type ScheduleLike = {
  shiftName: string
  startTime: string
  startPeriod: 'AM' | 'PM'
  breakStart: string
  breakStartPeriod: 'AM' | 'PM'
  breakEnd: string
  breakEndPeriod: 'AM' | 'PM'
  endTime: string
  endPeriod: 'AM' | 'PM'
  netMinutes: number
}

type FunctionLike = {
  name: string
  sector: string
  description: string
  baseSalary: string
  serviceQuota: string
  extraPayValue: string
}

type CollaboratorLike = {
  cpf: string
  employmentType: 'CLT' | 'PJ' | 'EXTRA'
  functions: string[]
  primaryFunction: string
}

type CollaboratorProfileLike = {
  fullName: string
  pixKey: string
  contact: string
}

type UserLike<TRole extends string, TSectionAccess extends Record<string, boolean>> = {
  fullName: string
  username: string
  password: string
  role: TRole
  sectors: string[]
  sectionAccess?: Partial<TSectionAccess>
  linkedCollaboratorId: number | null
  companyId: number
}

export function buildScheduleEditState<TScheduleForm>(
  targetSchedule: ScheduleLike,
  scheduleForm: TScheduleForm,
) {
  return {
    editingScheduleId: null as number | null,
    scheduleForm: {
      ...(scheduleForm as Record<string, unknown>),
      shiftName: targetSchedule.shiftName,
      startTime: targetSchedule.startTime,
      startPeriod: targetSchedule.startPeriod,
      breakStart: targetSchedule.breakStart,
      breakStartPeriod: targetSchedule.breakStartPeriod,
      breakEnd: targetSchedule.breakEnd,
      breakEndPeriod: targetSchedule.breakEndPeriod,
      endTime: targetSchedule.endTime,
      endPeriod: targetSchedule.endPeriod,
    } as TScheduleForm,
    scheduleFeedback: {
      valid: true,
      errors: [] as string[],
      notes: ['Modo de edicao ativo para este horario.'],
      netMinutes: targetSchedule.netMinutes,
    },
  }
}

export function buildUserEditState<TRole extends string, TSectionAccess extends Record<string, boolean>>(
  targetUser: UserLike<TRole, TSectionAccess>,
  normalizeSectionAccess: (role: TRole, sectionAccess?: Partial<TSectionAccess>) => TSectionAccess,
  additionalCompanyIds: string[],
) {
  return {
    editingUserId: null as number | null,
    userForm: {
      fullName: targetUser.fullName,
      username: targetUser.username,
      password: targetUser.password,
      role: targetUser.role,
      sectors: targetUser.sectors,
      sectionAccess: normalizeSectionAccess(targetUser.role, targetUser.sectionAccess),
      linkedCollaboratorId: targetUser.linkedCollaboratorId ? String(targetUser.linkedCollaboratorId) : '',
      additionalCompanyIds,
    },
    isUserFormPasswordVisible: false,
  }
}

export function buildCollaboratorEditState(
  targetCollaborator: CollaboratorLike,
  targetProfile: CollaboratorProfileLike | null,
) {
  return {
    collaboratorForm: {
      cpf: targetCollaborator.cpf,
      fullName: targetProfile?.fullName ?? '',
      pixKey: targetProfile?.pixKey ?? '',
      contact: targetProfile?.contact ?? '',
      employmentType: targetCollaborator.employmentType,
      functions: targetCollaborator.functions,
      primaryFunction: targetCollaborator.primaryFunction,
    },
    collaboratorLookupFeedback: 'Cadastro carregado para edicao.',
  }
}

export function buildFunctionModalOpenState<TFunctionForm extends { name: string }>(
  currentFunctionForm: TFunctionForm,
  prefillName = '',
) {
  return {
    functionSuggestion: prefillName,
    functionForm: {
      ...currentFunctionForm,
      name: prefillName || currentFunctionForm.name,
    },
    isFunctionModalOpen: true,
  }
}

export function buildFunctionEditState(targetFunction: FunctionLike) {
  return {
    editingFunctionId: null as number | null,
    functionForm: {
      name: targetFunction.name,
      sector: targetFunction.sector,
      description: targetFunction.description,
      baseSalary: targetFunction.baseSalary,
      serviceQuota: targetFunction.serviceQuota,
      extraPayValue: targetFunction.extraPayValue,
    },
  }
}
