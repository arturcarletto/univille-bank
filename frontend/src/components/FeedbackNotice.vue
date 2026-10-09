<script setup>
defineProps({ message: { type: String, required: true }, error: { type: Boolean, default: false } })
</script>
<template>
  <div :role="error ? 'alert' : 'status'" :class="error ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'" class="rounded-xl border p-4 text-sm leading-relaxed">
    {{ message }}<slot />
  </div>
</template>
