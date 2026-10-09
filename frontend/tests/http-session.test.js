import test from 'node:test'
import assert from 'node:assert/strict'
import { ApiError, createHttpClient } from '../src/api/http.js'
import { createSession, SESSION_KEY } from '../src/state/session.js'
const response = (status, body) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
const storage = () => {
  const data = new Map()
  return { getItem: key => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key) }
}
const sessionResponse = { token: 'controlled-test-token', user: { name: 'Usuário sintético', email: 'test@example.invalid' } }

test('cliente envia Bearer em consulta protegida e preserva filtros textuais', async () => {
  let captured
  const request = createHttpClient({ getToken: () => 'controlled-test-token', fetchImpl: async (...args) => { captured = args; return response(200, { data: [] }) } })
  await request('/transactions', { query: { min_amount: '10.01', status: 'processed', page: 2 } })
  assert.equal(captured[0], '/api/transactions?min_amount=10.01&status=processed&page=2')
  assert.equal(captured[1].headers.Authorization, 'Bearer controlled-test-token')
  assert.equal(captured[1].credentials, 'omit')
})
test('login público não envia token nem encerra sessão em credencial inválida', async () => {
  let expired = false
  const request = createHttpClient({ getToken: () => 'current', onUnauthorized: () => { expired = true }, fetchImpl: async (_url, options) => { assert.equal(options.headers.Authorization, undefined); return response(401, {}) } })
  await assert.rejects(request('/login', { method: 'POST', authenticated: false, body: { email: 'test@example.invalid', password: 'synthetic' } }), { status: 401, message: 'E-mail ou senha incorretos.' })
  assert.equal(expired, false)
})
test('401 protegido invalida apenas o token da solicitação', async () => {
  let expired
  const request = createHttpClient({ getToken: () => 'invalid-token', onUnauthorized: token => { expired = token }, fetchImpl: async () => response(401, {}) })
  await assert.rejects(request('/dashboard/summary'), { status: 401 })
  assert.equal(expired, 'invalid-token')
})
test('422 mantém campos para tradução e erro 500 não expõe detalhes internos', async () => {
  const request = createHttpClient({ fetchImpl: async () => response(422, { errors: { email: ['invalid'] } }) })
  await assert.rejects(request('/register', { authenticated: false }), error => error instanceof ApiError && error.errors.email[0] === 'invalid')
  const fail = createHttpClient({ fetchImpl: async () => response(500, { message: 'internal secret trace' }) })
  await assert.rejects(fail('/transactions'), error => !error.message.includes('secret'))
})
test('falha de rede, timeout e JSON inesperado são erros acionáveis', async () => {
  const network = createHttpClient({ fetchImpl: async () => { throw new TypeError('Failed to fetch') } })
  await assert.rejects(network('/transactions'), { status: 0 })
  const timeout = createHttpClient({ timeoutMs: 5, fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new Error('abort')))) })
  await assert.rejects(timeout('/transactions'), { message: 'A solicitação demorou demais. Tente novamente.' })
  const invalid = createHttpClient({ fetchImpl: async () => new Response('<html>', { status: 200 }) })
  await assert.rejects(invalid('/transactions'), /resposta inesperada/)
})
test('cadastro armazena somente token e usuário; refresh restaura e logout remove', async () => {
  const store = storage()
  const calls = []
  const request = async (...args) => { calls.push(args); return args[0] === '/logout' ? null : sessionResponse }
  const session = createSession({ request, storage: store })
  await session.authenticate('register', { name: 'Usuário sintético', email: 'test@example.invalid', password: 'synthetic-secret', password_confirmation: 'synthetic-secret' })
  assert.ok(store.getItem(SESSION_KEY))
  assert.equal(store.getItem(SESSION_KEY).includes('password'), false)
  const restored = createSession({ request, storage: store })
  assert.equal(restored.state.token, sessionResponse.token)
  await restored.logout()
  assert.equal(restored.state.token, null)
  assert.equal(store.getItem(SESSION_KEY), undefined)
  assert.equal(calls.at(-1)[1].method, 'POST')
})
test('sessão corrompida é descartada e 401 antigo não apaga nova sessão', async () => {
  const store = storage()
  store.setItem(SESSION_KEY, 'invalid-json')
  const session = createSession({ request: async () => sessionResponse, storage: store })
  assert.equal(session.state.token, null)
  await session.authenticate('login', {})
  session.expire('old-token')
  assert.equal(session.state.token, sessionResponse.token)
  session.expire(sessionResponse.token)
  assert.equal(session.state.token, null)
})
test('logout indisponível preserva sessão para permitir nova tentativa', async () => {
  const store = storage()
  store.setItem(SESSION_KEY, JSON.stringify(sessionResponse))
  const session = createSession({ storage: store, request: async () => { throw new ApiError('offline') } })
  await assert.rejects(session.logout(), /offline/)
  assert.equal(session.state.token, sessionResponse.token)
})
test('storage negado usa memória com aviso explícito', async () => {
  const session = createSession({ request: async () => sessionResponse, storage: { getItem: () => null, setItem: () => { throw new Error('denied') } } })
  await session.authenticate('login', {})
  assert.equal(session.state.persistent, false)
  assert.equal(session.state.token, sessionResponse.token)
})
