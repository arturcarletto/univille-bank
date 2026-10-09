# Univille Bank — Referência da API

A instalação, execução e demonstração estão no [README principal](../README.md).
Esta referência descreve os contratos específicos do backend Laravel/Sanctum.

## Autenticação e respostas

| Método | Endpoint | Entrada/retorno | Autenticação |
|---|---|---|---|
| POST | /api/register | name, email, password, password_confirmation; retorna token e user (201) | Pública |
| POST | /api/login | email, password; retorna token e user (200) | Pública |
| POST | /api/logout | Revoga o token atual (204) | Bearer |
| GET | /api/transactions | data, links e meta de paginação | Bearer |
| GET | /api/dashboard/summary | Contagens globais pending e processed | Bearer |

Enviar o token em `Authorization: Bearer <token>`. A API retorna JSON, inclusive
sem `Accept: application/json`. Validação usa HTTP 422; credenciais inválidas ou
token ausente/inválido usam HTTP 401. Cadastro/login têm limite de 10 tentativas
por minuto.

## Consulta de transações

- status: pending, processed, invalid ou failed; omitido, consulta todos.
- from e to: datas inclusivas YYYY-MM-DD, aplicadas a received_at em UTC.
- min_amount e max_amount: strings decimais positivas com até duas casas.
- page: inteiro positivo; per_page: 1 a 100, padrão 15.
- Ordenação: received_at e id decrescentes.

Cada registro expõe id, external_id, status, amount, currency, occurred_at,
received_at e processed_at. amount é uma string decimal exata ou null;
centavos são persistidos como inteiros. Payload bruto e motivos internos de
falha não são expostos. Os indicadores são globais, independentes dos filtros.

## Fila e persistência

SQLite e a fila database usam a mesma conexão Laravel: DB_QUEUE_CONNECTION
fica ausente ou igual a sqlite para preservar a atomicidade de registro e enqueue.
A fonte simulada aceita caminhos relativos a backend/database/fixtures.
Cada transação possui um Job independente; dados inválidos recebem status invalid,
enquanto falhas de processamento esgotadas recebem failed e registro em failed_jobs.
Os Jobs têm até três tentativas, com backoff de 5 e 30 segundos entre elas.
