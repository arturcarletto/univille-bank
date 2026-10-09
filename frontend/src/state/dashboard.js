import { reactive, readonly } from 'vue'
import { ApiError } from '../api/http.js'
import { defaultFilters, validateFilters } from '../utils/filters.js'

export function createDashboard(request) {
    const state = reactive({
        filters: defaultFilters(),
        query: { status: 'processed' },
        rows: [],
        meta: null,
        summary: null,
        loading: false,
        listError: '',
        summaryError: '',
        fieldErrors: {},
    })

    let controller
    let generation = 0
    let currentPage = 1

    async function load(page = currentPage) {
        controller?.abort()
        controller = new AbortController()

        const signal = controller.signal
        const id = ++generation
        currentPage = page

        state.loading = true
        state.listError = ''
        state.summaryError = ''
        state.rows = []
        state.meta = null
        state.summary = null
        state.fieldErrors = {}

        const results = await Promise.allSettled([
            request('/transactions', {
                query: { ...state.query, page, per_page: 15 },
                signal,
            }),
            request('/dashboard/summary', { signal }),
        ])

        if (id !== generation || signal.aborted) return

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
        } catch (error) {
            state.listError = error.message
            state.fieldErrors = error.errors || {}
        }

        const summary = results[1]
        if (summary.status === 'fulfilled'
            && Number.isInteger(summary.value.pending)
            && Number.isInteger(summary.value.processed)) {
            state.summary = summary.value
        } else {
            state.summaryError = summary.status === 'rejected'
                ? summary.reason.message
                : 'Os indicadores não puderam ser interpretados. Tente novamente.'
        }

        state.loading = false
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

    function dispose() {
        generation++
        controller?.abort()
    }

    return { state: readonly(state), load, apply, dispose }
}
