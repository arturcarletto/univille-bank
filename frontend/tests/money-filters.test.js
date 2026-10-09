import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAmount, formatMoney } from '../src/utils/money.js'
import { defaultFilters, validateFilters, fieldMessage } from '../src/utils/filters.js'
import { formatDate } from '../src/utils/date.js'

test('normaliza filtros sem perder centavos nem aceitar milhar ambíguo', () => {
  assert.equal(normalizeAmount(' 1250,50 '), '1250.50')
  assert.equal(normalizeAmount('0,01'), '0.01')
  assert.equal(normalizeAmount('10.1'), '10.10')
  for (const value of ['1.250,50', '1e3', '-1', '0', '1,005', '01', 'Infinity']) assert.throws(() => normalizeAmount(value))
})
test('preserva o limite monetário de inteiro SQLite/PHP 64 bits', () => {
  assert.equal(normalizeAmount('92233720368547758.07'), '92233720368547758.07')
  assert.throws(() => normalizeAmount('92233720368547758.08'))
  assert.equal(formatMoney('92233720368547758.07', 'BRL'), 'R$\u00a092.233.720.368.547.758,07')
  assert.equal(formatMoney(null, null), '—')
})
test('constrói combinação de filtros e compara quantias grandes de forma exata', () => {
  const filters = { status: 'pending', from: '2026-10-01', to: '2026-10-08', min_amount: '90071992547409,91', max_amount: '90071992547409,92' }
  assert.deepEqual(validateFilters(filters), { query: { ...filters, min_amount: '90071992547409.91', max_amount: '90071992547409.92' }, errors: {} })
  assert.ok(validateFilters({ ...filters, max_amount: '90071992547409,90' }).errors.max_amount)
})
test('rejeita datas inexistentes, intervalo invertido e status não suportado', () => {
  assert.ok(validateFilters({ ...defaultFilters(), from: '2026-02-30' }).errors.from)
  assert.ok(validateFilters({ ...defaultFilters(), from: '2026-10-09', to: '2026-10-08' }).errors.to)
  assert.ok(validateFilters({ ...defaultFilters(), status: 'invented' }).errors.status)
  assert.deepEqual(validateFilters({ ...defaultFilters(), status: '', to: '2026-10-08' }), { query: { to: '2026-10-08' }, errors: {} })
})
test('mensagens e datas respeitam idioma e semântica UTC', () => {
  assert.equal(fieldMessage('password', { password: ['secret internal message'] }, 'auth'), 'Use ao menos 8 caracteres e confirme a mesma senha.')
  assert.equal(formatDate('2026-10-08T00:30:00Z'), '08/10/2026, 00:30')
})
