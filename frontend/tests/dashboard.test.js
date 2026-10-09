import test from 'node:test'
import assert from 'node:assert/strict'
import { createDashboard } from '../src/state/dashboard.js'
import { defaultFilters } from '../src/utils/filters.js'
import { ApiError, createHttpClient } from '../src/api/http.js'
import { reactive } from 'vue'
import { createSession } from '../src/state/session.js'
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

const settle = () => new Promise(resolve => setImmediate(resolve))

function controlledClock() {
    let now = 0
    let nextId = 0
    const pending = new Map()
    return {
        setTimeout(callback, delay) {
            const id = ++nextId
            pending.set(id, { callback, at: now + delay })
            return id
        },
        clearTimeout(id) { pending.delete(id) },
        get pendingCount() { return pending.size },
        async advance(milliseconds) {
            now += milliseconds
            for (const [id, task] of [...pending]) {
                if (task.at > now) continue
                pending.delete(id)
                task.callback()
            }
            await settle()
        },
    }
}

function controlledVisibility(hidden = false) {
    const listeners = new Set()
    return {
        hidden,
        addEventListener(_event, callback) { listeners.add(callback) },
        removeEventListener(_event, callback) { listeners.delete(callback) },
        get listenerCount() { return listeners.size },
        setHidden(value) {
            this.hidden = value
            for (const callback of listeners) callback()
        },
    }
}

function pollingEnvironment(request, { hidden = false, session } = {}) {
    const clock = controlledClock()
    const visibility = controlledVisibility(hidden)
    const dashboard = createDashboard(request, { timers: clock, visibility, session })
    return { dashboard, clock, visibility }
}

test('polling carrega imediatamente uma vez e atualiza após cinco segundos', async () => {
    let count = 0
    const { dashboard, clock } = pollingEnvironment(async path => {
        if (path === '/transactions') return list(1, [{ id: ++count }])
        return { pending: 0, processed: count }
    })
    const first = dashboard.start()
    dashboard.start()
    assert.equal(count, 1)
    assert.equal(clock.pendingCount, 0)
    await first
    assert.equal(clock.pendingCount, 1)
    await clock.advance(4999)
    assert.equal(count, 1)
    await clock.advance(1)
    assert.equal(count, 2)
    assert.equal(dashboard.state.rows[0].id, 2)
    assert.equal(dashboard.state.summary.processed, 2)
    assert.equal(clock.pendingCount, 1)
    dashboard.dispose()
})

test('polling preserva filtros aplicados, página e validação de campos em edição', async () => {
    const calls = []
    const { dashboard, clock } = pollingEnvironment(async (path, options) => {
        calls.push({ path, options })
        return path === '/transactions' ? list(options.query.page) : summary
    })
    await dashboard.start()
    const filters = { ...defaultFilters(), status: 'pending', from: '2026-10-01', to: '2026-10-08', min_amount: '10,01', max_amount: '20,02' }
    await dashboard.apply(filters)
    await dashboard.load(2)
    const draft = { ...filters, min_amount: '30', max_amount: '20' }
    assert.equal(await dashboard.apply(draft), false)
    const previousErrors = { ...dashboard.state.fieldErrors }
    await clock.advance(5000)
    assert.deepEqual(calls.at(-2).options.query, { status: 'pending', from: '2026-10-01', to: '2026-10-08', min_amount: '10.01', max_amount: '20.02', page: 2, per_page: 15 })
    assert.deepEqual(dashboard.state.filters, filters)
    assert.deepEqual(dashboard.state.fieldErrors, previousErrors)
    assert.equal(draft.min_amount, '30')
    assert.equal(dashboard.state.meta.current_page, 2)
    dashboard.dispose()
})

test('ciclo lento não sobrepõe requisições nem agenda antes da conclusão', async () => {
    let hold = false
    const pending = []
    const { dashboard, clock } = pollingEnvironment((path, options) => {
        if (hold) return new Promise(resolve => pending.push({ path, options, resolve }))
        return Promise.resolve(path === '/transactions' ? list() : summary)
    })
    await dashboard.start()
    hold = true
    await clock.advance(5000)
    assert.equal(pending.length, 2)
    assert.equal(clock.pendingCount, 0)
    assert.equal(dashboard.state.loading, false)
    assert.equal(dashboard.state.refreshing, true)
    assert.equal(dashboard.state.rows.length, 1)
    assert.deepEqual(dashboard.state.summary, summary)
    assert.equal(dashboard.state.meta.current_page, 1)
    await clock.advance(20000)
    assert.equal(pending.length, 2)
    pending[0].resolve(list(1, [{ id: 2 }]))
    pending[1].resolve({ pending: 11, processed: 32 })
    await settle()
    assert.equal(dashboard.state.rows[0].id, 2)
    assert.equal(clock.pendingCount, 1)
    await clock.advance(4999)
    assert.equal(pending.length, 2)
    dashboard.dispose()
})

