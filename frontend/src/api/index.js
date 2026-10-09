import { createHttpClient } from './http.js'
import { createSession } from '../state/session.js'
let storage
try { storage = window.sessionStorage } catch { /* A interface informa uso em memória. */ }
let session
export const request = createHttpClient({
  baseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  getToken: () => session?.state.token,
  onUnauthorized: (token) => session?.expire(token),
})
session = createSession({ request, storage })
export const auth = session
