<script setup>
import { computed, reactive } from 'vue'
import { defaultFilters, fieldMessage } from '../../utils/filters.js'
import FormField from '../FormField.vue'
const props = defineProps({ filters: { type: Object, required: true }, errors: { type: Object, required: true }, busy: Boolean })
const emit = defineEmits(['apply'])
const draft = reactive({ ...props.filters })
const fields = [
  { key: 'from', label: 'Recebidas a partir de', type: 'date' },
  { key: 'to', label: 'Recebidas até', type: 'date' },
  { key: 'min_amount', label: 'Valor mínimo', type: 'text' },
  { key: 'max_amount', label: 'Valor máximo', type: 'text' },
]
const dirty = computed(() => Object.keys(draft).some(key => draft[key] !== props.filters[key]))
function reset() { Object.assign(draft, defaultFilters()); emit('apply', { ...draft }) }
</script>
<template>
  <form class="panel p-5 sm:p-6" @submit.prevent="emit('apply', { ...draft })" aria-labelledby="filters-heading">
    <div class="mb-5"><h2 id="filters-heading" class="font-semibold">Filtrar transações</h2><p class="mt-1 text-xs leading-relaxed text-slate-500">Período de recebimento em UTC. Valores sem separador de milhar, por exemplo: 1250,50.</p></div>
    <fieldset :disabled="busy" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <FormField id="status" label="Status" :error="fieldMessage('status', errors)" v-slot="field">
        <select id="status" v-model="draft.status" class="input" :aria-invalid="field.invalid" :aria-describedby="field.describedby">
          <option value="">Todos os status</option><option value="processed">Processadas</option><option value="pending">Pendentes</option><option value="invalid">Inválidas</option><option value="failed">Falhas</option>
        </select>
      </FormField>
      <FormField v-for="item in fields" :key="item.key" :id="item.key" :label="item.label" :error="fieldMessage(item.key, errors)" v-slot="field">
        <input :id="item.key" v-model="draft[item.key]" class="input" :type="item.type" :inputmode="item.type === 'text' ? 'decimal' : undefined" :placeholder="item.type === 'text' ? 'Ex.: 100,00' : undefined" :aria-invalid="field.invalid" :aria-describedby="field.describedby" />
      </FormField>
    </fieldset>
    <div class="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
      <button class="button-primary" type="submit" :disabled="busy">{{ busy ? 'Consultando…' : 'Aplicar filtros' }}</button>
      <button class="button-secondary" type="button" :disabled="busy" @click="reset">Restaurar filtros</button>
      <p v-if="dirty" class="text-xs text-slate-500" role="status">Há alterações nos filtros ainda não aplicadas.</p>
    </div>
  </form>
</template>
