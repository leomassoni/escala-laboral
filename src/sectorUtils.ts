type SectorLike = {
  id: number
  companyId: number
  name: string
}

type UserFormWithSectors = {
  sectors: string[]
}

export function ensureCompanySectorInCollection<T extends SectorLike>(
  current: T[],
  companyId: number,
  sectorName: string,
) {
  const trimmedSector = sectorName.trim()
  if (!trimmedSector) {
    return current
  }

  const alreadyExists = current.some(
    (item) =>
      item.companyId === companyId &&
      item.name.trim().toLowerCase() === trimmedSector.toLowerCase(),
  )

  if (alreadyExists) {
    return current
  }

  return [
    ...current,
    {
      id: current.reduce((max, item) => Math.max(max, item.id), 0) + 1,
      companyId,
      name: trimmedSector,
    } as T,
  ]
}

export function resolveCompanySectorName<T extends SectorLike>(
  sectors: T[],
  companyId: number,
  sectorName: string,
) {
  const trimmedSector = sectorName.trim()
  if (!trimmedSector) {
    return ''
  }

  const existingSector = sectors.find(
    (item) =>
      item.companyId === companyId &&
      item.name.trim().toLowerCase() === trimmedSector.toLowerCase(),
  )

  return existingSector?.name ?? trimmedSector
}

export function toggleUserSectorSelection<T extends UserFormWithSectors>(
  current: T,
  sectorName: string,
) {
  const exists = current.sectors.includes(sectorName)
  return {
    ...current,
    sectors: exists
      ? current.sectors.filter((item) => item !== sectorName)
      : [...current.sectors, sectorName],
  }
}

export function addResolvedSectorToUserForm<T extends UserFormWithSectors>(
  current: T,
  resolvedSector: string,
) {
  return {
    ...current,
    sectors: current.sectors.includes(resolvedSector)
      ? current.sectors
      : [...current.sectors, resolvedSector],
  }
}
