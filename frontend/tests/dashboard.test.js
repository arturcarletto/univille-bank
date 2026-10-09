import test from 'node:test'
import assert from 'node:assert/strict'
import { createDashboard } from '../src/state/dashboard.js'
import { defaultFilters } from '../src/utils/filters.js'
import { ApiError } from '../src/api/http.js'
const list = (page = 1, rows = [{ id: 1, status: 'processed', amount: '10.01' }]) => ({ data: rows, meta: { current_page: page, last_page: 3, total: 31, from: (page - 1) * 15 + 1, to: page * 15 } })
const summary = { pending: 12, processed: 31 }

test('loading explícito, lista processada padrão e indicadores globais', async () => {
  let release
  const calls = []
  const wait = new Promise(resolve => { release = resolve })
  const dashboard = createDashboard(async (path, options) => { calls.push({ path, options }); await wait; return path === '/transactions' ? list() : summary })
  const loading = dashboard.load()
  assert.equal(dashboard.state.loading, true)
  assert.equal(dashboard.state.meta, null)
  release()
  await loading
  assert.equal(dashboard.state.loading, false)
  assert.equal(dashboard.state.rows.length, 1)
  assert.deepEqual(dashboard.state.summary, summary)
  assert.equal(calls[0].options.query.status, 'processed')
  assert.equal(calls[1].options.query, undefined)
})
test('aplicar filtros reinicia a página e paginação preserva combinação', async () => {
  const calls = []
  const dashboard = createDashboard(async (path, options) => { calls.push({ path, options }); return path === '/transactions' ? list(options.query.page) : summary })
  await dashboard.load(3)
  const filters = { ...defaultFilters(), status: 'pending', from: '2026-10-01', to: '2026-10-08', min_amount: '10,01', max_amount: '20,02' }
  await dashboard.apply(filters)
  assert.equal(dashboard.state.meta.current_page, 1)
  await dashboard.load(2)
  assert.deepEqual(calls.at(-2).options.query, { status: 'pending', from: '2026-10-01', to: '2026-10-08', min_amount: '10.01', max_amount: '20.02', page: 2, per_page: 15 })
})
test('intervalo inválido impede consulta e mantém filtros aplicados', async () => {
  let calls = 0
  const dashboard = createDashboard(async () => { calls++ })
  assert.equal(await dashboard.apply({ ...defaultFilters(), min_amount: '20', max_amount: '10' }), false)
  assert.equal(calls, 0)
  assert.ok(dashboard.state.fieldErrors.max_amount)
  assert.deepEqual(dashboard.state.filters, defaultFilters())
})
test('estado vazio e falha de resumo não falsificam indicadores', async () => {
  const dashboard = createDashboard(async path => { if (path === '/dashboard/summary') throw new ApiError('Resumo indisponível'); return list(1, []) })
  await dashboard.load()
  assert.equal(dashboard.state.rows.length, 0)
  assert.equal(dashboard.state.listError, '')
  assert.equal(dashboard.state.summary, null)
  assert.equal(dashboard.state.summaryError, 'Resumo indisponível')
})
test('falha de lista suporta retry e propaga campos 422', async () => {
  let failing = true
  const dashboard = createDashboard(async path => { if (path !== '/transactions') return summary; if (failing) throw new ApiError('Revise os filtros', 422, { to: ['invalid'] }); return list() })
  await dashboard.load()
  assert.equal(dashboard.state.listError, 'Revise os filtros')
  assert.deepEqual(dashboard.state.fieldErrors, { to: ['invalid'] })
  failing = false
  await dashboard.load()
  assert.equal(dashboard.state.listError, '')
  assert.equal(dashboard.state.rows.length, 1)
})
test('respostas fora de ordem não sobrescrevem a consulta mais recente', async () => {
  const pending = []
  const dashboard = createDashboard((path, options) => new Promise(resolve => pending.push({ path, options, resolve })))
  const first = dashboard.load(1)
  const second = dashboard.load(2)
  assert.equal(pending[0].options.signal.aborted, true)
  pending[2].resolve(list(2)); pending[3].resolve(summary)
  await second
  pending[0].resolve(list(1)); pending[1].resolve({ pending: 0, processed: 0 })
  await first
  assert.equal(dashboard.state.meta.current_page, 2)
  assert.deepEqual(dashboard.state.summary, summary)
})
test('dispose cancela requisições e payload inválido recebe erro explícito', async () => {
  const dashboard = createDashboard(async () => ({}))
  await dashboard.load()
  assert.match(dashboard.state.listError, /lista inesperada/)
  assert.equal(dashboard.state.summary, null)
  let release
  const late = new Promise(resolve => { release = resolve })
  const disposed = createDashboard(async () => { await late; return {} })
  const task = disposed.load()
  disposed.dispose()
  release()
  await task
  assert.equal(disposed.state.meta, null)
})
