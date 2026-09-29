#!/bin/sh

set -eu

if [ ! -r /code/composer.lock ] || [ ! -w /var/www ]; then
    echo "ERROR: Mount the checkout at /code and a writable instance directory at /var/www." >&2
    exit 1
fi

# Replace source links, but never overwrite a real file containing instance data.
link_source() {
    if [ -e "$2" ] && [ ! -L "$2" ]; then
        echo "ERROR: Expected a source symlink at $2; move the existing file aside first." >&2
        exit 1
    fi
    ln -sfnT "$1" "$2"
}

install -d -m 775 -o www-data -g www-data \
    /var/www /var/www/inc /var/www/templates /var/www/templates/cache \
    /var/www/tmp /var/www/tmp/cache /var/www/tmp/locks

for source in /code/*.php /code/LICENSE.* /code/install.sql; do
    [ -e "$source" ] || continue
    link_source "$source" "/var/www/${source##*/}"
done

for directory in js static stylesheets tools; do
    link_source "/code/$directory" "/var/www/$directory"
done

# Keep the two instance configuration files writable and local to this instance.
for source in /code/inc/*; do
    case "${source##*/}" in
        instance-config.php|secrets.php) continue ;;
    esac
    link_source "$source" "/var/www/inc/${source##*/}"
done

if [ ! -e /var/www/inc/instance-config.php ]; then
    install -m 660 -o www-data -g www-data \
        /code/docker/development/instance-config.php /var/www/inc/instance-config.php
fi
if [ ! -e /var/www/inc/secrets.php ]; then
    printf '<?php\n' > /var/www/inc/secrets.php
    chown www-data:www-data /var/www/inc/secrets.php
    chmod 660 /var/www/inc/secrets.php
fi

# A real templates directory lets Twig write cache files without touching /code.
for source in /code/templates/*; do
    [ "${source##*/}" = cache ] && continue
    link_source "$source" "/var/www/templates/${source##*/}"
done

if [ ! -e /var/www/robots.txt ]; then
    touch /var/www/robots.txt
    chown www-data:www-data /var/www/robots.txt
fi

# Composer calculates the project's autoload paths from /code while installing
# packages into the instance. Run the application from /var/www so its relative
# includes, config, generated pages and uploaded files use the writable instance.
dependency_hash=$(sha256sum /code/composer.json /code/composer.lock)
installed_hash=$(cat /var/www/vendor/.vichan-composer.sha256 2>/dev/null || true)
if [ ! -f /var/www/vendor/autoload.php ] || [ "$dependency_hash" != "$installed_hash" ]; then
    echo "Installing Composer dependencies for the development instance..."
    composer --working-dir=/code install --no-interaction --prefer-dist --no-progress
    printf '%s\n' "$dependency_hash" > /var/www/vendor/.vichan-composer.sha256
else
    # Newly added classes must also become available without rebuilding an image.
    composer --working-dir=/code dump-autoload --no-interaction
fi

cd /var/www
exec php-fpm
