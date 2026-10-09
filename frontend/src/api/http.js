export class ApiError extends Error {
    constructor(message, status = 0, errors = {}) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.errors = errors
    }
}

export function createHttpClient({
    baseUrl = '/api',
    getToken = () => null,
    onUnauthorized = () => {},
    fetchImpl = globalThis.fetch,
    timeoutMs = 15000,
} = {}) {
    return async function request(path, {
        method = 'GET',
        body,
        query,
        signal,
        authenticated = true,
    } = {}) {
        const token = authenticated ? getToken() : null
        const params = new URLSearchParams(query)
        const url = baseUrl.replace(/\/$/, '') + path + (params.size ? '?' + params : '')
        const headers = { Accept: 'application/json' }

        if (body !== undefined) headers['Content-Type'] = 'application/json'
        if (token) headers.Authorization = 'Bearer ' + token

        const controller = new AbortController()
        const abort = () => controller.abort()

        if (signal?.aborted) abort()
        signal?.addEventListener('abort', abort, { once: true })
        const timer = setTimeout(abort, timeoutMs)

        try {
            const response = await fetchImpl(url, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: controller.signal,
                credentials: 'omit',
                cache: 'no-store',
            })

            if (response.status === 401 && authenticated && token) onUnauthorized(token)
            if (response.status === 204 && response.ok) return null

            const payload = await response.json().catch(() => null)

            if (!response.ok) {
                const messages = {
                    401: authenticated ? 'Sua sessão expirou. Entre novamente.' : 'E-mail ou senha incorretos.',
                    422: 'Revise os campos indicados e tente novamente.',
                    429: 'Muitas tentativas. Aguarde um minuto e tente novamente.',
                }

                throw new ApiError(
                    messages[response.status] || 'Não foi possível concluir a solicitação. Tente novamente.',
                    response.status,
                    response.status === 422 ? payload?.errors || {} : {},
                )
            }

            if (!payload || typeof payload !== 'object') {
                throw new ApiError(
                    'A API retornou uma resposta inesperada. Tente novamente.',
                    response.status,
                )
            }

            return payload
        } catch (error) {
            if (signal?.aborted) throw error
            if (error instanceof ApiError) throw error

            throw new ApiError(
                controller.signal.aborted
                    ? 'A solicitação demorou demais. Tente novamente.'
                    : 'Não foi possível conectar à API. Verifique a conexão e tente novamente.',
            )
        } finally {
            clearTimeout(timer)
            signal?.removeEventListener('abort', abort)
        }
    }
}
