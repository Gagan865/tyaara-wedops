// Single locale layer for Tyaara.
// Money is stored as integer paise. Render EVERYWHERE via formatINR.

export function formatINR(paise, { withSymbol = true, compact = false } = {}) {
  if (paise === null || paise === undefined || paise === '' || isNaN(paise)) {
    return withSymbol ? '\u20B90' : '0'
  }
  const rupees = Number(paise) / 100
  // Keep the minus sign outside the symbol: "-\u20B915 L", not "\u20B9-15 L".
  const sign = rupees < 0 ? '-' : ''
  const symbol = withSymbol ? '\u20B9' : ''
  if (compact) {
    // Indian compact: 1L = 1,00,000  1Cr = 1,00,00,000
    const abs = Math.abs(rupees)
    if (abs >= 10000000) return sign + symbol + (abs / 10000000).toFixed(2).replace(/\.00$/, '') + ' Cr'
    if (abs >= 100000) return sign + symbol + (abs / 100000).toFixed(2).replace(/\.00$/, '') + ' L'
  }
  const abs = Math.abs(rupees)
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2
  }).format(abs)
  return sign + symbol + formatted
}

export function rupeesToPaise(rupees) {
  const n = Number(rupees)
  if (isNaN(n)) return 0
  return Math.round(n * 100)
}

export function paiseToRupees(paise) {
  return (Number(paise) || 0) / 100
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export function formatDate(input) {
  if (!input) return '—'
  // A bare YYYY-MM-DD is a calendar date, not an instant. `new Date('2026-08-05')`
  // parses it as UTC midnight, which renders as the previous day in any timezone
  // behind UTC. Read the parts directly so the date shown is the date stored.
  if (typeof input === 'string') {
    const m = input.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (m) {
      const [, y, mo, day] = m
      return `${day} ${MONTHS[Number(mo) - 1]} ${y}`
    }
  }
  const d = input instanceof Date ? input : new Date(input)
  if (isNaN(d.getTime())) return '—'
  return `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
}

export function daysBetween(a, b) {
  const d1 = a instanceof Date ? a : new Date(a)
  const d2 = b instanceof Date ? b : new Date(b)
  return Math.round((d2 - d1) / (1000 * 60 * 60 * 24))
}

export function daysUntil(target) {
  if (!target) return 0
  const now = new Date()
  const t = target instanceof Date ? target : new Date(target)
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tMid = new Date(t.getFullYear(), t.getMonth(), t.getDate())
  return Math.round((tMid - nowMid) / (1000 * 60 * 60 * 24))
}

export function toIsoDate(input) {
  if (!input) return null
  // Already a plain YYYY-MM-DD calendar date — pass through untouched.
  if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input
  const d = input instanceof Date ? input : new Date(input)
  if (isNaN(d.getTime())) return null
  // Use the LOCAL calendar date, not the UTC one. toISOString() converts to UTC first,
  // so for any timezone ahead of UTC (India is +5:30) a local midnight Date lands on the
  // previous day — a user picking 05 Aug had it stored as 04 Aug.
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
