// Shared CSV export used by the client and venue trackers.
//
// Produces a file that opens cleanly in Excel and Google Sheets with no extra library:
//   - a UTF-8 BOM so Excel renders ₹ and Indian names correctly instead of mojibake
//   - every field quoted, with embedded double-quotes escaped by doubling
//   - CSV-injection guard: any value starting with = + - or @ is prefixed with a single
//     quote so Excel does not execute it as a formula when the file is opened
//   - money is exported as plain rupees (e.g. 132000.00), never the formatted ₹ string,
//     so the column stays numeric in the spreadsheet
//
// Money columns: pass the rupee number (paiseToRupees(...)) as the cell value and set
// `money: true` on the column so it is emitted with two decimals and left un-escaped.

import { toIsoDate } from '@/lib/format'

const BOM = '﻿'

function escapeCell(value) {
  const s = value === null || value === undefined ? '' : String(value)
  // Prevent CSV formula injection in Excel/Sheets.
  const guarded = /^[=+\-@]/.test(s) ? `'${s}` : s
  // Quote always; escape embedded quotes by doubling them.
  return `"${guarded.replace(/"/g, '""')}"`
}

// columns: [{ header, value: (row) => any, money?: boolean }]
export function rowsToCsv(columns, rows) {
  const headerLine = columns.map(c => escapeCell(c.header)).join(',')
  const dataLines = rows.map(row =>
    columns.map(c => {
      const raw = c.value(row)
      if (c.money) {
        // Plain numeric rupees with two decimals — quoted numerics still parse as
        // numbers in Excel, and there is no leading = + - @ to guard against.
        const n = Number(raw)
        return escapeCell(Number.isFinite(n) ? n.toFixed(2) : '0.00')
      }
      return escapeCell(raw)
    }).join(',')
  )
  return BOM + [headerLine, ...dataLines].join('\r\n')
}

// Triggers a browser download named like `clients-2026-08-07.csv`.
export function downloadCsv(baseName, columns, rows) {
  const csv = rowsToCsv(columns, rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${baseName}-${toIsoDate(new Date())}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