test('consulta manual cancela polling em curso e ignora sua resposta obsoleta', async () => {
    let hold = false
    const pending = []
    const { dashboard, clock } = pollingEnvironment((path, options) => {
        if (hold) return new Promise(resolve => pending.push({ path, options, resolve }))
        return Promise.resolve(path === '/transactions' ? list() : summary)
    })
    await dashboard.start()
    await dashboard.load(2)
    hold = true
    await clock.advance(5000)
    const manual = dashboard.refresh()
    assert.equal(pending[0].options.signal.aborted, true)
    pending[2].resolve(list(2, [{ id: 20 }]))
    pending[3].resolve({ pending: 0, processed: 40 })
    await manual
    pending[0].resolve(list(1, [{ id: 99 }]))
    pending[1].resolve({ pending: 99, processed: 99 })
    await settle()
    assert.equal(dashboard.state.rows[0].id, 20)
    assert.equal(dashboard.state.meta.current_page, 2)
    assert.equal(dashboard.state.summary.processed, 40)
    assert.equal(clock.pendingCount, 1)
    dashboard.dispose()
})

test('falha silenciosa mantém dados válidos e recupera no próximo ciclo', async () => {
    let failing = false
    let value = 1
    const { dashboard, clock } = pollingEnvironment(async path => {
        if (failing) throw new ApiError('Conexão indisponível')
        return path === '/transactions' ? list(1, [{ id: value }]) : { pending: 0, processed: value }
    })
    await dashboard.start()
    failing = true
    await clock.advance(5000)
    assert.equal(dashboard.state.rows[0].id, 1)
    assert.equal(dashboard.state.summary.processed, 1)
    assert.equal(dashboard.state.meta.current_page, 1)
    assert.equal(dashboard.state.listError, '')
    assert.equal(dashboard.state.summaryError, '')
    assert.equal(dashboard.state.refreshError, 'Conexão indisponível')
    assert.equal(clock.pendingCount, 1)
    await clock.advance(4999)
    assert.equal(dashboard.state.refreshError, 'Conexão indisponível')
    failing = false
    value = 2
    await clock.advance(1)
    assert.equal(dashboard.state.rows[0].id, 2)
    assert.equal(dashboard.state.summary.processed, 2)
    assert.equal(dashboard.state.refreshError, '')
    dashboard.dispose()
})

test('atualização parcial preserva o endpoint que falhou e aceita o que respondeu', async () => {
    let failing = false
    const { dashboard, clock } = pollingEnvironment(async path => {
        if (path === '/transactions') {
            if (failing) throw new ApiError('Lista indisponível')
            return list()
        }
        return { pending: 0, processed: failing ? 32 : 31 }
    })
    await dashboard.start()
    failing = true
    await clock.advance(5000)
    assert.equal(dashboard.state.rows.length, 1)
    assert.equal(dashboard.state.summary.processed, 32)
    assert.equal(dashboard.state.refreshError, 'Lista indisponível')
    dashboard.dispose()
})

test('aba oculta pausa e aba visível retoma imediatamente sem perder a página', async () => {
    const calls = []
    const { dashboard, clock, visibility } = pollingEnvironment(async (path, options) => {
        calls.push({ path, options })
        return path === '/transactions' ? list(options.query.page) : summary
    })
    await dashboard.start()
    await dashboard.load(2)
    visibility.setHidden(true)
    assert.equal(dashboard.state.pollingPaused, true)
    assert.equal(clock.pendingCount, 0)
    await clock.advance(20000)
    assert.equal(calls.length, 4)
    visibility.setHidden(false)
    await settle()
    assert.equal(calls.length, 6)
    assert.equal(calls.at(-2).options.query.page, 2)
    assert.equal(dashboard.state.pollingPaused, false)
    assert.equal(clock.pendingCount, 1)
    dashboard.dispose()
})

test('montagem em aba oculta aguarda visibilidade para a primeira consulta', async () => {
    let calls = 0
    const { dashboard, clock, visibility } = pollingEnvironment(async path => {
        calls++
        return path === '/transactions' ? list() : summary
    }, { hidden: true })
    dashboard.start()
    await clock.advance(10000)
    assert.equal(calls, 0)
    visibility.setHidden(false)
    await settle()
    assert.equal(calls, 2)
    assert.equal(dashboard.state.rows.length, 1)
    dashboard.dispose()
})

test('ocultar durante atualização cancela o ciclo e impede resultado tardio', async () => {
    let hold = false
    const pending = []
    const { dashboard, clock, visibility } = pollingEnvironment((path, options) => {
        if (hold) return new Promise(resolve => pending.push({ path, options, resolve }))
        return Promise.resolve(path === '/transactions' ? list() : summary)
    })
    await dashboard.start()
    hold = true
    await clock.advance(5000)
    visibility.setHidden(true)
    assert.equal(pending[0].options.signal.aborted, true)
    assert.equal(dashboard.state.refreshing, false)
    assert.equal(clock.pendingCount, 0)
    pending[0].resolve(list(1, [{ id: 99 }]))
    pending[1].resolve({ pending: 99, processed: 99 })
    await settle()
    assert.equal(dashboard.state.rows[0].id, 1)
    assert.deepEqual(dashboard.state.summary, summary)
    assert.equal(clock.pendingCount, 0)
    dashboard.dispose()
})

