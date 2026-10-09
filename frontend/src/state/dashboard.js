import { reactive, readonly, watch } from 'vue'
import { ApiError } from '../api/http.js'
import { defaultFilters, validateFilters } from '../utils/filters.js'

const POLLING_INTERVAL_MS = 5000

export function createDashboard(request, {
    session,
    visibility = globalThis.document,
    timers = globalThis,
} = {}) {
    const state = reactive({
        filters: defaultFilters(),
        query: { status: 'processed' },
        rows: [],
        meta: null,
        summary: null,
        loading: false,
        refreshing: false,
        pollingPaused: Boolean(visibility?.hidden),
        refreshError: '',
        listError: '',
        summaryError: '',
        fieldErrors: {},
    })

    let controller
    let generation = 0
    let currentPage = 1
    let timer
    let running = false
    let disposed = false
    let stopSessionWatch

    function hasSession() {
        return !session || Boolean(session.token)
    }

    function clearTimer() {
        if (timer !== undefined) timers.clearTimeout(timer)
        timer = undefined
    }

    function schedule() {
        clearTimer()
        if (!running || disposed || visibility?.hidden || !hasSession()) return

        timer = timers.setTimeout(() => {
            timer = undefined
            if (!controller) void load(currentPage, { silent: true })
        }, POLLING_INTERVAL_MS)
    }

    async function load(page = currentPage, { silent = false } = {}) {
        if (disposed || !hasSession()) return

        clearTimer()
        controller?.abort()
        controller = new AbortController()

        const signal = controller.signal
        const id = ++generation
        currentPage = page

        state.loading = !silent
        state.refreshing = silent
        if (!silent) {
            state.listError = ''
            state.summaryError = ''
            state.refreshError = ''
            state.rows = []
            state.meta = null
            state.summary = null
            state.fieldErrors = {}
        }

        try {
            const results = await Promise.allSettled([
                request('/transactions', {
                    query: { ...state.query, page, per_page: 15 },
                    signal,
                }),
                request('/dashboard/summary', { signal }),
            ])

            if (id !== generation || signal.aborted) return

            const refreshErrors = []
            try {
                const list = results[0]
                if (list.status === 'rejected') throw list.reason

                const data = list.value
                if (!Array.isArray(data.data)
                    || !Number.isInteger(data.meta?.current_page)
                    || !Number.isInteger(data.meta?.last_page)
                    || !Number.isInteger(data.meta?.total)) {
                    throw new ApiError('A API retornou uma lista inesperada. Tente novamente.')
                }

                state.rows = data.data
                state.meta = data.meta
                state.listError = ''
            } catch (error) {
                if (silent) {
                    refreshErrors.push(error.message)
                } else {
                    state.listError = error.message
                    state.fieldErrors = error.errors || {}
                }
            }

            const summary = results[1]
            if (summary.status === 'fulfilled'
                && Number.isInteger(summary.value?.pending)
                && Number.isInteger(summary.value?.processed)) {
                state.summary = summary.value
                state.summaryError = ''
            } else {
                const message = summary.status === 'rejected'
                    ? summary.reason.message
                    : 'Os indicadores não puderam ser interpretados. Tente novamente.'
                if (silent) {
                    refreshErrors.push(message)
                } else {
                    state.summaryError = message
                }
            }

            state.refreshError = [...new Set(refreshErrors)].join(' ')
        } finally {
            if (id === generation) {
                controller = undefined
                state.loading = false
                state.refreshing = false
                schedule()
            }
        }
    }

    function refresh() {
        return load(currentPage, { silent: state.meta !== null || state.summary !== null })
    }

    async function apply(filters) {
        const { query, errors } = validateFilters(filters)
        state.fieldErrors = errors

        if (Object.keys(errors).length) return false

        state.filters = { ...filters }
        state.query = query
        await load(1)

        return true
    }

    function pause() {
        clearTimer()
        generation++
        controller?.abort()
        controller = undefined
        state.loading = false
        state.refreshing = false
    }

    function onVisibilityChange() {
        state.pollingPaused = Boolean(visibility.hidden)
        if (state.pollingPaused) {
            pause()
        } else if (running && !disposed && hasSession()) {
            void refresh()
        }
    }

    function start() {
        if (running || disposed || !hasSession()) return

        running = true
        visibility?.addEventListener('visibilitychange', onVisibilityChange)
        if (session) {
            stopSessionWatch = watch(() => session.token, token => {
                if (!token) dispose()
            }, { flush: 'sync' })
        }
        if (!visibility?.hidden) return load(1)
    }

    function dispose() {
        disposed = true
        running = false
        pause()
        visibility?.removeEventListener('visibilitychange', onVisibilityChange)
        stopSessionWatch?.()
    }

    return { state: readonly(state), start, load, refresh, apply, dispose }
}
