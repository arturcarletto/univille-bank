import { normalizeAmount, decimalCents } from './money.js'

export const defaultFilters = () => ({
    status: 'processed',
    from: '',
    to: '',
    min_amount: '',
    max_amount: '',
})

export const statuses = {
    processed: 'Processada',
    pending: 'Pendente',
    invalid: 'Inválida',
    failed: 'Falhou',
}

function validDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(value)
        && !Number.isNaN(Date.parse(value + 'T00:00:00Z'))
        && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value
}

export function validateFilters(filters) {
    const query = {}
    const errors = {}

    if (filters.status) {
        if (!(filters.status in statuses)) {
            errors.status = 'Selecione um status válido.'
        } else {
            query.status = filters.status
        }
    }

    for (const key of ['from', 'to']) {
        if (!filters[key]) continue

        if (!validDate(filters[key])) {
            errors[key] = 'Informe uma data válida.'
        } else {
            query[key] = filters[key]
        }
    }

    if (query.from && query.to && query.from > query.to) {
        errors.to = 'A data final deve ser igual ou posterior à inicial.'
    }

    for (const key of ['min_amount', 'max_amount']) {
        if (!filters[key]?.trim()) continue

        try {
            query[key] = normalizeAmount(filters[key])
        } catch (error) {
            errors[key] = error.message
        }
    }

    if (query.min_amount
        && query.max_amount
        && decimalCents(query.min_amount) > decimalCents(query.max_amount)) {
        errors.max_amount = 'O valor máximo deve ser igual ou maior que o mínimo.'
    }

    return { query, errors }
}

export function fieldMessage(field, errors, context = 'filters') {
    if (!errors[field]) return ''
    if (typeof errors[field] === 'string') return errors[field]

    if (context === 'auth') {
        return ({
            name: 'Informe seu nome (até 255 caracteres).',
            email: 'Informe um e-mail válido que esteja disponível para cadastro.',
            password: 'Use ao menos 8 caracteres e confirme a mesma senha.',
            password_confirmation: 'A confirmação deve ser igual à senha.',
        })[field] || 'Revise este campo.'
    }

    return ({
        from: 'Revise a data inicial.',
        to: 'Revise a data final e a ordem do período.',
        min_amount: 'Revise o valor mínimo.',
        max_amount: 'Revise o valor máximo e a ordem da faixa.',
        status: 'Selecione um status válido.',
    })[field] || 'Revise este campo.'
}
