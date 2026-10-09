<script setup>
defineProps({ meta: { type: Object, required: true }, busy: Boolean })
defineEmits(['page'])
</script>
<template>
  <nav aria-label="Paginação de transações" class="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 p-5 sm:px-6">
    <p class="text-xs text-slate-500">{{ meta.total ? meta.from + '–' + meta.to : '0' }} de {{ meta.total.toLocaleString('pt-BR') }} registros <span class="ml-1">· Página {{ meta.current_page }} de {{ meta.last_page }}</span></p>
    <div class="flex gap-2"><button class="button-secondary" :disabled="busy || meta.current_page <= 1" @click="$emit('page', meta.current_page - 1)">Anterior</button><button class="button-secondary" :disabled="busy || meta.current_page >= meta.last_page" @click="$emit('page', meta.current_page + 1)">Próxima</button></div>
  </nav>
</template>
