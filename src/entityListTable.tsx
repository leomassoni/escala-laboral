import { useMemo } from 'react'
import type { ReactNode } from 'react'

type EntityListColumn<Row> = {
  key: string
  label: string
  getValue: (row: Row) => string
  renderCell?: (row: Row) => ReactNode
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

  const normalizedSearch = searchTerm.trim().toLowerCase()

  const filteredRows = useMemo(() => {
    if (!normalizedSearch) {
      return rows
    }

    return rows.filter((row) =>
      orderedColumns.some((column) =>
        column.getValue(row).toLowerCase().includes(normalizedSearch),
      ),
    )
  }, [normalizedSearch, orderedColumns, rows])

  function moveColumn(columnKey: string, direction: 'left' | 'right') {
    const currentOrder = orderedColumns.map((column) => column.key)
    const currentIndex = currentOrder.indexOf(columnKey)
    const targetIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1

    if (currentIndex <= 0 || targetIndex <= 0 || targetIndex >= currentOrder.length) {
      return
    }

    const nextOrder = [...currentOrder]
    ;[nextOrder[currentIndex], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[currentIndex]]
    onColumnOrderChange(nextOrder)
  }

  async function exportRows() {
    const XLSX = await import('xlsx')
    const aoa = [
      orderedColumns.map((column) => column.label),
      ...filteredRows.map((row) => orderedColumns.map((column) => column.getValue(row))),
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

      {filteredRows.length === 0 ? (
        <div className="empty-state">{emptyMessage}</div>
      ) : (
        <div className="entity-table-wrap">
          <table className="entity-table">
            <thead>
              <tr>
                {orderedColumns.map((column, index) => (
                  <th
                    key={column.key}
                    className={index === 0 ? 'entity-primary-cell entity-header-cell' : 'entity-header-cell'}
                  >
                    <div className="entity-column-header">
                      <strong>{column.label}</strong>
                      <div className="entity-column-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => moveColumn(column.key, 'left')}
                          disabled={index <= 1}
                          aria-label={`Mover coluna ${column.label} para a esquerda`}
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => moveColumn(column.key, 'right')}
                          disabled={index === 0 || index === orderedColumns.length - 1}
                          aria-label={`Mover coluna ${column.label} para a direita`}
                        >
                          →
                        </button>
                      </div>
                    </div>
                  </th>
                ))}
                {renderActions ? <th className="entity-actions-cell">Acoes</th> : null}
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  {orderedColumns.map((column, index) => (
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
