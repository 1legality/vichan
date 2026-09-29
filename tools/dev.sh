#!/bin/bash
# Local macOS development with Apple's container CLI. No host PHP required.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
STATE="$ROOT/local-instances/apple"
PREFIX=vichan-dev
IMAGE=vichan-dev-php:latest
PORT=${VICHAN_DEV_PORT:-9080}

usage() {
    cat <<'EOF'
Usage: ./tools/dev.sh <command>
  up                 Build if needed and start http://127.0.0.1:9080
  down               Remove dev containers, preserving all data
  restart            Recreate dev containers (also applies a new port)
  build              Rebuild the PHP development image; restart to apply
  status             Show the four dev services
  logs [service]     Show logs (default: php; also web, db, redis)
  shell              Open a shell in the PHP container
  php <args>         Run PHP in the Linux development environment
  composer <args>    Run Composer against the mounted checkout
  rebuild            Regenerate board HTML and main.js
  check              Check PHP dependencies, DB, Redis, nginx and HTTP

Optional: VICHAN_DEV_PORT=9085 ./tools/dev.sh up
Data and credentials: local-instances/apple/ (ignored by Git).
EOF
}

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

require_tools() {
    [[ $(uname -s) == Darwin && $(uname -m) == arm64 ]] ||
        fail 'This launcher requires macOS on Apple Silicon.'
    local tool
    for tool in container jq openssl curl; do
        command -v "$tool" >/dev/null || fail "Missing command: $tool"
    done
    [[ "$PORT" =~ ^[0-9]+$ && ${#PORT} -le 5 ]] &&
        (( 10#$PORT > 0 && 10#$PORT <= 65535 )) || fail 'Invalid VICHAN_DEV_PORT.'
}

engine() {
    container system status >/dev/null 2>&1 || container system start
}

exists() { container inspect "$PREFIX-$1" >/dev/null 2>&1; }

owned() {
    container inspect "$PREFIX-$1" |
        jq -e --arg root "$ROOT" '.[0].configuration.labels["dev.vichan.path"] == $root' >/dev/null ||
        fail "Container $PREFIX-$1 belongs to another checkout; it was left untouched."
}

running() {
    container inspect "$PREFIX-$1" |
        jq -e '.[0].status | if type == "object" then .state == "running" else . == "running" end' >/dev/null
}

ip() {
    container inspect "$PREFIX-$1" |
        jq -er '.[0] | (.status.networks // .networks)[0] | (.ipv4Address // .address) | split("/")[0]'
}

prepare() {
    local service
    for service in web php redis db; do
        if exists "$service"; then owned "$service"; fi
    done
    mkdir -p "$STATE/www" "$STATE/nginx"
    if [[ ! -f "$STATE/dev.env" ]]; then
        # Never overwrite credentials: the database volume survives down/restart.
        if container volume inspect "$PREFIX-db-data" >/dev/null 2>&1; then
            fail 'Existing database volume but missing dev.env. Restore the credentials before starting.'
        fi
        local password
        password=$(openssl rand -hex 24)
        (umask 077; cat > "$STATE/dev.env" <<EOF
MYSQL_DATABASE=vichan
MYSQL_USER=vichan
MYSQL_PASSWORD=$password
MYSQL_ROOT_PASSWORD=$(openssl rand -hex 24)
VICHAN_MYSQL_NAME=vichan
VICHAN_MYSQL_USER=vichan
VICHAN_MYSQL_PASSWORD=$password
VICHAN_CACHE_ENGINE=redis
VICHAN_CACHE_PORT=6379
VICHAN_CACHE_PASSWORD=$(openssl rand -hex 24)
VICHAN_SECURE_LOGIN_ONLY=0
VICHAN_DIRECTORIES_ROOT=/
EOF
        )
    fi
    container network inspect "$PREFIX" >/dev/null 2>&1 || container network create "$PREFIX"
    for service in db redis; do
        if container volume inspect "$PREFIX-$service-data" >/dev/null 2>&1; then
            container volume inspect "$PREFIX-$service-data" |
                jq -e --arg root "$ROOT" '.[0].configuration.labels["dev.vichan.path"] == $root' >/dev/null ||
                fail "Volume $PREFIX-$service-data belongs to another checkout; it was left untouched."
        else
            container volume create --label "dev.vichan.path=$ROOT" "$PREFIX-$service-data"
        fi
    done
}

build() {
    engine
    container build --file "$ROOT/docker/php/Dockerfile" --target development \
        --tag "$IMAGE" "$ROOT"
}

start_service() {
    local service=$1
    shift
    if exists "$service"; then
        owned "$service"
        running "$service" || container start "$PREFIX-$service"
    else
        container run --detach --name "$PREFIX-$service" \
            --label "dev.vichan.path=$ROOT" --network "$PREFIX" "$@"
    fi
}

remove_service() {
    if exists "$1"; then
        owned "$1"
        if running "$1"; then container stop "$PREFIX-$1"; fi
        container delete "$PREFIX-$1"
    fi
}

wait_for() {
    local description=$1
    shift
    printf 'Waiting for %s...\n' "$description"
    local attempt
    for ((attempt=0; attempt<90; attempt++)); do
        if "$@" >/dev/null 2>&1; then return; fi
        sleep 2
    done
    fail "$description did not become ready. Use ./tools/dev.sh logs <service>."
}

up() {
    engine
    prepare
    container image inspect "$IMAGE" >/dev/null 2>&1 || build

    start_service db --cpus 2 --memory 1g --env-file "$STATE/dev.env" \
        --mount "type=volume,source=$PREFIX-db-data,target=/var/lib/mysql" \
        mysql:8.4
    wait_for MySQL container exec "$PREFIX-db" sh -c \
        'MYSQL_PWD="$MYSQL_PASSWORD" mysql -h 127.0.0.1 -u "$MYSQL_USER" "$MYSQL_DATABASE" -e "SELECT 1"'

    start_service redis --cpus 1 --memory 256m --env-file "$STATE/dev.env" \
        --mount "type=volume,source=$PREFIX-redis-data,target=/data" \
        redis:7-alpine sh -c 'exec redis-server --appendonly yes --requirepass "$VICHAN_CACHE_PASSWORD"'
    wait_for Redis container exec "$PREFIX-redis" sh -c \
        'REDISCLI_AUTH="$VICHAN_CACHE_PASSWORD" redis-cli ping'

    # Refresh both consumers of container IPs, including after a Mac reboot or
    # a partially stopped stack. Instance data and dependencies stay on disk.
    remove_service web
    remove_service php
    local db_host redis_host php_host
    db_host=$(ip db)
    redis_host=$(ip redis)
    start_service php --cpus 2 --memory 1g --env-file "$STATE/dev.env" \
        --env "VICHAN_MYSQL_HOST=$db_host" --env "VICHAN_CACHE_HOST=$redis_host" \
        --volume "$ROOT:/code:ro" --volume "$STATE:/instance" "$IMAGE"
    wait_for PHP container exec "$PREFIX-php" php -r \
        'exit(@fsockopen("127.0.0.1", 9000) ? 0 : 1);'

    php_host=$(ip php)
    sed "s/@PHP_HOST@/$php_host/g" "$ROOT/docker/development/nginx.conf.template" > "$STATE/nginx/default.conf"
    start_service web --cpus 1 --memory 256m --publish "127.0.0.1:$PORT:80" \
        --volume "$ROOT:/code:ro" --volume "$STATE/www:/var/www:ro" \
        --volume "$STATE/nginx:/etc/nginx/conf.d:ro" nginx:1.27.5-alpine-slim
    wait_for HTTP curl --fail --silent --max-time 5 "http://127.0.0.1:$PORT/install.php"
    printf '\nVichan: http://127.0.0.1:%s/\nData: %s/www\n' "$PORT" "$STATE"
    if [[ ! -f "$STATE/www/.installed" ]]; then
        printf 'Finish installation: http://127.0.0.1:%s/install.php\n' "$PORT"
    fi
}

down() {
    engine
    local service
    # Verify ownership of every container before changing any of them.
    for service in web php redis db; do
        if exists "$service"; then owned "$service"; fi
    done
    for service in web php redis db; do
        remove_service "$service"
    done
    printf 'Dev containers removed. Database, uploads and credentials preserved.\n'
}

php_exec() {
    owned php
    container exec --user www-data --workdir /var/www "$PREFIX-php" "$@"
}

check() {
    owned php
    owned web
    container exec --workdir /code --env COMPOSER_VENDOR_DIR=/var/www/vendor \
        "$PREFIX-php" composer check-platform-reqs
    php_exec php -r '
        try {
            $pdo = new PDO("mysql:host=" . getenv("VICHAN_MYSQL_HOST") . ";dbname=" . getenv("VICHAN_MYSQL_NAME"), getenv("VICHAN_MYSQL_USER"), getenv("VICHAN_MYSQL_PASSWORD"));
            $pdo->query("SELECT 1");
            $redis = new Redis();
            $redis->connect(getenv("VICHAN_CACHE_HOST"), 6379);
            $redis->auth(getenv("VICHAN_CACHE_PASSWORD"));
            if (!$redis->ping()) { exit(1); }
            echo "MySQL and Redis connections OK\n";
        } catch (Throwable $e) { fwrite(STDERR, "Service connection failed\n"); exit(1); }
    '
    php_exec php -r '
        require "inc/bootstrap.php";
        if (!(Cache::getCache() instanceof Vichan\Data\Driver\RedisCacheDriver)) { exit(1); }
        echo "Vichan autoload and Redis driver OK\n";
    '
    container exec "$PREFIX-web" nginx -t
    curl --fail --silent --show-error --max-time 10 --output /dev/null "http://127.0.0.1:$PORT/install.php"
    printf 'HTTP OK\n'
}

command=${1:-help}
if [[ $# -gt 0 ]]; then shift; fi
case "$command" in
    help|-h|--help) usage; exit 0 ;;
esac
require_tools
case "$command" in
    up) up ;;
    down) down ;;
    restart) down; up ;;
    build) build ;;
    status)
        container list --all --format json | jq -r --arg prefix "$PREFIX-" \
            '.[] | select(.configuration.id | startswith($prefix)) | [.configuration.id, (if (.status | type) == "object" then .status.state else .status end)] | @tsv'
        ;;
    logs)
        service=${1:-php}
        case "$service" in php|web|db|redis) ;; *) fail 'Use php, web, db or redis.' ;; esac
        owned "$service"
        container logs "$PREFIX-$service"
        ;;
    shell) owned php; container exec --tty --interactive --user www-data --workdir /var/www "$PREFIX-php" sh ;;
    php) php_exec php "$@" ;;
    composer)
        owned php
        # Read-only checkout: dependency installation is supported; edit manifests on the Mac.
        container exec --workdir /code --env COMPOSER_VENDOR_DIR=/var/www/vendor "$PREFIX-php" composer "$@"
        ;;
    rebuild) php_exec php tools/rebuild.php "$@" ;;
    check) check ;;
    *) usage >&2; exit 1 ;;
esac
