<script setup>
import { computed } from "vue";
import { RouterLink } from "vue-router";
import { auth } from "../api/index.js";
import AuthForm from "../components/AuthForm.vue";
import BrandMark from "../components/BrandMark.vue";
import FeedbackNotice from "../components/FeedbackNotice.vue";

const props = defineProps({ mode: { type: String, required: true } });
const register = computed(() => props.mode === "register");
</script>
<template>
  <main class="min-h-screen lg:grid lg:grid-cols-2">
    <aside
      class="bg-[#153e35] px-6 py-8 text-white sm:px-12 lg:flex lg:flex-col lg:justify-between lg:p-16"
    >
      <BrandMark />
      <div class="max-w-lg py-10 lg:py-24">
        <p
          class="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200"
        >
          Conciliação financeira
        </p>
        <h1
          class="text-3xl font-semibold leading-tight tracking-tight sm:text-4xl lg:text-5xl"
        >
          Clareza em cada<br class="hidden sm:block" />
          transação.
        </h1>
        <p class="mt-6 max-w-sm leading-relaxed text-emerald-100">
          Consulte transações, acompanhe o processamento e encontre os dados que
          precisa em um só lugar.
        </p>
        <div class="mt-10 h-px w-16 bg-emerald-300" aria-hidden="true"></div>
      </div>
      <p class="hidden text-sm text-emerald-200 lg:block">
        Univille Bank · Painel de acompanhamento
      </p>
    </aside>
    <section
      class="flex items-center justify-center px-5 py-10 sm:px-12 lg:py-16"
      aria-labelledby="auth-title"
    >
      <div class="w-full max-w-sm">
        <p class="eyebrow">
          {{ register ? "Comece por aqui" : "Bem-vindo de volta" }}
        </p>
        <h2 id="auth-title" class="mt-3 text-3xl font-semibold tracking-tight">
          {{ register ? "Crie sua conta" : "Acesse seu painel" }}
        </h2>
        <p class="mb-8 mt-3 text-sm leading-relaxed text-slate-500">
          {{
            register
              ? "Preencha seus dados para consultar as transações."
              : "Entre com seu e-mail e senha para continuar."
          }}
        </p>
        <FeedbackNotice
          v-if="auth.state.notice"
          class="mb-6"
          :message="auth.state.notice"
        />
        <AuthForm :key="mode" :mode="mode" />
        <p class="mt-7 text-center text-sm text-slate-500">
          {{ register ? "Já tem uma conta?" : "Ainda não tem uma conta?" }}
          <RouterLink
            :to="register ? '/login' : '/register'"
            class="ml-1 font-semibold text-emerald-800 underline underline-offset-4"
            >{{ register ? "Entrar" : "Criar conta" }}</RouterLink
          >
        </p>
      </div>
    </section>
  </main>
</template>
