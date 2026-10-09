<script setup>
import FeedbackNotice from '../FeedbackNotice.vue'

defineProps({
    summary: { type: Object, default: null },
    loading: Boolean,
    error: { type: String, default: '' },
})

const cards = [
    {
        key: 'pending',
        label: 'Transações pendentes',
        detail: 'Aguardando processamento',
        marker: 'bg-amber-500',
    },
    {
        key: 'processed',
        label: 'Transações processadas',
        detail: 'Processamento concluído',
        marker: 'bg-emerald-600',
    },
]
</script>

<template>
    <section aria-labelledby="summary-heading">
        <div class="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="summary-heading" class="text-sm font-semibold text-slate-700">Visão geral</h2>
            <p class="text-xs text-slate-500">Todos os registros · independente dos filtros</p>
        </div>
        <div class="grid gap-4 sm:grid-cols-2" :aria-busy="loading">
            <article
                v-for="card in cards"
                :key="card.key"
                class="panel flex items-start justify-between gap-4 p-6"
            >
                <div>
                    <h3 class="text-sm font-medium text-slate-600">{{ card.label }}</h3>
                    <p class="mt-3 text-4xl font-semibold tabular-nums tracking-tight">
                        {{ loading ? '…' : summary ? summary[card.key].toLocaleString('pt-BR') : '—' }}
                    </p>
                    <p class="mt-3 text-xs text-slate-500">{{ card.detail }}</p>
                </div>
                <span :class="card.marker" class="mt-1 size-3 shrink-0 rounded-full" aria-hidden="true"></span>
            </article>
        </div>
        <FeedbackNotice v-if="error" :message="error" error class="mt-4" />
    </section>
</template>
