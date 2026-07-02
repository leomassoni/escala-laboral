export function buildInvalidUserWarning(validationMessages: string[]) {
  return {
    title: 'Usuario invalido',
    messages: validationMessages,
  }
}

export function buildInvalidCollaboratorWarning(validationMessages: string[]) {
  return {
    title: 'Colaborador invalido',
    messages: validationMessages,
  }
}

export function buildInvalidFunctionWarning(validationMessages: string[]) {
  return {
    title: 'Funcao invalida',
    messages: validationMessages,
  }
}

export function buildInvalidScheduleWarning(messages: string[]) {
  return {
    title: 'Horario invalido',
    messages,
  }
}

export function buildDuplicateScheduleFeedback() {
  return {
    valid: false,
    errors: ['Ja existe um horario cadastrado com essa mesma composicao de turno e pausa.'],
    notes: ['Edite o horario existente ou altere o novo cadastro para evitar duplicidade.'],
  }
}

export function buildSuccessfulScheduleFeedback(
  isEditing: boolean,
  notes: string[],
  netMinutes?: number,
) {
  return {
    valid: true,
    errors: [] as string[],
    notes: [
      isEditing ? 'Horario atualizado com sucesso.' : 'Horario cadastrado com sucesso.',
      ...notes,
    ],
    netMinutes,
  }
}

export function buildDeletedScheduleFeedback() {
  return {
    valid: true,
    errors: [] as string[],
    notes: ['Horario excluido com sucesso.'],
  }
}
