# Univille Bank — Backend

Backend da SPEC-002 implementado com Laravel 13, PHP 8.3, SQLite, Laravel Sanctum e fila `database`.

## Inicialização com Docker

Execute na raiz do repositório, em PowerShell:

```powershell
docker compose build app worker
if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
docker compose run --rm --no-deps app composer update laravel/sanctum --with-all-dependencies --no-interaction
docker compose run --rm --no-deps app php -r "file_exists('database/database.sqlite') || touch('database/database.sqlite');"
docker compose run --rm --no-deps app php artisan key:generate
docker compose run --rm --no-deps app php artisan migrate --force
docker compose up app worker
```

A API fica disponível em `http://localhost:8000`. O arquivo `.env` e o banco SQLite local são ignorados pelo Git.

## Ingestão simulada

O comando recebe somente caminhos relativos a `database/fixtures`. Cada item é persistido de modo idempotente e enviado para um Job independente.

```powershell
docker compose run --rm --no-deps app php artisan transactions:ingest
docker compose run --rm --no-deps app php artisan transactions:ingest transactions-with-invalid.json
```

Com `docker compose up app worker`, o serviço `worker` consome a fila SQLite. Para processar a fila manualmente:

```powershell
docker compose run --rm --no-deps app php artisan queue:work database --stop-when-empty --tries=3
```

## Contrato REST

Todas as respostas de validação usam HTTP 422. Credenciais inválidas e chamadas protegidas sem token usam HTTP 401.

| Método | Endpoint | Autenticação | Contrato |
|---|---|---|---|
| `POST` | `/api/register` | Pública | `name`, `email`, `password`, `password_confirmation`; retorna `token` e `user` (201) |
| `POST` | `/api/login` | Pública | `email`, `password`; retorna `token` e `user` (200) |
| `POST` | `/api/logout` | Bearer token | Revoga o token atual (204) |
| `GET` | `/api/transactions` | Bearer token | Lista paginada, ordenada por recebimento mais recente |
| `GET` | `/api/dashboard/summary` | Bearer token | Retorna contagens `pending` e `processed` |

Filtros de `/api/transactions`:

- `status`: `pending`, `processed`, `invalid` ou `failed`;
- `from` e `to`: datas inclusivas em `YYYY-MM-DD`, aplicadas a `received_at` em UTC;
- `min_amount` e `max_amount`: strings decimais positivas com até duas casas;
- `page`: inteiro positivo;
- `per_page`: de 1 a 100, padrão 15.

Valores monetários são recebidos e devolvidos como strings decimais e armazenados em centavos inteiros. O payload bruto e motivos internos de falha não são expostos pela API.

## Verificação

```powershell
docker compose run --rm --no-deps app php -m
docker compose run --rm --no-deps app composer validate --strict
docker compose run --rm --no-deps -e DB_DATABASE=:memory: app php artisan migrate:fresh --env=testing --force
docker compose run --rm --no-deps app php artisan route:list --path=api
docker compose run --rm --no-deps app php artisan test
docker compose run --rm --no-deps app ./vendor/bin/pint --test
```

Os testes usam SQLite em memória e `QUEUE_CONNECTION=sync`, exceto o caso que verifica explicitamente a persistência no driver de fila `database`.
