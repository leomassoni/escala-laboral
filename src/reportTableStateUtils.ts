export function toggleVisibleReportColumn<
  TReportId extends string,
>(
  current: Partial<Record<TReportId, string[]>>,
  selectedReportId: TReportId,
  allColumnKeys: string[],
  columnKey: string,
) {
  const currentKeys = current[selectedReportId] ?? allColumnKeys
  const hasColumn = currentKeys.includes(columnKey)
  if (hasColumn && currentKeys.length === 1) {
    return current
  }

  const nextKeys = hasColumn
    ? currentKeys.filter((key) => key !== columnKey)
    : [...currentKeys, columnKey]

  return {
    ...current,
    [selectedReportId]: allColumnKeys.filter((key) => nextKeys.includes(key)),
  }
}

export function showVisibleReportColumn<
  TReportId extends string,
>(
  current: Partial<Record<TReportId, string[]>>,
  selectedReportId: TReportId,
  allColumnKeys: string[],
  columnKey: string,
) {
  const baseKeys = current[selectedReportId] ?? allColumnKeys
  if (baseKeys.includes(columnKey)) {
    return current
  }

  const nextKeys = allColumnKeys.filter((key) => key === columnKey || baseKeys.includes(key))

  return {
    ...current,
    [selectedReportId]: nextKeys,
  }
}

export function toggleReportColumnFilterSelection<
  TReportId extends string,
>(
  current: Partial<Record<TReportId, Record<string, string[]>>>,
  selectedReportId: TReportId,
  columnKey: string,
  value: string,
) {
  const currentReportFilters = current[selectedReportId] ?? {}
  const currentValues = currentReportFilters[columnKey] ?? []
  const nextValues = currentValues.includes(value)
    ? currentValues.filter((item) => item !== value)
    : [...currentValues, value]

  return {
    ...current,
    [selectedReportId]: {
      ...currentReportFilters,
      [columnKey]: nextValues,
    },
  }
}

export function clearReportColumnFilterSelection<
  TReportId extends string,
>(
  current: Partial<Record<TReportId, Record<string, string[]>>>,
  selectedReportId: TReportId,
  columnKey: string,
) {
  const currentReportFilters = current[selectedReportId] ?? {}

  return {
    ...current,
    [selectedReportId]: {
      ...currentReportFilters,
      [columnKey]: [],
    },
  }
}

export function resetReportTableVisibleColumns<
  TReportId extends string,
>(
  current: Partial<Record<TReportId, string[]>>,
  selectedReportId: TReportId,
  allColumnKeys: string[],
) {
  return {
    ...current,
    [selectedReportId]: allColumnKeys,
  }
}

export function resetReportTableFilters<
  TReportId extends string,
>(
  current: Partial<Record<TReportId, Record<string, string[]>>>,
  selectedReportId: TReportId,
) {
  return {
    ...current,
    [selectedReportId]: {},
  }
}
