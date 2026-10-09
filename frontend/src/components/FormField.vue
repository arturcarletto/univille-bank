<script setup>
defineProps({ id: { type: String, required: true }, label: { type: String, required: true }, error: { type: String, default: '' }, hint: { type: String, default: '' } })
</script>
<template>
  <div class="min-w-0">
    <label :for="id" class="mb-2 block text-sm font-semibold text-slate-700">{{ label }}</label>
    <slot :describedby="error || hint ? id + '-description' : undefined" :invalid="!!error" />
    <p v-if="error || hint" :id="id + '-description'" :class="error ? 'text-red-700' : 'text-slate-500'" class="mt-2 text-xs leading-relaxed">{{ error || hint }}</p>
  </div>
</template>
