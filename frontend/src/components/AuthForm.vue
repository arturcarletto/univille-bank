<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { auth } from '../api/index.js'
import { fieldMessage } from '../utils/filters.js'
import FormField from './FormField.vue'
import FeedbackNotice from './FeedbackNotice.vue'

const props = defineProps({ mode: { type: String, required: true } })
const register = computed(() => props.mode === 'register')
const router = useRouter()
const form = reactive({ name: '', email: '', password: '', password_confirmation: '' })
const errors = ref({})
const error = ref('')
const busy = ref(false)

async function submit() {
    if (busy.value) return

    busy.value = true
    errors.value = {}
    error.value = ''

    const body = { email: form.email.trim(), password: form.password }
    if (register.value) {
        Object.assign(body, {
            name: form.name.trim(),
            password_confirmation: form.password_confirmation,
        })
    }

    try {
        await auth.authenticate(props.mode, body)
        await router.replace('/dashboard')
    } catch (failure) {
        errors.value = failure.errors || {}
        error.value = failure.message
        form.password = ''
        form.password_confirmation = ''
    } finally {
        busy.value = false
    }
}
</script>

<template>
    <form class="space-y-5" @submit.prevent="submit" :aria-busy="busy">
        <FeedbackNotice v-if="error" :message="error" error />
        <fieldset :disabled="busy" class="space-y-5">
            <FormField
                v-if="register"
                id="name"
                label="Nome"
                :error="fieldMessage('name', errors, 'auth')"
                v-slot="field"
            >
                <input
                    id="name"
                    v-model="form.name"
                    class="input"
                    name="name"
                    autocomplete="name"
                    required
                    maxlength="255"
                    :aria-invalid="field.invalid"
                    :aria-describedby="field.describedby"
                />
            </FormField>
            <FormField
                id="email"
                label="E-mail"
                :error="fieldMessage('email', errors, 'auth')"
                v-slot="field"
            >
                <input
                    id="email"
                    v-model="form.email"
                    class="input"
                    name="email"
                    type="email"
                    autocomplete="email"
                    required
                    maxlength="255"
                    placeholder="seu@email.com"
                    :aria-invalid="field.invalid"
                    :aria-describedby="field.describedby"
                />
            </FormField>
            <FormField
                id="password"
                label="Senha"
                :error="fieldMessage('password', errors, 'auth')"
                :hint="register ? 'Use pelo menos 8 caracteres.' : ''"
                v-slot="field"
            >
                <input
                    id="password"
                    v-model="form.password"
                    class="input"
                    name="password"
                    type="password"
                    :autocomplete="register ? 'new-password' : 'current-password'"
                    required
                    :minlength="register ? 8 : undefined"
                    :aria-invalid="field.invalid"
                    :aria-describedby="field.describedby"
                />
            </FormField>
            <FormField
                v-if="register"
                id="password_confirmation"
                label="Confirmar senha"
                :error="fieldMessage('password_confirmation', errors, 'auth')"
                v-slot="field"
            >
                <input
                    id="password_confirmation"
                    v-model="form.password_confirmation"
                    class="input"
                    name="password_confirmation"
                    type="password"
                    autocomplete="new-password"
                    required
                    minlength="8"
                    :aria-invalid="field.invalid"
                    :aria-describedby="field.describedby"
                />
            </FormField>
        </fieldset>
        <button class="button-primary w-full" :disabled="busy" type="submit">
            {{ busy ? 'Aguarde…' : register ? 'Criar conta' : 'Entrar no painel' }}
        </button>
        <p v-if="busy" role="status" class="text-center text-sm text-slate-500">Validando seus dados…</p>
    </form>
</template>
