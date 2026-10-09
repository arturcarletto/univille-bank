# Univille Bank — Backend

API Univille Bank implementada com Laravel 13, PHP 8.3, SQLite, Laravel Sanctum e fila `database`.

O [README da raiz](../README.md) contém o procedimento principal de instalação,
frontend e demonstração. Execute os comandos abaixo na raiz do repositório.

## Inicialização com Docker

Execute na raiz do repositório, em PowerShell:

```powershell
$createdBackendEnv = $false
if (-not (Test-Path -LiteralPath 'backend\.env')) {
    Copy-Item -LiteralPath 'backend\.env.example' -Destination 'backend\.env'
    $createdBackendEnv = $true
}
if (-not (Test-Path -LiteralPath 'backend\database\database.sqlite')) {
    New-Item -ItemType File -Path 'backend\database\database.sqlite' | Out-Null
}
docker compose build app worker
docker compose run --rm --no-deps app composer install --no-interaction --prefer-dist
if ($createdBackendEnv) {
    docker compose run --rm --no-deps app php artisan key:generate
}
docker compose run --rm --no-deps app php artisan migrate --force
docker compose up -d app
```

A API fica disponível em `http://localhost:8000`. O arquivo `.env` e o banco SQLite local são ignorados pelo Git.
Uma chave válida e um banco existente devem ser preservados. Não utilizar
`composer update` para reproduzir o lockfile, nem `composer setup` como substituto:
esse script também gera chave e instala/compila os assets herdados do backend.

O Compose mantém `DB_CONNECTION=sqlite`, `QUEUE_CONNECTION=database` e o mesmo
SQLite para API e worker. Deixe `DB_QUEUE_CONNECTION` ausente ou igual a `sqlite`;
a atomicidade do enqueue depende da mesma conexão Laravel.

## Ingestão simulada

O comando recebe somente caminhos relativos a `database/fixtures`. Cada item é persistido de modo idempotente e enviado para um Job independente.

```powershell
docker compose run --rm --no-deps app php artisan transactions:ingest
docker compose run --rm --no-deps app php artisan transactions:ingest transactions-with-invalid.json
```

Para consumo contínuo, execute `docker compose up -d worker` depois das migrations.
Para observar os estados intermediários, mantenha esse serviço parado e siga a
demonstração do README raiz. O exemplo é `backend/database/fixtures/transactions.json`.
Para processar a fila manualmente, sem outro worker ativo:

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
docker compose run --rm --no-deps app php artisan route:list --path=api
docker compose run --rm --no-deps app php artisan test --env=testing --do-not-cache-result
docker compose run --rm --no-deps app php vendor/bin/pint --test
```

Os testes usam SQLite em memória e `SESSION_DRIVER=array`, sem alterar sessões
da aplicação. A fila é sync por padrão; AtomicTransactionDispatchTest usa database
na mesma conexão isolada e verifica rollback, idempotência, recuperação e falha
definitiva pelo worker. Não executar migrations destrutivas em bancos existentes.
