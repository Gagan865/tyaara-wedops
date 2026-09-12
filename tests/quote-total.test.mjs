import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeQuoteTotals } from '../lib/quote-total.js'

// Rebuilds the reference quotation (Mr Rakesh Raju / Kalpavruksha) in paise and asserts the
// three Mantap totals: 7,70,700 / 8,12,700 / 9,28,700.
//
// Bucket breakdown that reconciles to those totals (see the brief's arithmetic):
//   Decor item lines          3,98,100   (Reception + Wedding + Flower, decor bucket)
//   Lighting item lines          50,600
//   Furniture item lines         70,000
//   Mantap option (decor)   1,82,000 / 2,24,000 / 3,40,000
//   Sounds adder (bucket=sounds) 25,000
//   Labour adder (no bucket)     25,000
//   Transportation adder         20,000
//   → 3,98,100 + 50,600 + 70,000 + <mantap> + 25,000 + 25,000 + 20,000
//     = 5,88,700 + <mantap>  =>  7,70,700 / 8,12,700 / 9,28,700
const R = (rupees) => rupees * 100

function referenceQuote({ selectMantap = null } = {}) {
  const groups = [
    { id: 'g_recep', kind: 'items', label: 'Reception - 70% Artificial *30% Original' },
    { id: 'g_wed', kind: 'items', label: 'Wedding 100% Original' },
    { id: 'g_flower', kind: 'items', label: 'Flower Requirements' },
    { id: 'g_mantap', kind: 'options', label: 'Mantap Options', selected_line_id: selectMantap }
  ]
  const lines = [
    // Decor item lines total 3,98,100
    { id: 'l1', group_id: 'g_recep', bucket: 'decor', amount_paise: R(250000), cost_paise: R(160000), display_order: 1 },
    { id: 'l2', group_id: 'g_wed', bucket: 'decor', amount_paise: R(100000), cost_paise: R(70000), display_order: 1 },
    { id: 'l3', group_id: 'g_flower', bucket: 'decor', amount_paise: R(48100), cost_paise: R(30000), display_order: 1 },
    // Lighting 50,600
    { id: 'l4', group_id: 'g_recep', bucket: 'lighting', amount_paise: R(50600), cost_paise: R(30000), display_order: 2 },
    // Furniture 70,000
    { id: 'l5', group_id: 'g_recep', bucket: 'furniture', amount_paise: R(70000), cost_paise: R(45000), display_order: 3 },
    // Mantap options (decor bucket)
    { id: 'm1', group_id: 'g_mantap', bucket: 'decor', amount_paise: R(182000), cost_paise: R(120000), display_order: 1, element: 'Mantap 1' },
    { id: 'm2', group_id: 'g_mantap', bucket: 'decor', amount_paise: R(224000), cost_paise: R(150000), display_order: 2, element: 'Mantap 2' },
    { id: 'm3', group_id: 'g_mantap', bucket: 'decor', amount_paise: R(340000), cost_paise: R(230000), display_order: 3, element: 'Mantap 3' }
  ]
  const adders = [
    { label: 'Sounds', bucket: 'sounds', amount_paise: R(25000), cost_paise: R(15000), display_order: 1 },
    { label: 'Labour', bucket: null, amount_paise: R(25000), cost_paise: R(0), display_order: 2 },
    { label: 'Transportation', bucket: null, amount_paise: R(20000), cost_paise: R(0), display_order: 3 }
  ]
  return { groups, lines, adders }
}

test('unselected Mantap produces three parallel totals: 7,70,700 / 8,12,700 / 9,28,700', () => {
  const { combinations, total_paise } = computeQuoteTotals(referenceQuote())
  assert.equal(combinations.length, 3, 'three Mantap options -> three combinations')
  assert.equal(total_paise, null, 'no single total while a choice is pending')
  const totals = combinations.map((c) => c.total_paise).sort((a, b) => a - b)
  assert.deepEqual(totals, [R(770700), R(812700), R(928700)])
})

test('selecting Mantap 1 collapses to a single total of 7,70,700', () => {
  const r = computeQuoteTotals(referenceQuote({ selectMantap: 'm1' }))
  assert.equal(r.combinations.length, 1)
  assert.equal(r.total_paise, R(770700))
})

test('selecting Mantap 2 -> 8,12,700; Mantap 3 -> 9,28,700', () => {
  assert.equal(computeQuoteTotals(referenceQuote({ selectMantap: 'm2' })).total_paise, R(812700))
  assert.equal(computeQuoteTotals(referenceQuote({ selectMantap: 'm3' })).total_paise, R(928700))
})

test('margin = total - sum(cost), null cost treated as 0', () => {
  const r = computeQuoteTotals(referenceQuote({ selectMantap: 'm1' }))
  // costs: 160000+70000+30000+30000+45000 (items) +120000 (m1) +15000 (sounds) +0+0 = 470000
  assert.equal(r.cost_paise, R(470000))
  assert.equal(r.margin_paise, R(770700) - R(470000))
})

test('a bucket-less adder with null cost does not throw and counts as 0 cost', () => {
  const q = {
    groups: [{ id: 'g', kind: 'items', label: 'X' }],
    lines: [{ id: 'l', group_id: 'g', bucket: 'decor', amount_paise: R(1000), cost_paise: null }],
    adders: [{ label: 'Labour', bucket: null, amount_paise: R(500), cost_paise: null }]
  }
  const r = computeQuoteTotals(q)
  assert.equal(r.total_paise, R(1500))
  assert.equal(r.cost_paise, 0)
  assert.equal(r.margin_paise, R(1500))
})

test('empty quotation totals to zero, one combination', () => {
  const r = computeQuoteTotals({ groups: [], lines: [], adders: [] })
  assert.equal(r.combinations.length, 1)
  assert.equal(r.total_paise, 0)
})
