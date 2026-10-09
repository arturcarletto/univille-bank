<script setup>
import { formatMoney } from '../../utils/money.js'
import { formatDate } from '../../utils/date.js'
import { statuses } from '../../utils/filters.js'
import FeedbackNotice from '../FeedbackNotice.vue'

defineProps({
    rows: { type: Array, required: true },
    loading: Boolean,
    error: { type: String, default: '' },
})
defineEmits(['retry'])

const badge = {
    processed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
    pending: 'bg-amber-50 text-amber-800 ring-amber-200',
    invalid: 'bg-red-50 text-red-800 ring-red-200',
    failed: 'bg-slate-100 text-slate-700 ring-slate-200',
}
</script>

<template>
    <div :aria-busy="loading">
        <div v-if="loading" class="px-6 py-16 text-center" role="status">
            <p class="font-medium">Carregando transações…</p>
            <p class="mt-2 text-sm text-slate-500">Consultando os registros da API.</p>
        </div>
        <div v-else-if="error" class="p-6">
            <FeedbackNotice :message="error" error />
            <button class="button-secondary mt-4" @click="$emit('retry')">Tentar novamente</button>
        </div>
        <div v-else-if="!rows.length" class="px-6 py-16 text-center" role="status">
            <p class="font-medium">Nenhuma transação encontrada</p>
            <p class="mt-2 text-sm text-slate-500">Revise os filtros ou consulte outro período.</p>
        </div>
        <div
            v-else
            class="overflow-x-auto rounded-b-2xl"
            role="region"
            aria-label="Lista de transações, role horizontalmente em telas pequenas"
            tabindex="0"
        >
            <table class="w-full min-w-[680px] text-left text-sm">
                <caption class="sr-only">Transações retornadas pela API. Datas em UTC.</caption>
                <thead class="border-y border-slate-100 bg-slate-50 text-xs text-slate-500">
                    <tr>
                        <th scope="col" class="px-6 py-4 font-medium">Transação</th>
                        <th scope="col" class="px-6 py-4 font-medium">Status</th>
                        <th scope="col" class="px-6 py-4 text-right font-medium">Valor</th>
                        <th scope="col" class="px-6 py-4 font-medium">Recebimento (UTC)</th>
                        <th scope="col" class="px-6 py-4 font-medium">Processamento (UTC)</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    <tr v-for="row in rows" :key="row.id" class="hover:bg-slate-50/70">
                        <th scope="row" class="max-w-56 px-6 py-5 font-medium">
                            <span class="block break-all">{{ row.external_id || '#' + row.id }}</span>
                            <span
                                v-if="row.external_id"
                                class="mt-1 block text-xs font-normal text-slate-500"
                            >Registro #{{ row.id }}</span>
                        </th>
                        <td class="px-6 py-5">
                            <span
                                :class="badge[row.status] || badge.failed"
                                class="inline-flex rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-inset"
                            >
                                {{ statuses[row.status] || 'Desconhecido' }}
                            </span>
                        </td>
                        <td class="whitespace-nowrap px-6 py-5 text-right font-medium tabular-nums">
                            {{ formatMoney(row.amount, row.currency) }}
                        </td>
                        <td class="whitespace-nowrap px-6 py-5 text-slate-600">
                            {{ formatDate(row.received_at) }}
                        </td>
                        <td class="whitespace-nowrap px-6 py-5 text-slate-600">
                            {{ formatDate(row.processed_at) }}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </div>
</template>
