# Based on https://github.com/dead-guru/devichan/blob/master/php-fpm/Dockerfile

FROM composer:lts AS composer
FROM php:8.3-fpm-alpine AS runtime

RUN apk add --no-cache \
    zlib \
    zlib-dev \
    libpng \
    libpng-dev \
    libjpeg-turbo \
    libjpeg-turbo-dev \
    libwebp \
    libwebp-dev \
    libcurl \
    curl-dev \
    imagemagick \
    graphicsmagick \
    gifsicle \
    ffmpeg \
    bind-tools \
    gettext \
    gettext-dev \
    icu-dev \
    oniguruma \
    oniguruma-dev \
    libmcrypt \
    libmcrypt-dev \
    lz4-libs \
    lz4-dev \
    imagemagick-dev \
    pcre-dev \
    $PHPIZE_DEPS \
    && docker-php-ext-configure gd \
        --with-webp=/usr/include/webp \
        --with-jpeg=/usr/include \
    && docker-php-ext-install -j$(nproc) \
        gd \
        curl \
        bcmath \
        opcache \
        pdo_mysql \
        gettext \
        intl \
        mbstring \
    && pecl update-channels \
    && pecl install -o -f igbinary \
    && pecl install redis \
    && pecl install imagick \
    && docker-php-ext-enable \
        igbinary \
        redis \
        imagick \
    && apk del \
        zlib-dev \
        libpng-dev \
        libjpeg-turbo-dev \
        libwebp-dev \
        curl-dev \
        gettext-dev \
        oniguruma-dev \
        libmcrypt-dev \
        lz4-dev \
        imagemagick-dev \
        pcre-dev \
        $PHPIZE_DEPS \
    && rm -rf /var/cache/* \
    && rm -rf /tmp/pear
RUN rmdir /var/www/html \
    && install -d -m 744 -o www-data -g www-data /var/www \
    && install -d -m 700 -o www-data -g www-data /var/tmp/vichan \
    && install -d -m 700 -o www-data -g www-data /var/cache/gen-cache \
    && install -d -m 700 -o www-data -g www-data /var/cache/template-cache

COPY --from=composer /usr/bin/composer /usr/local/bin/composer

# Development reads the checkout from /code and keeps all generated files in /var/www.
FROM runtime AS development
# Apple file sharing does not allow chown/chmod on a mount's root. Use a child
# of the shared instance directory so PHP can own its writable document root.
WORKDIR /
RUN rm -rf /var/www && mkdir -p /instance/www && ln -s /instance/www /var/www
COPY ./docker/development/bootstrap.sh /usr/local/bin/development-bootstrap.sh
COPY ./docker/development/php.ini /usr/local/etc/php/conf.d/zz-development.ini
COPY ./docker/development/www.conf /usr/local/etc/php-fpm.d/zz-development.conf
ENV COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_VENDOR_DIR=/var/www/vendor \
    COMPOSER_CACHE_DIR=/var/cache/composer \
    TINYBOARD_PATH=/var/www
WORKDIR "/var/www"
CMD [ "sh", "/usr/local/bin/development-bootstrap.sh" ]
EXPOSE 9000

# Keep the original self-contained image as the default build target.
FROM runtime AS production

# Copy the bootstrap script.
COPY ./docker/php/bootstrap.sh /usr/local/bin/bootstrap.sh

# Copy the actual project (use .dockerignore to exclude stuff).
COPY . /code

# Install the compose depedencies.
RUN cd /code && composer install

WORKDIR "/var/www"
CMD [ "bootstrap.sh" ]
EXPOSE 9000
