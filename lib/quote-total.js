// The ONE place quotation maths lives. Every screen and the PDF import from here — never
// reimplement it. Pure (no DB), so tests/quote-total.test.mjs can exercise it directly.
//
// GST is never touched: all amounts are GST-inclusive and the total is a plain sum.
//
// Shape expected:
//   quotation = {
//     groups: [{ id, kind: 'items'|'options', label, selected_line_id }],
//     lines:  [{ id, group_id, bucket, amount_paise, cost_paise }],
//     adders: [{ label, bucket|null, amount_paise, cost_paise }]
//   }
//
// total = sum(amount of lines in 'items' groups)
//       + for each 'options' group: the selected line, or — if none selected — one total
//         per COMBINATION across all unselected options groups
//       + sum(amount of all adders)
// margin = total - sum(all cost_paise, null treated as 0)

export const QUOTE_BUCKETS = ['decor', 'lighting', 'furniture', 'sounds', 'sfx_other']

export const BUCKET_LABELS = {
  decor: 'Decor',
  lighting: 'Lighting',
  furniture: 'Furniture',
  sounds: 'Sounds',
  sfx_other: 'SFX / Others'
}

const num = (v) => Number(v || 0)

export function computeQuoteTotals(quotation) {
  const groups = quotation?.groups || []
  const lines = quotation?.lines || []
  const adders = quotation?.adders || []
  const groupById = Object.fromEntries(groups.map((g) => [g.id, g]))

  const itemLines = lines.filter((l) => (groupById[l.group_id]?.kind || 'items') !== 'options')
  const optionGroups = groups.filter((g) => g.kind === 'options')

  // One "dimension" per options group. If a variant is selected, that dimension is fixed to
  // it; otherwise every variant is a possible column.
  const dims = optionGroups.map((g) => {
    const variants = lines
      .filter((l) => l.group_id === g.id)
      .sort((a, b) => num(a.display_order) - num(b.display_order))
    const selected = g.selected_line_id ? variants.filter((v) => v.id === g.selected_line_id) : []
    return { group: g, variants: selected.length ? selected : variants }
  })

  // Cartesian product across the option dimensions.
  let combos = [[]]
  for (const dim of dims) {
    const next = []
    for (const combo of combos) {
      // An options group with no variants at all contributes nothing (keeps the combo).
      if (dim.variants.length === 0) { next.push(combo); continue }
      for (const v of dim.variants) next.push([...combo, { group: dim.group, variant: v }])
    }
    combos = next
  }

  const combinations = combos.map((combo) => {
    const buckets = Object.fromEntries(QUOTE_BUCKETS.map((b) => [b, 0]))
    const bucketCost = Object.fromEntries(QUOTE_BUCKETS.map((b) => [b, 0]))

    for (const l of itemLines) {
      buckets[l.bucket] = (buckets[l.bucket] || 0) + num(l.amount_paise)
      bucketCost[l.bucket] = (bucketCost[l.bucket] || 0) + num(l.cost_paise)
    }
    // Adders with a bucket fold into that bucket row; bucket-less adders (Labour,
    // Transportation) become their own summary rows.
    const extraRows = []
    for (const a of adders) {
      if (a.bucket) {
        buckets[a.bucket] = (buckets[a.bucket] || 0) + num(a.amount_paise)
        bucketCost[a.bucket] = (bucketCost[a.bucket] || 0) + num(a.cost_paise)
      } else {
        extraRows.push({ label: a.label, amount_paise: num(a.amount_paise), cost_paise: num(a.cost_paise) })
      }
    }
    for (const c of combo) {
      buckets[c.variant.bucket] = (buckets[c.variant.bucket] || 0) + num(c.variant.amount_paise)
      bucketCost[c.variant.bucket] = (bucketCost[c.variant.bucket] || 0) + num(c.variant.cost_paise)
    }

    const total = QUOTE_BUCKETS.reduce((s, b) => s + buckets[b], 0) + extraRows.reduce((s, r) => s + r.amount_paise, 0)
    const cost = QUOTE_BUCKETS.reduce((s, b) => s + bucketCost[b], 0) + extraRows.reduce((s, r) => s + r.cost_paise, 0)

    return {
      picks: combo.map((c) => ({
        groupId: c.group.id,
        groupLabel: c.group.label,
        lineId: c.variant.id,
        lineLabel: c.variant.element,
        amount_paise: num(c.variant.amount_paise)
      })),
      label: combo.map((c) => c.variant.element).join(' + ') || 'Total',
      buckets,
      bucketCost,
      extraRows,
      total_paise: total,
      cost_paise: cost,
      margin_paise: total - cost
    }
  })

  const single = combinations.length === 1
  return {
    combinations,
    // Convenience: populated only when there is exactly one combination (all options
    // selected, or no options groups). Null when the client still has parallel choices.
    total_paise: single ? combinations[0].total_paise : null,
    cost_paise: single ? combinations[0].cost_paise : null,
    margin_paise: single ? combinations[0].margin_paise : null
  }
}
