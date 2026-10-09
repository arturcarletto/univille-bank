import { reactive, readonly } from 'vue'
import { ApiError } from '../api/http.js'

export const SESSION_KEY = 'univille-bank.session'

export function createSession({ request, storage } = {}) {
    const state = reactive({ token: null, user: null, notice: '', persistent: true })

    function clear(notice = '') {
        try {
            storage?.removeItem(SESSION_KEY)
        } catch {
            // A sessão em memória ainda é encerrada.
        }

        state.token = null
        state.user = null
        state.notice = notice
    }

    try {
        const saved = JSON.parse(storage?.getItem(SESSION_KEY) || 'null')

        if (saved
            && typeof saved.token === 'string'
            && saved.token
            && typeof saved.user?.name === 'string'
            && typeof saved.user?.email === 'string') {
            state.token = saved.token
            state.user = saved.user
        } else if (saved) {
            clear()
        }
    } catch {
        clear()
    }

    async function authenticate(mode, body) {
        const data = await request('/' + mode, {
            method: 'POST',
            body,
            authenticated: false,
        })

        if (typeof data.token !== 'string'
            || !data.token
            || typeof data.user?.name !== 'string'
            || typeof data.user?.email !== 'string') {
            throw new ApiError('A API retornou uma sessão inválida. Tente novamente.')
        }

        try {
            if (!storage) throw new Error('Storage indisponível')

            storage.setItem(SESSION_KEY, JSON.stringify({ token: data.token, user: data.user }))
            state.persistent = true
        } catch {
            state.persistent = false
        }

        state.token = data.token
        state.user = data.user
        state.notice = ''
    }

    function expire(token) {
        // Um 401 de uma requisição antiga não encerra uma sessão mais recente.
        if (token === state.token) clear('Sua sessão expirou ou é inválida. Entre novamente.')
    }

    async function logout() {
        try {
            await request('/logout', { method: 'POST' })
        } catch (error) {
            if (error.status !== 401) throw error
        }

        clear('Sessão encerrada com sucesso.')
    }

    return { state: readonly(state), authenticate, logout, expire }
}
