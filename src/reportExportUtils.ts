export type ExportableReportColumn = {
  key: string
  label: string
  align?: 'left' | 'center' | 'right'
}

export type ExportableReportDataset = {
  title: string
  filenameSuffix: string
  summary: Array<{ label: string; value: string }>
}

export function buildReportWorksheetRows(args: {
  companyTradeName: string
  periodLabel: string
  dataset: ExportableReportDataset
  visibleColumns: ExportableReportColumn[]
  filteredRows: Array<Record<string, string | number>>
}) {
  return [
    [args.dataset.title],
    [`Empresa: ${args.companyTradeName}`],
    [`Periodo: ${args.periodLabel}`],
    [],
    ['Resumo'],
    ...args.dataset.summary.map((item) => [item.label, item.value]),
    ['Linhas filtradas', String(args.filteredRows.length)],
    [],
    args.visibleColumns.map((column) => column.label),
    ...args.filteredRows.map((row) => args.visibleColumns.map((column) => row[column.key] ?? '')),
  ] as Array<Array<string | number>>
}

export function buildReportPrintHtml(args: {
  documentTitle: string
  companyTradeName: string
  periodLabel: string
  mode: 'print' | 'pdf'
  dataset: ExportableReportDataset
  visibleColumns: ExportableReportColumn[]
  filteredRows: Array<Record<string, string | number>>
  escapeHtml: (value: string) => string
}) {
  const { escapeHtml } = args

  return `<!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <title>${escapeHtml(args.documentTitle)}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #1f1713; }
            h1, h2 { margin: 0 0 8px; }
            p { margin: 0 0 8px; }
            .meta { margin-bottom: 18px; color: #5d514a; }
            .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin: 20px 0; }
            .summary-card { border: 1px solid #d9c5b3; border-radius: 10px; padding: 12px; }
            .summary-card strong { display: block; margin-top: 6px; }
            table { width: 100%; border-collapse: collapse; margin-top: 18px; font-size: 12px; }
            th, td { border: 1px solid #d9c5b3; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f6e8d9; }
            .right { text-align: right; }
            .center { text-align: center; }
            @media print { body { margin: 12mm; } }
          </style>
        </head>
        <body>
          <h1>${escapeHtml(args.dataset.title)}</h1>
          <p class="meta"><strong>Empresa:</strong> ${escapeHtml(args.companyTradeName)} | <strong>Periodo:</strong> ${escapeHtml(
            args.periodLabel,
          )} | <strong>Destino:</strong> ${args.mode === 'pdf' ? 'Salvar como PDF' : 'Impressao'}</p>
          <section class="summary">
            ${args.dataset.summary
              .map(
                (item) =>
                  `<div class="summary-card"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(
                    item.value,
                  )}</strong></div>`,
              )
              .join('')}
          </section>
          <table>
            <thead>
              <tr>
                ${args.visibleColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${args.filteredRows
                .map(
                  (row) =>
                    `<tr>${args.visibleColumns
                      .map((column) => {
                        const value = row[column.key] ?? ''
                        const className =
                          column.align === 'right' ? 'right' : column.align === 'center' ? 'center' : ''
                        return `<td class="${className}">${escapeHtml(String(value))}</td>`
                      })
                      .join('')}</tr>`,
                )
                .join('')}
            </tbody>
          </table>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>`
}
