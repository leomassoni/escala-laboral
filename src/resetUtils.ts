export function buildResetFormState<TFunctionForm, TCollaboratorForm, TScheduleForm, TUserForm, TAgreementForm>(args: {
  emptyFunctionForm: TFunctionForm
  emptyCollaboratorForm: TCollaboratorForm
  emptyScheduleForm: TScheduleForm
  emptyUserForm: TUserForm
  emptyAgreementForm: TAgreementForm
}) {
  return {
    functionForm: args.emptyFunctionForm,
    collaboratorForm: args.emptyCollaboratorForm,
    scheduleForm: args.emptyScheduleForm,
    userForm: args.emptyUserForm,
    agreementForm: args.emptyAgreementForm,
    editingAgreementId: null as number | null,
    scheduleFeedback: null,
    editingFunctionId: null as number | null,
    editingScheduleId: null as number | null,
    editingUserId: null as number | null,
    functionSuggestion: '',
    userSectorInput: '',
    collaboratorLookupFeedback: '',
  }
}
