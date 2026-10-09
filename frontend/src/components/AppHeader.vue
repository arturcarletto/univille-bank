<script setup>
import { ref } from 'vue'
import { auth } from '../api/index.js'
import BrandMark from './BrandMark.vue'
import FeedbackNotice from './FeedbackNotice.vue'
const busy = ref(false)
const error = ref('')
async function logout() {
  busy.value = true
  error.value = ''
  try { await auth.logout() } catch (failure) { error.value = 'Não foi possível encerrar a sessão na API. Tente novamente. ' + failure.message }
  finally { busy.value = false }
}
</script>
<template>
  <header class="border-b border-slate-200 bg-white">
    <div class="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
      <BrandMark />
      <div class="flex min-w-0 items-center gap-4"><span class="max-w-48 truncate text-sm text-slate-600">{{ auth.state.user?.name }}</span><button class="button-secondary" :disabled="busy" @click="logout">{{ busy ? 'Saindo…' : 'Sair' }}</button></div>
    </div>
    <FeedbackNotice v-if="error" class="mx-auto mb-4 max-w-7xl" :message="error" error />
  </header>
</template>
