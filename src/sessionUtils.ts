export function buildCompanyUserAccessKey(user: Pick<{ fullName: string; username: string; password: string }, 'fullName' | 'username' | 'password'>) {
  return [
    user.username.trim().toLowerCase(),
    user.password,
    user.fullName.trim().toLowerCase(),
  ].join('::')
}

export function getCompanyUserMembershipsForUser<
  T extends {
    isActive: boolean
    companyId: number
    fullName: string
    username: string
    password: string
  },
>(users: T[], user: T) {
  const accessKey = buildCompanyUserAccessKey(user)
  return users
    .filter((item) => item.isActive && buildCompanyUserAccessKey(item) === accessKey)
    .sort((left, right) => left.companyId - right.companyId)
}

export function getCompanyUserMembershipsFromCredentials<
  T extends {
    isActive: boolean
    companyId: number
    fullName: string
    username: string
    password: string
  },
>(users: T[], username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase()
  const matchingUsers = users.filter(
    (item) => item.isActive && item.username.trim().toLowerCase() === normalizedUsername && item.password === password,
  )

  if (matchingUsers.length === 0) {
    return [] as T[]
  }

  const groupedMemberships = new Map<string, T[]>()

  matchingUsers.forEach((item) => {
    const accessKey = buildCompanyUserAccessKey(item)
    const current = groupedMemberships.get(accessKey) ?? []
    current.push(item)
    groupedMemberships.set(accessKey, current)
  })

  return Array.from(groupedMemberships.values())
    .sort((left, right) => right.length - left.length)
    .map((group) => group.sort((left, right) => left.companyId - right.companyId))[0] ?? []
}

export function areMembershipListsEqual<
  T extends {
    id: number
    companyId: number
    fullName: string
    username: string
    password: string
    role: string
    linkedCollaboratorId: number | null
    isActive: boolean
    sectors: string[]
  },
>(left: T[], right: T[]) {
  if (left.length !== right.length) {
    return false
  }

  return left.every((item, index) => {
    const other = right[index]
    return (
      item.id === other.id &&
      item.companyId === other.companyId &&
      item.fullName === other.fullName &&
      item.username === other.username &&
      item.password === other.password &&
      item.role === other.role &&
      item.linkedCollaboratorId === other.linkedCollaboratorId &&
      item.isActive === other.isActive &&
      item.sectors.join('|') === other.sectors.join('|')
    )
  })
}

export function getSectorNamesForCompany<T extends { companyId: number; name: string }>(sectors: T[], companyId: number) {
  return Array.from(
    new Set(
      sectors
        .filter((item) => item.companyId === companyId)
        .map((item) => item.name),
    ),
  ).sort((left, right) => left.localeCompare(right))
}
