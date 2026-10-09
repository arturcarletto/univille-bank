<script setup>
import { onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { auth, request } from '../api/index.js'
import { createDashboard } from '../state/dashboard.js'
import AppHeader from '../components/AppHeader.vue'
import FeedbackNotice from '../components/FeedbackNotice.vue'
import SummaryCards from '../components/dashboard/SummaryCards.vue'
import TransactionFilters from '../components/dashboard/TransactionFilters.vue'
import TransactionsTable from '../components/dashboard/TransactionsTable.vue'
import PaginationControls from '../components/PaginationControls.vue'
const router = useRouter()
const dashboard = createDashboard(request, { session: auth.state })
const { state } = dashboard
watch(() => auth.state.token, token => {
    if (!token) router.replace('/login')
})
onMounted(dashboard.start)
onUnmounted(dashboard.dispose)
function focusMain() { document.getElementById('main')?.focus() }
</script>
<template>
  <div class="min-h-screen">
    <a href="#main" @click.prevent="focusMain" class="sr-only focus:not-sr-only focus:absolute focus:z-10 focus:bg-white focus:p-4">Pular para o conteúdo</a>
    <AppHeader />
    <main id="main" class="mx-auto max-w-7xl space-y-7 px-5 py-8 sm:px-8 sm:py-10" tabindex="-1">
      <div class="flex flex-wrap items-end justify-between gap-5">
        <div><p class="eyebrow">Painel de acompanhamento</p><h1 class="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Transações</h1><p class="mt-3 text-sm text-slate-500">Consulte registros e acompanhe o processamento financeiro.</p></div>
        <button class="button-secondary" :disabled="state.loading" @click="dashboard.refresh()">{{ state.loading || state.refreshing ? 'Atualizando…' : 'Atualizar dados' }}</button>
      </div>
      <p class="flex items-center gap-2 text-xs text-slate-500" role="status">
        <span class="size-2 rounded-full" :class="state.pollingPaused ? 'bg-slate-400' : 'bg-emerald-600'" aria-hidden="true"></span>
        {{ state.pollingPaused ? 'Atualização automática pausada nesta aba.' : 'Atualização automática a cada 5 segundos.' }}
      </p>
      <p v-if="state.refreshError" class="text-xs text-amber-800" role="status">{{ state.refreshError }} Nova tentativa automática em alguns segundos.</p>
      <FeedbackNotice v-if="!auth.state.persistent" message="O armazenamento da sessão está indisponível. Você precisará entrar novamente ao recarregar esta página." />
      <SummaryCards :summary="state.summary" :loading="state.loading" :error="state.summaryError" />
      <TransactionFilters :filters="state.filters" :errors="state.fieldErrors" :busy="state.loading" @apply="dashboard.apply" />
      <section class="panel" aria-labelledby="list-heading">
        <div class="flex flex-wrap items-center justify-between gap-2 px-6 py-5"><h2 id="list-heading" class="font-semibold">Registros consultados</h2><p class="text-xs text-slate-500">{{ state.query.status === 'processed' ? 'Transações processadas' : 'Conforme os filtros aplicados' }}</p></div>
        <TransactionsTable :rows="state.rows" :loading="state.loading" :error="state.listError" @retry="dashboard.refresh()" />
        <PaginationControls v-if="state.meta" :meta="state.meta" :busy="state.loading" @page="dashboard.load" />
      </section>
      <footer class="pb-4 text-xs leading-relaxed text-slate-500">Univille Bank · Datas exibidas em UTC. Atualização automática enquanto esta aba estiver ativa. Filtros e página são preservados.</footer>
    </main>
  </div>
</template>
