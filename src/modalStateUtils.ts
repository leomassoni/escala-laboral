export function buildScaleCommentModalOpenState(collaboratorId: number, date: string) {
  return {
    scaleCommentModal: { collaboratorId, date },
    scaleCommentDraft: '',
    editingScaleCommentId: null as number | null,
    editingScaleCommentDraft: '',
  }
}

export function buildScaleCommentModalClosedState() {
  return {
    scaleCommentModal: null,
    scaleCommentDraft: '',
    editingScaleCommentId: null as number | null,
    editingScaleCommentDraft: '',
  }
}

export function buildCollaboratorModalOpenState<TCollaboratorForm extends { fullName: string }>(
  source: 'scale' | 'user',
  emptyCollaboratorForm: TCollaboratorForm,
  userFullName: string,
) {
  return {
    collaboratorModalSource: source,
    collaboratorLookupFeedback: '',
    collaboratorForm:
      source === 'user'
        ? {
            ...emptyCollaboratorForm,
            fullName: userFullName,
          }
        : emptyCollaboratorForm,
    isCollaboratorModalOpen: true,
  }
}

export function buildFunctionModalClosedState<TFunctionForm>(emptyFunctionForm: TFunctionForm) {
  return {
    functionForm: emptyFunctionForm,
    editingFunctionId: null as number | null,
    functionSuggestion: '',
    isFunctionModalOpen: false,
  }
}

export function buildCompanyModalClosedState() {
  return {
    companyAgreementFeedback: '',
    isCompanyModalOpen: false,
  }
}

export function buildCollaboratorModalClosedState<TCollaboratorForm>(emptyCollaboratorForm: TCollaboratorForm) {
  return {
    collaboratorForm: emptyCollaboratorForm,
    collaboratorLookupFeedback: '',
    isCollaboratorModalOpen: false,
  }
}
