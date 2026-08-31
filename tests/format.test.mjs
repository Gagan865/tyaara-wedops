// Regression tests for lib/format.js
//
// Run with:  node --test tests/format.test.mjs
// Or across timezones:
//   for tz in Asia/Kolkata America/Los_Angeles UTC; do TZ=$tz node --test tests/format.test.mjs; done
//
// These cover two shipped bugs:
//   1. toIsoDate() used toISOString(), so a local-midnight Date in any timezone ahead of
//      UTC (India is +5:30) was stored as the PREVIOUS day.
//   2. formatDate() parsed a bare 'YYYY-MM-DD' as UTC midnight, so it rendered as the
//      previous day in any timezone behind UTC.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  formatINR, toIsoDate, paiseToRupees, rupeesToPaise,
  formatDate, daysUntil, daysBetween
} from '../lib/format.js'

test('toIsoDate keeps the local calendar date', () => {
  assert.equal(toIsoDate(new Date(2026, 7, 5)), '2026-08-05')
  assert.equal(toIsoDate(new Date(2027, 0, 1)), '2027-01-01')
  assert.equal(toIsoDate(new Date(2026, 11, 31)), '2026-12-31')
})

test('toIsoDate passes through an existing YYYY-MM-DD unchanged', () => {
  assert.equal(toIsoDate('2026-12-31'), '2026-12-31')
})

test('toIsoDate handles empty and invalid input', () => {
  assert.equal(toIsoDate(null), null)
  assert.equal(toIsoDate(undefined), null)
  assert.equal(toIsoDate(''), null)
  assert.equal(toIsoDate('garbage'), null)
})

test('formatDate renders a stored date as-is, regardless of timezone', () => {
  assert.equal(formatDate('2026-08-05'), '05 Aug 2026')
  assert.equal(formatDate('2026-01-01'), '01 Jan 2026')
  assert.equal(formatDate('2026-12-31'), '31 Dec 2026')
})

test('formatDate handles empty and invalid input', () => {
  assert.equal(formatDate(null), '—')
  assert.equal(formatDate(''), '—')
  assert.equal(formatDate('garbage'), '—')
})

test('formatINR puts the minus sign before the rupee symbol', () => {
  assert.equal(formatINR(-5000), '-₹50')
  assert.equal(formatINR(-150000000, { compact: true }), '-₹15 L')
  assert.equal(formatINR(-2000000000, { compact: true }), '-₹2 Cr')
  assert.equal(formatINR(-5000, { withSymbol: false }), '-50')
})

test('formatINR formats positive amounts in the Indian system', () => {
  assert.equal(formatINR(0), '₹0')
  assert.equal(formatINR(123456), '₹1,234.56')
  assert.equal(formatINR(150000000, { compact: true }), '₹15 L')
  assert.equal(formatINR(2000000000, { compact: true }), '₹2 Cr')
})

test('formatINR treats empty/nullish amounts as zero', () => {
  assert.equal(formatINR(null), '₹0')
  assert.equal(formatINR(undefined), '₹0')
  assert.equal(formatINR(''), '₹0')
})

test('rupee/paise conversion round-trips without float drift', () => {
  assert.equal(rupeesToPaise(1234.56), 123456)
  assert.equal(rupeesToPaise(0.1 + 0.2), 30)
  assert.equal(rupeesToPaise('bad'), 0)
  assert.equal(paiseToRupees(123456), 1234.56)
})

test('day maths is stable across timezones', () => {
  assert.equal(daysBetween('2026-08-05', '2026-08-10'), 5)
  assert.equal(typeof daysUntil('2026-08-10'), 'number')
})
