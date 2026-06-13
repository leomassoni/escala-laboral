type CompanyLike = {
  id: number
  collectiveProfile: string
  defaultScaleViewMode?: string
  defaultReportId?: string
  defaultPrintIncludeExtras?: boolean
  allowPastScaleEdits?: boolean
}

type CollaboratorLike = {
  companyId: number
  functions: string[]
  primaryFunction: string
}

type FunctionLike = {
  id: number
  companyId: number
  name: string
}

export function updateCompanyCollectiveProfileInCollection<T extends CompanyLike>(
  current: T[],
  companyId: number,
  collectiveProfile: T['collectiveProfile'],
) {
  return current.map((item) =>
    item.id === companyId
      ? {
          ...item,
          collectiveProfile,
        }
      : item,
  )
}

export function updateCompanyOperationalSettingsInCollection<
  T extends CompanyLike,
>(
  current: T[],
  companyId: number,
  updates: Partial<
    Pick<T, 'defaultScaleViewMode' | 'defaultReportId' | 'defaultPrintIncludeExtras' | 'allowPastScaleEdits'>
  >,
) {
  return current.map((item) =>
    item.id === companyId
      ? {
          ...item,
          ...updates,
        }
      : item,
  )
}

export function removeFunctionFromCollaborators<T extends CollaboratorLike>(
  current: T[],
  targetFunction: Pick<FunctionLike, 'companyId' | 'name'>,
) {
  return current.map((item) => {
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
  })
}
