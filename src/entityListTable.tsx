import { useEffect, useMemo, useState } from 'react'
import type { DragEvent, ReactNode } from 'react'

type EntityListColumn<Row> = {
  key: string
  label: string
  getValue: (row: Row) => string
  renderCell?: (row: Row) => ReactNode
}

type SortState = {
  columnKey: string
  direction: 'asc' | 'desc'
}

type EntityListTableProps<Row extends { id: number }> = {
  title: string
  rows: Row[]
  columns: EntityListColumn<Row>[]
  searchTerm: string
  onSearchTermChange: (value: string) => void
  columnOrder: string[]
  onColumnOrderChange: (value: string[]) => void
  emptyMessage: string
  exportFileName: string
  renderActions?: (row: Row) => ReactNode
}

export function EntityListTable<Row extends { id: number }>({
  title,
  rows,
  columns,
  searchTerm,
  onSearchTermChange,
  columnOrder,
  onColumnOrderChange,
  emptyMessage,
  exportFileName,
  renderActions,
}: EntityListTableProps<Row>) {
  const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null)
  const [sortState, setSortState] = useState<SortState | null>(null)
  const [columnFilters, setColumnFilters] = useState<Record<string, string[]>>({})
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() => columns.map((column) => column.key))
  const [draggedColumnKey, setDraggedColumnKey] = useState<string | null>(null)

  useEffect(() => {
    const availableKeys = new Set(columns.map((column) => column.key))

    setVisibleColumnKeys((current) => {
      const preserved = current.filter((columnKey) => availableKeys.has(columnKey))
      const missing = columns
        .map((column) => column.key)
        .filter((columnKey) => !preserved.includes(columnKey))
      return [...preserved, ...missing]
    })

    setColumnFilters((current) =>
      Object.fromEntries(Object.entries(current).filter(([columnKey]) => availableKeys.has(columnKey))),
    )

    setSortState((current) =>
      current && availableKeys.has(current.columnKey) ? current : null,
    )

    setOpenColumnMenu((current) => (current && availableKeys.has(current) ? current : null))
  }, [columns])

  useEffect(() => {
    if (openColumnMenu === null) {
      return
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target
      if (!(target instanceof Element)) {
        return
      }

      if (target.closest('.entity-column-menu') || target.closest('.entity-column-menu-trigger')) {
        return
      }

      setOpenColumnMenu(null)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpenColumnMenu(null)
      }
    }

    window.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [openColumnMenu])

  const orderedColumns = useMemo(() => {
    const fallbackOrder = columns.map((column) => column.key)
    const resolvedOrder = columnOrder.length > 0 ? columnOrder : fallbackOrder
    const keyedColumns = new Map(columns.map((column) => [column.key, column]))
    const ordered = resolvedOrder
      .map((columnKey) => keyedColumns.get(columnKey) ?? null)
      .filter((column): column is EntityListColumn<Row> => column !== null)

    for (const column of columns) {
      if (!ordered.some((item) => item.key === column.key)) {
        ordered.push(column)
      }
    }

    return ordered
  }, [columnOrder, columns])

  const visibleColumns = useMemo(
    () => orderedColumns.filter((column) => visibleColumnKeys.includes(column.key)),
    [orderedColumns, visibleColumnKeys],
  )

  const hiddenColumns = useMemo(
    () => orderedColumns.filter((column) => !visibleColumnKeys.includes(column.key)),
    [orderedColumns, visibleColumnKeys],
  )

  const distinctValuesByColumn = useMemo(
    () =>
      Object.fromEntries(
        orderedColumns.map((column) => [
          column.key,
          Array.from(
            new Set(
              rows
                .map((row) => column.getValue(row).trim())
                .filter((value) => value.length > 0),
            ),
          ).sort((left, right) => left.localeCompare(right, 'pt-BR', { sensitivity: 'base' })),
        ]),
      ) as Record<string, string[]>,
    [orderedColumns, rows],
  )

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const filteredRows = useMemo(() => {
    const baseRows = rows.filter((row) => {
      const matchesGlobalSearch =
        normalizedSearch.length === 0 ||
        orderedColumns.some((column) => column.getValue(row).toLowerCase().includes(normalizedSearch))

      if (!matchesGlobalSearch) {
        return false
      }

      return orderedColumns.every((column) => {
        const selectedValues = columnFilters[column.key] ?? []
        if (selectedValues.length === 0) {
          return true
        }

        return selectedValues.includes(column.getValue(row).trim())
      })
    })

    if (!sortState) {
      return baseRows
    }

    const sortColumn = orderedColumns.find((column) => column.key === sortState.columnKey)
    if (!sortColumn) {
      return baseRows
    }

    return [...baseRows].sort((left, right) => {
      const leftValue = sortColumn.getValue(left)
      const rightValue = sortColumn.getValue(right)
      const comparison = leftValue.localeCompare(rightValue, 'pt-BR', {
        sensitivity: 'base',
        numeric: true,
      })

      if (comparison === 0) {
        return left.id - right.id
      }

      return sortState.direction === 'asc' ? comparison : -comparison
    })
  }, [columnFilters, normalizedSearch, orderedColumns, rows, sortState])

  function reorderColumns(sourceColumnKey: string, targetColumnKey: string) {
    if (sourceColumnKey === targetColumnKey) {
      return
    }

    const currentOrder = orderedColumns.map((column) => column.key)
    const sourceIndex = currentOrder.indexOf(sourceColumnKey)
    const targetIndex = currentOrder.indexOf(targetColumnKey)

    if (sourceIndex < 0 || targetIndex < 0) {
      return
    }

    const nextOrder = [...currentOrder]
    const [movedColumnKey] = nextOrder.splice(sourceIndex, 1)
    nextOrder.splice(targetIndex, 0, movedColumnKey)
    onColumnOrderChange(nextOrder)
  }

  function handleHeaderDragStart(event: DragEvent<HTMLTableCellElement>, columnKey: string) {
    setDraggedColumnKey(columnKey)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', columnKey)
  }

  function handleHeaderDrop(event: DragEvent<HTMLTableCellElement>, targetColumnKey: string) {
    event.preventDefault()
    const sourceColumnKey = draggedColumnKey ?? event.dataTransfer.getData('text/plain')
    setDraggedColumnKey(null)

    if (!sourceColumnKey) {
      return
    }

    reorderColumns(sourceColumnKey, targetColumnKey)
  }

  function toggleColumnValueFilter(columnKey: string, value: string) {
    setColumnFilters((current) => {
      const selectedValues = current[columnKey] ?? []
      const nextValues = selectedValues.includes(value)
        ? selectedValues.filter((item) => item !== value)
        : [...selectedValues, value]

      if (nextValues.length === 0) {
        const { [columnKey]: _removed, ...rest } = current
        void _removed
        return rest
      }

      return {
        ...current,
        [columnKey]: nextValues,
      }
    })
  }

  function clearColumnFilter(columnKey: string) {
    setColumnFilters((current) => {
      const { [columnKey]: _removed, ...rest } = current
      void _removed
      return rest
    })
  }

  function hideColumn(columnKey: string) {
    if (visibleColumnKeys.length <= 1) {
      return
    }

    setVisibleColumnKeys((current) => current.filter((item) => item !== columnKey))
    setOpenColumnMenu((current) => (current === columnKey ? null : current))
  }

  function showColumn(columnKey: string) {
    setVisibleColumnKeys((current) => {
      if (current.includes(columnKey)) {
        return current
      }

      const nextVisible = orderedColumns
        .map((column) => column.key)
        .filter((key) => key === columnKey || current.includes(key))

      return nextVisible
    })
  }

  function setSort(columnKey: string, direction: 'asc' | 'desc') {
    setSortState({ columnKey, direction })
  }

  async function exportRows() {
    const XLSX = await import('xlsx')
    const aoa = [
      visibleColumns.map((column) => column.label),
      ...filteredRows.map((row) => visibleColumns.map((column) => column.getValue(row))),
    ]
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(aoa)
    XLSX.utils.book_append_sheet(workbook, worksheet, title)
    XLSX.writeFile(workbook, exportFileName)
  }

  return (
    <div className="entity-list-section">
      <div className="entity-list-toolbar">
        <label className="entity-search">
          <span>Pesquisar</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder={`Digite para filtrar ${title.toLowerCase()}`}
          />
        </label>
        <div className="entity-list-toolbar-meta">
          <span>{filteredRows.length} registro(s)</span>
          <button type="button" className="secondary-button" onClick={() => void exportRows()}>
            Exportar XLSX
          </button>
        </div>
      </div>

      {hiddenColumns.length > 0 ? (
        <div className="entity-hidden-columns">
          <strong>Colunas ocultas</strong>
          <div className="entity-hidden-column-list">
            {hiddenColumns.map((column) => (
              <button
                key={column.key}
                type="button"
                className="ghost-button entity-hidden-column-chip"
                onClick={() => showColumn(column.key)}
              >
                Exibir {column.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {filteredRows.length === 0 ? (
        <div className="empty-state">{emptyMessage}</div>
      ) : (
        <div className="entity-table-wrap">
          <table className="entity-table">
            <thead>
              <tr>
                {visibleColumns.map((column, index) => {
                  const selectedValues = columnFilters[column.key] ?? []
                  const columnSortState =
                    sortState?.columnKey === column.key ? sortState.direction : null

                  return (
                    <th
                      key={column.key}
                      draggable
                      onDragStart={(event) => handleHeaderDragStart(event, column.key)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleHeaderDrop(event, column.key)}
                      onDragEnd={() => setDraggedColumnKey(null)}
                      className={index === 0 ? 'entity-primary-cell entity-header-cell' : 'entity-header-cell'}
                    >
                      <div className="entity-column-header">
                        <strong>{column.label}</strong>
                        <div className="entity-column-header-actions">
                          {selectedValues.length > 0 ? (
                            <span className="entity-column-filter-count">{selectedValues.length}</span>
                          ) : null}
                          <button
                            type="button"
                            className="entity-column-menu-trigger"
                            onClick={() =>
                              setOpenColumnMenu((current) => (current === column.key ? null : column.key))
                            }
                            aria-label={`Abrir opcoes da coluna ${column.label}`}
                            title={`Abrir opcoes da coluna ${column.label}`}
                          >
                            ▼
                          </button>
                        </div>
                        {openColumnMenu === column.key ? (
                          <div className="entity-column-menu" onClick={(event) => event.stopPropagation()}>
                            <div className="entity-column-menu-actions">
                              <button type="button" className="ghost-button" onClick={() => setSort(column.key, 'asc')}>
                                Ordenar A-Z
                              </button>
                              <button type="button" className="ghost-button" onClick={() => setSort(column.key, 'desc')}>
                                Ordenar Z-A
                              </button>
                              <button type="button" className="ghost-button" onClick={() => clearColumnFilter(column.key)}>
                                Limpar filtro
                              </button>
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => setSortState((current) => (current?.columnKey === column.key ? null : current))}
                              >
                                Remover ordenacao
                              </button>
                              <button
                                type="button"
                                className="ghost-button"
                                onClick={() => hideColumn(column.key)}
                                disabled={visibleColumnKeys.length <= 1}
                              >
                                Ocultar coluna
                              </button>
                            </div>
                            <div className="entity-column-menu-values">
                              {columnSortState ? (
                                <span className="field-helper">
                                  Ordenacao ativa: {columnSortState === 'asc' ? 'A-Z' : 'Z-A'}
                                </span>
                              ) : null}
                              <strong>Filtrar valores</strong>
                              {distinctValuesByColumn[column.key]?.length ? (
                                distinctValuesByColumn[column.key].map((value) => (
                                  <label key={value} className="entity-column-filter-option">
                                    <input
                                      type="checkbox"
                                      checked={selectedValues.includes(value)}
                                      onChange={() => toggleColumnValueFilter(column.key, value)}
                                    />
                                    <span>{value}</span>
                                  </label>
                                ))
                              ) : (
                                <span className="field-helper">Sem valores distintos disponiveis.</span>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </th>
                  )
                })}
                {renderActions ? <th className="entity-actions-cell entity-header-cell">Acoes</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  {visibleColumns.map((column, index) => (
                    <td key={`${row.id}-${column.key}`} className={index === 0 ? 'entity-primary-cell' : undefined}>
                      {column.renderCell ? column.renderCell(row) : column.getValue(row)}
                    </td>
                  ))}
                  {renderActions ? <td className="entity-actions-cell">{renderActions(row)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
