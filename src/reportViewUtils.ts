export function getVisibleReportColumnKeys<
  TColumn extends { key: string },
  TReportId extends string,
>(
  selectedReportId: TReportId,
  visibleColumnsByReport: Partial<Record<TReportId, string[]>>,
  columns: TColumn[],
) {
  return visibleColumnsByReport[selectedReportId] ?? columns.map((column) => column.key)
}

export function splitReportColumnsByVisibility<TColumn extends { key: string }>(
  columns: TColumn[],
  visibleKeys: string[],
) {
  return {
    visibleColumns: columns.filter((column) => visibleKeys.includes(column.key)),
    hiddenColumns: columns.filter((column) => !visibleKeys.includes(column.key)),
  }
}

export function getReportColumnDistinctValues<
  TColumn extends { key: string },
  TRow extends Record<string, string | number>,
>(
  columns: TColumn[],
  rows: TRow[],
) {
  return Object.fromEntries(
    columns.map((column) => [
      column.key,
      Array.from(new Set(rows.map((row) => String(row[column.key] ?? '')))).sort((left, right) =>
        left.localeCompare(right),
      ),
    ]),
  ) as Record<string, string[]>
}

export function filterReportRows<
  TColumn extends { key: string },
  TRow extends Record<string, string | number>,
>(
  columns: TColumn[],
  rows: TRow[],
  columnFilters: Record<string, string[]>,
) {
  return rows.filter((row) => {
    return columns.every((column) => {
      const selectedValues = columnFilters[column.key] ?? []
      if (selectedValues.length === 0) {
        return true
      }

      return selectedValues.includes(String(row[column.key] ?? ''))
    })
  })
}

export function getReportPreviewRows<TRow>(rows: TRow[], size = 24) {
  return rows.slice(0, size)
}
