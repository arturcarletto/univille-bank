FROM composer:2 AS composer

FROM php:8.3-cli

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        git \
        unzip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer /usr/bin/composer /usr/local/bin/composer

ENV COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_HOME=/tmp/composer \
    COMPOSER_CACHE_DIR=/tmp/composer-cache

RUN php -r "foreach (['ctype', 'curl', 'dom', 'fileinfo', 'filter', 'hash', 'mbstring', 'openssl', 'pdo', 'pdo_sqlite', 'session', 'tokenizer', 'xml', 'xmlreader', 'xmlwriter'] as \$extension) { if (!extension_loaded(\$extension)) { fwrite(STDERR, \"Missing PHP extension: {\$extension}\\n\"); exit(1); } }" \
    && composer --version

WORKDIR /workspace/backend

EXPOSE 8000

CMD ["php", "artisan", "serve", "--host=0.0.0.0", "--port=8000"]
