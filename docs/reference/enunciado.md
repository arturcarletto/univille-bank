# Teste Prático – Univille Bank

### Objetivo

Desenvolver um mini painel de conciliação financeira composto por uma API em Laravel 9+ e uma interface em Vue 3.

O sistema deverá consumir transações de uma API externa de forma resiliente, processar essas transações de maneira assíncrona utilizando filas e disponibilizar um dashboard para consulta, acompanhamento e filtragem dos dados.

O objetivo é avaliar a capacidade de desenvolver uma solução organizada, sustentável, testável e escalável.

### Salvar Repositório no GitHub com:

- Pasta backend / (Laravel)
- Pasta frontend / (Vue.js)

Arquivo README.md com:

- Instruções de instalação e execução, como configurações, conexão DB, rotas, etc.
- Descrição do projeto.
- Tecnologias utilizadas.

Informar quando finalizar via e-mail para jackson.baptista@univille.br

## 1. Backend (Laravel)

### Arquitetura

O projeto deve demonstrar familiaridade com princípios de DDD (Domain-Driven Design) ou Clean Architecture, mantendo uma separação clara entre:

- Camada de infraestrutura (Controllers, Framework, Migrations, Providers, Drivers, etc.);
- Camada de domínio (Entities, Value Objects, Repositories, Use Cases/Actions, Services, etc.).

Não é obrigatório seguir uma implementação completa de DDD, mas a organização do projeto deve evidenciar essa separação de responsabilidades.

### Ingestão de Transações

Criar um comando Artisan ou um endpoint responsável por simular o consumo de uma API externa.

A API externa poderá ser simulada através de:

- arquivo JSON local;
- endpoint público;
- endpoint mockado;
- utilização do Http Client do Laravel.

Cada transação recebida deverá ser enviada individualmente para processamento utilizando Queues.

### Processamento Assíncrono

O processamento deverá ocorrer através de Jobs independentes.

O Job deve contemplar:

- tratamento de exceções;
- estratégia de retry;
- registro de falhas;
- tratamento para dados inválidos ou corrompidos;
- tratamento para indisponibilidade do serviço externo.

### Banco de Dados

Utilizar SQLite.

As migrations deverão demonstrar boas práticas:

- valores monetários utilizando decimal ou inteiros em centavos (não utilizar float);
- utilização correta de chaves estrangeiras;
- índices para colunas frequentemente utilizadas em filtros.

### API

Criar endpoints REST para consumo pelo frontend.

Espera-se o uso de:

- Form Requests;
- API Resources;
- Paginação;
- Filtros performáticos.

### Autenticação

Implementar um fluxo simples de autenticação contendo:

- Cadastro
  - Nome
  - E-mail
  - Senha
- Login

Toda a API utilizada pelo dashboard deverá estar protegida utilizando autenticação baseada em token (Laravel Sanctum, JWT ou OAuth2).

O frontend deverá armazenar e enviar corretamente esse token em todas as requisições.

## 2. Frontend (Vue 3)

Desenvolver utilizando:

- Vue 3
- Composition API (`<script setup>`)
- Vite
- Tailwind CSS

### Dashboard

Criar uma tela contendo:

- listagem das transações processadas;
- filtros por:
  - status;
  - período;
  - faixa de valores;
- paginação;
- indicador contendo:
  - transações pendentes;
  - transações processadas.

Atualizações em tempo real utilizando WebSockets ou Short Polling serão consideradas um diferencial.

### Componentização

Organizar os componentes de forma reutilizável, mantendo:

- Views enxutas;
- Separação de responsabilidades;
- Gerenciamento de estado previsível.

### O que será avaliado:

- Organização do projeto;
- Arquitetura;
- Qualidade do código;
- Legibilidade;
- Boas práticas do Laravel;
- Qualidade do Vue 3;
- Tratamento de erros;
- Escalabilidade;
- Facilidade de manutenção.