test('dispose remove timer/listener e não aceita reinício ou chamadas tardias', async () => {
    let calls = 0
    const { dashboard, clock, visibility } = pollingEnvironment(async path => {
        calls++
        return path === '/transactions' ? list() : summary
    })
    await dashboard.start()
    assert.equal(visibility.listenerCount, 1)
    dashboard.dispose()
    dashboard.dispose()
    assert.equal(visibility.listenerCount, 0)
    assert.equal(clock.pendingCount, 0)
    visibility.setHidden(true)
    visibility.setHidden(false)
    dashboard.start()
    await dashboard.refresh()
    await clock.advance(20000)
    assert.equal(calls, 2)
})

test('perda de sessão cancela ciclo em andamento e remove o polling', async () => {
    const session = reactive({ token: 'controlled-test-token' })
    const pending = []
    const { dashboard, clock, visibility } = pollingEnvironment((path, options) => new Promise(resolve => pending.push({ path, options, resolve })), { session })
    const first = dashboard.start()
    session.token = null
    assert.equal(pending[0].options.signal.aborted, true)
    assert.equal(visibility.listenerCount, 0)
    pending[0].resolve(list())
    pending[1].resolve(summary)
    await first
    await clock.advance(20000)
    assert.equal(dashboard.state.rows.length, 0)
    assert.equal(clock.pendingCount, 0)
    assert.equal(pending.length, 2)
})

test('logout efetivo da sessão encerra os próximos ciclos', async () => {
    const session = createSession({ request: async path => path === '/logout' ? null : { token: 'controlled-test-token', user: { name: 'Teste', email: 'test@example.invalid' } } })
    await session.authenticate('login', {})
    let calls = 0
    const { dashboard, clock, visibility } = pollingEnvironment(async path => {
        calls++
        return path === '/transactions' ? list() : summary
    }, { session: session.state })
    await dashboard.start()
    await session.logout()
    assert.equal(session.state.token, null)
    assert.equal(clock.pendingCount, 0)
    assert.equal(visibility.listenerCount, 0)
    await clock.advance(20000)
    assert.equal(calls, 2)
})

test('401 periódico respeita expiração do cliente HTTP e interrompe novas consultas', async () => {
    let failing = false
    let calls = 0
    const session = createSession({ request: async () => ({ token: 'controlled-test-token', user: { name: 'Teste', email: 'test@example.invalid' } }) })
    await session.authenticate('login', {})
    const request = createHttpClient({
        getToken: () => session.state.token,
        onUnauthorized: token => session.expire(token),
        fetchImpl: async url => {
            calls++
            return new Response(JSON.stringify(failing ? { message: 'Unauthenticated.' } : url.startsWith('/api/transactions') ? list() : summary), { status: failing ? 401 : 200, headers: { 'Content-Type': 'application/json' } })
        },
    })
    const { dashboard, clock, visibility } = pollingEnvironment(request, { session: session.state })
    await dashboard.start()
    failing = true
    await clock.advance(5000)
    assert.equal(session.state.token, null)
    assert.equal(clock.pendingCount, 0)
    assert.equal(visibility.listenerCount, 0)
    await clock.advance(20000)
    assert.equal(calls, 4)
})

test('Atualizar dados consulta a página atual sem aguardar timer e preserva dados', async () => {
    let hold = false
    const pending = []
    const calls = []
    const { dashboard, clock } = pollingEnvironment((path, options) => {
        calls.push({ path, options })
        if (hold) return new Promise(resolve => pending.push({ path, options, resolve }))
        return Promise.resolve(path === '/transactions' ? list(options.query.page) : summary)
    })
    await dashboard.start()
    await dashboard.load(2)
    hold = true
    const refreshing = dashboard.refresh()
    assert.equal(calls.length, 6)
    assert.equal(calls.at(-2).options.query.page, 2)
    assert.equal(dashboard.state.loading, false)
    assert.equal(dashboard.state.meta.current_page, 2)
    assert.deepEqual(dashboard.state.summary, summary)
    assert.equal(clock.pendingCount, 0)
    pending[0].resolve(list(2, [{ id: 2 }]))
    pending[1].resolve({ pending: 0, processed: 32 })
    await refreshing
    assert.equal(dashboard.state.rows[0].id, 2)
    assert.equal(clock.pendingCount, 1)
    dashboard.dispose()
})

test('dashboard sem sessão não inicia requisições nem timers', async () => {
    let calls = 0
    const session = reactive({ token: null })
    const { dashboard, clock, visibility } = pollingEnvironment(async () => { calls++ }, { session })
    dashboard.start()
    await dashboard.refresh()
    await clock.advance(10000)
    assert.equal(calls, 0)
    assert.equal(clock.pendingCount, 0)
    assert.equal(visibility.listenerCount, 0)
    dashboard.dispose()
})
