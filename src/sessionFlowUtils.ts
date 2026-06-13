type SystemAdminLike = {
  username: string
  password: string
}

type CompanyLike = {
  id: number
  status: 'ATIVA' | 'INATIVA'
  tradeName: string
}

type MembershipLike = {
  companyId: number
  fullName: string
  username: string
  role: string
}

export function findSystemAdminByCredentials<T extends SystemAdminLike>(
  systemAdmins: T[],
  username: string,
  password: string,
) {
  return systemAdmins.find(
    (item) => item.username === username.trim() && item.password === password,
  ) ?? null
}

export function getActiveCompanyUserMemberships<T extends MembershipLike>(
  memberships: T[],
  companies: CompanyLike[],
) {
  return memberships.filter((item) => {
    const targetCompany = companies.find((company) => company.id === item.companyId)
    return targetCompany?.status === 'ATIVA'
  })
}

export function findCompanyById<T extends { id: number }>(companies: T[], companyId: number) {
  return companies.find((item) => item.id === companyId) ?? null
}

export function resolveCompanyLoginResult<T extends MembershipLike, TCompany extends CompanyLike>(
  memberships: T[],
  companies: TCompany[],
) {
  if (memberships.length === 0) {
    return {
      primaryMembership: null,
      targetCompany: null,
      nextCompanyId: null,
      requiresCompanySelection: false,
    }
  }

  const [primaryMembership] = memberships
  const targetCompany = companies.find((item) => item.id === primaryMembership.companyId) ?? null

  return {
    primaryMembership,
    targetCompany,
    nextCompanyId: memberships.length === 1 ? primaryMembership.companyId : null,
    requiresCompanySelection: memberships.length > 1,
  }
}
