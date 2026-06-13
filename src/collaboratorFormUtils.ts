type CollaboratorEmploymentType = 'CLT' | 'PJ' | 'EXTRA'

type CollaboratorFormLike = {
  cpf: string
  fullName: string
  pixKey: string
  contact: string
  employmentType: CollaboratorEmploymentType
  functions: string[]
  primaryFunction: string
}

type CollaboratorProfileLike = {
  fullName: string
  contact: string
  pixKey: string
}

type ExistingCompanyCollaboratorLike = {
  functions: string[]
  primaryFunction: string
  employmentType: CollaboratorEmploymentType
}

export function toggleCollaboratorFunctionSelection<T extends CollaboratorFormLike>(
  current: T,
  functionName: string,
) {
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
}

export function changeCollaboratorEmploymentTypeState<T extends CollaboratorFormLike>(
  current: T,
  employmentType: CollaboratorEmploymentType,
) {
  return {
    ...current,
    employmentType,
    functions:
      employmentType === 'EXTRA' ? current.functions.slice(0, 6) : current.functions.slice(0, 1),
    primaryFunction:
      employmentType === 'EXTRA'
        ? current.primaryFunction
        : current.functions.slice(0, 1)[0] ?? current.primaryFunction,
  }
}

export function buildCollaboratorCpfLookupState<T extends CollaboratorFormLike>(
  current: T,
  formattedCpf: string,
  existingProfile: CollaboratorProfileLike,
  existingCompanyCollaborator: ExistingCompanyCollaboratorLike | null,
) {
  return {
    collaboratorForm: {
      ...current,
      cpf: formattedCpf,
      fullName: existingProfile.fullName,
      contact: existingProfile.contact,
      pixKey: existingProfile.pixKey,
      functions: existingCompanyCollaborator?.functions ?? current.functions,
      primaryFunction: existingCompanyCollaborator?.primaryFunction ?? current.primaryFunction,
      employmentType: existingCompanyCollaborator?.employmentType ?? current.employmentType,
    },
    collaboratorLookupFeedback: existingCompanyCollaborator
      ? 'Este colaborador ja possui cadastro nesta empresa. Os dados globais foram carregados.'
      : 'Colaborador localizado por CPF em outra empresa. Dados basicos carregados automaticamente.',
  }
}

export function buildCollaboratorCpfMissingProfileState<T extends CollaboratorFormLike>(
  current: T,
  formattedCpf: string,
  cpfDigitsLength: number,
) {
  return {
    collaboratorForm: {
      ...current,
      cpf: formattedCpf,
      fullName: current.cpf === formattedCpf ? current.fullName : '',
      contact: current.cpf === formattedCpf ? current.contact : '',
      pixKey: current.cpf === formattedCpf ? current.pixKey : '',
      functions: current.cpf === formattedCpf ? current.functions : [],
      primaryFunction: current.cpf === formattedCpf ? current.primaryFunction : '',
    },
    collaboratorLookupFeedback:
      cpfDigitsLength === 11 ? 'CPF nao encontrado em outras empresas. Cadastre os dados deste colaborador.' : '',
  }
}
